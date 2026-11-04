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
import { ModalOverlay } from './ui/ModalOverlay';

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
      const url = `${window.location.origin}/?join=${firstLink.token}`;
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
        <div className="w-full max-w-md bg-surface border border-hairline rounded-xs p-8 sm:p-10 shadow-xs flex flex-col items-center">
          {/* Subtle Icon */}
          <div className="w-14 h-14 rounded-full bg-paper-raised border border-hairline flex items-center justify-center mb-5 text-ink-3">
            <Users className="w-7 h-7 stroke-[1.5]" />
          </div>

          {/* Primary Message */}
          <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            No employees yet
          </h2>

          <p className="mt-2 text-sm text-ink-2 leading-relaxed max-w-sm">
            There are currently no employees in the organization. When staff members accept an invitation link and join a role, they will appear here.
          </p>

          {/* Minimal, discrete test tools */}
          <div className="mt-6 pt-6 border-t border-paper-raised w-full flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {onGenerateInviteLink && (
              <button
                onClick={() => onGenerateInviteLink('', '')}
                className="w-full sm:w-auto px-4 py-2 text-xs font-mono font-semibold text-ink-2 bg-paper hover:bg-paper-raised border border-hairline rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5 text-ink-3" />
                <span>Invite Staff</span>
              </button>
            )}

            {onSimulateJoin && vacantRoles.length > 0 && (
              <button
                onClick={() => {
                  setSimRoleDept({ roleId: vacantRoles[0].id, deptId: vacantRoles[0].deptId });
                  setShowSimulateModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-strong rounded-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Simulate Join</span>
              </button>
            )}
          </div>
        </div>

        {/* Simulation Modal (Only opens if user clicks 'Simulate Join') */}
        {showSimulateModal && (
          <ModalOverlay onClose={() => setShowSimulateModal(false)} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface border border-hairline rounded-xs p-6 max-w-md w-full shadow-xl text-left">
              <div className="flex items-center justify-between pb-3 border-b border-hairline">
                <h3 className="font-bold text-sm text-ink font-mono">
                  Simulate Employee Join
                </h3>
                <button 
                  onClick={() => setShowSimulateModal(false)}
                  className="text-xs font-mono text-ink-3 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSimulateSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-mono text-ink-2 mb-1">
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
                    className="w-full px-3 py-2 bg-paper border border-hairline rounded-xs text-xs font-mono text-ink"
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
                  <label className="block text-xs font-mono text-ink-2 mb-1">
                    Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={simName}
                    onChange={e => setSimName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-xs font-sans text-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-ink-2 mb-1">
                    Email Address:
                  </label>
                  <input
                    type="email"
                    required
                    value={simEmail}
                    onChange={e => setSimEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-hairline rounded-xs text-xs font-mono text-ink"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSimulateModal(false)}
                    className="px-3.5 py-1.5 text-xs font-mono text-ink-3 hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-accent hover:bg-accent-strong text-white text-xs font-semibold rounded-xs cursor-pointer shadow-xs"
                  >
                    Join Role
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Employees ({employees.length})
          </h1>
          <p className="text-xs text-ink-3 mt-0.5">
            Active staff members currently enrolled in your organization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onResetEmployees && (
            <button aria-label="Reset all employees back to empty state"
              onClick={onResetEmployees}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-st-pending hover:bg-st-pending-bg border border-[#FCA5A5] rounded-xs transition-colors cursor-pointer"
              title="Reset all employees back to empty state"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Employees</span>
            </button>
          )}

          {onGenerateInviteLink && (
            <button
              onClick={() => onGenerateInviteLink('', '')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-strong rounded-xs transition-colors cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite New Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Employees Table / Cards */}
      <div className="bg-surface border border-hairline rounded-xs shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="block md:table w-full text-left text-xs">
            <thead className="hidden md:table-header-group bg-paper border-b border-hairline text-[11px] text-ink-3">
              <tr>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Assigned Role & Department</th>
                <th className="px-5 py-3 font-medium">Authority Level</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group divide-y divide-hairline">
              {employees.map(({ user, roles }) => (
                <tr key={user.id} className="block md:table-row p-4 md:p-0 hover:bg-paper transition-colors">
                  <td className="block md:table-cell px-0 md:px-5 py-1.5 md:py-4">
                    <button aria-label={`View ${user.fullName}'s profile`}
                      onClick={() => onViewProfile && onViewProfile(user)}
                      className="flex items-center gap-3 text-left group cursor-pointer"
                      title={`View ${user.fullName}'s profile`}
                    >
                      <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-xs shrink-0 group-hover:ring-2 group-hover:ring-ink group-hover:ring-offset-1 transition-all">
                        {user.preferredName?.[0] || user.fullName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-ink group-hover:underline">{user.fullName}</div>
                        <div className="text-[11px] font-mono text-ink-3">ID: {user.id}</div>
                      </div>
                    </button>
                  </td>

                  <td data-label="Email" className="block md:table-cell px-0 md:px-5 py-1.5 md:py-4 text-ink-2 before:content-[attr(data-label)] before:block before:text-[11px] before:font-medium before:text-ink-3 before:mb-0.5 md:before:hidden">
                    {user.email}
                  </td>

                  <td data-label="Role & department" className="block md:table-cell px-0 md:px-5 py-1.5 md:py-4 before:content-[attr(data-label)] before:block before:text-[11px] before:font-medium before:text-ink-3 before:mb-0.5 md:before:hidden">
                    <div className="space-y-1">
                      {roles.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="font-semibold text-ink">
                            {r.role?.title || 'Unknown Role'}
                          </span>
                          <span className="text-ink-3">·</span>
                          <span className="text-ink-2 text-[11px]">
                            {r.dept?.name || 'Department'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td data-label="Authority" className="block md:table-cell px-0 md:px-5 py-1.5 md:py-4 before:content-[attr(data-label)] before:block before:text-[11px] before:font-medium before:text-ink-3 before:mb-0.5 md:before:hidden">
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

                  <td data-label="Status" className="block md:table-cell px-0 md:px-5 py-1.5 md:py-4 before:content-[attr(data-label)] before:block before:text-[11px] before:font-medium before:text-ink-3 before:mb-0.5 md:before:hidden">
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
