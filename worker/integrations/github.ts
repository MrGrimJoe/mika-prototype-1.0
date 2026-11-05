import type { Env } from '../env';
import { HttpError } from '../env';
import { json } from '../util';
import { loadOrgContext, publicUser } from '../store';
import {
  assertIdentityFree, findInstallation, findUserLink, getOrgInstallation, markConnected, markDisconnected, removeAccounts, saveAccount,
} from './accounts';
import {
  callbackUrl, checkNonce, fetchJson, isSet, memberContext, newNonce, nonceCookie, requireConfigured, requireLead, resultPage,
} from './common';
import { fromB64, hmacSha256, signState, timingSafeEqualStr, toB64Url, toHex, verifyState } from './crypto';
import { findTaskRefs, submitWithEvidence } from './evidence';
import type { SubmissionEvidence, User } from '../../src/types';

const GH_API = 'https://api.github.com';
const GH_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Mika-Integration' };

// ---- GitHub App authentication (JWT -> installation token) ---------------------------------------------

/** GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY") keys; WebCrypto only imports PKCS#8, so wrap it. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const len = (n: number): number[] => {
    if (n < 128) return [n];
    const b: number[] = [];
    while (n > 0) { b.unshift(n & 255); n >>= 8; }
    return [0x80 | b.length, ...b];
  };
  const rsaAlg = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const inner = [0x02, 0x01, 0x00, ...rsaAlg, 0x04, ...len(pkcs1.length), ...pkcs1];
  return new Uint8Array([0x30, ...len(inner.length), ...inner]);
}

function pemToPkcs8(pem: string): Uint8Array {
  const text = pem.replace(/\\n/g, '\n'); // tolerate a one-line env value with literal \n
  const m = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/);
  if (!m) throw new HttpError(500, 'GITHUB_APP_PRIVATE_KEY is not a valid PEM key.');
  const der = fromB64(m[2].replace(/\s+/g, ''));
  return m[1] === 'RSA PRIVATE KEY' ? pkcs1ToPkcs8(der) : der;
}

export async function signAppJwt(appId: string, pem: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const te = new TextEncoder();
  const head = toB64Url(te.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = toB64Url(te.encode(JSON.stringify({ iat: nowSec - 60, exp: nowSec + 9 * 60, iss: appId })));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(pem) as BufferSource,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, te.encode(`${head}.${body}`)));
  return `${head}.${body}.${toB64Url(sig)}`;
}

const tokenCache = new Map<string, { token: string; exp: number }>();

async function installationToken(env: Env, installationId: string): Promise<string> {
  const hit = tokenCache.get(installationId);
  if (hit && hit.exp - 60_000 > Date.now()) return hit.token;
  const jwt = await signAppJwt(env.GITHUB_APP_ID!, env.GITHUB_APP_PRIVATE_KEY!);
  const r = await fetchJson(`${GH_API}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, {
    method: 'POST', headers: { ...GH_HEADERS, Authorization: `Bearer ${jwt}` },
  });
  if (!r.ok || !r.data?.token) {
    throw new HttpError(502, r.status === 404
      ? 'The Mika GitHub App is no longer installed on that GitHub account. Reconnect it.'
      : `GitHub refused to issue an access token (${r.status}).`);
  }
  tokenCache.set(installationId, { token: r.data.token, exp: Date.parse(r.data.expires_at) || Date.now() + 50 * 60_000 });
  return r.data.token;
}

// ---- Connecting: install (lead, once) and link (each person, once) ---------------------------------------

export function githubConfig(env: Env) {
  return {
    clientId: isSet(env.GITHUB_APP_CLIENT_ID) ? env.GITHUB_APP_CLIENT_ID : '',
    appSlug: isSet(env.GITHUB_APP_SLUG) ? env.GITHUB_APP_SLUG : '',
    isConfigured: ['GITHUB_APP_SLUG', 'GITHUB_APP_ID', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET']
      .every(k => isSet((env as any)[k])),
  };
}

/** Returns the GitHub URL to send the browser to, plus the cookie that ties the round trip to this browser. */
export async function githubStart(env: Env, user: User, orgId: string, mode: 'install' | 'link') {
  requireConfigured(env, 'github', 'GitHub');
  const ctx = await memberContext(env, user, orgId);
  if (mode === 'install') requireLead(ctx, user.id, 'connect GitHub for the whole organisation');
  const nc = newNonce();
  const state = await signState(env, { p: 'github', k: mode, u: user.id, o: orgId, nc });
  const url = mode === 'install'
    ? `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG!)}/installations/new?state=${encodeURIComponent(state)}`
    : `https://github.com/login/oauth/authorize?${new URLSearchParams({
        client_id: env.GITHUB_APP_CLIENT_ID!, redirect_uri: callbackUrl(env, 'github'), state,
      })}`;
  return json({ url }, 200, nonceCookie(env, nc));
}

