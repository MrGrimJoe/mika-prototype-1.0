import React, { useState, useEffect, useMemo } from 'react';
import { GoogleSignIn } from './auth/GoogleSignIn';
import type { AuthResult } from '../lib/auth';
import { api, getToken } from '../lib/api';
import { 
  Link2, 
  ShieldCheck, 
  Clock, 
  Building2, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowLeft,
  Check,
  ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INTEGRATION_TOOLS, IntegrationToolDefinition } from '../lib/integrationService';
import { OAuthConnectModal } from './OAuthConnectModal';
import { upsertUserCompliance, startOrgSync } from '../lib/cloudStore';

interface RoleLinkJoinViewProps {
  token: string;
  onJoinSuccess: (result: { user: any; orgId: string; session: any }) => void;
  onCancel: () => void;
}

interface ResolvedLink {
  linkId: string;
  token: string;
  orgId: string;
  orgName: string;
  roleId: string;
  roleName: string;
  deptId: string;
  deptName: string;
  expiresAt: string;
  isExpired: boolean;
  valid: boolean;
  requiredIntegrations?: string[];
}

export const RoleLinkJoinView: React.FC<RoleLinkJoinViewProps> = ({
  token,
  onJoinSuccess,
  onCancel
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<ResolvedLink | null>(null);

  // Step 1: Link Verified -> Prompt Google Sign-In
  // Step 2: Minimal Fields (if new) OR Merge Dialog (if existing)
  const [googleAuthData, setGoogleAuthData] = useState<{
    email: string;
    fullName: string;
    photoUrl?: string;
  } | null>(null);

  // Minimal signup fields
  const [preferredName, setPreferredName] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | 'non-binary' | 'prefer-not-to-say'>('prefer-not-to-say');

  const [submitting, setSubmitting] = useState(false);

  // Integration gating state (Section 3.3)
  const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, { accountLabel: string; connectedAt: string }>>({});
  const [connectingTool, setConnectingTool] = useState<IntegrationToolDefinition | null>(null);

  const requiredKeys = useMemo(() => linkInfo?.requiredIntegrations || [], [linkInfo]);
  const requiredToolsList = useMemo(() => {
    return requiredKeys
      .map(key => INTEGRATION_TOOLS.find(t => t.key === key))
      .filter(Boolean) as IntegrationToolDefinition[];
  }, [requiredKeys]);

  const allRequirementsSatisfied = useMemo(() => {
    if (requiredKeys.length === 0) return true;
    return requiredKeys.every(k => !!connectedIntegrations[k]);
  }, [requiredKeys, connectedIntegrations]);

  // Fetch link info on mount
  useEffect(() => {
    async function resolveLink() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/join/${token}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Invite link not found or invalid token.');
        }
        const data: ResolvedLink = await res.json();
        setLinkInfo(data);
      } catch (err: any) {
        setError(err.message || 'Failed to resolve invite link');
      } finally {
        setLoading(false);
      }
    }
    resolveLink();
  }, [token]);

  // Already signed in on this browser? Skip straight to the signup details.
  useEffect(() => {
    if (!getToken()) return;
    api<{ user: any }>('/api/me').then(({ user }) => adoptIdentity(user)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adoptIdentity = (u: { email: string; fullName: string; preferredName?: string; avatarUrl?: string; gender?: any }) => {
    setGoogleAuthData({ email: u.email, fullName: u.fullName, photoUrl: u.avatarUrl });
    setFullName(u.fullName);
    setPreferredName(u.preferredName || u.fullName.split(' ')[0] || u.email.split('@')[0]);
    if (u.gender) setGender(u.gender);
  };

  // Called once Google (verified by the Worker) says who this is.
  const handleSignedIn = (result: AuthResult) => {
    setError(null);
    adoptIdentity(result.user);
  };

  // Accept the invite: binds this Google account to the role immediately, no admin review step.
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAuthData) return;

    try {
      setSubmitting(true);
      setError(null);

      const data = await api<any>(`/api/join/${token}/signup`, {
        method: 'POST',
        body: {
          fullName: fullName.trim() || googleAuthData.fullName,
          preferredName: preferredName.trim() || fullName.split(' ')[0] || 'Member',
          gender,
        },
      });

      confetti({ particleCount: 50, spread: 70 });

      // Record which required accounts this person connected (needs the org open to write).
      if (data.user?.id && linkInfo?.orgId && requiredKeys.some(k => connectedIntegrations[k])) {
        await startOrgSync(linkInfo.orgId);
        for (const key of requiredKeys) {
          const conn = connectedIntegrations[key];
          if (conn) {
            await upsertUserCompliance({
              userId: data.user.id,
              orgId: linkInfo.orgId,
              integrationKey: key,
              connectedAccountLabel: conn.accountLabel,
              connectedAt: conn.connectedAt,
              satisfiedAt: new Date().toISOString(),
            }).catch(console.warn);
          }
        }
      }

      onJoinSuccess({ user: data.user, orgId: data.orgId, session: data.session });
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRequiredConnectionsCard = () => {
    if (requiredToolsList.length === 0) return null;

    return (
      <div className="p-4 bg-stone-50 border border-stone-200 rounded-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Required to activate this role</span>
          </div>
          <span className="text-[11px] font-mono">
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

        <p className="text-[11px] text-stone-600">
          Your team lead requires these accounts to be connected before your role is activated.
        </p>

        <div className="space-y-2 pt-1">
          {requiredToolsList.map((tool) => {
            const conn = connectedIntegrations[tool.key];
            return (
              <div
                key={tool.key}
                className="flex items-center justify-between p-2.5 bg-surface border border-stone-200 rounded-xs text-xs shadow-2xs"
              >
                <div className="min-w-0 flex-1 mr-3">
                  <div className="font-semibold text-stone-900 truncate flex items-center gap-1.5">
                    <span>{tool.name}</span>
                    <span className="text-[11px] text-stone-500 font-normal">({tool.category})</span>
                  </div>
                  <div className="text-[11px] text-stone-600 truncate mt-0.5">
                    {conn ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        Connected as {conn.accountLabel}
                      </span>
                    ) : (
                      <span className="text-amber-800 font-mono">
                        (not connected)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  {conn ? (
                    <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xs flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConnectingTool(tool)}
                      className="px-3 py-1.5 bg-accent hover:bg-stone-800 text-white text-xs font-mono font-semibold rounded-xs transition-colors cursor-pointer"
                    >
                      Connect Account
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-xs font-mono text-ink-3">Resolving Invite Token...</p>
        </div>
      </div>
    );
  }

  if (error && !linkInfo) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-hairline p-8 rounded-none shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-ink">Invite Link Unavailable</h2>
          <p className="text-xs text-ink-3 leading-relaxed">{error}</p>
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-accent text-white text-xs font-mono hover:bg-accent-strong transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (linkInfo?.isExpired) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-hairline p-8 rounded-none shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-ink">Time Window Expired</h2>
          <p className="text-xs text-ink-3 leading-relaxed">
            The active time window for this role link expired on{' '}
            <span className="font-mono text-ink">{new Date(linkInfo.expiresAt).toLocaleDateString()}</span>.
            Please request an updated link from your department lead.
          </p>
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-accent text-white text-xs font-mono hover:bg-accent-strong transition-colors"
          >
            Go to Landing Page
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(linkInfo?.expiresAt || '').getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col justify-center items-center p-4 sm:p-6 relative antialiased">
      {/* Background Geometric Grid */}
      <div className="fixed inset-0 bg-geometric-grid opacity-[0.035] pointer-events-none z-0"></div>

      <div className="max-w-md w-full bg-surface border border-hairline shadow-xs relative z-10">
        {/* Top Header Banner */}
        <div className="p-6 border-b border-hairline bg-paper-raised/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-accent text-white flex items-center justify-center font-bold text-xs">
                M.
              </div>
              <span className="text-xs font-semibold tracking-tight text-ink">Mika sign-in</span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
              Role Link Verified
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-ink">
            Join {linkInfo?.orgName}
          </h2>
          <p className="text-xs text-ink-3 mt-1">
            You've been invited to accept an assigned role in this organization.
          </p>
        </div>

        {/* Role & Department Card */}
        <div className="p-6 border-b border-hairline bg-surface space-y-3">
          <div className="p-4 bg-paper border border-hairline space-y-2">
            <div className="text-[11px] font-mono text-ink-3">Target Role & Department</div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-ink flex items-center gap-1.5 font-mono">
                  <span className="text-blue-600">@</span>{linkInfo?.roleName}
                </div>
                <div className="text-xs text-ink-2 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-ink-3" />
                  {linkInfo?.deptName}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono px-2 py-1 bg-surface border border-hairline text-ink-2 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-ink-3" />
                  {daysLeft}d left
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-hairline text-[11px] text-ink-3 leading-relaxed flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Time-windowed cohort link • Unlimited signups during window</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Dynamic Section: Google Sign-in OR Minimal Form OR Merge Confirmation */}
        <div className="p-6 bg-surface space-y-4">
          
          {!googleAuthData ? (
            /* SCENARIO B: Initial State -> Prompt Google Sign-In */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-ink">
                  Sign in with Google to accept this assignment
                </p>
                <p className="text-[11px] text-ink-3">
                  Authentication is Google Sign-In only. No passwords required.
                </p>
              </div>

              <GoogleSignIn onSuccess={handleSignedIn} onError={setError} label="Continue with Google" />
            </div>
          ) : (
            /* SCENARIO C: First-time Google user -> Minimal Signup Fields */
            <form onSubmit={handleCompleteSignup} className="space-y-3.5">
              <div className="p-3 bg-paper border border-hairline text-xs">
                <div className="text-[11px] font-mono text-ink-3 mb-1">Authenticated Google Email</div>
                <div className="font-semibold text-ink">{googleAuthData.email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-hairline focus:border-accent outline-none"
                  placeholder="e.g. Dr. Arthur Pendelton"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Preferred Name / Call Name
                </label>
                <input
                  type="text"
                  required
                  value={preferredName}
                  onChange={e => setPreferredName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-hairline focus:border-accent outline-none"
                  placeholder="e.g. Arthur"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Gender (Administrative Profile)
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-hairline focus:border-accent outline-none bg-surface"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-Binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Immediate bind: No manual admin approval needed. You will immediately enter your assigned role dashboard.
                </span>
              </div>

              {/* Required Integrations Gating Card */}
              {renderRequiredConnectionsCard()}

              <button
                type="submit"
                disabled={submitting || !allRequirementsSatisfied}
                className={`w-full py-2.5 text-xs font-mono font-semibold transition-colors flex items-center justify-center gap-2 ${
                  !allRequirementsSatisfied
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-accent text-white hover:bg-accent-strong cursor-pointer'
                }`}
              >
                {submitting ? 'Creating Account & Binding...' : 'Accept Assignment & Enter Dashboard'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-hairline flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={onCancel}
              className="text-ink-3 hover:text-ink text-[11px] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Cancel & Return
            </button>
            <span className="text-[11px] font-mono text-ink-3">
              Mika Auth Subsystem v2.6
            </span>
          </div>

        </div>
      </div>

      {/* OAuth Connect Modal for Required Integrations */}
      {connectingTool && (
        <OAuthConnectModal
          tool={connectingTool}
          scope="root"
          defaultAccount={googleAuthData?.email || ''}
          onClose={() => setConnectingTool(null)}
          onSuccess={(accountLabel) => {
            setConnectedIntegrations((prev) => ({
              ...prev,
              [connectingTool.key]: {
                accountLabel,
                connectedAt: new Date().toISOString(),
              },
            }));
            setConnectingTool(null);
          }}
        />
      )}
    </div>
  );
};
