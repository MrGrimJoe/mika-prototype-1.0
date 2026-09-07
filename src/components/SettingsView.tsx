import React, { useState, useEffect } from 'react';
import {
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
  RefreshCw,
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
import {
  upsertIntegrationConnection,
  removeIntegrationConnection,
  upsertUserCompliance,
} from '../lib/firestoreService';

interface SettingsViewProps {
  currentUser: User;
  currentOrg: Organization | null;
  roles: Role[];
  departments: Department[];
  assignments: Assignment[];
  allUsers: User[];
  connections: IntegrationConnection[];
  userCompliances: UserIntegrationCompliance[];
  onClose?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
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
  // Always default directly onto Integrations
  const [activeTab, setActiveTab] = useState<'integrations' | 'general' | 'storage' | 'roles'>('integrations');
  const [selectedToolForOAuth, setSelectedToolForOAuth] = useState<string | null>(null);
  const [selectedToolForConfig, setSelectedToolForConfig] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const isMasterRoot = currentOrg?.masterRootUserId === currentUser.id || currentUser.isRoot || currentUser.roleTitle?.toLowerCase().includes('principal');
  const isAnyRoot = isUserAnyRoot(currentUser.id, currentOrg, roles, assignments);
  const isEnterprise = currentOrg?.storageType === 'byod' || currentOrg?.storageType === 'drive';

  const orgWideConnections = connections.filter((c) => c.scope === 'org');

  // Handle GitHub OAuth redirect parameters & postMessage events
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedTool = params.get('integration_connected');
    const account = params.get('account');
    const error = params.get('integration_error');

    if (connectedTool === 'github') {
      const label = account ? `@${account}` : 'your GitHub account';
      setStatusFeedback(`Successfully connected GitHub as ${label}.`);

      // Ensure connection is recorded in Firestore
      try {
        const storedStr = localStorage.getItem('mika_last_connected_github');
        if (storedStr) {
          const stored = JSON.parse(storedStr);
          upsertIntegrationConnection(stored);
          localStorage.removeItem('mika_last_connected_github');
        } else {
          // Fetch public connections from backend
          fetch('/api/integrations/connections')
            .then(res => res.json())
            .then(data => {
              if (data.connections) {
                const gh = data.connections.find((c: any) => c.integrationKey === 'github');
                if (gh) upsertIntegrationConnection(gh);
              }
            })
            .catch(() => {});
        }
      } catch (e) {}

      // Clean URL params
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('integration_connected');
      newUrl.searchParams.delete('account');
      window.history.replaceState({}, '', newUrl.toString());

      setTimeout(() => setStatusFeedback(null), 5000);
    } else if (error) {
      setStatusFeedback(`GitHub authorization failed: ${error.replace(/_/g, ' ')}`);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('integration_error');
      window.history.replaceState({}, '', newUrl.toString());
      setTimeout(() => setStatusFeedback(null), 5000);
    }
  }, []);

  // Popup postMessage listener
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        const accountLabel = event.data.accountLabel || 'connected';
        if (event.data.connection) {
          await upsertIntegrationConnection(event.data.connection);
        }
        setStatusFeedback(`Successfully connected GitHub as @${accountLabel}.`);
        setTimeout(() => setStatusFeedback(null), 5000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const userAssignments = assignments.filter((a) => a.userId === currentUser.id);
  const userAccessSummary = getUserToolAccessSummary(
    currentUser.id,
    connections,
    assignments,
    roles,
    departments,
    allUsers,
    isMasterRoot
  );

  const handleConnectIntegration = (toolKey: string, accountLabel: string) => {
    setSelectedToolForOAuth(toolKey);
  };

  const handleOAuthSuccess = async (accountLabel: string) => {
    if (!selectedToolForOAuth) return;
    const tool = INTEGRATION_TOOLS.find((t) => t.key === selectedToolForOAuth);
    if (!tool) return;

    try {
      const scope: 'org' | 'root' = isMasterRoot ? 'org' : 'root';
      const newConn: IntegrationConnection = {
        id: `conn_${Date.now()}_${tool.key}`,
        integrationKey: tool.key,
        orgId: currentOrg?.id || 'org_oakridge',
        scope,
        scopeRootUserId: scope === 'root' ? currentUser.id : undefined,
        accessRoleIds: 'all',
        connectedByUserId: currentUser.id,
        accountLabel,
        connectedAt: new Date().toISOString(),
      };

      await upsertIntegrationConnection(newConn);
      setStatusFeedback(`Successfully connected ${tool.name} as ${accountLabel}.`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err: any) {
      setStatusFeedback(`Error connecting integration: ${err.message}`);
    } finally {
      setSelectedToolForOAuth(null);
    }
  };

  const handleDisconnect = async (connId: string) => {
    try {
      await removeIntegrationConnection(connId);
      setStatusFeedback('Integration disconnected.');
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      setStatusFeedback(`Error disconnecting: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DAD5C9]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
              ORGANISATION SETTINGS
            </span>
            {isMasterRoot && (
              <span className="text-[9px] font-mono bg-[#1C2438] text-white px-1.5 py-0.5 rounded-xs">
                MASTER ROOT
              </span>
            )}
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1C2438] tracking-tight mt-0.5">
            Settings & Integrations
          </h1>
          <p className="text-xs text-[#5C574B] mt-0.5">
            Configure {currentOrg?.name || 'Mika'} connected workspaces, storage endpoints, and authority governance.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start sm:self-auto text-xs font-mono text-[#5C574B] hover:text-[#1C2438] underline"
          >
            &larr; Back to Dashboard
          </button>
        )}
      </div>

      {statusFeedback && (
        <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1E40AF] rounded-xs flex items-center justify-between font-mono">
          <span>{statusFeedback}</span>
          <button onClick={() => setStatusFeedback(null)} className="text-[#1E40AF] hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#DAD5C9] bg-[#EFEBE2] p-1 rounded-xs gap-1">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xs transition-colors cursor-pointer ${
            activeTab === 'integrations'
              ? 'bg-[#1C2438] text-white shadow-xs font-bold'
              : 'text-[#5C574B] hover:text-[#1C2438] hover:bg-[#E8E4DA]'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Integrations & OAuth</span>
          {connections.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-xs ${
              activeTab === 'integrations' ? 'bg-white/20 text-white' : 'bg-[#DAD5C9] text-[#1C2438]'
            }`}>
              {connections.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xs transition-colors cursor-pointer ${
            activeTab === 'general'
              ? 'bg-[#1C2438] text-white shadow-xs font-bold'
              : 'text-[#5C574B] hover:text-[#1C2438] hover:bg-[#E8E4DA]'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>General</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xs transition-colors cursor-pointer ${
            activeTab === 'storage'
              ? 'bg-[#1C2438] text-white shadow-xs font-bold'
              : 'text-[#5C574B] hover:text-[#1C2438] hover:bg-[#E8E4DA]'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Storage & Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-mono font-medium rounded-xs transition-colors cursor-pointer ${
            activeTab === 'roles'
              ? 'bg-[#1C2438] text-white shadow-xs font-bold'
              : 'text-[#5C574B] hover:text-[#1C2438] hover:bg-[#E8E4DA]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Access & Roles</span>
        </button>
      </div>

      {/* TAB CONTENT: INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* My Access Summary Card */}
          <div className="bg-[#EFEBE2] border border-[#DAD5C9] p-5 rounded-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-serif font-bold text-[#1C2438]">
                  Your Personal Tool Access
                </h3>
                <p className="text-[11px] font-mono text-[#5C574B]">
                  Inherited from your active roles: {userAssignments.map(a => `@${roles.find(r => r.id === a.roleId)?.title || 'Role'}`).join(', ') || 'None'}
                </p>
              </div>
              <span className="text-[10px] font-mono text-[#2F3B7A] bg-white px-2 py-1 rounded-xs border border-[#DAD5C9]">
                {currentUser.email}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-[#DAD5C9]">
              {userAccessSummary.map((detail) => (
                <div
                  key={detail.tool.key}
                  className={`p-3 rounded-xs border text-xs font-mono flex items-center justify-between ${
                    detail.hasAccess
                      ? 'bg-white border-[#DAD5C9] text-[#1C2438]'
                      : 'bg-[#F7F5F0] border-[#E8E4DA] text-[#8A8578]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-xs bg-[#EFEBE2] flex items-center justify-center shrink-0">
                      <LinkIcon className="w-3.5 h-3.5 text-[#1C2438]" />
                    </div>
                    <div>
                      <div className="font-bold">{detail.tool.name}</div>
                      <div className="text-[10px] text-[#5C574B]">
                        {detail.hasAccess ? (
                          detail.grantedByLabel || 'Active Connection'
                        ) : (
                          'No Role Access'
                        )}
                      </div>
                    </div>
                  </div>
                  {detail.hasAccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-[#8A8578] shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Org Integrations Checklist */}
          <div className="bg-[#EFEBE2] border border-[#DAD5C9] p-6 rounded-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DAD5C9]">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1C2438]">
                  Connected Tools & External Services
                </h3>
                <p className="text-xs text-[#5C574B] mt-0.5">
                  Link Google Drive, GitHub repositories, Figma teams, and Canva folders to automate folder provisioning and task sync.
                </p>
              </div>
              {isAnyRoot ? (
                <span className="text-[10px] font-mono uppercase bg-[#2F3B7A] text-white px-2 py-1 rounded-xs">
                  {isMasterRoot ? 'Master Root Permitted' : 'Root Authority Permitted'}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#8A8578] bg-[#E8E4DA] px-2 py-1 rounded-xs">
                  View-Only
                </span>
              )}
            </div>

            <IntegrationChecklist
              connections={connections}
              scope={isMasterRoot ? 'org' : 'root'}
              orgWideConnections={orgWideConnections}
              isEnterpriseOrg={isEnterprise}
              orgId={currentOrg?.id}
              userId={currentUser.id}
              onConnect={handleConnectIntegration}
              onDisconnect={handleDisconnect}
              onConfigureAccess={(toolKey) => setSelectedToolForConfig(toolKey)}
            />
          </div>

          {/* Browser Userscript Integration Guide */}
          <div className="bg-[#EFEBE2] border border-[#DAD5C9] p-5 rounded-xs space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#1C2438] flex items-center gap-2">
                <span>⚡ Browser Userscript (Ctrl+Alt+M)</span>
              </h4>
              <span className="text-[10px] text-[#2F3B7A] bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 rounded-xs font-semibold">
                Tampermonkey Ready
              </span>
            </div>
            <p className="text-[#5C574B] text-[11px] leading-relaxed">
              Mika integrates into Google Drive, GitHub, Figma, and Canva tabs with a quick-capture overlay. Press <kbd className="px-1.5 py-0.5 bg-white border border-[#DAD5C9] rounded-xs font-bold text-[#1C2438]">Ctrl+Alt+M</kbd> to file tasks and share references with your team instantly.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="/mika-companion.user.js"
                download
                className="px-3 py-1.5 bg-[#1C2438] text-white rounded-xs text-[11px] font-mono font-bold hover:bg-[#253064] transition-colors inline-flex items-center gap-1.5"
              >
                <span>Download Userscript</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[10px] text-[#8A8578]">
                Works with Violentmonkey or Tampermonkey.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GENERAL */}
      {activeTab === 'general' && (
        <div className="bg-[#EFEBE2] border border-[#DAD5C9] p-6 rounded-xs space-y-6">
          <div>
            <h3 className="text-base font-serif font-bold text-[#1C2438]">
              Organisation Identity
            </h3>
            <p className="text-xs text-[#5C574B] mt-0.5">
              General metadata for {currentOrg?.name || 'Mika'}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl font-mono text-xs">
            <div>
              <label className="block text-[#5C574B] mb-1">Organisation Name</label>
              <input
                type="text"
                disabled={!isMasterRoot}
                defaultValue={currentOrg?.name || 'Acme Corp'}
                className="w-full bg-white border border-[#DAD5C9] px-3 py-2 rounded-xs text-[#1C2438]"
              />
            </div>

            <div>
              <label className="block text-[#5C574B] mb-1">Slug / Identifier</label>
              <input
                type="text"
                disabled
                defaultValue={currentOrg?.slug || 'acme-corp'}
                className="w-full bg-[#E8E4DA] border border-[#DAD5C9] px-3 py-2 rounded-xs text-[#8A8578]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#DAD5C9] text-xs text-[#5C574B]">
            To rename or archive the organization, contact Master Root or invoke the authority re-delegation protocol.
          </div>
        </div>
      )}

      {/* TAB CONTENT: STORAGE */}
      {activeTab === 'storage' && (
        <div className="bg-[#EFEBE2] border border-[#DAD5C9] p-6 rounded-xs space-y-6">
          <div>
            <h3 className="text-base font-serif font-bold text-[#1C2438]">
              File Vault & Storage Backend
            </h3>
            <p className="text-xs text-[#5C574B] mt-0.5">
              Current storage tier and provider configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xs border font-mono text-xs space-y-2 ${
              currentOrg?.storageType === 'byod'
                ? 'bg-white border-[#2F3B7A] shadow-xs'
                : 'bg-[#F7F5F0] border-[#DAD5C9]'
            }`}>
              <div className="font-bold text-[#1C2438]">Bring Your Own Drive (BYOD)</div>
              <p className="text-[11px] text-[#5C574B]">
                Files live inside your organization's verified Google Drive domain.
              </p>
              {currentOrg?.storageType === 'byod' && (
                <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs font-semibold">
                  Active Provider
                </span>
              )}
            </div>

            <div className={`p-4 rounded-xs border font-mono text-xs space-y-2 ${
              currentOrg?.storageType === 'mika' || !currentOrg?.storageType
                ? 'bg-white border-[#2F3B7A] shadow-xs'
                : 'bg-[#F7F5F0] border-[#DAD5C9]'
            }`}>
              <div className="font-bold text-[#1C2438]">Mika Managed Vault</div>
              <p className="text-[11px] text-[#5C574B]">
                Zero-knowledge encrypted cloud storage at linear continuous rates.
              </p>
              {(currentOrg?.storageType === 'mika' || !currentOrg?.storageType) && (
                <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs font-semibold">
                  Active Provider
                </span>
              )}
            </div>

            <div className={`p-4 rounded-xs border font-mono text-xs space-y-2 ${
              currentOrg?.storageType === 'self_host'
                ? 'bg-white border-[#2F3B7A] shadow-xs'
                : 'bg-[#F7F5F0] border-[#DAD5C9]'
            }`}>
              <div className="font-bold text-[#1C2438]">Self-Hosted Node</div>
              <p className="text-[11px] text-[#5C574B]">
                On-premise S3 or MinIO bucket endpoint for sovereign airgapped networks.
              </p>
              {currentOrg?.storageType === 'self_host' && (
                <span className="inline-block text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs font-semibold">
                  Active Provider
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ROLES */}
      {activeTab === 'roles' && (
        <div className="bg-[#EFEBE2] border border-[#DAD5C9] p-6 rounded-xs space-y-4">
          <div>
            <h3 className="text-base font-serif font-bold text-[#1C2438]">
              Authority Tree & Role Governance
            </h3>
            <p className="text-xs text-[#5C574B] mt-0.5">
              Review roles, department roots, and delegation chains.
            </p>
          </div>

          <div className="divide-y divide-[#DAD5C9] border border-[#DAD5C9] rounded-xs bg-white">
            {departments.map(dept => {
              const deptRoles = roles.filter(r => r.departmentId === dept.id);
              const leadRole = deptRoles.find(r => r.isDepartmentRoot);
              return (
                <div key={dept.id} className="p-4 flex items-center justify-between font-mono text-xs">
                  <div>
                    <div className="font-bold text-[#1C2438]">{dept.name}</div>
                    <div className="text-[10px] text-[#5C574B]">
                      Lead: {leadRole ? `@${leadRole.title}` : 'Unassigned'} • {deptRoles.length} Defined Roles
                    </div>
                  </div>
                  <span className="text-[10px] bg-[#F7F5F0] px-2 py-1 rounded-xs border border-[#DAD5C9] text-[#1C2438]">
                    {dept.isSection ? 'Section' : 'Department'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OAuth Connection Modal */}
      {selectedToolForOAuth && (
        <OAuthConnectModal
          toolKey={selectedToolForOAuth}
          scope={isMasterRoot ? 'org' : 'root'}
          orgId={currentOrg?.id}
          userId={currentUser.id}
          isEnterprise={isEnterprise}
          onSuccess={handleOAuthSuccess}
          onClose={() => setSelectedToolForOAuth(null)}
        />
      )}

      {/* Access Config Modal */}
      {selectedToolForConfig && (
        <IntegrationAccessConfigModal
          toolKey={selectedToolForConfig}
          roles={roles}
          departments={departments}
          currentConnections={connections}
          onSave={async (updated) => {
            for (const conn of updated) {
              await upsertIntegrationConnection(conn);
            }
            setSelectedToolForConfig(null);
          }}
          onClose={() => setSelectedToolForConfig(null)}
        />
      )}
    </div>
  );
};
