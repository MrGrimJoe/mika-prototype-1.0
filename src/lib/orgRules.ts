/**
 * Mika Organizational Rules Engine (Single Source of Truth)
 * 
 * Strict Structural Invariants (Per Specification):
 * 1. Authority never flows upward or sideways.
 * 2. Section root -> grouped department's own root: ALWAYS DENIED (no exceptions).
 * 3. Section root -> roles inside grouped departments: DIRECT AUTHORITY (distance = 1).
 * 4. Normal department root -> subordinate department roots (parentDeptId === X.id): DIRECT AUTHORITY (distance = 1).
 * 5. Normal department root -> descendant department roots (> 1 hop via parentDeptId): INDIRECT AUTHORITY (distance > 1).
 * 6. Sections do NOT chain transitively; section grouping stops transitive walks.
 * 7. Membership in a department never implies authority over it.
 * 8. NO authority or messaging rule is ever derived from string-matching names, titles, or slugs.
 * 9. A person can hold both authority and plain roles; each assignment is evaluated per-context.
 */

import { Department, Role, User, Assignment, Task, AuthorityType } from '../types';

export interface AuthorityCheckDetails {
  allowed: boolean;
  hasAuthority: boolean; // Alias for allowed to satisfy AuthorityCheckResult
  authorityType: AuthorityType;
  distance: number;
  reason: string;
  explanation: string; // Alias for reason to satisfy AuthorityCheckResult
  requesterRoles: string[];
  targetRoleTitle?: string;
  targetDeptName?: string;
}

export type MessagingRuleType = 'rule_a' | 'rule_b' | 'rule_c';

export interface ReachablePerson {
  user: User;
  ruleType: MessagingRuleType;
  ruleLabel: 'Department Peers' | 'Subordinate Department' | 'Department Root' | 'Grouped Section' | 'Section Root';
  contextDescription: string;
  roleTitles: string[];
  deptNames: string[];
}

export interface UserContext {
  assignmentId: string;
  assignment: Assignment;
  role: Role;
  dept: Department;
}

export interface MessagingEligibility {
  canMessage: boolean;
  ruleType?: MessagingRuleType;
  ruleLabel?: string;
  reason?: string;
}

// ============================================================================
// 1. Basic Role & Department Classification
// ============================================================================

/**
 * Checks if a role is a root role of its department (master_root, dept_root, or isRoot flag)
 */
export function isRoleRoot(role: Role, dept?: Department): boolean {
  if (!role) return false;
  return (
    role.isRoot === true ||
    role.roleType === 'master_root' ||
    role.roleType === 'dept_root' ||
    (dept ? dept.rootRoleId === role.id : false)
  );
}

/**
 * Checks if a role is a section root
 */
export function isRoleSectionRoot(role: Role, dept?: Department): boolean {
  if (!role) return false;
  const isSectionDept = dept?.type === 'section';
  return (
    role.roleType === 'section_root' ||
    role.isSectionRoot === true ||
    (isSectionDept && isRoleRoot(role, dept))
  );
}

/**
 * Normalizes parent department id across variations (parentDeptId vs parent_department_id)
 */
export function getParentDeptId(dept: Department): string | null {
  return dept.parentDeptId || (dept as any).parentDepartmentId || (dept as any).parent_department_id || null;
}

/**
 * Normalizes grouped department ids across variations
 */
export function getGroupedDeptIds(dept: Department): string[] {
  return dept.groupedDeptIds || (dept as any).grouped_dept_ids || [];
}

// ============================================================================
// 2. User Assignment & Context Lookups
// ============================================================================

/**
 * Get all active assignments held by a user
 */
export function getUserActiveAssignments(userId: string, assignments: Assignment[]): Assignment[] {
  return assignments.filter(a => a.userId === userId && a.isActive);
}

/**
 * Checks if the user is the root of a specific department node.
 * True if user holds an active assignment in that exact department with a role where role.isRoot === true
 */
