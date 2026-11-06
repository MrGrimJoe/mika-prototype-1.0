import type { Env } from '../env';
import { HttpError } from '../env';
import { getDoc, type OrgContext } from '../store';
import { taskParticipant } from '../docs';
import type { FileItem, Task, User } from '../../src/types';
import { adapterFor } from './adapters';
import type { DesignProvider, IntegrationAdapter, ResourceRef, SubscribeResult } from './adapter';
import { getUserAccount, type AccountRow } from './accounts';
import { memberContext, requireConfigured } from './common';
import { sha256Hex } from './crypto';
import { assertSubmittable, attachEvidenceFile, submitWithEvidence } from './evidence';
import { listEvents, recordEvent, type EventView } from './events';

/**
 * The provider-neutral heart of linked work. Everything here talks to adapters through the shared interface,
 * so the assignment/deliverable workflow is identical for Figma, Canva or any provider added later.
 *
 * The rules, in one place:
 *  - Linking attaches a resource to an assignment. It is not a submission and not proof of anything.
 *  - Activity (what the provider reported) is recorded, never interpreted.
 *  - Only the assignee can submit, and only by an explicit action. That moves the task to "submitted" and nothing further.
 *  - Only the task's own review flow can mark it done. Review events here merely mirror that decision.
 */

export const MAX_LINKS_PER_TASK = 10;
export const MIN_SYNC_INTERVAL_MS = 30_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60_000;

export interface ResourceRow {
  id: string; org_id: string; task_id: string; provider: DesignProvider; external_id: string; node_id: string; resource_type: string;
  url: string; title: string; linked_by: string; linked_at: number; version: string | null; provider_modified_at: number | null;
  thumbnail_url: string | null; preview_file_id: string | null; last_synced_at: number | null; sync_state: 'never' | 'ok' | 'error' | 'reconnect';
  sync_error: string | null; retry_count: number; next_sync_after: number | null; activity_cursor: string | null; limits: string;
  submitted_at: number | null; submitted_by: string | null;
}

export interface ResourceView {
  id: string; provider: DesignProvider; type: string; url: string; title: string; externalId: string; nodeId: string | null;
  linkedBy: string; linkedAt: number; version: string | null; providerModifiedAt: number | null; thumbnailUrl: string | null; previewFileId: string | null;
  lastSyncedAt: number | null; syncState: ResourceRow['sync_state']; syncError: string | null; nextSyncAfter: number | null; limits: string[];
  submission: { status: 'not_submitted' | 'submitted'; at: number | null; by: string | null };
  review: { status: 'none' | 'awaiting' | 'accepted' | 'returned'; at: number | null; reviewerUserId: string | null; feedback: string | null };
}

export const refOf = (r: ResourceRow): ResourceRef => ({
  provider: r.provider, externalId: r.external_id, nodeId: r.node_id || undefined, url: r.url, type: r.resource_type,
});

const resourceId = async (orgId: string, taskId: string, ref: ResourceRef) =>
  'res_' + (await sha256Hex([orgId, taskId, ref.provider, ref.externalId, ref.nodeId ?? ''].join('|'))).slice(0, 24);

async function getResource(env: Env, orgId: string, id: string): Promise<ResourceRow> {
  // Always scoped by organisation, so an id from another organisation simply does not exist here.
  const row = await env.DB.prepare('SELECT * FROM integration_resources WHERE id = ?1 AND org_id = ?2').bind(id, orgId).first<ResourceRow>();
  if (!row) throw new HttpError(404, 'That linked file does not exist');
  return row;
}

async function loadTask(env: Env, orgId: string, taskId: string): Promise<Task> {
  const task = await getDoc<Task>(env, orgId, 'task', taskId);
  if (!task) throw new HttpError(404, 'That task does not exist');
  return task;
}

function requireAssignee(task: Task, user: User) {
  if (task.assignedToUserId !== user.id) throw new HttpError(403, 'Only the person this task is assigned to can do that');
}

function requireParticipant(ctx: OrgContext, task: Task, user: User) {
  if (!taskParticipant(ctx, user, task)) throw new HttpError(403, 'You are not involved in this task');
}

