import React, { useState, useMemo, useEffect } from 'react';
import { 
  User, 
  Role, 
  Department, 
  Assignment, 
  Task, 
  Comment, 
  FileItem, 
  JoinLink, 
  EventBinding,
  TaskStatus,
  OrgNotification,
  Meeting,
  Organization,
  OrgIntegrations,
  TaskMention
} from './types';
import { AuthorizationEngine } from './lib/authorizationEngine';
import { 
  isUserLead, 
  canCreateTask, 
  getUserContexts, 
  hasSuperiors as checkHasSuperiors, 
  isRoleRoot 
} from './lib/orgRules';
import { TaskFeed } from './components/TaskFeed';
import { TaskFullPageView } from './components/TaskFullPageView';
import { MeetingsView } from './components/MeetingsView';
import { StaffList } from './components/StaffList';
import { FileVault } from './components/FileVault';
import { ChatPanel } from './components/ChatPanel';
import { CreateTaskModal } from './components/CreateTaskModal';
import { RoleLinkJoinView } from './components/RoleLinkJoinView';
import { LandingPage } from './components/landing/LandingPage';
import { SignInView } from './components/auth/SignInView';
import { CreateOrgFlow } from './components/auth/CreateOrgFlow';
import { SettingsView } from './components/SettingsView';
import { AppSidebar, SidebarTab } from './components/layout/AppSidebar';
import { RolesDashboard } from './components/RolesDashboard';
import { DashboardView } from './components/DashboardView';
import { InvitationsView } from './components/InvitationsView';
import { PersonProfileModal } from './components/PersonProfileModal';
import { AdminSection } from './components/AdminSection';
import {
  subscribeKind,
  subscribeJoinLinks,
  subscribeUserCompliance,
  startOrgSync,
  stopOrgSync,
  orgSync,
  putDoc,
  removeDoc,
  uploadFileBlob,
  upsertTask,
  upsertComment,
  upsertNotification,
  upsertMeeting,
  upsertUserCompliance,
} from './lib/cloudStore';
import { api, getToken, getStoredOrgId, setStoredOrgId, setToken, UNAUTHORIZED_EVENT } from './lib/api';
import { logout, type AuthResult } from './lib/auth';
import { ApiError } from './lib/api';
import { notify } from './lib/dialogService';
import { IntegrationConnection, UserIntegrationCompliance } from './types';
import { Settings as SettingsIcon, User as UserIcon, LogOut, ChevronDown, Menu } from 'lucide-react';
import { syncToGoogleCalendar } from './lib/workspace';

import confetti from 'canvas-confetti';

