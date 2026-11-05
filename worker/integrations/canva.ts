import type { Env } from '../env';
import { HttpError } from '../env';
import { json } from '../util';
import { publicUser } from '../store';
import {
  assertIdentityFree, freshAccessToken, getUserAccount, markConnected, markDisconnected, removeAccounts, saveAccount, tokenSetFrom, type AccountRow,
} from './accounts';
import {
  callbackUrl, checkNonce, downloadBytes, fetchJson, memberContext, newNonce, nonceCookie, requireConfigured, requireLead, resultPage,
} from './common';
import { decryptJson, encryptJson, pkcePair, signState, toB64, verifyState } from './crypto';
import { assertSubmittable, attachEvidenceFile, submitWithEvidence } from './evidence';
import type { User } from '../../src/types';

const API = 'https://api.canva.com/rest/v1';
const AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
const TOKEN_URL = `${API}/oauth/token`;
// Minimum needed to list/read designs and export them. Scopes do not cascade in Canva, so each one is listed.
const SCOPES = ['design:meta:read', 'design:content:read', 'profile:read'];

const basic = (env: Env) => 'Basic ' + toB64(new TextEncoder().encode(`${env.CANVA_CLIENT_ID}:${env.CANVA_CLIENT_SECRET}`));

async function tokenRequest(env: Env, form: Record<string, string>) {
  const r = await fetchJson(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basic(env), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  if (!r.ok || !r.data?.access_token) throw new HttpError(400, `Canva did not accept the authorisation (${r.status}). Please try connecting again.`);
  return r.data as { access_token: string; refresh_token?: string; expires_in?: number };
}

// Canva refresh tokens are single use: every refresh returns a new one, which freshAccessToken stores.
const refreshWith = (env: Env) => (refresh_token: string) => tokenRequest(env, { grant_type: 'refresh_token', refresh_token });

async function canva(env: Env, row: AccountRow, path: string, init: RequestInit = {}) {
  const token = await freshAccessToken(env, row, refreshWith(env));
  return fetchJson(`${API}${path}`, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
}

export async function canvaStart(env: Env, user: User, orgId: string, scope: 'user' | 'org' | 'root') {
  requireConfigured(env, 'canva', 'Canva');
  const ctx = await memberContext(env, user, orgId);
  if (scope !== 'user') requireLead(ctx, user.id, 'connect Canva for the whole organisation');
  const { verifier, challenge } = await pkcePair();
  const nc = newNonce();
  // The PKCE verifier travels inside the signed state, encrypted, so it is never readable in the URL.
  const state = await signState(env, { p: 'canva', u: user.id, o: orgId, s: scope, nc, v: await encryptJson(env, { v: verifier }, 'canva-pkce') });
  const url = `${AUTH_URL}?${new URLSearchParams({
    client_id: env.CANVA_CLIENT_ID!, redirect_uri: callbackUrl(env, 'canva'), response_type: 'code',
    scope: SCOPES.join(' '), code_challenge: challenge, code_challenge_method: 'S256', state,
  })}`;
  return json({ url }, 200, nonceCookie(env, nc));
}

export async function canvaCallback(env: Env, req: Request, url: URL): Promise<Response> {
  try {
    if (url.searchParams.get('error')) return resultPage('canva', false, 'Canva did not authorise the connection.');
    requireConfigured(env, 'canva', 'Canva');
    const st = await verifyState<{ p: string; u: string; o: string; s: 'user' | 'org' | 'root'; nc: string; v: string }>(env, url.searchParams.get('state'));
    if (st.p !== 'canva') throw new HttpError(400, 'This connection link is not valid. Please start again.');
    checkNonce(req, st.nc);
    const code = url.searchParams.get('code');
    if (!code) throw new HttpError(400, 'Canva did not send an authorisation code.');

    const user = await publicUser(env, st.u);
    if (!user) throw new HttpError(401, 'Account not found');
    const ctx = await memberContext(env, user, st.o);
    if (st.s !== 'user') requireLead(ctx, user.id, 'connect Canva for the whole organisation');

    const { v: verifier } = await decryptJson<{ v: string }>(env, st.v, 'canva-pkce');
    const tok = await tokenRequest(env, {
      grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: callbackUrl(env, 'canva'),
    });
    const auth = { Authorization: `Bearer ${tok.access_token}` };
    const me = await fetchJson(`${API}/users/me`, { headers: auth });
    const externalId = me.data?.team_user?.user_id;
    if (!me.ok || !externalId) throw new HttpError(502, 'Could not read your Canva account.');
    const prof = await fetchJson(`${API}/users/me/profile`, { headers: auth });
    const label = String(prof.data?.profile?.display_name || 'Canva account');

    await assertIdentityFree(env, st.o, 'canva', String(externalId), user.id, 'Canva');
    await removeAccounts(env, st.o, 'canva', 'user', user.id);
    await saveAccount(env, {
      orgId: st.o, provider: 'canva', kind: 'user', userId: user.id, externalId: String(externalId), label,
      secret: tokenSetFrom(tok), scopes: SCOPES.join(' '),
    });
    await markConnected(env, { orgId: st.o, userId: user.id, provider: 'canva', label, orgScope: st.s === 'user' ? undefined : st.s });
    return resultPage('canva', true, `Linked to Canva account ${label}.`, label);
  } catch (e) {
    if (e instanceof HttpError) return resultPage('canva', false, e.message);
    console.error('canva callback failed', e);
    return resultPage('canva', false, 'Something went wrong connecting Canva.');
  }
}

export async function canvaDisconnect(env: Env, user: User, orgId: string) {
  await memberContext(env, user, orgId);
  await removeAccounts(env, orgId, 'canva', 'user', user.id);
  await markDisconnected(env, { orgId, userId: user.id, provider: 'canva', org: false });
}

async function accountOrThrow(env: Env, orgId: string, userId: string) {
  const row = await getUserAccount(env, orgId, 'canva', userId);
  if (!row) throw new HttpError(409, 'Connect your Canva account first.', { code: 'not_linked' });
  return row;
}

export async function canvaDesigns(env: Env, user: User, orgId: string, query = '') {
  requireConfigured(env, 'canva', 'Canva');
  await memberContext(env, user, orgId);
  const q = new URLSearchParams({ limit: '20', sort_by: 'modified_descending' });
  if (query.trim()) q.set('query', query.trim().slice(0, 100));
  const r = await canva(env, await accountOrThrow(env, orgId, user.id), `/designs?${q}`);
  if (!r.ok) throw new HttpError(502, `Canva returned ${r.status} while listing designs.`);
  return {
    designs: (r.data?.items ?? []).map((d: any) => ({
      id: d.id, title: d.title || 'Untitled design', thumbnailUrl: d.thumbnail?.url ?? null,
      editUrl: d.urls?.edit_url ?? null, viewUrl: d.urls?.view_url ?? null, updatedAt: d.updated_at ?? null,
    })),
  };
}

export function parseCanvaDesignId(raw: string): string {
  const s = raw.trim();
  if (/^DA[A-Za-z0-9_-]{6,40}$/.test(s)) return s;
  let u: URL;
  try { u = new URL(s); } catch { throw new HttpError(400, 'Paste a Canva design link (canva.com/design/...).'); }
  if (u.protocol !== 'https:' || !(u.hostname === 'canva.com' || u.hostname.endsWith('.canva.com'))) {
    throw new HttpError(400, 'Paste a Canva design link (canva.com/design/...).');
  }
  const m = u.pathname.match(/\/design\/(DA[A-Za-z0-9_-]{6,40})/);
  if (!m) throw new HttpError(400, 'Paste a Canva design link (canva.com/design/...).');
  return m[1];
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function canvaExport(env: Env, user: User, b: { orgId?: string; taskId?: string; design?: string; format?: string }) {
  requireConfigured(env, 'canva', 'Canva');
  if (!b.orgId || !b.taskId || !b.design) throw new HttpError(400, 'orgId, taskId and design are required');
  const format = b.format === 'pdf' ? 'pdf' : 'png';
  await memberContext(env, user, b.orgId);
  await assertSubmittable(env, b.orgId, b.taskId, user.id);
  const designId = parseCanvaDesignId(b.design);
  const row = await accountOrThrow(env, b.orgId, user.id);

  const d = await canva(env, row, `/designs/${encodeURIComponent(designId)}`);
  if (d.status === 403 || d.status === 404) throw new HttpError(404, 'Your Canva account cannot open that design.');
  if (!d.ok) throw new HttpError(502, `Canva returned ${d.status}.`);
  const design = d.data?.design ?? {};

  const start = await canva(env, row, '/exports', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ design_id: designId, format: { type: format } }),
  });
  const jobId = start.data?.job?.id;
  if (!start.ok || !jobId) throw new HttpError(502, 'Canva could not start the export.');

  let urls: string[] | undefined;
  for (let i = 0; i < 12; i++) {
    const job = (await canva(env, row, `/exports/${encodeURIComponent(jobId)}`)).data?.job;
    if (job?.status === 'success') { urls = job.urls; break; }
    if (job?.status === 'failed') throw new HttpError(502, 'Canva could not export that design.');
    await sleep(1500);
  }
  if (!urls?.length) throw new HttpError(504, 'Canva is still exporting. Try again in a moment.');

  const dl = await downloadBytes(urls[0]); // multi-page designs export one file per page; the first page is the preview
  const safe = String(design.title || 'Canva design').replace(/[^\w .()-]/g, '').slice(0, 80);
  const file = await attachEvidenceFile(env, {
    orgId: b.orgId, user, taskId: b.taskId, name: `${safe}.${format}`,
    type: format === 'pdf' ? 'application/pdf' : (dl.type.startsWith('image/') ? dl.type : 'image/png'), bytes: dl.bytes, source: 'canva',
  });
  const task = await submitWithEvidence(env, {
    orgId: b.orgId, taskId: b.taskId, actorUserId: user.id, file,
    evidence: {
      source: 'plugin', url: design.urls?.view_url || design.urls?.edit_url || `https://www.canva.com/design/${designId}`,
      host: 'canva.com', capturedAt: new Date().toISOString(), previewUrl: file?.url, fullImport: !!file,
    },
  });
  return { task, file, pages: urls.length };
}
