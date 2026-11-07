// Run: npx tsx scripts/storage.test.ts
// Optional live check against a real S3-compatible server (Garage, SeaweedFS, RustFS, MinIO...):
//   S3_LIVE_ENDPOINT=http://localhost:8333 S3_LIVE_BUCKET=school-files S3_LIVE_KEY=... S3_LIVE_SECRET=... npx tsx scripts/storage.test.ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createUser } from '../worker/auth';
import { acceptInvite, createOrganization, issueInviteLink } from '../worker/orgs';
import { getOrg } from '../worker/store';
import { HttpError } from '../worker/env';
import { downloadFile, removeFileBlob, uploadFile } from '../worker/files';
import { attachEvidenceFile } from '../worker/integrations/evidence';
import { clearStorage, cleanConfig, getStorageSettings, probe, s3Store, saveStorage, testStorage, validateEndpoint } from '../worker/storage';
import { decryptJson } from '../worker/integrations/crypto';
import type { User } from '../src/types';

class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private params: any[] = []) {}
  bind(...p: any[]) { return new Stmt(this.db, this.sql, p); }
  async first<T = any>() { return (this.db.prepare(this.sql).get(...this.params) as T) ?? null; }
  async all<T = any>() { return { results: this.db.prepare(this.sql).all(...this.params) as T[], success: true, meta: {} }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.params); return { success: true, meta: { changes: Number(r.changes) } }; }
}
const raw = new DatabaseSync(':memory:');
for (const f of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) raw.exec(readFileSync(`migrations/${f}`, 'utf8'));
const DB = {
  prepare: (s: string) => new Stmt(raw, s),
  batch: async (st: Stmt[]) => { raw.exec('BEGIN'); try { const o = []; for (const s of st) o.push(await s.run()); raw.exec('COMMIT'); return o; } catch (e) { raw.exec('ROLLBACK'); throw e; } },
};
let r2Writes = 0; const r2 = new Map<string, any>();
const env: any = {
  DB, TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), OAUTH_STATE_SECRET: 's',
  FILES: { put: async (k: string, v: any) => { r2Writes++; r2.set(k, v); }, get: async () => null, delete: async (k: string) => { r2.delete(k); } },
};

// A tiny S3 stand-in: path-style, remembers objects, insists on a SigV4 Authorization header.
const objects = new Map<string, { body: ArrayBuffer; type: string }>();
let s3Mode: 'ok' | 'denied' | 'nobucket' = 'ok';
const s3Calls: { method: string; url: string; headers: Record<string, string>; body?: ArrayBuffer }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
  const isReq = input instanceof Request;   // aws4fetch signs and then calls fetch(Request)
  const url = isReq ? input.url : String(input); const method = (isReq ? input.method : init.method || 'GET').toUpperCase();
  if (!/^https:\/\/([a-z0-9-]+\.)?storage\.school\.example/.test(url)) return realFetch(input, init);
  const headers: Record<string, string> = {}; new Headers((isReq ? input.headers : init.headers) as any).forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const body = isReq ? (method === 'PUT' ? await input.clone().arrayBuffer() : undefined) : init.body ? (init.body as ArrayBuffer) : undefined;
  s3Calls.push({ method, url, headers, body });
  if (s3Mode === 'denied' || !/^AWS4-HMAC-SHA256 Credential=/.test(headers['authorization'] ?? '')) return new Response('<Error>AccessDenied LEAK-BODY</Error>', { status: 403 });
  if (s3Mode === 'nobucket') return new Response('<Error>NoSuchBucket</Error>', { status: 404 });
  const key = new URL(url).pathname;
  if (method === 'PUT') { objects.set(key, { body: body!, type: headers['content-type'] }); return new Response('', { status: 200 }); }
  if (method === 'DELETE') { objects.delete(key); return new Response(null, { status: 204 }); }
  const o = objects.get(key); return o ? new Response(o.body, { headers: { 'Content-Type': o.type } }) : new Response('<Error>NoSuchKey</Error>', { status: 404 });
}) as any;

