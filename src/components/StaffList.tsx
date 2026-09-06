import React, { useState } from 'react';
import { User, Role, Department, Assignment, Task } from '../types';
import { isUserLead } from '../lib/orgRules';
import { 
  Users, 
  Crown, 
  Shield, 
  ExternalLink, 
  Layers
} from 'lucide-react';
import { taskStateColors, colors } from '../lib/designSystem';

interface StaffListProps {
  currentUser?: User;
  allUsers?: User[];
  users?: User[];
  allRoles?: Role[];
  roles?: Role[];
  allDepts?: Department[];
  departments?: Department[];
  assignments?: Assignment[];
  tasks?: Task[];
  onAssignTaskToUser?: (targetUser: User, targetRole: Role, targetDept: Department) => void;
  onOpenUserDetails?: (user: User) => void;
  onRemoveMember?: (assignmentId: string) => void;
}

export const StaffList: React.FC<StaffListProps> = ({
  currentUser,
  allUsers,
  users = [],
  allRoles,
  roles = [],
  allDepts,
  departments = [],
  assignments = [],
  tasks = [],
  onAssignTaskToUser,
  onOpenUserDetails,
  onRemoveMember
}) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const effectiveUsers = allUsers || users || [];
  const effectiveRoles = allRoles || roles || [];
  const effectiveDepts = allDepts || departments || [];

  // Group assignments per user
  const userMemberships = effectiveUsers.map(user => {
    const userAsgns = assignments.filter(a => a.userId === user.id && a.isActive);
    const userRoleDetails = userAsgns.map(a => {
      const role = effectiveRoles.find(r => r.id === a.roleId);
      const dept = effectiveDepts.find(d => d.id === a.deptId);
      return { role, dept, assignment: a };
    }).filter(item => item.role && item.dept);

    // Calculate task counts per user including B7 6-state system
    const userTasks = tasks.filter(t => t.assignedToUserId === user.id);
    const pendingCount = userTasks.filter(t => t.status === 'pending').length;
    const helpCount = userTasks.filter(t => t.status === 'help').length;
    const submittedCount = userTasks.filter(t => t.status === 'submitted').length;
    const doneCount = userTasks.filter(t => t.status === 'done').length;
    const rejectedCount = userTasks.filter(t => t.status === 'rejected').length;
    const expiredCount = userTasks.filter(t => t.status === 'expired').length;

    const isLead = isUserLead(user.id, assignments, effectiveRoles, effectiveDepts);

    return {
      user,
      roles: userRoleDetails,
      tasks: userTasks,
      isLead,
      counts: {
        total: userTasks.length,
        pending: pendingCount,
        help: helpCount,
        submitted: submittedCount,
        done: doneCount,
        rejected: rejectedCount,
        expired: expiredCount
      }
    };
  });

  // Department-wide summary counts
  const orgSummary = {
    pending: tasks.filter(t => t.status === 'pending').length,
    help: tasks.filter(t => t.status === 'help').length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
    done: tasks.filter(t => t.status === 'done').length,
    rejected: tasks.filter(t => t.status === 'rejected').length,
    expired: tasks.filter(t => t.status === 'expired').length
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#DAD5C9]">
        <div>
          <h2 className="text-lg font-bold text-[#1C2438] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#2F3B7A]" />
            Staff & Workload Matrix
          </h2>
          <p className="text-xs text-[#5C574B] font-mono mt-0.5">
            Active organizational assignments, authority status, and real-time execution load.
          </p>
        </div>
      </div>

      {/* Staff Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {userMemberships.map(({ user, roles, isLead, counts }) => (
          <div
            key={user.id}
            onClick={() => setSelectedUser(user)}
            className="bg-white border border-[#DAD5C9] p-4 hover:border-[#1C2438] transition-all cursor-pointer rounded-xs shadow-2xs hover:shadow-xs flex flex-col justify-between"
          >
            <div>
              {/* User Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="relative">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="w-10 h-10 rounded-xs object-cover border border-[#DAD5C9]"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xs bg-[#F7F5F0] border border-[#DAD5C9] flex items-center justify-center font-bold font-mono text-[#1C2438] text-sm">
                      {user.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  {isLead && (
                    <span className="absolute -bottom-1 -right-1 p-0.5 rounded-xs bg-[#1C2438] text-white border border-white" title="Root Authority">
                      <Crown className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-[#1C2438] text-sm truncate">
                      {user.fullName}
                    </h3>
                    {user.preferredName && user.preferredName !== user.fullName && (
                      <span className="text-xs text-[#8A8578] font-mono">[{user.preferredName}]</span>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-[#8A8578] truncate">{user.email}</p>

                  <div className="mt-1.5">
                    {isLead ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider bg-[#1C2438] text-white font-mono">
                        <Shield className="w-2.5 h-2.5" /> ROOT_LEAD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-mono uppercase tracking-wider bg-[#F7F5F0] text-[#5C574B] border border-[#DAD5C9]">
                        STAFF_MEMBER
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Roles Held */}
              <div className="space-y-1.5 mb-3">
                <p className="text-[10px] font-bold text-[#8A8578] uppercase tracking-wider font-mono">
                  Assigned Roles [{roles.length}]
                </p>
                <div className="flex flex-wrap gap-1">
                  {roles.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-xs text-[10px] bg-[#F7F5F0] border border-[#DAD5C9] text-[#1C2438] font-mono inline-flex items-center gap-1"
                    >
                      <span className="font-bold">@{item.role?.title}</span>
                      <span className="text-[#8A8578]">[{item.dept?.name}]</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* B9: Task Spread Dots & Live Status using authoritative colors */}
            <div className="pt-3 border-t border-[#DAD5C9] flex items-center justify-between">
              <div className="flex items-center gap-1.5" title="Live task state breakdown">
                {counts.total === 0 ? (
                  <span className="text-xs font-mono text-[#8A8578]">IDLE // NO_TASKS</span>
                ) : (
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    {counts.pending > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]" title="Pending">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                        {counts.pending}
                      </span>
                    )}
                    {counts.help > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]" title="Help Needed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                        {counts.help}
                      </span>
                    )}
                    {counts.submitted > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold bg-[#FEFCE8] text-[#CA8A04] border border-[#FEF08A]" title="Submitted (Awaiting Review)">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
                        {counts.submitted}
                      </span>
                    )}
                    {counts.done > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]" title="Done">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                        {counts.done}
                      </span>
                    )}
                    {counts.rejected > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]" title="Denied">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                        {counts.rejected}
                      </span>
                    )}
                    {counts.expired > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" title="Expired">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
                        {counts.expired}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#1C2438] hover:underline flex items-center gap-1">
                Inspect <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* B9: Department-Wide Summary Bar */}
      <div className="bg-white border border-[#DAD5C9] p-4 rounded-xs shadow-2xs flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#1C2438]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1C2438]">
            System Partition Summary:
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="text-[#1C2438] font-bold">{orgSummary.pending} PENDING</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            <span className="text-[#1C2438] font-bold">{orgSummary.help} HELP_REQD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
            <span className="text-[#1C2438] font-bold">{orgSummary.submitted} SUBMITTED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span className="text-[#1C2438] font-bold">{orgSummary.done} APPROVED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="text-[#1C2438] font-bold">{orgSummary.rejected} DENIED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
            <span className="text-[#1C2438] font-bold">{orgSummary.expired} EXPIRED</span>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#DAD5C9] shadow-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-6 rounded-xs">
            <div className="flex items-start justify-between pb-4 border-b border-[#DAD5C9] mb-4">
              <div className="flex items-center gap-3">
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt="" className="w-12 h-12 rounded-xs object-cover border border-[#DAD5C9]" />
                ) : (
                  <div className="w-12 h-12 rounded-xs bg-[#F7F5F0] text-[#1C2438] border border-[#DAD5C9] font-bold font-mono text-lg flex items-center justify-center">
                    {selectedUser.fullName[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-[#1C2438]">
                    {selectedUser.fullName}
                  </h3>
                  <p className="text-xs font-mono text-[#8A8578]">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-[#8A8578] hover:text-[#1C2438] font-mono text-sm p-1 rounded-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Assignments & Scopes */}
            <div className="mb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8578] mb-2 font-mono">
                Active Assignments:
              </div>
              <div className="space-y-2">
                {assignments.filter(a => a.userId === selectedUser.id && a.isActive).map(a => {
                  const role = effectiveRoles.find(r => r.id === a.roleId);
                  const dept = effectiveDepts.find(d => d.id === a.deptId);
                  return (
                    <div key={a.id} className="p-3 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="font-bold text-[#1C2438]">{role?.title}</span>
                        <span className="text-[#8A8578]"> in {dept?.name}</span>
                      </div>
                      <span className="text-[10px] text-[#16A34A] font-bold">Active</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#DAD5C9]">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-1.5 bg-[#1C2438] text-white text-xs font-mono uppercase tracking-wider font-bold rounded-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
