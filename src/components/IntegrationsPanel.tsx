import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Figma, Github, HardDrive, Layers, RefreshCw } from 'lucide-react';
import type { Organization, OrgIntegrations } from '../types';
import {
  connectProvider, describeError, disconnectProvider, fetchIntegrationStatus,
  type IntegrationStatus, type ProviderStatus, type ServerProvider,
} from '../lib/integrationsApi';
import { getAccessToken } from '../lib/auth';

interface IntegrationsPanelProps {
  organization?: Organization;
  onUpdateIntegrations?: (integrations: OrgIntegrations) => void; // kept for the parent; status now comes from the server
  isEnterpriseOrg?: boolean;
}

/** Shows what is actually connected, from the server. Nothing here is pre-filled or simulated. */
export const IntegrationsPanel: React.FC<IntegrationsPanelProps> = ({ organization }) => {
  const orgId = organization?.id;
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try { setStatus(await fetchIntegrationStatus(orgId)); setLoadError(null); }
    catch (e) { setLoadError(describeError(e)); }
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  const run = async (id: string, fn: () => Promise<{ ok: boolean; message: string } | void>) => {
    setBusy(id); setNotice(null);
    try {
      const r = await fn();
      if (r) setNotice({ ok: r.ok, text: r.message });
    } catch (e) { setNotice({ ok: false, text: describeError(e) }); }
    finally { setBusy(null); await load(); }
  };

  if (!orgId) return <p className="text-sm text-slate-500">Open an organisation to manage its integrations.</p>;
  const lead = !!status?.isLead;

  const Card: React.FC<{
    id: ServerProvider; title: string; icon: React.ReactNode; iconBg: string; blurb: string; p?: ProviderStatus; children?: React.ReactNode;
  }> = ({ id, title, icon, iconBg, blurb, p, children }) => (
    <div className="p-5 rounded-xl border border-slate-200 bg-surface shadow-xs flex flex-col justify-between" id={`integration-card-${id}`}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconBg} text-white flex items-center justify-center`}>{icon}</div>
          {p?.linked || p?.orgConnected ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Check className="w-3 h-3" /> {p.orgConnected && !p.linked ? 'Organisation connected' : 'Connected'}
            </span>
          ) : <span className="text-xs text-slate-400">Not connected</span>}
        </div>
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{blurb}</p>
        {p?.orgConnected && p.orgAccount && (
          <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-md">Organisation: <span className="font-mono text-slate-900">{p.orgAccount}</span></div>
        )}
        {p?.linked && p.accountLabel && (
          <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-md">Your account: <span className="font-mono text-slate-900">{p.accountLabel}</span></div>
        )}
        {p && !p.configured && (
          <div className="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-md flex gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Not set up on this server yet.
              {lead && p.missing?.length ? ` Missing keys: ${p.missing.join(', ')}.` : ' Ask a lead to finish the setup.'}
            </span>
          </div>
        )}
      </div>
      <div className="pt-4 mt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );

  const btn = 'px-3 py-2 text-xs font-medium rounded-lg transition disabled:opacity-50';
  const primary = `${btn} bg-accent text-white hover:bg-accent-strong shadow-xs`;
  const quiet = `${btn} text-slate-500 hover:text-red-600`;

  const github = status?.providers.github;
  const figma = status?.providers.figma;
  const canva = status?.providers.canva;
  const google = status?.providers.google;

  return (
    <div id="integrations-panel-root" className="space-y-8 max-w-5xl mx-auto py-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Connected apps</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Connected tools can attach evidence to a task and move it to review. They never mark work done: a reviewer always decides.
          </p>
        </div>
        <button onClick={load} className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100" aria-label="Refresh status">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loadError && <div className="p-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl" role="alert">{loadError}</div>}
      {notice && (
        <div className={`p-3 text-xs rounded-xl border ${notice.ok ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-800 bg-red-50 border-red-200'}`} role="status">
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card id="github" title="GitHub" icon={<Github className="w-5 h-5" />} iconBg="bg-accent" p={github}
          blurb="A lead installs the Mika GitHub App once for the organisation, then each person links their own GitHub account. A commit or pull request from the assignee that includes the task's mika# tag submits that task for review.">
          {github && !github.orgConnected && lead && (
            <button className={primary} disabled={!github.configured || busy === 'gh-install'} onClick={() => run('gh-install', () => connectProvider('github', orgId, { mode: 'install' }))}>
              Install for the organisation
            </button>
          )}
          {github && !github.linked && (
            <button className={github.orgConnected || !lead ? primary : `${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}
              disabled={!github.configured || busy === 'gh-link'} onClick={() => run('gh-link', () => connectProvider('github', orgId, { mode: 'link' }))}>
              Link my GitHub account
            </button>
          )}
          {github?.linked && (
            <button className={quiet} onClick={() => run('gh-unlink', async () => { await disconnectProvider('github', orgId, 'user'); return { ok: true, message: 'Your GitHub account was unlinked.' }; })}>
              Unlink mine
            </button>
          )}
          {github?.orgConnected && lead && (
            <button className={quiet} onClick={() => run('gh-uninstall', async () => { await disconnectProvider('github', orgId, 'installation'); return { ok: true, message: 'GitHub was disconnected for the organisation. You can also uninstall the app on GitHub.' }; })}>
              Disconnect organisation
            </button>
          )}
        </Card>

        {([
          ['figma', 'Figma', <Figma className="w-5 h-5" />, 'bg-purple-600',
            'Link your Figma account to attach a preview of your work to a task, or save a Figma version named with the task tag to submit it. Figma webhooks need a paid Figma plan.', figma],
          ['canva', 'Canva', <Layers className="w-5 h-5" />, 'bg-sky-600',
            'Link your Canva account, then export a design as PNG or PDF and attach it to a task for review.', canva],
        ] as const).map(([id, title, icon, bg, blurb, p]) => (
          <Card key={id} id={id} title={title} icon={icon} iconBg={bg} blurb={blurb} p={p}>
            {p && !p.linked && (
              <button className={primary} disabled={!p.configured || busy === id}
                onClick={() => run(id, () => connectProvider(id, orgId, { scope: lead && !p.orgConnected ? 'org' : 'user' }))}>
                {lead && !p.orgConnected ? 'Connect for the organisation' : 'Connect my account'}
              </button>
            )}
            {p?.linked && (
              <button className={quiet} onClick={() => run(`${id}-un`, async () => { await disconnectProvider(id, orgId); return { ok: true, message: `Your ${title} account was unlinked.` }; })}>
                Unlink mine
              </button>
            )}
          </Card>
        ))}
      </div>

      <div className="p-5 rounded-xl border border-slate-200 bg-surface shadow-xs" id="integration-card-google">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center"><HardDrive className="w-5 h-5" /></div>
          <div>
            <h3 className="font-medium text-slate-900">Google Workspace</h3>
            <p className="text-xs text-slate-500">Drive, Calendar and Meet run in your browser with your own Google sign-in. Each person approves access for themselves.</p>
          </div>
        </div>
        {google && !google.configured && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-md flex gap-1.5 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Google sign-in isn't set up on this server yet.{lead && google.missing?.length ? ` Missing: ${google.missing.join(', ')}.` : ''}</span>
          </div>
        )}
        {google?.configured && !google.pickerConfigured && (
          <p className="text-[11px] text-slate-500 mb-2">The Drive file picker needs GOOGLE_API_KEY and GOOGLE_APP_ID{lead && google.missing?.length ? ` (missing: ${google.missing.join(', ')})` : ''}.</p>
        )}
        <button className={primary} disabled={!google?.configured || busy === 'google'}
          onClick={() => run('google', async () => {
            const t = await getAccessToken();
            return t ? { ok: true, message: 'Google access granted for this session.' } : { ok: false, message: 'Google did not grant access.' };
          })}>
          Allow Google access
        </button>
      </div>
    </div>
  );
};
