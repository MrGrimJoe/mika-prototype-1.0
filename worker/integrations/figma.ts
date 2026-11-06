import type { Env } from '../env';
import { HttpError } from '../env';
import { json, randomToken } from '../util';
import { publicUser } from '../store';
import {
  assertIdentityFree, authedCall, findUserLink, getUserAccount, markConnected, markDisconnected, removeAccounts, saveAccount, tokenSetFrom,
  type AccountRow,
} from './accounts';
import {
  appUrl, callbackUrl, checkNonce, downloadBytes, failFor, fetchJson, fetchJsonRetry, memberContext, newNonce, nonceCookie, requireConfigured,
  requireLead, resultPage,
} from './common';
import { sha256Hex, signState, timingSafeEqualStr, toB64, verifyState } from './crypto';
import { assertSubmittable, findTaskRefs, submitWithEvidence } from './evidence';
import { clampTime, parseProviderTime, recordEvent } from './events';
import type {
  IntegrationAdapter, NormalizedActivity, PreviewFile, ProviderCapabilities, ResourceRef, ResourceSnapshot, SubscribeResult, SyncResult, SyncState,
} from './adapter';
import type { User } from '../../src/types';

const FIGMA_API = 'https://api.figma.com';
const AUTH_URL = 'https://www.figma.com/oauth';
// Figma has two token endpoint generations in circulation. The api.figma.com ones take the app credentials as HTTP Basic;
// the older www.figma.com ones take them in the form body. We try the newer first and only move on when it does not exist.
// Confirm both against your app's page when you register it (docs/INTEGRATIONS_FIGMA_CANVA.md).
const TOKEN_ENDPOINTS = [
  { url: 'https://api.figma.com/v1/oauth/token', basic: true },
  { url: 'https://www.figma.com/api/oauth/token', basic: false },
];
const REFRESH_ENDPOINTS = [
  { url: 'https://api.figma.com/v1/oauth/refresh', basic: true },
  { url: 'https://www.figma.com/api/oauth/refresh', basic: false },
];
// Granular scopes only (the broad files:read scope is deprecated), each one backing a concrete feature:
//   current_user:read   identify the connecting person       file_content:read   file name/version/thumbnail + frame previews
//   file_metadata:read  file metadata                        file_versions:read  named versions (activity)
//   file_comments:read  comment activity (ids only, no text) webhooks:write     activity webhooks + the version-label shortcut
// Figma's authorize endpoint takes them space separated.
const SCOPES = ['current_user:read', 'file_content:read', 'file_metadata:read', 'file_versions:read', 'file_comments:read', 'webhooks:write'];

const CAPABILITIES: ProviderCapabilities = {
  provider: 'figma', label: 'Figma',
  thumbnails: true, versions: true, comments: 'yes', webhooks: 'plan_required', exportPreview: true,
  notes: [
    'Mika only sees files you link to an assignment, and only what Figma reports about them: saved versions and comment activity (never comment text).',
    'Figma sends events to Mika only on plans that allow webhooks. Otherwise use Refresh to pull new activity.',
    'Edits are not tracked live. A saved, named version is the reliable signal.',
  ],
};

async function tokenPost(endpoints: { url: string; basic: boolean }[], env: Env, form: Record<string, string>): Promise<any> {
  const creds = { client_id: env.FIGMA_CLIENT_ID!, client_secret: env.FIGMA_CLIENT_SECRET! };
  const basic = 'Basic ' + toB64(new TextEncoder().encode(`${creds.client_id}:${creds.client_secret}`));
  let status = 0;
  for (const ep of endpoints) {
    const attempts = ep.basic ? [{ auth: basic, body: form }, { auth: '', body: { ...creds, ...form } }] : [{ auth: '', body: { ...creds, ...form } }];
    for (const a of attempts) {
      const r = await fetchJson(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', ...(a.auth ? { Authorization: a.auth } : {}) },
        body: new URLSearchParams(a.body),
      });
      if (r.ok && r.data?.access_token) return r.data;
      status = r.status;
      if (r.status === 404 || r.status === 405) break;        // this endpoint generation does not exist: try the next one
      if (r.status !== 400 && r.status !== 401) throw new HttpError(400, `Figma did not accept the authorisation (${status}). Please try connecting again.`);
    }
  }
  throw new HttpError(400, `Figma did not accept the authorisation (${status}). Please try connecting again.`);
}

