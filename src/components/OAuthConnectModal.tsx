import React, { useEffect, useState } from 'react';
import { Shield, X, Lock, ArrowRight, AlertCircle, Github } from 'lucide-react';
import { IntegrationToolDefinition, INTEGRATION_TOOLS } from '../lib/integrationService';
import { connectProvider, fetchIntegrationStatus, isServerProvider, type IntegrationStatus } from '../lib/integrationsApi';
import { getAccessToken } from '../lib/auth';
import confetti from 'canvas-confetti';
import { ModalOverlay } from './ui/ModalOverlay';

interface OAuthConnectModalProps {
  tool?: IntegrationToolDefinition;
  toolKey?: string;
  scope?: 'org' | 'root';
  isEnterprise?: boolean;
  defaultAccount?: string;
  orgId?: string;
  userId?: string;
  onSuccess: (accountLabel: string) => void;
  onClose: () => void;
}

/**
 * Real connection dialog. GitHub / Figma / Canva go through the server (OAuth in a popup, tokens stay on the server).
 * Google Workspace tools ask Google for the person's consent in the browser. Nothing is typed in and nothing is faked:
 * if a provider is not set up on the server, this says so.
 */
export const OAuthConnectModal: React.FC<OAuthConnectModalProps> = ({
  tool, toolKey, scope = 'org', defaultAccount = '', orgId, onSuccess, onClose,
}) => {
  const effectiveTool = tool || INTEGRATION_TOOLS.find(t => t.key === toolKey);
  const key = effectiveTool?.key || toolKey || '';
  const name = effectiveTool?.name || 'Integration';
  const server = isServerProvider(key);

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!server || !orgId) return;
    fetchIntegrationStatus(orgId).then(setStatus).catch(() => setStatus(null));
  }, [server, orgId]);

  const done = (label: string) => {
    try { confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } }); } catch { /* cosmetic */ }
    onSuccess(label);
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!server) {
        // Google Workspace: the person's own consent, asked by Google in the browser.
        const token = await getAccessToken();
        if (!token) { setError('Google did not grant access. Check that Google sign-in is set up for this app, then try again.'); return; }
        done(defaultAccount || 'Google account');
        return;
      }
      if (!orgId) { setError('Open an organisation first.'); return; }
      const p = status?.providers[key];
      const lead = !!status?.isLead;
      const result = key === 'github'
        // A lead installs the Mika GitHub App once for the whole organisation; everyone else links their own account.
        ? await connectProvider('github', orgId, { mode: lead && scope === 'org' && !p?.orgConnected ? 'install' : 'link' })
        : await connectProvider(key, orgId, { scope: lead ? scope : 'user' });
      if (result.ok) done(result.accountLabel || name);
      else setError(result.message);
    } finally {
      setBusy(false);
    }
  };

  const p = server ? status?.providers[key as 'github'] : undefined;
  const notConfigured = server && p && !p.configured;
  const needsOrg = server && !orgId;

  return (
    <ModalOverlay onClose={onClose} id="oauth-connect-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div id="oauth-connect-modal-container" className="w-full max-w-md bg-surface rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-accent text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface/10 flex items-center justify-center border border-white/20">
              {key === 'github' ? <Github className="w-5 h-5 text-white" /> : <Shield className="w-5 h-5 text-indigo-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Connect {name}</h3>
              <p className="text-xs text-slate-400">{effectiveTool?.authProviderName || 'OAuth'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface/10 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span>What happens</span>
            </div>
            <p>{effectiveTool?.description}</p>
            {server ? (
              <p className="text-slate-500">
                You will approve access on {name}'s own page. Mika keeps the connection on its server and never shows it to anyone.
                {key === 'github' && ' Task completion still needs a reviewer to approve it.'}
              </p>
            ) : (
              <p className="text-slate-500">Google will ask for your permission. Mika uses it only in your browser, for you.</p>
            )}
          </div>

          {needsOrg && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              You can connect {name} as soon as you have joined. Mika will ask you on your first screen.
            </div>
          )}

          {notConfigured && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{name} isn't set up on this server yet</p>
                <p className="text-[11px] mt-0.5 text-amber-700">
                  {p?.missing?.length
                    ? `Add these keys, then try again: ${p.missing.join(', ')}.`
                    : 'Ask the person who runs this Mika to add the keys.'}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2" role="alert">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={busy}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button type="button" id="confirm-oauth-authorize-btn" onClick={connect} disabled={busy || needsOrg || !!notConfigured}
              className="px-4 py-2 bg-accent hover:bg-accent-strong disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors">
              {busy ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Waiting for {name}...</span></>
              ) : (
                <><span>Continue to {server ? name : 'Google'}</span><ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};