export function isUserRootOfDept(
  userId: string,
  deptId: string,
  assignments: Assignment[],
  roles: Role[]
): boolean {
  if (!userId || !deptId) return false;
  const activeAsgns = assignments.filter(a => a.userId === userId && a.deptId === deptId && a.isActive);
  return activeAsgns.some(a => {
    const r = roles.find(ro => ro.id === a.roleId);
    return r ? isRoleRoot(r) : false;
  });
}

/**
 * Returns all departments where the user holds an active root-role assignment
 * AND that department's type === 'section'.
 */
export function getUserSectionRoots(
  userId: string,
  assignments: Assignment[],
  roles: Role[],
  departments: Department[]
): { dept: Department; role: Role }[] {
  if (!userId) return [];
  const activeAsgns = assignments.filter(a => a.userId === userId && a.isActive);
  const results: { dept: Department; role: Role }[] = [];

  for (const asgn of activeAsgns) {
    const dept = departments.find(d => d.id === asgn.deptId && !d.isArchived);
    if (!dept || dept.type !== 'section') continue;
    const role = roles.find(r => r.id === asgn.roleId);
    if (role && (isRoleSectionRoot(role, dept) || isRoleRoot(role, dept))) {
      results.push({ dept, role });
    }
  }

  return results;
}

/**
 * Returns all active organizational contexts held by a user (Role, Department, Assignment).
 */
export function getUserContexts(
  userId: string,
  allDepts: Department[],
  allRoles: Role[],
  assignments: Assignment[]
): UserContext[] {
  const activeAsgns = assignments.filter(a => a.userId === userId && a.isActive);
  const contexts: UserContext[] = [];

  for (const asgn of activeAsgns) {
    const role = allRoles.find(r => r.id === asgn.roleId);
    const dept = allDepts.find(d => d.id === asgn.deptId && !d.isArchived);
    if (role && dept) {
      contexts.push({
        assignmentId: asgn.id,
        assignment: asgn,
        role,
        dept
      });
    }
  }

  return contexts;
}

/**
 * Returns all active departments where a user holds an assignment.
 */
export function getUserDirectDepartments(
  userId: string,
  assignments: Assignment[],
  roles: Role[],
  departments: Department[]
): Department[] {
  const activeAsgns = assignments.filter(a => a.userId === userId && a.isActive);
  const deptIds = new Set(activeAsgns.map(a => a.deptId));
  return departments.filter(d => deptIds.has(d.id) && !d.isArchived);
}

/**
 * Checks if a user is an organizational lead (Master Root, Dept Root, or Section Root)
 */
export function isUserLead(
  userId: string,
  assignments: Assignment[],
  roles: Role[],
  departments: Department[],
  masterRootUserId?: string
): boolean {
  if (!userId) return false;
  if (masterRootUserId && userId === masterRootUserId) return true;

  const activeAsgns = assignments.filter(a => a.userId === userId && a.isActive);
  return activeAsgns.some(a => {
    const r = roles.find(ro => ro.id === a.roleId);
    const d = departments.find(dept => dept.id === a.deptId && !dept.isArchived);
    if (!r) return false;
    if (r.roleType === 'master_root') return true;
    return isRoleRoot(r, d) || isRoleSectionRoot(r, d);
  });
}

// ============================================================================
// 3. Core Authority Engine (The Single Canonical Authority Check)
// ============================================================================

/**
 * Checks whether an ancestor department is a hierarchical parent of targetDeptId
 * via the normal department parentDeptId chain (distance >= 1).
 * Never walks through section grouping edges.
 */