const refreshWith = (env: Env) => (refresh_token: string) => tokenPost(REFRESH_ENDPOINTS, env, { grant_type: 'refresh_token', refresh_token });

/** One Figma call with the person's own token: refreshes when due, forces one refresh on 401, retries rate limits on reads. */
async function figma(env: Env, row: AccountRow, path: string, init: RequestInit = {}) {
  const read = !init.method || init.method === 'GET';
  return authedCall(env, row, refreshWith(env), token => {
    const req = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } };
    return read ? fetchJsonRetry(`${FIGMA_API}${path}`, req) : fetchJson(`${FIGMA_API}${path}`, req);
  });
}

export async function figmaStart(env: Env, user: User, orgId: string, scope: 'user' | 'org' | 'root') {
  requireConfigured(env, 'figma', 'Figma');
  const ctx = await memberContext(env, user, orgId);
  if (scope !== 'user') requireLead(ctx, user.id, 'connect Figma for the whole organisation');
  const nc = newNonce();
  const state = await signState(env, { p: 'figma', u: user.id, o: orgId, s: scope, nc });
  const url = `${AUTH_URL}?${new URLSearchParams({
    client_id: env.FIGMA_CLIENT_ID!, redirect_uri: callbackUrl(env, 'figma'), scope: SCOPES.join(' '), state, response_type: 'code',
  })}`;
  return json({ url }, 200, nonceCookie(env, nc));
}

export async function figmaCallback(env: Env, req: Request, url: URL): Promise<Response> {
  try {
    if (url.searchParams.get('error')) return resultPage('figma', false, 'Figma did not authorise the connection.');
    requireConfigured(env, 'figma', 'Figma');
    const st = await verifyState<{ p: string; u: string; o: string; s: 'user' | 'org' | 'root'; nc: string }>(env, url.searchParams.get('state'));
    if (st.p !== 'figma') throw new HttpError(400, 'This connection link is not valid. Please start again.');
    checkNonce(req, st.nc);
    const code = url.searchParams.get('code');
    if (!code) throw new HttpError(400, 'Figma did not send an authorisation code.');

    const user = await publicUser(env, st.u);
    if (!user) throw new HttpError(401, 'Account not found');
    const ctx = await memberContext(env, user, st.o);
    if (st.s !== 'user') requireLead(ctx, user.id, 'connect Figma for the whole organisation');

    const tok = await tokenPost(TOKEN_ENDPOINTS, env, { redirect_uri: callbackUrl(env, 'figma'), code, grant_type: 'authorization_code' });
    const me = await fetchJson(`${FIGMA_API}/v1/me`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!me.ok || !me.data?.id) throw new HttpError(502, 'Could not read your Figma profile.');
    const externalId = String(me.data.id);
    const label = String(me.data.handle || me.data.email || 'Figma account');

    await assertIdentityFree(env, st.o, 'figma', externalId, user.id, 'Figma');
    await removeAccounts(env, st.o, 'figma', 'user', user.id);
    await saveAccount(env, {
      orgId: st.o, provider: 'figma', kind: 'user', userId: user.id, externalId, label,
      secret: tokenSetFrom(tok), scopes: SCOPES.join(' '),
    });
    await markConnected(env, { orgId: st.o, userId: user.id, provider: 'figma', label, orgScope: st.s === 'user' ? undefined : st.s });
    return resultPage('figma', true, `Linked to Figma account ${label}.`, label);
  } catch (e) {
    if (e instanceof HttpError) return resultPage('figma', false, e.message);
    console.error('figma callback failed', e);
    return resultPage('figma', false, 'Something went wrong connecting Figma.');
  }
}

// ---- Links -----------------------------------------------------------------------------------------------------

