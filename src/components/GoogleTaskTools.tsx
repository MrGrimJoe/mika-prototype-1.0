import React, { useState } from 'react';
import { BookOpen, CalendarPlus, ClipboardList, FileText, Mail, Presentation, Sheet, Video, ListTodo, ExternalLink, Lock } from 'lucide-react';
import type { Assignment, Department, IntegrationConnection, Organization, Role, Task, TaskAttachment, User } from '../types';
import { userHasIntegrationAccess } from '../lib/integrationService';
import {
  createBlankWorkspaceFile, createClassroomAnnouncement, createGoogleForm, createGoogleTask, listClassroomCourses, sendGmailMessage, syncToGoogleCalendar,
} from '../lib/workspace';

/**
 * Google tools attached to ONE task, with write access: they create things in the person's own Google account.
 * Each button is the existing, already-written Google function; this panel is the missing doorway to it.
 *
 * What each is for, in task terms:
 *   Doc / Sheet / Slides   a working file for the assignee. It is attached to the task, and can be submitted as the deliverable.
 *   Calendar               the deadline on the assignee's own calendar.   Meet   a call about this task, link kept on the task.
 *   Google Tasks           the task in the assignee's personal list.      Gmail  a reminder from the assigner to the assignee.
 *   Forms                  a feedback or check form for a reviewer.       Classroom  announce the task to a class.
 * Access still follows the organisation's own rules: a lead decides which roles may use which Google tool.
 * A tool someone may not use is shown, with the reason, never silently hidden.
 */
interface Props {
  task: Task; currentUser: User; allUsers: User[]; org?: Organization | null; connections: IntegrationConnection[];
  assignments: Assignment[]; roles: Role[]; departments: Department[];
  onUpdateTask?: (t: Task) => void; onAddComment?: (taskId: string, content: string) => void;
}

const describe = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong with Google.');

