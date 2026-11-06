import type { Env } from '../env';
import { HttpError } from '../env';
import { isMember, loadOrgContext, type OrgContext } from '../store';
import { isUserLead } from '../../src/lib/orgRules';
import type { User } from '../../src/types';

export type Provider = 'github' | 'figma' | 'canva';

/** Every secret/var each provider needs. A value that is empty or still says REPLACE_ME counts as missing. */
const REQUIRED: Record<Provider | 'core', (keyof Env)[]> = {
  core: ['APP_URL', 'TOKEN_ENCRYPTION_KEY', 'OAUTH_STATE_SECRET'],
  github: ['GITHUB_APP_SLUG', 'GITHUB_APP_ID', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_WEBHOOK_SECRET'],
  figma: ['FIGMA_CLIENT_ID', 'FIGMA_CLIENT_SECRET'],
  canva: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET'],
};

export const isSet = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '' && !/REPLACE_ME/i.test(v);

/** Names (never values) of what is still missing for a provider. */
export function missingFor(env: Env, provider: Provider, extra: (keyof Env)[] = []): string[] {
  const keys = [...REQUIRED.core, ...REQUIRED[provider], ...extra];
  return Array.from(new Set(keys)).filter(k => !isSet(env[k]));
}

export function requireConfigured(env: Env, provider: Provider, label: string, only?: (keyof Env)[]): void {
  const missing = only ? only.filter(k => !isSet(env[k])) : missingFor(env, provider);
  if (missing.length) {
    throw new HttpError(501, `${label} is not connected on this deployment yet.`, { code: 'not_configured', missing });
  }
}

export const appUrl = (env: Env) => (env.APP_URL || '').trim().replace(/\/+$/, '');
export const callbackUrl = (env: Env, provider: Provider) => `${appUrl(env)}/api/integrations/${provider}/callback`;

export async function memberContext(env: Env, user: User, orgId: string | null | undefined): Promise<OrgContext> {
  if (!orgId) throw new HttpError(400, 'orgId is required');
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  return ctx;
}

export const isLead = (ctx: OrgContext, userId: string) =>
  isUserLead(userId, ctx.assignments, ctx.roles, ctx.departments, ctx.masterRootUserId);

export function requireLead(ctx: OrgContext, userId: string, what: string): void {
  if (!isLead(ctx, userId)) throw new HttpError(403, `Only leads can ${what}`);
}

export interface ProviderResponse { ok: boolean; status: number; data: any; /** seconds, from a Retry-After header */ retryAfter?: number }

/** fetch + JSON with a hard timeout, so a slow provider cannot hang a request. */
export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<ProviderResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
    const ra = Number(res.headers.get('Retry-After'));
    return { ok: res.ok, status: res.status, data, ...(Number.isFinite(ra) && ra >= 0 && res.headers.get('Retry-After') ? { retryAfter: ra } : {}) };
  } catch {
    throw new HttpError(504, 'The other service did not respond in time. Try again in a moment.');
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE = new Set([429, 502, 503, 504]);
/** Longest we will hold a request open waiting on a provider. Anything longer is handed back as a scheduled retry. */
const MAX_INLINE_WAIT_S = 5;

/** Exponential backoff, or the provider's own Retry-After when it gave one. */
export const retryDelayMs = (attempt: number, retryAfterSec: number | undefined, baseMs = 400) =>
  retryAfterSec !== undefined ? retryAfterSec * 1000 : baseMs * 2 ** attempt;

/**
 * For idempotent reads only (GET). Retries rate limits and transient 5xx a couple of times with backoff,
 * and stops early when the provider asks us to wait longer than a request should: the caller then records
 * the wait (resource.next_sync_after) instead of hammering the provider.
 */
export async function fetchJsonRetry(
  url: string, init: RequestInit = {}, opts: { retries?: number; baseMs?: number; timeoutMs?: number } = {}
): Promise<ProviderResponse> {
  const retries = opts.retries ?? 2;
  let r = await fetchJson(url, init, opts.timeoutMs);
  for (let attempt = 0; attempt < retries && RETRYABLE.has(r.status); attempt++) {
    if (r.retryAfter !== undefined && r.retryAfter > MAX_INLINE_WAIT_S) break;
    await new Promise(res => setTimeout(res, retryDelayMs(attempt, r.retryAfter, opts.baseMs)));
    r = await fetchJson(url, init, opts.timeoutMs);
  }
  return r;
}

/** Turns a failed provider response into an error a person can act on. Never includes provider response bodies. */
export function failFor(r: ProviderResponse, what: string): HttpError {
  if (r.status === 401) return new HttpError(409, `Your ${what} connection was revoked or has expired. Please reconnect.`, { code: 'reconnect' });
  if (r.status === 403 || r.status === 404) return new HttpError(404, `Your ${what} account cannot open that.`, { code: 'inaccessible' });
  if (r.status === 429) return new HttpError(429, `${what} is limiting requests right now. Try again in a minute.`, { code: 'rate_limited', retryAfter: r.retryAfter ?? 60 });
  if (r.status >= 500) return new HttpError(502, `${what} is having trouble right now. Try again later.`, { code: 'provider_unavailable' });
  return new HttpError(502, `${what} returned an unexpected answer (${r.status}).`, { code: 'provider_error' });
}

const MAX_DOWNLOAD = 20 * 1024 * 1024;
/** Downloads a file the provider handed us (preview/export) with a size cap. https only. */
export async function downloadBytes(url: string, max = MAX_DOWNLOAD): Promise<{ bytes: ArrayBuffer; type: string }> {
  if (!/^https:\/\//i.test(url)) throw new HttpError(502, 'The other service returned an unsafe download link.');
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(502, `Could not download the file (${res.status}).`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > max) throw new HttpError(413, 'That file is too large to attach as evidence.');
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > max) throw new HttpError(413, 'That file is too large to attach as evidence.');
  return { bytes, type: res.headers.get('content-type') || 'application/octet-stream' };
}

// ---- Login-CSRF protection for OAuth round trips -----------------------------------------------------
// The callback is a plain browser navigation, so the signed `state` alone cannot prove that the browser
// finishing the flow is the one that started it. A short-lived HttpOnly cookie does.

const NONCE_COOKIE = 'mika_oauth';

export function newNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}

