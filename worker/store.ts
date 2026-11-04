import type { Env } from './env';
import { HttpError } from './env';
import type { Assignment, Department, Role, User, Organization } from '../src/types';

export type DocKind =
  | 'department' | 'role' | 'assignment' | 'user' | 'task' | 'comment' | 'meeting'
  | 'file' | 'notification' | 'message' | 'connection' | 'compliance' | 'event';

export const DOC_KINDS: DocKind[] = [
  'department', 'role', 'assignment', 'user', 'task', 'comment', 'meeting',
  'file', 'notification', 'message', 'connection', 'compliance', 'event',
];

/** Monotonic ms timestamp so two writes in the same millisecond still order correctly for /changes. */
let lastStamp = 0;
export function stamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

export async function putDoc(env: Env, orgId: string, kind: DocKind, id: string, value: unknown): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO docs (org_id, kind, id, json, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, ?5, 0)
     ON CONFLICT(org_id, kind, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at, deleted = 0`
  ).bind(orgId, kind, id, JSON.stringify(value), stamp()).run();
}

export function putDocStmt(env: Env, orgId: string, kind: DocKind, id: string, value: unknown) {
  return env.DB.prepare(
    `INSERT INTO docs (org_id, kind, id, json, updated_at, deleted) VALUES (?1, ?2, ?3, ?4, ?5, 0)
     ON CONFLICT(org_id, kind, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at, deleted = 0`
  ).bind(orgId, kind, id, JSON.stringify(value), stamp());
}

export async function getDoc<T = any>(env: Env, orgId: string, kind: DocKind, id: string): Promise<T | null> {
  const row = await env.DB.prepare('SELECT json FROM docs WHERE org_id = ?1 AND kind = ?2 AND id = ?3 AND deleted = 0')
    .bind(orgId, kind, id).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as T) : null;
}

export async function listDocs<T = any>(env: Env, orgId: string, kind: DocKind): Promise<T[]> {
  const { results } = await env.DB.prepare('SELECT json FROM docs WHERE org_id = ?1 AND kind = ?2 AND deleted = 0')
    .bind(orgId, kind).all<{ json: string }>();
  return results.map(r => JSON.parse(r.json) as T);
}

export async function deleteDoc(env: Env, orgId: string, kind: DocKind, id: string): Promise<void> {
  await env.DB.prepare('UPDATE docs SET deleted = 1, updated_at = ?4 WHERE org_id = ?1 AND kind = ?2 AND id = ?3')
    .bind(orgId, kind, id, stamp()).run();
}

export async function getOrg(env: Env, orgId: string): Promise<Organization | null> {
  const row = await env.DB.prepare('SELECT json FROM orgs WHERE id = ?1').bind(orgId).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as Organization) : null;
}

export interface OrgContext {
  org: Organization;
  departments: Department[];
  roles: Role[];
  assignments: Assignment[];
  masterRootUserId: string;
}

/** The slice of an org that every authority decision needs. */
export async function loadOrgContext(env: Env, orgId: string): Promise<OrgContext> {
  const org = await getOrg(env, orgId);
  if (!org) throw new HttpError(404, 'Organisation not found');
  const [departments, roles, assignments] = await Promise.all([
    listDocs<Department>(env, orgId, 'department'),
    listDocs<Role>(env, orgId, 'role'),
    listDocs<Assignment>(env, orgId, 'assignment'),
  ]);
  return { org, departments, roles, assignments, masterRootUserId: org.masterRootUserId };
}

export function isMember(ctx: OrgContext, userId: string): boolean {
  return userId === ctx.masterRootUserId || ctx.assignments.some(a => a.userId === userId && a.isActive);
}

export async function orgsForUser(env: Env, userId: string): Promise<Organization[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT o.json FROM orgs o
     LEFT JOIN docs d ON d.org_id = o.id AND d.kind = 'assignment' AND d.deleted = 0
       AND json_extract(d.json, '$.userId') = ?1 AND json_extract(d.json, '$.isActive') = 1
     WHERE d.id IS NOT NULL OR json_extract(o.json, '$.masterRootUserId') = ?1`
  ).bind(userId).all<{ json: string }>();
  return results.map(r => JSON.parse(r.json) as Organization);
}

export async function publicUser(env: Env, userId: string): Promise<User | null> {
  const row = await env.DB.prepare('SELECT json FROM users WHERE id = ?1').bind(userId).first<{ json: string }>();
  return row ? (JSON.parse(row.json) as User) : null;
}
