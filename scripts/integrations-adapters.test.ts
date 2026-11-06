// Run: npx tsx scripts/integrations-adapters.test.ts   (no network, no Worker, no real Figma/Canva account)
//
// Drives the real Worker modules against an in-memory SQLite database that has the real migrations applied
// (a thin D1 shim over node:sqlite) and a mocked `fetch`. Organisations, roles, invites and tasks are created through
// the same functions the API uses, so authority rules are the real ones, not stand-ins.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createUser } from '../worker/auth';
import { acceptInvite, createOrganization, issueInviteLink } from '../worker/orgs';
import { getDoc } from '../worker/store';
import { writeDoc } from '../worker/docs';
import { HttpError } from '../worker/env';
import { decryptJson } from '../worker/integrations/crypto';
import { fetchJsonRetry, retryDelayMs, failFor } from '../worker/integrations/common';
import { freshAccessToken, saveAccount, getUserAccount, type AccountRow } from '../worker/integrations/accounts';
import { figmaAdapter, figmaCallback, figmaStart, figmaWebhook, figmaDisconnect } from '../worker/integrations/figma';
import { canvaAdapter, canvaCallback, canvaStart, canvaDisconnect } from '../worker/integrations/canva';
import { adapterFor } from '../worker/integrations/adapters';
import { backoffMs, linkResource, listTaskWork, submitResource, syncResource, unlinkResource } from '../worker/integrations/resources';
import { recordEvent, sanitizeMeta, clampTime, parseProviderTime } from '../worker/integrations/events';
import { sha256Hex } from '../worker/integrations/crypto';
import type { Task, User } from '../src/types';

// ---- Harness ---------------------------------------------------------------------------------------------------------

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: any[] = []) {}
  bind(...p: any[]) { return new Stmt(this.db, this.sql, p); }
  async first<T = any>(): Promise<T | null> { return (this.db.prepare(this.sql).get(...this.params) as T) ?? null; }
  async all<T = any>() { return { results: this.db.prepare(this.sql).all(...this.params) as T[], success: true, meta: {} }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes) } }; }
}
function makeDb() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  return {
    prepare: (sql: string) => new Stmt(db, sql),
    batch: async (stmts: Stmt[]) => { db.exec('BEGIN'); try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    raw: db,
  };
}
const blobs = new Map<string, ArrayBuffer>();
const env: any = {
  DB: makeDb(), FILES: { put: async (k: string, v: ArrayBuffer) => { blobs.set(k, v); }, get: async () => null, delete: async () => {} },
  APP_URL: 'https://mika.test', TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'), OAUTH_STATE_SECRET: 'state-secret-for-tests',
  FIGMA_CLIENT_ID: 'fig-id', FIGMA_CLIENT_SECRET: 'fig-secret', CANVA_CLIENT_ID: 'canva-id', CANVA_CLIENT_SECRET: 'canva-secret',
};
const db = env.DB.raw as DatabaseSync;
const rows = (sql: string, ...p: any[]) => db.prepare(sql).all(...p) as any[];
const one = (sql: string, ...p: any[]) => db.prepare(sql).get(...p) as any;

type Call = { url: string; method: string; headers: Record<string, string>; body: string };
let calls: Call[] = [];
type Reply = Response | Promise<Response>;
let routes: { method: string; match: RegExp; reply: (c: Call) => Reply }[] = [];
const on = (method: string, match: RegExp, reply: (c: Call) => Reply) => { routes.unshift({ method, match, reply }); };
const J = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const reset = () => { routes = []; calls = []; };
globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
  const hdrs: Record<string, string> = {};
  new Headers(init.headers as any).forEach((v, k) => { hdrs[k.toLowerCase()] = v; });
  const c: Call = { url: String(input), method: (init.method || 'GET').toUpperCase(), headers: hdrs, body: init.body ? String(init.body) : '' };
  calls.push(c);
  const r = routes.find(x => x.method === c.method && x.match.test(c.url));
  return r ? r.reply(c) : J({ error: 'unmocked ' + c.method + ' ' + c.url }, 599);
}) as any;

let n = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  reset();
  try { await fn(); n++; console.log('PASS', name); } catch (e) { console.log('FAIL', name); throw e; }
};
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { if (e instanceof HttpError) return e.status; throw e; } };
const codeOf = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { if (e instanceof HttpError) return e.extra?.code ?? e.status; throw e; } };

// ---- World: organisation A (boss, alice, bob), organisation B (bea) --------------------------------------------------------

