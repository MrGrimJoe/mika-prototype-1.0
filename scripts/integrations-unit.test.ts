// Run: npx tsx scripts/integrations-unit.test.ts   (no network, no Worker needed)
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { decryptJson, encryptJson, fromB64Url, pkcePair, sha256Hex, signState, toB64Url, verifyState } from '../worker/integrations/crypto';
import { signAppJwt } from '../worker/integrations/github';
import { findTaskRefs } from '../worker/integrations/evidence';
import { isSet, missingFor } from '../worker/integrations/common';
import { parseFigmaUrl } from '../worker/integrations/figma';
import { parseCanvaDesignId } from '../worker/integrations/canva';

let n = 0;
const test = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log('PASS', name); };
const env: any = { TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), OAUTH_STATE_SECRET: 'state-secret-for-tests' };

await test('AES-GCM round trip, and a different row id cannot decrypt it', async () => {
  const ct = await encryptJson(env, { access_token: 'tok', refresh_token: 'ref' }, 'acct_1');
  assert.deepEqual(await decryptJson(env, ct, 'acct_1'), { access_token: 'tok', refresh_token: 'ref' });
  await assert.rejects(decryptJson(env, ct, 'acct_2'));
  assert.ok(!ct.includes('tok'));
});
await test('encryption refuses to run with a placeholder or short key', async () => {
  await assert.rejects(encryptJson({ TOKEN_ENCRYPTION_KEY: 'REPLACE_ME' } as any, {}, 'x'), /not set up/);
  await assert.rejects(encryptJson({ TOKEN_ENCRYPTION_KEY: 'c2hvcnQ=' } as any, {}, 'x'), /32 random bytes/);
});
await test('signed state verifies, tampering and expiry are rejected', async () => {
  const s = await signState(env, { p: 'github', u: 'u1' });
  assert.equal((await verifyState<any>(env, s)).u, 'u1');
  const [body, sig] = s.split('.');
  const forged = toB64Url(new TextEncoder().encode(JSON.stringify({ ...JSON.parse(new TextDecoder().decode(fromB64Url(body))), u: 'attacker' })));
  await assert.rejects(verifyState(env, `${forged}.${sig}`), /expired or is not valid/);
  await assert.rejects(verifyState(env, await signState(env, { p: 'x' }, -5)), /expired or is not valid/);
  await assert.rejects(verifyState({ ...env, OAUTH_STATE_SECRET: 'other' }, s), /expired or is not valid/);
  await assert.rejects(verifyState(env, null));
});
await test('GitHub App JWT is valid RS256 for both PKCS#1 and PKCS#8 keys', async () => {
  // GitHub gives out PKCS#1 keys; WebCrypto needs PKCS#8. Both forms of the same key must work.
  const kp = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs1', format: 'pem' } });
  const pkcs1 = kp.privateKey;
  const pkcs8 = createPrivateKey(pkcs1).export({ type: 'pkcs8', format: 'pem' }).toString();
  const pub = createPublicKey(kp.publicKey);
  for (const [label, pem] of [['pkcs1', pkcs1], ['pkcs8', pkcs8]] as const) {
    const jwt = await signAppJwt('12345', pem, 1_700_000_000);
    const [h, b, sig] = jwt.split('.');
    assert.ok(verify('RSA-SHA256', Buffer.from(`${h}.${b}`), pub, Buffer.from(fromB64Url(sig))), label);
    assert.deepEqual(JSON.parse(Buffer.from(fromB64Url(b)).toString()), { iat: 1_700_000_000 - 60, exp: 1_700_000_000 + 540, iss: '12345' });
  }
  // a one-line env value with literal \n works too
  assert.equal((await signAppJwt('1', pkcs1.trim().replace(/\n/g, '\\n'))).split('.').length, 3);
});
await test('PKCE challenge is base64url(sha256(verifier))', async () => {
  const { verifier, challenge } = await pkcePair();
  assert.ok(verifier.length >= 43);
  assert.equal(challenge, toB64Url(Buffer.from(await sha256Hex(verifier), 'hex')));
});
await test('only the exact mika#<id> tag references a task', () => {
  assert.deepEqual(findTaskRefs('fix login mika#t_1730000000000_ab12'), ['t_1730000000000_ab12']);
  assert.deepEqual(findTaskRefs('MIKA#abc_123 and mika#abc_123 again'), ['abc_123']);
  assert.deepEqual(findTaskRefs('Plan Q1 for Alice'), []);          // names/titles never match
  assert.deepEqual(findTaskRefs('mika# nothing, mika#ab'), []);   // too short / malformed
  assert.deepEqual(findTaskRefs(null), []);
});
await test('placeholders count as not configured', () => {
  assert.equal(isSet('REPLACE_ME'), false);
  assert.equal(isSet('REPLACE_ME.apps.googleusercontent.com'), false);
  assert.equal(isSet(''), false);
  assert.equal(isSet(undefined), false);
  assert.equal(isSet('real-value'), true);
  assert.deepEqual(missingFor({ APP_URL: 'REPLACE_ME' } as any, 'figma'),
    ['APP_URL', 'TOKEN_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET', 'FIGMA_CLIENT_ID', 'FIGMA_CLIENT_SECRET']);
});
await test('Figma links: keys, branches, node ids; foreign hosts rejected', () => {
  assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/AbCdEf1234567890/My-File?node-id=12-34'),
    { key: 'AbCdEf1234567890', nodeId: '12:34', url: 'https://www.figma.com/design/AbCdEf1234567890/My-File?node-id=12-34' });
  assert.equal(parseFigmaUrl('https://www.figma.com/design/AbCdEf1234567890/branch/ZyXwVu9876543210/x').key, 'ZyXwVu9876543210');
  assert.throws(() => parseFigmaUrl('https://evil.com/design/AbCdEf1234567890'));
  assert.throws(() => parseFigmaUrl('https://figma.com.evil.com/design/AbCdEf1234567890'));
  assert.throws(() => parseFigmaUrl('http://www.figma.com/design/AbCdEf1234567890'));
});
await test('Canva links: design ids parse, foreign hosts rejected', () => {
  assert.equal(parseCanvaDesignId('https://www.canva.com/design/DAGabc123XYZ/aToken/edit'), 'DAGabc123XYZ');
  assert.equal(parseCanvaDesignId('DAGabc123XYZ'), 'DAGabc123XYZ');
  assert.throws(() => parseCanvaDesignId('https://canva.com.evil.io/design/DAGabc123XYZ/x'));
  assert.throws(() => parseCanvaDesignId('https://www.canva.com/folder/xyz'));
});
console.log(`\n${n} unit checks passed`);
