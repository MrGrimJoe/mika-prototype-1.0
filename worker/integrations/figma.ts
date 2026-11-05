import type { Env } from '../env';
import { HttpError } from '../env';
import { json, randomToken } from '../util';
import { publicUser } from '../store';
import {
  assertIdentityFree, findUserLink, freshAccessToken, getUserAccount, markConnected, markDisconnected, removeAccounts, saveAccount, tokenSetFrom,
  type AccountRow,
} from './accounts';
import {
  appUrl, callbackUrl, checkNonce, downloadBytes, fetchJson, memberContext, newNonce, nonceCookie, requireConfigured, requireLead, resultPage,
} from './common';
import { sha256Hex, signState, timingSafeEqualStr, verifyState } from './crypto';
import { assertSubmittable, attachEvidenceFile, findTaskRefs, submitWithEvidence } from './evidence';
import type { User } from '../../src/types';

const FIGMA_API = 'https://api.figma.com';
const AUTH_URL = 'https://www.figma.com/oauth';
// Figma has two token endpoints in circulation (the newer api.figma.com one and the older www.figma.com one).
// We try the newer first and only fall back when it does not exist. Confirm against your app's page when you register it.
const TOKEN_URLS = ['https://api.figma.com/v1/oauth/token', 'https://www.figma.com/api/oauth/token'];
const REFRESH_URLS = ['https://api.figma.com/v1/oauth/refresh', 'https://www.figma.com/api/oauth/refresh'];
// Granular scopes (the broad files:read scope is deprecated). Edit here if Figma's scope picker names them differently.
const SCOPES = ['current_user:read', 'file_content:read', 'file_metadata:read', 'webhooks:write'];

async function postFirst(urls: string[], form: Record<string, string>): Promise<any> {
  let status = 0;
  for (const u of urls) {
    const r = await fetchJson(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(form),
    });
    if (r.ok && r.data?.access_token) return r.data;
    status = r.status;
    if (r.status !== 404 && r.status !== 405) break; // a real refusal (bad code, bad secret): do not retry elsewhere
  }
  throw new HttpError(400, `Figma did not accept the authorisation (${status}). Please try connecting again.`);
}

const refreshWith = (env: Env) => (refresh_token: string) => postFirst(REFRESH_URLS, {
  client_id: env.FIGMA_CLIENT_ID!, client_secret: env.FIGMA_CLIENT_SECRET!, grant_type: 'refresh_token', refresh_token,
});

