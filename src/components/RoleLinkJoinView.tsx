import React, { useState, useEffect, useMemo } from 'react';
import { signInWithGooglePopup } from '../lib/firebase';
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
import { upsertUserCompliance } from '../lib/firestoreService';

interface RoleLinkJoinViewProps {
  token: string;
  onJoinSuccess: (userData: any, session: any) => void;
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
    google_sub: string;
    email: string;
    fullName: string;
    photoUrl?: string;
  } | null>(null);

  // Minimal signup fields
  const [preferredName, setPreferredName] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | 'non-binary' | 'prefer-not-to-say'>('female');

  // Existing account merge prompt state
  const [existingAccountData, setExistingAccountData] = useState<any | null>(null);
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

  // Handle Google Sign-In Click
  const handleGoogleSignIn = async (simulatedData?: { email: string; fullName: string; google_sub: string }) => {
    setError(null);

    let authPayload: { email: string; fullName: string; google_sub: string; photoUrl?: string };

    if (simulatedData) {
      authPayload = simulatedData;
    } else {
      setSubmitting(true);
      const res = await signInWithGooglePopup();
      setSubmitting(false);

      if (!res.success || !res.user) {
        // Fallback or user dismissed popup
        if (res.error && !res.error.includes('closed-by-user')) {
          setError('Google Sign-In was cancelled or blocked. You may also choose a test identity below.');
        }
        return;
      }

      authPayload = {
        email: res.user.email,
        fullName: res.user.displayName || res.user.email.split('@')[0],
        google_sub: res.user.uid,
        photoUrl: res.user.photoURL
      };
    }

    setGoogleAuthData(authPayload);
    setFullName(authPayload.fullName);
    setPreferredName(authPayload.fullName.split(' ')[0] || authPayload.email.split('@')[0]);

    // Check with server if this Google account already exists
    try {
      setSubmitting(true);
      const checkRes = await fetch(`/api/join/${token}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authPayload.email,
          google_sub: authPayload.google_sub
        })
      });

      const checkJson = await checkRes.json();
      setSubmitting(false);

      if (checkJson.existingAccountFound && checkJson.promptMerge) {
        // Account exists -> show merge confirmation dialog
        setExistingAccountData(checkJson);
      } else if (checkJson.isNew) {
        // New account needed -> proceed to minimal fields review
        // (already populated)
      }
    } catch (e: any) {
      setSubmitting(false);
      console.error('Server check error:', e);
    }
  };

  // Submit First-Time Minimal Signup
  const handleCompleteNewSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAuthData) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/join/${token}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleAuthData.email,
          google_sub: googleAuthData.google_sub,
          full_name: fullName.trim() || googleAuthData.fullName,
          preferred_name: preferredName.trim() || fullName.split(' ')[0] || 'Member',
          gender,
          avatar_url: googleAuthData.photoUrl
        })
      });

      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete signup');
      }

      confetti({ particleCount: 50, spread: 70 });

      // Persist user compliance records to Firestore
      if (data.user?.id && linkInfo?.orgId) {
        for (const key of requiredKeys) {
          const conn = connectedIntegrations[key];
          if (conn) {
            upsertUserCompliance({
              userId: data.user.id,
              orgId: linkInfo.orgId,
              integrationKey: key,
              connectedAccountLabel: conn.accountLabel,
              connectedAt: conn.connectedAt,
              satisfiedAt: new Date().toISOString()
            }).catch(console.warn);
          }
        }
      }

      onJoinSuccess(data.user, data.session);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setSubmitting(false);
    }
  };

  // Handle Merging with Existing Account
  const handleConfirmMerge = async () => {
    if (!googleAuthData) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/join/${token}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleAuthData.email,
          google_sub: googleAuthData.google_sub,
          mergeWithExisting: true
        })
      });

      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to merge role');
      }

      confetti({ particleCount: 60, spread: 80 });

      // Persist user compliance records to Firestore
      if (data.user?.id && linkInfo?.orgId) {
        for (const key of requiredKeys) {
          const conn = connectedIntegrations[key];
          if (conn) {
            upsertUserCompliance({
              userId: data.user.id,
              orgId: linkInfo.orgId,
              integrationKey: key,
              connectedAccountLabel: conn.accountLabel,
              connectedAt: conn.connectedAt,
              satisfiedAt: new Date().toISOString()
            }).catch(console.warn);
          }
        }
      }

      onJoinSuccess(data.user, data.session);
    } catch (err: any) {
      setError(err.message || 'Failed to merge role');
      setSubmitting(false);
    }
  };

  const handleCancelMerge = () => {
    setExistingAccountData(null);
    setGoogleAuthData(null);
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

        <p className="text-[11px] text-stone-600">
          Your team lead requires these accounts to be connected before your role is activated.
        </p>

        <div className="space-y-2 pt-1">
          {requiredToolsList.map((tool) => {
            const conn = connectedIntegrations[tool.key];
            return (
              <div
                key={tool.key}
                className="flex items-center justify-between p-2.5 bg-white border border-stone-200 rounded-xs text-xs shadow-2xs"
              >
                <div className="min-w-0 flex-1 mr-3">
                  <div className="font-semibold text-stone-900 truncate flex items-center gap-1.5">
                    <span>{tool.name}</span>
                    <span className="text-[10px] text-stone-500 font-normal">({tool.category})</span>
                  </div>
                  <div className="text-[10px] text-stone-600 truncate mt-0.5">
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
                    <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xs flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConnectingTool(tool)}
                      className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-stone-800 text-white text-xs font-mono uppercase tracking-wider font-semibold rounded-xs transition-colors cursor-pointer"
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
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-xs font-mono uppercase tracking-widest text-[#737373]">Resolving Invite Token...</p>
        </div>
      </div>
    );
  }

  if (error && !linkInfo) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E5E5E5] p-8 rounded-none shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#1A1A1A]">Invite Link Unavailable</h2>
          <p className="text-xs text-[#737373] leading-relaxed">{error}</p>
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-[#1A1A1A] text-white text-xs font-mono uppercase tracking-widest hover:bg-[#333333] transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (linkInfo?.isExpired) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#E5E5E5] p-8 rounded-none shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#1A1A1A]">Time Window Expired</h2>
          <p className="text-xs text-[#737373] leading-relaxed">
            The active time window for this role link expired on{' '}
            <span className="font-mono text-[#1A1A1A]">{new Date(linkInfo.expiresAt).toLocaleDateString()}</span>.
            Please request an updated link from your department lead.
          </p>
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-[#1A1A1A] text-white text-xs font-mono uppercase tracking-widest hover:bg-[#333333] transition-colors"
          >
            Go to Landing Page
          </button>
        </div>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(linkInfo?.expiresAt || '').getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] flex flex-col justify-center items-center p-4 sm:p-6 relative antialiased">
      {/* Background Geometric Grid */}
      <div className="fixed inset-0 bg-geometric-grid opacity-[0.035] pointer-events-none z-0"></div>

      <div className="max-w-md w-full bg-white border border-[#E5E5E5] shadow-xs relative z-10">
        {/* Top Header Banner */}
        <div className="p-6 border-b border-[#E5E5E5] bg-[#F5F5F5]/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs">
                M.
              </div>
              <span className="text-xs font-mono font-bold tracking-tight text-[#1A1A1A]">MIKA AUTH</span>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
              Role Link Verified
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A]">
            Join {linkInfo?.orgName}
          </h2>
          <p className="text-xs text-[#737373] mt-1">
            You've been invited to accept an assigned role in this organization.
          </p>
        </div>

        {/* Role & Department Card */}
        <div className="p-6 border-b border-[#E5E5E5] bg-white space-y-3">
          <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] space-y-2">
            <div className="text-[10px] font-mono uppercase text-[#737373]">Target Role & Department</div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-[#1A1A1A] flex items-center gap-1.5 font-mono">
                  <span className="text-blue-600">@</span>{linkInfo?.roleName}
                </div>
                <div className="text-xs text-[#525252] flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-[#737373]" />
                  {linkInfo?.deptName}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono px-2 py-1 bg-white border border-[#E5E5E5] text-[#525252] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#737373]" />
                  {daysLeft}d left
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-[#E5E5E5] text-[11px] text-[#737373] leading-relaxed flex items-center gap-1.5">
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
        <div className="p-6 bg-white space-y-4">
          
          {/* SCENARIO A: Existing Account Found -> Merge Confirmation */}
          {existingAccountData && existingAccountData.promptMerge ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <HelpCircle className="w-4 h-4" />
                  Existing Account Detected
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  You already have an active Mika account as <strong>{existingAccountData.user?.full_name}</strong> ({existingAccountData.user?.email}).
                </p>
                <p className="text-xs text-amber-800 font-semibold">
                  Add this role (<span className="font-mono">@{linkInfo?.roleName}</span>) to your existing profile?
                </p>
              </div>

              {/* Required Integrations Gating Card */}
              {renderRequiredConnectionsCard()}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmMerge}
                  disabled={submitting || !allRequirementsSatisfied}
                  className={`w-full py-2.5 text-xs font-mono uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-2 ${
                    !allRequirementsSatisfied
                      ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                      : 'bg-[#1A1A1A] text-white hover:bg-[#333333] cursor-pointer'
                  }`}
                >
                  {submitting ? 'Merging Role...' : 'Yes, Add Role to My Account'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelMerge}
                  disabled={submitting}
                  className="w-full py-2 bg-white text-[#525252] border border-[#E5E5E5] text-xs font-mono uppercase tracking-wider hover:bg-[#FAFAFA]"
                >
                  No, Cancel Join
                </button>
              </div>
            </div>
          ) : !googleAuthData ? (
            /* SCENARIO B: Initial State -> Prompt Google Sign-In */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-[#1A1A1A]">
                  Sign in with Google to accept this assignment
                </p>
                <p className="text-[11px] text-[#737373]">
                  Authentication is Google Sign-In only. No passwords required.
                </p>
              </div>

              {/* Primary Google Auth Button */}
              <button
                type="button"
                onClick={() => handleGoogleSignIn()}
                disabled={submitting}
                className="w-full py-3 bg-[#1A1A1A] text-white hover:bg-[#333333] transition-all flex items-center justify-center gap-3 text-xs font-semibold shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{submitting ? 'Connecting Google...' : 'Continue with Google Account'}</span>
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E5E5]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono">
                  <span className="bg-white px-2 text-[#737373]">Or select test account</span>
                </div>
              </div>

              {/* Quick test account buttons for development / review */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn({
                    email: 'elena.rostova@mika-org.edu',
                    fullName: 'Elena Rostova',
                    google_sub: 'google_sub_physics_003'
                  })}
                  className="w-full text-left p-2.5 border border-[#E5E5E5] hover:border-[#1A1A1A] transition-colors text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-[#1A1A1A]">Elena Rostova (Existing Account)</div>
                    <div className="text-[11px] text-[#737373]">elena.rostova@mika-org.edu • Tests Account Merge</div>
                  </div>
                  <span className="text-[10px] font-mono text-amber-600">Merge test →</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGoogleSignIn({
                    email: `new.teacher.${Math.floor(Math.random() * 1000)}@mika-org.edu`,
                    fullName: 'Dr. Arthur Pendelton',
                    google_sub: `sub_${Date.now()}`
                  })}
                  className="w-full text-left p-2.5 border border-[#E5E5E5] hover:border-[#1A1A1A] transition-colors text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-[#1A1A1A]">New Incoming Teacher (First-Time)</div>
                    <div className="text-[11px] text-[#737373]">Simulate first-time Google sign up</div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-600">New signup →</span>
                </button>
              </div>
            </div>
          ) : (
            /* SCENARIO C: First-time Google user -> Minimal Signup Fields */
            <form onSubmit={handleCompleteNewSignup} className="space-y-3.5">
              <div className="p-3 bg-[#FAFAFA] border border-[#E5E5E5] text-xs">
                <div className="text-[10px] font-mono uppercase text-[#737373] mb-1">Authenticated Google Email</div>
                <div className="font-mono font-bold text-[#1A1A1A]">{googleAuthData.email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                  placeholder="e.g. Dr. Arthur Pendelton"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Preferred Name / Call Name
                </label>
                <input
                  type="text"
                  required
                  value={preferredName}
                  onChange={e => setPreferredName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                  placeholder="e.g. Arthur"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                  Gender (Administrative Profile)
                </label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none bg-white"
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
                className={`w-full py-2.5 text-xs font-mono uppercase tracking-wider font-semibold transition-colors flex items-center justify-center gap-2 ${
                  !allRequirementsSatisfied
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-[#1A1A1A] text-white hover:bg-[#333333] cursor-pointer'
                }`}
              >
                {submitting ? 'Creating Account & Binding...' : 'Accept Assignment & Enter Dashboard'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-[#E5E5E5] flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={onCancel}
              className="text-[#737373] hover:text-[#1A1A1A] text-[11px] flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Cancel & Return
            </button>
            <span className="text-[10px] font-mono text-[#737373]">
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
