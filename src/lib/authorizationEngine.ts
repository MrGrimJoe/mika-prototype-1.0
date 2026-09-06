/**
 * Authorization Engine Facade for Mika
 * Delegates 100% of organizational authority logic to the single canonical source of truth: src/lib/orgRules.ts.
 */

import { Department, Role, User, Assignment, Task, AuthorityCheckResult } from '../types';
import {
  hasDirectAuthority,
  getUserContexts,
  hasSuperiors as checkUserHasSuperiors,
  checkAuthorityOverUser,
  resolveHelpRecipient as orgResolveHelpRecipient,
  getHierarchyDistance
} from './orgRules';

export class AuthorizationEngine {
  private departments: Department[] = [];
  private roles: Role[] = [];
  private users: User[] = [];
  private assignments: Assignment[] = [];
  private masterRootUserId: string = '';

  constructor(
    departments: Department[],
    roles: Role[],
    users: User[],
    assignments: Assignment[],
    masterRootUserId: string
  ) {
    this.updateState(departments, roles, users, assignments, masterRootUserId);
  }

  public updateState(
    departments: Department[],
    roles: Role[],
    users: User[],
    assignments: Assignment[],
    masterRootUserId: string
  ) {
    this.departments = [...departments];
    this.roles = [...roles];
    this.users = [...users];
    this.assignments = [...assignments];
    this.masterRootUserId = masterRootUserId;
  }

  /**
   * Get all active roles held by a user
   */
  public getUserRoles(userId: string): { role: Role; dept: Department; assignment: Assignment }[] {
    return getUserContexts(userId, this.departments, this.roles, this.assignments);
  }

  /**
   * Evaluates if an actor user has authority over a target role.
   * Delegates strictly to hasDirectAuthority.
   */
  public checkAuthorityOverRole(actorUserId: string, targetRoleId: string): AuthorityCheckResult {
    const res = hasDirectAuthority(
      actorUserId,
      { targetRoleId },
      this.departments,
      this.roles,
      this.assignments,
      this.masterRootUserId
    );

    return {
      hasAuthority: res.allowed,
      authorityType: res.authorityType,
      distance: res.distance,
      explanation: res.reason,
      targetRoleTitle: res.targetRoleTitle,
      targetDeptName: res.targetDeptName
    };
  }

  /**
   * Evaluates if an actor user has authority over a target user.
   * Delegates strictly to checkAuthorityOverUser.
   */
  public checkAuthority(actorUserId: string, targetUserId: string): AuthorityCheckResult {
    const res = checkAuthorityOverUser(
      actorUserId,
      targetUserId,
      this.departments,
      this.roles,
      this.assignments,
      this.masterRootUserId
    );

    return {
      hasAuthority: res.allowed,
      authorityType: res.authorityType,
      distance: res.distance,
      explanation: res.reason
    };
  }

  /**
   * Resolves who receives the Help notification for a task.
   * Delegates to resolveHelpRecipient.
   */
  public resolveHelpRecipient(task: Task): {
    leadUser: User | null;
    leadRole: Role | null;
    leadDept: Department | null;
    reason: string;
  } {
    return orgResolveHelpRecipient(
      task,
      this.departments,
      this.roles,
      this.users,
      this.assignments,
      this.masterRootUserId
    );
  }

  /**
   * Determines if any user in the organization holds authority over the given user.
   */
  public hasSuperiors(userId: string): boolean {
    return checkUserHasSuperiors(
      userId,
      this.assignments,
      this.roles,
      this.departments,
      this.masterRootUserId
    );
  }

  /**
   * Determine whether a user can issue invite links for a role
   */
  public canGenerateInviteLink(actorUserId: string, targetRoleId: string): boolean {
    return this.checkAuthorityOverRole(actorUserId, targetRoleId).hasAuthority;
  }

  /**
   * Determine whether an actor can create/assign a task
   */
  public canCreateTask(actorUserId: string, targetRoleId: string): boolean {
    return this.checkAuthorityOverRole(actorUserId, targetRoleId).hasAuthority;
  }

  /**
   * Validates organizational schema for cycles and orphans (Part III validation)
   */
  public validateOrgStructure(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const deptMap = new Map<string, Department>();
    this.departments.forEach(d => deptMap.set(d.id, d));

    for (const dept of this.departments) {
      const visited = new Set<string>();
      let curr = dept;
      while (curr.parentDeptId) {
        if (visited.has(curr.id)) {
          errors.push(`Cycle detected in department nesting involving ${curr.name} (${curr.id})`);
          break;
        }
        visited.add(curr.id);
        const parent = deptMap.get(curr.parentDeptId);
        if (!parent) {
          warnings.push(`Department ${curr.name} references non-existent parent ${curr.parentDeptId}`);
          break;
        }
        curr = parent;
      }
    }

    for (const role of this.roles) {
      if (!deptMap.has(role.deptId)) {
        errors.push(`Role ${role.title} (${role.id}) is orphaned: department ${role.deptId} does not exist`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
