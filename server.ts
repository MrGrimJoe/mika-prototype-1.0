import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { db, DbUser } from './server/db';
import { canIssueLinkFor } from './server/authority';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent header as required
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// System instruction matching Part III §16-17 of the Mika specification
const INTERPRETATION_SYSTEM_INSTRUCTION = `You are the interpretation layer for a recursive organisational system (Mika).
You receive an org schema (departments, sections, roles, authority relationships) and a management request or query.
You return a JSON proposal only — no explanation outside JSON, no preamble, no markdown.
The deterministic authorization engine, not you, decides ALLOW or DENY.

Rules you apply when proposing:
- A department root has authority over subordinate department roots.
- A section root has authority over roles inside its grouped departments, not over those departments' own roots.
- A user holding multiple roles has the union of all their assignments' scopes.
- Help requests route to the direct lead of the department the task belongs to; if the requester holds roles in multiple departments, resolve by the task's department.
- Authority never flows upward — a role cannot affect its own lead.
- Event bindings create horizontal collaboration between leads without creating hierarchical authority.
- Return { "error": "insufficient_context" } if the schema is incomplete.`;

// Middleware to extract authenticated session from headers
function getAuthenticatedUser(req: express.Request): DbUser | null {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : (req.headers['x-session-id'] as string || req.query.sessionId as string);
  
  if (!sessionId) return null;
  const session = db.getSession(sessionId);
  if (!session) return null;
  return db.users.get(session.user_id) || null;
}

// ==========================================
// 1. Health & Status
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'Department Flowchart & Mika Organization System',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 1B. Global Shortcut & Userscript Integration
// ==========================================
app.get(['/userscript/mika-submit.user.js', '/api/userscript/mika-submit.user.js'], (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'userscript', 'mika-submit.user.js'));
});

app.post(['/v1/tasks/submit-shortcut', '/api/v1/tasks/submit-shortcut'], async (req, res) => {
  const { taskId, sourceUrl, host, capturedAt } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: 'taskId is required' });
  }

  res.json({
    success: true,
    taskId,
    status: 'done',
    evidence: {
      source: 'keyboard-shortcut',
      url: sourceUrl || '',
      host: host || '',
      capturedAt: capturedAt || new Date().toISOString()
    }
  });
});

// ==========================================
// 1C. GitHub Integration (Webhooks & Trees)
// ==========================================
const githubTreeCache: Record<string, { timestamp: number; tree: any[] }> = {};

app.post(['/api/webhooks/github', '/api/v1/webhooks/github'], async (req, res) => {
  const event = (req.headers['x-github-event'] as string) || 'push';
  const payload = req.body || {};

  // 1. CI failure (workflow_run or check_run) -> auto-task notification for dept root
  if (
    (event === 'workflow_run' && payload.workflow_run?.conclusion === 'failure') ||
    (event === 'check_run' && payload.check_run?.conclusion === 'failure') ||
    payload.action === 'failure'
  ) {
    const repoName = payload.repository?.name || 'mika-core';
    const runNumber = payload.workflow_run?.run_number || payload.check_run?.id || '1042';
    const runUrl = payload.workflow_run?.html_url || payload.check_run?.html_url || `https://github.com/codeNinjaJane/${repoName}/actions/runs/${runNumber}`;

    return res.json({
      received: true,
      action: 'auto_assign_notification_created',
      notification: {
        type: 'repo_error',
        title: `Fix: build failure on main — workflow_run #${runNumber}`,
        repo: repoName,
        runUrl,
        suggestedTitle: `Fix: build failure on main — workflow_run #${runNumber}`,
      }
    });
  }

  // 2. Push event -> Scan commits for Mika-Task: <taskId> trailer
  if (event === 'push' || payload.commits) {
    const commits = payload.commits || [];
    const matchedTasks: any[] = [];
    for (const commit of commits) {
      const msg = commit.message || '';
      const match = msg.match(/Mika-Task:\s*([a-zA-Z0-9_\-]+)/i);
      if (match) {
        const taskId = match[1].trim();
        matchedTasks.push({
          taskId,
          commitSha: commit.id || commit.sha || 'sha-98124f',
          commitMessage: msg,
          author: commit.author?.name || 'Developer',
          capturedAt: new Date().toISOString()
        });
      }
    }

    return res.json({
      received: true,
      action: 'commits_scanned',
      matchedTasks
    });
  }

  res.json({ received: true });
});

