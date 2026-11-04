import type { Env } from './env';
import { HttpError } from './env';
import {
  DOC_KINDS, DocKind, OrgContext, deleteDoc, getDoc, isMember, listDocs, loadOrgContext, putDoc, stamp,
} from './store';
import {
  canCreateTask, canMessagePair, hasDirectAuthority, isUserLead,
} from '../src/lib/orgRules';
import { listInviteLinks } from './orgs';
import type { Assignment, Department, Role, Task, User, Message } from '../src/types';

const asKind = (k: string): DocKind => {
  if (!DOC_KINDS.includes(k as DocKind)) throw new HttpError(404, `Unknown collection "${k}"`);
  return k as DocKind;
};

/** Everything the app needs on load, in the shape the React app already uses. */
export async function orgState(env: Env, orgId: string) {
  const [org, ...rest] = await Promise.all([
    loadOrgContext(env, orgId),
    ...DOC_KINDS.map(k => listDocs(env, orgId, k)),
  ]);
  const byKind = Object.fromEntries(DOC_KINDS.map((k, i) => [k, rest[i]])) as Record<DocKind, any[]>;
  return {
    organization: org.org,
    departments: byKind.department,
    roles: byKind.role,
    users: byKind.user,
    assignments: byKind.assignment,
    tasks: byKind.task,
    comments: byKind.comment,
    meetings: byKind.meeting,
    files: byKind.file,
    notifications: byKind.notification,
    messages: byKind.message,
    connections: byKind.connection,
    compliances: byKind.compliance,
    events: byKind.event,
    joinLinks: await listInviteLinks(env, orgId),
    serverTime: stamp(),
  };
}

/** Documents changed after `since` (deleted ones are flagged) so clients can poll cheaply. */
export async function orgChanges(env: Env, orgId: string, since: number) {
  const { results } = await env.DB.prepare(
    'SELECT kind, id, json, deleted, updated_at FROM docs WHERE org_id = ?1 AND updated_at > ?2 ORDER BY updated_at ASC LIMIT 2000'
  ).bind(orgId, since).all<{ kind: DocKind; id: string; json: string; deleted: number; updated_at: number }>();
  const changes = results.map(r => ({ kind: r.kind, id: r.id, deleted: !!r.deleted, doc: r.deleted ? null : JSON.parse(r.json) }));
  const last = results.length ? results[results.length - 1].updated_at : since;
  return { changes, cursor: last, joinLinks: await listInviteLinks(env, orgId) };
}

export async function writeDoc(env: Env, user: User, orgId: string, kindRaw: string, id: string, incoming: any) {
  const kind = asKind(kindRaw);
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  if (!incoming || typeof incoming !== 'object') throw new HttpError(400, 'Document body is required');
  if (incoming.id && incoming.id !== id) throw new HttpError(400, 'Document id does not match the URL');
  if (incoming.orgId && incoming.orgId !== orgId) throw new HttpError(400, 'Document belongs to another organisation');

  const existing = await getDoc(env, orgId, kind, id);
  const doc = await authorize(env, ctx, user, kind, existing, { ...incoming, id, ...(kind === 'user' ? {} : {}) });
  await putDoc(env, orgId, kind, id, doc);
  return doc;
}

export async function removeDoc(env: Env, user: User, orgId: string, kindRaw: string, id: string) {
  const kind = asKind(kindRaw);
  const ctx = await loadOrgContext(env, orgId);
  if (!isMember(ctx, user.id)) throw new HttpError(403, 'You are not part of this organisation');
  const existing = await getDoc(env, orgId, kind, id);
  if (!existing) return;
  const isRoot = user.id === ctx.masterRootUserId;
  const lead = isUserLead(user.id, ctx.assignments, ctx.roles, ctx.departments, ctx.masterRootUserId);

  switch (kind) {
    case 'task':
      if (!(isRoot || existing.assignedByUserId === user.id)) throw new HttpError(403, 'Only the person who assigned a task can delete it');
      break;
    case 'comment':
      if (existing.authorUserId !== user.id && !isRoot) throw new HttpError(403, 'You can only delete your own comments');
      break;
    case 'assignment': {
      const target = ctx.roles.find(r => r.id === existing.roleId);
      if (!isRoot && !(target && hasDirectAuthority(user.id, { targetRoleId: target.id }, ctx.departments, ctx.roles, ctx.assignments, ctx.masterRootUserId).allowed)) {
        throw new HttpError(403, 'You do not have authority over that role');
      }
      if (target?.roleType === 'master_root') throw new HttpError(403, 'The organisation root cannot be removed');
      break;
    }
    case 'department':
    case 'role':
      if (!lead) throw new HttpError(403, 'Only leads can change the organisation structure');
      break;
    case 'user':
      throw new HttpError(403, 'Profiles cannot be deleted');
    default:
      if (!lead && existing.uploadedByUserId !== user.id && existing.connectedByUserId !== user.id && existing.userId !== user.id) {
        throw new HttpError(403, 'You cannot delete this');
      }
  }
  await deleteDoc(env, orgId, kind, id);
}

