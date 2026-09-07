/**
 * In-Memory & Persistent State Store for Mika Recursive Organizational System
 * Implements the minimal data model:
 * - users (id, google_sub, email, preferred_name, full_name, gender, created_at)
 * - organizations (id, name, master_root_user_id, created_at)
 * - departments (id, org_id, name, parent_department_id nullable, is_section boolean, section_root_user_id nullable)
 * - roles (id, department_id, name)
 * - role_assignments (id, user_id, role_id, is_authority_holder boolean, assigned_at)
 * - invite_links (id, org_id, target_role_id, target_department_id, created_by_user_id, expires_at, created_at)
 * - sessions (id, user_id, google_sub, expires_at)
 */

export interface DbUser {
  id: string;
  google_sub: string;
  email: string;
  preferred_name: string;
  full_name: string;
  gender: 'female' | 'male' | 'non-binary' | 'prefer-not-to-say';
  avatar_url?: string;
  created_at: string;
}

export interface DbOrganization {
  id: string;
  name: string;
  slug: string;
  description: string;
  master_root_user_id: string;
  created_at: string;
}

export interface DbDepartment {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  parent_department_id: string | null;
  is_section: boolean;
  section_root_user_id: string | null;
  type: 'department' | 'section' | 'subject' | 'temp';
  grouped_dept_ids?: string[];
  root_role_id?: string;
  is_temporary?: boolean;
  is_archived?: boolean;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
}

export interface DbRole {
  id: string;
  org_id: string;
  department_id: string;
  name: string;
  slug: string;
  is_root: boolean;
  is_section_root?: boolean;
  role_type: 'master_root' | 'dept_root' | 'section_root' | 'subject_root' | 'member';
}

export interface DbRoleAssignment {
  id: string;
  org_id: string;
  user_id: string;
  role_id: string;
  department_id: string;
  is_authority_holder: boolean;
  assigned_at: string;
  is_active: boolean;
}

export interface DbInviteLink {
  id: string;
  token: string;
  org_id: string;
  target_role_id: string;
  target_department_id: string;
  created_by_user_id: string;
  expires_at: string; // ISO String (validity check: Date.now() < Date.parse(expires_at))
  created_at: string;
  role_title?: string;
  dept_name?: string;
  required_integrations?: string[];
}

export interface DbSession {
  id: string;
  user_id: string;
  google_sub: string;
  email: string;
  expires_at: string;
  created_at: string;
}

export interface DbTask {
  id: string;
  org_id: string;
  dept_id: string;
  title: string;
  description: string;
  assigned_by_user_id: string;
  assigned_to_role_id: string;
  assigned_to_user_id?: string;
  status: 'pending' | 'help' | 'done' | 'expired' | 'rejected';
  due_date?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  rejection_reason?: string;
}

export interface DbComment {
  id: string;
  task_id: string;
  author_user_id: string;
  author_name: string;
  author_role_title: string;
  content: string;
  is_help_notice?: boolean;
  created_at: string;
}

export interface DbFile {
  id: string;
  org_id: string;
  dept_id: string;
  name: string;
  size: string;
  type: string;
  uploaded_by_user_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
  source_task_id?: string;
  folder?: string;
}

export interface DbMessage {
  id: string;
  org_id: string;
  channel_type: 'dept' | 'dm' | 'event';
  channel_id: string;
  channel_name: string;
  sender_user_id: string;
  sender_name: string;
  sender_role_title: string;
  content: string;
  timestamp: string;
}

export interface DbEventBinding {
  id: string;
  org_id: string;
  title: string;
  description: string;
  department_ids: string[];
  lead_user_ids: string[];
  created_at: string;
  is_active: boolean;
}

export interface DbIntegrationConnection {
  id: string;
  integration_key: string;
  org_id: string;
  scope: 'org' | 'root';
  scope_root_user_id?: string;
  access_role_ids: 'all' | string[];
  connected_by_user_id: string;
  account_label: string;
  access_token?: string; // Stored server-side only, NEVER sent to client
  connected_at: string;
}

