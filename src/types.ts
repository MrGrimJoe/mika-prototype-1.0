/**
 * Types and interfaces for Mika - Recursive Organizational System
 * Reconciles mathematical graph model, deterministic authorization, and product UX.
 */

export type AuthorityType = 'direct' | 'indirect' | 'section_to_role' | 'bypass' | 'none';

export type TaskStatus = 'pending' | 'help' | 'submitted' | 'done' | 'expired' | 'rejected';

export type ConfirmationMode = 'file' | 'file_upload' | 'yes_no';

export type DeptType = 'department' | 'section' | 'subject' | 'temp';

export interface User {
  id: string;
  email: string;
  fullName: string;
  preferredName: string;
  gender: 'female' | 'male' | 'non-binary' | 'prefer-not-to-say';
  avatarUrl?: string;
  createdAt: string;
}

export interface Role {
  id: string;
  orgId: string;
  deptId: string;
  title: string;
  slug: string;
  isRoot: boolean;
  isSectionRoot?: boolean;
  roleType: 'master_root' | 'dept_root' | 'section_root' | 'subject_root' | 'member';
  description?: string;
}

export interface Department {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  type: DeptType;
  rootRoleId?: string;
  parentDeptId?: string;
  // For sections: list of department IDs it groups directly
  groupedDeptIds?: string[];
  isTemporary?: boolean;
  isArchived?: boolean;
  validFrom?: string;
  validTo?: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  userId: string;
  roleId: string;
  deptId: string;
  validFrom: string;
  validTo?: string;
  isActive: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  size: string;
  url: string;
  type: string;
}

export interface TaskRating {
  score: number; // 1 to 5
  comment?: string;
  isAnonymous: boolean;
  ratedByUserId: string;
  ratedAt: string;
}

export interface TaskMention {
  type: 'github_repo' | 'github_file' | 'figma_file' | 'canva_design' | 'drive_file' | 'google_doc' | 'google_sheet' | 'google_slide';
  externalId: string;
  displayName: string;
  url: string;
  path?: string;
  repo?: string;
}

export interface SubmissionEvidence {
  source: 'keyboard-shortcut' | 'commit' | 'plugin' | 'manual';
  url?: string;
  host?: string;
  commitSha?: string;
  commitMessage?: string;
  capturedAt: string;
  previewUrl?: string;
  fullImport?: boolean;
}

export interface Task {
  id: string;
  orgId: string;
  deptId: string;
  title: string;
  description: string;
  assignedByUserId: string;
  assignedToRoleId: string;
  assignedToUserId?: string;
  status: TaskStatus;
  confirmationMode?: ConfirmationMode;
  referenceFile?: TaskAttachment;
  dueDate?: string;
  calendarEventId?: string;
  isCalendarSynced?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  attachments?: TaskAttachment[];
  confirmationFile?: TaskAttachment;
  confirmationText?: string;
  completionToken?: string;
  submissionEvidence?: SubmissionEvidence;
  mentions?: TaskMention[];
  rejectionReason?: string;
  rating?: TaskRating;
}

export interface Comment {
  id: string;
  orgId?: string;
  taskId: string;
  authorUserId: string;
  authorName: string;
  authorRoleTitle: string;
  content: string;
  createdAt: string;
  isHelpNotice?: boolean;
  isSystemNotice?: boolean;
}

export interface FileItem {
  id: string;
  orgId: string;
  deptId?: string;
  name: string;
  size: string;
  type: string;
  url?: string;
  storageBackend?: 'drive' | 'mika' | 'self_host';
  downloadUrl?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  isAutoArchived?: boolean;
  sourceTaskId?: string;
  folder?: string;
  archiveDestination?: 'department' | 'myself';
  entryType?: 'preview_link' | 'full_import';
  thumbnailUrl?: string;
  integrationSource?: 'google_drive' | 'google_docs' | 'google_sheets' | 'google_slides' | 'github' | 'figma' | 'canva' | 'upload';
  archivedByUserId?: string;
}

export interface Meeting {
  id: string;
  orgId: string;
  deptId: string;
  deptName: string;
  title: string;
  startedByUserId: string;
  startedByName: string;
  meetLink: string;
  calendarEventId?: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
  attendeeUserIds: string[];
}

