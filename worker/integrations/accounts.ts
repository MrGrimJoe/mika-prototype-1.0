import type { Env } from '../env';
import { HttpError } from '../env';
import { deleteDoc, putDoc } from '../store';
import type { IntegrationConnection, UserIntegrationCompliance } from '../../src/types';
import { decryptJson, encryptJson, sha256Hex } from './crypto';
import type { Provider } from './common';

export interface AccountRow {
  id: string; org_id: string; provider: Provider; kind: 'user' | 'installation';
  user_id: string; external_id: string; label: string; secret_enc: string | null; scopes: string;
  created_at: number; updated_at: number;
}

export interface TokenSet { access_token: string; refresh_token?: string; expires_at?: number }

const accountId = async (orgId: string, provider: string, kind: string, userId: string, externalId: string) =>
  'acct_' + (await sha256Hex([orgId, provider, kind, userId, externalId].join('|'))).slice(0, 24);

export async function saveAccount(env: Env, a: {
  orgId: string; provider: Provider; kind: 'user' | 'installation'; userId?: string;
  externalId: string; label: string; secret?: TokenSet; scopes?: string;
}): Promise<string> {
  const userId = a.userId ?? '';
  const id = await accountId(a.orgId, a.provider, a.kind, userId, a.externalId);
  const enc = a.secret ? await encryptJson(env, a.secret, id) : null;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO integration_accounts (id, org_id, provider, kind, user_id, external_id, label, secret_enc, scopes, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
     ON CONFLICT(id) DO UPDATE SET label = excluded.label, scopes = excluded.scopes, updated_at = excluded.updated_at,
       secret_enc = COALESCE(excluded.secret_enc, integration_accounts.secret_enc)`
  ).bind(id, a.orgId, a.provider, a.kind, userId, a.externalId, a.label, enc, a.scopes ?? '', now).run();
  return id;
}

/** Someone else in the same org already linked this exact external identity? Then refuse: matching must stay unambiguous. */
export async function assertIdentityFree(env: Env, orgId: string, provider: Provider, externalId: string, userId: string, nice: string) {
  const row = await env.DB.prepare(
    `SELECT user_id FROM integration_accounts WHERE org_id = ?1 AND provider = ?2 AND kind = 'user' AND external_id = ?3 AND user_id != ?4`
  ).bind(orgId, provider, externalId, userId).first<{ user_id: string }>();
  if (row) throw new HttpError(409, `That ${nice} account is already linked to another person in this organisation.`);
}

export async function findUserLink(env: Env, orgId: string, provider: Provider, externalId: string): Promise<AccountRow | null> {
  return env.DB.prepare(
    `SELECT * FROM integration_accounts WHERE org_id = ?1 AND provider = ?2 AND kind = 'user' AND external_id = ?3`
  ).bind(orgId, provider, externalId).first<AccountRow>();
}

export async function getUserAccount(env: Env, orgId: string, provider: Provider, userId: string): Promise<AccountRow | null> {
  return env.DB.prepare(
    `SELECT * FROM integration_accounts WHERE org_id = ?1 AND provider = ?2 AND kind = 'user' AND user_id = ?3 ORDER BY updated_at DESC LIMIT 1`
  ).bind(orgId, provider, userId).first<AccountRow>();
}

export async function findInstallation(env: Env, provider: Provider, externalId: string): Promise<AccountRow | null> {
  return env.DB.prepare(
    `SELECT * FROM integration_accounts WHERE provider = ?1 AND kind = 'installation' AND external_id = ?2`
  ).bind(provider, externalId).first<AccountRow>();
}

export async function getOrgInstallation(env: Env, orgId: string, provider: Provider): Promise<AccountRow | null> {
  return env.DB.prepare(
    `SELECT * FROM integration_accounts WHERE org_id = ?1 AND provider = ?2 AND kind = 'installation' LIMIT 1`
  ).bind(orgId, provider).first<AccountRow>();
}

export async function removeAccounts(env: Env, orgId: string, provider: Provider, kind: 'user' | 'installation', userId = '') {
  await env.DB.prepare(
    `DELETE FROM integration_accounts WHERE org_id = ?1 AND provider = ?2 AND kind = ?3 AND user_id = ?4`
  ).bind(orgId, provider, kind, userId).run();
}

export async function readTokens(env: Env, row: AccountRow): Promise<TokenSet> {
  if (!row.secret_enc) throw new HttpError(409, 'This account has no stored credentials. Reconnect it.', { code: 'not_linked' });
  return decryptJson<TokenSet>(env, row.secret_enc, row.id);
}

/** A usable access token, refreshed (and re-stored) when it is about to expire. */
export async function freshAccessToken(
  env: Env, row: AccountRow,
  refresh: (refreshToken: string) => Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>
): Promise<string> {
  const t = await readTokens(env, row);
  if (!t.expires_at || t.expires_at - 60_000 > Date.now()) return t.access_token;
  if (!t.refresh_token) throw new HttpError(409, 'Your connection expired. Please reconnect.', { code: 'reconnect' });
  let next;
  try { next = await refresh(t.refresh_token); }
  catch { throw new HttpError(409, 'Your connection expired. Please reconnect.', { code: 'reconnect' }); }
  const updated: TokenSet = {
    access_token: next.access_token,
    refresh_token: next.refresh_token ?? t.refresh_token,
    expires_at: next.expires_in ? Date.now() + next.expires_in * 1000 : undefined,
  };
  await env.DB.prepare('UPDATE integration_accounts SET secret_enc = ?2, updated_at = ?3 WHERE id = ?1')
    .bind(row.id, await encryptJson(env, updated, row.id), Date.now()).run();
  return updated.access_token;
}

export const tokenSetFrom = (r: { access_token: string; refresh_token?: string; expires_in?: number }): TokenSet => ({
  access_token: r.access_token,
  refresh_token: r.refresh_token,
  expires_at: r.expires_in ? Date.now() + r.expires_in * 1000 : undefined,
});

// ---- The shared docs the UI already reads (connection = org-level, compliance = per person) ----------

export async function markConnected(env: Env, o: {
  orgId: string; userId: string; provider: Provider; label: string; orgScope?: 'org' | 'root';
}) {
  const now = new Date().toISOString();
  const compliance: UserIntegrationCompliance = {
    id: `${o.userId}_${o.provider}`, userId: o.userId, orgId: o.orgId, integrationKey: o.provider,
    connectedAccountLabel: o.label, connectedAt: now, satisfiedAt: now,
  };
  await putDoc(env, o.orgId, 'compliance', compliance.id!, compliance);
  if (o.orgScope) {
    const conn: IntegrationConnection = {
      id: o.orgScope === 'org' ? `conn_${o.provider}_${o.orgId}` : `conn_${o.provider}_${o.userId}`,
      integrationKey: o.provider, orgId: o.orgId, scope: o.orgScope,
      scopeRootUserId: o.orgScope === 'root' ? o.userId : undefined,
      accessRoleIds: 'all', connectedByUserId: o.userId, accountLabel: o.label, connectedAt: now,
    };
    await putDoc(env, o.orgId, 'connection', conn.id, conn);
  }
}

export async function markDisconnected(env: Env, o: { orgId: string; userId: string; provider: Provider; org?: boolean }) {
  await deleteDoc(env, o.orgId, 'compliance', `${o.userId}_${o.provider}`);
  if (o.org) {
    await deleteDoc(env, o.orgId, 'connection', `conn_${o.provider}_${o.orgId}`);
    await deleteDoc(env, o.orgId, 'connection', `conn_${o.provider}_${o.userId}`);
  }
}
