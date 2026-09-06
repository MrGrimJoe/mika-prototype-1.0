import React, { useState } from 'react';
import { 
  OrgIntegrations, 
  ConnectedAppInfo, 
  Organization 
} from '../types';
import { 
  Check, 
  ExternalLink, 
  Github, 
  Figma, 
  Layers, 
  FileText, 
  Calendar, 
  Video, 
  MessageSquare, 
  Mail, 
  CheckSquare, 
  FileQuestion, 
  GraduationCap, 
  Bookmark, 
  HardDrive, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  X,
  Link2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface IntegrationsPanelProps {
  organization?: Organization;
  onUpdateIntegrations?: (integrations: OrgIntegrations) => void;
  isEnterpriseOrg?: boolean;
}

export const IntegrationsPanel: React.FC<IntegrationsPanelProps> = ({
  organization,
  onUpdateIntegrations,
  isEnterpriseOrg = false
}) => {
  const [integrations, setIntegrations] = useState<OrgIntegrations>(() => {
    return organization?.integrations || {
      github: { connected: true, username: 'codeNinjaJane', accountEmail: 'dev@mika.school', connectedAt: '2026-09-01' },
      figma: { connected: true, username: 'mika-design-team', accountEmail: 'design@mika.school', connectedAt: '2026-09-02' },
      canva: { connected: false },
      google: {
        drive: true,
        docsSheetsSlides: true,
        calendar: true,
        meet: true,
        chat: false,
        gmail: false,
        tasks: false,
        forms: false,
        classroom: false,
        keep: false,
        accountEmail: 'admin@mika.school',
        connectedAt: '2026-09-01'
      }
    };
  });

  // Connect Modal State
  const [activeModalApp, setActiveModalApp] = useState<{
    key: 'github' | 'figma' | 'canva' | 'google_all' | string;
    title: string;
    type: 'google' | 'third_party';
    description: string;
  } | null>(null);

  const [inputAccount, setInputAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const updateStateAndEmit = (next: OrgIntegrations) => {
    setIntegrations(next);
    if (onUpdateIntegrations) {
      onUpdateIntegrations(next);
    }
  };

  const handleDisconnectThirdParty = (key: 'github' | 'figma' | 'canva') => {
    const next: OrgIntegrations = {
      ...integrations,
      [key]: { connected: false }
    };
    updateStateAndEmit(next);
  };

  const handleToggleGoogleService = (serviceKey: keyof NonNullable<OrgIntegrations['google']>) => {
    if (serviceKey === 'keep' && !isEnterpriseOrg) return;
    const currentGoogle = integrations.google || {};
    const currentVal = Boolean(currentGoogle[serviceKey]);
    const nextGoogle = {
      ...currentGoogle,
      [serviceKey]: !currentVal,
      connectedAt: currentGoogle.connectedAt || new Date().toISOString()
    };
    const next: OrgIntegrations = {
      ...integrations,
      google: nextGoogle as any
    };
    updateStateAndEmit(next);
  };

  const handleConnectConfirm = () => {
    if (!activeModalApp) return;
    setIsConnecting(true);

    setTimeout(() => {
      setIsConnecting(false);
      const appKey = activeModalApp.key;
      const accountName = inputAccount.trim() || 'team-account';

      if (appKey === 'github' || appKey === 'figma' || appKey === 'canva') {
        const next: OrgIntegrations = {
          ...integrations,
          [appKey]: {
            connected: true,
            username: accountName,
            accountEmail: `${accountName}@mika.school`,
            connectedAt: new Date().toISOString()
          }
        };
        updateStateAndEmit(next);
      } else if (appKey.startsWith('google_')) {
        const svc = appKey.replace('google_', '') as any;
        const currentGoogle = integrations.google || {};
        const next: OrgIntegrations = {
          ...integrations,
          google: {
            ...currentGoogle,
            [svc]: true,
            accountEmail: accountName.includes('@') ? accountName : `${accountName}@mika.school`,
            connectedAt: new Date().toISOString()
          }
        };
        updateStateAndEmit(next);
      }

      confetti({ particleCount: 35, spread: 60 });
      setActiveModalApp(null);
      setInputAccount('');
    }, 600);
  };

  const googleServices = [
    { key: 'drive', name: 'Google Drive', icon: HardDrive, desc: 'Central file sync, folder structure, and asset preservation' },
    { key: 'docsSheetsSlides', name: 'Docs, Sheets & Slides', icon: FileText, desc: 'Interactive document templates, live editing, and submission linking' },
    { key: 'calendar', name: 'Google Calendar', icon: Calendar, desc: 'Department event sync, assignment schedules, and deadlines' },
    { key: 'meet', name: 'Google Meet', icon: Video, desc: 'Instant 1-click video calls directly from department dashboard' },
    { key: 'chat', name: 'Google Chat', icon: MessageSquare, desc: 'Real-time department channels and staff communication' },
    { key: 'gmail', name: 'Gmail Workspace', icon: Mail, desc: 'Official notifications and executive communications' },
    { key: 'tasks', name: 'Google Tasks', icon: CheckSquare, desc: 'Personal to-do sync directly for assigned roles' },
    { key: 'forms', name: 'Google Forms', icon: FileQuestion, desc: 'Evaluation surveys and departmental feedback' },
    { key: 'classroom', name: 'Google Classroom', icon: GraduationCap, desc: 'Course rosters, educational materials, and assignments' },
    { key: 'keep', name: 'Google Keep', icon: Bookmark, desc: 'Quick scratchpad and team notes', enterpriseOnly: true },
  ];

  return (
    <div id="integrations-panel-root" className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Introduction */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Connected Apps & Services</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Connect your organization’s productivity and creative tools. Mika links seamlessly with Google Workspace, 
          GitHub repositories, Figma design systems, and Canva creative assets.
        </p>
      </div>

      {/* 1. Third-Party Integrations Cluster */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Developer & Design Platforms</span>
          <div className="h-[1px] flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* GitHub Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <Github className="w-5 h-5" />
                </div>
                {integrations.github?.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not connected</span>
                )}
              </div>
              <h3 className="font-medium text-slate-900">GitHub</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mention repos and files in tasks (@repo/path), auto-resolve build failures, and submit tasks via commit trailers.
              </p>
              {integrations.github?.connected && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-md">
                  Connected as: <span className="font-mono text-slate-900">@{integrations.github.username || 'org'}</span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
              {integrations.github?.connected ? (
                <button
                  onClick={() => handleDisconnectThirdParty('github')}
                  className="text-xs font-medium text-slate-500 hover:text-red-600 transition"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  id="btn-connect-github"
                  onClick={() => setActiveModalApp({
                    key: 'github',
                    title: 'Connect GitHub Organization',
                    type: 'third_party',
                    description: 'Authorize Mika to read public/private repos, file trees, and receive failure webhooks.'
                  })}
                  className="w-full py-2 px-3 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-center shadow-xs"
                >
                  Connect GitHub
                </button>
              )}
            </div>
          </div>

          {/* Figma Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                  <Figma className="w-5 h-5" />
                </div>
                {integrations.figma?.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not connected</span>
                )}
              </div>
              <h3 className="font-medium text-slate-900">Figma</h3>
              <p className="text-xs text-slate-500 mt-1">
                Link visual designs, import frame previews, and export directly from the Mika Figma plugin or Ctrl+Alt+M.
              </p>
              {integrations.figma?.connected && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-md">
                  Connected team: <span className="font-medium text-slate-900">{integrations.figma.username || 'Design Team'}</span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
              {integrations.figma?.connected ? (
                <button
                  onClick={() => handleDisconnectThirdParty('figma')}
                  className="text-xs font-medium text-slate-500 hover:text-red-600 transition"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  id="btn-connect-figma"
                  onClick={() => setActiveModalApp({
                    key: 'figma',
                    title: 'Connect Figma Team',
                    type: 'third_party',
                    description: 'Authorize Mika to access design files, generate thumbnails, and link frames to tasks.'
                  })}
                  className="w-full py-2 px-3 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-center shadow-xs"
                >
                  Connect Figma
                </button>
              )}
            </div>
          </div>

          {/* Canva Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                {integrations.canva?.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not connected</span>
                )}
              </div>
              <h3 className="font-medium text-slate-900">Canva</h3>
              <p className="text-xs text-slate-500 mt-1">
                Search Canva presentations, social templates, and flyers to attach as task references or submissions.
              </p>
              {integrations.canva?.connected && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-md">
                  Connected user: <span className="font-medium text-slate-900">{integrations.canva.username || 'Marketing Team'}</span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
              {integrations.canva?.connected ? (
                <button
                  onClick={() => handleDisconnectThirdParty('canva')}
                  className="text-xs font-medium text-slate-500 hover:text-red-600 transition"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  id="btn-connect-canva"
                  onClick={() => setActiveModalApp({
                    key: 'canva',
                    title: 'Connect Canva Workspace',
                    type: 'third_party',
                    description: 'Authorize Mika to search your Canva brand kits and design assets.'
                  })}
                  className="w-full py-2 px-3 text-xs font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition text-center shadow-xs"
                >
                  Connect Canva
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Google Workspace Provider Cluster */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Google Workspace Applications</span>
          <div className="h-[1px] flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {googleServices.map((svc) => {
            const Icon = svc.icon;
            const isConnected = Boolean((integrations.google as any)?.[svc.key]);
            const isEnterpriseLocked = svc.enterpriseOnly && !isEnterpriseOrg;

            return (
              <div 
                key={svc.key}
                className={`p-4 rounded-xl border transition flex items-start justify-between gap-3 ${
                  isEnterpriseLocked 
                    ? 'bg-slate-50/70 border-slate-200 opacity-60' 
                    : 'bg-white border-slate-200 shadow-2xs hover:border-indigo-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm text-slate-900">{svc.name}</h4>
                      {svc.enterpriseOnly && (
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          Enterprise
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-sm leading-relaxed">{svc.desc}</p>
                    {isEnterpriseLocked && (
                      <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Requires Google Workspace Enterprise
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isEnterpriseLocked ? (
                    <button 
                      disabled 
                      className="px-3 py-1.5 text-xs text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed"
                      title="Requires Google Workspace Enterprise"
                    >
                      Locked
                    </button>
                  ) : isConnected ? (
                    <button
                      id={`btn-toggle-${svc.key}`}
                      onClick={() => handleToggleGoogleService(svc.key as any)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Connected
                    </button>
                  ) : (
                    <button
                      id={`btn-connect-${svc.key}`}
                      onClick={() => setActiveModalApp({
                        key: `google_${svc.key}`,
                        title: `Connect ${svc.name}`,
                        type: 'google',
                        description: `Grant Mika permission to access ${svc.name} on behalf of your school organization.`
                      })}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect Modal */}
      {activeModalApp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                {activeModalApp.title}
              </h3>
              <button 
                onClick={() => setActiveModalApp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              {activeModalApp.description}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {activeModalApp.type === 'google' ? 'Google Workspace Account' : 'Username or Organization Handle'}
                </label>
                <input
                  type="text"
                  placeholder={activeModalApp.type === 'google' ? 'e.g. principal@school.edu' : 'e.g. mika-design-team'}
                  value={inputAccount}
                  onChange={(e) => setInputAccount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
                <div className="font-medium text-slate-800">Requested Scopes:</div>
                <div>• Read organization files and metadata</div>
                <div>• Enable @mention discovery in task descriptions</div>
                <div>• Support instant preview linking in File Vault</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-connect-app"
                disabled={isConnecting}
                onClick={handleConnectConfirm}
                className="px-4 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    Authorize & Connect
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