/** The linking person's own connected account is the only credential ever used for a resource. */
async function accountFor(env: Env, orgId: string, provider: DesignProvider, userId: string): Promise<AccountRow> {
  const a = await getUserAccount(env, orgId, provider, userId);
  if (!a) throw new HttpError(409, `Connect your ${adapterFor(provider).label} account first.`, { code: 'not_linked' });
  return a;
}

// ---- Presenting a resource -------------------------------------------------------------------------------------------

export async function toView(env: Env, row: ResourceRow, task: Task): Promise<ResourceView> {
  const submitted = row.submitted_at !== null;
  let review: ResourceView['review'] = { status: 'none', at: null, reviewerUserId: null, feedback: null };
  if (submitted) {
    // The latest review of THIS submission: a decision recorded after it was made.
    const ev = await env.DB.prepare(
      `SELECT event_type, occurred_at, actor_user_id FROM integration_events
       WHERE resource_id = ?1 AND event_type IN ('deliverable_accepted', 'deliverable_returned') AND occurred_at >= ?2
       ORDER BY occurred_at DESC LIMIT 1`
    ).bind(row.id, row.submitted_at).first<{ event_type: string; occurred_at: number; actor_user_id: string | null }>();
    if (ev) {
      const accepted = ev.event_type === 'deliverable_accepted';
      review = { status: accepted ? 'accepted' : 'returned', at: ev.occurred_at, reviewerUserId: ev.actor_user_id, feedback: accepted ? null : (task.rejectionReason ?? null) };
    } else if (task.status === 'done') {
      review = { status: 'accepted', at: task.completedAt ? Date.parse(task.completedAt) : null, reviewerUserId: null, feedback: null };
    } else if (task.status === 'submitted') {
      review = { status: 'awaiting', at: null, reviewerUserId: null, feedback: null };
    }
  }
  return {
    id: row.id, provider: row.provider, type: row.resource_type, url: row.url, title: row.title, externalId: row.external_id, nodeId: row.node_id || null,
    linkedBy: row.linked_by, linkedAt: row.linked_at, version: row.version, providerModifiedAt: row.provider_modified_at, thumbnailUrl: row.thumbnail_url,
    previewFileId: row.preview_file_id, lastSyncedAt: row.last_synced_at, syncState: row.sync_state, syncError: row.sync_error,
    nextSyncAfter: row.next_sync_after && row.next_sync_after > Date.now() ? row.next_sync_after : null,
    limits: row.limits ? row.limits.split(',').filter(Boolean) : [],
    submission: { status: submitted ? 'submitted' : 'not_submitted', at: row.submitted_at, by: row.submitted_by },
    review,
  };
}

export async function listTaskWork(env: Env, user: User, orgId: string, taskId: string) {
  const ctx = await memberContext(env, user, orgId);
  const task = await loadTask(env, orgId, taskId);
  requireParticipant(ctx, task, user);
  const { results } = await env.DB.prepare('SELECT * FROM integration_resources WHERE org_id = ?1 AND task_id = ?2 ORDER BY linked_at ASC')
    .bind(orgId, taskId).all<ResourceRow>();
  const resources = await Promise.all(results.map(r => toView(env, r, task)));
  const events: EventView[] = await listEvents(env, orgId, taskId, 100);
  return { resources, events, taskStatus: task.status, canLink: task.assignedToUserId === user.id && task.status !== 'done' && task.status !== 'expired' };
}

// ---- Linking ----------------------------------------------------------------------------------------------------------