class Database {
  users: Map<string, DbUser> = new Map();
  organizations: Map<string, DbOrganization> = new Map();
  departments: Map<string, DbDepartment> = new Map();
  roles: Map<string, DbRole> = new Map();
  roleAssignments: Map<string, DbRoleAssignment> = new Map();
  inviteLinks: Map<string, DbInviteLink> = new Map();
  sessions: Map<string, DbSession> = new Map();
  tasks: Map<string, DbTask> = new Map();
  comments: Map<string, DbComment> = new Map();
  files: Map<string, DbFile> = new Map();
  messages: Map<string, DbMessage> = new Map();
  events: Map<string, DbEventBinding> = new Map();
  integrationConnections: Map<string, DbIntegrationConnection> = new Map();

  constructor() {
    this.seedDatabase();
  }

  seedDatabase() {
    // 1. Initial Organization: School
    const org: DbOrganization = {
      id: 'org_school',
      name: 'School',
      slug: 'school',
      description: 'Academic institution operating under the Mika recursive relationship-graph model.',
      master_root_user_id: 'u_principal',
      created_at: '2026-08-01T08:00:00Z',
    };
    this.organizations.set(org.id, org);

    // 2. Initial Users
    const seedUsers: DbUser[] = [
      {
        id: 'u_principal',
        google_sub: 'google_sub_principal_001',
        email: 'principal@school.edu',
        preferred_name: 'Dr. Vance',
        full_name: 'Dr. Sarah Vance',
        gender: 'female',
        avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'u_preschool_head',
        google_sub: 'google_sub_preschool_head_002',
        email: 'preschool.head@school.edu',
        preferred_name: 'Preschool Lead',
        full_name: 'Preschool Headmaster',
        gender: 'female',
        avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        created_at: '2026-08-02T08:00:00Z'
      },
      {
        id: 'u_middle_head',
        google_sub: 'google_sub_middle_head_003',
        email: 'middleschool.head@school.edu',
        preferred_name: 'Middle Lead',
        full_name: 'Middleschool Headmaster',
        gender: 'male',
        avatar_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
        created_at: '2026-08-02T08:00:00Z'
      },
      {
        id: 'u_high_head',
        google_sub: 'google_sub_high_head_004',
        email: 'highschool.head@school.edu',
        preferred_name: 'High Lead',
        full_name: 'Highschool Headmaster',
        gender: 'male',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        created_at: '2026-08-02T08:00:00Z'
      }
    ];
    seedUsers.forEach(u => this.users.set(u.id, u));

    // 3. Departments
    const seedDepts: DbDepartment[] = [
      // Master Root Department: School
      {
        id: 'dept_school',
        org_id: 'org_school',
        name: 'School',
        slug: 'school',
        parent_department_id: null,
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        root_role_id: 'role_principal',
        created_at: '2026-08-01T08:00:00Z'
      },

      // 1. Section: Preschool
      {
        id: 'dept_preschool',
        org_id: 'org_school',
        name: 'Preschool',
        slug: 'preschool',
        parent_department_id: 'dept_school',
        is_section: true,
        section_root_user_id: 'u_preschool_head',
        type: 'section',
        grouped_dept_ids: ['dept_kindergarde', 'dept_class1', 'dept_class2', 'dept_class3'],
        root_role_id: 'role_preschool_headmaster',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_kindergarde',
        org_id: 'org_school',
        name: 'Kindergarde',
        slug: 'kindergarde',
        parent_department_id: 'dept_preschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class1',
        org_id: 'org_school',
        name: 'Class 1',
        slug: 'class-1',
        parent_department_id: 'dept_preschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class2',
        org_id: 'org_school',
        name: 'Class 2',
        slug: 'class-2',
        parent_department_id: 'dept_preschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class3',
        org_id: 'org_school',
        name: 'Class 3',
        slug: 'class-3',
        parent_department_id: 'dept_preschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },

      // 2. Section: Middleschool
      {
        id: 'dept_middleschool',
        org_id: 'org_school',
        name: 'Middleschool',
        slug: 'middleschool',
        parent_department_id: 'dept_school',
        is_section: true,
        section_root_user_id: 'u_middle_head',
        type: 'section',
        grouped_dept_ids: ['dept_class4', 'dept_class5', 'dept_class6', 'dept_class7'],
        root_role_id: 'role_middleschool_headmaster',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class4',
        org_id: 'org_school',
        name: 'Class 4',
        slug: 'class-4',
        parent_department_id: 'dept_middleschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class5',
        org_id: 'org_school',
        name: 'Class 5',
        slug: 'class-5',
        parent_department_id: 'dept_middleschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class6',
        org_id: 'org_school',
        name: 'Class 6',
        slug: 'class-6',
        parent_department_id: 'dept_middleschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class7',
        org_id: 'org_school',
        name: 'Class 7',
        slug: 'class-7',
        parent_department_id: 'dept_middleschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },

      // 3. Section: Highschool
      {
        id: 'dept_highschool',
        org_id: 'org_school',
        name: 'Highschool',
        slug: 'highschool',
        parent_department_id: 'dept_school',
        is_section: true,
        section_root_user_id: 'u_high_head',
        type: 'section',
        grouped_dept_ids: ['dept_class8', 'dept_class9', 'dept_class10', 'dept_physics'],
        root_role_id: 'role_highschool_headmaster',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class8',
        org_id: 'org_school',
        name: 'Class 8',
        slug: 'class-8',
        parent_department_id: 'dept_highschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class9',
        org_id: 'org_school',
        name: 'Class 9',
        slug: 'class-9',
        parent_department_id: 'dept_highschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_class10',
        org_id: 'org_school',
        name: 'Class 10',
        slug: 'class-10',
        parent_department_id: 'dept_highschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      },
      {
        id: 'dept_physics',
        org_id: 'org_school',
        name: 'Physics',
        slug: 'physics',
        parent_department_id: 'dept_highschool',
        is_section: false,
        section_root_user_id: null,
        type: 'department',
        created_at: '2026-08-01T08:00:00Z'
      }
    ];
    seedDepts.forEach(d => this.departments.set(d.id, d));

    // 4. Roles
    const seedRoles: DbRole[] = [
      // School Root
      { id: 'role_principal', org_id: 'org_school', department_id: 'dept_school', name: 'principal', slug: 'principal', is_root: true, role_type: 'master_root' },

      // Section 1: Preschool
      { id: 'role_preschool_headmaster', org_id: 'org_school', department_id: 'dept_preschool', name: 'preschool-headmaster', slug: 'preschool-headmaster', is_root: true, is_section_root: true, role_type: 'section_root' },
      { id: 'role_caretaker', org_id: 'org_school', department_id: 'dept_kindergarde', name: 'caretaker', slug: 'caretaker', is_root: false, role_type: 'member' },
      { id: 'role_c1_math', org_id: 'org_school', department_id: 'dept_class1', name: 'math-teacher', slug: 'c1-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c1_english', org_id: 'org_school', department_id: 'dept_class1', name: 'english-teacher', slug: 'c1-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c1_science', org_id: 'org_school', department_id: 'dept_class1', name: 'science-teacher', slug: 'c1-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c2_math', org_id: 'org_school', department_id: 'dept_class2', name: 'math-teacher', slug: 'c2-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c2_english', org_id: 'org_school', department_id: 'dept_class2', name: 'english-teacher', slug: 'c2-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c2_science', org_id: 'org_school', department_id: 'dept_class2', name: 'science-teacher', slug: 'c2-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c3_math', org_id: 'org_school', department_id: 'dept_class3', name: 'math-teacher', slug: 'c3-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c3_english', org_id: 'org_school', department_id: 'dept_class3', name: 'english-teacher', slug: 'c3-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c3_science', org_id: 'org_school', department_id: 'dept_class3', name: 'science-teacher', slug: 'c3-science-teacher', is_root: false, role_type: 'member' },

      // Section 2: Middleschool
      { id: 'role_middleschool_headmaster', org_id: 'org_school', department_id: 'dept_middleschool', name: 'middleschool-headmaster', slug: 'middleschool-headmaster', is_root: true, is_section_root: true, role_type: 'section_root' },
      { id: 'role_c4_math', org_id: 'org_school', department_id: 'dept_class4', name: 'math-teacher', slug: 'c4-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c4_english', org_id: 'org_school', department_id: 'dept_class4', name: 'english-teacher', slug: 'c4-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c4_science', org_id: 'org_school', department_id: 'dept_class4', name: 'science-teacher', slug: 'c4-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c4_geography', org_id: 'org_school', department_id: 'dept_class4', name: 'geography-teacher', slug: 'c4-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c4_history', org_id: 'org_school', department_id: 'dept_class4', name: 'history-teacher', slug: 'c4-history-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c5_math', org_id: 'org_school', department_id: 'dept_class5', name: 'math-teacher', slug: 'c5-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c5_english', org_id: 'org_school', department_id: 'dept_class5', name: 'english-teacher', slug: 'c5-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c5_science', org_id: 'org_school', department_id: 'dept_class5', name: 'science-teacher', slug: 'c5-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c5_geography', org_id: 'org_school', department_id: 'dept_class5', name: 'geography-teacher', slug: 'c5-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c5_history', org_id: 'org_school', department_id: 'dept_class5', name: 'history-teacher', slug: 'c5-history-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c6_math', org_id: 'org_school', department_id: 'dept_class6', name: 'math-teacher', slug: 'c6-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c6_english', org_id: 'org_school', department_id: 'dept_class6', name: 'english-teacher', slug: 'c6-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c6_science', org_id: 'org_school', department_id: 'dept_class6', name: 'science-teacher', slug: 'c6-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c6_geography', org_id: 'org_school', department_id: 'dept_class6', name: 'geography-teacher', slug: 'c6-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c6_history', org_id: 'org_school', department_id: 'dept_class6', name: 'history-teacher', slug: 'c6-history-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c7_math', org_id: 'org_school', department_id: 'dept_class7', name: 'math-teacher', slug: 'c7-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c7_english', org_id: 'org_school', department_id: 'dept_class7', name: 'english-teacher', slug: 'c7-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c7_science', org_id: 'org_school', department_id: 'dept_class7', name: 'science-teacher', slug: 'c7-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c7_geography', org_id: 'org_school', department_id: 'dept_class7', name: 'geography-teacher', slug: 'c7-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c7_history', org_id: 'org_school', department_id: 'dept_class7', name: 'history-teacher', slug: 'c7-history-teacher', is_root: false, role_type: 'member' },

      // Section 3: Highschool
      { id: 'role_highschool_headmaster', org_id: 'org_school', department_id: 'dept_highschool', name: 'highschool-headmaster', slug: 'highschool-headmaster', is_root: true, is_section_root: true, role_type: 'section_root' },
      { id: 'role_c8_math', org_id: 'org_school', department_id: 'dept_class8', name: 'math-teacher', slug: 'c8-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c8_english', org_id: 'org_school', department_id: 'dept_class8', name: 'english-teacher', slug: 'c8-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c8_science', org_id: 'org_school', department_id: 'dept_class8', name: 'science-teacher', slug: 'c8-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c8_geography', org_id: 'org_school', department_id: 'dept_class8', name: 'geography-teacher', slug: 'c8-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c8_history', org_id: 'org_school', department_id: 'dept_class8', name: 'history-teacher', slug: 'c8-history-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c9_math', org_id: 'org_school', department_id: 'dept_class9', name: 'math-teacher', slug: 'c9-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c9_english', org_id: 'org_school', department_id: 'dept_class9', name: 'english-teacher', slug: 'c9-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c9_science', org_id: 'org_school', department_id: 'dept_class9', name: 'science-teacher', slug: 'c9-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c9_geography', org_id: 'org_school', department_id: 'dept_class9', name: 'geography-teacher', slug: 'c9-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c9_history', org_id: 'org_school', department_id: 'dept_class9', name: 'history-teacher', slug: 'c9-history-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c10_math', org_id: 'org_school', department_id: 'dept_class10', name: 'math-teacher', slug: 'c10-math-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c10_english', org_id: 'org_school', department_id: 'dept_class10', name: 'english-teacher', slug: 'c10-english-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c10_science', org_id: 'org_school', department_id: 'dept_class10', name: 'science-teacher', slug: 'c10-science-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c10_geography', org_id: 'org_school', department_id: 'dept_class10', name: 'geography-teacher', slug: 'c10-geography-teacher', is_root: false, role_type: 'member' },
      { id: 'role_c10_history', org_id: 'org_school', department_id: 'dept_class10', name: 'history-teacher', slug: 'c10-history-teacher', is_root: false, role_type: 'member' },
      { id: 'role_physics_teacher', org_id: 'org_school', department_id: 'dept_physics', name: 'physics-teacher', slug: 'physics-teacher', is_root: false, role_type: 'member' }
    ];
    seedRoles.forEach(r => this.roles.set(r.id, r));

    // 5. Role Assignments: In test environment, only Master Root (Principal) is initially assigned.
    const seedAssignments: DbRoleAssignment[] = [
      { id: 'asgn_1', org_id: 'org_school', user_id: 'u_principal', role_id: 'role_principal', department_id: 'dept_school', is_authority_holder: true, assigned_at: '2026-08-01T08:00:00Z', is_active: true }
    ];
    seedAssignments.forEach(a => this.roleAssignments.set(a.id, a));

    // 6. Invite Links for quick testing
    const seedLinks: DbInviteLink[] = [
      {
        id: 'jl_caretaker',
        token: 'join-caretaker-preschool',
        org_id: 'org_school',
        target_role_id: 'role_caretaker',
        target_department_id: 'dept_kindergarde',
        created_by_user_id: 'u_principal',
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_at: '2026-08-20T08:00:00Z',
        role_title: 'caretaker',
        dept_name: 'Kindergarde'
      },
      {
        id: 'jl_c1_math',
        token: 'join-c1-math-teacher',
        org_id: 'org_school',
        target_role_id: 'role_c1_math',
        target_department_id: 'dept_class1',
        created_by_user_id: 'u_principal',
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        created_at: '2026-08-20T08:00:00Z',
        role_title: 'math-teacher',
        dept_name: 'Class 1'
      }
    ];
    seedLinks.forEach(l => this.inviteLinks.set(l.token, l));

    // 7. Seed Tasks: Clean empty state for new org test case
    const seedTasks: DbTask[] = [];
    seedTasks.forEach(t => this.tasks.set(t.id, t));

    // 8. Seed Comments
    const seedComments: DbComment[] = [];
    seedComments.forEach(c => this.comments.set(c.id, c));

    // 9. Seed Files
    const seedFiles: DbFile[] = [];
    seedFiles.forEach(f => this.files.set(f.id, f));

    // 10. Seed Messages
    const seedMessages: DbMessage[] = [];
    seedMessages.forEach(m => this.messages.set(m.id, m));

    // 11. Seed Event Binding
    const seedEvents: DbEventBinding[] = [];
    seedEvents.forEach(e => this.events.set(e.id, e));
  }

  // --- Users & Auth Queries ---
  findUserByGoogleSub(googleSub: string): DbUser | undefined {
    for (const u of this.users.values()) {
      if (u.google_sub === googleSub) return u;
    }
    return undefined;
  }

  findUserByEmail(email: string): DbUser | undefined {
    const norm = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.trim().toLowerCase() === norm) return u;
    }
    return undefined;
  }

  createUser(userData: {
    google_sub: string;
    email: string;
    preferred_name: string;
    full_name: string;
    gender: 'female' | 'male' | 'non-binary' | 'prefer-not-to-say';
    avatar_url?: string;
  }): DbUser {
    const id = `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user: DbUser = {
      id,
      google_sub: userData.google_sub,
      email: userData.email,
      preferred_name: userData.preferred_name,
      full_name: userData.full_name,
      gender: userData.gender,
      avatar_url: userData.avatar_url,
      created_at: new Date().toISOString()
    };
    this.users.set(id, user);
    return user;
  }

  // --- Sessions ---
  createSession(user: DbUser): DbSession {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const session: DbSession = {
      id: sessionId,
      user_id: user.id,
      google_sub: user.google_sub,
      email: user.email,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), // 7 day session
      created_at: new Date().toISOString()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): DbSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.now() > Date.parse(session.expires_at)) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // --- Organizations & Roles ---
  createOrganization(name: string, description: string, masterRootUser: DbUser): {
    org: DbOrganization;
    masterDept: DbDepartment;
    masterRole: DbRole;
    assignment: DbRoleAssignment;
  } {
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const org: DbOrganization = {
      id: orgId,
      name,
      slug,
      description: description || 'Mika Recursive Organizational System',
      master_root_user_id: masterRootUser.id,
      created_at: new Date().toISOString()
    };
    this.organizations.set(orgId, org);

    // Create top-level leadership department
    const deptId = `dept_${Date.now()}_lead`;
    const masterDept: DbDepartment = {
      id: deptId,
      org_id: orgId,
      name: 'Executive Leadership',
      slug: 'executive-leadership',
      parent_department_id: null,
      is_section: false,
      section_root_user_id: null,
      type: 'department',
      created_at: new Date().toISOString()
    };
    this.departments.set(deptId, masterDept);

    // Create master root role
    const roleId = `role_${Date.now()}_root`;
    const masterRole: DbRole = {
      id: roleId,
      org_id: orgId,
      department_id: deptId,
      name: 'Principal / Executive Lead (Master Root)',
      slug: 'master-root',
      is_root: true,
      role_type: 'master_root'
    };
    this.roles.set(roleId, masterRole);

    masterDept.root_role_id = roleId;

    // Assign master root user to role with full authority
    const asgnId = `asgn_${Date.now()}_root`;
    const assignment: DbRoleAssignment = {
      id: asgnId,
      org_id: org.id,
      user_id: masterRootUser.id,
      role_id: roleId,
      department_id: deptId,
      is_authority_holder: true,
      assigned_at: new Date().toISOString(),
      is_active: true
    };
    this.roleAssignments.set(asgnId, assignment);

    return { org, masterDept, masterRole, assignment };
  }

  // --- Invite Links ---
  createInviteLink(linkData: {
    org_id: string;
    target_role_id: string;
    target_department_id: string;
    created_by_user_id: string;
    days_valid: number;
    token?: string;
    required_integrations?: string[];
  }): DbInviteLink {
    const token = linkData.token || `join_${Math.random().toString(36).substring(2, 10)}`;
    const role = this.roles.get(linkData.target_role_id);
    const dept = this.departments.get(linkData.target_department_id);

    const link: DbInviteLink = {
      id: `jl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      token,
      org_id: linkData.org_id,
      target_role_id: linkData.target_role_id,
      target_department_id: linkData.target_department_id,
      created_by_user_id: linkData.created_by_user_id,
      expires_at: new Date(Date.now() + linkData.days_valid * 86400000).toISOString(),
      created_at: new Date().toISOString(),
      role_title: role?.name || 'Member Role',
      dept_name: dept?.name || 'Department',
      required_integrations: linkData.required_integrations || []
    };

    this.inviteLinks.set(token, link);
    return link;
  }