const tree = { id: 'root-department', department: 'Test School', roots: ['Principal'], roles: [], children: [{ id: 'n1', department: 'Class 1', roots: ['Class 1 Lead'], roles: ['Math Teacher'], children: [] }] };
const mkUser = (email: string, fullName: string) => createUser(env, { email, fullName });
const mkOrg = async (u: User, name: string) => createOrganization(env, u, {
  orgName: name, creator: { fullName: u.fullName }, tree, sections: [], sizing: { people: 10, storageGiB: 250, storageType: 'mika' },
});
const boss = await mkUser('boss@x.test', 'Bo Boss'), alice0 = await mkUser('alice@x.test', 'Alice'), bob0 = await mkUser('bob@x.test', 'Bob'), bea = await mkUser('bea@x.test', 'Bea');
const A = await mkOrg(boss, 'School A'), B = await mkOrg(bea, 'School B');
const mathA = A.roles.find(r => r.title === 'Math Teacher')!, mathB = B.roles.find(r => r.title === 'Math Teacher')!;
const link = (await issueInviteLink(env, boss, A.org.id, { targetRoleId: mathA.id, daysValid: 7 })).link;
const alice = (await acceptInvite(env, alice0, link.token, { fullName: 'Alice' })).user as User;
const bob = (await acceptInvite(env, bob0, link.token, { fullName: 'Bob' })).user as User;
const OA = A.org.id, OB = B.org.id;
let seq = 0;
const mkTask = async (org: string, by: User, role: any, assignee: string, id = `t${++seq}`) => {
  await writeDoc(env, by, org, 'task', id, { id, orgId: org, deptId: role.deptId, title: 'Poster ' + id, description: 'x', assignedByUserId: by.id, assignedToRoleId: role.id, assignedToUserId: assignee, status: 'pending' });
  return id;
};
const T1 = await mkTask(OA, boss, mathA, alice.id), T2 = await mkTask(OA, boss, mathA, bob.id), TB = await mkTask(OB, bea, mathB, '');
const FILE = 'AbCdEf1234567890', FILE_URL = `https://www.figma.com/design/${FILE}/Poster`;
const FIG = (path: string) => new RegExp('^https://api\\.figma\\.com' + path);
const tokens = (access = 'at-1', extra: Record<string, unknown> = {}) => ({ access_token: access, refresh_token: 'rt-1', expires_at: Date.now() + 3_600_000, ...extra });
const putAccount = (org: string, user: User, provider: 'figma' | 'canva', externalId: string, secret = tokens()) =>
  saveAccount(env, { orgId: org, provider, kind: 'user', userId: user.id, externalId, label: user.fullName, secret });
await putAccount(OA, alice, 'figma', 'F-ALICE'); await putAccount(OA, bob, 'figma', 'F-BOB'); await putAccount(OA, alice, 'canva', 'C-ALICE');

const fileReply = (over: Record<string, unknown> = {}) => J({ name: 'Poster v1', version: '100', lastModified: '2026-11-05T10:00:00Z', thumbnailUrl: 'https://thumbs.figma.test/t.png', ...over });
const linkFig = (user = alice, task = T1, input = FILE_URL) => linkResource(env, user, { orgId: OA, taskId: task, provider: 'figma', input });
const taskOf = async (id: string, org = OA) => (await getDoc<Task>(env, org, 'task', id))!;

// ---- 1. OAuth start and callback ----------------------------------------------------------------------------------------

await test('Figma start: space-separated minimal scopes, signed state, HttpOnly SameSite cookie', async () => {
  const res = await figmaStart(env, alice, OA, 'user');
  const url = new URL((await res.json() as any).url);
  assert.equal(url.origin + url.pathname, 'https://www.figma.com/oauth');
  assert.equal(url.searchParams.get('scope'), 'current_user:read file_content:read file_metadata:read file_versions:read file_comments:read webhooks:write');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://mika.test/api/integrations/figma/callback');
  const cookie = res.headers.get('Set-Cookie')!;
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Secure/);
  assert.ok(!JSON.stringify(url).includes('fig-secret'));
});
await test('Figma callback: forged state, missing cookie and wrong cookie are rejected; nothing is stored', async () => {
  const start = await figmaStart(env, bob, OA, 'user');
  const state = new URL((await start.json() as any).url).searchParams.get('state')!;
  const nonce = start.headers.get('Set-Cookie')!.split(';')[0].split('=')[1];
  const cb = (qs: string, cookie?: string) => figmaCallback(env, new Request('https://mika.test/x', { headers: cookie ? { Cookie: cookie } : {} }), new URL('https://mika.test/api/integrations/figma/callback?' + qs));
  assert.equal((await cb('code=c&state=garbage')).status, 400);
  const noCookie = await cb(`code=c&state=${state}`);
  assert.equal(noCookie.status, 400); assert.match(await noCookie.text(), /not started from this browser/);
  assert.equal((await cb(`code=c&state=${state}`, 'mika_oauth=wrong')).status, 400);
  assert.equal((await cb(`error=access_denied&state=${state}`, `mika_oauth=${nonce}`)).status, 400);
  assert.equal(calls.length, 0, 'no provider call was made for a rejected callback');
});
await test('Figma callback: exchanges the code with HTTP Basic, stores tokens ENCRYPTED, scoped to the org and user', async () => {
  const carol0 = await mkUser('carol@x.test', 'Carol');
  const carol = (await acceptInvite(env, carol0, link.token, { fullName: 'Carol' })).user as User;
  on('POST', FIG('/v1/oauth/token'), c => { assert.match(c.headers['authorization'], /^Basic /); assert.match(c.body, /code=the-code/); assert.ok(!c.body.includes('fig-secret')); return J({ access_token: 'SECRET-ACCESS', refresh_token: 'SECRET-REFRESH', expires_in: 7776000 }); });
  on('GET', FIG('/v1/me'), () => J({ id: 'F-CAROL', handle: 'carol' }));
  const start = await figmaStart(env, carol, OA, 'user');
  const state = new URL((await start.json() as any).url).searchParams.get('state')!;
  const nonce = start.headers.get('Set-Cookie')!.split(';')[0].split('=')[1];
  const res = await figmaCallback(env, new Request('https://mika.test/x', { headers: { Cookie: `mika_oauth=${nonce}` } }), new URL(`https://mika.test/cb?code=the-code&state=${state}`));
  assert.equal(res.status, 200);
  const row = one(`SELECT * FROM integration_accounts WHERE user_id = ? AND provider = 'figma'`, carol.id);
  assert.equal(row.org_id, OA); assert.equal(row.external_id, 'F-CAROL');
  assert.ok(!row.secret_enc.includes('SECRET') && !JSON.stringify(row).includes('SECRET-ACCESS'), 'tokens are not stored in the clear');
  assert.equal((await decryptJson<any>(env, row.secret_enc, row.id)).refresh_token, 'SECRET-REFRESH');
  await assert.rejects(decryptJson(env, row.secret_enc, 'acct_other_row'), 'ciphertext is bound to its own row');
  assert.ok(!(await res.text()).includes('SECRET'), 'the result page never shows credentials');
});
await test('Canva start uses PKCE (S256) and the verifier is not readable in the URL; callback sends it back', async () => {
  const res = await canvaStart(env, bob, OA, 'user');
  const url = new URL((await res.json() as any).url);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok((url.searchParams.get('code_challenge') || '').length >= 43);
  assert.equal(url.searchParams.get('scope'), 'design:meta:read design:content:read profile:read');
  const state = url.searchParams.get('state')!; const nonce = res.headers.get('Set-Cookie')!.split(';')[0].split('=')[1];
  on('POST', /api\.canva\.com\/rest\/v1\/oauth\/token/, c => { assert.match(c.body, /code_verifier=[A-Za-z0-9_-]{43,}/); return J({ access_token: 'a', refresh_token: 'r', expires_in: 14400 }); });
  on('GET', /users\/me\/profile/, () => J({ profile: { display_name: 'Bob C' } }));
  on('GET', /users\/me$/, () => J({ team_user: { user_id: 'C-BOB' } }));
  const out = await canvaCallback(env, new Request('https://mika.test/x', { headers: { Cookie: `mika_oauth=${nonce}` } }), new URL(`https://mika.test/cb?code=x&state=${state}`));
  assert.equal(out.status, 200);
  assert.equal(one(`SELECT external_id FROM integration_accounts WHERE user_id = ? AND provider = 'canva'`, bob.id).external_id, 'C-BOB');
});
await test('the same provider account cannot be linked to two people in one organisation', async () => {
  const start = await figmaStart(env, bob, OA, 'user');
  const state = new URL((await start.json() as any).url).searchParams.get('state')!; const nonce = start.headers.get('Set-Cookie')!.split(';')[0].split('=')[1];
  on('POST', FIG('/v1/oauth/token'), () => J({ access_token: 'a', refresh_token: 'r', expires_in: 100 }));
  on('GET', FIG('/v1/me'), () => J({ id: 'F-ALICE', handle: 'alice' })); // Alice's Figma identity
  const out = await figmaCallback(env, new Request('https://mika.test/x', { headers: { Cookie: `mika_oauth=${nonce}` } }), new URL(`https://mika.test/cb?code=x&state=${state}`));
  assert.equal(out.status, 400); assert.match(await out.text(), /already linked to another person/);
});

