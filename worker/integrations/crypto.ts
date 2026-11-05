import type { Env } from '../env';
import { HttpError } from '../env';

const te = new TextEncoder();
const td = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const toB64Url = (bytes: Uint8Array) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function fromB64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}
export const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function sha256Hex(s: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s))));
}

export async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(data)));
}

/** Constant-time comparison so a wrong signature or passcode leaks nothing through timing. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export const timingSafeEqualStr = (a: string, b: string) => timingSafeEqual(te.encode(a), te.encode(b));

// ---- Encryption of stored third-party tokens (AES-256-GCM) ---------------------------------------

function notConfigured(name: string): HttpError {
  return new HttpError(501, 'Integrations are not set up on this deployment yet.', { code: 'not_configured', missing: [name] });
}

async function aesKey(env: Env): Promise<CryptoKey> {
  const raw = env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw || /REPLACE_ME/i.test(raw)) throw notConfigured('TOKEN_ENCRYPTION_KEY');
  let bytes: Uint8Array;
  try { bytes = fromB64(raw); } catch { bytes = new Uint8Array(0); }
  if (bytes.length !== 32) {
    throw new HttpError(500, 'TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32).');
  }
  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** `aad` binds the ciphertext to its row, so a token copied into another row will not decrypt. */
export async function encryptJson(env: Env, value: unknown, aad: string): Promise<string> {
  const key = await aesKey(env);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: te.encode(aad) as BufferSource }, key, te.encode(JSON.stringify(value)) as BufferSource));
  return `v1.${toB64Url(iv)}.${toB64Url(ct)}`;
}

export async function decryptJson<T = unknown>(env: Env, token: string, aad: string): Promise<T> {
  const key = await aesKey(env);
  const [v, iv, ct] = token.split('.');
  if (v !== 'v1' || !iv || !ct) throw new HttpError(500, 'Stored credential is corrupt. Reconnect the integration.');
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64Url(iv) as BufferSource, additionalData: te.encode(aad) as BufferSource }, key, fromB64Url(ct) as BufferSource);
    return JSON.parse(td.decode(pt)) as T;
  } catch {
    throw new HttpError(500, 'Stored credential could not be decrypted. Reconnect the integration.');
  }
}

// ---- Signed OAuth `state` (CSRF protection + carries who started the flow) --------------------------

function stateSecret(env: Env): string {
  const s = env.OAUTH_STATE_SECRET?.trim();
  if (!s || /REPLACE_ME/i.test(s)) throw notConfigured('OAUTH_STATE_SECRET');
  return s;
}

export async function signState(env: Env, payload: Record<string, unknown>, ttlSec = 600): Promise<string> {
  const body = toB64Url(te.encode(JSON.stringify({
    ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec, n: toHex(randomBytes(8)),
  })));
  return `${body}.${toB64Url(await hmacSha256(stateSecret(env), body))}`;
}

export async function verifyState<T = Record<string, any>>(env: Env, token: string | null | undefined): Promise<T> {
  const bad = () => new HttpError(400, 'This connection link has expired or is not valid. Please start again.');
  if (!token) throw bad();
  const [body, sig] = token.split('.');
  if (!body || !sig) throw bad();
  let given: Uint8Array;
  try { given = fromB64Url(sig); } catch { throw bad(); }
  if (!timingSafeEqual(await hmacSha256(stateSecret(env), body), given)) throw bad();
  let payload: any;
  try { payload = JSON.parse(td.decode(fromB64Url(body))); } catch { throw bad(); }
  if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) throw bad();
  return payload as T;
}

// ---- PKCE (Canva) -------------------------------------------------------------------------------

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = toB64Url(randomBytes(48));
  const challenge = toB64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(verifier))));
  return { verifier, challenge };
}
