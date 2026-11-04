/** Thin client for the Mika Worker API. Sessions are opaque bearer tokens kept in localStorage. */

const TOKEN_KEY = 'mika_token';
const ORG_KEY = 'mika_org_id';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}
export function getStoredOrgId(): string | null {
  try { return localStorage.getItem(ORG_KEY); } catch { return null; }
}
export function setStoredOrgId(id: string | null) {
  try { id ? localStorage.setItem(ORG_KEY, id) : localStorage.removeItem(ORG_KEY); } catch { /* private mode */ }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
  }
}

/** Fired when the server says our session is gone, so the app can send the user back to sign in. */
export const UNAUTHORIZED_EVENT = 'mika:unauthorized';

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; form?: FormData; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError(0, 'Could not reach Mika. Check your connection and try again.');
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data);
  }
  return data as T;
}

export interface PublicConfig {
  googleClientId: string | null;
  googleApiKey: string | null;
  googleAppId: string | null;
  devAuth: boolean;
}
let configPromise: Promise<PublicConfig> | null = null;
export function getConfig(): Promise<PublicConfig> {
  configPromise ??= api<PublicConfig>('/api/config', { auth: false }).catch(() => {
    configPromise = null;
    return { googleClientId: null, googleApiKey: null, googleAppId: null, devAuth: false };
  });
  return configPromise;
}
