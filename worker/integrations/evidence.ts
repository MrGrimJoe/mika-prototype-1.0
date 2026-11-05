import type { Env } from '../env';
import { HttpError } from '../env';
import { getDoc, getOrg, putDoc } from '../store';
import { randomId } from '../util';
import type { FileItem, SubmissionEvidence, Task } from '../../src/types';

/**
 * The one rule every integration follows: it can attach EVIDENCE and move a task to "submitted".
 * It can never mark a task done, rate it, or change who it belongs to. A human reviewer decides.
 * Only the person the task is assigned to can submit it.
 */
export async function assertSubmittable(env: Env, orgId: string, taskId: string, actorUserId: string): Promise<Task> {
  const task = await getDoc<Task>(env, orgId, 'task', taskId);
  if (!task) throw new HttpError(404, 'That task does not exist');
  if (task.assignedToUserId !== actorUserId) throw new HttpError(403, 'Only the person this task is assigned to can submit it');
  if (!['pending', 'rejected', 'help'].includes(task.status)) throw new HttpError(409, `This task is already ${task.status}`);
  return task;
}

export async function submitWithEvidence(env: Env, o: {
  orgId: string; taskId: string; actorUserId: string; evidence: SubmissionEvidence; file?: FileItem | null;
}): Promise<Task> {
  const task = await assertSubmittable(env, o.orgId, o.taskId, o.actorUserId);

  const now = new Date().toISOString();
  const updated: Task = {
    ...task,
    status: 'submitted',
    submissionEvidence: o.evidence,
    ...(o.file?.url ? { confirmationFile: { id: o.file.id, name: o.file.name, size: o.file.size, url: o.file.url, type: o.file.type } } : {}),
    updatedAt: now,
  };
  await putDoc(env, o.orgId, 'task', task.id, updated);

  const nid = randomId('notif');
  await putDoc(env, o.orgId, 'notification', nid, {
    id: nid, orgId: o.orgId, userId: task.assignedByUserId,
    title: 'Task submitted for review',
    message: `"${task.title}" was submitted with evidence from ${o.evidence.host || o.evidence.source}.`,
    type: 'task_submitted', read: false, createdAt: now, relatedTaskId: task.id, metadata: { taskId: task.id },
  });
  return updated;
}

/** Stores a downloaded preview/export in R2 as an auto-archived file of the task. Null when the org keeps files elsewhere. */
export async function attachEvidenceFile(env: Env, o: {
  orgId: string; user: { id: string; fullName: string }; taskId: string; name: string; type: string; bytes: ArrayBuffer;
  source: NonNullable<FileItem['integrationSource']>;
}): Promise<FileItem | null> {
  const org = await getOrg(env, o.orgId);
  if (!org) throw new HttpError(404, 'Organisation not found');
  if (org.storageType && org.storageType !== 'mika') return null;

  const id = randomId('file');
  await env.FILES.put(`${o.orgId}/${id}`, o.bytes, {
    httpMetadata: { contentType: o.type },
    customMetadata: { name: o.name, uploadedBy: o.user.id },
  });
  const kb = o.bytes.byteLength / 1024;
  const item: FileItem = {
    id, orgId: o.orgId, name: o.name,
    size: kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`,
    type: o.type, url: `/api/orgs/${o.orgId}/files/${id}`, downloadUrl: `/api/orgs/${o.orgId}/files/${id}`,
    storageBackend: 'mika', uploadedByUserId: o.user.id, uploadedByName: o.user.fullName,
    uploadedAt: new Date().toISOString(), sourceTaskId: o.taskId, isAutoArchived: true,
    entryType: 'full_import', integrationSource: o.source,
  };
  await putDoc(env, o.orgId, 'file', id, item);
  return item;
}

/**
 * Tasks are referenced in commit messages, PR text and Figma version labels as `mika#<taskId>`.
 * Only the exact tag counts. Nothing is matched by title, name or email.
 */
export function findTaskRefs(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/\bmika#([A-Za-z0-9_]{3,64})/gi)) {
    out.add(m[1]);
    if (out.size >= 10) break;
  }
  return [...out];
}
