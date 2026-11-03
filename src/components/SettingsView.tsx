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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-ink-3">
              Organisation settings
            </span>
            {isMasterRoot && (
              <span className="text-[11px] font-mono bg-accent text-white px-1.5 py-0.5 rounded-xs">
                Master root
              </span>
            )}
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink tracking-tight mt-0.5">
            Settings & Integrations
          </h1>
          <p className="text-xs text-ink-2 mt-0.5">
            Configure {currentOrg?.name || 'Mika'} connected workspaces, storage endpoints, and authority governance.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start sm:self-auto text-xs font-mono text-ink-2 hover:text-ink underline"
          >
            &larr; Back to Dashboard
          </button>
        )}
      </div>

      {statusFeedback && (
        <div className="p-3 bg-st-help-bg border border-st-help-border text-xs text-st-help rounded-xs flex items-center justify-between font-mono">
          <span>{statusFeedback}</span>
          <button onClick={() => setStatusFeedback(null)} className="text-st-help hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-hairline bg-paper-raised p-1 rounded-xs gap-1 overflow-x-auto scrollbar-none" role="tablist">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'integrations'
              ? 'bg-accent text-white shadow-xs font-bold'
              : 'text-ink-2 hover:text-ink hover:bg-paper-sunken'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Integrations & OAuth</span>
          {connections.length > 0 && (
            <span className={`text-[11px] px-1.5 py-0.2 rounded-xs ${
              activeTab === 'integrations' ? 'bg-surface/20 text-white' : 'bg-hairline text-ink'
            }`}>
              {connections.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'general'
              ? 'bg-accent text-white shadow-xs font-bold'
              : 'text-ink-2 hover:text-ink hover:bg-paper-sunken'
          }`}
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          <span>General</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'storage'
              ? 'bg-accent text-white shadow-xs font-bold'
              : 'text-ink-2 hover:text-ink hover:bg-paper-sunken'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>Storage & Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeTab === 'roles'
              ? 'bg-accent text-white shadow-xs font-bold'
              : 'text-ink-2 hover:text-ink hover:bg-paper-sunken'
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
          <div className="bg-surface border border-hairline p-5 rounded-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-serif font-bold text-ink">
                  Your Personal Tool Access
                </h3>
                <p className="text-[11px] font-mono text-ink-2">
                  Inherited from your active roles: {userAssignments.map(a => `@${roles.find(r => r.id === a.roleId)?.title || 'Role'}`).join(', ') || 'None'}
                </p>
              </div>
              <span className="self-start sm:self-auto text-[11px] text-accent-fg bg-surface px-2 py-1 rounded-xs border border-hairline break-all">
                {currentUser.email}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-hairline">
              {userAccessSummary.map((detail) => (
                <div
                  key={detail.tool.key}
                  className={`p-3 rounded-xs border text-xs font-mono flex items-center justify-between ${
                    detail.hasAccess
                      ? 'bg-surface border-hairline text-ink'
                      : 'bg-paper border-paper-sunken text-ink-3'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-xs bg-paper-raised flex items-center justify-center shrink-0">
                      <LinkIcon className="w-3.5 h-3.5 text-ink" />
                    </div>
                    <div>
                      <div className="font-bold">{detail.tool.name}</div>
                      <div className="text-[11px] text-ink-2">
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
                    <Lock className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Org Integrations Checklist */}
          <div className="bg-surface border border-hairline p-6 rounded-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div>
                <h3 className="text-base font-serif font-bold text-ink">
                  Connected Tools & External Services
                </h3>
                <p className="text-xs text-ink-2 mt-0.5">
                  Link Google Drive, GitHub repositories, Figma teams, and Canva folders to automate folder provisioning and task sync.
                </p>
              </div>
              {isAnyRoot ? (
                <span className="text-[11px] font-mono bg-accent text-white px-2 py-1 rounded-xs">
                  {isMasterRoot ? 'Master Root Permitted' : 'Root Authority Permitted'}
                </span>
              ) : (
                <span className="text-[11px] font-mono text-ink-3 bg-paper-sunken px-2 py-1 rounded-xs">
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
          <div className="bg-surface border border-hairline p-5 rounded-xs space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-ink flex items-center gap-2">
                <span>⚡ Browser Userscript (Ctrl+Alt+M)</span>
              </h4>
              <span className="text-[11px] text-accent-fg bg-st-help-bg border border-st-help-border px-2 py-0.5 rounded-xs font-semibold">
                Tampermonkey Ready
              </span>
            </div>
            <p className="text-ink-2 text-[11px] leading-relaxed">
              Mika integrates into Google Drive, GitHub, Figma, and Canva tabs with a quick-capture overlay. Press <kbd className="px-1.5 py-0.5 bg-surface border border-hairline rounded-xs font-bold text-ink">Ctrl+Alt+M</kbd> to file tasks and share references with your team instantly.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="/mika-companion.user.js"
                download
                className="px-3 py-1.5 bg-accent text-white rounded-xs text-[11px] font-semibold hover:bg-accent-strong transition-colors inline-flex items-center gap-1.5"
              >
                <span>Download Userscript</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-[11px] text-ink-3">
                Works with Violentmonkey or Tampermonkey.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GENERAL */}
      {activeTab === 'general' && (
        <div className="bg-surface border border-hairline p-6 rounded-xs space-y-6">
          <div>
            <h3 className="text-base font-serif font-bold text-ink">
              Organisation Identity
            </h3>
            <p className="text-xs text-ink-2 mt-0.5">
              General metadata for {currentOrg?.name || 'Mika'}.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl font-mono text-xs">
            <div>
              <label className="block text-ink-2 mb-1">Organisation Name</label>
              <input
                type="text"
                disabled={!isMasterRoot}
                defaultValue={currentOrg?.name || 'Acme Corp'}
                className="w-full bg-surface border border-hairline px-3 py-2 rounded-xs text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-2 mb-1">Slug / Identifier</label>
              <input
                type="text"
                disabled
                defaultValue={currentOrg?.slug || 'acme-corp'}
                className="w-full bg-paper-sunken border border-hairline px-3 py-2 rounded-xs text-ink-3"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-hairline text-xs text-ink-2">
            To rename or archive the organization, contact Master Root or invoke the authority re-delegation protocol.
          </div>
        </div>
      )}

      {/* TAB CONTENT: STORAGE */}
      {activeTab === 'storage' && (
        <div className="bg-surface border border-hairline p-6 rounded-xs space-y-6">
          <div>
            <h3 className="text-base font-serif font-bold text-ink">
              File Vault & Storage Backend
            </h3>
            <p className="text-xs text-ink-2 mt-0.5">
              Current storage tier and provider configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xs border font-mono text-xs space-y-2 ${
              currentOrg?.storageType === 'byod'
                ? 'bg-surface border-accent shadow-xs'
                : 'bg-paper border-hairline'
            }`}>
              <div className="font-bold text-ink">Bring Your Own Drive (BYOD)</div>
              <p className="text-[11px] text-ink-2">
                Files live inside your organization's verified Google Drive domain.
              </p>
              {currentOrg?.storageType === 'byod' && (
                <span className="inline-block text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs font-semibold">
                  Active Provider
                </span>
              )}
            </div>

            <div className={`p-4 rounded-xs border font-mono text-xs space-y-2 ${
              currentOrg?.storageType === 'mika' || !currentOrg?.storageType
                ? 'bg-surface border-accent shadow-xs'
                : 'bg-paper border-hairline'
            }`}>
              <div className="font-bold text-ink">Mika Managed Vault</div>
              <p className="text-[11px] text-ink-2">
                Zero-knowledge encrypted cloud storage at linear continuous rates.
              </p>
              {(currentOrg?.storageType === 'mika' || !currentOrg?.storageType) && (
                <span className="inline-block text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs font-semibold">
                  Active Provider
                </span>
              )}
            </div>

            <div className={`p-4 rounded-xs border font-mono text-xs space-y-2 ${
              currentOrg?.storageType === 'self_host'
                ? 'bg-surface border-accent shadow-xs'
                : 'bg-paper border-hairline'
            }`}>
              <div className="font-bold text-ink">Self-Hosted Node</div>
              <p className="text-[11px] text-ink-2">
                On-premise S3 or MinIO bucket endpoint for sovereign airgapped networks.
              </p>
              {currentOrg?.storageType === 'self_host' && (
                <span className="inline-block text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs font-semibold">
                  Active Provider
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ROLES */}
      {activeTab === 'roles' && (
        <div className="bg-surface border border-hairline p-6 rounded-xs space-y-4">
          <div>
            <h3 className="text-base font-serif font-bold text-ink">
              Authority Tree & Role Governance
            </h3>
            <p className="text-xs text-ink-2 mt-0.5">
              Review roles, department roots, and delegation chains.
            </p>
          </div>

          <div className="divide-y divide-hairline border border-hairline rounded-xs bg-surface">
            {departments.map(dept => {
              const deptRoles = roles.filter(r => r.departmentId === dept.id);
              const leadRole = deptRoles.find(r => r.isDepartmentRoot);
              return (
                <div key={dept.id} className="p-4 flex items-center justify-between font-mono text-xs">
                  <div>
                    <div className="font-bold text-ink">{dept.name}</div>
                    <div className="text-[11px] text-ink-2">
                      Lead: {leadRole ? `@${leadRole.title}` : 'Unassigned'} • {deptRoles.length} Defined Roles
                    </div>
                  </div>
                  <span className="text-[11px] bg-paper px-2 py-1 rounded-xs border border-hairline text-ink">
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