// ---- 2. Tokens: refresh, revocation, rate limits ------------------------------------------------------------------------

await test('expired access token is refreshed and the new token stored; a 401 forces one refresh and retries', async () => {
  await putAccount(OA, bob, 'figma', 'F-BOB', tokens('old', { expires_at: Date.now() - 1000 }));
  let acct = (await getUserAccount(env, OA, 'figma', bob.id))!;
  on('POST', FIG('/v1/oauth/refresh'), () => J({ access_token: 'new-1', expires_in: 3600 }));
  assert.equal(await freshAccessToken(env, acct, async rt => (await (await fetch('https://api.figma.com/v1/oauth/refresh', { method: 'POST', body: new URLSearchParams({ refresh_token: rt }) })).json()) as any), 'new-1');
  acct = (await getUserAccount(env, OA, 'figma', bob.id))!;
  assert.equal((await decryptJson<any>(env, acct.secret_enc!, acct.id)).access_token, 'new-1');

  // revoked grant: Figma says 401 although the token looks valid; the refresh also fails -> reconnect, never a vague 500
  reset(); await putAccount(OA, alice, 'figma', 'F-ALICE');
  on('GET', FIG('/v1/files/'), () => J({ message: 'Invalid token' }, 401));
  on('POST', /oauth\/(refresh|token)/, () => J({ error: 'invalid_grant' }, 400));
  const acctA = (await getUserAccount(env, OA, 'figma', alice.id))!;
  assert.equal(await codeOf(figmaAdapter.fetchSnapshot(env, acctA, figmaAdapter.parseResource(FILE_URL))), 'reconnect');
});
await test('a refresh that lost a race to a concurrent refresh uses the winner\'s token instead of forcing a reconnect (single-use refresh tokens)', async () => {
  await putAccount(OA, alice, 'figma', 'F-ALICE', tokens('stale', { expires_at: Date.now() - 1000 }));
  const stale = (await getUserAccount(env, OA, 'figma', alice.id))!;
  const winner = { ...stale };
  await putAccount(OA, alice, 'figma', 'F-ALICE', tokens('winner-token')); // another request refreshed meanwhile
  const got = await freshAccessToken(env, stale, async () => { throw new Error('refresh token already used'); });
  assert.equal(got, 'winner-token'); void winner;
  await putAccount(OA, alice, 'figma', 'F-ALICE');
});
await test('rate limits: retries 429 with backoff, honours a short Retry-After, hands a long one back instead of sleeping', async () => {
  let hits = 0;
  on('GET', /rl\.test\/short/, () => ++hits < 3 ? J({}, 429, { 'Retry-After': '0' }) : J({ ok: 1 }));
  assert.equal((await fetchJsonRetry('https://rl.test/short', {}, { baseMs: 1 })).status, 200); assert.equal(hits, 3);
  let long = 0; on('GET', /rl\.test\/long/, () => { long++; return J({}, 429, { 'Retry-After': '120' }); });
  const t0 = Date.now(); const r = await fetchJsonRetry('https://rl.test/long', {}, { baseMs: 1 });
  assert.equal(r.status, 429); assert.equal(r.retryAfter, 120); assert.equal(long, 1); assert.ok(Date.now() - t0 < 1000, 'did not sleep for 2 minutes');
  assert.deepEqual([0, 1, 2, 3].map(a => retryDelayMs(a, undefined, 400)), [400, 800, 1600, 3200]);
  assert.equal(retryDelayMs(0, 7), 7000);
  assert.deepEqual([0, 1, 2, 20].map(backoffMs), [30_000, 60_000, 120_000, 3_600_000]);
  const e = failFor({ ok: false, status: 429, data: { token: 'LEAK' }, retryAfter: 9 }, 'Figma');
  assert.equal(e.extra?.retryAfter, 9); assert.ok(!e.message.includes('LEAK'));
});