async function exchangeUser(env: Env, code: string): Promise<{ id: string; login: string; token: string }> {
  const t = await fetchJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': GH_HEADERS['User-Agent'] },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID, client_secret: env.GITHUB_APP_CLIENT_SECRET, code, redirect_uri: callbackUrl(env, 'github'),
    }),
  });
  if (!t.ok || !t.data?.access_token) throw new HttpError(400, 'GitHub did not accept the authorisation. Please try connecting again.');
  const me = await fetchJson(`${GH_API}/user`, { headers: { ...GH_HEADERS, Authorization: `Bearer ${t.data.access_token}` } });
  if (!me.ok || !me.data?.id) throw new HttpError(502, 'Could not read your GitHub profile.');
  // The user token is only used to prove who they are. It is never stored.
  return { id: String(me.data.id), login: String(me.data.login), token: t.data.access_token };
}

async function userInstallations(token: string): Promise<{ id: number; account?: { login?: string } }[]> {
  const out: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetchJson(`${GH_API}/user/installations?per_page=100&page=${page}`, { headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new HttpError(502, 'Could not check your GitHub installations.');
    out.push(...(r.data?.installations ?? []));
    if ((r.data?.installations ?? []).length < 100) break;
  }
  return out;
}

export async function githubCallback(env: Env, req: Request, url: URL): Promise<Response> {
  try {
    if (url.searchParams.get('error')) return resultPage('github', false, 'GitHub did not authorise the connection.');
    requireConfigured(env, 'github', 'GitHub');
    const st = await verifyState<{ p: string; k: 'install' | 'link'; u: string; o: string; nc: string }>(env, url.searchParams.get('state'));
    if (st.p !== 'github') throw new HttpError(400, 'This connection link is not valid. Please start again.');
    checkNonce(req, st.nc);

    const code = url.searchParams.get('code');
    if (!code) {
      throw new HttpError(400, 'GitHub did not send an authorisation code. In the GitHub App settings, turn on "Request user authorization (OAuth) during installation".');
    }
    const me = await exchangeUser(env, code);
    const user = await publicUser(env, st.u);
    if (!user) throw new HttpError(401, 'Account not found');
    const ctx = await memberContext(env, user, st.o);

    if (st.k === 'install') {
      requireLead(ctx, user.id, 'connect GitHub for the whole organisation');
      const instId = url.searchParams.get('installation_id');
      if (!instId || !/^\d+$/.test(instId)) throw new HttpError(400, 'GitHub did not say which installation this is.');
      // Prove this GitHub user can really see that installation, so nobody can claim someone else's by guessing an id.
      const inst = (await userInstallations(me.token)).find(i => String(i.id) === instId);
      if (!inst) throw new HttpError(403, 'GitHub says your account does not have access to that installation.');
      const taken = await findInstallation(env, 'github', instId);
      if (taken && taken.org_id !== st.o) throw new HttpError(409, 'That GitHub installation is already connected to another organisation.');
      const label = inst.account?.login || me.login;
      await saveAccount(env, { orgId: st.o, provider: 'github', kind: 'installation', externalId: instId, label });
      await assertIdentityFree(env, st.o, 'github', me.id, user.id, 'GitHub');
      await saveAccount(env, { orgId: st.o, provider: 'github', kind: 'user', userId: user.id, externalId: me.id, label: me.login });
      await markConnected(env, { orgId: st.o, userId: user.id, provider: 'github', label, orgScope: 'org' });
      return resultPage('github', true, `Mika can now see activity on ${label}.`, label);
    }

    await assertIdentityFree(env, st.o, 'github', me.id, user.id, 'GitHub');
    await removeAccounts(env, st.o, 'github', 'user', user.id); // one GitHub account per person per org
    await saveAccount(env, { orgId: st.o, provider: 'github', kind: 'user', userId: user.id, externalId: me.id, label: me.login });
    await markConnected(env, { orgId: st.o, userId: user.id, provider: 'github', label: me.login });
    return resultPage('github', true, `Linked to GitHub account ${me.login}.`, me.login);
  } catch (e) {
    if (e instanceof HttpError) return resultPage('github', false, e.message);
    console.error('github callback failed', e);
    return resultPage('github', false, 'Something went wrong connecting GitHub.');
  }
}

export async function githubDisconnect(env: Env, user: User, orgId: string, target: 'user' | 'installation') {
  const ctx = await memberContext(env, user, orgId);
  if (target === 'installation') {
    requireLead(ctx, user.id, 'disconnect GitHub for the whole organisation');
    await removeAccounts(env, orgId, 'github', 'installation');
    await markDisconnected(env, { orgId, userId: user.id, provider: 'github', org: true });
  } else {
    await removeAccounts(env, orgId, 'github', 'user', user.id);
    await markDisconnected(env, { orgId, userId: user.id, provider: 'github' });
  }
}

// ---- Reading repositories (for task mentions) --------------------------------------------------------------

async function installationFor(env: Env, orgId: string) {
  const inst = await getOrgInstallation(env, orgId, 'github');
  if (!inst) throw new HttpError(409, 'GitHub is not connected for this organisation yet.', { code: 'not_linked' });
  return inst;
}

export async function githubRepos(env: Env, user: User, orgId: string) {
  requireConfigured(env, 'github', 'GitHub');
  await memberContext(env, user, orgId);
  const inst = await installationFor(env, orgId);
  const token = await installationToken(env, inst.external_id);
  const r = await fetchJson(`${GH_API}/installation/repositories?per_page=100`, { headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new HttpError(502, `GitHub returned ${r.status} while listing repositories.`);
  const repos = (r.data?.repositories ?? []).map((x: any) => ({
    id: String(x.id), name: x.name, fullName: x.full_name, owner: x.owner?.login, private: !!x.private,
    url: x.html_url, defaultBranch: x.default_branch, description: x.description ?? '',
  }));
  return { repos, account: inst.label, truncated: (r.data?.total_count ?? 0) > repos.length };
}

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const SEG_RE = /^[A-Za-z0-9 _.@()+,=~-]{1,200}$/;

export async function githubTree(env: Env, user: User, orgId: string, repo: string, path = '', ref = '') {
  requireConfigured(env, 'github', 'GitHub');
  await memberContext(env, user, orgId);
  if (!REPO_RE.test(repo)) throw new HttpError(400, 'repo must look like owner/name');
  const segs = path.split('/').filter(Boolean);
  if (segs.some(s => s === '.' || s === '..' || !SEG_RE.test(s))) throw new HttpError(400, 'That path is not valid');
  if (ref && !/^[A-Za-z0-9_./-]{1,200}$/.test(ref)) throw new HttpError(400, 'That branch name is not valid');
  const inst = await installationFor(env, orgId);
  const token = await installationToken(env, inst.external_id);
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const r = await fetchJson(`${GH_API}/repos/${repo}/contents/${segs.map(encodeURIComponent).join('/')}${q}`, { headers: { ...GH_HEADERS, Authorization: `Bearer ${token}` } });
  if (r.status === 404) throw new HttpError(404, 'Mika cannot see that path. Check the GitHub App has access to this repository.');
  if (!r.ok) throw new HttpError(502, `GitHub returned ${r.status} while reading that folder.`);
  const items = (Array.isArray(r.data) ? r.data : [r.data]).map((x: any) => ({
    name: x.name, path: x.path, type: x.type, size: x.size ?? 0, url: x.html_url,
  }));
  return { repo, path, items };
}

// ---- Webhook: evidence arrives from GitHub, never from the browser -------------------------------------------

export async function githubWebhook(env: Env, req: Request): Promise<Response> {
  if (!isSet(env.GITHUB_WEBHOOK_SECRET)) {
    throw new HttpError(501, 'GitHub webhooks are not enabled on this deployment yet.', { code: 'not_configured', missing: ['GITHUB_WEBHOOK_SECRET'] });
  }
  const raw = await req.text();
  const expected = 'sha256=' + toHex(await hmacSha256(env.GITHUB_WEBHOOK_SECRET!, raw));
  if (!timingSafeEqualStr(expected, req.headers.get('X-Hub-Signature-256') || '')) throw new HttpError(401, 'Invalid signature');

  const event = req.headers.get('X-GitHub-Event') || '';
  const delivery = req.headers.get('X-GitHub-Delivery') || '';
  if (event === 'ping') return json({ ok: true, pong: true });

  if (delivery) {
    const seen = await env.DB.prepare(`SELECT 1 AS x FROM webhook_deliveries WHERE provider = 'github' AND delivery_id = ?1`).bind(delivery).first();
    if (seen) return json({ ok: true, duplicate: true });
  }
  let payload: any;
  try { payload = JSON.parse(raw); } catch { throw new HttpError(400, 'Body must be JSON'); }

  let result: unknown = { ignored: event };
  if (event === 'push') result = await onPush(env, payload);
  else if (event === 'pull_request') result = await onPullRequest(env, payload);
  else if (event === 'installation' && payload.action === 'deleted') result = await onUninstalled(env, payload);

  if (delivery) {
    await env.DB.prepare(`INSERT OR IGNORE INTO webhook_deliveries (provider, delivery_id, received_at) VALUES ('github', ?1, ?2)`)
      .bind(delivery, Date.now()).run();
  }
  return json({ ok: true, result });
}

/** Who pushed? Only a GitHub account that a Mika person explicitly linked in THIS organisation counts. */
async function resolveActor(env: Env, payload: any) {
  const instId = String(payload.installation?.id ?? '');
  if (!instId) return { error: 'no_installation' as const };
  const inst = await findInstallation(env, 'github', instId);
  if (!inst) return { error: 'unknown_installation' as const };
  const link = await findUserLink(env, inst.org_id, 'github', String(payload.sender?.id ?? ''));
  if (!link) return { error: 'sender_not_linked' as const };
  return { orgId: inst.org_id, userId: link.user_id };
}

async function trySubmit(env: Env, orgId: string, userId: string, text: string, evidence: SubmissionEvidence, out: { submitted: string[]; skipped: string[] }) {
  for (const taskId of findTaskRefs(text)) {
    try {
      await submitWithEvidence(env, { orgId, taskId, actorUserId: userId, evidence });
      out.submitted.push(taskId);
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      out.skipped.push(`${taskId}:${e.status}`); // not found / not the assignee / already submitted: nothing to do
    }
  }
}

async function onPush(env: Env, p: any) {
  if (p.deleted) return { ignored: 'branch_deleted' };
  const who = await resolveActor(env, p);
  if ('error' in who) return { ignored: who.error };
  const out = { submitted: [] as string[], skipped: [] as string[] };
  for (const c of (p.commits ?? []).slice(0, 50)) {
    await trySubmit(env, who.orgId, who.userId, c.message || '', {
      source: 'commit', url: c.url, host: 'github.com', commitSha: c.id,
      commitMessage: String(c.message || '').split('\n')[0].slice(0, 200), capturedAt: c.timestamp || new Date().toISOString(),
    }, out);
  }
  return out;
}

async function onPullRequest(env: Env, p: any) {
  if (!['opened', 'reopened', 'ready_for_review'].includes(p.action)) return { ignored: `pull_request.${p.action}` };
  const who = await resolveActor(env, p);
  if ('error' in who) return { ignored: who.error };
  const pr = p.pull_request || {};
  const out = { submitted: [] as string[], skipped: [] as string[] };
  await trySubmit(env, who.orgId, who.userId, `${pr.title || ''}\n${pr.body || ''}`, {
    source: 'commit', url: pr.html_url, host: 'github.com', commitSha: pr.head?.sha,
    commitMessage: String(pr.title || '').slice(0, 200), capturedAt: new Date().toISOString(),
  }, out);
  return out;
}

async function onUninstalled(env: Env, p: any) {
  const instId = String(p.installation?.id ?? '');
  const inst = instId ? await findInstallation(env, 'github', instId) : null;
  if (!inst) return { ignored: 'unknown_installation' };
  await removeAccounts(env, inst.org_id, 'github', 'installation');
  const ctx = await loadOrgContext(env, inst.org_id);
  await markDisconnected(env, { orgId: inst.org_id, userId: ctx.masterRootUserId, provider: 'github', org: true });
  tokenCache.delete(instId);
  return { removed: inst.org_id };
}