export default function App() {
  // Check URL query parameters for ?join=TOKEN
  const [activeJoinToken, setActiveJoinToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || null;
  });

  // The signed-in account (from the Worker) and the organisation it is working in.
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [booting, setBooting] = useState<boolean>(() => !!getToken());
  const [bootError, setBootError] = useState<string | null>(null);
  const [myOrgs, setMyOrgs] = useState<Organization[]>([]);

  // Everything below is mirrored from the Worker (D1) by the store in lib/cloudStore.ts.
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [joinLinks, setJoinLinks] = useState<JoinLink[]>([]);
  const [events, setEvents] = useState<EventBinding[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<OrgNotification[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);

  const handleUpdateIntegrations = (newIntegrations: OrgIntegrations) => {
    if (!organization) return;
    const before = organization;
    setOrganization({ ...organization, integrations: newIntegrations });
    api<{ org: Organization }>(`/api/orgs/${organization.id}`, { method: 'PATCH', body: { integrations: newIntegrations } })
      .then(({ org }) => setOrganization(org))
      .catch(e => { setOrganization(before); notify(e?.message || 'Could not save the integration settings.', 'error'); });
  };

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [authView, setAuthView] = useState<'landing' | 'signin' | 'create-org'>('landing');
  const [createOrgPrefillGoogle, setCreateOrgPrefillGoogle] = useState<any | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Phones get a top bar + slide-over navigation drawer instead of a permanent sidebar.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileNavOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Live Integrations & Compliance State
  const [integrationConnections, setIntegrationConnections] = useState<IntegrationConnection[]>([]);
  const [userCompliances, setUserCompliances] = useState<UserIntegrationCompliance[]>([]);

  // ---- Boot: restore the session, then open the organisation --------------------------------
  const enterOrg = async (orgId: string) => {
    const org = await startOrgSync(orgId);
    setOrganization(org);
    setStoredOrgId(orgId);
  };

  const applyAuth = async (user: User, orgs: Organization[]) => {
    setAuthUser(user);
    setCurrentUserId(user.id);
    setMyOrgs(orgs);
    const wanted = getStoredOrgId();
    const target = orgs.find(o => o.id === wanted) || orgs[0];
    if (target) await enterOrg(target.id);
  };

  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    let cancelled = false;
    api<{ user: User; orgs: Organization[] }>('/api/me')
      .then(({ user, orgs }) => applyAuth(user, orgs))
      .catch(e => {
        if (cancelled) return;
        if (!(e instanceof ApiError && e.status === 401)) setBootError(e?.message || 'Could not reach Mika.');
      })
      .finally(() => { if (!cancelled) setBooting(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The server dropped our session (expired, signed out elsewhere): go back to sign in.
  useEffect(() => {
    const onUnauthorized = () => resetToSignedOut();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  });

  // Mirror the organisation's data into React state while one is open.
  useEffect(() => {
    if (!organization?.id) return;
    const unsubs = [
      subscribeKind<Department>('department', setDepartments),
      subscribeKind<Role>('role', setRoles),
      subscribeKind<User>('user', setUsers),
      subscribeKind<Assignment>('assignment', setAssignments),
      subscribeKind<Task>('task', setTasks),
      subscribeKind<Comment>('comment', setComments),
      subscribeKind<Meeting>('meeting', setMeetings),
      subscribeKind<FileItem>('file', setFiles),
      subscribeKind<OrgNotification>('notification', setNotifications),
      subscribeKind<EventBinding>('event', setEvents),
      subscribeKind<IntegrationConnection>('connection', setIntegrationConnections),
      subscribeJoinLinks(setJoinLinks),
    ];
    return () => unsubs.forEach(u => u());
  }, [organization?.id]);

  useEffect(() => {
    if (!currentUserId || !organization?.id) return;
    return subscribeUserCompliance(currentUserId, setUserCompliances);
  }, [currentUserId, organization?.id]);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find(u => u.id === currentUserId) || (authUser?.id === currentUserId ? authUser : null);
  }, [users, currentUserId, authUser]);

  // The organisation root is recorded on the org itself.
  const masterRootUser = useMemo(
    () => users.find(u => u.id === organization?.masterRootUserId),
    [users, organization?.masterRootUserId]
  );

  // Instantiate Authorization Engine
  const authEngine = useMemo(() => {
    return new AuthorizationEngine(
      departments,
      roles,
      users,
      assignments,
      masterRootUser?.id || organization?.masterRootUserId || ''
    );
  }, [departments, roles, users, assignments, masterRootUser]);

  // Check if current user holds any lead / root / admin role
  const isCurrentUserLead = useMemo(() => {
    if (!currentUser) return false;
    return isUserLead(currentUser.id, assignments, roles, departments, masterRootUser?.id);
  }, [assignments, currentUser, roles, departments, masterRootUser]);

  // Only a department root or section root can create/assign tasks (strictly enforced via orgRules)
  const canCreateTasks = useMemo(() => {
    if (!currentUser) return false;
    return canCreateTask(currentUser.id, undefined, assignments, roles, departments, masterRootUser?.id);
  }, [assignments, currentUser, roles, departments, masterRootUser]);

  // Active roles held by current user
  const currentUserRoles = useMemo(() => {
    if (!currentUser) return [];
    return getUserContexts(currentUser.id, departments, roles, assignments);
  }, [assignments, currentUser, roles, departments]);

  // Check if any active user in the organization holds authority over currentUser
  const hasSuperiors = useMemo(() => {
    if (!currentUser) return false;
    return checkHasSuperiors(currentUser.id, assignments, roles, departments, masterRootUser?.id);
  }, [currentUser, assignments, roles, departments, masterRootUser]);

  // The Task Feed is for anyone who can receive tasks (has superiors) or send them (can create tasks).
  // A role with neither has nothing to do there.
  const canUseTaskFeed = hasSuperiors || canCreateTasks;
  useEffect(() => {
    if (!canUseTaskFeed && activeTab === 'tasks') {
      setActiveTab('dashboard');
    }
  }, [canUseTaskFeed, activeTab]);

  // Invitations, Settings and Administration are for people with authority over others.
  useEffect(() => {
    if (!isCurrentUserLead && (activeTab === 'invites' || activeTab === 'settings' || activeTab === 'admin')) {
      setActiveTab('dashboard');
    }
  }, [isCurrentUserLead, activeTab]);

  // Reset selected task when switching tabs
  const handleSelectTab = (tab: SidebarTab) => {
    setSelectedTaskId(null);
    setActiveTab(tab);
  };

  // Tasks relevant to current user:
  const visibleTasks = useMemo(() => {
    if (!currentUser || !canUseTaskFeed) return [];
    return tasks.filter(t => {
      // Direct assignment, or tasks this user sent
      if (t.assignedToUserId === currentUser.id) return true;
      if (t.assignedByUserId === currentUser.id) return true;
      // If master root or lead, include subordinate tasks
      if (isCurrentUserLead) return true;
      return false;
    });
  }, [tasks, currentUser, canUseTaskFeed, isCurrentUserLead]);

  // Check authority to review / reject / approve a given task
  const checkAuthorityOverTask = (task: Task): boolean => {
    if (!currentUser) return false;
    if (currentUser.id === masterRootUser?.id) return true;
    const taskCreatorOrLeadCheck = authEngine.checkAuthority(currentUser.id, task.assignedToUserId);
    return taskCreatorOrLeadCheck.hasAuthority;
  };

  // After Google sign-in (or a join / org creation) the Worker hands back the account and its orgs.
  const handleSignedIn = async (result: AuthResult) => {
    setBootError(null);
    try {
      await applyAuth(result.user, result.orgs);
      setActiveTab('dashboard');
    } catch (e: any) {
      setBootError(e?.message || 'Could not open your organisation.');
    }
  };

  const resetToSignedOut = () => {
    stopOrgSync();
    setToken(null);
    setStoredOrgId(null);
    setAuthUser(null);
    setCurrentUserId(null);
    setOrganization(null);
    setMyOrgs([]);
    setDepartments([]); setRoles([]); setUsers([]); setAssignments([]); setTasks([]);
    setComments([]); setFiles([]); setJoinLinks([]); setEvents([]); setMeetings([]);
    setNotifications([]); setIntegrationConnections([]); setUserCompliances([]);
    setAuthView('landing');
    setActiveTab('dashboard');
    setSelectedTaskId(null);
    setShowUserDropdown(false);
  };

  const handleSignOut = async () => {
    await logout();
    resetToSignedOut();
  };

  // The person just created an organisation.
  const handleOrgCreated = async (result: { org: Organization; user: User; session: { token: string } }) => {
    setToken(result.session.token);
    await handleSignedIn({ user: result.user, orgs: [result.org], isNew: false, session: result.session as any });
  };

  // The person just accepted an invite link.
  const handleRoleLinkJoinSuccess = async (result: { user: User; orgId: string; session: { token: string } }) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.pathname);
    setActiveJoinToken(null);
    setToken(result.session.token);
    setStoredOrgId(result.orgId);
    const me = await api<{ user: User; orgs: Organization[] }>('/api/me');
    await applyAuth(me.user, me.orgs);
    setActiveTab('dashboard');
  };

  // Handlers for Task Lifecycle (Part B7 & B8). The Worker enforces who may do what; the UI
  // updates optimistically and rolls back with an explanation if a move is refused.
  const orgIdNow = organization?.id || '';
  const notifyUser = (userId: string | undefined, type: OrgNotification['type'], title: string, message: string, taskId: string) => {
    if (!userId || userId === currentUser?.id) return;
    upsertNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orgId: orgIdNow, userId, title, message, type, read: false,
      createdAt: new Date().toISOString(), relatedTaskId: taskId, metadata: { taskId },
    }).catch(() => {});
  };

  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus, reason?: string, extra?: Partial<Task>) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const updated: Task = { ...targetTask, ...extra, status: newStatus, updatedAt: new Date().toISOString() };
    if (newStatus === 'done') {
      updated.completedAt = new Date().toISOString();
      updated.rejectionReason = undefined;
    } else if (newStatus === 'rejected') {
      updated.rejectionReason = reason;
    } else if (newStatus === 'pending') {
      updated.rejectionReason = undefined;
    }

    upsertTask(updated).then(() => {
      const who = currentUser?.fullName || 'Someone';
      if (newStatus === 'submitted') notifyUser(targetTask.assignedByUserId, 'task_submitted', 'Task submitted for review', `"${targetTask.title}" was submitted by ${who} and is waiting for your review.`, taskId);
      if (newStatus === 'help') notifyUser(targetTask.assignedByUserId, 'help_requested', 'Help requested', `${who} needs help with "${targetTask.title}".`, taskId);
      if (newStatus === 'rejected') notifyUser(targetTask.assignedToUserId, 'task_rejected', 'Task sent back', `"${targetTask.title}" was sent back${reason ? `: ${reason}` : '.'}`, taskId);
    }).catch(() => {});
  };

  const handleAddComment = (taskId: string, content: string, isHelp?: boolean) => {
    if (!currentUser) return;
    const newComment: Comment = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      taskId,
      authorUserId: currentUser.id,
      authorName: currentUser.fullName,
      authorRoleTitle: currentUserRoles[0]?.role?.title || 'Staff',
      content,
      isHelpNotice: !!isHelp,
      createdAt: new Date().toISOString()
    };
    upsertComment(newComment).then(() => {
      if (isHelp) handleTaskStatusChange(taskId, 'help');
    }).catch(() => {});
  };

  // Uploads the real file to Mika storage, then submits the task with it attached.
  const handleFileUpload = async (taskId: string, file: File) => {
    if (!currentUser) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      const stored = await uploadFileBlob(file, { deptId: task.deptId, folder: 'Task Submissions', sourceTaskId: taskId });
      const updated: Task = {
        ...task,
        status: 'submitted',
        confirmationFile: { id: stored.id, name: stored.name, size: stored.size, url: stored.url || '', type: stored.type },
        updatedAt: new Date().toISOString(),
      };
      await upsertTask(updated);
      notifyUser(task.assignedByUserId, 'task_submitted', 'Task submitted for review', `"${task.title}" was submitted by ${currentUser.fullName} and is waiting for your review.`, taskId);
      confetti({ particleCount: 40, spread: 60 });
    } catch { /* store already told the person why */ }
  };

  const handleRateTask = (taskId: string, score: number, comment: string, isAnonymous: boolean) => {
    if (!currentUser) return;
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;
    upsertTask({
      ...target,
      rating: { score, comment, ratedByUserId: currentUser.id, isAnonymous, ratedAt: new Date().toISOString() },
      updatedAt: new Date().toISOString(),
    }).then(() => confetti({ particleCount: 30, spread: 50 })).catch(() => {});
  };

  // Task Creation Handler (Part A2, B4, B5)
  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    deptId: string;
    targetRoleId: string;
    assignedToUserId: string;
    dueDate?: string;
    requiresFileUpload?: boolean;
    confirmationMode?: 'yes_no' | 'file_upload' | 'file';
    referenceFile?: { name: string; url: string; size?: string; type?: string };
    syncToCalendar?: boolean;
    mentions?: TaskMention[];
  }) => {
    if (!currentUser) return;
    const newTask: Task = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orgId: orgIdNow,
      deptId: taskData.deptId,
      title: taskData.title,
      description: taskData.description,
      assignedByUserId: currentUser.id,
      assignedToRoleId: taskData.targetRoleId,
      assignedToUserId: taskData.assignedToUserId,
      status: 'pending',
      dueDate: taskData.dueDate,
      confirmationMode: taskData.confirmationMode === 'file' ? 'file_upload' : (taskData.confirmationMode || (taskData.requiresFileUpload ? 'file_upload' : 'yes_no')),
      mentions: taskData.mentions,
      referenceFile: taskData.referenceFile
        ? {
            id: `ref_${Date.now()}`,
            name: taskData.referenceFile.name,
            url: taskData.referenceFile.url,
            size: taskData.referenceFile.size || 'Attachment',
            type: taskData.referenceFile.type || 'application/octet-stream',
          }
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Part A2: Sync task deadline to Google Calendar if requested
    if (taskData.dueDate && taskData.syncToCalendar) {
      try {
        const calResult = await syncToGoogleCalendar({
          title: `[Mika] ${taskData.title}`,
          description: taskData.description,
          dueDate: taskData.dueDate
        });
        newTask.calendarEventId = calResult.eventId;
        newTask.isCalendarSynced = true;
      } catch (calErr) {
        console.warn('Task calendar sync warning:', calErr);
      }
    }

    try {
      await upsertTask(newTask);
    } catch {
      return; // the store explained why; keep the form open so nothing is lost
    }
    notifyUser(newTask.assignedToUserId, 'task_assigned', 'New task', `${currentUser.fullName} assigned you "${newTask.title}".`, newTask.id);
    setShowCreateTaskModal(false);
    confetti({ particleCount: 35, spread: 55 });
  };

  // Admin Department & Role Management Handlers (the Worker only lets leads do these)
  const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const handleCreateDepartment = (deptData: Partial<Department>) => {
    const name = deptData.name || 'New Department';
    const dept: Department = {
      id: deptData.id || newId('dept'),
      orgId: orgIdNow,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      type: deptData.type || 'department',
      parentDeptId: deptData.parentDeptId || undefined,
      isTemporary: deptData.isTemporary,
      validFrom: deptData.validFrom,
      validTo: deptData.validTo,
      isArchived: false,
      createdAt: new Date().toISOString()
    };
    putDoc('department', dept, 'create the department').then(() => confetti({ particleCount: 30, spread: 50 })).catch(() => {});
  };

  const handleCreateRole = (roleData: Partial<Role>) => {
    const title = roleData.title || 'New Role';
    const role: Role = {
      id: roleData.id || newId('role'),
      orgId: orgIdNow,
      deptId: roleData.deptId || departments[0]?.id || '',
      title,
      slug: roleData.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      isRoot: roleData.isRoot || false,
      roleType: roleData.roleType || 'member'
    };
    putDoc('role', role, 'create the role').then(() => confetti({ particleCount: 30, spread: 50 })).catch(() => {});
  };

  const handleCreateEvent = (title: string, description: string, deptIds: string[]) => {
    if (!currentUser) return;
    const evt: EventBinding = {
      id: newId('evt'),
      orgId: orgIdNow,
      title,
      description,
      departmentIds: deptIds,
      leadUserIds: [currentUser.id],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    putDoc('event', evt, 'create the event').then(() => confetti({ particleCount: 30, spread: 50 })).catch(() => {});
  };

  const handleArchiveTempDept = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    if (dept) putDoc('department', { ...dept, isArchived: true }, 'archive the department').catch(() => {});
  };

  const handleRemoveMember = (assignmentId: string) => {
    removeDoc('assignment', assignmentId, 'remove this person from their role').catch(() => {});
  };

  // Link Generation: the Worker checks you have authority over the role before issuing it.
  const handleGenerateJoinLink = async (roleId: string, roleTitle: string, deptName: string, daysValid: number, requiredIntegrations?: string[]): Promise<JoinLink> => {
    if (!currentUser || !organization) throw new Error('You must be signed in to generate invite links.');
    const data = await api<{ link: JoinLink }>(`/api/orgs/${organization.id}/links`, {
      method: 'POST',
      body: { targetRoleId: roleId, daysValid, requiredIntegrations: requiredIntegrations || [] },
    });
    orgSync.pollNow();
    return { ...data.link, roleTitle: data.link.roleTitle || roleTitle, deptName: data.link.deptName || deptName };
  };

  // =========================================================================
  // VIEW ROUTING
  // =========================================================================

  if (booting) {
    return (
      <div className="h-screen w-screen bg-paper flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-xs font-mono text-ink-3">Opening Mika…</p>
        </div>
      </div>
    );
  }

  // 1. If accessed via ?join=TOKEN, show the RoleLinkJoinView directly
  if (activeJoinToken) {
    return (
      <RoleLinkJoinView
        token={activeJoinToken}
        onJoinSuccess={handleRoleLinkJoinSuccess}
        onCancel={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('join');
          window.history.replaceState({}, '', url.pathname);
          setActiveJoinToken(null);
        }}
      />
    );
  }

  // 2. Not signed in, or signed in but not part of an organisation yet: landing, sign-in, create-org.
  if (!currentUser || !organization) {
    if (bootError) {
      return (
        <div className="h-screen w-screen bg-paper flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-4">
            <h1 className="text-lg font-bold text-ink">We couldn't open Mika</h1>
            <p className="text-sm text-ink-3">{bootError}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-accent text-white text-sm rounded-xs cursor-pointer">Try again</button>
          </div>
        </div>
      );
    }

    if (authView === 'landing') {
      return (
        <LandingPage
          onNavigateToSignIn={() => setAuthView('signin')}
          onNavigateToCreateOrg={() => setAuthView('create-org')}
          onOpenJoinToken={token => setActiveJoinToken(token)}
        />
      );
    }

    if (authView === 'signin') {
      return (
        <SignInView
          onBackToLanding={() => setAuthView('landing')}
          onNavigateToCreateOrg={() => setAuthView('create-org')}
          onSignedIn={handleSignedIn}
          onNoOrganisation={result => { setAuthUser(result.user); }}
        />
      );
    }

    return (
      <CreateOrgFlow
        initialGoogleAccount={authUser ? { email: authUser.email, fullName: authUser.fullName, preferredName: authUser.preferredName, photoUrl: authUser.avatarUrl } : null}
        onBackToLanding={() => setAuthView('landing')}
        onNavigateToSignIn={() => setAuthView('signin')}
        onCreationComplete={handleOrgCreated}
      />
    );
  }

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // 3. User IS authenticated -> Render Main Application
  return (
    <div className="h-screen w-screen bg-paper text-ink flex antialiased relative overflow-hidden font-sans">
      {/* Sidebar: persistent on desktop, slide-over drawer on phones */}
      {isMobile && mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      )}
      <div
        id="mobile-navigation"
        className={isMobile
          ? `fixed inset-y-0 left-0 z-50 flex transition-transform duration-200 ease-out ${mobileNavOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`
          : 'contents'}
        inert={isMobile && !mobileNavOpen}
      >
      <AppSidebar
        currentUser={currentUser}
        currentUserRoles={currentUserRoles}
        masterRootUserId={masterRootUser?.id}
        activeTab={activeTab}
        setActiveTab={tab => { handleSelectTab(tab); setMobileNavOpen(false); }}
        isCurrentUserLead={isCurrentUserLead}
        hasSuperiors={canUseTaskFeed}
        isCollapsed={isMobile ? false : isSidebarCollapsed}
        setIsCollapsed={collapsed => (isMobile ? setMobileNavOpen(false) : setIsSidebarCollapsed(collapsed))}
        taskCount={visibleTasks.length}
        onSignOut={handleSignOut}
        onCreateTaskClick={() => setShowCreateTaskModal(true)}
        onViewProfile={u => setViewingProfileUser(u)}
        orgName={organization?.name || ""}
        orgs={myOrgs}
        currentOrgId={organization?.id}
        onSwitchOrg={id => { setStoredOrgId(id); window.location.reload(); }}
      />
      </div>

      {/* Main Content Stage */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 bg-paper">
        {/* Top Header Bar with active breadcrumb & Top-Right Avatar Entry Point */}
        <header className="h-14 bg-surface border-b border-hairline px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && (
              <button
                ref={menuButtonRef}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-navigation"
                className="-ml-2 w-11 h-11 flex items-center justify-center rounded-xs text-ink-2 hover:bg-paper-sunken cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <span className="hidden sm:inline text-[13px] text-ink-3 truncate">
              {organization?.name || 'Oakridge Academy'}
            </span>
            <span className="hidden sm:inline text-edge" aria-hidden="true">/</span>
            <h1 className="text-[15px] font-semibold text-ink truncate">
              {({ dashboard: 'Dashboard', tasks: 'Task Feed', team: 'Staff Directory', files: 'File Vault', chat: 'Messages', invites: 'Invitations', meetings: 'Meetings', admin: 'Administration', settings: 'Settings' } as Record<string, string>)[activeTab] || activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Settings Shortcut */}
            <button aria-label="Settings & Integrations"
              id="topbar-settings-button"
              onClick={() => setActiveTab('settings')}
              className={`hidden sm:inline-flex p-2 rounded-xs border transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-accent text-white border-accent'
                  : 'text-ink-2 hover:text-ink hover:bg-paper border-hairline'
              }`}
              title="Settings & Integrations"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            {/* Top-Right Avatar Entry Point */}
            <div className="relative">
              <button aria-label="Account Menu"
                id="topbar-user-avatar-button"
                onClick={() => setShowUserDropdown(prev => !prev)}
                className="flex items-center gap-2 p-1.5 rounded-xs hover:bg-paper border border-hairline transition-colors cursor-pointer"
                title="Account Menu"
              >
                <div className="w-7 h-7 rounded-xs bg-accent text-white flex items-center justify-center font-semibold text-xs shadow-2xs">
                  {currentUser.preferredName?.[0] || currentUser.fullName?.[0] || 'U'}
                </div>
                <span className="text-xs font-semibold text-ink hidden sm:inline max-w-[120px] truncate">
                  {currentUser.preferredName || currentUser.fullName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-hairline shadow-lg rounded-xs py-1.5 z-50 font-mono text-xs animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-hairline bg-paper">
                    <div className="font-bold text-ink truncate">{currentUser.fullName}</div>
                    <div className="text-[11px] text-ink-2 truncate">{currentUser.email}</div>
                  </div>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setViewingProfileUser(currentUser);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-paper text-ink flex items-center gap-2 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-ink-3" />
                    <span>View Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setActiveTab('settings');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-paper text-ink flex items-center gap-2 cursor-pointer"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-ink-3" />
                    <span>Settings & Integrations</span>
                  </button>

                  <div className="border-t border-hairline my-1" />

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[#FFF5F5] text-st-pending flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-st-pending" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Part B1: Full-Page Task View Takes Over When Task is Selected */}
          {selectedTask ? (
            <TaskFullPageView
              task={selectedTask}
              currentUser={currentUser}
              allUsers={users}
              allRoles={roles}
              allDepts={departments}
              comments={comments}
              hasAuthorityToReview={checkAuthorityOverTask(selectedTask)}
              onBack={() => setSelectedTaskId(null)}
              onStatusChange={handleTaskStatusChange}
              onAddComment={handleAddComment}
              onFileUpload={handleFileUpload}
              onRateTask={handleRateTask}
              onViewProfile={u => setViewingProfileUser(u)}
              onUpdateTask={(updatedTask) => {
                setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
                upsertTask(updatedTask).catch(console.warn);
              }}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  currentUser={currentUser}
                  allUsers={users}
                  allRoles={roles}
                  allDepts={departments}
                  assignments={assignments}
                  tasks={visibleTasks}
                  notifications={notifications.filter(n => !currentUser || n.userId === currentUser.id)}
                  onOpenTask={(id: string) => { setActiveTab('tasks'); setSelectedTaskId(id); }}
                  orgName={organization?.name || ""}
                  onClearNotification={(id) => {
                    setNotifications(prev => prev.filter(n => n.id !== id));
                  }}
                  onMarkAllRead={() => {
                    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                  }}
                  onNavigateToTab={(tab: any) => handleSelectTab(tab)}
                  onViewProfile={u => setViewingProfileUser(u)}
                />
              )}

              {activeTab === 'team' && (
                <RolesDashboard
                  currentUser={currentUser}
                  allRoles={roles}
                  allDepts={departments}
                  allUsers={users}
                  assignments={assignments}
                  joinLinks={joinLinks}
                  masterRootUserId={masterRootUser?.id}
                  onGenerateInviteLink={(roleId, deptId) => {
                    handleSelectTab('invites');
                  }}
                  onViewProfile={u => setViewingProfileUser(u)}
                />
              )}

              {activeTab === 'tasks' && (
                <TaskFeed
                  currentUser={currentUser}
                  tasks={visibleTasks}
                  allUsers={users}
                  allRoles={roles}
                  allDepts={departments}
                  comments={comments}
                  isCurrentUserLead={isCurrentUserLead}
                  canCreateTasks={canCreateTasks}
                  checkAuthorityOverTask={checkAuthorityOverTask}
                  canReviewTask={checkAuthorityOverTask}
                  onSelectTask={task => setSelectedTaskId(task.id)}
                  onStatusChange={handleTaskStatusChange}
                  onAddComment={handleAddComment}
                  onFileUpload={handleFileUpload}
                  onRateTask={handleRateTask}
                  onOpenCreateTaskModal={() => setShowCreateTaskModal(true)}
                  onCreateTaskClick={() => setShowCreateTaskModal(true)}
                  onViewProfile={u => setViewingProfileUser(u)}
                />
              )}

              {/* Part A6: Meetings View */}
              {activeTab === 'meetings' && (
                <MeetingsView
                  currentUser={currentUser}
                  allUsers={users}
                  allRoles={roles}
                  allDepts={departments}
                  assignments={assignments}
                  meetings={meetings}
                  masterRootUserId={masterRootUser?.id}
                  onMeetingCreated={(newMeeting) => {
                    setMeetings(prev => [newMeeting, ...prev]);
                    confetti({ particleCount: 35, spread: 50 });
                  }}
                  onMeetingEnded={(meetingId) => {
                    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, isActive: false, endTime: new Date().toISOString() } : m));
                  }}
                />
              )}

              {/* Part A1: File Vault */}
              {activeTab === 'files' && (
                <FileVault
                  currentUser={currentUser}
                  files={files}
                  departments={departments}
                  allDepts={departments}
                  tasks={tasks}
                />
              )}

              {/* Part A5: Chat Panel */}
              {activeTab === 'chat' && (
                <ChatPanel
                  currentUser={currentUser}
                  allUsers={users}
                  allDepts={departments}
                  allRoles={roles}
                  assignments={assignments}
                  onViewProfile={u => setViewingProfileUser(u)}
                  initialTargetUserId={chatTargetUserId}
                />
              )}

              {activeTab === 'invites' && (
                <InvitationsView
                  currentUser={currentUser}
                  allDepts={departments}
                  allRoles={roles}
                  allUsers={users}
                  assignments={assignments}
                  joinLinks={joinLinks}
                  onGenerateJoinLink={handleGenerateJoinLink}
                />
              )}

              {activeTab === 'admin' && (
                <AdminSection
                  currentUser={currentUser}
                  allDepts={departments}
                  allRoles={roles}
                  allUsers={users}
                  assignments={assignments}
                  joinLinks={joinLinks}
                  events={events}
                  organization={organization}
                  onUpdateIntegrations={handleUpdateIntegrations}
                  onCreateDepartment={handleCreateDepartment}
                  onCreateRole={handleCreateRole}
                  onGenerateJoinLink={handleGenerateJoinLink}
                  onCreateEvent={handleCreateEvent}
                  onArchiveTempDept={handleArchiveTempDept}
                  onRemoveMember={handleRemoveMember}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  currentUser={currentUser}
                  currentOrg={organization}
                  roles={roles}
                  departments={departments}
                  assignments={assignments}
                  allUsers={users}
                  connections={integrationConnections}
                  userCompliances={userCompliances}
                  onClose={() => setActiveTab('dashboard')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Assign / Create Task Modal */}
      {showCreateTaskModal && (
        <CreateTaskModal
          currentUser={currentUser}
          allDepts={departments}
          allRoles={roles}
          allUsers={users}
          assignments={assignments}
          authEngine={authEngine}
          masterRootUserId={masterRootUser?.id}
          onClose={() => setShowCreateTaskModal(false)}
          onCreateTask={handleCreateTask}
        />
      )}

      {/* Person Profile Modal */}
      {viewingProfileUser && (
        <PersonProfileModal
          user={viewingProfileUser}
          currentUser={currentUser}
          allRoles={roles}
          allDepts={departments}
          assignments={assignments}
          onClose={() => setViewingProfileUser(null)}
          onStartMessage={(targetUserId) => {
            setViewingProfileUser(null);
            setChatTargetUserId(targetUserId);
            handleSelectTab('chat');
          }}
        />
      )}

    </div>
  );
}