// ---- 3. Linking ----------------------------------------------------------------------------------------------------------

await test('linking: assignee only, to the right assignment, idempotent, and it is NOT a submission', async () => {
  on('GET', FIG('/v1/files/'), () => fileReply());
  on('POST', FIG('/v2/webhooks$'), () => J({ id: 'wh-' + Math.random().toString(36).slice(2) }));
  const r = await linkFig();
  assert.equal(r.created, true); assert.equal(r.resource.title, 'Poster v1'); assert.equal(r.resource.version, '100'); assert.equal(r.resource.type, 'design');
  assert.equal(r.resource.submission.status, 'not_submitted'); assert.equal(r.resource.review.status, 'none');
  assert.equal((await taskOf(T1)).status, 'pending', 'linking does not change the task');
  assert.equal(one('SELECT task_id, linked_by FROM integration_resources WHERE id = ?', r.resource.id).task_id, T1);
  const again = await linkFig(); assert.equal(again.created, false); assert.equal(rows('SELECT * FROM integration_resources WHERE task_id = ?', T1).length, 1);
  assert.equal(rows(`SELECT * FROM integration_events WHERE task_id = ? AND event_type = 'resource_linked'`, T1).length, 1);
  assert.equal(await status(linkFig(bob, T1)), 403, "Bob cannot link to Alice's task");
  assert.equal(await status(linkFig(alice, T2)), 403, "Alice cannot link to Bob's task");
  assert.equal(await status(linkFig(alice, TB)), 404, "another organisation's task does not exist here");
  assert.equal(await status(linkFig(alice, T1, 'https://evil.example/design/AbCdEf1234567890')), 400, 'foreign hosts rejected');
  assert.equal(await status(linkResource(env, alice, { orgId: OA, taskId: T1, provider: 'github', input: 'x' })), 404, 'only registered adapters');
});
await test('linking needs the person\'s own connected account and one they can actually open the file with', async () => {
  const dave = (await acceptInvite(env, await mkUser('dave@x.test', 'Dave'), link.token, { fullName: 'Dave' })).user as User;
  const T = await mkTask(OA, boss, mathA, dave.id);
  assert.equal(await codeOf(linkFig(dave, T)), 'not_linked');
  on('GET', FIG('/v1/files/'), () => J({ status: 403, err: 'Forbidden' }, 403));
  assert.equal(await codeOf(linkFig(alice, T1, `https://www.figma.com/design/ZzZzZz9999999999/Other`)), 'inaccessible');
});
await test('Canva: link reads metadata; it reports that no revision id exists and that comments/webhooks are preview-only', async () => {
  on('GET', /rest\/v1\/designs\/DAGabc123XYZ/, () => J({ design: { id: 'DAGabc123XYZ', title: 'Banner', updated_at: 1_762_000_000, thumbnail: { url: 'https://export.canva.test/t.png' }, urls: { view_url: 'https://www.canva.com/design/DAGabc123XYZ/view' } } }));
  const r = await linkResource(env, alice, { orgId: OA, taskId: T1, provider: 'canva', input: 'https://www.canva.com/design/DAGabc123XYZ/tok/edit' });
  assert.equal(r.resource.title, 'Banner'); assert.equal(r.resource.version, null); assert.equal(r.resource.providerModifiedAt, 1_762_000_000_000);
  assert.equal(r.webhook.status, 'unsupported');
  assert.equal(canvaAdapter.capabilities.comments, 'preview_only'); assert.equal(canvaAdapter.capabilities.webhooks, 'preview_only'); assert.equal(canvaAdapter.capabilities.versions, false);
  assert.equal(calls.filter(c => c.url.includes('webhook')).length, 0, 'nothing preview-only was called');
});

// ---- 4. Sync: activity, dedupe, ordering, no automatic completion -------------------------------------------------------------