export async function linkResource(env: Env, user: User, b: { orgId?: string; taskId?: string; provider?: string; input?: string }) {
  const adapter = adapterFor(b.provider);
  requireConfigured(env, adapter.key, adapter.label);
  if (!b.orgId || !b.taskId || !b.input?.trim()) throw new HttpError(400, 'orgId, taskId and a link are required');
  await memberContext(env, user, b.orgId);
  const task = await loadTask(env, b.orgId, b.taskId);
  requireAssignee(task, user);
  if (task.status === 'done' || task.status === 'expired') throw new HttpError(409, `This task is already ${task.status}`);

  const ref = adapter.parseResource(b.input);
  const account = await accountFor(env, b.orgId, adapter.key, user.id);
  const id = await resourceId(b.orgId, b.taskId, ref);

  const existing = await env.DB.prepare('SELECT id FROM integration_resources WHERE id = ?1').bind(id).first();
  if (!existing) {
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM integration_resources WHERE org_id = ?1 AND task_id = ?2').bind(b.orgId, b.taskId).first<{ n: number }>();
    if ((n?.n ?? 0) >= MAX_LINKS_PER_TASK) throw new HttpError(409, `A task can have at most ${MAX_LINKS_PER_TASK} linked files.`);
  }
  // Reading the file with the person's own account both fetches the metadata and proves they can open it.
  const snap = await adapter.fetchSnapshot(env, account, ref);
  const now = Date.now();
  const ins = await env.DB.prepare(
    `INSERT OR IGNORE INTO integration_resources
       (id, org_id, task_id, provider, external_id, node_id, resource_type, url, title, linked_by, linked_at, version, provider_modified_at, thumbnail_url,
        last_synced_at, sync_state, activity_cursor)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?11, 'ok', NULL)`
  ).bind(id, b.orgId, b.taskId, ref.provider, ref.externalId, ref.nodeId ?? '', snap.type, ref.url.slice(0, 2000), snap.title, user.id, now,
    snap.version, snap.modifiedAt, snap.thumbnailUrl).run();
  const created = (ins.meta?.changes ?? 0) > 0;
  if (created) {
    await recordEvent(env, {
      orgId: b.orgId, taskId: b.taskId, resourceId: id, provider: ref.provider, type: 'resource_linked',
      sourceEventId: `link:${id}:${now}`, occurredAt: now, actorUserId: user.id, metadata: { title: snap.title },
    });
  }
  // Ask the provider to push events about it (never fatal; Refresh always works).
  let webhook: SubscribeResult = { status: 'unsupported' };
  try { webhook = await adapter.subscribe(env, account, ref, { orgId: b.orgId, userId: user.id }); } catch { webhook = { status: 'unavailable', reason: 'Could not set up notifications.' }; }

  const row = await getResource(env, b.orgId, id);
  return { resource: await toView(env, row, task), created, webhook };
}

// ---- Syncing ----------------------------------------------------------------------------------------------------------

/** Doubling wait after repeated failures, capped, so a broken provider is not hit harder the longer it is broken. */
export const backoffMs = (retryCount: number) => Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, retryCount));