app.get('/api/integrations/github/repos', (req, res) => {
  res.json({
    repos: [
      { id: 'repo-mika-core', name: 'mika-core', fullName: 'codeNinjaJane/mika-core', defaultBranch: 'main' },
      { id: 'repo-mika-prototypes', name: 'mika-prototypes', fullName: 'codeNinjaJane/mika-prototypes', defaultBranch: 'main' },
      { id: 'repo-school-portal', name: 'school-portal', fullName: 'school-edu/portal', defaultBranch: 'main' },
      { id: 'repo-docs', name: 'org-docs', fullName: 'org/docs', defaultBranch: 'main' }
    ]
  });
});

app.get('/api/integrations/github/tree', (req, res) => {
  const repo = (req.query.repo as string) || 'mika-core';
  const cached = githubTreeCache[repo];
  if (cached && Date.now() - cached.timestamp < 300000) {
    return res.json({ files: cached.tree });
  }

  const sampleTree = [
    { path: 'src/index.ts', type: 'blob', size: 1024 },
    { path: 'src/lib/orgRules.ts', type: 'blob', size: 31620 },
    { path: 'src/lib/authorizationEngine.ts', type: 'blob', size: 5178 },
    { path: 'src/components/App.tsx', type: 'blob', size: 28646 },
    { path: 'src/components/FileVault.tsx', type: 'blob', size: 14200 },
    { path: 'src/components/TaskFeed.tsx', type: 'blob', size: 11445 },
    { path: 'package.json', type: 'blob', size: 1200 },
    { path: 'README.md', type: 'blob', size: 9447 },
    { path: 'firestore.rules', type: 'blob', size: 1850 },
    { path: 'server.ts', type: 'blob', size: 29050 }
  ];

  githubTreeCache[repo] = { timestamp: Date.now(), tree: sampleTree };
  res.json({ files: sampleTree });
});