// ---------------------------------------------------------------------------------------------
// Per-kind authorization. The AI never decides these; they are the same deterministic rules the
// React app uses (src/lib/orgRules.ts), now enforced where they cannot be bypassed.
// ---------------------------------------------------------------------------------------------

const TASK_FIXED = ['assignedByUserId', 'assignedToRoleId', 'deptId', 'createdAt', 'orgId'] as const;

async function authorize(env: Env, ctx: OrgContext, user: User, kind: DocKind, existing: any | null, doc: any) {
  const { departments, roles, assignments, masterRootUserId } = ctx;
  const lead = isUserLead(user.id, assignments, roles, departments, masterRootUserId);

  switch (kind) {
    case 'task':
      return authorizeTask(ctx, user, existing as Task | null, doc as Task);

    case 'comment': {
      const task = await getDoc<Task>(env, ctx.org.id, 'task', doc.taskId);
      if (!task) throw new HttpError(404, 'That task does not exist');
      if (doc.authorUserId !== user.id) throw new HttpError(403, 'Comments must be written as yourself');
      if (existing && existing.authorUserId !== user.id) throw new HttpError(403, 'You can only edit your own comments');
      if (!taskParticipant(ctx, user, task)) throw new HttpError(403, 'You are not involved in this task');
      return doc;
    }

    case 'message': {
      const sender = doc.senderUserId || doc.senderId;
      if (sender !== user.id) throw new HttpError(403, 'Messages must be sent as yourself');
      if (doc.channelType === 'dm') {
        const to = doc.recipientId || doc.channelId;
        if (!to || !isMember(ctx, to) || !canMessagePair(user.id, to, departments, roles, assignments)) {
          throw new HttpError(403, 'You are not allowed to message this person');
        }
      }
      return doc;
    }

    case 'department':
    case 'role':
      if (!lead) throw new HttpError(403, 'Only leads can change the organisation structure');
      if (kind === 'role' && doc.roleType === 'master_root' && !existing) throw new HttpError(403, 'There is only one organisation root');
      return doc;

    case 'assignment': {
      const target = roles.find(r => r.id === doc.roleId);
      if (!target) throw new HttpError(404, 'That role does not exist');
      if (target.roleType === 'master_root') throw new HttpError(403, 'The organisation root cannot be reassigned here');
      const ok = hasDirectAuthority(user.id, { targetRoleId: target.id }, departments, roles, assignments, masterRootUserId).allowed;
      if (!ok) throw new HttpError(403, 'You do not have authority over that role');
      return doc;
    }

    case 'user':
      if (doc.id !== user.id) throw new HttpError(403, 'You can only edit your own profile');
      return { ...(existing ?? {}), ...doc, email: user.email };

    case 'meeting':
      if (!existing) {
        if (!lead) throw new HttpError(403, 'Only leads can start department meetings');
        if (doc.startedByUserId !== user.id) throw new HttpError(403, 'Meetings must be started as yourself');
      } else {
        doc.startedByUserId = existing.startedByUserId;
        doc.deptId = existing.deptId;
      }
      return doc;

    case 'compliance':
      if (doc.userId !== user.id) throw new HttpError(403, 'You can only update your own integration status');
      return doc;

    case 'connection':
    case 'event':
      if (!lead && kind === 'event') throw new HttpError(403, 'Only leads can create events');
      return doc;

    default:
      return doc; // file, notification: any member
  }
}