const resFig = () => one(`SELECT * FROM integration_resources WHERE task_id = ? AND provider = 'figma'`, T1);
const expireThrottle = () => db.prepare(`UPDATE integration_resources SET last_synced_at = last_synced_at - 3600000`).run();
await test('Figma sync: records named versions and comments after linking (never comment text), de-duplicates, never completes the task', async () => {
  const linkedAt = resFig().linked_at, t = (d: number) => new Date(linkedAt + d).toISOString();
  on('GET', FIG('/v1/files/[^/?]+\\?depth=1'), () => fileReply({ version: '101', lastModified: t(5000) }));
  on('GET', FIG('/v1/files/[^/]+/versions'), () => J({ versions: [
    { id: 'v-named', created_at: t(4000), label: 'First draft', user: { id: 'F-ALICE' } },
    { id: 'v-auto', created_at: t(3000), label: '', user: { id: 'F-ALICE' } },
    { id: 'v-old', created_at: t(-5000), label: 'Before linking', user: { id: 'F-ALICE' } } ] }));
  on('GET', FIG('/v1/files/[^/]+/comments'), () => J({ comments: [
    { id: 'c1', created_at: t(3500), message: 'SECRET FEEDBACK TEXT', user: { id: 'F-BOB' } },
    { id: 'c0', created_at: t(-100), message: 'older', user: { id: 'F-BOB' } } ] }));
  expireThrottle();
  const out: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(out.resource.syncState, 'ok'); assert.equal(out.resource.version, '101');
  const ev = rows(`SELECT * FROM integration_events WHERE task_id = ? AND provider = 'figma' ORDER BY occurred_at`, T1);
  assert.deepEqual(ev.map(e => e.event_type).sort(), ['comment_added', 'resource_linked', 'resource_updated', 'version_created']);
  assert.ok(!JSON.stringify(ev).includes('SECRET FEEDBACK TEXT'), 'comment text is never stored');
  assert.ok(!JSON.stringify(ev).includes('Before linking'), 'history from before the link is not imported');
  assert.equal(ev.find(e => e.event_type === 'version_created').actor_user_id, alice.id, 'provider id resolves to the Mika member who linked that account');
  assert.equal(ev.find(e => e.event_type === 'comment_added').actor_user_id, bob.id);
  expireThrottle(); await syncResource(env, alice, OA, resFig().id);
  assert.equal(rows(`SELECT * FROM integration_events WHERE task_id = ? AND provider = 'figma'`, T1).length, ev.length, 'a repeated sync adds nothing');
  assert.equal((await taskOf(T1)).status, 'pending', 'activity never changes task status');
});
await test('Figma sync: a comment/versions scope that was not granted is reported as a limit, not an error', async () => {
  on('GET', FIG('/v1/files/[^/?]+\\?depth=1'), () => fileReply({ version: '102', lastModified: new Date().toISOString() }));
  on('GET', FIG('/v1/files/[^/]+/versions'), () => J({ err: 'Invalid scope' }, 403));
  on('GET', FIG('/v1/files/[^/]+/comments'), () => J({ err: 'Invalid scope' }, 403));
  expireThrottle();
  const out: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(out.resource.syncState, 'ok'); assert.deepEqual(out.resource.limits.sort(), ['comments', 'versions']);
});
await test('sync is throttled: no provider call inside the minimum interval', async () => {
  on('GET', FIG('/v1/files/'), () => fileReply()); expireThrottle();
  await syncResource(env, alice, OA, resFig().id); const before = calls.length;
  const second: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(second.throttled, true); assert.equal(calls.length, before);
});
await test('rate limit and provider errors are stored with a backoff, shown to people, and respected next time', async () => {
  on('GET', FIG('/v1/files/'), () => J({}, 429, { 'Retry-After': '300' })); expireThrottle();
  const lim: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(lim.error.code, 'rate_limited'); assert.equal(lim.resource.syncState, 'error'); assert.ok(lim.resource.nextSyncAfter > Date.now() + 250_000);
  const calls0 = calls.length; const wait: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(wait.throttled, true); assert.equal(calls.length, calls0, 'no request while backing off');
  db.prepare('UPDATE integration_resources SET next_sync_after = NULL, retry_count = 0').run();
  reset(); on('GET', FIG('/v1/files/'), () => J({ oops: 1 }, 503));
  const bad: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(bad.error.code, 'provider_unavailable'); assert.equal(resFig().retry_count, 1); assert.ok(resFig().next_sync_after > Date.now());
  assert.ok(!JSON.stringify(bad).includes('oops'), 'provider bodies are not echoed');
});
await test('revoked access during sync marks the link "reconnect"; reconnecting later clears it on the next good sync', async () => {
  db.prepare('UPDATE integration_resources SET next_sync_after = NULL, retry_count = 0, sync_state = \'ok\'').run(); expireThrottle();
  on('GET', FIG('/v1/files/'), () => J({}, 401)); on('POST', /oauth\/(refresh|token)/, () => J({}, 400));
  const out: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(out.error.code, 'reconnect'); assert.equal(out.resource.syncState, 'reconnect');
  reset(); await putAccount(OA, alice, 'figma', 'F-ALICE'); on('GET', FIG('/v1/files/'), () => fileReply()); expireThrottle();
  assert.equal(((await syncResource(env, alice, OA, resFig().id)) as any).resource.syncState, 'ok');
});
await test('Canva sync: first look is a baseline; a later modified time becomes one resource_updated event, once', async () => {
  const rc = one(`SELECT * FROM integration_resources WHERE provider = 'canva'`);
  const at = rc.provider_modified_at;
  on('GET', /designs\/DAGabc123XYZ/, () => J({ design: { title: 'Banner', updated_at: at / 1000, urls: {} } })); expireThrottle();
  await syncResource(env, alice, OA, rc.id);
  assert.equal(rows(`SELECT * FROM integration_events WHERE resource_id = ? AND event_type = 'resource_updated'`, rc.id).length, 0, 'unchanged = no event');
  reset(); on('GET', /designs\/DAGabc123XYZ/, () => J({ design: { title: 'Banner (edited)', updated_at: at / 1000 + 600, urls: {} } }));
  for (let i = 0; i < 2; i++) { expireThrottle(); await syncResource(env, alice, OA, rc.id); }
  assert.equal(rows(`SELECT * FROM integration_events WHERE resource_id = ? AND event_type = 'resource_updated'`, rc.id).length, 1);
  // out-of-order: an older snapshot arriving late must not roll the record back
  reset(); on('GET', /designs\/DAGabc123XYZ/, () => J({ design: { title: 'OLD TITLE', updated_at: at / 1000 - 5000, urls: {} } })); expireThrottle();
  await syncResource(env, alice, OA, rc.id);
  assert.equal(one('SELECT title FROM integration_resources WHERE id = ?', rc.id).title, 'Banner (edited)');
});

