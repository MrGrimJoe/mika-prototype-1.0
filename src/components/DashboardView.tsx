import React, { useMemo } from 'react';
import { Task, User, OrgNotification } from '../types';
import { Inbox, ClipboardCheck, LifeBuoy, ListTodo, Bell, X, ArrowRight } from 'lucide-react';

interface DashboardViewProps {
  currentUser: User | null;
  orgName?: string;
  tasks?: Task[];
  onNavigateToTab?: (tab: string) => void;
  onOpenTask?: (taskId: string) => void;
  allUsers?: any[];
  allRoles?: any[];
  allDepts?: any[];
  assignments?: any[];
  notifications?: OrgNotification[];
  onClearNotification?: (id: string) => void;
  onMarkAllRead?: () => void;
  onViewProfile?: (user: User) => void;
}

interface Group {
  key: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  tasks: Task[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  orgName = 'School',
  tasks = [],
  notifications = [],
  onNavigateToTab,
  onOpenTask,
  onClearNotification,
  onMarkAllRead,
}) => {
  const groups = useMemo<Group[]>(() => {
    if (!currentUser) return [];
    const mine = tasks.filter(t => t.assignedToUserId === currentUser.id);
    const sent = tasks.filter(t => t.assignedByUserId === currentUser.id);
    return [
      {
        key: 'review',
        title: 'Waiting for your review',
        hint: 'Submitted by people you assigned work to',
        icon: <ClipboardCheck className="w-4 h-4" />,
        tasks: sent.filter(t => t.status === 'submitted'),
      },
      {
        key: 'help',
        title: 'Asking for help',
        hint: 'People who are stuck on a task you assigned',
        icon: <LifeBuoy className="w-4 h-4" />,
        tasks: sent.filter(t => t.status === 'help'),
      },
      {
        key: 'waiting',
        title: 'Waiting on others',
        hint: 'Tasks you assigned that are still open',
        icon: <ListTodo className="w-4 h-4" />,
        tasks: sent.filter(t => t.status === 'pending' && t.assignedToUserId !== currentUser.id),
      },
      {
        key: 'todo',
        title: 'Your open tasks',
        hint: 'Assigned to you and not yet done',
        icon: <ListTodo className="w-4 h-4" />,
        tasks: mine.filter(t => t.status === 'pending' || t.status === 'rejected' || t.status === 'help'),
      },
    ].filter(g => g.tasks.length > 0);
  }, [tasks, currentUser]);

  const unread = notifications.filter(n => !n.read);
  const empty = groups.length === 0 && notifications.length === 0;

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 font-sans space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-ink tracking-tight">
          {currentUser ? `Hello, ${currentUser.preferredName || currentUser.fullName.split(' ')[0]}` : 'Dashboard'}
        </h2>
        <p className="text-sm text-ink-3 mt-1">{orgName}</p>
      </div>

      {empty && (
        <div className="p-12 sm:p-16 bg-surface border border-hairline rounded-xs shadow-2xs flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-paper border border-hairline flex items-center justify-center mb-5 text-ink-3">
            <Inbox className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="text-xl font-bold text-ink">You're all caught up</h3>
          <p className="mt-2 text-sm text-ink-3 max-w-md leading-relaxed">
            Nothing needs your attention. Submissions, help requests and new assignments will appear here.
          </p>
        </div>
      )}

      {groups.map(g => (
        <section key={g.key} className="bg-surface border border-hairline rounded-xs shadow-2xs">
          <header className="flex items-center gap-2 px-4 py-3 border-b border-hairline">
            <span className="text-ink-2">{g.icon}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-ink">{g.title} <span className="font-mono text-ink-3">({g.tasks.length})</span></h3>
              <p className="text-xs text-ink-3">{g.hint}</p>
            </div>
          </header>
          <ul className="divide-y divide-hairline">
            {g.tasks.slice(0, 5).map(t => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => (onOpenTask ? onOpenTask(t.id) : onNavigateToTab?.('tasks'))}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper transition-colors"
                >
                  <span className="text-sm text-ink truncate">{t.title}</span>
                  <ArrowRight className="w-4 h-4 text-ink-3 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
          {g.tasks.length > 5 && (
            <button
              type="button"
              onClick={() => onNavigateToTab?.('tasks')}
              className="w-full px-4 py-2.5 text-xs font-medium text-accent border-t border-hairline hover:bg-paper"
            >
              See all {g.tasks.length} in Task Feed
            </button>
          )}
        </section>
      ))}

      {notifications.length > 0 && (
        <section className="bg-surface border border-hairline rounded-xs shadow-2xs">
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-hairline">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-ink-2" />
              <h3 className="text-sm font-bold text-ink">Notifications {unread.length > 0 && <span className="font-mono text-ink-3">({unread.length} new)</span>}</h3>
            </div>
            {unread.length > 0 && (
              <button type="button" onClick={onMarkAllRead} className="text-xs font-medium text-accent hover:underline">
                Mark all read
              </button>
            )}
          </header>
          <ul className="divide-y divide-hairline">
            {notifications.map(n => (
              <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className={`text-sm ${n.read ? 'text-ink-3' : 'text-ink font-medium'}`}>{(n as any).message || (n as any).title}</p>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => onClearNotification?.(n.id)}
                  className="p-1 text-ink-3 hover:text-ink shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