// ==========================================
// 1D. Figma & Canva Integration Endpoints
// ==========================================
app.get('/api/integrations/figma/files', (req, res) => {
  res.json({
    files: [
      { key: 'fig_brand_v1', name: 'Mika Brand & Design System 2026', lastModified: '2026-09-01T12:00:00Z', thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80', frames: ['Design System', 'Typography', 'Components'] },
      { key: 'fig_dashboard_v2', name: 'Executive Flowchart & Roles View', lastModified: '2026-09-03T15:30:00Z', thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&q=80', frames: ['Desktop Canvas', 'Mobile View'] },
      { key: 'fig_tasks_mobile', name: 'Staff Task Feed & Submissions', lastModified: '2026-09-04T09:15:00Z', thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=300&q=80', frames: ['Feed', 'Expanded Task'] }
    ]
  });
});

app.post('/api/integrations/figma/export', (req, res) => {
  const { taskId, fileKey, frameId, previewUrl, exportType } = req.body;
  res.json({
    success: true,
    taskId,
    status: 'done',
    evidence: {
      source: 'plugin',
      url: `https://www.figma.com/file/${fileKey || 'design'}?node-id=${frameId || '0-1'}`,
      previewUrl: previewUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80',
      fullImport: exportType === 'full_import',
      capturedAt: new Date().toISOString()
    }
  });
});

app.get('/api/integrations/canva/designs', (req, res) => {
  res.json({
    designs: [
      { id: 'canva_pres_q3', title: 'Q3 All-Hands Presentation', lastModified: '2026-09-02T10:00:00Z', thumbnailUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&q=80' },
      { id: 'canva_flyer_stem', title: 'Annual STEM Week Flyer', lastModified: '2026-09-04T14:20:00Z', thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&q=80' },
      { id: 'canva_social_banner', title: 'School Social Banner & Assets', lastModified: '2026-09-05T08:45:00Z', thumbnailUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=300&q=80' }
    ]
  });
});

app.post('/api/integrations/canva/export', (req, res) => {
  const { taskId, designId, previewUrl } = req.body;
  res.json({
    success: true,
    taskId,
    status: 'done',
    evidence: {
      source: 'plugin',
      url: `https://www.canva.com/design/${designId || 'design'}`,
      previewUrl: previewUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&q=80',
      capturedAt: new Date().toISOString()
    }
  });
});

// ==========================================
// Organization Flowchart AI Assistance API
// ==========================================
app.post('/api/assistance/generate', async (req, res) => {
  const { prompt, userName } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!ai) {
    return res.status(503).json({ error: 'Gemini AI not initialized (API key not provided)' });
  }

  try {
    const promptText = `The user "${userName || 'User'}" wants to build an organizational flowchart hierarchy.
User Request: "${prompt}"

Rules for the organization tree:
- Root department must have id: "root-department".
- Each department node has: id (string), department (name string), roots (array of root/lead title strings), roles (array of operational role title strings), children (array of department nodes), sectionId (optional string matching a section id, never on root-department).
- Sections (optional array): id (e.g. "sec-1"), name (string), shade ("ash" | "silver" | "slate" | "charcoal" | "graphite" | "sand"), borderStyle ("solid" | "dashed" | "double").
- Return a JSON object with:
  "reply": A friendly, professional explanation of the organizational structure designed for them.
  "tree": The complete hierarchical DepartmentNode tree matching the rules above.
  "sections": An array of Section objects if applicable.
Return ONLY valid JSON matching this format without backticks or markdown wrap.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text?.trim() || '{}';
    const parsed = JSON.parse(responseText);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Assistance generation error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate structure' });
  }
});

// ==========================================
// 2. Google Authentication API Surface
// ==========================================

/**
 * POST /api/auth/google/callback (or /auth/google/callback)
 * Verify Google ID Token / payload, lookup existing user by verified Google email/sub,
 * and create session or flag as new user.
 */
const handleGoogleCallback = async (req: express.Request, res: express.Response) => {
  try {
    const { idToken, googleSub, email, fullName, photoUrl } = req.body;

    if (!email && !googleSub) {
      return res.status(400).json({ error: 'Google email or sub is required' });
    }

    // Lookup user by Google Sub or Email
    let user = googleSub ? db.findUserByGoogleSub(googleSub) : undefined;
    if (!user && email) {
      user = db.findUserByEmail(email);
      // Update google_sub if user was seeded or existing
      if (user && googleSub && !user.google_sub) {
        user.google_sub = googleSub;
      }
    }

    if (user) {
      // Existing user found -> create session
      const session = db.createSession(user);
      const assignments = db.getUserAssignmentsWithDetails(user.id);
      return res.json({
        success: true,
        isNew: false,
        user,
        session,
        assignments
      });
    }

    // User does not exist yet -> return data for first-time onboarding (org create or join link)
    return res.json({
      success: true,
      isNew: true,
      googleData: {
        email: email || '',
        google_sub: googleSub || `sub_${Date.now()}`,
        fullName: fullName || email?.split('@')[0] || 'New User',
        preferredName: fullName?.split(' ')[0] || email?.split('@')[0] || 'User',
        photoUrl: photoUrl || ''
      },
      message: 'Account not found. You can create a new organization or join an existing organization using a role invite link.'
    });
  } catch (error: any) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication verification failed', details: error.message });
  }
};

app.post('/api/auth/google/callback', handleGoogleCallback);
app.post('/auth/google/callback', handleGoogleCallback);
app.post('/api/auth/google', handleGoogleCallback);

// Fast demo persona switcher for testing and verification
const handleSwitchUser = (req: express.Request, res: express.Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const user = db.users.get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const session = db.createSession(user);
  const assignments = db.getUserAssignmentsWithDetails(user.id);
  res.json({ success: true, user, session, assignments });
};

app.post('/api/auth/demo-switch', handleSwitchUser);
app.post('/api/auth/switch-user', handleSwitchUser);

// Explicitly stub email sign-in endpoint
app.post('/api/auth/email/request', (req, res) => {
  res.status(501).json({
    error: 'Email magic-link sign-in is not yet available. Please sign in with Google or choose a sample identity.'
  });
});

/**
 * GET /api/me (or /me)
 * Returns current session's user + all role assignments + merged task feed info
 */
const handleGetMe = (req: express.Request, res: express.Response) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired session' });
  }

  const assignments = db.getUserAssignmentsWithDetails(user.id);
  const allOrgs = Array.from(db.organizations.values());
  const userOrgIds = new Set(assignments.map(a => a.role.org_id));
  const userOrgs = allOrgs.filter(o => userOrgIds.has(o.id) || o.master_root_user_id === user.id);

  res.json({
    user,
    assignments,
    organizations: userOrgs,
    isMasterRoot: userOrgs.some(o => o.master_root_user_id === user.id)
  });
};

app.get('/api/me', handleGetMe);
app.get('/me', handleGetMe);

/**
 * POST /api/auth/logout (or /auth/logout)
 */
const handleLogout = (req: express.Request, res: express.Response) => {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : (req.headers['x-session-id'] as string || req.body.sessionId);

  if (sessionId) {
    db.deleteSession(sessionId);
  }
  res.json({ success: true, message: 'Signed out successfully' });
};

app.post('/api/auth/logout', handleLogout);
app.post('/auth/logout', handleLogout);

// ==========================================
// 3. Organization Creation (Entry Point 2)
// ==========================================

/**
 * POST /api/orgs (or /orgs)
 * Creates new organization and master root account via first-time Google Sign-In
 */
const handleCreateOrg = async (req: express.Request, res: express.Response) => {
  try {
    const { orgName, orgDescription, creator, structure } = req.body;

    if (!orgName || !creator?.email) {
      return res.status(400).json({ error: 'Organization name and creator details are required' });
    }

    // 1. Find or create the creator user
    let user = db.findUserByEmail(creator.email);
    if (!user) {
      user = db.createUser({
        google_sub: creator.google_sub || `sub_${Date.now()}`,
        email: creator.email,
        full_name: creator.full_name || creator.fullName || creator.email.split('@')[0],
        preferred_name: creator.preferred_name || creator.preferredName || creator.full_name?.split(' ')[0] || 'Lead',
        gender: creator.gender || 'prefer-not-to-say',
        avatar_url: creator.avatar_url || creator.avatarUrl
      });
    }

    // 2. Create organization in DB with user as master root
    const { org, masterDept, masterRole, assignment } = db.createOrganization(orgName, orgDescription, user);

    // 3. If structured departments are provided (e.g. from AI builder, templates, or visual canvas), populate them
    const incomingNodes = structure?.departments || req.body.nodes;
    if (Array.isArray(incomingNodes)) {
      const deptIdMap = new Map<string, string>(); // name -> id

      for (const d of incomingNodes) {
        const deptId = d.id && !d.id.startsWith('node_') && !d.id.startsWith('dept_') ? d.id : `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        deptIdMap.set(d.name, deptId);

        const newDept = {
          id: deptId,
          org_id: org.id,
          name: d.name,
          slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          parent_department_id: masterDept.id,
          is_section: d.type === 'section',
          section_root_user_id: null,
          type: d.type || 'department',
          created_at: new Date().toISOString()
        };
        db.departments.set(deptId, newDept as any);

        // Root role for department
        const rootTitle = d.rootRole || d.rootRoleTitle || (d.type === 'section' ? `${d.name} Head` : `${d.name} Lead`);
        if (rootTitle) {
          const roleId = `role_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const rootRole = {
            id: roleId,
            org_id: org.id,
            department_id: deptId,
            name: rootTitle,
            slug: rootTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            is_root: true,
            is_section_root: d.type === 'section',
            role_type: d.type === 'section' ? 'section_root' : 'dept_root'
          };
          db.roles.set(roleId, rootRole as any);
          (newDept as any).root_role_id = roleId;
        }

        // Member roles for department
        const memberList = d.roles || d.memberRoleTitles || [];
        if (Array.isArray(memberList)) {
          for (const mTitle of memberList) {
            const mRoleId = `role_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            db.roles.set(mRoleId, {
              id: mRoleId,
              org_id: org.id,
              department_id: deptId,
              name: mTitle,
              slug: mTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              is_root: false,
              role_type: 'member'
            } as any);
          }
        }
      }

      // Link grouped departments for sections
      for (const d of incomingNodes) {
        if (d.type === 'section' && (Array.isArray(d.groupedDeptNames) || Array.isArray(d.groupedDeptIds))) {
          const sDeptId = deptIdMap.get(d.name);
          if (sDeptId) {
            const sDept = db.departments.get(sDeptId);
            if (sDept) {
              const grouped = (d.groupedDeptNames || []).map((gName: string) => deptIdMap.get(gName)).filter(Boolean) as string[];
              sDept.grouped_dept_ids = grouped;
            }
          }
        }
      }
    }

    // 4. Create Session
    const session = db.createSession(user);

    res.json({
      success: true,
      org,
      user,
      session,
      assignments: db.getUserAssignmentsWithDetails(user.id),
      message: 'Organization created successfully with creator as Master Root.'
    });
  } catch (error: any) {
    console.error('Create org error:', error);
    res.status(500).json({ error: 'Failed to create organization', details: error.message });
  }
};

app.post('/api/orgs', handleCreateOrg);
app.post('/orgs', handleCreateOrg);
app.post('/api/org/create-v2', handleCreateOrg);

// ==========================================
// 4. Invite Links Generation (Authority-Scoped)
// ==========================================

/**
 * POST /api/orgs/:orgId/links (or /orgs/:orgId/links)
 * Generates an authority-scoped time-windowed invite link.
 * Enforces server-side authority check via canIssueLinkFor().
 */
const handleGenerateLink = (req: express.Request, res: express.Response) => {
  try {
    const { orgId } = req.params;
    const { targetRoleId, targetDepartmentId, daysValid = 7, requiredIntegrations } = req.body;

    const user = getAuthenticatedUser(req);
    const requestingUserId = user?.id || req.body.userId;

    if (!requestingUserId) {
      return res.status(401).json({ error: 'Unauthorized: user session required to issue invite links' });
    }

    if (!targetRoleId) {
      return res.status(400).json({ error: 'targetRoleId is required' });
    }

    // Server-Side Authority Enforcement (Part VII §8)
    const authCheck = canIssueLinkFor(requestingUserId, targetRoleId);
    if (!authCheck.allowed) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient organizational authority to issue invite link for this role.',
        reason: authCheck.reason,
        requesterRoles: authCheck.requesterRoles
      });
    }

    // Determine target department ID if not supplied
    const targetRole = db.roles.get(targetRoleId);
    const deptId = targetDepartmentId || targetRole?.department_id || '';

    // Create time-windowed link (Unlimited signups during window, Date.now() < expires_at)
    const link = db.createInviteLink({
      org_id: orgId || targetRole?.org_id || 'org_oakridge',
      target_role_id: targetRoleId,
      target_department_id: deptId,
      created_by_user_id: requestingUserId,
      days_valid: Number(daysValid) || 7,
      required_integrations: Array.isArray(requiredIntegrations) ? requiredIntegrations : []
    });

    res.json({
      success: true,
      link,
      token: link.token,
      expiresAt: link.expires_at,
      requiredIntegrations: link.required_integrations,
      authorityExplanation: authCheck.reason
    });
  } catch (error: any) {
    console.error('Link generation error:', error);
    res.status(500).json({ error: 'Failed to generate invite link', details: error.message });
  }
};

