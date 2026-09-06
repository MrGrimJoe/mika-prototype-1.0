import React, { useState } from 'react';
import { 
  Role, 
  Department, 
  User, 
  Assignment, 
  JoinLink 
} from '../types';
import { AuthorityBadge } from './ui';
import { isRoleRoot, isRoleSectionRoot } from '../lib/orgRules';
import { 
  Users, 
  UserPlus, 
  Link2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Trash2,
  Mail,
  Building2,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface RolesDashboardProps {
  currentUser: User;
  allRoles: Role[];
  allDepts: Department[];
  allUsers: User[];
  assignments: Assignment[];
  joinLinks: JoinLink[];
  masterRootUserId?: string;
  onGenerateInviteLink?: (roleId: string, deptId: string) => void;
  onSimulateJoin?: (roleId: string, deptId: string, user: { name: string; email: string }) => void;
  onResetEmployees?: () => void;
  onViewGraph?: () => void;
  onViewProfile?: (user: User) => void;
}

export const RolesDashboard: React.FC<RolesDashboardProps> = ({
  currentUser,
  allRoles,
  allDepts,
  allUsers,
  assignments,
  joinLinks,
  masterRootUserId,
  onGenerateInviteLink,
  onSimulateJoin,
  onResetEmployees,
  onViewGraph,
  onViewProfile
}) => {
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simRoleDept, setSimRoleDept] = useState<{ roleId: string; deptId: string } | null>(null);
  const [simName, setSimName] = useState('Alice Chen');
  const [simEmail, setSimEmail] = useState('alice.chen@oakridge.edu');
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute all employee assignments (non-master-root active staff)
  const employeeAssignments = assignments.filter(a => {
    if (!a.isActive) return false;
    const r = allRoles.find(role => role.id === a.roleId);
    return r?.roleType !== 'master_root' && a.userId !== masterRootUserId;
  });

  // Group employee data
  const employeeMap = new Map<string, {
    user: User;
    roles: { role?: Role; dept?: Department; assignment: Assignment }[];
  }>();

  employeeAssignments.forEach(asgn => {
    const user = allUsers.find(u => u.id === asgn.userId);
    if (!user) return;
    const role = allRoles.find(r => r.id === asgn.roleId);
    const dept = allDepts.find(d => d.id === asgn.deptId);

    if (!employeeMap.has(user.id)) {
      employeeMap.set(user.id, {
        user,
        roles: []
      });
    }
    employeeMap.get(user.id)!.roles.push({ role, dept, assignment: asgn });
  });

  const employees = Array.from(employeeMap.values());
  const hasNoEmployees = employees.length === 0;

  // Available vacant roles for simulation if user wants to test
  const vacantRoles = allRoles.filter(r => {
    if (r.roleType === 'master_root' || r.id === 'role_principal') return false;
    return !assignments.some(a => a.roleId === r.id && a.isActive);
  });

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSimulateJoin) return;
    
    const target = simRoleDept || (vacantRoles[0] ? { roleId: vacantRoles[0].id, deptId: vacantRoles[0].deptId } : null);
    if (!target) return;

    onSimulateJoin(target.roleId, target.deptId, {
      name: simName.trim(),
      email: simEmail.trim()
    });
    setShowSimulateModal(false);
  };

  const handleCopyAnyLink = () => {
    const firstLink = joinLinks[0];
    if (firstLink) {
      const url = `${window.location.origin}/#join-${firstLink.token}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // CASE 1: NO EMPLOYEES YET (TEST CASE)
  // The user explicitly requested: "on the dashboard i should only see a no employees yet message"
  // ─────────────────────────────────────────────────────────────────────────────
  if (hasNoEmployees) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-xs p-8 sm:p-10 shadow-xs flex flex-col items-center">
          {/* Subtle Icon */}
          <div className="w-14 h-14 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center mb-5 text-[#6B7280]">
            <Users className="w-7 h-7 stroke-[1.5]" />
          </div>

          {/* Primary Message */}
          <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
            No employees yet
          </h2>

          <p className="mt-2 text-sm text-[#4B5563] leading-relaxed max-w-sm">
            There are currently no employees in the organization. When staff members accept an invitation link and join a role, they will appear here.
          </p>

          {/* Minimal, discrete test tools */}
          <div className="mt-6 pt-6 border-t border-[#F3F4F6] w-full flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {onGenerateInviteLink && (
              <button
                onClick={() => onGenerateInviteLink('', '')}
                className="w-full sm:w-auto px-4 py-2 text-xs font-mono uppercase tracking-wider font-semibold text-[#374151] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#D1D5DB] rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Invite Staff</span>
              </button>
            )}

            {onSimulateJoin && vacantRoles.length > 0 && (
              <button
                onClick={() => {
                  setSimRoleDept({ roleId: vacantRoles[0].id, deptId: vacantRoles[0].deptId });
                  setShowSimulateModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold text-white bg-[#1F2937] hover:bg-[#111827] rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Simulate Join</span>
              </button>
            )}
          </div>
        </div>

        {/* Simulation Modal (Only opens if user clicks 'Simulate Join') */}
        {showSimulateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xs p-6 max-w-md w-full shadow-xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <h3 className="font-bold text-sm text-[#111827] uppercase tracking-wider font-mono">
                  Simulate Employee Join
                </h3>
                <button 
                  onClick={() => setShowSimulateModal(false)}
                  className="text-xs font-mono text-[#6B7280] hover:text-[#111827]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSimulateSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[#4B5563] mb-1">
                    Select Role to Fill:
                  </label>
                  <select
                    value={simRoleDept?.roleId || vacantRoles[0]?.id}
                    onChange={e => {
                      const selectedRole = vacantRoles.find(r => r.id === e.target.value);
                      if (selectedRole) {
                        setSimRoleDept({ roleId: selectedRole.id, deptId: selectedRole.deptId });
                      }
                    }}
                    className="w-full px-3 py-2 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xs text-xs font-mono text-[#111827]"
                  >
                    {vacantRoles.map(r => {
                      const dept = allDepts.find(d => d.id === r.deptId);
                      return (
                        <option key={r.id} value={r.id}>
                          {r.title} ({dept?.name || 'Department'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#4B5563] mb-1">
                    Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={simName}
                    onChange={e => setSimName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D1D5DB] rounded-xs text-xs font-sans text-[#111827]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#4B5563] mb-1">
                    Email Address:
                  </label>
                  <input
                    type="email"
                    required
                    value={simEmail}
                    onChange={e => setSimEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#D1D5DB] rounded-xs text-xs font-mono text-[#111827]"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSimulateModal(false)}
                    className="px-3.5 py-1.5 text-xs font-mono text-[#6B7280] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1F2937] hover:bg-[#111827] text-white text-xs font-mono uppercase tracking-wider font-bold rounded-xs cursor-pointer shadow-xs"
                  >
                    Join Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CASE 2: EMPLOYEES EXIST (Displays all of your employees)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
            Employees ({employees.length})
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Active staff members currently enrolled in your organization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onResetEmployees && (
            <button
              onClick={onResetEmployees}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[#991B1B] hover:bg-[#FEF2F2] border border-[#FCA5A5] rounded-xs transition-colors cursor-pointer"
              title="Reset all employees back to empty state"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Employees</span>
            </button>
          )}

          {onGenerateInviteLink && (
            <button
              onClick={() => onGenerateInviteLink('', '')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-bold text-white bg-[#1F2937] hover:bg-[#111827] rounded-xs transition-colors cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite New Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Employees Table / Cards */}
      <div className="bg-white border border-[#E5E7EB] rounded-xs shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-mono uppercase tracking-wider text-[#6B7280]">
              <tr>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Assigned Role & Department</th>
                <th className="px-5 py-3 font-medium">Authority Level</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {employees.map(({ user, roles }) => (
                <tr key={user.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-5 py-4">
                    <button
                      onClick={() => onViewProfile && onViewProfile(user)}
                      className="flex items-center gap-3 text-left group cursor-pointer"
                      title={`View ${user.fullName}'s profile`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1F2937] text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 group-hover:ring-2 group-hover:ring-[#1F2937] group-hover:ring-offset-1 transition-all">
                        {user.preferredName?.[0] || user.fullName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-[#111827] group-hover:underline">{user.fullName}</div>
                        <div className="text-[10px] font-mono text-[#6B7280]">ID: {user.id}</div>
                      </div>
                    </button>
                  </td>

                  <td className="px-5 py-4 font-mono text-[#4B5563]">
                    {user.email}
                  </td>

                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      {roles.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#111827]">
                            {r.role?.title || 'Unknown Role'}
                          </span>
                          <span className="text-[#9CA3AF]">·</span>
                          <span className="text-[#4B5563] text-[11px]">
                            {r.dept?.name || 'Department'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {roles.map((r, i) => {
                        const isRootRole = r.role ? isRoleRoot(r.role, r.dept) : false;
                        const isSectionRootRole = r.role ? isRoleSectionRoot(r.role, r.dept) : false;
                        const isLead = isRootRole || isSectionRootRole || r.role?.roleType === 'master_root';
                        return (
                          <AuthorityBadge
                            key={i}
                            isLead={isLead}
                            level={
                              r.role?.roleType === 'master_root'
                                ? 'master_root'
                                : isSectionRootRole
                                ? 'section_root'
                                : isRootRole
                                ? 'dept_root'
                                : 'staff'
                            }
                            size="sm"
                          />
                        );
                      })}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#059669] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
