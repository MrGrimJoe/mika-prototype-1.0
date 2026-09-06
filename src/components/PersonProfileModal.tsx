import React, { useState } from 'react';
import {
  User,
  Role,
  Department,
  Assignment,
  Organization,
  IntegrationConnection,
  UserIntegrationCompliance,
  JoinLink,
} from '../types';
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
  Award,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  isUserAnyRoot,
  getUserToolAccessSummary,
  INTEGRATION_TOOLS,
} from '../lib/integrationService';
import { OAuthConnectModal } from './OAuthConnectModal';

interface PersonProfileModalProps {
  user: User;
  currentUser: User;
  currentOrg?: Organization | null;
  allRoles: Role[];
  allDepts: Department[];
  assignments: Assignment[];
  allUsers?: User[];
  connections?: IntegrationConnection[];
  userCompliances?: UserIntegrationCompliance[];
  joinLinks?: JoinLink[];
  onClose: () => void;
  onStartMessage?: (targetUserId: string) => void;
  canMessageTarget?: boolean;
  onOpenSettings?: () => void;
  onSatisfyRequirement?: (toolKey: string, accountLabel: string) => Promise<void> | void;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  user,
  currentUser,
  currentOrg,
  allRoles,
  allDepts,
  assignments,
  allUsers = [],
  connections = [],
  userCompliances = [],
  joinLinks = [],
  onClose,
  onStartMessage,
  canMessageTarget = false,
  onOpenSettings,
  onSatisfyRequirement,
}) => {
  const [connectingToolKey, setConnectingToolKey] = useState<string | null>(null);

  // Get active roles for this user
  const userAssignments = assignments.filter((a) => a.userId === user.id && a.isActive);
  const rolesWithDepts = userAssignments.map((asgn) => {
    const role = allRoles.find((r) => r.id === asgn.roleId);
    const dept = allDepts.find((d) => d.id === asgn.deptId);
    return { role, dept, asgn };
  });

  const isSelf = user.id === currentUser.id;
  const isMasterRoot = currentOrg?.masterRootUserId === user.id;
  const isTargetAnyRoot = isUserAnyRoot(user.id, currentOrg, allRoles, assignments);

  // Compute integrations this user has access to
  const accessSummary = getUserToolAccessSummary(
    user.id,
    connections,
    assignments,
    allRoles,
    allDepts,
    allUsers,
    isMasterRoot
  ).filter((item) => item.hasAccess);

  // Find required integrations for user's assigned roles
  const userRoleIds = userAssignments.map((a) => a.roleId);
  const relevantLinks = joinLinks.filter((l) => userRoleIds.includes(l.roleId) && l.requiredIntegrations?.length);

  // Map each required integration with all its originating role titles
  const satisfiedKeys = new Set(
    userCompliances.filter((c) => c.userId === user.id).map((c) => c.integrationKey)
  );

  const requiredMap = new Map<string, { toolKey: string; roleTitles: string[]; satisfied: boolean }>();

  relevantLinks.forEach((link) => {
    (link.requiredIntegrations || []).forEach((toolKey) => {
      const existing = requiredMap.get(toolKey);
      if (existing) {
        if (!existing.roleTitles.includes(link.roleTitle)) {
          existing.roleTitles.push(link.roleTitle);
        }
      } else {
        requiredMap.set(toolKey, {
          toolKey,
          roleTitles: [link.roleTitle],
          satisfied: satisfiedKeys.has(toolKey),
        });
      }
    });
  });

  const requiredList = Array.from(requiredMap.values()).map(item => ({
    toolKey: item.toolKey,
    roleTitle: item.roleTitles.join(', '),
    satisfied: item.satisfied
  }));

  const activeOAuthTool = connectingToolKey
    ? INTEGRATION_TOOLS.find((t) => t.key === connectingToolKey) || null
    : null;

  return (
    <div
      id="person-profile-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150"
    >
      <div
        id="person-profile-modal-container"
        className="bg-white border border-[#DAD5C9] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-[#DAD5C9] flex items-center justify-between bg-[#FAF9F6]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578] font-bold">
              Personnel Profile
            </span>
            {isSelf && (
              <span className="text-[9px] font-mono bg-[#2F3B7A] text-white px-2 py-0.5 rounded-full font-bold">
                You
              </span>
            )}
            {isTargetAnyRoot && (
              <span className="text-[9px] font-mono bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                Root
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            id="close-profile-modal-btn"
            className="p-1 text-[#8A8578] hover:text-[#1C2438] rounded-md transition-colors cursor-pointer"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Identity Section */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#1C2438] text-white flex items-center justify-center font-mono font-bold text-lg shrink-0 shadow-xs">
              {user.preferredName?.[0] || user.fullName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#1C2438] tracking-tight truncate">
                  {user.fullName}
                </h2>
              </div>
              {user.preferredName && user.preferredName !== user.fullName && (
                <p className="text-xs text-[#8A8578]">Known as "{user.preferredName}"</p>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-[#5C574B]">
                <Mail className="w-3.5 h-3.5 text-[#8A8578]" />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>

          {/* ROOT ONLY SETTINGS BUTTON: ONLY roots see this in their profile when viewing self! */}
          {isSelf && isTargetAnyRoot && onOpenSettings && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2F3B7A] text-white flex items-center justify-center shadow-2xs">
                  <SettingsIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1C2438]">
                    Workspace & Integration Settings
                  </div>
                  <div className="text-[11px] text-[#5C574B]">
                    Manage tools, OAuth connectors, and role permissions
                  </div>
                </div>
              </div>
              <button
                type="button"
                id="profile-open-settings-btn"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="px-3 py-1.5 bg-[#2F3B7A] hover:bg-indigo-900 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>
          )}

          {/* Organizational Assignments */}
          <div className="pt-2">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#8A8578] mb-2.5 flex items-center gap-1.5 font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Assigned Positions ({rolesWithDepts.length})</span>
            </h3>

            {rolesWithDepts.length === 0 ? (
              <p className="text-xs text-[#8A8578] italic">No active roles currently assigned.</p>
            ) : (
              <div className="space-y-2">
                {rolesWithDepts.map(({ role, dept }, idx) => {
                  const isRootRole = role ? isRoleRoot(role, dept) : false;
                  const isSectionRootRole = role ? isRoleSectionRoot(role, dept) : false;
                  const isLead = isRootRole || isSectionRootRole || role?.roleType === 'master_root';

                  return (
                    <div 
                      key={idx}
                      className="p-3 bg-[#FAF9F6] border border-[#DAD5C9] rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-[#1C2438]">
                          {role?.title || 'Staff Role'}
                        </div>
                        <div className="text-[11px] text-[#8A8578] mt-0.5">
                          Department: <span className="font-medium text-[#5C574B]">{dept?.name || 'Unknown'}</span>
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

          {/* Integration Access Section (Section 4.1) */}
          <div className="pt-2 border-t border-[#DAD5C9]">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#8A8578] mb-2.5 flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Available Connected Tools ({accessSummary.length})</span>
            </h3>

            <div className="space-y-1.5">
              {accessSummary.map((item) => (
                <div
                  key={item.tool.key}
                  className="p-2.5 bg-white border border-[#DAD5C9] rounded-lg flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{item.tool.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono-code">
                      {item.accountLabel}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {item.grantedByLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Required Integrations Section (Section 4.2) */}
          {requiredList.length > 0 && (
            <div className="pt-2 border-t border-[#DAD5C9]">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#8A8578] mb-2.5 flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Role Required Connectors</span>
              </h3>

              <div className="space-y-2">
                {requiredList.map((req) => {
                  const toolDef = INTEGRATION_TOOLS.find((t) => t.key === req.toolKey);
                  const toolName = toolDef?.name || req.toolKey;

                  return (
                    <div
                      key={req.toolKey}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        req.satisfied
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/60 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {req.satisfied ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold">
                            {req.satisfied
                              ? `Connected ${toolName} as required by ${req.roleTitle}`
                              : `Required by ${req.roleTitle} — not connected`}
                          </div>
                        </div>
                      </div>

                      {!req.satisfied && isSelf && onSatisfyRequirement && (
                        <button
                          type="button"
                          onClick={() => setConnectingToolKey(req.toolKey)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
                        >
                          Connect now
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Member Meta */}
          <div className="pt-2 border-t border-[#DAD5C9] grid grid-cols-2 gap-3 text-xs font-mono text-[#8A8578]">
            <div>
              <span className="text-[10px] uppercase text-[#8A8578] block">Personnel ID</span>
              <span className="text-[#1C2438]">{user.id}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-[#8A8578] block">Account Status</span>
              <span className="text-[#059669] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Active Enrolled
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-[#FAF9F6] border-t border-[#DAD5C9] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>

          {!isSelf && onStartMessage && canMessageTarget && (
            <button
              onClick={() => {
                onStartMessage(user.id);
                onClose();
              }}
              className="px-4 py-2 bg-[#1C2438] hover:bg-black text-white text-xs font-mono uppercase tracking-wider font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Send Message</span>
            </button>
          )}
        </div>
      </div>

      {/* Triggered OAuth for required integration */}
      {activeOAuthTool && onSatisfyRequirement && (
        <OAuthConnectModal
          tool={activeOAuthTool}
          scope="root"
          onSuccess={async (accountLabel) => {
            const key = activeOAuthTool.key;
            setConnectingToolKey(null);
            await onSatisfyRequirement(key, accountLabel);
          }}
          onClose={() => setConnectingToolKey(null)}
        />
      )}
    </div>
  );
};