let n = 0;
const test = async (name: string, fn: () => Promise<void> | void) => { s3Mode = 'ok'; try { await fn(); n++; console.log('PASS', name); } catch (e) { console.log('FAIL', name); throw e; } };
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e) { if (e instanceof HttpError) return e.status; throw e; } };
const codeOf = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { if (e instanceof HttpError) return e.extra?.code ?? e.status; throw e; } };

const tree = { id: 'root-department', department: 'School', roots: ['Principal'], roles: [], children: [{ id: 'n1', department: 'Class', roots: ['Lead'], roles: ['Teacher'], children: [] }] };
const mkOrg = (u: User, storageType: string) => createOrganization(env, u, { orgName: 'S ' + storageType, creator: { fullName: u.fullName }, tree, sections: [], sizing: { people: 5, storageGiB: 100, storageType } });
const boss = await createUser(env, { email: 'b@x.test', fullName: 'Boss' });
const SH = await mkOrg(boss, 'self_host'), ORG = SH.org.id;
const teacher = SH.roles.find(r => r.title === 'Teacher')!;
const alice = (await acceptInvite(env, await createUser(env, { email: 'a@x.test', fullName: 'Alice' }), (await issueInviteLink(env, boss, ORG, { targetRoleId: teacher.id, daysValid: 7 })).link.token, { fullName: 'Alice' })).user as User;
const outsider = await createUser(env, { email: 'o@x.test', fullName: 'Out' });
const good = { endpoint: 'https://storage.school.example', bucket: 'school-files', region: 'us-east-1', accessKeyId: 'SCHOOLKEY1234', secretAccessKey: 'super-secret-value-123' };
const form = (name: string, bytes: number[], type = 'image/png') => { const f = new FormData(); f.set('file', new File([new Uint8Array(bytes)], name, { type })); return f; };

