import type { Env } from './env';
import { HttpError } from './env';
import { randomId, randomToken, slugify } from './util';
import {
  getDoc, listDocs, putDoc, putDocStmt, loadOrgContext, isMember, getOrg, stamp,
} from './store';
import { createSession } from './auth';
import { canIssueInviteLink } from '../src/lib/orgRules';
import type { Assignment, Department, Role, User, Organization, JoinLink, Task } from '../src/types';

const PRICE_PER_PERSON = 0.3;
const PRICE_PER_GIB = 0.08; // $20 per 250 GiB

interface TreeNode {
  id: string;
  department: string;
  roots?: string[];
  roles?: string[];
  children?: TreeNode[];
  sectionId?: string;
}
interface SectionIn { id: string; name: string }

export interface CreateOrgBody {
  orgName: string;
  description?: string;
  creator: { fullName: string; preferredName?: string; gender?: User['gender'] };
  tree?: TreeNode;
  sections?: SectionIn[];
  sizing?: { people?: number; storageGiB?: number; storageType?: Organization['storageType'] };
}

/** Builds the org, its department tree, roles and the creator's master-root assignment. */
export async function createOrganization(env: Env, user: User, body: CreateOrgBody) {
  const orgName = body.orgName?.trim();
  if (!orgName) throw new HttpError(400, 'Organisation name is required');
  const fullName = body.creator?.fullName?.trim();
  if (!fullName) throw new HttpError(400, 'Your full name is required');

  const now = new Date().toISOString();
  const orgId = randomId('org');

  // Profile captured at signup: preferred name, gender, full name. Email always comes from Google.
  const profile: User = {
    ...user,
    fullName,
    preferredName: body.creator.preferredName?.trim() || fullName.split(' ')[0],
    gender: body.creator.gender || user.gender,
  };

  const tree: TreeNode = body.tree ?? { id: 'root-department', department: orgName, roots: ['Owner'], roles: [], children: [] };
  const rootTitle = tree.roots?.[0]?.trim() || 'Owner';

  const departments: Department[] = [];
  const roles: Role[] = [];

  const masterDeptId = randomId('dept');
  const masterRoleId = randomId('role');
  departments.push({
    id: masterDeptId, orgId, name: tree.department?.trim() || orgName, slug: slugify(tree.department || orgName),
    type: 'department', rootRoleId: masterRoleId, createdAt: now,
  });
  roles.push({
    id: masterRoleId, orgId, deptId: masterDeptId, title: rootTitle, slug: slugify(rootTitle),
    isRoot: true, roleType: 'master_root',
  });
  for (const extra of (tree.roots ?? []).slice(1)) addMember(roles, orgId, masterDeptId, extra);
  for (const title of tree.roles ?? []) addMember(roles, orgId, masterDeptId, title);

  const idByNodeId = new Map<string, string>([[tree.id, masterDeptId]]);
  const membersBySection = new Map<string, string[]>();

  const walk = (node: TreeNode, parentDeptId: string) => {
    for (const child of node.children ?? []) {
      const deptId = randomId('dept');
      const rootRoleId = randomId('role');
      idByNodeId.set(child.id, deptId);
      const name = child.department?.trim() || 'Department';
      const leadTitle = child.roots?.[0]?.trim() || `${name} Lead`;
      departments.push({
        id: deptId, orgId, name, slug: slugify(name), type: 'department',
        parentDeptId, rootRoleId, createdAt: now,
      });
      roles.push({
        id: rootRoleId, orgId, deptId, title: leadTitle, slug: slugify(leadTitle),
        isRoot: true, roleType: 'dept_root',
      });
      for (const extra of (child.roots ?? []).slice(1)) addMember(roles, orgId, deptId, extra);
      for (const title of child.roles ?? []) addMember(roles, orgId, deptId, title);
      if (child.sectionId) {
        membersBySection.set(child.sectionId, [...(membersBySection.get(child.sectionId) ?? []), deptId]);
      }
      walk(child, deptId);
    }
  };
  walk(tree, masterDeptId);

  // A section is its own node that groups departments; it sits directly under the master department.
  for (const sec of body.sections ?? []) {
    const grouped = membersBySection.get(sec.id) ?? [];
    if (grouped.length === 0) continue;
    const deptId = randomId('dept');
    const rootRoleId = randomId('role');
    const title = `${sec.name} Head`;
    departments.push({
      id: deptId, orgId, name: sec.name, slug: slugify(sec.name), type: 'section',
      parentDeptId: masterDeptId, groupedDeptIds: grouped, rootRoleId, createdAt: now,
    });
    roles.push({
      id: rootRoleId, orgId, deptId, title, slug: slugify(title),
      isRoot: true, isSectionRoot: true, roleType: 'section_root',
    });
  }

  const people = Math.max(1, Math.floor(body.sizing?.people ?? 1));
  const storageType = body.sizing?.storageType ?? 'drive';
  const storageGiB = storageType === 'mika' ? Math.max(0, Math.floor(body.sizing?.storageGiB ?? 0)) : 0;
  const org: Organization = {
    id: orgId, name: orgName, slug: slugify(orgName), description: body.description ?? '',
    masterRootUserId: user.id, createdAt: now, storageType, teamSize: people, storageGiB,
    // Always priced on the server so the client can't set its own bill.
    pricingMonthly: Math.round((people * PRICE_PER_PERSON + storageGiB * PRICE_PER_GIB) * 100) / 100,
  };
  const assignment: Assignment = {
    id: randomId('asgn'), orgId, userId: user.id, roleId: masterRoleId, deptId: masterDeptId,
    validFrom: now, isActive: true,
  };

  const stmts = [
    env.DB.prepare('UPDATE users SET json = ?2 WHERE id = ?1').bind(user.id, JSON.stringify(profile)),
    env.DB.prepare('INSERT INTO orgs (id, json, created_at) VALUES (?1, ?2, ?3)').bind(orgId, JSON.stringify(org), now),
    ...departments.map(d => putDocStmt(env, orgId, 'department', d.id, d)),
    ...roles.map(r => putDocStmt(env, orgId, 'role', r.id, r)),
    putDocStmt(env, orgId, 'assignment', assignment.id, assignment),
    putDocStmt(env, orgId, 'user', profile.id, profile),
  ];
  await env.DB.batch(stmts);

  return { org, user: profile, departments, roles, assignments: [assignment], session: await createSession(env, user.id) };
}

