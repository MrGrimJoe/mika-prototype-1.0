/**
 * Organisation data layer for Mika (Cloudflare Worker + D1).
 *
 * One OrgSync per signed-in organisation: it loads the full state once, then polls
 * /changes every few seconds (and whenever the tab regains focus) and tells subscribers
 * what changed. Writes are optimistic: the UI updates immediately, the Worker then
 * validates it against the authority rules, and a rejected write rolls the UI back.
 */

import { api, ApiError } from './api';
import { notify } from './dialogService';
import type {
  Task, Comment, FileItem, Meeting, OrgNotification, Message, IntegrationConnection,
  UserIntegrationCompliance, Department, Role, User, Assignment, EventBinding, JoinLink, Organization,
} from '../types';

export type DocKind =
  | 'department' | 'role' | 'assignment' | 'user' | 'task' | 'comment' | 'meeting'
  | 'file' | 'notification' | 'message' | 'connection' | 'compliance' | 'event';

type Listener<T = any> = (docs: T[]) => void;

const POLL_MS = 3000;
const CURSOR_OVERLAP_MS = 5000; // changes are idempotent, so overlap protects against clock skew between isolates

class OrgSync {
  orgId: string | null = null;
  organization: Organization | null = null;
  joinLinks: JoinLink[] = [];
  private store = new Map<DocKind, Map<string, any>>();
  private listeners = new Map<DocKind, Set<Listener>>();
  private linkListeners = new Set<Listener<JoinLink>>();
  private cursor = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private polling = false;

  private bucket(kind: DocKind) {
    let m = this.store.get(kind);
    if (!m) this.store.set(kind, (m = new Map()));
    return m;
  }

  list<T = any>(kind: DocKind): T[] {
    return Array.from(this.bucket(kind).values());
  }

  private emit(kind: DocKind) {
    const ls = this.listeners.get(kind);
    if (ls) { const snap = this.list(kind); ls.forEach(l => l(snap)); }
  }

  subscribe<T>(kind: DocKind, cb: Listener<T>): () => void {
    let set = this.listeners.get(kind);
    if (!set) this.listeners.set(kind, (set = new Set()));
    set.add(cb);
    if (this.orgId) cb(this.list<T>(kind));
    return () => { set!.delete(cb); };
  }

  subscribeJoinLinks(cb: Listener<JoinLink>): () => void {
    this.linkListeners.add(cb);
    if (this.orgId) cb(this.joinLinks);
    return () => { this.linkListeners.delete(cb); };
  }

  /** Loads everything for an org and starts polling. Resolves when the first load is in memory. */
  async start(orgId: string): Promise<Organization> {
    this.stop();
    const gen = ++this.generation;
    const state = await api<any>(`/api/orgs/${orgId}/state`);
    if (gen !== this.generation) return state.organization;
    this.orgId = orgId;
    this.organization = state.organization;
    this.joinLinks = state.joinLinks ?? [];
    this.store.clear();
    const map: Record<string, DocKind> = {
      departments: 'department', roles: 'role', users: 'user', assignments: 'assignment', tasks: 'task',
      comments: 'comment', meetings: 'meeting', files: 'file', notifications: 'notification',
      messages: 'message', connections: 'connection', compliances: 'compliance', events: 'event',
    };
    for (const [key, kind] of Object.entries(map)) {
      for (const d of state[key] ?? []) this.bucket(kind).set(d.id, d);
    }
    this.cursor = state.serverTime ?? 0;
    (Object.values(map) as DocKind[]).forEach(k => this.emit(k));
    this.linkListeners.forEach(l => l(this.joinLinks));
    this.schedule();
    document.addEventListener('visibilitychange', this.onVisible);
    return state.organization;
  }

  stop() {
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    this.orgId = null;
    this.organization = null;
    this.store.clear();
    this.joinLinks = [];
  }