export async function syncResource(env: Env, user: User, orgId: string, id: string) {
  const ctx = await memberContext(env, user, orgId);
  const row = await getResource(env, orgId, id);
  const task = await loadTask(env, orgId, row.task_id);
  requireParticipant(ctx, task, user);
  const adapter = adapterFor(row.provider);
  requireConfigured(env, adapter.key, adapter.label);

  const now = Date.now();
  const view = async (r = row, extra: Record<string, unknown> = {}) => ({ resource: await toView(env, r, task), ...extra });
  // Sensible sync frequency: never call the provider again inside the minimum interval or while backing off.
  if (row.next_sync_after && row.next_sync_after > now) return view(row, { throttled: true, retryAt: row.next_sync_after });
  if (row.last_synced_at && now - row.last_synced_at < MIN_SYNC_INTERVAL_MS && row.sync_state === 'ok') {
    return view(row, { throttled: true, retryAt: row.last_synced_at + MIN_SYNC_INTERVAL_MS });
  }

  // The linking person's own account does the reading, wherever the refresh was triggered from.
  const account = await getUserAccount(env, orgId, row.provider, row.linked_by);
  if (!account) {
    await markSync(env, row.id, { state: 'reconnect', error: `${adapter.label} is not connected. The person who linked this file needs to reconnect.`, retry: 0, next: null });
    return view(await getResource(env, orgId, id), { error: { code: 'reconnect', message: `${adapter.label} is not connected for the person who linked this file.` } });
  }

  try {
    const result = await adapter.sync(env, account, refOf(row), { version: row.version, modifiedAt: row.provider_modified_at, cursor: row.activity_cursor, linkedAt: row.linked_at });
    let recorded = 0;
    for (const a of result.activity) {
      const actorUserId = a.actorExternalId ? await resolveActor(env, orgId, row.provider, a.actorExternalId) : null;
      if (await recordEvent(env, {
        orgId, taskId: row.task_id, resourceId: row.id, provider: row.provider, type: a.type, sourceEventId: a.sourceEventId,
        occurredAt: a.occurredAt, actorExternalId: a.actorExternalId, actorUserId, metadata: a.meta,
      })) recorded++;
    }
    // Delayed or out-of-order results never move the record backwards: the snapshot only replaces an older one.
    const s = result.snapshot;
    await env.DB.prepare(
      `UPDATE integration_resources SET
         title = CASE WHEN ?3 IS NULL OR provider_modified_at IS NULL OR ?3 >= provider_modified_at THEN ?2 ELSE title END,
         version = CASE WHEN ?3 IS NULL OR provider_modified_at IS NULL OR ?3 >= provider_modified_at THEN COALESCE(?4, version) ELSE version END,
         provider_modified_at = CASE WHEN ?3 IS NOT NULL AND (provider_modified_at IS NULL OR ?3 >= provider_modified_at) THEN ?3 ELSE provider_modified_at END,
         thumbnail_url = COALESCE(?5, thumbnail_url), activity_cursor = COALESCE(?6, activity_cursor), limits = ?7
       WHERE id = ?1`
    ).bind(row.id, s.title, s.modifiedAt, s.version, s.thumbnailUrl, result.cursor, result.limits.join(',')).run();
    await markSync(env, row.id, { state: 'ok', error: null, retry: 0, next: null, at: now });
    return view(await getResource(env, orgId, id), { recorded });
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    const code = String(e.extra?.code ?? 'provider_error');
    if (code === 'reconnect') {
      await markSync(env, row.id, { state: 'reconnect', error: e.message, retry: 0, next: null });
    } else if (code === 'rate_limited') {
      const wait = Math.max(Number(e.extra?.retryAfter ?? 0) * 1000, backoffMs(row.retry_count));
      await markSync(env, row.id, { state: 'error', error: e.message, retry: row.retry_count + 1, next: now + Math.min(wait, BACKOFF_MAX_MS) });
    } else {
      await markSync(env, row.id, { state: 'error', error: e.message, retry: row.retry_count + 1, next: now + backoffMs(row.retry_count) });
    }
    return view(await getResource(env, orgId, id), { error: { code, message: e.message } });
  }
}

async function markSync(env: Env, id: string, o: { state: string; error: string | null; retry: number; next: number | null; at?: number }) {
  await env.DB.prepare(
    `UPDATE integration_resources SET sync_state = ?2, sync_error = ?3, retry_count = ?4, next_sync_after = ?5, last_synced_at = COALESCE(?6, last_synced_at) WHERE id = ?1`
  ).bind(id, o.state, o.error, o.retry, o.next, o.at ?? null).run();
}

/** A provider user id counts as a Mika member only when exactly that account is linked in this organisation. */
async function resolveActor(env: Env, orgId: string, provider: string, externalId: string): Promise<string | null> {
  const r = await env.DB.prepare(
    `SELECT user_id FROM integration_accounts WHERE org_id = ?1 AND provider = ?2 AND kind = 'user' AND external_id = ?3`
  ).bind(orgId, provider, externalId).first<{ user_id: string }>();
  return r?.user_id ?? null;
}

// ---- Unlinking --------------------------------------------------------------------------------------------------------