// ---- 5. Webhooks -------------------------------------------------------------------------------------------------------------

const watch = async (eventType: string, org = OA, file = FILE, creator = alice.id) => {
  const passcode = 'pass-' + eventType; const id = 'wh-' + eventType;
  db.prepare('DELETE FROM integration_watches WHERE webhook_id = ? OR (org_id = ? AND context_id = ? AND event_type = ? AND created_by = ?)').run(id, org, file, eventType, creator);
  db.prepare(`INSERT INTO integration_watches VALUES ('figma', ?, ?, ?, ?, ?, ?, ?)`).run(id, org, file, eventType, creator, await sha256Hex(passcode), Date.now());
  return { id, passcode };
};
const hook = (body: unknown) => figmaWebhook(env, new Request('https://mika.test/api/webhooks/figma', { method: 'POST', body: JSON.stringify(body) }));
await test('Figma webhook: unknown id -> 404, wrong passcode -> 401 (nothing recorded), PING ok, mismatched file/event ignored', async () => {
  const w = await watch('FILE_COMMENT'); const before = rows('SELECT * FROM integration_events').length;
  assert.equal(await status(hook({ webhook_id: 'nope', passcode: 'x', event_type: 'FILE_COMMENT' })), 404);
  assert.equal(await status(hook({ webhook_id: w.id, passcode: 'wrong', event_type: 'FILE_COMMENT', file_key: FILE, comment_id: 'x' })), 401);
  assert.equal(await status(hook({ passcode: w.passcode })), 404);
  assert.equal(((await (await hook({ webhook_id: w.id, passcode: w.passcode, event_type: 'PING' })).json()) as any).pong, true);
  assert.equal(((await (await hook({ webhook_id: w.id, passcode: w.passcode, event_type: 'FILE_COMMENT', file_key: 'OTHERFILEKEY0000', comment_id: 'z' })).json()) as any).ignored, 'mismatch');
  assert.equal(((await (await hook({ webhook_id: w.id, passcode: w.passcode, event_type: 'FILE_VERSION_UPDATE', file_key: FILE, version_id: 'z' })).json()) as any).ignored, 'mismatch');
  assert.equal(rows('SELECT * FROM integration_events').length, before);
});
await test('Figma webhook: records once per delivery, retry-safe, dedupes against a later sync, tolerates late/out-of-order delivery, and never submits', async () => {
  const w = await watch('FILE_COMMENT');
  const payload = (id: string, at: string) => ({ webhook_id: w.id, passcode: w.passcode, event_type: 'FILE_COMMENT', file_key: FILE, comment_id: id, created_at: at, triggered_by: { id: 'F-BOB', handle: 'bob' }, comment: [{ text: 'PRIVATE WORDS' }] });
  const first: any = await (await hook(payload('hook-c1', new Date().toISOString()))).json();
  assert.equal(first.recorded, 1); assert.equal(first.matched, 1);
  const retry: any = await (await hook(payload('hook-c1', new Date().toISOString()))).json();
  assert.equal(retry.recorded, 0); assert.equal(retry.duplicate, true);
  const late: any = await (await hook(payload('hook-c0', new Date(Date.now() - 6 * 3600_000).toISOString()))).json();
  assert.equal(late.recorded, 1);
  const evs = rows(`SELECT * FROM integration_events WHERE source_event_id IN ('figma:comment:hook-c1','figma:comment:hook-c0') ORDER BY occurred_at`);
  assert.deepEqual(evs.map(e => e.source_event_id), ['figma:comment:hook-c0', 'figma:comment:hook-c1']);
  assert.ok(evs[0].received_at > evs[0].occurred_at + 3_000_000, 'late event keeps its own occurred_at; received_at shows the delay');
  assert.ok(!JSON.stringify(evs).includes('PRIVATE WORDS'));
  assert.equal(evs[1].actor_user_id, bob.id);
  // the same comment later seen by a sync is the same event
  expireThrottle(); reset(); on('GET', FIG('/v1/files/[^/?]+\\?depth=1'), () => fileReply());
  on('GET', FIG('/v1/files/[^/]+/versions'), () => J({ versions: [] }));
  on('GET', FIG('/v1/files/[^/]+/comments'), () => J({ comments: [{ id: 'hook-c1', created_at: new Date().toISOString(), user: { id: 'F-BOB' } }] }));
  await syncResource(env, alice, OA, resFig().id);
  assert.equal(rows(`SELECT * FROM integration_events WHERE source_event_id = 'figma:comment:hook-c1'`).length, 1, 'webhook and sync agree');
  assert.equal((await taskOf(T1)).status, 'pending');
});
await test('Figma webhook for another organisation\'s file never reaches this organisation\'s tasks', async () => {
  const w = await watch('FILE_VERSION_UPDATE', OB, FILE, bea.id);
  const out: any = await (await hook({ webhook_id: w.id, passcode: w.passcode, event_type: 'FILE_VERSION_UPDATE', file_key: FILE, version_id: 'vx', label: 'x', created_at: new Date().toISOString() })).json();
  assert.equal(out.matched, 0); assert.equal(rows(`SELECT * FROM integration_events WHERE source_event_id = 'figma:version:vx'`).length, 0);
});