function taskParticipant(ctx: OrgContext, user: User, task: Task): boolean {
  if (task.assignedToUserId === user.id || task.assignedByUserId === user.id) return true;
  if (user.id === ctx.masterRootUserId) return true;
  return hasDirectAuthority(user.id, { targetRoleId: task.assignedToRoleId }, ctx.departments, ctx.roles, ctx.assignments, ctx.masterRootUserId).allowed;
}

function authorizeTask(ctx: OrgContext, user: User, existing: Task | null, doc: Task): Task {
  const { departments, roles, assignments, masterRootUserId } = ctx;
  const now = new Date().toISOString();

  if (!existing) {
    // Creating / assigning: roots only, downward only, never to yourself.
    if (!canCreateTask(user.id, doc.deptId, assignments, roles, departments, masterRootUserId)) {
      throw new HttpError(403, 'Only a department or section root can create tasks here');
    }
    if (doc.assignedByUserId !== user.id) throw new HttpError(403, 'Tasks must be created as yourself');
    const role = roles.find(r => r.id === doc.assignedToRoleId);
    if (!role) throw new HttpError(400, 'Pick a role to assign this task to');
    if (!hasDirectAuthority(user.id, { targetRoleId: role.id }, departments, roles, assignments, masterRootUserId).allowed) {
      throw new HttpError(403, 'You do not have authority over that role');
    }
    if (assignments.some(a => a.userId === user.id && a.roleId === role.id && a.isActive)) {
      throw new HttpError(400, 'You cannot assign work to a role you hold yourself');
    }
    if (doc.assignedToUserId && !assignments.some(a => a.userId === doc.assignedToUserId && a.roleId === role.id && a.isActive)) {
      throw new HttpError(400, 'That person does not hold the chosen role');
    }
    if (!doc.title?.trim()) throw new HttpError(400, 'A task needs a title');
    return { ...doc, status: 'pending', createdAt: now, updatedAt: now };
  }

  for (const f of TASK_FIXED) {
    if ((doc as any)[f] !== (existing as any)[f]) throw new HttpError(400, `"${f}" cannot be changed after a task is created`);
  }
  const isAssignee = existing.assignedToUserId === user.id;
  const isCreator = existing.assignedByUserId === user.id;
  const isAuthority = !isAssignee && (isCreator || taskParticipant(ctx, user, existing));
  if (!isAssignee && !isAuthority) throw new HttpError(403, 'You are not involved in this task');

  if ((doc.assignedToUserId || '') !== (existing.assignedToUserId || '') && !isAuthority) {
    throw new HttpError(403, 'Only the person who assigned a task can change who it is assigned to');
  }
  const from = existing.status;
  const to = doc.status;
  if (to !== from) {
    const assigneeMoves: Record<string, string[]> = {
      pending: ['submitted', 'help'], rejected: ['submitted', 'help'], help: ['submitted', 'pending'],
    };
    const reviewerMoves: Record<string, string[]> = {
      submitted: ['done', 'rejected'], help: ['pending', 'rejected'], pending: ['rejected'], rejected: ['pending'],
    };
    const overdue = existing.dueDate ? Date.parse(existing.dueDate) < Date.now() : false;
    const ok =
      (to === 'expired' && overdue && from !== 'done') ||
      (isAssignee && assigneeMoves[from]?.includes(to)) ||
      (isAuthority && reviewerMoves[from]?.includes(to));
    if (!ok) throw new HttpError(403, `You cannot move this task from "${from}" to "${to}"`);
    if (to === 'rejected' && !doc.rejectionReason?.trim()) throw new HttpError(400, 'Say why the task is being sent back');
    if (to === 'done') doc.completedAt = now;
  }
  // Only the reviewer can rate, only the assignee can attach deliverables.
  if (!isAuthority) doc.rating = existing.rating;
  if (!isAssignee) {
    doc.confirmationText = existing.confirmationText;
    doc.confirmationFile = existing.confirmationFile;
    doc.submissionEvidence = existing.submissionEvidence;
  }
  return { ...doc, updatedAt: now };
}

export { putDoc };