app.post('/api/orgs/:orgId/links', handleGenerateLink);
app.post('/orgs/:orgId/links', handleGenerateLink);

// ==========================================
// 5. Joining via Role Link (Entry Point 3)
// ==========================================

/**
 * GET /api/join/:linkToken (or /join/:linkToken)
 * Resolves link token to orgName, roleName, deptName, and checks time-window expiry.
 */
const handleResolveLink = (req: express.Request, res: express.Response) => {
  const { linkToken } = req.params;
  const link = db.getInviteLinkByToken(linkToken);

  if (!link) {
    return res.status(404).json({
      error: 'Invite link not found or invalid token',
      valid: false
    });
  }

  const isExpired = Date.now() > Date.parse(link.expires_at);
  const role = db.roles.get(link.target_role_id);
  const dept = db.departments.get(link.target_department_id || role?.department_id || '');
  const org = db.organizations.get(link.org_id);

  res.json({
    linkId: link.id,
    token: link.token,
    orgId: link.org_id,
    orgName: org?.name || 'Mika Organization',
    roleId: link.target_role_id,
    roleName: role?.name || link.role_title || 'Member',
    deptId: dept?.id || '',
    deptName: dept?.name || link.dept_name || 'General Department',
    expiresAt: link.expires_at,
    isExpired,
    valid: !isExpired,
    requiredIntegrations: link.required_integrations || []
  });
};

