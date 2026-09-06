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
import { 
  INITIAL_DEPARTMENTS, 
  INITIAL_ROLES, 
  INITIAL_USERS, 
  INITIAL_ASSIGNMENTS, 
  INITIAL_TASKS, 
  INITIAL_COMMENTS, 
  INITIAL_FILES, 
  INITIAL_JOIN_LINKS, 
  INITIAL_EVENTS
} from './lib/mockData';
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
import { JoinModal } from './components/JoinModal';
import { RoleLinkJoinView } from './components/RoleLinkJoinView';
import { AuthLanding } from './components/AuthLanding';
import { AppSidebar, SidebarTab } from './components/layout/AppSidebar';
import { RolesDashboard } from './components/RolesDashboard';
import { DashboardView } from './components/DashboardView';
import { InvitationsView } from './components/InvitationsView';
import { PersonProfileModal } from './components/PersonProfileModal';
import { AdminSection } from './components/AdminSection';
import { 
  subscribeTasks, 
  subscribeComments, 
  subscribeMeetings, 
  subscribeNotifications, 
  upsertTask, 
  upsertComment, 
  upsertNotification 
} from './lib/firestoreService';
import { syncToGoogleCalendar } from './lib/workspace';

import confetti from 'canvas-confetti';

export default function App() {
  // Check URL query parameters for ?join=TOKEN
  const [activeJoinToken, setActiveJoinToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || null;
  });

  // Session & Authentication State
  const [session, setSession] = useState<{ sessionId: string; token: string } | null>(() => {
    const saved = localStorage.getItem('mika_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Primary Graph State (Synchronized with backend & Firestore)
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [joinLinks, setJoinLinks] = useState<JoinLink[]>(INITIAL_JOIN_LINKS);
  const [events, setEvents] = useState<EventBinding[]>(INITIAL_EVENTS);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notifications, setNotifications] = useState<OrgNotification[]>([]);

  // Organization Metadata & Connected Integrations
  const [organization, setOrganization] = useState<Organization>(() => {
    const saved = localStorage.getItem('mika_org_data');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      id: 'org_oakridge',
      name: 'Oakridge Academy',
      slug: 'oakridge-academy',
      type: 'school',
      integrations: {
        github: { isConnected: true, defaultRepo: 'codeNinjaJane/mika-prototypes' },
        figma: { isConnected: true },
        canva: { isConnected: true },
        googleDrive: { isConnected: false }
      }
    };
  });

  const handleUpdateIntegrations = (newIntegrations: OrgIntegrations) => {
    setOrganization(prev => {
      const updated = { ...prev, integrations: newIntegrations };
      localStorage.setItem('mika_org_data', JSON.stringify(updated));
      return updated;
    });
  };

  // Authenticated Current User ID (Defaults to Principal so user begins directly on Dashboard)
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    return localStorage.getItem('mika_user_id') || INITIAL_USERS[0]?.id || 'u_principal';
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [activeJoinModalLink, setActiveJoinModalLink] = useState<JoinLink | null>(null);
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);

  // Firestore Real-Time Subscriptions
  useEffect(() => {
    const unsubTasks = subscribeTasks('org_oakridge', latestTasks => {
      if (latestTasks && latestTasks.length > 0) {
        setTasks(latestTasks);
      }
    });

    const unsubComments = subscribeComments('org_oakridge', latestComments => {
      if (latestComments && latestComments.length > 0) {
        setComments(latestComments);
      }
    });

    const unsubMeetings = subscribeMeetings('org_oakridge', latestMeetings => {
      if (latestMeetings && latestMeetings.length > 0) {
        setMeetings(latestMeetings);
      }
    });

    const unsubNotifications = subscribeNotifications('org_oakridge', latestNotifications => {
      if (latestNotifications && latestNotifications.length > 0) {
        setNotifications(latestNotifications);
      }
    });

    return () => {
      unsubTasks();
      unsubComments();
      unsubMeetings();
      unsubNotifications();
    };
  }, []);

  // Fetch initial backend state
  const refreshBackendState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        if (data.departments) setDepartments(data.departments);
        if (data.roles) setRoles(data.roles);
        if (data.users) setUsers(data.users);
        if (data.assignments) setAssignments(data.assignments);
        if (data.joinLinks) setJoinLinks(data.joinLinks);
        if (data.events) setEvents(data.events);
        if (data.tasks) setTasks(data.tasks);
        if (data.files) setFiles(data.files);
      }
    } catch (e) {
      console.warn('Backend sync in fallback mode:', e);
    }
  };

  useEffect(() => {
    refreshBackendState();
  }, []);

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find(u => u.id === currentUserId) || null;
  }, [users, currentUserId]);

  // Master root user from data
  const masterRootUser = useMemo(() => {
    const rootRole = roles.find(r => r.roleType === 'master_root' || r.slug === 'principal' || r.isRoot);
    const rootAsgn = assignments.find(a => a.roleId === rootRole?.id);
    return users.find(u => u.id === rootAsgn?.userId) || users[0];
  }, [roles, assignments, users]);

  // Instantiate Authorization Engine
  const authEngine = useMemo(() => {
    return new AuthorizationEngine(
      departments,
      roles,
      users,
      assignments,
      masterRootUser?.id || users[0]?.id || ''
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

  // Ensure current user cannot navigate to 'tasks' if they have no superiors
  useEffect(() => {
    if (!hasSuperiors && activeTab === 'tasks') {
      setActiveTab('dashboard');
    }
  }, [hasSuperiors, activeTab]);

  // Reset selected task when switching tabs
  const handleSelectTab = (tab: SidebarTab) => {
    setSelectedTaskId(null);
    setActiveTab(tab);
  };

  // Tasks relevant to current user:
  const visibleTasks = useMemo(() => {
    if (!currentUser || !hasSuperiors) return [];
    return tasks.filter(t => {
      // Direct assignment
      if (t.assignedToUserId === currentUser.id) return true;
      // If master root or lead, include subordinate tasks
      if (isCurrentUserLead) return true;
      return false;
    });
  }, [tasks, currentUser, hasSuperiors, isCurrentUserLead]);

  // Check authority to review / reject / approve a given task
  const checkAuthorityOverTask = (task: Task): boolean => {
    if (!currentUser) return false;
    if (currentUser.id === masterRootUser?.id) return true;
    const taskCreatorOrLeadCheck = authEngine.checkAuthority(currentUser.id, task.assignedToUserId);
    return taskCreatorOrLeadCheck.hasAuthority;
  };

  // Login handler
  const handleLoginSuccess = (userData: any, sessionData: any, initialTab: SidebarTab = 'dashboard') => {
    setSession(sessionData);
    localStorage.setItem('mika_session', JSON.stringify(sessionData));
    localStorage.setItem('mika_user_id', userData.id);
    setCurrentUserId(userData.id);
    setActiveTab(initialTab);
    refreshBackendState();
  };

  // Sign out handler
  const handleSignOut = () => {
    setSession(null);
    setCurrentUserId(null);
    setActiveTab('dashboard');
    setSelectedTaskId(null);
    localStorage.removeItem('mika_session');
    localStorage.removeItem('mika_user_id');
  };

  // Handle successful join via Role Link
  const handleRoleLinkJoinSuccess = (userData: any, sessionData: any) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.pathname);

    setActiveJoinToken(null);
    handleLoginSuccess(userData, sessionData, 'dashboard');
  };

  // Handlers for Task Lifecycle (Part B7 & B8)
  const handleTaskStatusChange = (taskId: string, newStatus: TaskStatus, reason?: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const updated: Task = { 
      ...targetTask, 
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (newStatus === 'done') {
      updated.completedAt = new Date().toISOString();
      updated.rejectionReason = undefined;
    } else if (newStatus === 'rejected' && reason) {
      updated.rejectionReason = reason;
    } else if (newStatus === 'pending') {
      updated.rejectionReason = undefined;
    } else if (newStatus === 'submitted') {
      // B8: Notify root lead or assigner that task is submitted and awaiting review
      const newNotif: OrgNotification = {
        id: `notif_${Date.now()}`,
        orgId: 'org_oakridge',
        userId: targetTask.assignedByUserId,
        title: 'Task Submitted for Review',
        message: `"${targetTask.title}" has been submitted by ${currentUser?.fullName || 'Assignee'} and is awaiting review.`,
        type: 'task_submitted',
        read: false,
        createdAt: new Date().toISOString(),
        metadata: { taskId }
      };
      upsertNotification(newNotif).catch(console.warn);
      setNotifications(prev => [newNotif, ...prev]);
    }

    setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
    upsertTask(updated).catch(console.warn);
  };

  const handleAddComment = (taskId: string, content: string, isHelp?: boolean) => {
    if (!currentUser) return;
    const newComment: Comment = {
      id: `c_${Date.now()}`,
      taskId,
      authorUserId: currentUser.id,
      authorName: currentUser.fullName,
      authorRoleTitle: currentUserRoles[0]?.role?.title || 'Staff',
      content,
      isHelpNotice: !!isHelp,
      createdAt: new Date().toISOString()
    };
    setComments(prev => [...prev, newComment]);
    upsertComment(newComment).catch(console.warn);

    // If help was flagged, update task status to 'help' (Part B2)
    if (isHelp) {
      handleTaskStatusChange(taskId, 'help');
    }
  };

  const handleFileUpload = (taskId: string, file: File) => {
    if (!currentUser) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newFileItem: FileItem = {
      id: `f_${Date.now()}`,
      orgId: 'org_oakridge',
      deptId: task.deptId,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type || 'application/octet-stream',
      uploadedByUserId: currentUser.id,
      uploadedByName: currentUser.fullName,
      uploadedAt: new Date().toISOString(),
      sourceTaskId: taskId,
      isAutoArchived: true,
      folder: 'Task Submissions'
    };

    setFiles(prev => [newFileItem, ...prev]);

    // Update task file field and transition to submitted (or done) per confirmation mode
    const updated: Task = {
      ...task,
      status: 'submitted',
      confirmationFile: {
        id: newFileItem.id,
        name: file.name,
        size: newFileItem.size,
        url: `/vault/${file.name}`,
        type: newFileItem.type
      },
      updatedAt: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
    upsertTask(updated).catch(console.warn);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleRateTask = (taskId: string, score: number, comment: string, isAnonymous: boolean) => {
    if (!currentUser) return;
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    const updated: Task = {
      ...target,
      rating: {
        score,
        comment,
        ratedByUserId: currentUser.id,
        isAnonymous,
        ratedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
    upsertTask(updated).catch(console.warn);
    confetti({ particleCount: 30, spread: 50 });
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
      id: `t_${Date.now()}`,
      orgId: 'org_oakridge',
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

    setTasks(prev => [newTask, ...prev]);
    upsertTask(newTask).catch(console.warn);
    setShowCreateTaskModal(false);
    confetti({ particleCount: 35, spread: 55 });
  };

  // Admin Department & Role Management Handlers
  const handleCreateDepartment = (deptData: Partial<Department>) => {
    const newDept: Department = {
      id: deptData.id || `dept_${Date.now()}`,
      orgId: 'org_oakridge',
      name: deptData.name || 'New Department',
      slug: (deptData.name || 'new-dept').toLowerCase().replace(/\s+/g, '-'),
      type: deptData.type || 'department',
      parentDeptId: deptData.parentDeptId || undefined,
      isTemporary: deptData.isTemporary,
      validFrom: deptData.validFrom,
      validTo: deptData.validTo,
      isArchived: false,
      createdAt: new Date().toISOString()
    };
    setDepartments(prev => [...prev, newDept]);
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleCreateRole = (roleData: Partial<Role>) => {
    const newRole: Role = {
      id: roleData.id || `role_${Date.now()}`,
      orgId: 'org_oakridge',
      deptId: roleData.deptId || departments[0]?.id || '',
      title: roleData.title || 'New Role',
      slug: roleData.slug || 'new-role',
      isRoot: roleData.isRoot || false,
      roleType: roleData.roleType || 'member'
    };
    setRoles(prev => [...prev, newRole]);
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleCreateEvent = (title: string, description: string, deptIds: string[]) => {
    const newEvent: EventBinding = {
      id: `evt_${Date.now()}`,
      orgId: 'org_oakridge',
      title,
      description,
      departmentIds: deptIds,
      leadUserIds: [currentUser?.id || 'u_principal'],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setEvents(prev => [...prev, newEvent]);
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleArchiveTempDept = (deptId: string) => {
    setDepartments(prev => prev.map(d => d.id === deptId ? { ...d, isArchived: true } : d));
  };

  const handleRemoveMember = (assignmentId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
  };

  // Link Generation
  const handleGenerateJoinLink = async (roleId: string, roleTitle: string, deptName: string, daysValid: number): Promise<JoinLink> => {
    if (!currentUser) throw new Error('You must be logged in to generate invite links.');

    const res = await fetch(`/api/orgs/org_oakridge/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issuerUserId: currentUser.id,
        roleId,
        validDays: daysValid
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server denied link creation due to authority constraints.');
    }

    const newLink: JoinLink = {
      id: data.link.id,
      orgId: data.link.orgId || 'org_oakridge',
      roleId,
      roleTitle,
      deptName,
      token: data.link.token,
      createdByUserId: currentUser.id,
      createdAt: data.link.createdAt,
      expiresAt: data.link.expiresAt,
      useCount: data.link.useCount || 0
    };

    setJoinLinks(prev => [newLink, ...prev]);
    return newLink;
  };

  // =========================================================================
  // VIEW ROUTING
  // =========================================================================

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

  // 2. If user is NOT authenticated, show AuthLanding
  if (!currentUser) {
    const seedUsersData = users.map(u => {
      const asgn = assignments.find(a => a.userId === u.id && a.isActive);
      const r = roles.find(ro => ro.id === asgn?.roleId);
      const d = departments.find(dept => dept.id === asgn?.deptId);
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        preferredName: u.preferredName,
        roleTitle: r?.title || 'Staff',
        deptName: d?.name || 'Department',
        isRoot: r ? isRoleRoot(r, d) : false
      };
    });

    return (
      <AuthLanding
        onLoginSuccess={handleLoginSuccess}
        onOpenJoinToken={token => setActiveJoinToken(token)}
        seedUsers={seedUsersData}
      />
    );
  }

  const handleFastSwitchUser = (userId: string) => {
    setCurrentUserId(userId);
    setSelectedTaskId(null);
    localStorage.setItem('mika_user_id', userId);
  };

  const handleSimulateJoin = (roleId: string, deptId: string, userData: { name: string; email: string }) => {
    const newUser: User = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      fullName: userData.name,
      preferredName: userData.name.split(' ')[0],
      email: userData.email,
      gender: 'prefer-not-to-say',
      createdAt: new Date().toISOString()
    };

    const newAssignment: Assignment = {
      id: `asgn_${Date.now()}`,
      userId: newUser.id,
      roleId,
      deptId,
      validFrom: new Date().toISOString(),
      isActive: true
    };

    setUsers(prev => [...prev, newUser]);
    setAssignments(prev => [...prev, newAssignment]);
    confetti({ particleCount: 40, spread: 60 });
  };

  const handleResetEmployees = () => {
    setAssignments(prev => prev.filter(a => a.userId === masterRootUser?.id));
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // 3. User IS authenticated -> Render Main Application
  return (
    <div className="h-screen w-screen bg-[#F7F5F0] text-[#1C2438] flex antialiased relative overflow-hidden font-sans">
      {/* Sidebar */}
      <AppSidebar
        currentUser={currentUser}
        currentUserRoles={currentUserRoles}
        masterRootUserId={masterRootUser?.id}
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        isCurrentUserLead={isCurrentUserLead}
        hasSuperiors={hasSuperiors}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        taskCount={visibleTasks.length}
        allUsers={users}
        onSwitchUser={id => handleFastSwitchUser(id)}
        onSignOut={handleSignOut}
        onCreateTaskClick={() => setShowCreateTaskModal(true)}
        onViewProfile={u => setViewingProfileUser(u)}
        orgName="Oakridge Academy"
      />

      {/* Main Content Stage */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10 bg-[#F7F5F0]">
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
                  notifications={notifications}
                  orgName="Oakridge Academy"
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
                  onSimulateJoin={handleSimulateJoin}
                  onResetEmployees={handleResetEmployees}
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
                  onSimulateJoin={handleSimulateJoin}
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

      {/* Join Role Invite Link Modal */}
      {activeJoinModalLink && (
        <JoinModal
          joinLink={activeJoinModalLink}
          allRoles={roles}
          allDepts={departments}
          onClose={() => setActiveJoinModalLink(null)}
          onJoinSuccess={userData => {
            const newUser: User = {
              id: `u_${Date.now()}`,
              email: userData.email,
              fullName: userData.fullName,
              preferredName: userData.preferredName,
              gender: userData.gender || 'prefer-not-to-say',
              createdAt: new Date().toISOString()
            };

            const newAssignment: Assignment = {
              id: `asgn_${Date.now()}`,
              userId: newUser.id,
              roleId: activeJoinModalLink.roleId,
              deptId: roles.find(r => r.id === activeJoinModalLink.roleId)?.deptId || departments[0].id,
              validFrom: new Date().toISOString(),
              isActive: true
            };

            setUsers(prev => [...prev, newUser]);
            setAssignments(prev => [...prev, newAssignment]);
            setCurrentUserId(newUser.id);
            setActiveJoinModalLink(null);
            confetti({ particleCount: 50, spread: 70 });
          }}
        />
      )}
    </div>
  );
}