export function parseFigmaUrl(raw: string): { key: string; nodeId?: string; url: string } {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new HttpError(400, 'That does not look like a Figma link.'); }
  if (u.protocol !== 'https:' || !(u.hostname === 'figma.com' || u.hostname.endsWith('.figma.com'))) {
    throw new HttpError(400, 'That does not look like a Figma link.');
  }
  const branch = u.pathname.match(/\/branch\/([A-Za-z0-9]{10,40})/);
  const file = u.pathname.match(/\/(?:file|design|proto|board|make)\/([A-Za-z0-9]{10,40})/);
  const key = branch?.[1] || file?.[1];
  if (!key) throw new HttpError(400, 'Paste a link to a Figma file (figma.com/design/...).');
  const node = u.searchParams.get('node-id');
  return { key, nodeId: node && /^[0-9:-]+$/.test(node) ? node.replace(/-/g, ':') : undefined, url: raw.trim() };
}

/** design | prototype | board (FigJam) | make, from the link's path. */
export function figmaResourceType(raw: string): string {
  const m = (() => { try { return new URL(raw.trim()).pathname.match(/\/(file|design|proto|board|make)\//); } catch { return null; } })();
  return ({ proto: 'prototype', board: 'board', make: 'make' } as Record<string, string>)[m?.[1] ?? ''] ?? 'design';
}

const safeHttps = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);

function snapshotFrom(d: any, type: string): ResourceSnapshot {
  return {
    title: String(d?.name || 'Untitled').slice(0, 200), type,
    version: d?.version ? String(d.version) : null,
    modifiedAt: parseProviderTime(d?.lastModified),
    thumbnailUrl: safeHttps(d?.thumbnailUrl),
  };
}

async function accountOrThrow(env: Env, orgId: string, userId: string) {
  const row = await getUserAccount(env, orgId, 'figma', userId);
  if (!row) throw new HttpError(409, 'Connect your Figma account first.', { code: 'not_linked' });
  return row;
}

// ---- Webhook clean-up helpers ------------------------------------------------------------------------------------

async function deleteRemoteWebhooks(env: Env, account: AccountRow | null, ids: string[]) {
  if (!account) return;
  for (const id of ids) {
    try { await figma(env, account, `/v2/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* already gone, or the grant is revoked */ }
  }
}

/** Activity watches on a file nobody has linked any more: delete them at Figma (best effort) and locally. */
async function dropFileWatches(env: Env, orgId: string, fileKey: string) {
  const { results } = await env.DB.prepare(
    `SELECT webhook_id, created_by FROM integration_watches WHERE provider = 'figma' AND org_id = ?1 AND context_id = ?2`
  ).bind(orgId, fileKey).all<{ webhook_id: string; created_by: string }>();
  for (const w of results) await deleteRemoteWebhooks(env, await getUserAccount(env, orgId, 'figma', w.created_by), [w.webhook_id]);
  await env.DB.prepare(`DELETE FROM integration_watches WHERE provider = 'figma' AND org_id = ?1 AND context_id = ?2`).bind(orgId, fileKey).run();
}

export async function figmaDisconnect(env: Env, user: User, orgId: string) {
  await memberContext(env, user, orgId);
  const account = await getUserAccount(env, orgId, 'figma', user.id);
  // Stop future sync first, while the token still exists to delete our webhooks at Figma.
  const watches = await env.DB.prepare(`SELECT webhook_id FROM integration_watches WHERE provider = 'figma' AND org_id = ?1 AND created_by = ?2`)
    .bind(orgId, user.id).all<{ webhook_id: string }>();
  const legacy = await env.DB.prepare(`SELECT webhook_id FROM integration_webhooks WHERE provider = 'figma' AND org_id = ?1 AND created_by = ?2`)
    .bind(orgId, user.id).all<{ webhook_id: string }>();
  await deleteRemoteWebhooks(env, account, [...watches.results, ...legacy.results].map(w => w.webhook_id));
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM integration_watches WHERE provider = 'figma' AND org_id = ?1 AND created_by = ?2`).bind(orgId, user.id),
    env.DB.prepare(`DELETE FROM integration_webhooks WHERE provider = 'figma' AND org_id = ?1 AND created_by = ?2`).bind(orgId, user.id),
    // The links and their history stay (they are part of the accountability record); they simply cannot sync until reconnected.
    env.DB.prepare(
      `UPDATE integration_resources SET sync_state = 'reconnect', sync_error = 'Figma was disconnected. Reconnect to resume syncing.', next_sync_after = NULL
       WHERE org_id = ?1 AND provider = 'figma' AND linked_by = ?2`).bind(orgId, user.id),
  ]);
  await removeAccounts(env, orgId, 'figma', 'user', user.id);
  await markDisconnected(env, { orgId, userId: user.id, provider: 'figma', org: false });
}

// ---- The adapter ----------------------------------------------------------------------------------------------------

const parseCursor = (c: string | null, fallback: number): { v: number; c: number } => {
  try { const j = JSON.parse(c || ''); return { v: Number(j.v) || fallback, c: Number(j.c) || fallback }; } catch { return { v: fallback, c: fallback }; }
};

export const figmaAdapter: IntegrationAdapter = {
  key: 'figma', label: 'Figma', capabilities: CAPABILITIES,

  parseResource(input: string): ResourceRef {
    const { key, nodeId, url } = parseFigmaUrl(input);
    return { provider: 'figma', externalId: key, nodeId, url, type: figmaResourceType(input) };
  },

  async fetchSnapshot(env, account, ref): Promise<ResourceSnapshot> {
    const r = await figma(env, account, `/v1/files/${encodeURIComponent(ref.externalId)}?depth=1`);
    if (!r.ok) throw failFor(r, 'Figma');
    return snapshotFrom(r.data, ref.type);
  },

  async sync(env, account, ref, prev: SyncState): Promise<SyncResult> {
    const snapshot = await this.fetchSnapshot(env, account, ref);
    const key = encodeURIComponent(ref.externalId);
    const cur = parseCursor(prev.cursor, prev.linkedAt);
    const activity: NormalizedActivity[] = [];
    const limits: string[] = [];
    let nextV = cur.v, nextC = cur.c;

    const baselined = prev.version !== null || prev.modifiedAt !== null;
    const changed = baselined && (prev.version !== snapshot.version || prev.modifiedAt !== snapshot.modifiedAt);
    if (changed) {
      activity.push({
        sourceEventId: `figma:update:${snapshot.version ?? snapshot.modifiedAt}`, type: 'resource_updated',
        occurredAt: snapshot.modifiedAt ?? Date.now(), meta: { version: snapshot.version },
      });
    }

    // Named versions are what Figma's own webhook reports too, so webhook and sync agree and deduplicate.
    if (changed || !baselined) {
      const vr = await figma(env, account, `/v1/files/${key}/versions`);
      if (vr.status === 403) limits.push('versions');
      else if (!vr.ok) throw failFor(vr, 'Figma');
      else {
        for (const v of (vr.data?.versions ?? []).slice(0, 30)) {
          const at = parseProviderTime(v?.created_at);
          if (!v?.id || !at || at <= cur.v || !String(v.label ?? '').trim()) continue;
          nextV = Math.max(nextV, at);
          activity.push({
            sourceEventId: `figma:version:${v.id}`, type: 'version_created', occurredAt: at,
            actorExternalId: v.user?.id ? String(v.user.id) : undefined, meta: { versionId: String(v.id), label: String(v.label).slice(0, 80) },
          });
        }
      }
    }

    const cr = await figma(env, account, `/v1/files/${key}/comments`);
    if (cr.status === 403) limits.push('comments');
    else if (!cr.ok) throw failFor(cr, 'Figma');
    else {
      const items = (cr.data?.comments ?? []).map((c: any) => ({ c, at: parseProviderTime(c?.created_at) }))
        .filter((x: any) => x.c?.id && x.at && x.at > cur.c)
        .sort((a: any, b: any) => b.at - a.at).slice(0, 50);
      for (const { c, at } of items) {
        nextC = Math.max(nextC, at);
        // Only that a comment happened, who made it (if Figma says) and whether it is a reply. Never the text.
        activity.push({
          sourceEventId: `figma:comment:${c.id}`, type: 'comment_added', occurredAt: at,
          actorExternalId: c.user?.id ? String(c.user.id) : undefined, meta: { commentId: String(c.id), reply: !!c.parent_id },
        });
      }
    }
    return { snapshot, activity, cursor: JSON.stringify({ v: nextV, c: nextC }), limits };
  },

  async exportPreview(env, account, ref): Promise<PreviewFile> {
    const key = encodeURIComponent(ref.externalId);
    const meta = await figma(env, account, `/v1/files/${key}?depth=1`);
    if (!meta.ok) throw failFor(meta, 'Figma');
    let imageUrl = safeHttps(meta.data?.thumbnailUrl);
    if (ref.nodeId) {
      const img = await figma(env, account, `/v1/images/${key}?ids=${encodeURIComponent(ref.nodeId)}&format=png&scale=2`);
      if (!img.ok) throw failFor(img, 'Figma');
      if (img.data?.err) throw new HttpError(502, 'Figma could not render that frame.');
      imageUrl = safeHttps(img.data?.images?.[ref.nodeId]);
    }
    if (!imageUrl) throw new HttpError(502, 'Figma did not return a preview for that file.');
    const dl = await downloadBytes(imageUrl);
    const safe = String(meta.data?.name || 'Figma file').replace(/[^\w .()-]/g, '').slice(0, 80);
    return {
      name: `${safe}${ref.nodeId ? ` (${ref.nodeId})` : ''}.png`, type: dl.type.startsWith('image/') ? dl.type : 'image/png',
      bytes: dl.bytes, viewUrl: ref.url,
    };
  },

  async subscribe(env, account, ref, ctx): Promise<SubscribeResult> {
    if (!appUrl(env).startsWith('https://')) {
      return { status: 'unavailable', reason: 'Figma can only send events to a public https address, so this deployment uses Refresh instead.' };
    }
    let active = false; let reason: string | undefined;
    for (const eventType of ['FILE_VERSION_UPDATE', 'FILE_COMMENT']) {
      const have = await env.DB.prepare(
        `SELECT webhook_id FROM integration_watches WHERE provider = 'figma' AND org_id = ?1 AND context_id = ?2 AND event_type = ?3 AND created_by = ?4`
      ).bind(ctx.orgId, ref.externalId, eventType, ctx.userId).first();
      if (have) { active = true; continue; }
      const passcode = randomToken();
      let r;
      try {
        r = await figma(env, account, '/v2/webhooks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: eventType, context: 'file', context_id: ref.externalId, endpoint: `${appUrl(env)}/api/webhooks/figma`, passcode, status: 'ACTIVE', description: 'Mika linked work' }),
        });
      } catch { reason = 'Figma could not be reached to set up events.'; continue; }
      if (!r.ok || !r.data?.id) {
        reason = r.status === 403
          ? 'Figma only allows webhooks on some plans, or this connection predates the feature (reconnect Figma).'
          : 'Figma did not accept the request to send events.';
        continue;
      }
      await env.DB.prepare(
        `INSERT OR IGNORE INTO integration_watches (provider, webhook_id, org_id, context_id, event_type, created_by, passcode_hash, created_at)
         VALUES ('figma', ?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      ).bind(String(r.data.id), ctx.orgId, ref.externalId, eventType, ctx.userId, await sha256Hex(passcode), Date.now()).run();
      active = true;
    }
    return active ? { status: 'active' } : { status: 'unavailable', reason };
  },

  async unsubscribe(env, { orgId, externalId }) { await dropFileWatches(env, orgId, externalId); },

  disconnect: figmaDisconnect,
};

/** Kept for the existing "paste a link and look at it" endpoint. */
export async function figmaFileInfo(env: Env, user: User, orgId: string, rawUrl: string) {
  requireConfigured(env, 'figma', 'Figma');
  await memberContext(env, user, orgId);
  const ref = figmaAdapter.parseResource(rawUrl);
  const snap = await figmaAdapter.fetchSnapshot(env, await accountOrThrow(env, orgId, user.id), ref);
  return {
    key: ref.externalId, nodeId: ref.nodeId ?? null, name: snap.title,
    lastModified: snap.modifiedAt ? new Date(snap.modifiedAt).toISOString() : null, thumbnailUrl: snap.thumbnailUrl,
  };
}

// ---- Shortcut: a saved Figma version labelled mika#<taskId> submits that task (opt-in, by the assignee) ------------------

export async function figmaWatch(env: Env, user: User, b: { orgId?: string; taskId?: string; fileUrl?: string }) {
  requireConfigured(env, 'figma', 'Figma');
  if (!b.orgId || !b.taskId || !b.fileUrl) throw new HttpError(400, 'orgId, taskId and fileUrl are required');
  await memberContext(env, user, b.orgId);
  await assertSubmittable(env, b.orgId, b.taskId, user.id);
  const { key } = parseFigmaUrl(b.fileUrl);
  const row = await accountOrThrow(env, b.orgId, user.id);

  const existing = await env.DB.prepare(
    `SELECT webhook_id FROM integration_webhooks WHERE provider = 'figma' AND org_id = ?1 AND task_id = ?2 AND context_id = ?3`
  ).bind(b.orgId, b.taskId, key).first<{ webhook_id: string }>();
  if (existing) return { webhookId: existing.webhook_id, tag: `mika#${b.taskId}`, reused: true };

  const passcode = randomToken();
  const r = await figma(env, row, '/v2/webhooks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'FILE_VERSION_UPDATE', context: 'file', context_id: key,
      endpoint: `${appUrl(env)}/api/webhooks/figma`, passcode, status: 'ACTIVE', description: `Mika task ${b.taskId}`.slice(0, 150),
    }),
  });
  if (!r.ok || !r.data?.id) {
    // Figma only allows webhooks on some plans; its own message explains that, so pass it through.
    throw new HttpError(r.status === 403 ? 403 : 400, String(r.data?.message || r.data?.err || 'Figma refused to create the webhook (it needs a plan that allows webhooks).'));
  }
  await env.DB.prepare(
    `INSERT INTO integration_webhooks (provider, webhook_id, org_id, task_id, context_id, created_by, passcode_hash, created_at)
     VALUES ('figma', ?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(String(r.data.id), b.orgId, b.taskId, key, user.id, await sha256Hex(passcode), Date.now()).run();
  return { webhookId: String(r.data.id), tag: `mika#${b.taskId}`, reused: false };
}

// ---- Webhook receiver ---------------------------------------------------------------------------------------------

export async function figmaWebhook(env: Env, req: Request): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch { throw new HttpError(400, 'Body must be JSON'); }
  const hookId = String(body?.webhook_id ?? '');
  if (!hookId) throw new HttpError(404, 'Unknown webhook');

  // 1. The version-label shortcut webhooks (can submit a task, only when the assignee tagged a version).
  const legacy = await env.DB.prepare(
    `SELECT org_id, task_id, passcode_hash FROM integration_webhooks WHERE provider = 'figma' AND webhook_id = ?1`
  ).bind(hookId).first<{ org_id: string; task_id: string | null; passcode_hash: string }>();
  if (legacy) return legacyVersionLabelHook(env, body, hookId, legacy);

  // 2. Activity watches (record events about linked files; can never submit or complete anything).
  const watch = await env.DB.prepare(
    `SELECT org_id, context_id, event_type, passcode_hash FROM integration_watches WHERE provider = 'figma' AND webhook_id = ?1`
  ).bind(hookId).first<{ org_id: string; context_id: string; event_type: string; passcode_hash: string }>();
  if (!watch) throw new HttpError(404, 'Unknown webhook');
  // Figma puts the passcode we chose in every payload. We only ever kept its hash.
  if (!timingSafeEqualStr(await sha256Hex(String(body.passcode ?? '')), watch.passcode_hash)) throw new HttpError(401, 'Invalid passcode');
  if (body.event_type === 'PING') return json({ ok: true, pong: true });
  // A payload is only trusted for the file and event type this webhook was registered for.
  if (body.event_type !== watch.event_type || String(body.file_key ?? '') !== watch.context_id) return json({ ok: true, ignored: 'mismatch' });

  const at = clampTime(parseProviderTime(body.created_at) ?? parseProviderTime(body.timestamp) ?? Date.now());
  const actor = body.triggered_by?.id ? String(body.triggered_by.id) : undefined;
  let ev: { type: 'version_created' | 'comment_added'; sourceEventId: string; meta: Record<string, string | boolean | null> } | null = null;
  if (body.event_type === 'FILE_VERSION_UPDATE' && body.version_id) {
    ev = { type: 'version_created', sourceEventId: `figma:version:${body.version_id}`, meta: { versionId: String(body.version_id), label: String(body.label ?? '').slice(0, 80) } };
  } else if (body.event_type === 'FILE_COMMENT' && body.comment_id) {
    ev = { type: 'comment_added', sourceEventId: `figma:comment:${body.comment_id}`, meta: { commentId: String(body.comment_id) } };
  }
  if (!ev) return json({ ok: true, ignored: 'unsupported_event' });

  const { results } = await env.DB.prepare(
    `SELECT r.id, r.task_id FROM integration_resources r WHERE r.org_id = ?1 AND r.provider = 'figma' AND r.external_id = ?2`
  ).bind(watch.org_id, watch.context_id).all<{ id: string; task_id: string }>();
  const actorUserId = actor ? (await findUserLink(env, watch.org_id, 'figma', actor))?.user_id ?? null : null;
  let recorded = 0;
  for (const r of results) {
    if (await recordEvent(env, {
      orgId: watch.org_id, taskId: r.task_id, resourceId: r.id, provider: 'figma', type: ev.type,
      sourceEventId: ev.sourceEventId, occurredAt: at, actorExternalId: actor, actorUserId, metadata: ev.meta,
    })) recorded++;
  }
  return json({ ok: true, recorded, matched: results.length, ...(results.length && !recorded ? { duplicate: true } : {}) });
}

async function legacyVersionLabelHook(env: Env, body: any, hookId: string, row: { org_id: string; task_id: string | null; passcode_hash: string }): Promise<Response> {
  if (!timingSafeEqualStr(await sha256Hex(String(body.passcode ?? '')), row.passcode_hash)) throw new HttpError(401, 'Invalid passcode');

  if (body.event_type === 'PING') return json({ ok: true, pong: true });
  if (body.event_type !== 'FILE_VERSION_UPDATE') return json({ ok: true, ignored: body.event_type });

  const deliveryId = `${hookId}:${body.version_id ?? body.timestamp ?? ''}`;
  const seen = await env.DB.prepare(`SELECT 1 AS x FROM webhook_deliveries WHERE provider = 'figma' AND delivery_id = ?1`).bind(deliveryId).first();
  if (seen) return json({ ok: true, duplicate: true });

  let result: unknown = { ignored: 'no_matching_tag' };
  const tagged = findTaskRefs(`${body.label ?? ''}\n${body.description ?? ''}`);
  if (row.task_id && tagged.includes(row.task_id)) {
    const link = await findUserLink(env, row.org_id, 'figma', String(body.triggered_by?.id ?? ''));
    if (!link) result = { ignored: 'saver_not_linked' };
    else {
      try {
        await submitWithEvidence(env, {
          orgId: row.org_id, taskId: row.task_id, actorUserId: link.user_id,
          evidence: {
            source: 'plugin', url: `https://www.figma.com/design/${body.file_key}`, host: 'figma.com',
            capturedAt: body.created_at || new Date().toISOString(),
          },
        });
        result = { submitted: row.task_id };
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        result = { skipped: `${row.task_id}:${e.status}` };
      }
    }
  }
  await env.DB.prepare(`INSERT OR IGNORE INTO webhook_deliveries (provider, delivery_id, received_at) VALUES ('figma', ?1, ?2)`)
    .bind(deliveryId, Date.now()).run();
  return json({ ok: true, result });
}