function addMember(roles: Role[], orgId: string, deptId: string, title: string) {
  const t = title?.trim();
  if (!t) return;
  roles.push({ id: randomId('role'), orgId, deptId, title: t, slug: slugify(t), isRoot: false, roleType: 'member' });
}

/** Issues a role-specific, time-windowed, multi-use invite link. Only someone with authority over the role may. */
export async function issueInviteLink(
  env: Env,
  user: User,
  orgId: string,
  body: { targetRoleId?: string; daysValid?: number; maxUses?: number; requiredIntegrations?: string[] }
) {
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  if (!body.targetRoleId) throw new HttpError(400, 'targetRoleId is required');
  const role = ctx.roles.find(r => r.id === body.targetRoleId);
  if (!role) throw new HttpError(404, 'That role does not exist');
  if (role.roleType === 'master_root') throw new HttpError(403, 'The organisation root cannot be invited');

  const check = canIssueInviteLink(user.id, role.id, ctx.departments, ctx.roles, ctx.assignments, ctx.masterRootUserId);
  if (!check.allowed) {
    throw new HttpError(403, 'You do not have authority over this role, so you cannot invite someone into it.', {
      reason: check.reason,
    });
  }

  const days = Math.min(Math.max(Number(body.daysValid) || 7, 1), 90);
  const dept = ctx.departments.find(d => d.id === role.deptId);
  const nowMs = Date.now();
  const link: JoinLink = {
    id: randomId('link'),
    orgId,
    roleId: role.id,
    roleTitle: role.title,
    deptName: dept?.name ?? 'Department',
    token: `join_${randomToken().slice(0, 24)}`,
    expiresAt: new Date(nowMs + days * 86_400_000).toISOString(),
    maxUses: body.maxUses && body.maxUses > 0 ? Math.floor(body.maxUses) : undefined,
    useCount: 0,
    createdByUserId: user.id,
    createdAt: new Date(nowMs).toISOString(),
    requiredIntegrations: Array.isArray(body.requiredIntegrations) ? body.requiredIntegrations : [],
  };
  await env.DB.prepare(
    'INSERT INTO invite_links (token, org_id, role_id, json, expires_at, max_uses, use_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)'
  ).bind(link.token, orgId, role.id, JSON.stringify(link), Date.parse(link.expiresAt), link.maxUses ?? null).run();
  return { link, authorityExplanation: check.reason };
}

interface LinkRow { json: string; expires_at: number; max_uses: number | null; use_count: number }

async function loadLink(env: Env, token: string): Promise<{ link: JoinLink; row: LinkRow }> {
  const row = await env.DB.prepare('SELECT json, expires_at, max_uses, use_count FROM invite_links WHERE token = ?1')
    .bind(token).first<LinkRow>();
  if (!row) throw new HttpError(404, 'This invite link is not valid.');
  return { link: JSON.parse(row.json) as JoinLink, row };
}

