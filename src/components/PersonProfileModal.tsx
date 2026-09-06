import React from 'react';
import { User, Role, Department, Assignment } from '../types';
import { AuthorityBadge } from './ui';
import { isRoleRoot, isRoleSectionRoot } from '../lib/orgRules';
import { 
  X, 
  Mail, 
  Building2, 
  ShieldCheck, 
  Calendar, 
  MessageSquare,
  UserCheck,
  Award
} from 'lucide-react';

interface PersonProfileModalProps {
  user: User;
  currentUser: User;
  allRoles: Role[];
  allDepts: Department[];
  assignments: Assignment[];
  onClose: () => void;
  onStartMessage?: (targetUserId: string) => void;
  canMessageTarget?: boolean;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  user,
  currentUser,
  allRoles,
  allDepts,
  assignments,
  onClose,
  onStartMessage,
  canMessageTarget = false
}) => {
  // Get active roles for this user
  const userAssignments = assignments.filter(a => a.userId === user.id && a.isActive);
  const rolesWithDepts = userAssignments.map(asgn => {
    const role = allRoles.find(r => r.id === asgn.roleId);
    const dept = allDepts.find(d => d.id === asgn.deptId);
    return { role, dept, asgn };
  });

  const isSelf = user.id === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="bg-white border border-[#E5E7EB] rounded-xs max-w-lg w-full shadow-xl overflow-hidden">
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6B7280]">
              Personnel Profile
            </span>
            {isSelf && (
              <span className="text-[9px] font-mono bg-[#E5E7EB] text-[#374151] px-1.5 py-0.5 rounded-xs">
                You
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#6B7280] hover:text-[#111827] rounded-xs transition-colors cursor-pointer"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Identity Section */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xs bg-[#1F2937] text-white flex items-center justify-center font-mono font-bold text-lg shrink-0 shadow-xs">
              {user.preferredName?.[0] || user.fullName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-[#111827] tracking-tight">
                {user.fullName}
              </h2>
              {user.preferredName && user.preferredName !== user.fullName && (
                <p className="text-xs text-[#6B7280]">Known as "{user.preferredName}"</p>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-[#4B5563]">
                <Mail className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>{user.email}</span>
              </div>
            </div>
          </div>

          {/* Organizational Assignments */}
          <div className="mt-6 pt-5 border-t border-[#E5E7EB]">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] mb-3 flex items-center gap-1.5 font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Assigned Positions ({rolesWithDepts.length})</span>
            </h3>

            {rolesWithDepts.length === 0 ? (
              <p className="text-xs text-[#6B7280] italic">No active roles currently assigned.</p>
            ) : (
              <div className="space-y-2.5">
                {rolesWithDepts.map(({ role, dept }, idx) => {
                  const isRootRole = role ? isRoleRoot(role, dept) : false;
                  const isSectionRootRole = role ? isRoleSectionRoot(role, dept) : false;
                  const isLead = isRootRole || isSectionRootRole || role?.roleType === 'master_root';

                  return (
                    <div 
                      key={idx}
                      className="p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-[#111827]">
                          {role?.title || 'Staff Role'}
                        </div>
                        <div className="text-[11px] text-[#6B7280] mt-0.5">
                          Department: <span className="font-medium text-[#374151]">{dept?.name || 'Unknown'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <AuthorityBadge
                          isLead={isLead}
                          level={
                            role?.roleType === 'master_root'
                              ? 'master_root'
                              : isSectionRootRole
                              ? 'section_root'
                              : isRootRole
                              ? 'dept_root'
                              : 'staff'
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Member Meta */}
          <div className="mt-5 pt-4 border-t border-[#E5E7EB] grid grid-cols-2 gap-3 text-xs font-mono text-[#6B7280]">
            <div>
              <span className="text-[10px] uppercase text-[#9CA3AF] block">Personnel ID</span>
              <span className="text-[#374151]">{user.id}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-[#9CA3AF] block">Account Status</span>
              <span className="text-[#059669] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Active Enrolled
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-[#F9FAFB] border-t border-[#E5E7EB] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-[#4B5563] hover:text-[#111827] rounded-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          {!isSelf && onStartMessage && canMessageTarget && (
            <button
              onClick={() => {
                onStartMessage(user.id);
                onClose();
              }}
              className="px-4 py-2 bg-[#1F2937] hover:bg-[#111827] text-white text-xs font-mono uppercase tracking-wider font-bold rounded-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Send Message</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