  private onVisible = () => { if (!document.hidden) this.pollNow(); };

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.pollNow(), POLL_MS);
  }

  /** Pull changes immediately (also used after a rejected write to roll the UI back). */
  async pollNow() {
    if (!this.orgId || this.polling) return;
    if (document.hidden) { this.schedule(); return; }
    this.polling = true;
    const gen = this.generation;
    try {
      const res = await api<{ changes: { kind: DocKind; id: string; deleted: boolean; doc: any }[]; cursor: number; joinLinks: JoinLink[] }>(
        `/api/orgs/${this.orgId}/changes?since=${Math.max(0, this.cursor - CURSOR_OVERLAP_MS)}`
      );
      if (gen !== this.generation) return;
      const touched = new Set<DocKind>();
      for (const c of res.changes) {
        const b = this.bucket(c.kind);
        const before = b.get(c.id);
        if (c.deleted) { if (before) { b.delete(c.id); touched.add(c.kind); } }
        else if (JSON.stringify(before) !== JSON.stringify(c.doc)) { b.set(c.id, c.doc); touched.add(c.kind); }
      }
      if (res.cursor > this.cursor) this.cursor = res.cursor;
      touched.forEach(k => this.emit(k));
      if (JSON.stringify(res.joinLinks) !== JSON.stringify(this.joinLinks)) {
        this.joinLinks = res.joinLinks;
        this.linkListeners.forEach(l => l(this.joinLinks));
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return; // app handles sign-out
    } finally {
      this.polling = false;
      if (gen === this.generation) this.schedule();
    }
  }

  /** Optimistic write; the Worker has the final say on whether it is allowed. */
  async put<T extends { id: string }>(kind: DocKind, doc: T): Promise<T> {
    if (!this.orgId) throw new Error('No organisation is open');
    const b = this.bucket(kind);
    const previous = b.get(doc.id);
    b.set(doc.id, doc);
    this.emit(kind);
    try {
      const res = await api<{ doc: T }>(`/api/orgs/${this.orgId}/docs/${kind}/${encodeURIComponent(doc.id)}`, { method: 'PUT', body: doc });
      b.set(doc.id, res.doc);
      this.emit(kind);
      return res.doc;
    } catch (e) {
      if (previous) b.set(doc.id, previous); else b.delete(doc.id);
      this.emit(kind);
      throw e;
    }
  }

  async remove(kind: DocKind, id: string): Promise<void> {
    if (!this.orgId) throw new Error('No organisation is open');
    const b = this.bucket(kind);
    const previous = b.get(id);
    b.delete(id);
    this.emit(kind);
    try {
      await api(`/api/orgs/${this.orgId}/docs/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      if (previous) b.set(id, previous);
      this.emit(kind);
      throw e;
    }
  }
}

export const orgSync = new OrgSync();

/** Tell the person why a write was refused (the rules live on the server), then re-sync. */
function reportFailure(action: string, e: unknown): never {
  const message = e instanceof ApiError ? e.message : `Could not ${action}.`;
  notify(message, 'error');
  orgSync.pollNow();
  throw e;
}

async function write<T extends { id: string }>(kind: DocKind, doc: T, action: string): Promise<void> {
  try { await orgSync.put(kind, doc); } catch (e) { reportFailure(action, e); }
}
async function erase(kind: DocKind, id: string, action: string): Promise<void> {
  try { await orgSync.remove(kind, id); } catch (e) { reportFailure(action, e); }
}

/* ---- Generic helpers used by App for org structure ------------------------------------------ */
export const putDoc = write;
export const removeDoc = erase;
export const subscribeKind = <T,>(kind: DocKind, cb: Listener<T>) => orgSync.subscribe<T>(kind, cb);
export const subscribeJoinLinks = (cb: Listener<JoinLink>) => orgSync.subscribeJoinLinks(cb);
export const startOrgSync = (orgId: string) => orgSync.start(orgId);
export const stopOrgSync = () => orgSync.stop();

/* ---- Per-collection API (names kept so components did not need to change) ------------------- */
export const upsertTask = (t: Task) => write('task', t, 'save the task');
export const removeTask = (id: string) => erase('task', id, 'delete the task');
export const subscribeTasks = (_org: string, cb: Listener<Task>) => orgSync.subscribe('task', cb);

export const upsertComment = (c: Comment) => write('comment', c, 'post the comment');
export const subscribeComments = (_org: string, cb: Listener<Comment>) => orgSync.subscribe('comment', cb);

export const upsertMeeting = (m: Meeting) => write('meeting', m, 'save the meeting');
export const subscribeMeetings = (_org: string, cb: Listener<Meeting>) => orgSync.subscribe('meeting', cb);

export const upsertFileItem = (f: FileItem) => write('file', f, 'save the file');
export const removeFileItem = (id: string) => erase('file', id, 'delete the file');
export const uploadMikaFile = upsertFileItem;
export const deleteMikaFile = removeFileItem;
export const subscribeFiles = (_org: string, cb: Listener<FileItem>, deptId?: string) =>
  orgSync.subscribe<FileItem>('file', docs => cb(deptId ? docs.filter(f => f.deptId === deptId) : docs));

/** Uploads real bytes to Mika storage (R2) and records the file in the org. */
export async function uploadFileBlob(
  file: File,
  meta: { deptId?: string; folder?: string; sourceTaskId?: string } = {}
): Promise<FileItem> {
  if (!orgSync.orgId) throw new Error('No organisation is open');
  const form = new FormData();
  form.set('file', file);
  for (const [k, v] of Object.entries(meta)) if (v) form.set(k, v);
  try {
    const res = await api<{ file: FileItem }>(`/api/orgs/${orgSync.orgId}/files`, { method: 'POST', form });
    orgSync.pollNow();
    return res.file;
  } catch (e) {
    return reportFailure('upload the file', e);
  }
}

export const upsertNotification = (n: OrgNotification) => write('notification', n, 'send the notification');
export const subscribeNotifications = (_org: string, cb: Listener<OrgNotification>) => orgSync.subscribe('notification', cb);

export const upsertMessage = (m: Message) => write('message', m, 'send the message');
export const subscribeMessages = (_org: string, cb: Listener<Message>) => orgSync.subscribe('message', cb);

export const upsertIntegrationConnection = (c: IntegrationConnection) =>
  write('connection', c as IntegrationConnection & { id: string }, 'save the connection');
export const removeIntegrationConnection = (id: string) => erase('connection', id, 'remove the connection');
export const subscribeIntegrationConnections = (_org: string, cb: Listener<IntegrationConnection>) =>
  orgSync.subscribe('connection', cb);

export const upsertUserCompliance = (c: UserIntegrationCompliance) =>
  write('compliance', { ...c, id: c.id ?? `${c.userId}_${c.integrationKey}` } as UserIntegrationCompliance & { id: string }, 'save your integration status');
export const subscribeUserCompliance = (userId: string, cb: Listener<UserIntegrationCompliance>) =>
  orgSync.subscribe<UserIntegrationCompliance>('compliance', docs => cb(docs.filter(c => c.userId === userId)));

export type { Department, Role, User, Assignment, EventBinding };
