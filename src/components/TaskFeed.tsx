import React, { useState, useMemo } from 'react';
import { Task, User, Role, Department, Comment, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { Search, Plus, CheckSquare } from 'lucide-react';
import { taskStateColors } from '../lib/designSystem';

interface TaskFeedProps {
  tasks: Task[];
  currentUser: User;
  allUsers: User[];
  allRoles: Role[];
  allDepts: Department[];
  comments: Comment[];
  canCreateTasks?: boolean;
  isCurrentUserLead?: boolean;
  onSelectTask?: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, reason?: string) => void;
  onAddComment?: (taskId: string, content: string, isHelp?: boolean) => void;
  onFileUpload?: (taskId: string, file: File) => void;
  onOpenCreateTaskModal?: () => void;
  onCreateTaskClick?: () => void;
  onRateTask?: (taskId: string, score: number, comment: string, isAnonymous: boolean) => void;
  checkAuthorityOverTask?: (task: Task) => boolean;
  canReviewTask?: (task: Task) => boolean;
  onViewProfile?: (user: User) => void;
}

export type ColorFilterKey = 'all' | 'red' | 'blue' | 'yellow' | 'green' | 'grey';

export const TaskFeed: React.FC<TaskFeedProps> = ({
  tasks = [],
  currentUser,
  allUsers = [],
  allRoles = [],
  allDepts = [],
  comments = [],
  canCreateTasks,
  onSelectTask,
  onStatusChange,
  onAddComment,
  onFileUpload,
  onOpenCreateTaskModal,
  onCreateTaskClick,
  onRateTask,
  checkAuthorityOverTask,
  canReviewTask,
  onViewProfile
}) => {
  // Part B6: Segmented chip control for Red / Blue / Yellow / Green / Grey
  const [selectedColor, setSelectedColor] = useState<ColorFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allowCreate = Boolean(canCreateTasks);
  const handleOpenModal = () => {
    if (onOpenCreateTaskModal) onOpenCreateTaskModal();
    else if (onCreateTaskClick) onCreateTaskClick();
  };

  const hasReviewAuthority = (task: Task): boolean => {
    if (typeof checkAuthorityOverTask === 'function') {
      return checkAuthorityOverTask(task);
    }
    if (typeof canReviewTask === 'function') {
      return canReviewTask(task);
    }
    return false;
  };

  // Color counts per B7 state machine mapping
  const colorCounts = useMemo(() => {
    const counts = {
      all: tasks.length,
      red: 0,    // Pending & Denied
      blue: 0,   // Help Needed
      yellow: 0, // Submitted
      green: 0,  // Approved
      grey: 0    // Expired
    };

    tasks.forEach(t => {
      if (t.status === 'pending' || t.status === 'rejected') counts.red++;
      else if (t.status === 'help') counts.blue++;
      else if (t.status === 'submitted') counts.yellow++;
      else if (t.status === 'done') counts.green++;
      else if (t.status === 'expired') counts.grey++;
    });

    return counts;
  }, [tasks]);

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        // Color Filter per B6
        if (selectedColor === 'red') {
          if (t.status !== 'pending' && t.status !== 'rejected') return false;
        } else if (selectedColor === 'blue') {
          if (t.status !== 'help') return false;
        } else if (selectedColor === 'yellow') {
          if (t.status !== 'submitted') return false;
        } else if (selectedColor === 'green') {
          if (t.status !== 'done') return false;
        } else if (selectedColor === 'grey') {
          if (t.status !== 'expired') return false;
        }

        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = t.title.toLowerCase().includes(q);
          const matchesDesc = t.description.toLowerCase().includes(q);
          const dept = allDepts.find(d => d.id === t.deptId);
          const matchesDept = dept?.name.toLowerCase().includes(q);
          if (!matchesTitle && !matchesDesc && !matchesDept) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Priority: Submitted (awaiting review) and Help first, then by deadline
        if (a.status === 'submitted' && b.status !== 'submitted') return -1;
        if (b.status === 'submitted' && a.status !== 'submitted') return 1;
        if (a.status === 'help' && b.status !== 'help') return -1;
        if (b.status === 'help' && a.status !== 'help') return 1;

        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks, selectedColor, searchQuery, allDepts]);

  return (
    <div className="space-y-4 font-sans">
      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 border border-[#DAD5C9] rounded-xs shadow-2xs">
        {/* B6: Segmented Chip Control for Red / Blue / Yellow / Green / Grey */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedColor('all')}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer shrink-0 border ${
              selectedColor === 'all'
                ? 'bg-[#1C2438] text-white border-[#1C2438]'
                : 'bg-[#F7F5F0] text-[#5C574B] border-[#DAD5C9] hover:bg-[#EFEBE2]'
            }`}
          >
            All [{colorCounts.all}]
          </button>

          {/* Red: Pending & Denied */}
          <button
            onClick={() => setSelectedColor('red')}
            className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              selectedColor === 'red'
                ? 'bg-[#FEF2F2] text-[#DC2626] border-[#DC2626] font-bold'
                : 'bg-[#F7F5F0] text-[#5C574B] border-[#DAD5C9] hover:bg-[#EFEBE2]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span>Red [{colorCounts.red}]</span>
          </button>

          {/* Blue: Help Needed */}
          <button
            onClick={() => setSelectedColor('blue')}
            className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              selectedColor === 'blue'
                ? 'bg-[#EFF6FF] text-[#2563EB] border-[#2563EB] font-bold'
                : 'bg-[#F7F5F0] text-[#5C574B] border-[#DAD5C9] hover:bg-[#EFEBE2]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            <span>Blue [{colorCounts.blue}]</span>
          </button>

          {/* Yellow: Submitted */}
          <button
            onClick={() => setSelectedColor('yellow')}
            className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              selectedColor === 'yellow'
                ? 'bg-[#FEFCE8] text-[#CA8A04] border-[#CA8A04] font-bold'
                : 'bg-[#F7F5F0] text-[#5C574B] border-[#DAD5C9] hover:bg-[#EFEBE2]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
            <span>Yellow [{colorCounts.yellow}]</span>
          </button>

          {/* Green: Approved */}
          <button
            onClick={() => setSelectedColor('green')}
            className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              selectedColor === 'green'
                ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A] font-bold'
                : 'bg-[#F7F5F0] text-[#5C574B] border-[#DAD5C9] hover:bg-[#EFEBE2]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span>Green [{colorCounts.green}]</span>
          </button>

          {/* Grey: Expired */}
          <button
            onClick={() => setSelectedColor('grey')}
            className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-xs transition-colors cursor-pointer shrink-0 border flex items-center gap-1.5 ${
              selectedColor === 'grey'
                ? 'bg-[#F3F4F6] text-[#6B7280] border-[#6B7280] font-bold'
                : 'bg-[#F7F5F0] text-[#5C574B] border-[#DAD5C9] hover:bg-[#EFEBE2]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
            <span>Grey [{colorCounts.grey}]</span>
          </button>
        </div>

        {/* Search & Assign Task Action */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#8A8578] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono border border-[#DAD5C9] bg-[#F7F5F0] focus:bg-white focus:outline-hidden rounded-xs text-[#1C2438]"
            />
          </div>

          {allowCreate && (
            <button
              id="btn-create-task-main"
              onClick={handleOpenModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1C2438] hover:bg-[#12151C] text-white text-[11px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer rounded-xs shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Task List Feed */}
      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
          filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              currentUser={currentUser}
              allUsers={allUsers}
              allRoles={allRoles}
              allDepts={allDepts}
              comments={comments}
              hasAuthorityToReview={hasReviewAuthority(task)}
              onSelectTask={onSelectTask}
              onStatusChange={onStatusChange}
              onAddComment={onAddComment}
              onFileUpload={onFileUpload}
              onRateTask={onRateTask}
              onViewProfile={onViewProfile}
            />
          ))
        ) : (
          <div className="bg-white border border-dashed border-[#DAD5C9] p-12 text-center rounded-xs">
            <CheckSquare className="w-8 h-8 mx-auto text-[#8A8578] mb-2 opacity-60" />
            <h4 className="text-sm font-bold text-[#1C2438] uppercase tracking-wider mb-1 font-mono">No Matching Tasks</h4>
            <p className="text-xs text-[#8A8578] max-w-sm mx-auto font-mono">
              {searchQuery || selectedColor !== 'all'
                ? 'Adjust color or search filters to inspect assignments.'
                : 'No active assignments in current view.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
