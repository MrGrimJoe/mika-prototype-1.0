import React, { useState, useEffect } from 'react';
import {
  Shield,
  X,
  Lock,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  Github
} from 'lucide-react';
import { IntegrationToolDefinition, INTEGRATION_TOOLS } from '../lib/integrationService';
import confetti from 'canvas-confetti';

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

export const OAuthConnectModal: React.FC<OAuthConnectModalProps> = ({
  tool,
  toolKey,
  scope = 'org',
  isEnterprise = false,
  defaultAccount = '',
  orgId,
  userId,
  onSuccess,
  onClose,
}) => {
  const effectiveTool =
    tool ||
    INTEGRATION_TOOLS.find((t) => t.key === toolKey) || {
      key: (toolKey || 'github') as any,
      name: toolKey === 'github' ? 'GitHub' : 'Integration',
      category: 'Engineering',
      description: 'Connect repository and team integration.',
      authProviderName: 'OAuth Provider',
      defaultScopeLabel: 'Organization integration'
    };

  const isGitHub = effectiveTool.key === 'github';

  // State for non-github providers (Figma, Canva, Google)
  const [accountInput, setAccountInput] = useState(
    defaultAccount || (effectiveTool.key.startsWith('google') ? 'admin@mika.school' : 'mika-team')
  );
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [githubConfigError, setGithubConfigError] = useState<string | null>(null);

  // Listen for popup window callback postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS') {
        const accountLabel = event.data.accountLabel || 'connected';
        try {
          confetti({ particleCount: 35, spread: 60, origin: { y: 0.7 } });
        } catch (e) {
          // ignore
        }
        setIsAuthorizing(false);
        onSuccess(accountLabel);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess]);

  // Real GitHub OAuth redirect & popup flow
  const handleGitHubAuthorize = async () => {
    setIsAuthorizing(true);
    setGithubConfigError(null);

    let clientId = (import.meta as any).env?.VITE_GITHUB_CLIENT_ID || '';
    if (!clientId) {
      try {
        const res = await fetch('/api/integrations/github/config');
        if (res.ok) {
          const data = await res.json();
          clientId = data.clientId || '';
        }
      } catch (err) {
        console.warn('Failed to query GitHub OAuth config:', err);
      }
    }

    if (!clientId) {
      setIsAuthorizing(false);
      setGithubConfigError(
        'GITHUB_CLIENT_ID is not configured. Please add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to your environment variables or AI Studio Secrets.'
      );
      return;
    }

    const currentOrgId = orgId || localStorage.getItem('mika_org_id') || 'org_school';
    const currentUserId = userId || localStorage.getItem('mika_user_id') || 'u_principal';

    const redirectUri = `${window.location.origin}/api/integrations/github/callback`;
    const statePayload = JSON.stringify({
      scope,
      orgId: currentOrgId,
      userId: currentUserId,
      ts: Date.now()
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:user',
      state: statePayload
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    // Prefer popup if inside an iframe (AI Studio preview) to bypass X-Frame-Options
    if (window.self !== window.top) {
      const popup = window.open(authUrl, 'mika_github_oauth', 'width=600,height=750,menubar=no,toolbar=no');
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Fallback to top window or location redirect
        try {
          window.top!.location.href = authUrl;
        } catch {
          window.location.href = authUrl;
        }
      }
    } else {
      window.location.href = authUrl;
    }
  };

  // Generic handler for untouched providers (Figma, Canva, Google)
  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountInput.trim()) return;

    setIsAuthorizing(true);
    setTimeout(() => {
      setIsAuthorizing(false);
      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
      } catch (e) {
        // ignore
      }
      onSuccess(accountInput.trim());
    }, 700);
  };

  return (
    <div
      id="oauth-connect-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        id="oauth-connect-modal-container"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              {isGitHub ? (
                <Github className="w-5 h-5 text-white" />
              ) : (
                <Shield className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Connect {effectiveTool.name}
              </h3>
              <p className="text-xs text-slate-400">
                {isGitHub ? 'Real OAuth 2.0 Flow' : effectiveTool.authProviderName} • {scope === 'org' ? 'Organization-Wide' : 'Root Scope'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GitHub Path: No typed-account form! Direct OAuth authorization */}
        {isGitHub ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>GitHub OAuth Permission Request</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Mika will redirect you to GitHub to authorize access with the following scopes:
              </p>
              <ul className="list-disc pl-4 text-slate-600 space-y-1 font-mono text-[11px]">
                <li><strong className="text-slate-800">repo</strong>: Read & write access to repositories for git tree inspection and commit trailers.</li>
                <li><strong className="text-slate-800">read:user</strong>: Read profile handle to link your real GitHub identity.</li>
              </ul>
              <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Redirects to <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px]">github.com/login/oauth/authorize</code></span>
              </div>
            </div>

            {githubConfigError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">OAuth Credentials Required</p>
                  <p className="text-[11px] mt-0.5 text-amber-700">{githubConfigError}</p>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isAuthorizing}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-github-oauth-btn"
                onClick={handleGitHubAuthorize}
                disabled={isAuthorizing}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors"
              >
                {isAuthorizing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-3.5 h-3.5" />
                    <span>Continue to GitHub Authorization</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Untouched original form for other providers (Figma, Canva, Google) */
          <form onSubmit={handleAuthorize} className="p-6 space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Permission Request</span>
              </div>
              <p>
                Mika will securely access <strong>{effectiveTool.name}</strong> to support:
              </p>
              <ul className="list-disc pl-4 text-slate-500 space-y-1">
                <li>{effectiveTool.description}</li>
                <li>Read & write authorization for assigned team members</li>
                <li>Automatic token refresh and audit logging</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {effectiveTool.key.startsWith('google') ? 'Workspace Account Email' : `${effectiveTool.name} Username or Team ID`}
              </label>
              <input
                type={effectiveTool.key.startsWith('google') ? 'email' : 'text'}
                required
                value={accountInput}
                onChange={(e) => setAccountInput(e.target.value)}
                placeholder={effectiveTool.key.startsWith('google') ? 'e.g. admin@yourdomain.edu' : 'e.g. acme-corp'}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {scope === 'org'
                  ? 'This account will serve as the shared connector for eligible roles.'
                  : 'This account will be scoped exclusively to your subordinate roles.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isAuthorizing}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="confirm-oauth-authorize-btn"
                disabled={isAuthorizing || !accountInput.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {isAuthorizing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Authorize & Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