export async function unlinkResource(env: Env, user: User, orgId: string, id: string) {
  await memberContext(env, user, orgId);
  const row = await getResource(env, orgId, id);
  const task = await loadTask(env, orgId, row.task_id);
  requireAssignee(task, user);
  if (row.linked_by !== user.id) throw new HttpError(403, 'Only the person who linked this file can remove it');
  if (task.status === 'done' || task.status === 'expired') throw new HttpError(409, `This task is already ${task.status}`);
  if (row.submitted_at !== null && task.status === 'submitted') throw new HttpError(409, 'This file was submitted and is awaiting review, so it cannot be removed now.');

  const now = Date.now();
  await recordEvent(env, {
    orgId, taskId: row.task_id, resourceId: row.id, provider: row.provider, type: 'resource_unlinked',
    sourceEventId: `unlink:${row.id}:${now}`, occurredAt: now, actorUserId: user.id,
  });
  await env.DB.prepare('DELETE FROM integration_resources WHERE id = ?1 AND org_id = ?2').bind(row.id, orgId).run();
  // Nobody linked to this file any more: stop the provider sending events about it.
  const left = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM integration_resources WHERE org_id = ?1 AND provider = ?2 AND external_id = ?3'
  ).bind(orgId, row.provider, row.external_id).first<{ n: number }>();
  if (!left?.n) { try { await adapterFor(row.provider).unsubscribe(env, { orgId, externalId: row.external_id }); } catch { /* best effort */ } }
  return { ok: true };
}

// ---- Submitting -------------------------------------------------------------------------------------------------------

/** The assignee explicitly presents one linked resource as their deliverable. This submits for review and nothing more. */
export async function submitResource(env: Env, user: User, b: { orgId?: string; resourceId?: string; format?: string }) {
  if (!b.orgId || !b.resourceId) throw new HttpError(400, 'orgId and resourceId are required');
  await memberContext(env, user, b.orgId);
  const row = await getResource(env, b.orgId, b.resourceId);
  const adapter = adapterFor(row.provider);
  requireConfigured(env, adapter.key, adapter.label);
  await assertSubmittable(env, b.orgId, row.task_id, user.id); // only the assignee, only while the task is open
  if (row.linked_by !== user.id) throw new HttpError(403, 'Only the person who linked this file can submit it');
  const account = await accountFor(env, b.orgId, row.provider, user.id);

  const preview = await adapter.exportPreview(env, account, refOf(row), { format: b.format });
  const now = Date.now();
  await recordEvent(env, {
    orgId: b.orgId, taskId: row.task_id, resourceId: row.id, provider: row.provider, type: 'export_completed',
    sourceEventId: `export:${row.id}:${now}`, occurredAt: now, actorUserId: user.id, metadata: { format: preview.type },
  });
  const file: FileItem | null = await attachEvidenceFile(env, {
    orgId: b.orgId, user, taskId: row.task_id, name: preview.name, type: preview.type, bytes: preview.bytes, source: row.provider,
  });
  const task = await submitWithEvidence(env, {
    orgId: b.orgId, taskId: row.task_id, actorUserId: user.id, file,
    evidence: { source: 'plugin', url: preview.viewUrl, host: new URL(preview.viewUrl).hostname.replace(/^www\./, ''), capturedAt: new Date(now).toISOString(), previewUrl: file?.url, fullImport: !!file },
  });
  await env.DB.prepare('UPDATE integration_resources SET submitted_at = ?2, submitted_by = ?3, preview_file_id = ?4 WHERE id = ?1')
    .bind(row.id, now, user.id, file?.id ?? null).run();
  await recordEvent(env, {
    orgId: b.orgId, taskId: row.task_id, resourceId: row.id, provider: row.provider, type: 'submission_made',
    sourceEventId: `submission:${row.id}:${task.updatedAt}`, occurredAt: now, actorUserId: user.id,
  });
  return { task, file, resource: await toView(env, await getResource(env, b.orgId, row.id), task) };
}

/** The original one-step flow ("paste a link, attach a preview and submit") kept for existing callers: link, then submit. */
export async function linkAndSubmit(env: Env, user: User, provider: DesignProvider, b: { orgId?: string; taskId?: string; input?: string; format?: string }) {
  const adapter = adapterFor(provider);
  requireConfigured(env, adapter.key, adapter.label); // same first answer as before: not configured beats everything
  if (!b.orgId || !b.taskId || !b.input) throw new HttpError(400, 'orgId, taskId and a link are required');
  await memberContext(env, user, b.orgId);
  await assertSubmittable(env, b.orgId, b.taskId, user.id); // cheap check first
  const { resource } = await linkResource(env, user, { orgId: b.orgId, taskId: b.taskId, provider, input: b.input });
  return submitResource(env, user, { orgId: b.orgId, resourceId: resource.id, format: b.format });
}

export type { IntegrationAdapter };
