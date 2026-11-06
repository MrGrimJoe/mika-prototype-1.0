import type { Env } from '../env';
import { sha256Hex } from './crypto';
import type { Task } from '../../src/types';

/**
 * Normalised activity for linked work. Three families, deliberately kept apart:
 *   activity   - observed from the provider (version saved, comment added, file changed)
 *   link       - Mika bookkeeping about the link itself (linked, unlinked, preview exported)
 *   submission - the assignee explicitly presented a resource as their deliverable
 *   review     - an authorised reviewer accepted it or sent it back
 * Only `review` events ever mean anything about completion, and even those just mirror the task's own review flow.
 */
export type EventType =
  | 'resource_updated' | 'version_created' | 'comment_added'
  | 'resource_linked' | 'resource_unlinked' | 'export_completed'
  | 'submission_made'
  | 'deliverable_accepted' | 'deliverable_returned';
export type EventCategory = 'activity' | 'link' | 'submission' | 'review';

export const eventCategory = (t: EventType): EventCategory =>
  t === 'resource_updated' || t === 'version_created' || t === 'comment_added' ? 'activity'
    : t === 'submission_made' ? 'submission'
    : t === 'deliverable_accepted' || t === 'deliverable_returned' ? 'review'
    : 'link';

export type Meta = Record<string, string | number | boolean | null>;

export interface EventInput {
  orgId: string; taskId: string; resourceId: string; provider: string;
  type: EventType; sourceEventId: string; occurredAt: number;
  actorExternalId?: string | null; actorUserId?: string | null; metadata?: Meta;
}

const SECRETISH = /token|secret|code|pass(word|code)?|authori[sz]ation|cookie|key/i;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

/** Keeps metadata small and boring: a few primitive fields, short strings, nothing that looks like a credential. */
export function sanitizeMeta(m: Meta | undefined): Meta {
  const out: Meta = {};
  for (const [k, v] of Object.entries(m ?? {}).slice(0, 10)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k) || SECRETISH.test(k)) continue;
    if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 120);
  }
  return out;
}

/** Provider clocks and delivery delays are untrusted: an event cannot claim to be from the future. */
export const clampTime = (ms: number, now = Date.now()) =>
  Number.isFinite(ms) && ms > 0 ? Math.min(ms, now + MAX_FUTURE_SKEW_MS) : now;

/** Accepts ISO strings, epoch seconds or epoch milliseconds. Returns null when it is none of them. */
export function parseProviderTime(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return parseProviderTime(n);
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Records one event. The id is a hash of (resource, source event id), so the same webhook delivered twice,
 * or the same item seen by two syncs, or a webhook plus a later sync, all collapse into one row.
 * Returns true only when the row is new.
 */
export async function recordEvent(env: Env, e: EventInput, now = Date.now()): Promise<boolean> {
  const id = 'ev_' + (await sha256Hex(`${e.resourceId}|${e.sourceEventId}`)).slice(0, 28);
  const r = await env.DB.prepare(
    `INSERT OR IGNORE INTO integration_events
       (id, org_id, task_id, resource_id, provider, event_type, source_event_id, actor_external_id, actor_user_id, occurred_at, received_at, metadata)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
  ).bind(
    id, e.orgId, e.taskId, e.resourceId, e.provider, e.type, e.sourceEventId.slice(0, 200),
    e.actorExternalId ?? null, e.actorUserId ?? null, clampTime(e.occurredAt, now), now, JSON.stringify(sanitizeMeta(e.metadata)),
  ).run();
  return (r.meta?.changes ?? 0) > 0;
}

export interface EventView {
  id: string; resourceId: string; provider: string; type: EventType; category: EventCategory;
  occurredAt: number; receivedAt: number; actorUserId: string | null; hasActor: boolean; metadata: Meta;
}

export async function listEvents(env: Env, orgId: string, taskId: string, limit = 100): Promise<EventView[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM integration_events WHERE org_id = ?1 AND task_id = ?2 ORDER BY occurred_at DESC, received_at DESC LIMIT ?3`
  ).bind(orgId, taskId, Math.min(Math.max(limit, 1), 200)).all<any>();
  return results.map(r => ({
    id: r.id, resourceId: r.resource_id, provider: r.provider, type: r.event_type as EventType, category: eventCategory(r.event_type),
    occurredAt: r.occurred_at, receivedAt: r.received_at, actorUserId: r.actor_user_id ?? null, hasActor: !!r.actor_external_id || !!r.actor_user_id,
    metadata: safeParse(r.metadata),
  }));
}

function safeParse(s: string): Meta { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }

/**
 * Called by the generic document writer after a task changes. When a reviewer moves a SUBMITTED task to done or
 * back to rejected, every resource that was explicitly submitted for it gets a review event carrying the reviewer's id
 * and the time. The write has already passed the existing authority checks; this only records the outcome.
 */
export async function recordReviewOutcome(env: Env, orgId: string, before: Task, after: Task, reviewerUserId: string): Promise<void> {
  if (before.status !== 'submitted' || before.status === after.status) return;
  if (after.status !== 'done' && after.status !== 'rejected') return;
  const { results } = await env.DB.prepare(
    `SELECT id, provider FROM integration_resources WHERE org_id = ?1 AND task_id = ?2 AND submitted_at IS NOT NULL`
  ).bind(orgId, after.id).all<{ id: string; provider: string }>();
  const at = Date.parse(after.updatedAt) || Date.now();
  for (const r of results) {
    await recordEvent(env, {
      orgId, taskId: after.id, resourceId: r.id, provider: r.provider,
      type: after.status === 'done' ? 'deliverable_accepted' : 'deliverable_returned',
      sourceEventId: `review:${after.id}:${after.status}:${after.updatedAt}`, occurredAt: at, actorUserId: reviewerUserId,
    });
  }
}
