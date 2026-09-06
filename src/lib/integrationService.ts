import {
  IntegrationConnection,
  IntegrationKey,
  Role,
  Department,
  Assignment,
  User,
  Organization,
} from '../types';

export interface IntegrationToolDefinition {
  key: IntegrationKey;
  name: string;
  category: 'Workspace' | 'Engineering' | 'Design' | 'Productivity';
  description: string;
  isAlwaysIncluded?: boolean;
  enterpriseOnly?: boolean;
  authProviderName: string;
  defaultScopeLabel: string;
}

export const INTEGRATION_TOOLS: IntegrationToolDefinition[] = [
  {
    key: 'google_drive',
    name: 'Google Drive',
    category: 'Workspace',
    description: 'Central cloud file storage, document vault, and live synchronization.',
    isAlwaysIncluded: true,
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Organization-wide storage vault',
  },
  {
    key: 'github',
    name: 'GitHub',
    category: 'Engineering',
    description: 'Repository commit tracking, pull request reviews, and code artifacts.',
    authProviderName: 'GitHub OAuth',
    defaultScopeLabel: 'Code repositories & review workflows',
  },
  {
    key: 'figma',
    name: 'Figma',
    category: 'Design',
    description: 'Design files, live embedded frames, and interactive component specs.',
    authProviderName: 'Figma Connect',
    defaultScopeLabel: 'Design canvases & UI specs',
  },
  {
    key: 'canva',
    name: 'Canva',
    category: 'Design',
    description: 'Creative templates, presentation decks, and brand marketing kits.',
    authProviderName: 'Canva Design Button',
    defaultScopeLabel: 'Brand templates & marketing assets',
  },
  {
    key: 'google_calendar',
    name: 'Google Calendar',
    category: 'Productivity',
    description: 'Department schedule synchronization, assignment deadlines, and event bookings.',
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Calendar events & deadlines',
  },
  {
    key: 'google_meet',
    name: 'Google Meet',
    category: 'Productivity',
    description: 'Instant 1-click video conferences from department dashboards.',
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Video meeting rooms',
  },
  {
    key: 'google_gmail',
    name: 'Gmail Workspace',
    category: 'Productivity',
    description: 'Official notifications, announcements, and executive executive briefings.',
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Email alerts & broadcasts',
  },
  {
    key: 'google_tasks',
    name: 'Google Tasks',
    category: 'Productivity',
    description: 'Personal task list synchronization directly for assigned roles.',
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Personal to-do items',
  },
  {
    key: 'google_forms',
    name: 'Google Forms',
    category: 'Productivity',
    description: 'Intake surveys, member evaluations, and structured feedback collection.',
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Feedback surveys & forms',
  },
  {
    key: 'google_classroom',
    name: 'Google Classroom',
    category: 'Workspace',
    description: 'Educational rosters, coursework materials, and student assignment tracking.',
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Coursework & class materials',
  },
  {
    key: 'google_keep',
    name: 'Google Keep',
    category: 'Productivity',
    description: 'Quick departmental scratchpads, pinboards, and shared sticky notes.',
    enterpriseOnly: true,
    authProviderName: 'Google Workspace',
    defaultScopeLabel: 'Shared scratchpads (Enterprise)',
  },
];

/**
 * Check whether a user is any kind of Root:
 * Master Root, Department Root, or Section Root
 */
export function isUserAnyRoot(
  userId: string,
  currentOrg: Organization | null | undefined,
  roles: Role[],
  assignments: Assignment[]
): boolean {
  if (!userId) return false;
  if (currentOrg?.masterRootUserId === userId) return true;

  const userAssignments = assignments.filter((a) => a.userId === userId && a.isActive);
  const userRoleIds = userAssignments.map((a) => a.roleId);

  return roles.some(
    (r) =>
      userRoleIds.includes(r.id) &&
      (r.isRoot || r.isSectionRoot || r.roleType === 'master_root' || r.roleType === 'dept_root' || r.roleType === 'section_root' || (r as any).roleLevel === 'admin' || (r as any).roleLevel === 'lead')
  );
}

/**
 * Get all role IDs subordinate to a root user
 */
export function getSubordinateRoleIdsForRoot(
  rootUserId: string,
  roles: Role[],
  assignments: Assignment[],
  departments: Department[]
): string[] {
  const rootAssignments = assignments.filter((a) => a.userId === rootUserId && a.isActive);
  const rootDeptIds = rootAssignments.map((a) => a.deptId).filter(Boolean);
  const rootRoleIds = rootAssignments.map((a) => a.roleId);

  const directSubRoleIds = new Set<string>();

  // If root is in a dept or section, include all roles in those departments or child depts
  const childDeptIds = new Set<string>(rootDeptIds);
  departments.forEach((dept) => {
    const parentId = (dept as any).parentId;
    if (parentId && childDeptIds.has(parentId)) {
      childDeptIds.add(dept.id);
    }
  });

  roles.forEach((r) => {
    if (childDeptIds.has(r.deptId)) {
      directSubRoleIds.add(r.id);
    }
    const reportsTo = (r as any).reportsToRoleId;
    if (reportsTo && rootRoleIds.includes(reportsTo)) {
      directSubRoleIds.add(r.id);
    }
  });

  return Array.from(directSubRoleIds);
}

