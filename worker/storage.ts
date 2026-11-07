import { AwsClient } from 'aws4fetch';
import type { Env } from './env';
import { HttpError } from './env';
import { isMember, loadOrgContext } from './store';
import { decryptJson, encryptJson } from './integrations/crypto';
import { isSet } from './integrations/common';
import type { Organization, User } from '../src/types';

/**
 * Where an organisation's file bytes live. Everything that reads or writes a file goes through here, so Mika's own
 * R2 bucket and an organisation's own server are interchangeable to the rest of the app.
 *
 *   mika        Cloudflare R2 (the binding on this Worker)
 *   self_host   any S3-compatible server the organisation runs (Garage, SeaweedFS, RustFS, MinIO, Ceph, ...),
 *               spoken to with aws4fetch (small, MIT, built for Workers). Credentials are the organisation's own and
 *               are stored encrypted.
 */
export type Backend = 'mika' | 'self_host';

export interface BlobMeta { contentType: string; name: string; uploadedBy: string }
export interface BlobStore {
  put(key: string, body: ArrayBuffer | ReadableStream, meta: BlobMeta): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

export interface SelfHostConfig { endpoint: string; region: string; bucket: string; pathStyle: boolean; accessKeyId: string; secretAccessKey: string }
interface StorageRow { org_id: string; endpoint: string; region: string; bucket: string; path_style: number; secret_enc: string; key_hint: string; updated_by: string; updated_at: number; verified_at: number | null }

const TIMEOUT_MS = 30_000;

// ---- Endpoint validation -----------------------------------------------------------------------------------------------

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
const INTERNAL_NAMES = /(^|\.)(localhost|local|internal|localdomain|lan|home\.arpa)$/i;

/**
 * An organisation root types this address, and the Worker will call it, so it must be a public https address.
 * (Cloudflare Workers cannot reach private networks anyway; to use a server inside a school network, publish it with
 * Cloudflare Tunnel or a reverse proxy. See docs/SELF_HOSTED_STORAGE.md.) Plain http is allowed only for localhost in DEV_AUTH.
 */
export function validateEndpoint(raw: string, devAuth = false): string {
  let u: URL;
  try { u = new URL(String(raw).trim()); } catch { throw new HttpError(400, 'The server address is not a valid URL, for example https://storage.school.example'); }
  const host = u.hostname.toLowerCase();
  const devLocal = devAuth && u.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1');
  if (!devLocal) {
    if (u.protocol !== 'https:') throw new HttpError(400, 'The server address must start with https://');
    if (INTERNAL_NAMES.test(host) || !host.includes('.') && !host.includes(':')) throw new HttpError(400, 'Use the public address of your server. Mika cannot reach names that only work inside a private network.');
    const ip = host.replace(/^\[|\]$/g, '');
    if (PRIVATE_V4.some(r => r.test(ip)) || /^(::1?|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i.test(ip) || /^::ffff:/i.test(ip)) {
      throw new HttpError(400, 'That address is a private network address. Publish the server on a public address (for example with Cloudflare Tunnel).');
    }
  }
  if (u.username || u.password) throw new HttpError(400, 'Do not put a username or password in the address. Enter the access key separately.');
  if (u.search || u.hash) throw new HttpError(400, 'The address should be just the server, without a path or query.');
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export function cleanConfig(b: Record<string, unknown>, devAuth: boolean): Omit<SelfHostConfig, 'accessKeyId' | 'secretAccessKey'> {
  const bucket = String(b.bucket ?? '').trim();
  if (!BUCKET_RE.test(bucket)) throw new HttpError(400, 'The bucket name must be 3 to 63 characters: lowercase letters, numbers, dots and hyphens.');
  const region = String(b.region ?? 'us-east-1').trim() || 'us-east-1';
  if (!/^[A-Za-z0-9-]{2,40}$/.test(region)) throw new HttpError(400, 'The region looks wrong. Most self-hosted servers accept us-east-1.');
  return { endpoint: validateEndpoint(String(b.endpoint ?? ''), devAuth), bucket, region, pathStyle: b.pathStyle !== false };
}

// ---- The S3 backend ----------------------------------------------------------------------------------------------------------

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const encodeKey = (k: string) => k.split('/').map(encodeURIComponent).join('/');

/** Turns a failed response into advice a school IT person can act on. Never echoes the server's response body. */
function serverError(status: number): HttpError {
  if (status === 401 || status === 403) return new HttpError(502, 'Your storage server rejected the access key, or the key is not allowed to read and write this bucket.', { code: 'storage_denied' });
  if (status === 404) return new HttpError(502, 'Your storage server says that bucket does not exist.', { code: 'storage_no_bucket' });
  if (status === 429 || status >= 500) return new HttpError(502, 'Your storage server is busy or unwell. Try again in a moment.', { code: 'storage_unavailable' });
  return new HttpError(502, `Your storage server gave an unexpected answer (${status}).`, { code: 'storage_error' });
}

export function s3Store(c: SelfHostConfig): BlobStore {
  const aws = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, region: c.region, service: 's3' });
  const u = new URL(c.endpoint);
  const base = (key: string) => c.pathStyle
    ? `${c.endpoint}/${c.bucket}/${encodeKey(key)}`
    : `${u.protocol}//${c.bucket}.${u.host}${u.pathname === '/' ? '' : u.pathname}/${encodeKey(key)}`;
  const call = async (url: string, init: RequestInit) => {
    try { return await aws.fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }); }
    catch { throw new HttpError(502, 'Could not reach your storage server. Check that its address is public and it is running.', { code: 'storage_unreachable' }); }
  };
  return {
    async put(key, body, meta) {
      // Buffered so the payload hash can be signed (the most widely accepted form; uploads are capped well below Worker memory).
      const buf = body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer();
      const res = await call(base(key), {
        method: 'PUT', body: buf,
        headers: {
          'Content-Type': meta.contentType || 'application/octet-stream',
          'x-amz-content-sha256': hex(await crypto.subtle.digest('SHA-256', buf)),
          'x-amz-meta-name': encodeURIComponent(meta.name).slice(0, 500), 'x-amz-meta-uploaded-by': meta.uploadedBy,
        },
      });
      if (!res.ok) throw serverError(res.status);
    },
    async get(key) {
      const res = await call(base(key), { method: 'GET' });
      if (res.status === 404) return null;
      if (!res.ok || !res.body) throw serverError(res.status);
      return { body: res.body, contentType: res.headers.get('Content-Type') || 'application/octet-stream' };
    },
    async delete(key) {
      const res = await call(base(key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw serverError(res.status);
    },
  };
}

const r2Store = (env: Env): BlobStore => ({
  async put(key, body, meta) {
    await env.FILES.put(key, body, { httpMetadata: { contentType: meta.contentType }, customMetadata: { name: meta.name, uploadedBy: meta.uploadedBy } });
  },
  async get(key) {
    const o = await env.FILES.get(key);
    return o ? { body: o.body, contentType: o.httpMetadata?.contentType || 'application/octet-stream' } : null;
  },
  async delete(key) { await env.FILES.delete(key); },
});

// ---- Per-organisation configuration -------------------------------------------------------------------------------------------

async function loadConfig(env: Env, orgId: string): Promise<SelfHostConfig | null> {
  const row = await env.DB.prepare('SELECT * FROM org_storage WHERE org_id = ?1').bind(orgId).first<StorageRow>();
  if (!row) return null;
  const secret = await decryptJson<{ accessKeyId: string; secretAccessKey: string }>(env, row.secret_enc, `org_storage:${orgId}`);
  return { endpoint: row.endpoint, region: row.region, bucket: row.bucket, pathStyle: !!row.path_style, ...secret };
}

/** The store for a backend that was recorded on a file (or chosen for new uploads). */
export async function storeFor(env: Env, orgId: string, backend: Backend): Promise<BlobStore> {
  if (backend === 'mika') return r2Store(env);
  const cfg = await loadConfig(env, orgId);
  if (!cfg) throw new HttpError(409, 'This organisation keeps files on its own server, but the server details are missing. The organisation root can enter them in Settings, Storage.', { code: 'storage_not_configured' });
  return s3Store(cfg);
}

/** Where NEW files for this organisation go, or why they cannot go anywhere. */
export function uploadBackend(org: Organization): Backend {
  if (!org.storageType || org.storageType === 'mika') return 'mika';
  if (org.storageType === 'self_host') return 'self_host';
  throw new HttpError(409, 'This organisation keeps files in its own drive, not Mika storage.');
}

const requireRoot = async (env: Env, user: User, orgId: string) => {
  const ctx = await loadOrgContext(env, orgId);
  if (user.id !== ctx.masterRootUserId) throw new HttpError(403, 'Only the organisation root can change where files are stored');
  return ctx;
};
const needKey = (env: Env) => {
  if (!isSet(env.TOKEN_ENCRYPTION_KEY)) throw new HttpError(501, 'Storage credentials cannot be saved safely on this deployment yet (TOKEN_ENCRYPTION_KEY is not set).', { code: 'not_configured' });
};

/** Writes, reads back and deletes a small object. This is the whole "does it work" test. */
export async function probe(store: BlobStore, orgId: string): Promise<void> {
  const key = `${orgId}/_mika-probe/${crypto.randomUUID()}`;
  const payload = new TextEncoder().encode('mika storage check').buffer as ArrayBuffer;
  await store.put(key, payload, { contentType: 'text/plain', name: 'probe.txt', uploadedBy: 'mika' });
  const got = await store.get(key);
  if (!got) throw new HttpError(502, 'The server accepted the test file but could not give it back.', { code: 'storage_error' });
  if ((await new Response(got.body).text()) !== 'mika storage check') throw new HttpError(502, 'The server returned different data than was stored.', { code: 'storage_error' });
  await store.delete(key);
}

export async function getStorageSettings(env: Env, user: User, orgId: string) {
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  const row = await env.DB.prepare('SELECT * FROM org_storage WHERE org_id = ?1').bind(orgId).first<StorageRow>();
  const root = user.id === ctx.masterRootUserId;
  return {
    storageType: ctx.org.storageType ?? 'mika', configured: !!row,
    // The server details are for the root only. Nobody, root included, ever receives the secret.
    selfHost: root && row ? { endpoint: row.endpoint, bucket: row.bucket, region: row.region, pathStyle: !!row.path_style, accessKeyHint: row.key_hint, verifiedAt: row.verified_at } : null,
  };
}

function readCreds(env: Env, b: Record<string, any>, existing: SelfHostConfig | null): SelfHostConfig {
  const base = cleanConfig(b, env.DEV_AUTH === '1');
  const accessKeyId = String(b.accessKeyId ?? '').trim() || existing?.accessKeyId || '';
  const secretAccessKey = String(b.secretAccessKey ?? '') || existing?.secretAccessKey || '';
  if (!accessKeyId || !secretAccessKey) throw new HttpError(400, 'Enter the access key id and secret for your server.');
  if (accessKeyId.length > 200 || secretAccessKey.length > 500) throw new HttpError(400, 'That access key looks too long.');
  return { ...base, accessKeyId, secretAccessKey };
}

/** Checks the details work, without saving anything. */
export async function testStorage(env: Env, user: User, orgId: string, body: Record<string, any>) {
  await requireRoot(env, user, orgId);
  const cfg = readCreds(env, body, await loadConfig(env, orgId));
  await probe(s3Store(cfg), orgId);
  return { ok: true };
}

/** Saves the details, but only if the server passes the check, then switches the organisation to it. */
export async function saveStorage(env: Env, user: User, orgId: string, body: Record<string, any>) {
  const ctx = await requireRoot(env, user, orgId);
  needKey(env);
  const cfg = readCreds(env, body, await loadConfig(env, orgId));
  await probe(s3Store(cfg), orgId);
  const now = Date.now();
  const enc = await encryptJson(env, { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }, `org_storage:${orgId}`);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO org_storage (org_id, endpoint, region, bucket, path_style, secret_enc, key_hint, updated_by, updated_at, verified_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
       ON CONFLICT(org_id) DO UPDATE SET endpoint = ?2, region = ?3, bucket = ?4, path_style = ?5, secret_enc = ?6, key_hint = ?7, updated_by = ?8, updated_at = ?9, verified_at = ?9`
    ).bind(orgId, cfg.endpoint, cfg.region, cfg.bucket, cfg.pathStyle ? 1 : 0, enc, cfg.accessKeyId.slice(-4), user.id, now),
    env.DB.prepare('UPDATE orgs SET json = ?2 WHERE id = ?1').bind(orgId, JSON.stringify({ ...ctx.org, storageType: 'self_host' })),
  ]);
  return getStorageSettings(env, user, orgId);
}

/** Forgets the saved credentials. Files already on the server stay there but cannot be opened from Mika until details are saved again. */
export async function clearStorage(env: Env, user: User, orgId: string) {
  await requireRoot(env, user, orgId);
  await env.DB.prepare('DELETE FROM org_storage WHERE org_id = ?1').bind(orgId).run();
  return { ok: true };
}