export function getHierarchyDistance(
  ancestorDeptId: string,
  targetDeptId: string,
  departments: Department[]
): { isAncestor: boolean; distance: number } {
  if (ancestorDeptId === targetDeptId) {
    return { isAncestor: true, distance: 0 };
  }

  const deptMap = new Map<string, Department>();
  departments.forEach(d => deptMap.set(d.id, d));

  let current = deptMap.get(targetDeptId);
  const visited = new Set<string>();
  let distance = 0;

  while (current) {
    const parentId = getParentDeptId(current);
    if (!parentId) break;

    distance++;
    if (visited.has(current.id)) break; // Cycle prevention
    visited.add(current.id);

    if (parentId === ancestorDeptId) {
      return { isAncestor: true, distance };
    }

    current = deptMap.get(parentId);
  }

  return { isAncestor: false, distance: 0 };
}

/**
 * The single canonical authority check.
 * Evaluates whether actorUserId has downward organizational authority over target (targetRoleId or targetDeptId).
 * 
 * Strict Precedence Order:
 * 1. Master root bypass: universal authority over everything. Type: 'bypass', distance = 1.
 * 2. Direct root -> member (same dept): actor is root of dept X, target is a role in dept X. Type: 'direct', distance = 1.
 * 3. Direct root -> root (distance = 1 only): actor is root of dept X, target is root of dept Y, and Y's parentDeptId === X.id. Type: 'direct', distance = 1.
 * 4. Section root -> role: actor is root of a section, target role belongs to a department in section's groupedDeptIds,
 *    AND target role is NOT itself a root role of that department. Type: 'direct', distance = 1.
 *    (Hard invariant: if targetRole.isRoot, ALWAYS skip/deny).
 * 5. Indirect/transitive: authority through normal-nesting parentDeptId chain (> 1 hop).
 *    Never through section grouping edges. Type: 'indirect', distance = hops.
 * 6. No path found -> not authorized. Type: 'none'.
 */
