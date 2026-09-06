import React from 'react';
import { Task, User, Role, Department, Comment, TaskStatus } from '../types';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  MessageSquare, 
  Paperclip, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Badge } from './ui';
import { taskStateColors, typography } from '../lib/designSystem';

interface TaskCardProps {
  task: Task;
  currentUser: User;
  allUsers: User[];
  allRoles: Role[];
  allDepts: Department[];
  comments: Comment[];
  hasAuthorityToReview: boolean;
  onSelectTask?: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, reason?: string) => void;
  onAddComment?: (taskId: string, content: string, isHelp?: boolean) => void;
  onFileUpload?: (taskId: string, file: File) => void;
  onRateTask?: (taskId: string, score: number, comment: string, isAnonymous: boolean) => void;
  onViewProfile?: (user: User) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  allUsers,
  allRoles,
  allDepts,
  comments,
  hasAuthorityToReview,
  onSelectTask,
}) => {
  const assigner = allUsers.find(u => u.id === task.assignedByUserId);
  const assignee = allUsers.find(u => u.id === task.assignedToUserId);
  const targetRole = allRoles.find(r => r.id === task.assignedToRoleId);
  const department = allDepts.find(d => d.id === task.deptId);
  const taskComments = comments.filter(c => c.taskId === task.id);

  const statusConfig = taskStateColors[task.status] || taskStateColors.pending;

  return (
    <div
      onClick={() => onSelectTask && onSelectTask(task)}
      className="bg-white border border-[#DAD5C9] hover:border-[#1C2438] p-4 sm:p-5 rounded-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer group font-sans"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Badge per B7 & B9 */}
          <Badge
            variant={task.status as any}
            className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5"
          >
            <span 
              className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block" 
              style={{ backgroundColor: statusConfig.dot }} 
            />
            {statusConfig.label}
          </Badge>

          {department && (
            <span className="px-2 py-0.5 bg-[#F7F5F0] border border-[#DAD5C9] text-[11px] font-mono text-[#5C574B] rounded-xs">
              {department.name}
            </span>
          )}

          {targetRole && (
            <span className="px-2 py-0.5 bg-[#F7F5F0] border border-[#DAD5C9] text-[11px] font-mono text-[#5C574B] rounded-xs">
              {targetRole.title}
            </span>
          )}

          {/* B5: Calendar Sync Indicator */}
          {(task.isCalendarSynced || task.calendarEventId) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-[11px] font-mono rounded-xs">
              <CalendarIcon className="w-3 h-3" />
              <span>Calendar</span>
            </span>
          )}
        </div>

        {/* Due date if set */}
        {task.dueDate && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#8A8578]">
            <Clock className="w-3 h-3" />
            <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 
        className="text-base sm:text-lg font-bold text-[#1C2438] group-hover:text-[#2F3B7A] transition-colors mb-1.5"
        style={{ fontFamily: typography.fontSerif }}
      >
        {task.title}
      </h3>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-xs text-[#5C574B] line-clamp-2 leading-relaxed mb-3">
          {task.description}
        </p>
      )}

      {/* Bottom info row */}
      <div className="flex items-center justify-between pt-3 border-t border-[#EFEBE2] text-xs text-[#8A8578] font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5 text-[#5C574B]" />
            <span className="text-[#1C2438] font-bold">
              {assignee?.fullName || targetRole?.title || 'Unassigned'}
            </span>
          </div>
          
          {task.referenceFile && (
            <div className="flex items-center gap-1 text-[#2F3B7A]">
              <Paperclip className="w-3.5 h-3.5" />
              <span>Ref File</span>
            </div>
          )}

          {taskComments.length > 0 && (
            <div className="flex items-center gap-1 text-[#5C574B]">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{taskComments.length}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-[#2F3B7A] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
          <span>View Task</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
