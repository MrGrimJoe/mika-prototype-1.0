/**
 * Sign-in for Mika: Google Identity Services in the browser, verified by the Worker.
 * The browser never tells the server who it is; it hands over a Google access token and the
 * Worker checks that token was issued to OUR client id before trusting the email inside it.
 */

import { api, getConfig, setToken, setStoredOrgId } from './api';
import type { Organization, User } from '../types';

declare global {
  interface Window { google?: any }
}

export interface AuthResult {
  user: User;
  orgs: Organization[];
  isNew: boolean;
  session: { sessionId: string; token: string; expiresAt?: string };
}

// Sign-in only asks for who you are. Workspace access (Drive, Calendar, ...) is requested the first
// time a feature needs it, so people are not asked for Gmail access just to log in.
const IDENTITY_SCOPE = 'openid email profile';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.announcements',
];

let gsiLoading: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gsiLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiLoading = null; reject(new Error('Could not load Google sign-in. Check your connection.')); };
    document.head.appendChild(s);
  });
  return gsiLoading;
}

function requestGoogleToken(clientId: string, scope: string, prompt = ''): Promise<{ token: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      prompt,
      callback: (resp: any) => {
        if (resp?.access_token) resolve({ token: resp.access_token, expiresIn: Number(resp.expires_in) || 3600 });
        else reject(new Error(resp?.error_description || resp?.error || 'Google sign-in was cancelled.'));
      },
      error_callback: (err: any) => reject(new Error(err?.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in was blocked by the browser.')),
    });
    client.requestAccessToken();
  });
}

function remember(result: AuthResult): AuthResult {
  setToken(result.session.token);
  setStoredOrgId(result.orgs[0]?.id ?? null);
  return result;
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const { googleClientId } = await getConfig();
  if (!googleClientId) throw new Error('Google sign-in is not set up on this deployment yet.');
  await loadGsi();
  const { token } = await requestGoogleToken(googleClientId, IDENTITY_SCOPE, 'select_account');
  return remember(await api<AuthResult>('/api/auth/google', { method: 'POST', body: { accessToken: token }, auth: false }));
}

/** Development-only sign-in, available only when the Worker runs with DEV_AUTH=1. */
export async function signInWithDevIdentity(email: string, fullName: string): Promise<AuthResult> {
  return remember(await api<AuthResult>('/api/auth/dev-login', { method: 'POST', body: { email, fullName }, auth: false }));
}

let workspaceToken: { token: string; expiresAt: number } | null = null;

/** Token for Google Workspace APIs (Drive, Calendar, ...). Asks for consent the first time it is needed. */
export const getAccessToken = async (): Promise<string | null> => {
  if (workspaceToken && workspaceToken.expiresAt > Date.now() + 30_000) return workspaceToken.token;
  const { googleClientId } = await getConfig();
  if (!googleClientId) return null;
  try {
    await loadGsi();
    const { token, expiresIn } = await requestGoogleToken(googleClientId, WORKSPACE_SCOPES.join(' '));
    workspaceToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  } catch {
    return null;
  }
};

export const setAccessToken = (token: string | null) => {
  workspaceToken = token ? { token, expiresAt: Date.now() + 3_000_000 } : null;
};

export async function logout(): Promise<void> {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* already signed out */ }
  setToken(null);
  setStoredOrgId(null);
  workspaceToken = null;
}