export function hasDirectAuthority(
  actorUserId: string,
  target: { targetRoleId?: string; targetDeptId?: string } | string,
  departments: Department[],
  roles: Role[],
  assignments: Assignment[],
  masterRootUserId?: string
): AuthorityCheckDetails {
  // Normalize target role and department
  const targetRoleId = typeof target === 'string' 
    ? (roles.some(r => r.id === target) ? target : undefined)
    : target.targetRoleId;

  let targetDeptId = typeof target === 'string'
    ? (targetRoleId ? undefined : target)
    : target.targetDeptId;

  const targetRole = targetRoleId ? roles.find(r => r.id === targetRoleId) : undefined;
  if (targetRole && !targetDeptId) {
    targetDeptId = targetRole.deptId;
  }

  const targetDept = targetDeptId ? departments.find(d => d.id === targetDeptId) : undefined;
  const targetRoleTitle = targetRole?.title;
  const targetDeptName = targetDept?.name || 'Department';

  const actorContexts = getUserContexts(actorUserId, departments, roles, assignments);
  const requesterRoles = actorContexts.map(c => c.role.title);

  // Helper to construct response satisfying both AuthorityCheckDetails and AuthorityCheckResult
  const createResult = (
    allowed: boolean,
    authorityType: AuthorityType,
    distance: number,
    reason: string
  ): AuthorityCheckDetails => ({
    allowed,
    hasAuthority: allowed,
    authorityType,
    distance,
    reason,
    explanation: reason,
    requesterRoles,
    targetRoleTitle,
    targetDeptName
  });

  // 1. Master Root Bypass (Universal Authority)
  if (
    (masterRootUserId && actorUserId === masterRootUserId) ||
    actorContexts.some(c => c.role.roleType === 'master_root')
  ) {
    return createResult(
      true,
      'bypass',
      1,
      `Master Root holds universal authority over all roles and departments.`
    );
  }

  if (actorContexts.length === 0) {
    return createResult(
      false,
      'none',
      0,
      `User holds no active organizational roles.`
    );
  }

  const targetIsRoot = targetRole ? isRoleRoot(targetRole, targetDept) : false;

  // Evaluate each active role held by actor
  for (const { role: aRole, dept: aDept } of actorContexts) {
    const aIsRoot = isRoleRoot(aRole, aDept);
    const aIsSectionRoot = isRoleSectionRoot(aRole, aDept);

    if (!aIsRoot && !aIsSectionRoot) {
      // Plain roles never possess downward authority
      continue;
    }

    // 2. Direct Root -> Member in Same Department
    if (aIsRoot && targetDeptId && aDept.id === targetDeptId) {
      // Cannot delegate downwards to one's own identical role slot
      if (targetRole && targetRole.id === aRole.id) {
        continue;
      }
      return createResult(
        true,
        'direct',
        1,
        `'${aRole.title}' is the root of '${aDept.name}' and holds direct downward authority over roles in this department.`
      );
    }

    // 3. Direct Root -> Subordinate Root (distance = 1 only via normal nesting)
    if (aIsRoot && targetDept) {
      const parentId = getParentDeptId(targetDept);
      if (parentId === aDept.id) {
        return createResult(
          true,
          'direct',
          1,
          `'${aRole.title}' (${aDept.name}) is the direct parent of '${targetDept.name}' (distance: 1).`
        );
      }
    }

    // 4. Section Root -> Grouped Role
    // Actor is root of a section; target belongs to a department in section's groupedDeptIds
    if (aIsSectionRoot && targetDeptId && aDept.type === 'section') {
      const groupedIds = getGroupedDeptIds(aDept);
      if (groupedIds.includes(targetDeptId)) {
        // NON-NEGOTIABLE INVARIANT:
        // A section root categorically CANNOT reach a grouped department's own root role.
        if (targetIsRoot) {
          // Hard rule: section root -> grouped dept root is denied
          continue;
        }

        return createResult(
          true,
          'direct',
          1,
          `Section root '${aRole.title}' (${aDept.name}) has direct authority over subordinate role '${targetRoleTitle || 'member'}' in grouped department '${targetDeptName}'.`
        );
      }
    }

    // 5. Indirect/Transitive Authority (Chain of normal department-to-department nesting > 1 hop)
    // Walk up the parentDeptId chain ONLY; never walk through section grouping.
    if (aIsRoot && targetDeptId) {
      const hierarchy = getHierarchyDistance(aDept.id, targetDeptId, departments);
      if (hierarchy.isAncestor && hierarchy.distance > 1) {
        return createResult(
          true,
          'indirect',
          hierarchy.distance,
          `'${aDept.name}' is a hierarchical ancestor of '${targetDeptName}' (depth: ${hierarchy.distance}), granting downward indirect authority.`
        );
      }
    }
  }

  // 6. No valid authority path found -> Deny
  return createResult(
    false,
    'none',
    0,
    `Authority check failed: None of the requester's active roles possess downward authority over '${targetRoleTitle || targetDeptName}'. Authority cannot flow sideways or upward.`
  );
}

/**
 * Determines whether an actor user can issue an invite link for a target role.
 * Strictly checks downward authority (direct or indirect) via hasDirectAuthority.
 */
export function canIssueInviteLink(
  requestingUserId: string,
  targetRoleId: string,
  departments: Department[],
  roles: Role[],
  assignments: Assignment[],
  masterRootUserId?: string
): AuthorityCheckDetails {
  return hasDirectAuthority(
    requestingUserId,
    { targetRoleId },
    departments,
    roles,
    assignments,
    masterRootUserId
  );
}

/**
 * Evaluates whether a user can create or assign a task in a specific department or section.
 * True ONLY if the user holds a root or section-root assignment there.
 * A plain-role-only user unconditionally receives false.
 */