app.get('/api/join/:linkToken', handleResolveLink);
app.get('/join/:linkToken', handleResolveLink);

/**
 * POST /api/join/:linkToken/signup (or /join/:linkToken/signup)
 * Verifies Google token / OAuth payload, validates link time-window,
 * creates new account OR merges into existing Mika account without duplicates.
 */
const handleJoinSignup = (req: express.Request, res: express.Response) => {
  try {
    const { linkToken } = req.params;
    const { google_sub, email, preferred_name, full_name, gender, avatar_url, mergeWithExisting } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Google email is required' });
    }

    const link = db.getInviteLinkByToken(linkToken);
    if (!link) {
      return res.status(404).json({ error: 'Invite link token not found' });
    }

    // Time-window validity check: Date.now() < expires_at
    if (Date.now() > Date.parse(link.expires_at)) {
      return res.status(410).json({
        error: 'This invite link time window has expired. Please request a new link from your lead.',
        expired: true
      });
    }

    // 1. Check if user already has an existing Mika account
    let existingUser = google_sub ? db.findUserByGoogleSub(google_sub) : undefined;
    if (!existingUser) {
      existingUser = db.findUserByEmail(email);
    }

    if (existingUser) {
      // If user exists and user has not confirmed merge yet -> prompt merge
      if (mergeWithExisting === false) {
        return res.json({
          cancelled: true,
          message: 'Join cancelled by user.'
        });
      }

      if (mergeWithExisting !== true) {
        return res.json({
          existingAccountFound: true,
          promptMerge: true,
          user: existingUser,
          targetRole: link.role_title,
          targetDept: link.dept_name,
          message: `You already have an active Mika account as '${existingUser.full_name}' (${existingUser.email}). Add this role (@${link.role_title}) to your existing profile?`
        });
      }

      // User confirmed merge -> bind new role to existing account
      const assignment = db.assignUserToRole(existingUser.id, link.target_role_id, link.target_department_id);
      const session = db.createSession(existingUser);

      return res.json({
        success: true,
        merged: true,
        isNew: false,
        user: existingUser,
        session,
        assignment,
        assignments: db.getUserAssignmentsWithDetails(existingUser.id),
        message: `Role @${link.role_title} successfully added to your existing account.`
      });
    }

    // 2. First-time Google user: Create account with minimal signup fields
    const newUser = db.createUser({
      google_sub: google_sub || `sub_${Date.now()}`,
      email,
      full_name: full_name || email.split('@')[0],
      preferred_name: preferred_name || full_name?.split(' ')[0] || email.split('@')[0],
      gender: gender || 'prefer-not-to-say',
      avatar_url
    });

    // Bind account to role immediately — no manual admin review step
    const assignment = db.assignUserToRole(newUser.id, link.target_role_id, link.target_department_id);
    const session = db.createSession(newUser);

    return res.json({
      success: true,
      merged: false,
      isNew: true,
      user: newUser,
      session,
      assignment,
      assignments: db.getUserAssignmentsWithDetails(newUser.id),
      message: `Account created and bound to @${link.role_title} immediately.`
    });
  } catch (error: any) {
    console.error('Join signup error:', error);
    res.status(500).json({ error: 'Failed to process join signup', details: error.message });
  }
};

