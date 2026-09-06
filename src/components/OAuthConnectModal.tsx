import React, { useState } from 'react';
import {
  Shield,
  X,
  CheckCircle2,
  ExternalLink,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { IntegrationToolDefinition } from '../lib/integrationService';
import confetti from 'canvas-confetti';

interface OAuthConnectModalProps {
  tool: IntegrationToolDefinition;
  scope: 'org' | 'root';
  defaultAccount?: string;
  onSuccess: (accountLabel: string) => void;
  onClose: () => void;
}

export const OAuthConnectModal: React.FC<OAuthConnectModalProps> = ({
  tool,
  scope,
  defaultAccount = '',
  onSuccess,
  onClose,
}) => {
  const [accountInput, setAccountInput] = useState(
    defaultAccount || (tool.key.startsWith('google') ? 'admin@mika.school' : 'mika-team')
  );
  const [isAuthorizing, setIsAuthorizing] = useState(false);

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
        {/* Header with provider aesthetic */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Connect {tool.name}
              </h3>
              <p className="text-xs text-slate-400">
                {tool.authProviderName} • {scope === 'org' ? 'Organization-Wide' : 'Root Scope'}
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

        {/* Content */}
        <form onSubmit={handleAuthorize} className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Permission Request</span>
            </div>
            <p>
              Mika will securely access <strong>{tool.name}</strong> to support:
            </p>
            <ul className="list-disc pl-4 text-slate-500 space-y-1">
              <li>{tool.description}</li>
              <li>Read & write authorization for assigned team members</li>
              <li>Automatic token refresh and audit logging</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {tool.key.startsWith('google') ? 'Workspace Account Email' : `${tool.name} Username or Team ID`}
            </label>
            <input
              type={tool.key.startsWith('google') ? 'email' : 'text'}
              required
              value={accountInput}
              onChange={(e) => setAccountInput(e.target.value)}
              placeholder={tool.key.startsWith('google') ? 'e.g. admin@yourdomain.edu' : 'e.g. acme-corp'}
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
      </div>
    </div>
  );
};
