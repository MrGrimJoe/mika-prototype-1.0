import React, { useState } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Shield,
  Layers,
  HardDrive,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Crown,
  Link as LinkIcon,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  User,
  Organization,
  Role,
  Department,
  Assignment,
  IntegrationConnection,
  UserIntegrationCompliance,
} from '../types';
import {
  INTEGRATION_TOOLS,
  isUserAnyRoot,
  getUserToolAccessSummary,
  UserAccessDetail,
} from '../lib/integrationService';
import { IntegrationChecklist } from './IntegrationChecklist';
import { IntegrationAccessConfigModal } from './IntegrationAccessConfigModal';
import { OAuthConnectModal } from './OAuthConnectModal';
import { upsertIntegrationConnection, removeIntegrationConnection, upsertUserCompliance } from '../lib/firestoreService';

interface SettingsModalProps {
  currentUser: User;
  currentOrg: Organization | null;
  roles: Role[];
  departments: Department[];
  assignments: Assignment[];
  allUsers: User[];
  connections: IntegrationConnection[];
  userCompliances: UserIntegrationCompliance[];
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  currentOrg,
  roles,
  departments,
  assignments,
  allUsers,
  connections,
  userCompliances,
  onClose,
}) => {
  // Settings MUST default directly onto the Integrations tab!
  const [activeTab, setActiveTab] = useState<'integrations' | 'general' | 'authority'>('integrations');
  const [showRoleConfig, setShowRoleConfig] = useState(false);
  const [activeComplianceOAuth, setActiveComplianceOAuth] = useState<any>(null);

  const isMasterRoot = currentOrg?.masterRootUserId === currentUser.id;
  const isAnyRoot = isUserAnyRoot(currentUser.id, currentOrg, roles, assignments);

  // Filter org-wide vs root-scoped connections
  const orgWideConnections = connections.filter((c) => c.scope === 'org');
  const myRootConnections = connections.filter(
    (c) => c.scope === 'root' && c.scopeRootUserId === currentUser.id
  );

  // Access summary for current user
  const userAccessList = getUserToolAccessSummary(
    currentUser.id,
    connections,
    assignments,
    roles,
    departments,
    allUsers,
    isMasterRoot
  );

  // Outstanding required integrations for plain role users
  const satisfiedKeys = userCompliances.map((c) => c.integrationKey);
  const userRoleIds = assignments
    .filter((a) => a.userId === currentUser.id && a.isActive)
    .map((a) => a.roleId);

  // Connect handler
  const handleConnectTool = async (toolKey: string, accountLabel: string) => {
    const orgId = currentOrg?.id || currentUser.orgId || 'org_oakridge';
    const scope: 'org' | 'root' = isMasterRoot ? 'org' : 'root';

    const newConn: IntegrationConnection = {
      id: `conn-${Date.now()}-${toolKey}`,
      integrationKey: toolKey,
      orgId,
      scope,
      scopeRootUserId: scope === 'root' ? currentUser.id : undefined,
      accessRoleIds: 'all', // can be customized via role config
      connectedByUserId: currentUser.id,
      accountLabel,
      connectedAt: new Date().toISOString(),
    };

    await upsertIntegrationConnection(newConn);
  };

  const handleDisconnectTool = async (connId: string) => {
    await removeIntegrationConnection(connId);
  };

  const handleSaveRoleConfig = async (updated: IntegrationConnection[]) => {
    for (const conn of updated) {
      await upsertIntegrationConnection(conn);
    }
    setShowRoleConfig(false);
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="settings-modal-container"
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#FAF9F6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2F3B7A] text-white flex items-center justify-center shadow-xs">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-serif-heading">Settings</h2>
                {isMasterRoot && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Master Root
                  </span>
                )}
                {!isMasterRoot && isAnyRoot && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Root Scope
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {currentOrg?.name || 'Organization Workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="close-settings-modal-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('integrations')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'integrations'
                ? 'border-[#2F3B7A] text-[#2F3B7A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Integrations & Tools</span>
          </button>

          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'general'
                ? 'border-[#2F3B7A] text-[#2F3B7A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Storage & Capacity</span>
          </button>

          <button
            onClick={() => setActiveTab('authority')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'authority'
                ? 'border-[#2F3B7A] text-[#2F3B7A]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Authority Cascade</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {isMasterRoot
                      ? 'Organization Connected Tools'
                      : isAnyRoot
                      ? 'Your Department Tools & Connectors'
                      : 'Your Connected Tools & Access'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isMasterRoot
                      ? 'Connect Workspace, GitHub, Figma, Canva, and Classroom org-wide. Manage which roles have access to each tool.'
                      : isAnyRoot
                      ? 'Connect tools scoped directly to your subordinate roles and departments without requiring master root authorization.'
                      : 'Overview of connected productivity and engineering tools granted by your administrators and department roots.'}
                  </p>
                </div>

                {isMasterRoot && orgWideConnections.length > 0 && (
                  <button
                    type="button"
                    id="manage-role-access-btn"
                    onClick={() => setShowRoleConfig(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#2F3B7A] border border-indigo-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Manage Role Permissions</span>
                  </button>
                )}
              </div>

              {/* VIEW 1: Master Root (Org-wide connect + role assignment) */}
              {isMasterRoot && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      As Master Root, connections you link here are available org-wide. You can set them to all roles or limit them to specific groups.
                    </span>
                  </div>

                  <IntegrationChecklist
                    connections={connections}
                    scope="org"
                    isEnterpriseOrg={currentOrg?.storageType === 'drive' || Boolean(currentOrg?.integrations?.google?.keep)}
                    onConnect={handleConnectTool}
                    onDisconnect={handleDisconnectTool}
                  />
                </div>
              )}

              {/* VIEW 2: Sub-Root (Dept or Section Root) */}
              {!isMasterRoot && isAnyRoot && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      <strong>Root Authority:</strong> Tools you link here will be automatically granted to your own subordinate positions and reports.
                    </span>
                  </div>

                  <IntegrationChecklist
                    connections={connections}
                    scope="root"
                    orgWideConnections={orgWideConnections}
                    isEnterpriseOrg={currentOrg?.storageType === 'drive'}
                    onConnect={handleConnectTool}
                    onDisconnect={handleDisconnectTool}
                  />
                </div>
              )}

              {/* VIEW 3: Plain-Role User (Read-only access list + outstanding compliance) */}
              {!isAnyRoot && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Your Available Tools
                    </div>
                    <div className="space-y-2">
                      {userAccessList.map((item) => (
                        <div
                          key={item.tool.key}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            item.hasAccess
                              ? 'bg-white border-slate-200 shadow-2xs'
                              : 'bg-slate-50/60 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center ${
                                item.hasAccess
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-400'
                              }`}
                            >
                              {item.hasAccess ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 flex items-center gap-2">
                                <span>{item.tool.name}</span>
                                {item.scope === 'always_included' && (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    Vault Core
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {item.tool.description}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            {item.hasAccess ? (
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.grantedByLabel}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Not granted to your role
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STORAGE & GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-1">Organization Workspace</h4>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Organization Name</span>
                    <span className="font-semibold text-slate-800">{currentOrg?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Slug</span>
                    <span className="font-mono-code text-slate-700">{currentOrg?.slug}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Subscribed Headcount</span>
                    <span className="font-semibold text-slate-800">{currentOrg?.teamSize || 10} members</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Storage Allocation</span>
                    <span className="font-semibold text-slate-800">{currentOrg?.storageGiB || 250} GiB Cloud</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUTHORITY CASCADE */}
          {activeTab === 'authority' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-slate-800 mb-1">Department Structure & Cascade</h4>
                <p className="text-slate-500 mb-3">
                  Authority cascades strictly along the organizational tree. Roots manage their direct teams and can grant integrations downward.
                </p>
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-slate-800">{dept.name}</span>
                        {dept.isTemporary && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px]">
                            temporary
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 text-[11px] font-mono-code">
                        {roles.filter((r) => r.deptId === dept.id).length} roles
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-[#FAF9F6] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono-code">
            Mika Settings • Integrations & Security
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Role Access Permissions Modal */}
      {showRoleConfig && (
        <IntegrationAccessConfigModal
          connections={orgWideConnections}
          roles={roles}
          departments={departments}
          onSave={handleSaveRoleConfig}
          onContinue={() => setShowRoleConfig(false)}
        />
      )}
    </div>
  );
};
