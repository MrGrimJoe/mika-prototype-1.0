import React, { useState } from 'react';
import { signInWithGooglePopup } from '../../lib/firebase';
import { 
  ArrowLeft, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface SignInViewProps {
  onBackToLanding: () => void;
  onNavigateToCreateOrg: (googleData?: any) => void;
  onLoginSuccess: (user: any, session: any) => void;
  onOpenFlowchart?: () => void;
  seedUsers: Array<{
    id: string;
    email: string;
    fullName: string;
    preferredName: string;
    roleTitle: string;
    deptName: string;
    isRoot?: boolean;
  }>;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onBackToLanding,
  onNavigateToCreateOrg,
  onLoginSuccess,
  seedUsers
}) => {
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [googleDataForCreate, setGoogleDataForCreate] = useState<any | null>(null);

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    setNotFoundEmail(null);
    setGoogleDataForCreate(null);

    try {
      const authRes = await signInWithGooglePopup();
      if (!authRes.success || !authRes.user) {
        throw new Error(authRes.error || 'Google sign in was cancelled or failed.');
      }
      const googleUser = authRes.user;
      
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSub: googleUser.uid,
          email: googleUser.email,
          fullName: googleUser.displayName || 'Google User',
          photoUrl: googleUser.photoURL || undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.user) {
        onLoginSuccess(data.user, data.session);
      } else if (res.status === 404 || data.needsOnboarding || data.isNew) {
        const prefillData = data.googleData || {
          email: googleUser.email || '',
          google_sub: googleUser.uid,
          fullName: googleUser.displayName || 'Google User',
          preferredName: googleUser.displayName?.split(' ')[0] || 'User',
          photoUrl: googleUser.photoURL || ''
        };
        setGoogleDataForCreate(prefillData);
        setNotFoundEmail(googleUser.email || 'this account');
        setErrorMessage(`No active organization account was found for ${googleUser.email}. You can create an organization as master root.`);
      } else {
        setErrorMessage(data.error || 'Unable to authenticate with Google. Please try again.');
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      // Demo fallback if popup blocked in iframe preview
      if (seedUsers && seedUsers.length > 0) {
        const rootUser = seedUsers.find(u => u.isRoot) || seedUsers[0];
        handleSelectSeedUser(rootUser);
      } else {
        setErrorMessage(err.message || 'Google popup was cancelled or blocked by browser.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle Email Magic Sign In
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setEmailLoading(true);
    setErrorMessage(null);
    setNotFoundEmail(null);

    try {
      const res = await fetch('/api/auth/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setEmailSent(true);
      } else {
        setErrorMessage(data.error || 'Failed to dispatch magic link.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Email sign-in is currently unavailable.');
    } finally {
      setEmailLoading(false);
    }
  };

  // One-Click Switcher for Demo / Evaluation
  const handleSelectSeedUser = async (user: typeof seedUsers[0]) => {
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onLoginSuccess(data.user, data.session);
      } else {
        onLoginSuccess(
          {
            id: user.id,
            email: user.email,
            full_name: user.fullName,
            preferred_name: user.preferredName,
            roleTitle: user.roleTitle,
            isRoot: user.isRoot
          },
          { sessionId: `sess_${Date.now()}`, token: `tok_${Date.now()}` }
        );
      }
    } catch (e) {
      onLoginSuccess(
        {
          id: user.id,
          email: user.email,
          full_name: user.fullName,
          preferred_name: user.preferredName,
          roleTitle: user.roleTitle,
          isRoot: user.isRoot
        },
        { sessionId: `sess_${Date.now()}`, token: `tok_${Date.now()}` }
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C2438] flex flex-col justify-between selection:bg-[#E8E4DA] selection:text-[#1C2438]">
      {/* Top Header */}
      <header className="border-b border-[#DAD5C9] bg-[#F7F5F0] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return</span>
          </button>

          <span className="font-serif font-bold text-xl tracking-tight text-[#1C2438]">
            Mika
          </span>

          <button
            onClick={() => onNavigateToCreateOrg(googleDataForCreate)}
            className="text-xs font-mono text-[#2F3B7A] hover:underline font-semibold cursor-pointer"
          >
            Create organisation
          </button>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-serif font-bold text-[#1C2438] tracking-tight">
              Log in to Mika
            </h1>
            <p className="text-xs font-mono text-[#8A8578] mt-1">
              Authenticate with your verified identity.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-6 p-3 bg-[#FFF5F5] border border-[#FCA5A5] rounded-xs text-xs text-[#991B1B]">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-sans">{errorMessage}</div>
              </div>

              {notFoundEmail && (
                <div className="mt-3 pt-2 border-t border-[#FCA5A5] flex justify-end">
                  <button
                    onClick={() => onNavigateToCreateOrg(googleDataForCreate)}
                    className="text-[11px] font-mono font-bold text-[#2F3B7A] underline cursor-pointer"
                  >
                    Create organisation with this account &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Selection */}
          <div className="grid grid-cols-2 gap-1 bg-[#E8E4DA] p-1 rounded-xs border border-[#DAD5C9] mb-6">
            <button
              onClick={() => { setAuthMethod('google'); setErrorMessage(null); }}
              className={`py-2 text-xs font-mono uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
                authMethod === 'google'
                  ? 'bg-[#F7F5F0] text-[#1C2438] font-bold shadow-xs border border-[#DAD5C9]'
                  : 'text-[#8A8578] hover:text-[#1C2438]'
              }`}
            >
              Google Account
            </button>
            <button
              onClick={() => { setAuthMethod('email'); setErrorMessage(null); }}
              className={`py-2 text-xs font-mono uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
                authMethod === 'email'
                  ? 'bg-[#F7F5F0] text-[#1C2438] font-bold shadow-xs border border-[#DAD5C9]'
                  : 'text-[#8A8578] hover:text-[#1C2438]'
              }`}
            >
              Email Sign-In
            </button>
          </div>

          {/* Option 1: Google OAuth */}
          {authMethod === 'google' && (
            <div className="space-y-4">
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-neutral-50 text-[#3c4043] border border-[#dadce0] rounded-xs font-sans text-sm font-medium shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>

              <div className="p-3 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-[11px] font-mono text-[#5C574B] leading-relaxed">
                Mika uses Google OAuth for verified passwordless identity. Your account will automatically resolve to your active roles.
              </div>
            </div>
          )}

          {/* Option 2: Email Sign-In */}
          {authMethod === 'email' && (
            <div>
              {emailSent ? (
                <div className="p-4 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#2F3B7A] mx-auto mb-2" />
                  <div className="text-sm font-bold text-[#1C2438]">Verification Dispatched</div>
                  <p className="text-xs text-[#5C574B] mt-1 font-mono">
                    If {emailInput} is registered in an active organization, you will receive an entry link.
                  </p>
                  <button
                    onClick={() => setEmailSent(false)}
                    className="mt-3 text-xs font-mono uppercase underline text-[#2F3B7A] font-semibold cursor-pointer"
                  >
                    Try another email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-[#5C574B] mb-1">
                      Institutional Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8578]" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        placeholder="name@organisation.edu"
                        className="w-full pl-9 pr-3 py-2 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-xs font-sans text-[#1C2438] focus:border-[#1C2438] focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full py-2.5 bg-[#2F3B7A] hover:bg-[#253064] text-[#F7F5F0] rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span>{emailLoading ? 'Verifying...' : 'Proceed with Email'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Quick Demo Switcher */}
          <div className="mt-8 pt-5 border-t border-[#DAD5C9]">
            <div className="flex items-center justify-between mb-3 text-[10px] font-mono text-[#8A8578]">
              <span>SAMPLE IDENTITIES</span>
              <span>ONE-CLICK ACCESS</span>
            </div>

            <div className="space-y-1.5">
              {seedUsers.slice(0, 3).map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectSeedUser(user)}
                  className="w-full p-2 bg-[#F7F5F0] hover:bg-[#E8E4DA] border border-[#DAD5C9] rounded-xs text-left transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div>
                    <div className="text-xs font-semibold text-[#1C2438] flex items-center gap-1.5">
                      <span>{user.fullName}</span>
                      {user.isRoot && (
                        <span className="text-[9px] font-mono bg-[#E8E4DA] text-[#2F3B7A] px-1 py-0.2 rounded-xs font-bold">
                          ROOT
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#8A8578]">
                      {user.roleTitle} &bull; {user.deptName}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#8A8578] group-hover:text-[#1C2438] transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DAD5C9] bg-[#F7F5F0] py-3 text-center text-xs font-mono text-[#8A8578]">
        Deterministic organizational authorization &bull; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
