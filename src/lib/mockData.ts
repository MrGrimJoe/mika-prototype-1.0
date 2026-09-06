/**
 * Seed data for Mika - Recursive Organizational System
 * Faithfully implements the School Case Study, Company, and Nonprofit structures from the specification.
 */

import { Organization, Department, Role, User, Assignment, Task, Comment, FileItem, Message, EventBinding, JoinLink, OrgNotification } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u_principal',
    email: 'principal@school.edu',
    fullName: 'Dr. Sarah Vance',
    preferredName: 'Dr. Vance',
    gender: 'female',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'u_preschool_head',
    email: 'preschool.head@school.edu',
    fullName: 'Preschool Headmaster',
    preferredName: 'Preschool Lead',
    gender: 'female',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-08-02T08:00:00Z'
  },
  {
    id: 'u_middle_head',
    email: 'middleschool.head@school.edu',
    fullName: 'Middleschool Headmaster',
    preferredName: 'Middle Lead',
    gender: 'male',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-08-02T08:00:00Z'
  },
  {
    id: 'u_high_head',
    email: 'highschool.head@school.edu',
    fullName: 'Highschool Headmaster',
    preferredName: 'High Lead',
    gender: 'male',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    createdAt: '2026-08-02T08:00:00Z'
  }
];

export const INITIAL_ORG: Organization = {
  id: 'org_school',
  name: 'School',
  slug: 'school',
  description: 'Academic institution operating under the Mika recursive relationship-graph model.',
  masterRootUserId: 'u_principal',
  createdAt: '2026-08-01T08:00:00Z',
  teamSize: 0,
  storageGiB: 50,
  pricingMonthly: 15.00
};

export const INITIAL_DEPARTMENTS: Department[] = [
  // Master Root Department: School
  {
    id: 'dept_school',
    orgId: 'org_school',
    name: 'School',
    slug: 'school',
    type: 'department',
    rootRoleId: 'role_principal',
    createdAt: '2026-08-01T08:00:00Z'
  },

  // 1. Section: Preschool
  {
    id: 'dept_preschool',
    orgId: 'org_school',
    name: 'Preschool',
    slug: 'preschool',
    type: 'section',
    parentDeptId: 'dept_school',
    rootRoleId: 'role_preschool_headmaster',
    groupedDeptIds: ['dept_kindergarde', 'dept_class1', 'dept_class2', 'dept_class3'],
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_kindergarde',
    orgId: 'org_school',
    name: 'Kindergarde',
    slug: 'kindergarde',
    type: 'department',
    parentDeptId: 'dept_preschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class1',
    orgId: 'org_school',
    name: 'Class 1',
    slug: 'class-1',
    type: 'department',
    parentDeptId: 'dept_preschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class2',
    orgId: 'org_school',
    name: 'Class 2',
    slug: 'class-2',
    type: 'department',
    parentDeptId: 'dept_preschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class3',
    orgId: 'org_school',
    name: 'Class 3',
    slug: 'class-3',
    type: 'department',
    parentDeptId: 'dept_preschool',
    createdAt: '2026-08-01T08:00:00Z'
  },

  // 2. Section: Middleschool
  {
    id: 'dept_middleschool',
    orgId: 'org_school',
    name: 'Middleschool',
    slug: 'middleschool',
    type: 'section',
    parentDeptId: 'dept_school',
    rootRoleId: 'role_middleschool_headmaster',
    groupedDeptIds: ['dept_class4', 'dept_class5', 'dept_class6', 'dept_class7'],
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class4',
    orgId: 'org_school',
    name: 'Class 4',
    slug: 'class-4',
    type: 'department',
    parentDeptId: 'dept_middleschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class5',
    orgId: 'org_school',
    name: 'Class 5',
    slug: 'class-5',
    type: 'department',
    parentDeptId: 'dept_middleschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class6',
    orgId: 'org_school',
    name: 'Class 6',
    slug: 'class-6',
    type: 'department',
    parentDeptId: 'dept_middleschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class7',
    orgId: 'org_school',
    name: 'Class 7',
    slug: 'class-7',
    type: 'department',
    parentDeptId: 'dept_middleschool',
    createdAt: '2026-08-01T08:00:00Z'
  },

  // 3. Section: Highschool
  {
    id: 'dept_highschool',
    orgId: 'org_school',
    name: 'Highschool',
    slug: 'highschool',
    type: 'section',
    parentDeptId: 'dept_school',
    rootRoleId: 'role_highschool_headmaster',
    groupedDeptIds: ['dept_class8', 'dept_class9', 'dept_class10', 'dept_physics'],
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class8',
    orgId: 'org_school',
    name: 'Class 8',
    slug: 'class-8',
    type: 'department',
    parentDeptId: 'dept_highschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class9',
    orgId: 'org_school',
    name: 'Class 9',
    slug: 'class-9',
    type: 'department',
    parentDeptId: 'dept_highschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_class10',
    orgId: 'org_school',
    name: 'Class 10',
    slug: 'class-10',
    type: 'department',
    parentDeptId: 'dept_highschool',
    createdAt: '2026-08-01T08:00:00Z'
  },
  {
    id: 'dept_physics',
    orgId: 'org_school',
    name: 'Physics',
    slug: 'physics',
    type: 'department',
    parentDeptId: 'dept_highschool',
    createdAt: '2026-08-01T08:00:00Z'
  }
];