// ---- 6. Activity vs submission vs acceptance ------------------------------------------------------------------------------------

await test('submission is an explicit act by the assignee; acceptance is the reviewer\'s; activity is neither', async () => {
  reset();
  on('GET', FIG('/v1/files/[^/?]+\\?depth=1'), () => fileReply());
  on('GET', /thumbs\.figma\.test/, () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }));
  const id = resFig().id;
  assert.equal(await status(submitResource(env, bob, { orgId: OA, resourceId: id })), 403, 'a teammate cannot submit it');
  assert.equal(await status(submitResource(env, alice, { orgId: OB, resourceId: id })), 403, 'the wrong organisation cannot reach it');
  assert.equal((await taskOf(T1)).status, 'pending');

  const sub = await submitResource(env, alice, { orgId: OA, resourceId: id });
  assert.equal(sub.task.status, 'submitted'); assert.equal(sub.task.submissionEvidence?.host, 'figma.com');
  assert.equal(sub.resource.submission.status, 'submitted'); assert.equal(sub.resource.review.status, 'awaiting');
  assert.ok(sub.file?.url && blobs.size > 0, 'preview archived');
  assert.equal(rows(`SELECT * FROM integration_events WHERE resource_id = ? AND event_type = 'submission_made'`, id).length, 1);
  assert.equal(await status(submitResource(env, alice, { orgId: OA, resourceId: id })), 409, 'cannot submit twice');
  assert.equal(await status(unlinkResource(env, alice, OA, id)), 409, 'cannot pull a submitted file out from under a reviewer');

  // The assignee cannot accept their own work, whatever the provider says happened.
  const t = await taskOf(T1);
  assert.equal(await status(writeDoc(env, alice, OA, 'task', T1, { ...t, status: 'done' })), 403);
  assert.equal((await taskOf(T1)).status, 'submitted');

  // The reviewer accepts through the task's own flow; the event carries who and when.
  await writeDoc(env, boss, OA, 'task', T1, { ...t, status: 'done' });
  const work = await listTaskWork(env, boss, OA, T1);
  const r = work.resources.find(x => x.id === id)!;
  assert.equal(r.review.status, 'accepted'); assert.equal(r.review.reviewerUserId, boss.id); assert.ok(r.review.at);
  const cats = work.events.reduce<Record<string, number>>((m, e) => ({ ...m, [e.category]: (m[e.category] ?? 0) + 1 }), {});
  assert.ok(cats.activity > 0 && cats.submission === 1 && cats.review === 1, JSON.stringify(cats));
});
await test('a reviewer sending work back is recorded as returned, with the task\'s own reason as feedback', async () => {
  const T = await mkTask(OA, boss, mathA, alice.id);
  on('GET', FIG('/v1/files/'), () => fileReply({ name: 'Second poster' })); on('GET', /thumbs\.figma\.test/, () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
  const { resource } = await linkFig(alice, T, `https://www.figma.com/design/SecondFile123456/Second`);
  await submitResource(env, alice, { orgId: OA, resourceId: resource.id });
  const t = await taskOf(T);
  await writeDoc(env, boss, OA, 'task', T, { ...t, status: 'rejected', rejectionReason: 'Wrong brand colours' });
  const r = (await listTaskWork(env, alice, OA, T)).resources[0];
  assert.deepEqual([r.review.status, r.review.feedback, r.review.reviewerUserId], ['returned', 'Wrong brand colours', boss.id]);
  assert.equal(r.submission.status, 'submitted'); assert.equal((await taskOf(T)).status, 'rejected');
  assert.equal(await status(unlinkResource(env, alice, OA, resource.id)), 200, 'after a return the assignee can swap the file');
});

// ---- 7. Authorization boundaries ---------------------------------------------------------------------------------------------------

await test('only people involved in the task can read or refresh its linked work; other organisations cannot at all', async () => {
  const T = await mkTask(OA, boss, mathA, alice.id); on('GET', FIG('/v1/files/'), () => fileReply());
  const { resource } = await linkFig(alice, T, `https://www.figma.com/design/ThirdFile12345678/Third`);
  assert.equal(await status(listTaskWork(env, bob, OA, T)), 403, 'a teammate who is not involved');
  assert.equal(await status(syncResource(env, bob, OA, resource.id)), 403);
  assert.equal(await status(unlinkResource(env, bob, OA, resource.id)), 403);
  assert.equal(await status(listTaskWork(env, bea, OA, T)), 403, 'another organisation\'s member');
  assert.equal(await status(syncResource(env, bea, OB, resource.id)), 404, 'its id means nothing in another organisation');
  assert.equal(await status(syncResource(env, bea, OA, resource.id)), 403);
  assert.equal((await listTaskWork(env, boss, OA, T)).resources.length, 1, 'the person who assigned it can');
  assert.equal(await status(unlinkResource(env, boss, OA, resource.id)), 403, 'but only the assignee changes the links');
  // everything a viewer is sent is free of credentials
  assert.ok(!/access_token|refresh_token|secret_enc|passcode/i.test(JSON.stringify(await listTaskWork(env, boss, OA, T))));
});
await test('the same person\'s account in another organisation is a different, separate connection', async () => {
  assert.equal(await getUserAccount(env, OB, 'figma', alice.id), null);
});

// ---- 8. Disconnect ---------------------------------------------------------------------------------------------------------------------

await test('Figma disconnect deletes our webhooks at Figma, removes the credentials and marks links "reconnect"; history stays', async () => {
  await watch('FILE_COMMENT'); await watch('FILE_VERSION_UPDATE');
  const deleted: string[] = []; on('DELETE', FIG('/v2/webhooks/'), c => { deleted.push(c.url.split('/').pop()!); return J({}); });
  const events0 = rows('SELECT * FROM integration_events').length;
  await figmaDisconnect(env, alice, OA);
  assert.deepEqual(deleted.sort(), ['wh-FILE_COMMENT', 'wh-FILE_VERSION_UPDATE']);
  assert.equal(await getUserAccount(env, OA, 'figma', alice.id), null);
  assert.equal(rows(`SELECT * FROM integration_watches WHERE created_by = ?`, alice.id).length, 0);
  assert.ok(rows(`SELECT * FROM integration_resources WHERE linked_by = ? AND provider = 'figma'`, alice.id).every(r => r.sync_state === 'reconnect'));
  assert.equal(rows('SELECT * FROM integration_events').length, events0, 'the record is kept');
  const out: any = await syncResource(env, alice, OA, resFig().id);
  assert.equal(out.error.code, 'reconnect'); assert.equal(calls.filter(c => c.method === 'GET').length, 0, 'no provider call after disconnect');
  const w = await watch('FILE_COMMENT', OA, FILE, alice.id); // a webhook Figma still sends after we removed our row for it
  db.prepare('DELETE FROM integration_watches').run();
  assert.equal(await status(hook({ webhook_id: w.id, passcode: w.passcode, event_type: 'FILE_COMMENT', file_key: FILE, comment_id: 'q' })), 404);
});
await test('Canva disconnect revokes the grant at Canva, then removes it here', async () => {
  let revoked = '';
  on('POST', /oauth\/revoke/, c => { revoked = c.body; assert.match(c.headers['authorization'], /^Basic /); return J({}); });
  await canvaDisconnect(env, alice, OA);
  assert.match(revoked, /token=rt-1/); assert.equal(await getUserAccount(env, OA, 'canva', alice.id), null);
});
await test('a failing revoke at the provider does not stop the local disconnect', async () => {
  await putAccount(OA, bob, 'canva', 'C-BOB'); on('POST', /oauth\/revoke/, () => J({}, 500));
  await canvaDisconnect(env, bob, OA); assert.equal(await getUserAccount(env, OA, 'canva', bob.id), null);
});

// ---- 9. Small pure pieces -----------------------------------------------------------------------------------------------------------------

await test('event metadata is minimal and never carries anything credential-shaped; timestamps cannot come from the future', async () => {
  assert.deepEqual(sanitizeMeta({ versionId: 'v1', access_token: 'LEAK', secretNote: 'LEAK', code: 'LEAK', 'bad key': 'x', long: 'x'.repeat(500), nested: {} as any, n: 3, ok: true }), { versionId: 'v1', long: 'x'.repeat(120), n: 3, ok: true });
  const now = Date.now(); assert.equal(clampTime(now + 10 * 86_400_000, now), now + 300_000); assert.equal(clampTime(NaN, now), now);
  assert.equal(parseProviderTime(1_762_000_000), 1_762_000_000_000); assert.equal(parseProviderTime('2026-11-05T10:00:00Z'), Date.parse('2026-11-05T10:00:00Z')); assert.equal(parseProviderTime('nope'), null);
  const ok = await recordEvent(env, { orgId: OA, taskId: T1, resourceId: 'r', provider: 'figma', type: 'comment_added', sourceEventId: 'dup-1', occurredAt: now });
  const dup = await recordEvent(env, { orgId: OA, taskId: T1, resourceId: 'r', provider: 'figma', type: 'comment_added', sourceEventId: 'dup-1', occurredAt: now });
  assert.deepEqual([ok, dup], [true, false]);
});
await test('providers sit behind one interface: both adapters answer the same contract, unknown providers are rejected', () => {
  for (const key of ['figma', 'canva'] as const) {
    const a = adapterFor(key);
    for (const fn of ['parseResource', 'fetchSnapshot', 'sync', 'exportPreview', 'subscribe', 'unsubscribe', 'disconnect'] as const) assert.equal(typeof (a as any)[fn], 'function', `${key}.${fn}`);
    assert.ok(a.capabilities.notes.length > 0);
  }
  assert.throws(() => adapterFor('github')); assert.throws(() => adapterFor('../etc'));
  assert.equal(figmaAdapter.capabilities.webhooks, 'plan_required');
  assert.equal(figmaAdapter.parseResource('https://www.figma.com/board/AbCdEf1234567890/Jam').type, 'board');
  assert.equal(figmaAdapter.parseResource('https://www.figma.com/proto/AbCdEf1234567890/P').type, 'prototype');
});
void ({} as AccountRow);

console.log(`\n${n} adapter/integration checks passed`);