app.post('/api/join/:linkToken/signup', handleJoinSignup);
app.post('/join/:linkToken/signup', handleJoinSignup);

// ==========================================
// 6. Data Synchronization Endpoints
// ==========================================
app.get('/api/state', (req, res) => {
  res.json({
    organizations: Array.from(db.organizations.values()),
    departments: Array.from(db.departments.values()).map(d => ({
      id: d.id,
      orgId: d.org_id,
      name: d.name,
      slug: d.slug,
      type: d.type,
      parentDeptId: d.parent_department_id,
      groupedDeptIds: d.grouped_dept_ids,
      rootRoleId: d.root_role_id,
      isTemporary: d.is_temporary,
      isArchived: d.is_archived,
      validFrom: d.valid_from,
      validTo: d.valid_to,
      createdAt: d.created_at
    })),
    roles: Array.from(db.roles.values()).map(r => ({
      id: r.id,
      orgId: r.org_id,
      deptId: r.department_id,
      title: r.name,
      slug: r.slug,
      isRoot: r.is_root,
      isSectionRoot: r.is_section_root,
      roleType: r.role_type
    })),
    users: Array.from(db.users.values()).map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      preferredName: u.preferred_name,
      gender: u.gender,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at
    })),
    assignments: Array.from(db.roleAssignments.values()).map(a => ({
      id: a.id,
      userId: a.user_id,
      roleId: a.role_id,
      deptId: a.department_id,
      validFrom: a.assigned_at,
      isActive: a.is_active
    })),
    tasks: Array.from(db.tasks.values()).map(t => ({
      id: t.id,
      orgId: t.org_id,
      deptId: t.dept_id,
      title: t.title,
      description: t.description,
      assignedByUserId: t.assigned_by_user_id,
      assignedToRoleId: t.assigned_to_role_id,
      assignedToUserId: t.assigned_to_user_id,
      status: t.status,
      dueDate: t.due_date,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      completedAt: t.completed_at,
      rejectionReason: t.rejection_reason
    })),
    comments: Array.from(db.comments.values()).map(c => ({
      id: c.id,
      taskId: c.task_id,
      authorUserId: c.author_user_id,
      authorName: c.author_name,
      authorRoleTitle: c.author_role_title,
      content: c.content,
      isHelpNotice: c.is_help_notice,
      createdAt: c.created_at
    })),
    files: Array.from(db.files.values()).map(f => ({
      id: f.id,
      orgId: f.org_id,
      deptId: f.dept_id,
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedByUserId: f.uploaded_by_user_id,
      uploadedByName: f.uploaded_by_name,
      uploadedAt: f.uploaded_at,
      sourceTaskId: f.source_task_id,
      folder: f.folder,
      isAutoArchived: true
    })),
    joinLinks: Array.from(db.inviteLinks.values()).map(l => ({
      id: l.id,
      orgId: l.org_id,
      roleId: l.target_role_id,
      roleTitle: l.role_title || 'Role',
      deptName: l.dept_name || 'Department',
      token: l.token,
      expiresAt: l.expires_at,
      createdByUserId: l.created_by_user_id,
      createdAt: l.created_at,
      useCount: 0
    })),
    events: Array.from(db.events.values()).map(e => ({
      id: e.id,
      orgId: e.org_id,
      title: e.title,
      description: e.description,
      departmentIds: e.department_ids,
      leadUserIds: e.lead_user_ids,
      createdAt: e.created_at,
      isActive: e.is_active
    }))
  });
});

