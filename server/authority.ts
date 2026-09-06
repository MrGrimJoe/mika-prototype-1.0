/**
 * Server-Side Authority Bridge for Mika
 * Delegates 100% of invite link and authority checks to the canonical orgRules library.
 * Eliminates ad-hoc heuristics and unauthorized string-matching.
 */

import { db } from './db';
import { canIssueInviteLink, AuthorityCheckDetails } from '../src/lib/orgRules';
import { Department, Role, Assignment } from '../src/types';

export type { AuthorityCheckDetails };

function getNormalizedDepartments(): Department[] {
  return Array.from(db.departments.values()).map(d => ({
    id: d.id,
    orgId: d.org_id,
    name: d.name,
    slug: d.slug,
    type: (d.type || 'department') as any,
    parentDeptId: d.parent_department_id || undefined,
    groupedDeptIds: d.grouped_dept_ids || undefined,
    rootRoleId: d.root_role_id || undefined,
    isTemporary: d.is_temporary,
    isArchived: d.is_archived,
    validFrom: d.valid_from,
    validTo: d.valid_to,
    createdAt: d.created_at
  }));
}

function getNormalizedRoles(): Role[] {
  return Array.from(db.roles.values()).map(r => ({
    id: r.id,
    orgId: r.org_id,
    deptId: r.department_id,
    title: r.name,
    slug: r.slug,
    isRoot: !!r.is_root,
    isSectionRoot: !!r.is_section_root,
    roleType: (r.role_type || (r.is_root ? 'dept_root' : 'member')) as any
  }));
}

function getNormalizedAssignments(): Assignment[] {
  return Array.from(db.roleAssignments.values()).map(a => ({
    id: a.id,
    userId: a.user_id,
    roleId: a.role_id,
    deptId: a.department_id,
    validFrom: a.assigned_at,
    isActive: a.is_active
  }));
}

/**
 * Server-Side Authority Check for Link Generation.
 * Strictly calls the canonical orgRules library.
 */
export function canIssueLinkFor(requestingUserId: string, targetRoleId: string): AuthorityCheckDetails {
  const targetRole = db.roles.get(targetRoleId);
  if (!targetRole) {
    return {
      allowed: false,
      hasAuthority: false,
      authorityType: 'none',
      distance: 0,
      reason: `Target role '${targetRoleId}' does not exist in the database.`,
      explanation: `Target role '${targetRoleId}' does not exist in the database.`,
      requesterRoles: []
    };
  }

  const org = db.organizations.get(targetRole.org_id);
  const masterRootUserId = org?.master_root_user_id;

  return canIssueInviteLink(
    requestingUserId,
    targetRoleId,
    getNormalizedDepartments(),
    getNormalizedRoles(),
    getNormalizedAssignments(),
    masterRootUserId
  );
}