export function canCreateTask(
  userId: string,
  deptOrSectionId: string | undefined,
  assignments: Assignment[],
  roles: Role[],
  departments: Department[],
  masterRootUserId?: string
): boolean {
  if (!userId) return false;

  // Master Root bypass
  if (masterRootUserId && userId === masterRootUserId) return true;

  const activeContexts = getUserContexts(userId, departments, roles, assignments);
  if (activeContexts.length === 0) return false;

  // Check if user holds a master root role
  if (activeContexts.some(c => c.role.roleType === 'master_root')) return true;

  // If specific department is requested
  if (deptOrSectionId) {
    const targetDept = departments.find(d => d.id === deptOrSectionId);
    if (!targetDept) return false;

    return activeContexts.some(c => {
      const aIsRoot = isRoleRoot(c.role, c.dept);
      const aIsSectionRoot = isRoleSectionRoot(c.role, c.dept);

      // 1. User is root of the exact department
      if (aIsRoot && c.dept.id === deptOrSectionId) return true;

      // 2. User is section root of a section grouping this department
      if (aIsSectionRoot && c.dept.type === 'section') {
        const grouped = getGroupedDeptIds(c.dept);
        if (grouped.includes(deptOrSectionId)) return true;
      }

      // 3. User is direct or indirect ancestor lead of this department
      if (aIsRoot) {
        const hierarchy = getHierarchyDistance(c.dept.id, deptOrSectionId, departments);
        if (hierarchy.isAncestor && hierarchy.distance >= 1) return true;
      }

      return false;
    });
  }

  // If checking globally if the user has task creation capability anywhere
  return activeContexts.some(c => isRoleRoot(c.role, c.dept) || isRoleSectionRoot(c.role, c.dept));
}

/**
 * Checks if actorUserId has superior authority over targetUserId
 */
export function checkAuthorityOverUser(
  actorUserId: string,
  targetUserId: string,
  departments: Department[],
  roles: Role[],
  assignments: Assignment[],
  masterRootUserId?: string
): AuthorityCheckDetails {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return {
      allowed: false,
      hasAuthority: false,
      authorityType: 'none',
      distance: 0,
      reason: 'A user cannot hold superior delegation authority over themselves.',
      explanation: 'A user cannot hold superior delegation authority over themselves.',
      requesterRoles: []
    };
  }

  if (masterRootUserId && actorUserId === masterRootUserId) {
    return {
      allowed: true,
      hasAuthority: true,
      authorityType: 'bypass',
      distance: 1,
      reason: 'Master Root holds universal bypass authority over all organizational members.',
      explanation: 'Master Root holds universal bypass authority over all organizational members.',
      requesterRoles: ['Master Root']
    };
  }

  const targetContexts = getUserContexts(targetUserId, departments, roles, assignments);
  if (targetContexts.length === 0) {
    return {
      allowed: false,
      hasAuthority: false,
      authorityType: 'none',
      distance: 0,
      reason: 'Target user holds no active roles.',
      explanation: 'Target user holds no active roles.',
      requesterRoles: []
    };
  }

  for (const tc of targetContexts) {
    const auth = hasDirectAuthority(
      actorUserId,
      { targetRoleId: tc.role.id, targetDeptId: tc.dept.id },
      departments,
      roles,
      assignments,
      masterRootUserId
    );
    if (auth.allowed) {
      return auth;
    }
  }

  return {
    allowed: false,
    hasAuthority: false,
    authorityType: 'none',
    distance: 0,
    reason: 'No downward authority path exists from actor to target user.',
    explanation: 'No downward authority path exists from actor to target user.',
    requesterRoles: []
  };
}

/**
 * Determines whether any active user in the organization holds superior authority over this user.
 * Invariant: Master Root has NO superiors. Top independent root users have no superiors.
 */