export const INITIAL_ROLES: Role[] = [
  // School Root
  {
    id: 'role_principal',
    orgId: 'org_school',
    deptId: 'dept_school',
    title: 'principal',
    slug: 'principal',
    isRoot: true,
    roleType: 'master_root',
    description: 'Master organizational root with universal authority over all nodes.'
  },

  // ──────────────────────────────────────────────
  // Section 1: Preschool
  // ──────────────────────────────────────────────
  {
    id: 'role_preschool_headmaster',
    orgId: 'org_school',
    deptId: 'dept_preschool',
    title: 'preschool-headmaster',
    slug: 'preschool-headmaster',
    isRoot: true,
    isSectionRoot: true,
    roleType: 'section_root',
    description: 'Preschool section root: holds direct authority over caretaker and teachers in Kindergarde and Classes 1-3.'
  },
  // Kindergarde
  {
    id: 'role_caretaker',
    orgId: 'org_school',
    deptId: 'dept_kindergarde',
    title: 'caretaker',
    slug: 'caretaker',
    isRoot: false,
    roleType: 'member'
  },
  // Class 1
  { id: 'role_c1_math', orgId: 'org_school', deptId: 'dept_class1', title: 'math-teacher', slug: 'c1-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c1_english', orgId: 'org_school', deptId: 'dept_class1', title: 'english-teacher', slug: 'c1-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c1_science', orgId: 'org_school', deptId: 'dept_class1', title: 'science-teacher', slug: 'c1-science-teacher', isRoot: false, roleType: 'member' },

  // Class 2
  { id: 'role_c2_math', orgId: 'org_school', deptId: 'dept_class2', title: 'math-teacher', slug: 'c2-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c2_english', orgId: 'org_school', deptId: 'dept_class2', title: 'english-teacher', slug: 'c2-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c2_science', orgId: 'org_school', deptId: 'dept_class2', title: 'science-teacher', slug: 'c2-science-teacher', isRoot: false, roleType: 'member' },

  // Class 3
  { id: 'role_c3_math', orgId: 'org_school', deptId: 'dept_class3', title: 'math-teacher', slug: 'c3-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c3_english', orgId: 'org_school', deptId: 'dept_class3', title: 'english-teacher', slug: 'c3-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c3_science', orgId: 'org_school', deptId: 'dept_class3', title: 'science-teacher', slug: 'c3-science-teacher', isRoot: false, roleType: 'member' },

  // ──────────────────────────────────────────────
  // Section 2: Middleschool
  // ──────────────────────────────────────────────
  {
    id: 'role_middleschool_headmaster',
    orgId: 'org_school',
    deptId: 'dept_middleschool',
    title: 'middleschool-headmaster',
    slug: 'middleschool-headmaster',
    isRoot: true,
    isSectionRoot: true,
    roleType: 'section_root',
    description: 'Middleschool section root: holds direct authority over teachers in Classes 4-7.'
  },
  // Class 4
  { id: 'role_c4_math', orgId: 'org_school', deptId: 'dept_class4', title: 'math-teacher', slug: 'c4-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c4_english', orgId: 'org_school', deptId: 'dept_class4', title: 'english-teacher', slug: 'c4-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c4_science', orgId: 'org_school', deptId: 'dept_class4', title: 'science-teacher', slug: 'c4-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c4_geography', orgId: 'org_school', deptId: 'dept_class4', title: 'geography-teacher', slug: 'c4-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c4_history', orgId: 'org_school', deptId: 'dept_class4', title: 'history-teacher', slug: 'c4-history-teacher', isRoot: false, roleType: 'member' },

  // Class 5
  { id: 'role_c5_math', orgId: 'org_school', deptId: 'dept_class5', title: 'math-teacher', slug: 'c5-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c5_english', orgId: 'org_school', deptId: 'dept_class5', title: 'english-teacher', slug: 'c5-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c5_science', orgId: 'org_school', deptId: 'dept_class5', title: 'science-teacher', slug: 'c5-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c5_geography', orgId: 'org_school', deptId: 'dept_class5', title: 'geography-teacher', slug: 'c5-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c5_history', orgId: 'org_school', deptId: 'dept_class5', title: 'history-teacher', slug: 'c5-history-teacher', isRoot: false, roleType: 'member' },

  // Class 6
  { id: 'role_c6_math', orgId: 'org_school', deptId: 'dept_class6', title: 'math-teacher', slug: 'c6-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c6_english', orgId: 'org_school', deptId: 'dept_class6', title: 'english-teacher', slug: 'c6-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c6_science', orgId: 'org_school', deptId: 'dept_class6', title: 'science-teacher', slug: 'c6-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c6_geography', orgId: 'org_school', deptId: 'dept_class6', title: 'geography-teacher', slug: 'c6-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c6_history', orgId: 'org_school', deptId: 'dept_class6', title: 'history-teacher', slug: 'c6-history-teacher', isRoot: false, roleType: 'member' },

  // Class 7
  { id: 'role_c7_math', orgId: 'org_school', deptId: 'dept_class7', title: 'math-teacher', slug: 'c7-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c7_english', orgId: 'org_school', deptId: 'dept_class7', title: 'english-teacher', slug: 'c7-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c7_science', orgId: 'org_school', deptId: 'dept_class7', title: 'science-teacher', slug: 'c7-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c7_geography', orgId: 'org_school', deptId: 'dept_class7', title: 'geography-teacher', slug: 'c7-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c7_history', orgId: 'org_school', deptId: 'dept_class7', title: 'history-teacher', slug: 'c7-history-teacher', isRoot: false, roleType: 'member' },

  // ──────────────────────────────────────────────
  // Section 3: Highschool
  // ──────────────────────────────────────────────
  {
    id: 'role_highschool_headmaster',
    orgId: 'org_school',
    deptId: 'dept_highschool',
    title: 'highschool-headmaster',
    slug: 'highschool-headmaster',
    isRoot: true,
    isSectionRoot: true,
    roleType: 'section_root',
    description: 'Highschool section root: holds direct authority over teachers in Classes 8-10 and Physics.'
  },
  // Class 8
  { id: 'role_c8_math', orgId: 'org_school', deptId: 'dept_class8', title: 'math-teacher', slug: 'c8-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c8_english', orgId: 'org_school', deptId: 'dept_class8', title: 'english-teacher', slug: 'c8-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c8_science', orgId: 'org_school', deptId: 'dept_class8', title: 'science-teacher', slug: 'c8-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c8_geography', orgId: 'org_school', deptId: 'dept_class8', title: 'geography-teacher', slug: 'c8-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c8_history', orgId: 'org_school', deptId: 'dept_class8', title: 'history-teacher', slug: 'c8-history-teacher', isRoot: false, roleType: 'member' },

  // Class 9
  { id: 'role_c9_math', orgId: 'org_school', deptId: 'dept_class9', title: 'math-teacher', slug: 'c9-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c9_english', orgId: 'org_school', deptId: 'dept_class9', title: 'english-teacher', slug: 'c9-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c9_science', orgId: 'org_school', deptId: 'dept_class9', title: 'science-teacher', slug: 'c9-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c9_geography', orgId: 'org_school', deptId: 'dept_class9', title: 'geography-teacher', slug: 'c9-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c9_history', orgId: 'org_school', deptId: 'dept_class9', title: 'history-teacher', slug: 'c9-history-teacher', isRoot: false, roleType: 'member' },

  // Class 10
  { id: 'role_c10_math', orgId: 'org_school', deptId: 'dept_class10', title: 'math-teacher', slug: 'c10-math-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c10_english', orgId: 'org_school', deptId: 'dept_class10', title: 'english-teacher', slug: 'c10-english-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c10_science', orgId: 'org_school', deptId: 'dept_class10', title: 'science-teacher', slug: 'c10-science-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c10_geography', orgId: 'org_school', deptId: 'dept_class10', title: 'geography-teacher', slug: 'c10-geography-teacher', isRoot: false, roleType: 'member' },
  { id: 'role_c10_history', orgId: 'org_school', deptId: 'dept_class10', title: 'history-teacher', slug: 'c10-history-teacher', isRoot: false, roleType: 'member' },

  // Physics
  {
    id: 'role_physics_teacher',
    orgId: 'org_school',
    deptId: 'dept_physics',
    title: 'physics-teacher',
    slug: 'physics-teacher',
    isRoot: false,
    roleType: 'member',
    description: 'Physics teacher commanded by Highschool section headmaster.'
  }
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  // Test Environment: Only the Master Root (Principal) is initialized.
  // All subordinate positions are vacant awaiting invite link signups or test joins.
  { id: 'asgn_1', userId: 'u_principal', roleId: 'role_principal', deptId: 'dept_school', validFrom: '2026-08-01', isActive: true }
];