export interface UserAccessDetail {
  tool: IntegrationToolDefinition;
  hasAccess: boolean;
  scope: 'always_included' | 'org' | 'root' | 'none';
  sourceConnection?: IntegrationConnection;
  grantedByLabel?: string;
  accountLabel?: string;
}

/**
 * Determine if a user has access to a specific integration
 */
export function userHasIntegrationAccess(
  userId: string,
  integrationKey: string,
  connections: IntegrationConnection[],
  assignments: Assignment[],
  roles: Role[],
  departments: Department[],
  isMasterRoot: boolean
): boolean {
  if (integrationKey === 'google_drive') return true;

  // 1. Check org-wide connections
  const orgConn = connections.find(
    (c) => c.integrationKey === integrationKey && c.scope === 'org'
  );
  if (orgConn) {
    if (orgConn.accessRoleIds === 'all' || isMasterRoot) {
      return true;
    }
    const userRoleIds = assignments
      .filter((a) => a.userId === userId && a.isActive)
      .map((a) => a.roleId);
    if (Array.isArray(orgConn.accessRoleIds) && orgConn.accessRoleIds.some((rId) => userRoleIds.includes(rId))) {
      return true;
    }
  }

  // 2. Check root-scoped connections
  const userRoleIds = assignments
    .filter((a) => a.userId === userId && a.isActive)
    .map((a) => a.roleId);

  const rootConns = connections.filter(
    (c) => c.integrationKey === integrationKey && c.scope === 'root'
  );

  for (const conn of rootConns) {
    if (conn.connectedByUserId === userId || conn.scopeRootUserId === userId) {
      return true;
    }
    // Check if user is subordinate to conn.scopeRootUserId
    if (conn.scopeRootUserId) {
      const subRoles = getSubordinateRoleIdsForRoot(
        conn.scopeRootUserId,
        roles,
        assignments,
        departments
      );
      if (subRoles.some((rId) => userRoleIds.includes(rId))) {
        if (conn.accessRoleIds === 'all') return true;
        if (Array.isArray(conn.accessRoleIds) && conn.accessRoleIds.some((rId) => userRoleIds.includes(rId))) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Compute the full list of tool access for a user
 */
export function getUserToolAccessSummary(
  userId: string,
  connections: IntegrationConnection[],
  assignments: Assignment[],
  roles: Role[],
  departments: Department[],
  allUsers: User[],
  isMasterRoot: boolean
): UserAccessDetail[] {
  const userAssignments = assignments.filter((a) => a.userId === userId && a.isActive);
  const userRoleIds = userAssignments.map((a) => a.roleId);

  return INTEGRATION_TOOLS.map((tool) => {
    if (tool.isAlwaysIncluded) {
      return {
        tool,
        hasAccess: true,
        scope: 'always_included',
        grantedByLabel: 'Standard Mika Cloud Provisioning',
        accountLabel: 'Mika System Storage',
      };
    }

    // 1. Org-wide check
    const orgConn = connections.find(
      (c) => c.integrationKey === tool.key && c.scope === 'org'
    );
    if (orgConn) {
      const allowed =
        orgConn.accessRoleIds === 'all' ||
        isMasterRoot ||
        (Array.isArray(orgConn.accessRoleIds) &&
          orgConn.accessRoleIds.some((rId) => userRoleIds.includes(rId)));

      if (allowed) {
        return {
          tool,
          hasAccess: true,
          scope: 'org',
          sourceConnection: orgConn,
          grantedByLabel: 'Connected Org-wide by Administrator',
          accountLabel: orgConn.accountLabel,
        };
      }
    }

    // 2. Root-scoped check
    const rootConns = connections.filter(
      (c) => c.integrationKey === tool.key && c.scope === 'root'
    );
    for (const conn of rootConns) {
      const isConnector = conn.connectedByUserId === userId || conn.scopeRootUserId === userId;
      let isSubordinate = false;
      if (conn.scopeRootUserId) {
        const subRoles = getSubordinateRoleIdsForRoot(
          conn.scopeRootUserId,
          roles,
          assignments,
          departments
        );
        isSubordinate = subRoles.some((rId) => userRoleIds.includes(rId));
      }

      if (isConnector || isSubordinate) {
        const connectorUser = allUsers.find((u) => u.id === conn.connectedByUserId);
        return {
          tool,
          hasAccess: true,
          scope: 'root',
          sourceConnection: conn,
          grantedByLabel: isConnector
            ? 'Connected by you (Root Scope)'
            : `Granted by ${connectorUser?.fullName || 'Department Root'}`,
          accountLabel: conn.accountLabel,
        };
      }
    }

    return {
      tool,
      hasAccess: false,
      scope: 'none',
    };
  });
}