export interface Message {
  id: string;
  orgId?: string;
  senderId?: string;
  recipientId?: string;
  channelType?: 'dept' | 'dm' | 'event';
  channelId?: string; // deptId or DM recipient userId or eventId
  channelName?: string;
  senderUserId?: string;
  senderName?: string;
  senderRoleTitle?: string;
  content: string;
  timestamp?: string;
  createdAt?: string;
  read?: boolean;
  attachments?: string[];
}

export interface EventBinding {
  id: string;
  orgId: string;
  title: string;
  description: string;
  departmentIds: string[];
  leadUserIds: string[];
  createdAt: string;
  isActive: boolean;
}

export interface JoinLink {
  id: string;
  orgId: string;
  roleId: string;
  roleTitle: string;
  deptName: string;
  token: string;
  expiresAt: string;
  maxUses?: number;
  useCount: number;
  createdByUserId: string;
  createdAt: string;
  requiredIntegrations?: string[];
}

export interface OrgNotification {
  id: string;
  orgId: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'help_requested' | 'task_rejected' | 'task_submitted' | 'meeting_started' | 'event_created' | 'temp_dept_created' | 'repo_error';
  relatedTaskId?: string;
  relatedDeptId?: string;
  relatedMeetingId?: string;
  timestamp?: string;
  createdAt?: string;
  read: boolean;
  metadata?: Record<string, any>;
}

export type IntegrationKey = 
  | 'google_drive' 
  | 'github' 
  | 'figma' 
  | 'canva' 
  | 'google_calendar' 
  | 'google_meet' 
  | 'google_gmail' 
  | 'google_tasks' 
  | 'google_forms' 
  | 'google_classroom' 
  | 'google_keep'
  | string;

export interface IntegrationConnection {
  id: string;
  integrationKey: IntegrationKey;
  orgId: string;
  scope: 'org' | 'root';
  scopeRootUserId?: string;   // set when scope === 'root'
  accessRoleIds: 'all' | string[];  // 'all' or list of roleIds/deptIds
  connectedByUserId: string;
  accountLabel: string;       // connected account username or email shown in UI
  connectedAt: string;
}

export interface UserIntegrationCompliance {
  id?: string;
  userId: string;
  orgId: string;
  integrationKey: string;
  connectedAccountLabel?: string;
  connectedAt?: string;
  satisfiedAt: string;
}

export interface ConnectedAppInfo {
  connected: boolean;
  accountEmail?: string;
  username?: string;
  connectedAt?: string;
  token?: string;
  details?: Record<string, any>;
  linkedDeptIds?: Record<string, string>; // e.g. { repoName: deptId }
}

export interface OrgIntegrations {
  github?: ConnectedAppInfo;
  figma?: ConnectedAppInfo;
  canva?: ConnectedAppInfo;
  google?: {
    drive?: boolean;
    docsSheetsSlides?: boolean;
    calendar?: boolean;
    meet?: boolean;
    chat?: boolean;
    gmail?: boolean;
    tasks?: boolean;
    forms?: boolean;
    classroom?: boolean;
    keep?: boolean;
    accountEmail?: string;
    connectedAt?: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  masterRootUserId: string;
  createdAt: string;
  storageType?: 'drive' | 'mika' | 'self_host';
  teamSize: number;
  storageGiB: number;
  pricingMonthly: number;
  memberUids?: string[];
  integrations?: OrgIntegrations;
}

export interface AuthorityCheckResult {
  hasAuthority: boolean;
  authorityType: AuthorityType;
  distance: number;
  explanation: string;
  targetRoleTitle?: string;
  targetDeptName?: string;
}

export interface AIInterpretationProposal {
  operation: 'create_task' | 'reassign_role' | 'create_dept' | 'create_event' | 'resolve_help' | 'explain_authority' | 'validate_org';
  confidence: number;
  reasoning: string;
  candidatePayload: Record<string, any>;
  evaluatedDecision?: 'ALLOW' | 'DENY';
  deterministicRuleApplied?: string;
}
