import React, { useState, useMemo } from 'react';
import { JoinLink } from '../types';
import { Link2, CheckCircle2, User, Mail, Shield, Building, Check, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { INTEGRATION_TOOLS, IntegrationToolDefinition } from '../lib/integrationService';
import { OAuthConnectModal } from './OAuthConnectModal';

interface JoinModalProps {
  joinLink: JoinLink;
  allRoles?: any[];
  allDepts?: any[];
  onJoinSuccess: (userData: {
    fullName: string;
    preferredName: string;
    email: string;
    gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
    connectedIntegrations?: Record<string, { accountLabel: string; connectedAt: string }>;
  }) => void;
  onClose: () => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  joinLink,
  allRoles,
  allDepts,
  onJoinSuccess,
  onClose
}) => {
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer-not-to-say'>('female');

  // Integration gating state
  const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, { accountLabel: string; connectedAt: string }>>({});
  const [connectingTool, setConnectingTool] = useState<IntegrationToolDefinition | null>(null);

  const requiredKeys = useMemo(() => joinLink.requiredIntegrations || [], [joinLink]);
  const requiredToolsList = useMemo(() => {
    return requiredKeys
      .map(key => INTEGRATION_TOOLS.find(t => t.key === key))
      .filter(Boolean) as IntegrationToolDefinition[];
  }, [requiredKeys]);

  const allRequirementsSatisfied = useMemo(() => {
    if (requiredKeys.length === 0) return true;
    return requiredKeys.every(k => !!connectedIntegrations[k]);
  }, [requiredKeys, connectedIntegrations]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;
    if (!allRequirementsSatisfied) return;

    confetti({ particleCount: 50, spread: 70 });
    onJoinSuccess({
      fullName,
      preferredName: preferredName || fullName,
      email,
      gender,
      connectedIntegrations
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-stone-200">
        <div className="text-center pb-4 border-b border-stone-200 mb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-[#2F3B7A] flex items-center justify-center mx-auto mb-2">
            <Link2 className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 font-serif-heading">
            You've Been Invited to Join
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Accept assignment as <strong className="text-[#2F3B7A] font-mono-code">@{joinLink.roleTitle}</strong> in {joinLink.deptName}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-stone-700 mb-1">Full Legal Name:</label>
            <input
              type="text"
              required
              placeholder="e.g. Elena Rostova"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Preferred Name / Call Name (Optional):</label>
            <input
              type="text"
              placeholder="e.g. Elena"
              value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Google Email / Account:</label>
            <input
              type="email"
              required
              placeholder="name@oakridge.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Gender (for administrative profile):</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value as any)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50"
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </div>

          {/* Required Connections Card */}
          {requiredToolsList.length > 0 && (
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Required to activate this role</span>
                </div>
                <span className="text-[10px] font-mono">
                  {allRequirementsSatisfied ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      All Connected
                    </span>
                  ) : (
                    <span className="text-amber-800 font-semibold">
                      {Object.keys(connectedIntegrations).length}/{requiredToolsList.length} Connected
                    </span>
                  )}
                </span>
              </div>

              <p className="text-[11px] text-stone-500">
                Your team lead requires these accounts to be connected before your role is activated.
              </p>

              <div className="space-y-1.5 pt-1">
                {requiredToolsList.map(tool => {
                  const conn = connectedIntegrations[tool.key];
                  return (
                    <div
                      key={tool.key}
                      className="flex items-center justify-between p-2 bg-white border border-stone-200 rounded-lg text-xs"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="font-semibold text-stone-900 truncate">{tool.name}</div>
                        <div className="text-[10px] text-stone-500 truncate">
                          {conn ? (
                            <span className="text-emerald-700 font-medium">
                              Connected as {conn.accountLabel}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-mono">(not connected)</span>
                          )}
                        </div>
                      </div>

                      <div>
                        {conn ? (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConnectingTool(tool)}
                            className="px-2.5 py-1 bg-[#2F3B7A] hover:bg-[#232c5c] text-white text-[11px] font-medium rounded cursor-pointer"
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
          )}

          <div className="bg-[#FAF9F6] p-3 rounded-lg border border-stone-200 text-stone-600 text-[11px] flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Joining automatically establishes your role boundaries and populates your task feed.
            </span>
          </div>

          <div className="flex gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium text-xs"
            >
              Dismiss
            </button>
            <button
              type="submit"
              disabled={!allRequirementsSatisfied}
              className={`flex-1 py-2 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors ${
                !allRequirementsSatisfied
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : 'bg-[#2F3B7A] hover:bg-[#232c5c] cursor-pointer'
              }`}
            >
              Accept & Enter Role
            </button>
          </div>
        </form>
      </div>

      {/* OAuth Connect Modal */}
      {connectingTool && (
        <OAuthConnectModal
          tool={connectingTool}
          scope="root"
          defaultAccount={email || ''}
          onClose={() => setConnectingTool(null)}
          onSuccess={(accountLabel) => {
            setConnectedIntegrations(prev => ({
              ...prev,
              [connectingTool.key]: {
                accountLabel,
                connectedAt: new Date().toISOString()
              }
            }));
            setConnectingTool(null);
          }}
        />
      )}
    </div>
  );
};