  getInviteLinkByToken(token: string): DbInviteLink | undefined {
    return this.inviteLinks.get(token);
  }

  // --- Assign Role to User ---
  assignUserToRole(userId: string, roleId: string, departmentId?: string, isAuthorityHolder = false): DbRoleAssignment {
    const role = this.roles.get(roleId);
    const deptId = departmentId || role?.department_id || '';

    // Check if user already has active assignment to this role
    for (const a of this.roleAssignments.values()) {
      if (a.user_id === userId && a.role_id === roleId && a.is_active) {
        return a; // Already assigned
      }
    }

    const asgnId = `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assignment: DbRoleAssignment = {
      id: asgnId,
      org_id: role?.org_id || 'org_school',
      user_id: userId,
      role_id: roleId,
      department_id: deptId,
      is_authority_holder: isAuthorityHolder || !!role?.is_root,
      assigned_at: new Date().toISOString(),
      is_active: true
    };
    this.roleAssignments.set(asgnId, assignment);
    return assignment;
  }

  // Get all active assignments for user with resolved roles and departments
  getUserAssignmentsWithDetails(userId: string) {
    const results: Array<{
      assignment: DbRoleAssignment;
      role: DbRole;
      department: DbDepartment;
    }> = [];

    for (const a of this.roleAssignments.values()) {
      if (a.user_id === userId && a.is_active) {
        const role = this.roles.get(a.role_id);
        const department = this.departments.get(a.department_id || role?.department_id || '');
        if (role && department) {
          results.push({ assignment: a, role, department });
        }
      }
    }
    return results;
  }

  // =========================================================================
  // Integration Connections & Token Storage (Stored server-side only)
  // =========================================================================

  saveIntegrationToken(data: {
    integrationKey: string;
    orgId: string;
    scope: 'org' | 'root';
    scopeRootUserId?: string;
    accountLabel: string;
    accessToken: string;
    connectedByUserId: string;
    connectedAt?: string;
  }): DbIntegrationConnection {
    // Check if an existing connection exists for this org/key/scope/user
    let existingId: string | undefined;
    for (const [id, conn] of this.integrationConnections.entries()) {
      if (
        conn.integration_key === data.integrationKey &&
        conn.org_id === data.orgId &&
        conn.scope === data.scope &&
        (data.scope === 'org' || conn.scope_root_user_id === data.scopeRootUserId)
      ) {
        existingId = id;
        break;
      }
    }

    const id = existingId || `conn_${Date.now()}_${data.integrationKey}`;
    const connection: DbIntegrationConnection = {
      id,
      integration_key: data.integrationKey,
      org_id: data.orgId,
      scope: data.scope,
      scope_root_user_id: data.scopeRootUserId,
      access_role_ids: 'all',
      connected_by_user_id: data.connectedByUserId,
      account_label: data.accountLabel,
      access_token: data.accessToken,
      connected_at: data.connectedAt || new Date().toISOString()
    };

    this.integrationConnections.set(id, connection);
    return connection;
  }

  resolveIntegrationConnection(integrationKey: string, user: DbUser): DbIntegrationConnection | null {
    // 1. Check for org-wide connection
    for (const conn of this.integrationConnections.values()) {
      if (conn.integration_key === integrationKey && conn.scope === 'org' && conn.access_token) {
        return conn;
      }
    }

    // 2. Check for root-scoped connection where user is the root or connected by user
    for (const conn of this.integrationConnections.values()) {
      if (
        conn.integration_key === integrationKey &&
        conn.scope === 'root' &&
        conn.access_token &&
        (conn.scope_root_user_id === user.id || conn.connected_by_user_id === user.id)
      ) {
        return conn;
      }
    }

    // 3. Fallback: if any valid connection with an access token exists for this integrationKey, use it
    for (const conn of this.integrationConnections.values()) {
      if (conn.integration_key === integrationKey && conn.access_token) {
        return conn;
      }
    }

    return null;
  }

  deleteIntegrationConnection(connId: string): boolean {
    return this.integrationConnections.delete(connId);
  }

  getPublicIntegrationConnections(orgId?: string) {
    const results: Array<{
      id: string;
      integrationKey: string;
      orgId: string;
      scope: 'org' | 'root';
      scopeRootUserId?: string;
      accessRoleIds: 'all' | string[];
      connectedByUserId: string;
      accountLabel: string;
      connectedAt: string;
    }> = [];

    for (const conn of this.integrationConnections.values()) {
      if (!orgId || conn.org_id === orgId) {
        results.push({
          id: conn.id,
          integrationKey: conn.integration_key,
          orgId: conn.org_id,
          scope: conn.scope,
          scopeRootUserId: conn.scope_root_user_id,
          accessRoleIds: conn.access_role_ids,
          connectedByUserId: conn.connected_by_user_id,
          accountLabel: conn.account_label,
          connectedAt: conn.connected_at
          // EXPLICITLY NO access_token! Never sent to client
        });
      }
    }

    return results;
  }
}

export const db = new Database();
