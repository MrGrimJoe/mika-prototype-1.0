import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, Figma, Layers, RefreshCw, Send, Trash2, Undo2, AlertTriangle } from 'lucide-react';
import type { Task, User } from '../types';
import {
  canvaDesigns, connectProvider, describeError, fetchIntegrationStatus, fetchTaskWork, figmaWatch, linkResource, submitResource, syncResource, unlinkResource,
  type CanvaDesign, type DesignProviderKey, type IntegrationStatus, type LinkedResource, type TaskWork, type WorkEvent,
} from '../lib/integrationsApi';

const LABEL: Record<DesignProviderKey, string> = { figma: 'Figma', canva: 'Canva' };
const STALE_MS = 60 * 60_000;

const ago = (ms: number | null) => {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
};

const Icon = ({ p }: { p: string }) => (p === 'canva' ? <Layers className="w-3.5 h-3.5" aria-hidden /> : <Figma className="w-3.5 h-3.5" aria-hidden />);

/**
 * Figma and Canva work linked to this assignment.
 * Three different things are shown separately, on purpose:
 *   Activity    what Figma/Canva reported about the file (observed, never proof of effort or completion)
 *   Submission  the assignee presented a file as their deliverable
 *   Review      a reviewer accepted it or sent it back
 */
export const LinkedWork: React.FC<{ task: Task; currentUser: User; allUsers: User[] }> = ({ task, currentUser, allUsers }) => {
  const orgId = task.orgId;
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [work, setWork] = useState<TaskWork | null>(null);
  const [denied, setDenied] = useState(false);
  const [input, setInput] = useState<Record<DesignProviderKey, string>>({ figma: '', canva: '' });
  const [designs, setDesigns] = useState<CanvaDesign[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [format, setFormat] = useState<'png' | 'pdf'>('png');
  const isAssignee = task.assignedToUserId === currentUser.id;
  const name = (id: string | null) => (id ? allUsers.find(u => u.id === id)?.fullName ?? 'A teammate' : null);

  const load = useCallback(async () => {
    try { setWork(await fetchTaskWork(orgId, task.id)); setDenied(false); } catch { setDenied(true); }
    fetchIntegrationStatus(orgId).then(setStatus).catch(() => setStatus(null));
  }, [orgId, task.id]);
  useEffect(() => { load(); }, [load, task.status]);

  // One gentle refresh when a linked file has not been looked at for an hour. The server throttles it regardless.
  useEffect(() => {
    work?.resources.filter(r => r.syncState !== 'reconnect' && (!r.lastSyncedAt || Date.now() - r.lastSyncedAt > STALE_MS)).slice(0, 3)
      .forEach(r => { syncResource(orgId, r.id).then(() => fetchTaskWork(orgId, task.id).then(setWork)).catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work?.resources.length]);

  if (denied || !work || !status) return null;
  const providers = (['figma', 'canva'] as const).filter(p => status.providers[p].configured);
  if (!providers.length && !work.resources.length) return null;

  const act = async (id: string, fn: () => Promise<string | void>) => {
    setBusy(id); setMsg(null);
    try { const t = await fn(); if (t) setMsg({ ok: true, text: t }); await load(); }
    catch (e) { setMsg({ ok: false, text: describeError(e) }); }
    finally { setBusy(null); }
  };
  const connect = (p: DesignProviderKey) => act(`connect-${p}`, async () => {
    const r = await connectProvider(p, orgId, { scope: 'user' });
    if (!r.ok) throw new Error(r.message);
    return r.message;
  });
  const link = (p: DesignProviderKey, value = input[p]) => act(`link-${p}`, async () => {
    const r = await linkResource(orgId, task.id, p, value.trim());
    setInput(i => ({ ...i, [p]: '' })); setDesigns(null);
    const w = r.webhook.status === 'active' ? `${LABEL[p]} will tell Mika about new versions and comments.`
      : r.webhook.status === 'unavailable' ? `Linked. ${r.webhook.reason ?? ''} Use Refresh to see new activity.` : `Linked. ${LABEL[p]} cannot send change notifications, so use Refresh to see new activity.`;
    return r.created ? w : 'That file was already linked.';
  });
  const refresh = (r: LinkedResource) => act(`sync-${r.id}`, async () => {
    const o = await syncResource(orgId, r.id);
    if (o.error) throw new Error(o.error.message);
    if (o.throttled) return 'Checked a moment ago. Try again shortly.';
    return o.recorded ? `${o.recorded} new ${o.recorded === 1 ? 'event' : 'events'} recorded.` : 'Up to date.';
  });

  const canSubmit = isAssignee && ['pending', 'help', 'rejected'].includes(task.status);
  const btn = 'inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-xs font-semibold rounded-xs bg-accent text-white hover:bg-accent-strong disabled:opacity-50 cursor-pointer';
  const ghost = 'inline-flex items-center justify-center gap-1.5 min-h-11 px-3 text-xs font-semibold rounded-xs border border-hairline text-ink-2 hover:bg-paper-raised disabled:opacity-50 cursor-pointer';
  const field = 'flex-1 min-w-0 min-h-11 px-2.5 bg-surface border border-hairline rounded-xs text-xs focus:outline-none focus:border-accent';

  const describe = (e: WorkEvent) => {
    const who = name(e.actorUserId) ?? (e.hasActor ? `Someone on ${LABEL[e.provider as DesignProviderKey] ?? e.provider}` : null);
    const p = LABEL[e.provider as DesignProviderKey] ?? e.provider;
    const label = typeof e.metadata.label === 'string' && e.metadata.label ? ` “${e.metadata.label}”` : '';
    switch (e.type) {
      case 'version_created': return `${who ?? 'A version'} saved a named version${label}`;
      case 'comment_added': return `${who ?? 'Someone'} ${e.metadata.reply ? 'replied to a comment' : 'added a comment'} on the file`;
      case 'resource_updated': return `${p} reports the file changed`;
      case 'resource_linked': return `${who ?? 'The assignee'} linked this file`;
      case 'resource_unlinked': return `${who ?? 'The assignee'} removed the link`;
      case 'export_completed': return 'A preview was exported to attach as evidence';
      case 'submission_made': return `${who ?? 'The assignee'} submitted this file as their deliverable`;
      case 'deliverable_accepted': return `${who ?? 'A reviewer'} accepted the deliverable`;
      default: return `${who ?? 'A reviewer'} sent the deliverable back`;
    }
  };
  const tag: Record<WorkEvent['category'], { text: string; cls: string }> = {
    activity: { text: 'Observed', cls: 'text-ink-3' }, link: { text: 'Link', cls: 'text-ink-3' },
    submission: { text: 'Submitted', cls: 'text-amber-800' }, review: { text: 'Reviewed', cls: 'text-emerald-700' },
  };

  return (
    <section id="linked-work" aria-labelledby="linked-work-title" className="mb-4 p-4 bg-paper border border-hairline rounded-xs space-y-4">
      <div>
        <h3 id="linked-work-title" className="text-xs font-bold text-ink">Linked work from Figma and Canva</h3>
        <p className="text-xs text-ink-3 mt-0.5">
          Link the files this task is about. Mika records only what is listed under “What is recorded”. A change in a file is a signal, not proof the work is done:
          only a submission by the assignee and a reviewer’s acceptance count.
        </p>
      </div>

      {work.resources.length === 0 && <p className="text-xs text-ink-3">No files linked yet.</p>}
      <ul className="space-y-3">
        {work.resources.map(r => {
          const mine = r.linkedBy === currentUser.id;
          const state = r.syncState === 'reconnect' ? { t: 'Needs reconnecting', c: 'text-red-700' } : r.syncState === 'error' ? { t: 'Last refresh failed', c: 'text-red-700' }
            : r.syncState === 'ok' ? { t: `Synced ${ago(r.lastSyncedAt)}`, c: 'text-ink-3' } : { t: 'Not synced yet', c: 'text-ink-3' };
          return (
            <li key={r.id} className="p-3 bg-surface border border-hairline rounded-xs space-y-2">
              <div className="flex gap-3">
                {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} className="w-16 h-16 object-cover rounded-xs border border-hairline shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-ink-3"><Icon p={r.provider} /> {LABEL[r.provider]} · {r.type}</div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ink hover:underline inline-flex items-center gap-1 break-words">
                    {r.title || 'Untitled'} <ExternalLink className="w-3 h-3 shrink-0" aria-hidden />
                  </a>
                  <div className="text-xs text-ink-3">
                    Linked by {name(r.linkedBy)} {ago(r.linkedAt)}{r.version ? ` · version ${r.version.slice(0, 12)}` : ''}{r.providerModifiedAt ? ` · changed ${ago(r.providerModifiedAt)}` : ''}
                  </div>
                  <div className={`text-xs ${state.c}`} role="status">{state.t}{r.syncError && r.syncState !== 'ok' ? `: ${r.syncError}` : ''}</div>
                  {r.limits.length > 0 && <div className="text-xs text-amber-800">{LABEL[r.provider]} did not allow reading {r.limits.join(' and ')}. Reconnect {LABEL[r.provider]} to enable it.</div>}
                </div>
              </div>

              <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Where this file stands">
                <li className="text-ink-3">Linked</li>
                <li className={r.submission.status === 'submitted' ? 'text-amber-800 font-semibold' : 'text-ink-3'}>
                  {r.submission.status === 'submitted' ? `Submitted ${ago(r.submission.at)}` : 'Not submitted'}
                </li>
                <li className={r.review.status === 'accepted' ? 'text-emerald-700 font-semibold' : r.review.status === 'returned' ? 'text-red-700 font-semibold' : 'text-ink-3'}>
                  {r.review.status === 'accepted' ? `Accepted${name(r.review.reviewerUserId) ? ` by ${name(r.review.reviewerUserId)}` : ''}${r.review.at ? ` ${ago(r.review.at)}` : ''}`
                    : r.review.status === 'returned' ? `Sent back${name(r.review.reviewerUserId) ? ` by ${name(r.review.reviewerUserId)}` : ''}${r.review.feedback ? `: ${r.review.feedback}` : ''}`
                    : r.review.status === 'awaiting' ? 'Awaiting review' : 'Not reviewed'}
                </li>
              </ol>

              <div className="flex flex-wrap gap-2">
                <button className={ghost} disabled={!!busy || r.syncState === 'reconnect'} onClick={() => refresh(r)} aria-label={`Refresh ${r.title}`}>
                  <RefreshCw className={`w-3.5 h-3.5 ${busy === `sync-${r.id}` ? 'animate-spin' : ''}`} aria-hidden /> Refresh
                </button>
                {r.syncState === 'reconnect' && mine && <button className={ghost} disabled={!!busy} onClick={() => connect(r.provider)}>Reconnect {LABEL[r.provider]}</button>}
                {mine && canSubmit && (
                  <>
                    {r.provider === 'canva' && (
                      <select className="min-h-11 px-2 bg-surface border border-hairline rounded-xs text-xs" value={format} onChange={e => setFormat(e.target.value as 'png' | 'pdf')} aria-label="Preview format">
                        <option value="png">PNG preview</option><option value="pdf">PDF preview</option>
                      </select>
                    )}
                    <button className={btn} disabled={!!busy || r.syncState === 'reconnect'}
                      onClick={() => act(`submit-${r.id}`, async () => { await submitResource(orgId, r.id, format); return 'Preview attached. The task is now waiting for review.'; })}>
                      <Send className="w-3.5 h-3.5" aria-hidden /> Submit this file for review
                    </button>
                  </>
                )}
                {mine && isAssignee && !['done', 'expired'].includes(task.status) && !(r.submission.status === 'submitted' && task.status === 'submitted') && (
                  <button className={ghost} disabled={!!busy} onClick={() => act(`unlink-${r.id}`, async () => { await unlinkResource(orgId, r.id); return 'Link removed.'; })} aria-label={`Remove link to ${r.title}`}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden /> Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {work.canLink && providers.map(p => {
        const s = status.providers[p]; const caps = s.capabilities;
        return (
          <div key={p} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Icon p={p} /> Link a {LABEL[p]} {p === 'figma' ? 'file or frame' : 'design'}</div>
            {s.linked ? (
              <>
                <div className="flex gap-2">
                  <input className={field} value={input[p]} onChange={e => setInput(i => ({ ...i, [p]: e.target.value }))}
                    placeholder={p === 'figma' ? 'Paste a Figma file or frame link' : 'Paste a Canva design link'} aria-label={`${LABEL[p]} link`} />
                  <button className={btn} disabled={!input[p].trim() || !!busy} onClick={() => link(p)}>Link</button>
                </div>
                {p === 'canva' && (
                  <div>
                    <button className={ghost} disabled={!!busy} onClick={() => act('designs', async () => { setDesigns((await canvaDesigns(orgId)).designs); })}>Browse my recent designs</button>
                    {designs && (designs.length === 0 ? <p className="text-xs text-ink-3 mt-1">No designs found in your Canva account.</p> : (
                      <ul className="mt-1 divide-y divide-hairline border border-hairline rounded-xs bg-surface">
                        {designs.map(d => (
                          <li key={d.id}><button className="w-full min-h-11 px-3 text-left text-xs hover:bg-paper-raised cursor-pointer" disabled={!!busy} onClick={() => link('canva', d.id)}>{d.title}</button></li>
                        ))}
                      </ul>
                    ))}
                  </div>
                )}
                {p === 'figma' && s.linked && (
                  <button className={ghost} disabled={!input.figma.trim() || !!busy}
                    onClick={() => act('watch', async () => { const r = await figmaWatch(orgId, task.id, input.figma.trim()); return `Watching that file. Save a Figma version with ${r.tag} in its name and the task is submitted for review.`; })}>
                    Submit when I save a version named with this task’s tag
                  </button>
                )}
              </>
            ) : (
              <button className={ghost} disabled={!!busy} onClick={() => connect(p)}>Connect my {LABEL[p]} account</button>
            )}
            {caps && <ul className="text-xs text-ink-3 list-disc pl-4">{caps.notes.map(n => <li key={n}>{n}</li>)}</ul>}
          </div>
        );
      })}
      {work.canLink && providers.length === 0 && <p className="text-xs text-ink-3">Figma and Canva are not set up on this server, so files cannot be linked yet.</p>}

      {work.events.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-ink mb-1">Timeline</h4>
          <ul className="space-y-1.5">
            {work.events.slice(0, 30).map(e => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                {e.category === 'review' ? (e.type === 'deliverable_accepted' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-px" aria-hidden /> : <Undo2 className="w-3.5 h-3.5 text-red-700 shrink-0 mt-px" aria-hidden />)
                  : e.category === 'submission' ? <Send className="w-3.5 h-3.5 text-amber-800 shrink-0 mt-px" aria-hidden /> : <Clock className="w-3.5 h-3.5 text-ink-3 shrink-0 mt-px" aria-hidden />}
                <span className="text-ink-2"><span className={`font-semibold ${tag[e.category].cls}`}>{tag[e.category].text}</span> · {describe(e)} <span className="text-ink-3">· {ago(e.occurredAt)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs text-ink-3">
        <summary className="cursor-pointer min-h-11 flex items-center font-semibold text-ink-2">What is recorded</summary>
        <ul className="list-disc pl-4 space-y-0.5 pb-1">
          <li>Only files someone links here, never anything else in a Figma or Canva account.</li>
          <li>That a file was linked or removed, when the provider reports a new saved version, comment (no text) or change, and who did it when the provider says.</li>
          <li>That a preview was exported, that the assignee submitted, and that a reviewer accepted or sent it back.</li>
          <li>Not recorded: keystrokes, time spent, who opened the file, or the contents of comments.</li>
          <li>Disconnecting your account stops all future syncing. The history already recorded stays with the task.</li>
        </ul>
      </details>

      {busy && <p className="text-xs text-ink-3 animate-pulse" role="status">Working with the other service. This can take a few seconds.</p>}
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">{!msg.ok && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" aria-hidden />}{msg.text}</p>}
    </section>
  );
};