async function figma(env: Env, row: AccountRow, path: string, init: RequestInit = {}) {
  const token = await freshAccessToken(env, row, refreshWith(env));
  return fetchJson(`${FIGMA_API}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
}

export async function figmaStart(env: Env, user: User, orgId: string, scope: 'user' | 'org' | 'root') {
  requireConfigured(env, 'figma', 'Figma');
  const ctx = await memberContext(env, user, orgId);
  if (scope !== 'user') requireLead(ctx, user.id, 'connect Figma for the whole organisation');
  const nc = newNonce();
  const state = await signState(env, { p: 'figma', u: user.id, o: orgId, s: scope, nc });
  const url = `${AUTH_URL}?${new URLSearchParams({
    client_id: env.FIGMA_CLIENT_ID!, redirect_uri: callbackUrl(env, 'figma'), scope: SCOPES.join(','), state, response_type: 'code',
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

    const tok = await postFirst(TOKEN_URLS, {
      client_id: env.FIGMA_CLIENT_ID!, client_secret: env.FIGMA_CLIENT_SECRET!, redirect_uri: callbackUrl(env, 'figma'),
      code, grant_type: 'authorization_code',
    });
    const me = await fetchJson(`${FIGMA_API}/v1/me`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!me.ok || !me.data?.id) throw new HttpError(502, 'Could not read your Figma profile.');
    const externalId = String(me.data.id);
    const label = String(me.data.handle || me.data.email || 'Figma account');

    await assertIdentityFree(env, st.o, 'figma', externalId, user.id, 'Figma');
    await removeAccounts(env, st.o, 'figma', 'user', user.id);
    await saveAccount(env, {
      orgId: st.o, provider: 'figma', kind: 'user', userId: user.id, externalId, label,
      secret: tokenSetFrom(tok), scopes: SCOPES.join(','),
    });
    await markConnected(env, { orgId: st.o, userId: user.id, provider: 'figma', label, orgScope: st.s === 'user' ? undefined : st.s });
    return resultPage('figma', true, `Linked to Figma account ${label}.`, label);
  } catch (e) {
    if (e instanceof HttpError) return resultPage('figma', false, e.message);
    console.error('figma callback failed', e);
    return resultPage('figma', false, 'Something went wrong connecting Figma.');
  }
}

export async function figmaDisconnect(env: Env, user: User, orgId: string) {
  await memberContext(env, user, orgId);
  await removeAccounts(env, orgId, 'figma', 'user', user.id);
  await markDisconnected(env, { orgId, userId: user.id, provider: 'figma', org: false });
}

// ---- Reading a linked file ---------------------------------------------------------------------------------

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

async function accountOrThrow(env: Env, orgId: string, userId: string) {
  const row = await getUserAccount(env, orgId, 'figma', userId);
  if (!row) throw new HttpError(409, 'Connect your Figma account first.', { code: 'not_linked' });
  return row;
}

export async function figmaFileInfo(env: Env, user: User, orgId: string, rawUrl: string) {
  requireConfigured(env, 'figma', 'Figma');
  await memberContext(env, user, orgId);
  const { key, nodeId } = parseFigmaUrl(rawUrl);
  const r = await figma(env, await accountOrThrow(env, orgId, user.id), `/v1/files/${key}?depth=1`);
  if (r.status === 403 || r.status === 404) throw new HttpError(404, 'Your Figma account cannot open that file.');
  if (!r.ok) throw new HttpError(502, `Figma returned ${r.status}.`);
  return { key, nodeId: nodeId ?? null, name: r.data.name, lastModified: r.data.lastModified, thumbnailUrl: r.data.thumbnailUrl ?? null };
}

// ---- Evidence: a preview of the work, attached by the assignee --------------------------------------------------

export async function figmaExport(env: Env, user: User, b: { orgId?: string; taskId?: string; fileUrl?: string }) {
  requireConfigured(env, 'figma', 'Figma');
  if (!b.orgId || !b.taskId || !b.fileUrl) throw new HttpError(400, 'orgId, taskId and fileUrl are required');
  await memberContext(env, user, b.orgId);
  await assertSubmittable(env, b.orgId, b.taskId, user.id); // cheap check first: only the assignee, only open tasks
  const { key, nodeId } = parseFigmaUrl(b.fileUrl);
  const row = await accountOrThrow(env, b.orgId, user.id);

  const meta = await figma(env, row, `/v1/files/${key}?depth=1`);
  if (!meta.ok) throw new HttpError(meta.status === 403 || meta.status === 404 ? 404 : 502, 'Your Figma account cannot open that file.');

  let imageUrl: string | undefined = meta.data.thumbnailUrl;
  if (nodeId) {
    const img = await figma(env, row, `/v1/images/${key}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`);
    if (!img.ok || img.data?.err) throw new HttpError(502, 'Figma could not render that frame.');
    imageUrl = img.data?.images?.[nodeId] ?? undefined;
  }
  if (!imageUrl) throw new HttpError(502, 'Figma did not return a preview for that file.');

  const dl = await downloadBytes(imageUrl);
  const safe = String(meta.data.name || 'Figma file').replace(/[^\w .()-]/g, '').slice(0, 80);
  const file = await attachEvidenceFile(env, {
    orgId: b.orgId, user, taskId: b.taskId, name: `${safe}${nodeId ? ` (${nodeId})` : ''}.png`,
    type: dl.type.startsWith('image/') ? dl.type : 'image/png', bytes: dl.bytes, source: 'figma',
  });
  const task = await submitWithEvidence(env, {
    orgId: b.orgId, taskId: b.taskId, actorUserId: user.id, file,
    evidence: { source: 'plugin', url: b.fileUrl, host: 'figma.com', capturedAt: new Date().toISOString(), previewUrl: file?.url, fullImport: !!file },
  });
  return { task, file };
}

// ---- Webhook: a saved Figma version labelled mika#<taskId> submits that task ------------------------------------

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
    // Figma only allows webhooks on paid plans; its own message explains that, so pass it through.
    throw new HttpError(r.status === 403 ? 403 : 400, String(r.data?.message || r.data?.err || 'Figma refused to create the webhook (it needs a paid Figma plan).'));
  }
  await env.DB.prepare(
    `INSERT INTO integration_webhooks (provider, webhook_id, org_id, task_id, context_id, created_by, passcode_hash, created_at)
     VALUES ('figma', ?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  ).bind(String(r.data.id), b.orgId, b.taskId, key, user.id, await sha256Hex(passcode), Date.now()).run();
  return { webhookId: String(r.data.id), tag: `mika#${b.taskId}`, reused: false };
}

export async function figmaWebhook(env: Env, req: Request): Promise<Response> {
  let body: any;
  try { body = await req.json(); } catch { throw new HttpError(400, 'Body must be JSON'); }
  const hookId = String(body?.webhook_id ?? '');
  const row = hookId ? await env.DB.prepare(
    `SELECT org_id, task_id, passcode_hash FROM integration_webhooks WHERE provider = 'figma' AND webhook_id = ?1`
  ).bind(hookId).first<{ org_id: string; task_id: string | null; passcode_hash: string }>() : null;
  if (!row) throw new HttpError(404, 'Unknown webhook');
  // Figma puts the passcode we chose in every payload. We only ever kept its hash.
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