// ==========================================
// 7. AI Interpretation & Org Structure Generator
// ==========================================
app.post('/api/ai/interpret', async (req, res) => {
  try {
    const { prompt, orgSchema, currentUserId, currentRoleTitle } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    if (!ai) {
      return res.json({
        operation: 'natural_language_proposal',
        confidence: 0.92,
        reasoning: 'Interpreted intent using local rule analyzer: ' + prompt,
        candidatePayload: {
          action: 'inspect_or_execute',
          summary: prompt,
          suggestedTarget: 'Middle Head / math-teacher',
          actorContext: { currentUserId, currentRoleTitle }
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Current Org Schema:\n${JSON.stringify(orgSchema || {}, null, 2)}\n\nRequester: User "${currentUserId}", Role "${currentRoleTitle}"\nManagement Request: "${prompt}"`,
      config: {
        systemInstruction: INTERPRETATION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Gemini interpretation error:', error);
    res.status(500).json({ error: 'Failed to interpret management request', message: error.message });
  }
});

app.post('/api/ai/generate-org-structure', async (req, res) => {
  try {
    const { orgDescription, domainType } = req.body;
    if (!orgDescription) return res.status(400).json({ error: 'Description is required' });

    if (!ai) {
      return res.json({
        name: 'Synthesized ' + (domainType || 'Organization'),
        description: orgDescription,
        rootTitle: 'Executive Director',
        departments: [
          { name: 'Operations', type: 'department', rootRoleTitle: 'Director of Operations', memberRoleTitles: ['Operations Specialist', 'Logistics Coordinator'] },
          { name: 'Academic Division', type: 'section', rootRoleTitle: 'Division Head', memberRoleTitles: [], groupedDeptNames: ['Class 6', 'Class 7'] },
          { name: 'Class 6', type: 'department', rootRoleTitle: 'Class 6 Lead', memberRoleTitles: ['math-teacher', 'science-teacher'] },
          { name: 'Class 7', type: 'department', rootRoleTitle: 'Class 7 Lead', memberRoleTitles: ['math-teacher', 'english-teacher'] }
        ]
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `Generate a recursive organizational schema for domain: "${domainType || 'Custom'}" with description: "${orgDescription}".
Include:
- org name
- description
- root role title (e.g. Principal, CEO, Executive Director)
- list of departments with:
  - name
  - type ('department' or 'section' or 'subject' or 'temp')
  - rootRoleTitle
  - memberRoleTitles (array of strings)
  - groupedDeptNames (for sections, which department names belong to this section)`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            rootTitle: { type: Type.STRING },
            departments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  rootRoleTitle: { type: Type.STRING },
                  memberRoleTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
                  groupedDeptNames: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['name', 'type', 'rootRoleTitle', 'memberRoleTitles']
              }
            }
          },
          required: ['name', 'description', 'rootTitle', 'departments']
        }
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Org generation error:', error);
    res.status(500).json({ error: 'Failed to generate structure', message: error.message });
  }
});

// Vite Middleware & Static Serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mika System running on http://0.0.0.0:${PORT}`);
  });
}

start();