await test('endpoint validation: public https only; private, internal, credentialed and odd addresses refused', () => {
  assert.equal(validateEndpoint('https://storage.school.example/'), 'https://storage.school.example');
  assert.equal(validateEndpoint('https://s3.school.example:9000/minio/'), 'https://s3.school.example:9000/minio');
  for (const bad of ['', 'not a url', 'http://storage.school.example', 'ftp://x.example', 'https://localhost', 'https://nas.local', 'https://nas', 'https://files.internal',
    'https://127.0.0.1', 'https://10.0.0.5', 'https://192.168.1.10', 'https://172.20.0.1', 'https://169.254.169.254', 'https://100.64.0.1', 'https://[::1]', 'https://[fd00::1]', 'https://[::ffff:10.0.0.1]',
    'https://user:pw@storage.school.example', 'https://storage.school.example/?x=1', 'https://storage.school.example/#a']) {
    assert.throws(() => validateEndpoint(bad), HttpError, bad);
  }
  assert.equal(validateEndpoint('http://localhost:8333', true), 'http://localhost:8333', 'plain http only for localhost in dev');
  assert.throws(() => validateEndpoint('http://storage.school.example', true));
  assert.throws(() => cleanConfig({ ...good, bucket: 'A_B' }, false)); assert.throws(() => cleanConfig({ ...good, bucket: 'ab' }, false)); assert.throws(() => cleanConfig({ ...good, region: 'x y' }, false));
  assert.equal(cleanConfig({ ...good, pathStyle: false }, false).pathStyle, false);
});
await test('requests are SigV4-signed with the real payload hash; keys are encoded; path-style and virtual-host URLs both work', async () => {
  const cfg = { endpoint: 'https://storage.school.example', region: 'us-east-1', bucket: 'b1', pathStyle: true, accessKeyId: 'AK', secretAccessKey: 'SK' };
  const body = new TextEncoder().encode('hello').buffer as ArrayBuffer;
  await s3Store(cfg).put('org/file a&b.png', body, { contentType: 'image/png', name: 'Poster ü.png', uploadedBy: 'u' });
  const c = s3Calls.at(-1)!;
  assert.equal(c.url, 'https://storage.school.example/b1/org/file%20a%26b.png');
  assert.match(c.headers['authorization'], /^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=.*x-amz-content-sha256.*, Signature=[0-9a-f]{64}$/);
  assert.equal(c.headers['x-amz-content-sha256'], '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  assert.equal(c.headers['x-amz-meta-name'], 'Poster%20%C3%BC.png');
  await s3Store({ ...cfg, pathStyle: false }).get('org/x');
  assert.equal(s3Calls.at(-1)!.url, 'https://b1.storage.school.example/org/x');
});
await test('only the root can test, save or clear storage; members see the type but never the server details or secret', async () => {
  for (const u of [alice, outsider]) {
    assert.equal(await status(testStorage(env, u, ORG, good)), 403); assert.equal(await status(saveStorage(env, u, ORG, good)), 403); assert.equal(await status(clearStorage(env, u, ORG)), 403);
  }
  assert.equal(await status(getStorageSettings(env, outsider, ORG)), 403, 'non-members cannot even read the settings');
  const m = await getStorageSettings(env, alice, ORG); assert.equal(m.selfHost, null); assert.equal(m.storageType, 'self_host');
});
await test('a server that fails the check is never saved; the error is advice, not the server\'s own response', async () => {
  s3Mode = 'denied';
  const err = await saveStorage(env, boss, ORG, good).catch(e => e); assert.equal(err.extra.code, 'storage_denied'); assert.ok(!err.message.includes('LEAK-BODY'));
  s3Mode = 'nobucket'; assert.equal(await codeOf(saveStorage(env, boss, ORG, good)), 'storage_no_bucket');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM org_storage').get()!.n, 0);
  s3Mode = 'ok'; assert.equal(await status(testStorage(env, boss, ORG, { ...good, endpoint: 'https://10.0.0.1' })), 400);
  assert.deepEqual(await testStorage(env, boss, ORG, good), { ok: true });
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM org_storage').get()!.n, 0, 'testing never saves');
});
await test('saving encrypts the credentials, switches the org, and never returns the secret', async () => {
  const out = await saveStorage(env, boss, ORG, good);
  assert.deepEqual([out.storageType, out.configured, out.selfHost?.bucket, out.selfHost?.accessKeyHint], ['self_host', true, 'school-files', '1234']);
  assert.ok(!JSON.stringify(out).includes('super-secret') && !JSON.stringify(out).includes('SCHOOLKEY'));
  const row: any = raw.prepare('SELECT * FROM org_storage WHERE org_id = ?').get(ORG);
  assert.ok(!JSON.stringify(row).includes('super-secret') && !row.secret_enc.includes('SCHOOLKEY'));
  assert.equal((await decryptJson<any>(env, row.secret_enc, `org_storage:${ORG}`)).secretAccessKey, 'super-secret-value-123');
  await assert.rejects(decryptJson(env, row.secret_enc, 'org_storage:another-org'), 'bound to its own organisation');
  assert.equal((await getOrg(env, ORG))!.storageType, 'self_host');
  // changing only the bucket keeps the saved key when the secret is left blank
  await saveStorage(env, boss, ORG, { ...good, bucket: 'school-files-2', accessKeyId: '', secretAccessKey: '' });
  assert.equal((await decryptJson<any>(env, (raw.prepare('SELECT secret_enc FROM org_storage').get() as any).secret_enc, `org_storage:${ORG}`)).secretAccessKey, 'super-secret-value-123');
  await saveStorage(env, boss, ORG, good);
});
await test('uploads go to the organisation\'s server, not Mika\'s bucket; downloads come back from it', async () => {
  const before = r2Writes;
  const item = await uploadFile(env, alice, ORG, form('poster.png', [1, 2, 3, 4]));
  assert.equal(item.storageBackend, 'self_host'); assert.equal(r2Writes, before, 'nothing written to R2');
  assert.ok(objects.has(`/school-files/${ORG}/${item.id}`));
  const res = await downloadFile(env, alice, ORG, item.id);
  assert.equal(res.headers.get('Content-Type'), 'image/png'); assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [1, 2, 3, 4]);
  assert.equal(await status(downloadFile(env, outsider, ORG, item.id)), 403);
  // the file keeps its own backend even if the organisation later switches
  const org = (await getOrg(env, ORG))!; raw.prepare('UPDATE orgs SET json = ? WHERE id = ?').run(JSON.stringify({ ...org, storageType: 'mika' }), ORG);
  assert.equal((await downloadFile(env, alice, ORG, item.id)).status, 200, 'old files still open after switching');
  raw.prepare('UPDATE orgs SET json = ? WHERE id = ?').run(JSON.stringify(org), ORG);
  await removeFileBlob(env, ORG, item.id, 'self_host'); assert.ok(!objects.has(`/school-files/${ORG}/${item.id}`), 'deleting removes the bytes from the right place');
});
await test('Figma/Canva previews attached as evidence also land on the organisation\'s server', async () => {
  const f = await attachEvidenceFile(env, { orgId: ORG, user: alice, taskId: 't1', name: 'Poster.png', type: 'image/png', bytes: new Uint8Array([9, 9]).buffer, source: 'figma' });
  assert.equal(f!.storageBackend, 'self_host'); assert.ok(objects.has(`/school-files/${ORG}/${f!.id}`));
});
await test('an unreachable or failing server gives a clear error and a delete problem never undoes the record deletion', async () => {
  s3Mode = 'denied'; assert.equal(await codeOf(uploadFile(env, alice, ORG, form('x.png', [1]))), 'storage_denied');
  await removeFileBlob(env, ORG, 'whatever', 'self_host'); // swallowed and logged
});
await test('self-host chosen but no details saved: a clear 409 and no network call; "own drive" orgs are still refused', async () => {
  await clearStorage(env, boss, ORG); const calls = s3Calls.length;
  assert.equal(await codeOf(uploadFile(env, alice, ORG, form('x.png', [1]))), 'storage_not_configured'); assert.equal(s3Calls.length, calls);
  const D = await mkOrg(await createUser(env, { email: 'd@x.test', fullName: 'Drive Boss' }), 'drive');
  assert.equal(await status(uploadFile(env, (await createUser(env, { email: 'd2@x.test', fullName: 'x' })), D.org.id, form('x.png', [1]))), 403, 'non-member');
});
await test('probe detects a server that returns the wrong data', async () => {
  const bad = { put: async () => {}, get: async () => ({ body: new Response('other').body!, contentType: 'text/plain' }), delete: async () => {} };
  assert.equal(await codeOf(probe(bad, 'o')), 'storage_error');
});