function linkProblem(row: LinkRow): { status: number; message: string } | null {
  if (Date.now() > row.expires_at) return { status: 410, message: 'This invite link has expired. Ask your lead for a new one.' };
  if (row.max_uses != null && row.use_count >= row.max_uses) return { status: 410, message: 'This invite link has reached its limit.' };
  return null;
}

export async function resolveInviteLink(env: Env, token: string) {
  const { link, row } = await loadLink(env, token);
  const org = await getOrg(env, link.orgId);
  const problem = linkProblem(row);
  return {
    valid: !problem,
    isExpired: Date.now() > row.expires_at,
    reason: problem?.message,
    linkId: link.id,
    token: link.token,
    orgId: link.orgId,
    orgName: org?.name ?? 'Organisation',
    roleId: link.roleId,
    roleName: link.roleTitle,
    deptName: link.deptName,
    expiresAt: link.expiresAt,
    requiredIntegrations: link.requiredIntegrations ?? [],
  };
}

/** Binds the signed-in Google account to the link's role. Signup only captures name, preferred name and gender. */
export async function acceptInvite(
  env: Env,
  user: User,
  token: string,
  body: { fullName?: string; preferredName?: string; gender?: User['gender'] }
) {
  const { link, row } = await loadLink(env, token);
  const problem = linkProblem(row);
  if (problem) throw new HttpError(problem.status, problem.message, { expired: true });

  const ctx = await loadOrgContext(env, link.orgId);
  const role = ctx.roles.find(r => r.id === link.roleId);
  if (!role) throw new HttpError(410, 'The role this link was for no longer exists.');

  const existing = ctx.assignments.find(a => a.userId === user.id && a.roleId === role.id && a.isActive);
  const profile: User = {
    ...user,
    fullName: body.fullName?.trim() || user.fullName,
    preferredName: body.preferredName?.trim() || user.preferredName,
    gender: body.gender || user.gender,
  };
  const now = new Date().toISOString();
  const assignment: Assignment = existing ?? {
    id: randomId('asgn'), orgId: link.orgId, userId: user.id, roleId: role.id, deptId: role.deptId,
    validFrom: now, isActive: true,
  };

  const stmts = [
    env.DB.prepare('UPDATE users SET json = ?2 WHERE id = ?1').bind(user.id, JSON.stringify(profile)),
    putDocStmt(env, link.orgId, 'user', profile.id, profile),
  ];
  if (!existing) {
    stmts.push(putDocStmt(env, link.orgId, 'assignment', assignment.id, assignment));
    stmts.push(
      env.DB.prepare('UPDATE invite_links SET use_count = use_count + 1, json = json_set(json, \'$.useCount\', use_count + 1) WHERE token = ?1').bind(token)
    );
    // Tasks sent to this role before anyone held it go to the first person who joins.
    const tasks = await listDocs<Task>(env, link.orgId, 'task');
    for (const t of tasks) {
      if (!t.assignedToUserId && t.assignedToRoleId === role.id && t.status === 'pending') {
        stmts.push(putDocStmt(env, link.orgId, 'task', t.id, { ...t, assignedToUserId: user.id, updatedAt: now }));
      }
    }
  }
  await env.DB.batch(stmts);
  return { user: profile, assignment, orgId: link.orgId, merged: !!existing, alreadyHadRole: !!existing };
}

export async function listInviteLinks(env: Env, orgId: string): Promise<JoinLink[]> {
  const { results } = await env.DB.prepare('SELECT json, use_count FROM invite_links WHERE org_id = ?1').bind(orgId)
    .all<{ json: string; use_count: number }>();
  return results.map(r => ({ ...(JSON.parse(r.json) as JoinLink), useCount: r.use_count }));
}

export { getDoc, putDoc, stamp };

/** Organisation settings. Only the organisation root may change them; pricing can't be set from here. */
export async function updateOrganization(env: Env, user: User, orgId: string, patch: Partial<Organization>) {
  const ctx = await loadOrgContext(env, orgId);
  if (user.id !== ctx.masterRootUserId) throw new HttpError(403, 'Only the organisation root can change organisation settings');
  const next: Organization = { ...ctx.org };
  if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim();
  if (typeof patch.description === 'string') next.description = patch.description;
  if (patch.integrations !== undefined) next.integrations = patch.integrations;
  if (patch.storageType && ['drive', 'mika', 'self_host'].includes(patch.storageType)) next.storageType = patch.storageType;
  await env.DB.prepare('UPDATE orgs SET json = ?2 WHERE id = ?1').bind(orgId, JSON.stringify(next)).run();
  return next;
}