export function hasSuperiors(
  userId: string,
  assignments: Assignment[],
  roles: Role[],
  departments: Department[],
  masterRootUserId?: string
): boolean {
  if (!userId) return false;
  if (masterRootUserId && userId === masterRootUserId) return false;

  const activeUserIds = new Set(assignments.filter(a => a.isActive).map(a => a.userId));
  activeUserIds.delete(userId);

  for (const otherUserId of activeUserIds) {
    const check = checkAuthorityOverUser(otherUserId, userId, departments, roles, assignments, masterRootUserId);
    if (check.allowed) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves who receives the Help notification for a task
 * Part IV §9: Direct lead of the department the task belongs to;
 * If subject-specific role, routes to section/subject lead.
 */
export function resolveHelpRecipient(
  task: Task,
  departments: Department[],
  roles: Role[],
  users: User[],
  assignments: Assignment[],
  masterRootUserId?: string
): { leadUser: User | null; leadRole: Role | null; leadDept: Department | null; reason: string } {
  const dept = departments.find(d => d.id === task.deptId);
  const master = masterRootUserId ? users.find(u => u.id === masterRootUserId) : null;

  if (!dept) {
    return {
      leadUser: master || null,
      leadRole: null,
      leadDept: null,
      reason: 'Defaulting to Master Root due to unassigned department.'
    };
  }

  // 1. Direct lead of the department
  if (dept.rootRoleId) {
    const rootRole = roles.find(r => r.id === dept.rootRoleId);
    if (rootRole) {
      const asgn = assignments.find(a => a.roleId === rootRole.id && a.isActive);
      if (asgn) {
        const leadUser = users.find(u => u.id === asgn.userId);
        if (leadUser) {
          return {
            leadUser,
            leadRole: rootRole,
            leadDept: dept,
            reason: `Direct lead of ${dept.name} (${rootRole.title})`
          };
        }
      }
    }
  }

  // 2. Section lead grouping this department
  for (const d of departments) {
    if (d.type === 'section' && getGroupedDeptIds(d).includes(dept.id) && d.rootRoleId) {
      const sRole = roles.find(r => r.id === d.rootRoleId);
      if (sRole) {
        const asgn = assignments.find(a => a.roleId === sRole.id && a.isActive);
        if (asgn) {
          const sUser = users.find(u => u.id === asgn.userId);
          if (sUser) {
            return {
              leadUser: sUser,
              leadRole: sRole,
              leadDept: d,
              reason: `Section lead of ${d.name} grouping ${dept.name}`
            };
          }
        }
      }
    }
  }

  // 3. Fallback up parent department hierarchy
  let currentParentId = getParentDeptId(dept);
  while (currentParentId) {
    const pDept = departments.find(d => d.id === currentParentId);
    if (pDept?.rootRoleId) {
      const pRole = roles.find(r => r.id === pDept.rootRoleId);
      if (pRole) {
        const asgn = assignments.find(a => a.roleId === pRole.id && a.isActive);
        if (asgn) {
          const pUser = users.find(u => u.id === asgn.userId);
          if (pUser) {
            return {
              leadUser: pUser,
              leadRole: pRole,
              leadDept: pDept,
              reason: `Parent department lead of ${pDept.name}`
            };
          }
        }
      }
    }
    currentParentId = pDept ? getParentDeptId(pDept) : null;
  }

  return {
    leadUser: master || null,
    leadRole: null,
    leadDept: null,
    reason: 'Top-level Master Root of the organization'
  };
}

// ============================================================================
// 4. Messaging Eligibility & Contact Resolution (Verbatim Port from Spec)
// ============================================================================

/**
 * Computes strictly who is reachable under Rules A, B, and C
 * from the user's SPECIFIC active context (activeRole + activeDept).
 * 
 * Rules:
 * - Rule A: Shared department (peers within activeDept)
 * - Rule B: Direct root authority
 *     - If activeRole is department root: staff in immediately subordinate departments (parentDeptId === activeDept.id)
 *     - If activeDept has an immediate parentDept: the root of that parent department
 * - Rule C: Section root to grouped roles
 *     - If activeRole is section root: staff holding roles in departments grouped by activeDept
 *     - If activeDept is grouped by a section: the section root of that section
 */
export function getReachableContactsForContext(
  actorUserId: string,
  activeContext: UserContext,
  allUsers: User[],
  allDepts: Department[],
  allRoles: Role[],
  assignments: Assignment[]
): ReachablePerson[] {
  const { role: activeRole, dept: activeDept } = activeContext;
  const reachableMap = new Map<string, ReachablePerson>();

  const deptMap = new Map<string, Department>();
  allDepts.forEach(d => deptMap.set(d.id, d));

  const roleMap = new Map<string, Role>();
  allRoles.forEach(r => roleMap.set(r.id, r));

  const userMap = new Map<string, User>();
  allUsers.forEach(u => userMap.set(u.id, u));

  const addReachable = (
    user: User,
    ruleType: MessagingRuleType,
    ruleLabel: ReachablePerson['ruleLabel'],
    contextDescription: string,
    roleTitle?: string,
    deptName?: string
  ) => {
    if (user.id === actorUserId) return; // Never include self

    const existing = reachableMap.get(user.id);
    if (existing) {
      if (roleTitle && !existing.roleTitles.includes(roleTitle)) {
        existing.roleTitles.push(roleTitle);
      }
      if (deptName && !existing.deptNames.includes(deptName)) {
        existing.deptNames.push(deptName);
      }
      return;
    }

    reachableMap.set(user.id, {
      user,
      ruleType,
      ruleLabel,
      contextDescription,
      roleTitles: roleTitle ? [roleTitle] : [],
      deptNames: deptName ? [deptName] : []
    });
  };

  // RULE A: Shared Department
  assignments.forEach(asgn => {
    if (!asgn.isActive || asgn.deptId !== activeDept.id || asgn.userId === actorUserId) return;
    const user = userMap.get(asgn.userId);
    const role = roleMap.get(asgn.roleId);
    if (user && role) {
      addReachable(
        user,
        'rule_a',
        'Department Peers',
        `Peers in ${activeDept.name}`,
        role.title,
        activeDept.name
      );
    }
  });

  // RULE B: Direct Root Authority (Immediate Parent/Child Only)
  if (isRoleRoot(activeRole, activeDept)) {
    const immediateChildDepts = allDepts.filter(d => getParentDeptId(d) === activeDept.id && !d.isArchived);
    immediateChildDepts.forEach(childDept => {
      assignments.forEach(asgn => {
        if (!asgn.isActive || asgn.deptId !== childDept.id || asgn.userId === actorUserId) return;
        const user = userMap.get(asgn.userId);
        const role = roleMap.get(asgn.roleId);
        if (user && role) {
          addReachable(
            user,
            'rule_b',
            'Subordinate Department',
            `Subordinate staff in ${childDept.name}`,
            role.title,
            childDept.name
          );
        }
      });
    });
  }

  const parentDeptId = getParentDeptId(activeDept);
  if (parentDeptId) {
    const parentDept = deptMap.get(parentDeptId);
    if (parentDept && !parentDept.isArchived) {
      assignments.forEach(asgn => {
        if (!asgn.isActive || asgn.deptId !== parentDept.id || asgn.userId === actorUserId) return;
        const role = roleMap.get(asgn.roleId);
        if (role && isRoleRoot(role, parentDept)) {
          const user = userMap.get(asgn.userId);
          if (user) {
            addReachable(
              user,
              'rule_b',
              'Department Root',
              `Root of superior ${parentDept.name}`,
              role.title,
              parentDept.name
            );
          }
        }
      });
    }
  }

  // RULE C: Section Root to Grouped Roles
  if (isRoleSectionRoot(activeRole, activeDept)) {
    const groupedIds = getGroupedDeptIds(activeDept);
    groupedIds.forEach(groupedId => {
      const groupedDept = deptMap.get(groupedId);
      if (groupedDept && !groupedDept.isArchived) {
        assignments.forEach(asgn => {
          if (!asgn.isActive || asgn.deptId !== groupedDept.id || asgn.userId === actorUserId) return;
          const user = userMap.get(asgn.userId);
          const role = roleMap.get(asgn.roleId);
          if (user && role) {
            addReachable(
              user,
              'rule_c',
              'Grouped Section',
              `Staff in grouped ${groupedDept.name}`,
              role.title,
              groupedDept.name
            );
          }
        });
      }
    });
  }

  allDepts.forEach(potentialSection => {
    if (potentialSection.id === activeDept.id || potentialSection.isArchived) return;
    const groupedIds = getGroupedDeptIds(potentialSection);
    if (groupedIds.includes(activeDept.id)) {
      assignments.forEach(asgn => {
        if (!asgn.isActive || asgn.deptId !== potentialSection.id || asgn.userId === actorUserId) return;
        const role = roleMap.get(asgn.roleId);
        if (role && isRoleSectionRoot(role, potentialSection)) {
          const user = userMap.get(asgn.userId);
          if (user) {
            addReachable(
              user,
              'rule_c',
              'Section Root',
              `Section Lead of ${potentialSection.name}`,
              role.title,
              potentialSection.name
            );
          }
        }
      });
    }
  });

  return Array.from(reachableMap.values());
}

/**
 * Computes all reachable contacts for a user across all their active contexts
 */
export function getReachableContacts(
  currentUser: User,
  allUsers: User[],
  allDepts: Department[],
  allRoles: Role[],
  assignments: Assignment[]
): ReachablePerson[] {
  const contexts = getUserContexts(currentUser.id, allDepts, allRoles, assignments);
  const combinedMap = new Map<string, ReachablePerson>();

  for (const ctx of contexts) {
    const reachable = getReachableContactsForContext(
      currentUser.id,
      ctx,
      allUsers,
      allDepts,
      allRoles,
      assignments
    );
    for (const person of reachable) {
      const existing = combinedMap.get(person.user.id);
      if (existing) {
        for (const t of person.roleTitles) {
          if (!existing.roleTitles.includes(t)) existing.roleTitles.push(t);
        }
        for (const d of person.deptNames) {
          if (!existing.deptNames.includes(d)) existing.deptNames.push(d);
        }
      } else {
        combinedMap.set(person.user.id, { ...person });
      }
    }
  }

  return Array.from(combinedMap.values());
}

/**
 * Checks if two users are eligible to message each other under Rules A, B, or C.
 */
export function evaluateMessagingEligibility(
  userId1: string,
  userId2: string,
  allDepts: Department[],
  allRoles: Role[],
  assignments: Assignment[]
): MessagingEligibility {
  if (!userId1 || !userId2 || userId1 === userId2) {
    return { canMessage: false, reason: 'Invalid or identical user IDs.' };
  }

  const contexts1 = getUserContexts(userId1, allDepts, allRoles, assignments);
  if (contexts1.length === 0) {
    return { canMessage: false, reason: 'User holds no active roles.' };
  }

  const targetDummyUser: User = {
    id: userId2,
    email: '',
    fullName: '',
    preferredName: '',
    gender: 'prefer-not-to-say',
    createdAt: ''
  };

  for (const ctx of contexts1) {
    const reachable = getReachableContactsForContext(
      userId1,
      ctx,
      [targetDummyUser],
      allDepts,
      allRoles,
      assignments
    );
    const match = reachable.find(r => r.user.id === userId2);
    if (match) {
      return {
        canMessage: true,
        ruleType: match.ruleType,
        ruleLabel: match.ruleLabel,
        reason: match.contextDescription
      };
    }
  }

  return { canMessage: false, reason: 'No messaging path under Rules A, B, or C.' };
}

/**
 * Legacy alias for quick messaging check
 */
export function canMessagePair(
  userId1: string,
  userId2: string,
  allDepts: Department[],
  allRoles: Role[],
  assignments: Assignment[]
): boolean {
  return evaluateMessagingEligibility(userId1, userId2, allDepts, allRoles, assignments).canMessage;
}