export const SAMPLE_EMPLOYEE_ASSIGNMENTS: Assignment[] = [
  { id: 'asgn_1', userId: 'u_principal', roleId: 'role_principal', deptId: 'dept_school', validFrom: '2026-08-01', isActive: true }
];

export const INITIAL_TASKS: Task[] = [];

export const INITIAL_COMMENTS: Comment[] = [];

export const INITIAL_FILES: FileItem[] = [];

export const INITIAL_MESSAGES: Message[] = [];

export const INITIAL_EVENTS: EventBinding[] = [];

export const INITIAL_JOIN_LINKS: JoinLink[] = [
  {
    id: 'link_1',
    orgId: 'org_school',
    roleId: 'role_caretaker',
    roleTitle: 'caretaker',
    deptName: 'Kindergarde',
    token: 'join-caretaker-preschool',
    expiresAt: '2026-09-30T23:59:59Z',
    maxUses: 10,
    useCount: 0,
    createdByUserId: 'u_principal',
    createdAt: '2026-09-01T08:00:00Z'
  },
  {
    id: 'link_2',
    orgId: 'org_school',
    roleId: 'role_c1_math',
    roleTitle: 'math-teacher',
    deptName: 'Class 1',
    token: 'join-c1-math-teacher',
    expiresAt: '2026-09-30T23:59:59Z',
    maxUses: 5,
    useCount: 0,
    createdByUserId: 'u_principal',
    createdAt: '2026-09-01T10:30:00Z'
  }
];

export const INITIAL_NOTIFICATIONS: OrgNotification[] = [];