export function nonceCookie(env: Env, nonce: string): Record<string, string> {
  const secure = appUrl(env).startsWith('https://') ? '; Secure' : '';
  return { 'Set-Cookie': `${NONCE_COOKIE}=${nonce}; Path=/api/integrations; Max-Age=600; HttpOnly; SameSite=Lax${secure}` };
}

export function checkNonce(req: Request, nonce: string | undefined): void {
  const cookie = req.headers.get('Cookie') || '';
  const got = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(NONCE_COOKIE + '='))?.slice(NONCE_COOKIE.length + 1);
  if (!nonce || !got || got !== nonce) {
    throw new HttpError(400, 'This connection was not started from this browser. Please start it again from Mika.');
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * OAuth callbacks are browser navigations, so they answer with a tiny page: it tells the opener
 * (the Mika tab that launched the popup) what happened and closes. With no opener it goes home.
 */
export function resultPage(provider: string, ok: boolean, message: string, accountLabel = ''): Response {
  const msg = JSON.stringify({ type: 'MIKA_INTEGRATION', provider, ok, message, accountLabel }).replace(/</g, '\\u003c');
  const home = `/?integration=${encodeURIComponent(provider)}&status=${ok ? 'ok' : 'error'}`;
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mika</title><body style="font:16px system-ui,sans-serif;max-width:28rem;margin:18vh auto;padding:0 1rem;text-align:center;color:#0f172a">
<h1 style="font-size:1.25rem">${ok ? 'Connected' : 'Could not connect'}</h1><p>${esc(message)}</p>
<p><a href="${home}">Back to Mika</a></p>
<script>(function(){var m=${msg};try{if(window.opener){window.opener.postMessage(m,location.origin);setTimeout(function(){window.close()},150);return}}catch(e){}
setTimeout(function(){location.replace(${JSON.stringify(home)})},1200)})();</script>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  });
}
