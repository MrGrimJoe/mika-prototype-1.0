import type { Env } from './env';
import { HttpError } from './env';
import { randomId, randomToken, slugify } from './util';
import type { User } from '../src/types';
import { orgsForUser, publicUser } from './store';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface Identity {
  email: string;
  googleSub?: string;
  fullName: string;
  photoUrl?: string;
}

/** Verifies a Google OAuth access token was issued to OUR client id, then reads the profile it belongs to. */
export async function verifyGoogleAccessToken(env: Env, accessToken: string): Promise<Identity> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new HttpError(501, 'Google sign-in is not configured on this deployment yet.', { code: 'google_not_configured' });
  }
  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!info.ok) throw new HttpError(401, 'Google rejected this sign-in token.');
  const claims = (await info.json()) as { aud?: string; azp?: string };
  if (claims.aud !== env.GOOGLE_CLIENT_ID && claims.azp !== env.GOOGLE_CLIENT_ID) {
    throw new HttpError(401, 'This Google token was issued to a different application.');
  }
  const me = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!me.ok) throw new HttpError(401, 'Could not read your Google profile.');
  const p = (await me.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!p.email || p.email_verified === false) throw new HttpError(401, 'Your Google email must be verified.');
  return { email: p.email.toLowerCase(), googleSub: p.sub, fullName: p.name || p.email.split('@')[0], photoUrl: p.picture };
}

export function devAuthEnabled(env: Env): boolean {
  return env.DEV_AUTH === '1';
}

export async function findUserByEmail(env: Env, email: string): Promise<User | null> {
  const row = await env.DB.prepare('SELECT json FROM users WHERE email = ?1').bind(email.toLowerCase()).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as User) : null;
}

export async function findUserBySub(env: Env, sub: string): Promise<User | null> {
  const row = await env.DB.prepare('SELECT json FROM users WHERE google_sub = ?1').bind(sub).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as User) : null;
}

export async function createUser(
  env: Env,
  data: { email: string; googleSub?: string; fullName: string; preferredName?: string; gender?: User['gender']; avatarUrl?: string }
): Promise<User> {
  const user: User = {
    id: randomId('u'),
    email: data.email.toLowerCase(),
    fullName: data.fullName,
    preferredName: data.preferredName || data.fullName.split(' ')[0],
    gender: data.gender || 'prefer-not-to-say',
    avatarUrl: data.avatarUrl,
    createdAt: new Date().toISOString(),
  };
  await env.DB.prepare('INSERT INTO users (id, email, google_sub, json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(user.id, user.email, data.googleSub ?? null, JSON.stringify(user), user.createdAt).run();
  return user;
}

export async function createSession(env: Env, userId: string): Promise<{ sessionId: string; token: string; expiresAt: string }> {
  const id = randomToken();
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(id, userId, now, now + SESSION_TTL_MS).run();
  return { sessionId: id, token: id, expiresAt: new Date(now + SESSION_TTL_MS).toISOString() };
}

export function bearer(req: Request, url?: URL): string | null {
  const h = req.headers.get('Authorization');
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return url?.searchParams.get('token') ?? null;
}

export async function requireUser(env: Env, req: Request, url?: URL): Promise<User> {
  const token = bearer(req, url);
  if (!token) throw new HttpError(401, 'Sign in required');
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?1')
    .bind(token).first<{ user_id: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  const user = await publicUser(env, row.user_id);
  if (!user) throw new HttpError(401, 'Account not found');
  return user;
}

export async function endSession(env: Env, req: Request): Promise<void> {
  const token = bearer(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?1').bind(token).run();
}

export async function sessionPayload(env: Env, user: User) {
  const orgs = await orgsForUser(env, user.id);
  return { user, orgs, session: await createSession(env, user.id) };
}

export { slugify };