if (process.env.S3_LIVE_ENDPOINT) {
  globalThis.fetch = realFetch;
  const cfg = { endpoint: process.env.S3_LIVE_ENDPOINT, region: 'us-east-1', bucket: process.env.S3_LIVE_BUCKET!, pathStyle: true, accessKeyId: process.env.S3_LIVE_KEY!, secretAccessKey: process.env.S3_LIVE_SECRET! };
  await test('LIVE: real server accepts our signatures; binary data with awkward key names round-trips; wrong secret is refused', async () => {
    const st = s3Store(cfg); await probe(st, 'live');
    const bytes = new Uint8Array(300_000).map((_, i) => i % 251).buffer as ArrayBuffer;
    await st.put('live/a b&c ü.bin', bytes, { contentType: 'application/octet-stream', name: 'x', uploadedBy: 'u' });
    const back = new Uint8Array(await new Response((await st.get('live/a b&c ü.bin'))!.body).arrayBuffer());
    assert.ok(back.length === 300_000 && back[1000] === 1000 % 251);
    await st.delete('live/a b&c ü.bin'); assert.equal(await st.get('live/a b&c ü.bin'), null);
    assert.equal(await codeOf(s3Store({ ...cfg, secretAccessKey: 'wrong' }).put('x', new ArrayBuffer(1), { contentType: 'a/b', name: 'x', uploadedBy: 'u' })), 'storage_denied');
  });
}
console.log(`\n${n} storage checks passed`);