export const GoogleTaskTools: React.FC<Props> = ({ task, currentUser, allUsers, org, connections, assignments, roles, departments, onUpdateTask, onAddComment }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string }[] | null>(null);
  const isAssignee = task.assignedToUserId === currentUser.id;
  const isAssigner = task.assignedByUserId === currentUser.id;
  const assignee = allUsers.find(u => u.id === task.assignedToUserId);
  const isRoot = org?.masterRootUserId === currentUser.id;
  const can = (key: string) => userHasIntegrationAccess(currentUser.id, key, connections, assignments, roles, departments, !!isRoot);
  if (!isAssignee && !isAssigner && !isRoot) return null;
  const open = !['done', 'expired'].includes(task.status);

  const run = async (id: string, fn: () => Promise<{ text: string; link?: string } | null>) => {
    setBusy(id); setMsg(null);
    try { const r = await fn(); if (r) setMsg({ ok: true, ...r }); } catch (e) { setMsg({ ok: false, text: describe(e) }); } finally { setBusy(null); }
  };
  const attach = (name: string, url: string, type: string) => {
    const a: TaskAttachment = { id: `g-${Date.now().toString(36)}`, name, size: 'Google file', url, type };
    onUpdateTask?.({ ...task, attachments: [...(task.attachments ?? []), a], updatedAt: new Date().toISOString() });
  };
  const create = (kind: 'doc' | 'sheet' | 'slide') => run(`file-${kind}`, async () => {
    const label = { doc: 'Doc', sheet: 'Sheet', slide: 'Slides' }[kind];
    const f = await createBlankWorkspaceFile(kind, `${task.title} (${label})`);
    if (!f.webViewLink) return { text: `${label} created in your Google Drive.` };
    attach(f.name, f.webViewLink, f.mimeType);
    return { text: `${label} created in your Google Drive and attached to this task.`, link: f.webViewLink };
  });
  const addCalendar = () => run('cal', async () => {
    if (!task.dueDate) throw new Error('This task has no due date to put on a calendar.');
    const r = await syncToGoogleCalendar({ title: `Due: ${task.title}`, description: `${task.description}\n\nTask in Mika: ${task.id}`, dueDate: task.dueDate });
    return { text: 'Added to your Google Calendar.', link: r.htmlLink };
  });
  const meet = () => run('meet', async () => {
    const start = new Date(Date.now() + 15 * 60_000).toISOString();
    const emails = [assignee?.email, allUsers.find(u => u.id === task.assignedByUserId)?.email].filter((e): e is string => !!e && e !== currentUser.email);
    const r = await syncToGoogleCalendar({ title: `Meet: ${task.title}`, description: `About the task "${task.title}" in Mika.`, dueDate: start, attendeeEmails: emails, createMeetConference: true });
    if (r.meetLink) onAddComment?.(task.id, `Meet call about this task: ${r.meetLink}`);
    return { text: r.meetLink ? 'Meet call scheduled for 15 minutes from now. The link is posted in the task comments.' : 'Calendar event created, but Google did not return a Meet link.', link: r.meetLink ?? r.htmlLink };
  });
  const addGoogleTask = () => run('gtask', async () => {
    const r = await createGoogleTask('@default', { title: task.title, notes: `${task.description}\n\n(from Mika)`, due: task.dueDate && !task.dueDate.includes('T') ? `${task.dueDate}T00:00:00.000Z` : task.dueDate });
    return r ? { text: 'Added to your Google Tasks.' } : null;
  });
  const emailAssignee = () => run('mail', async () => {
    if (!assignee?.email) throw new Error('There is no email address for the person this task is assigned to.');
    const r = await sendGmailMessage({ to: assignee.email, subject: `Reminder: ${task.title}`, body: `Hi ${assignee.preferredName || assignee.fullName},\n\nA reminder about "${task.title}"${task.dueDate ? `, due ${task.dueDate}` : ''}.\n\n${task.description}\n\n(Sent from Mika by ${currentUser.fullName})` });
    return r ? { text: `Reminder sent to ${assignee.email}.` } : null;
  });
  const makeForm = () => run('form', async () => {
    const f = await createGoogleForm(`Feedback: ${task.title}`, `${task.title} feedback`);
    if (!f) return null;
    if (f.responderUri) onAddComment?.(task.id, `Feedback form: ${f.responderUri}`);
    return { text: 'Form created in your Google account. The link is posted in the task comments.', link: f.responderUri };
  });
  const loadCourses = () => run('courses', async () => { setCourses((await listClassroomCourses()).map(c => ({ id: c.id, name: c.name }))); return null; });
  const announce = (courseId: string, name: string) => run('announce', async () => {
    const r = await createClassroomAnnouncement(courseId, `New task: ${task.title}${task.dueDate ? ` (due ${task.dueDate})` : ''}\n\n${task.description}`);
    setCourses(null);
    return r ? { text: `Posted in ${name}.` } : null;
  });

  const btn = 'inline-flex items-center gap-1.5 min-h-11 px-3 text-xs font-semibold rounded-xs border border-hairline text-ink-2 hover:bg-paper-raised disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const Tool = ({ k, id, icon, label, onClick, need, why }: { k: string; id: string; icon: React.ReactNode; label: string; onClick: () => void; need?: boolean; why?: string }) => {
    const allowed = can(k); const ok = allowed && need !== false;
    return (
      <button className={btn} disabled={!!busy || !ok} onClick={onClick} aria-busy={busy === id}
        title={!allowed ? 'A lead has not enabled this Google tool for your role. Ask an organisation lead to turn it on in Integrations.' : need === false ? why : undefined}>
        {allowed ? icon : <Lock className="w-3.5 h-3.5" aria-hidden />} {label}
      </button>
    );
  };

  return (
    <section id="google-tools" aria-labelledby="google-tools-title" className="mb-4 p-4 bg-paper border border-hairline rounded-xs space-y-3">
      <div>
        <h3 id="google-tools-title" className="text-xs font-bold text-ink">Google tools for this task</h3>
        <p className="text-xs text-ink-3 mt-0.5">These create things in <em>your own</em> Google account, after you confirm. Google asks for permission the first time you use each one.</p>
      </div>
      {isAssignee && open && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-ink-2">Do the work</div>
          <div className="flex flex-wrap gap-2">
            <Tool k="google_drive" id="file-doc" icon={<FileText className="w-3.5 h-3.5" aria-hidden />} label="New Doc" onClick={() => create('doc')} />
            <Tool k="google_drive" id="file-sheet" icon={<Sheet className="w-3.5 h-3.5" aria-hidden />} label="New Sheet" onClick={() => create('sheet')} />
            <Tool k="google_drive" id="file-slide" icon={<Presentation className="w-3.5 h-3.5" aria-hidden />} label="New Slides" onClick={() => create('slide')} />
            <Tool k="google_calendar" id="cal" icon={<CalendarPlus className="w-3.5 h-3.5" aria-hidden />} label="Add deadline to my calendar" onClick={addCalendar} need={!!task.dueDate} why="This task has no due date." />
            <Tool k="google_tasks" id="gtask" icon={<ListTodo className="w-3.5 h-3.5" aria-hidden />} label="Add to my Google Tasks" onClick={addGoogleTask} />
          </div>
        </div>
      )}
      {(isAssignee || isAssigner || isRoot) && open && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-ink-2">Talk about it</div>
          <div className="flex flex-wrap gap-2">
            <Tool k="google_meet" id="meet" icon={<Video className="w-3.5 h-3.5" aria-hidden />} label="Start a Meet" onClick={meet} />
            {(isAssigner || isRoot) && <Tool k="google_gmail" id="mail" icon={<Mail className="w-3.5 h-3.5" aria-hidden />} label={`Email ${assignee?.preferredName || 'the assignee'} a reminder`} onClick={emailAssignee} need={!!assignee?.email} why="There is no email address on file for the assignee." />}
          </div>
        </div>
      )}
      {(isAssigner || isRoot) && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-ink-2">Review and announce</div>
          <div className="flex flex-wrap gap-2">
            <Tool k="google_forms" id="form" icon={<ClipboardList className="w-3.5 h-3.5" aria-hidden />} label="Create a feedback form" onClick={makeForm} />
            <Tool k="google_classroom" id="courses" icon={<BookOpen className="w-3.5 h-3.5" aria-hidden />} label="Announce in Classroom" onClick={loadCourses} />
          </div>
          {courses && (courses.length === 0 ? <p className="text-xs text-ink-3">No active Classroom courses found for your account.</p> : (
            <ul className="divide-y divide-hairline border border-hairline rounded-xs bg-surface">
              {courses.map(c => <li key={c.id}><button className="w-full min-h-11 px-3 text-left text-xs hover:bg-paper-raised cursor-pointer" disabled={!!busy} onClick={() => announce(c.id, c.name)}>Post in {c.name}</button></li>)}
            </ul>
          ))}
        </div>
      )}
      {busy && <p className="text-xs text-ink-3 animate-pulse" role="status">Working with Google. A permission window may open.</p>}
      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`} role="status">
          {msg.text}{' '}{msg.link && <a href={msg.link} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">Open <ExternalLink className="w-3 h-3" aria-hidden /></a>}
        </p>
      )}
    </section>
  );
};
