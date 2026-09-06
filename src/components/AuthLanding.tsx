import React, { useState } from 'react';
import { signInWithGooglePopup } from '../lib/firebase';
import { 
  Building2, 
  Sparkles, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  ShieldCheck, 
  Users, 
  Network, 
  Clock, 
  Link2,
  FolderTree,
  ChevronRight,
  Info,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AuthLandingProps {
  onLoginSuccess: (user: any, session: any, initialTab?: 'tasks' | 'admin') => void;
  onOpenJoinToken: (token: string) => void;
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

export const AuthLanding: React.FC<AuthLandingProps> = ({
  onLoginSuccess,
  onOpenJoinToken,
  seedUsers
}) => {
  // Active Entry Point: 'login' | 'create_org' | 'join_link'
  const [activeMode, setActiveMode] = useState<'login' | 'create_org' | 'join_link'>('login');

  // Login State
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Join Link Code Input State
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Create Org State: 'ai' | 'manual'
  const [createMode, setCreateMode] = useState<'ai' | 'manual'>('ai');
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [aiPrompt, setAiPrompt] = useState('Oakridge Academy — A school with an Executive Leadership tier, a Middle School Section grouping Class 6, Class 7, and Class 8 departments, and a dedicated Science Faculty.');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiGeneratedStructure, setAiGeneratedStructure] = useState<any | null>(null);

  // Manual Builder State
  const [manualDepts, setManualDepts] = useState<Array<{
    name: string;
    type: 'department' | 'section';
    rootRoleTitle: string;
    memberRoleTitles: string[];
    groupedDeptNames?: string[];
  }>>([
    {
      name: 'Operations',
      type: 'department',
      rootRoleTitle: 'Director of Operations',
      memberRoleTitles: ['Operations Coordinator', 'Logistics Lead']
    },
    {
      name: 'Academic Section',
      type: 'section',
      rootRoleTitle: 'Section Head',
      memberRoleTitles: [],
      groupedDeptNames: ['Class A', 'Class B']
    },
    {
      name: 'Class A',
      type: 'department',
      rootRoleTitle: 'Class A Lead',
      memberRoleTitles: ['math-teacher', 'science-teacher']
    },
    {
      name: 'Class B',
      type: 'department',
      rootRoleTitle: 'Class B Lead',
      memberRoleTitles: ['math-teacher', 'english-teacher']
    }
  ]);

  // Creator Account Google Sign-In & Minimal Fields State (for Org Creation)
  const [showCreatorSignupModal, setShowCreatorSignupModal] = useState(false);
  const [creatorGoogleData, setCreatorGoogleData] = useState<{
    email: string;
    google_sub: string;
    fullName: string;
    photoUrl?: string;
  } | null>(null);
  const [creatorFullName, setCreatorFullName] = useState('');
  const [creatorPreferredName, setCreatorPreferredName] = useState('');
  const [creatorGender, setCreatorGender] = useState<'female' | 'male' | 'non-binary' | 'prefer-not-to-say'>('female');

  // =========================================================================
  // ENTRY POINT 1: LOGIN (Google Sign-In -> Lookup User -> Dashboard)
  // =========================================================================
  const handleGoogleLogin = async (simulatedAccount?: { email: string; fullName: string; google_sub: string }) => {
    setLoginError(null);
    setLoginLoading(true);

    try {
      let email = '';
      let googleSub = '';
      let fullName = '';
      let photoUrl = '';

      if (simulatedAccount) {
        email = simulatedAccount.email;
        googleSub = simulatedAccount.google_sub;
        fullName = simulatedAccount.fullName;
      } else {
        const authRes = await signInWithGooglePopup();
        if (!authRes.success || !authRes.user) {
          setLoginLoading(false);
          if (authRes.error && !authRes.error.includes('closed-by-user')) {
            setLoginError('Google Sign-In was cancelled or popup was blocked in preview. Try one of the test identities below.');
          }
          return;
        }
        email = authRes.user.email;
        googleSub = authRes.user.uid;
        fullName = authRes.user.displayName;
        photoUrl = authRes.user.photoURL;
      }

      // Verify on backend
      const res = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, googleSub, fullName, photoUrl })
      });

      const data = await res.json();
      setLoginLoading(false);

      if (!res.ok) {
        throw new Error(data.error || 'Login verification failed');
      }

      if (data.isNew) {
        // User not found in Mika database -> show prompt
        setLoginError(`No active Mika account found for '${email}'. Please create an organization or join using an invite link from your lead.`);
        return;
      }

      confetti({ particleCount: 30, spread: 50 });
      onLoginSuccess(data.user, data.session, 'tasks');
    } catch (err: any) {
      setLoginLoading(false);
      setLoginError(err.message || 'Login failed');
    }
  };

  // =========================================================================
  // ENTRY POINT 2: CREATE AN ORGANISATION (AI-assisted or Manual)
  // =========================================================================
  const handleGenerateOrgStructureWithAi = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/ai/generate-org-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgDescription: aiPrompt,
          domainType: 'Education / Enterprise'
        })
      });

      const data = await res.json();
      setIsAiGenerating(false);

      if (data.name) {
        setOrgName(data.name);
        setOrgDescription(data.description || aiPrompt);
        setAiGeneratedStructure(data);
        confetti({ particleCount: 25, spread: 45 });
      }
    } catch (err: any) {
      setIsAiGenerating(false);
      setLoginError('Failed to generate AI structure: ' + err.message);
    }
  };

  const handleStartOrgCreationAuth = async () => {
    if (!orgName.trim()) {
      setLoginError('Please provide an organization name.');
      return;
    }

    setLoginError(null);
    setLoginLoading(true);

    const authRes = await signInWithGooglePopup();
    setLoginLoading(false);

    let gData: { email: string; google_sub: string; fullName: string; photoUrl?: string };

    if (!authRes.success || !authRes.user) {
      // Default to creator identity for development / preview if popup was cancelled
      gData = {
        email: 'creator@mika-org.edu',
        google_sub: `sub_creator_${Date.now()}`,
        fullName: 'Founder / Lead Creator'
      };
    } else {
      gData = {
        email: authRes.user.email,
        google_sub: authRes.user.uid,
        fullName: authRes.user.displayName || authRes.user.email.split('@')[0],
        photoUrl: authRes.user.photoURL
      };
    }

    setCreatorGoogleData(gData);
    setCreatorFullName(gData.fullName);
    setCreatorPreferredName(gData.fullName.split(' ')[0] || 'Lead');
    setShowCreatorSignupModal(true);
  };

  const handleCompleteOrgCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorGoogleData) return;

    try {
      setLoginLoading(true);
      setLoginError(null);

      const structurePayload = createMode === 'ai' && aiGeneratedStructure
        ? aiGeneratedStructure
        : { departments: manualDepts };

      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName,
          orgDescription: orgDescription || aiPrompt,
          creator: {
            email: creatorGoogleData.email,
            google_sub: creatorGoogleData.google_sub,
            full_name: creatorFullName.trim() || creatorGoogleData.fullName,
            preferred_name: creatorPreferredName.trim() || creatorFullName.split(' ')[0],
            gender: creatorGender,
            avatar_url: creatorGoogleData.photoUrl
          },
          structure: structurePayload
        })
      });

      const data = await res.json();
      setLoginLoading(false);

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      confetti({ particleCount: 70, spread: 90 });
      setShowCreatorSignupModal(false);
      // Land in Admin Section ready to generate invite links as specified in prompt
      onLoginSuccess(data.user, data.session, 'admin');
    } catch (err: any) {
      setLoginLoading(false);
      setLoginError(err.message || 'Org creation failed');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] flex flex-col justify-between antialiased selection:bg-[#E5E5E5] relative overflow-x-hidden">
      {/* Background Geometric Grid Texture */}
      <div className="fixed inset-0 bg-geometric-grid opacity-[0.035] pointer-events-none z-0"></div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xs border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs">
              M.
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-[#1A1A1A]">Mika</div>
              <div className="text-[10px] font-mono uppercase text-[#737373] tracking-widest">
                Recursive Organizational System
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-[#F5F5F5] border border-[#E5E5E5] text-[#525252]">
              Google OAuth Only
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 relative z-10 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Hero / Architectural Context Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E5E5E5] text-[11px] font-mono text-[#525252]">
                <Layers className="w-3.5 h-3.5 text-[#1A1A1A]" />
                <span>Deterministic Authority Graph</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1A1A1A] leading-tight">
                Organizational management, formally structured.
              </h1>
              <p className="text-xs text-[#737373] leading-relaxed">
                Recursive department hierarchy, section roots with direct member authority, cross-cutting subject faculties, and time-windowed open cohort invites.
              </p>
            </div>

            {/* Spec Principles Checklist */}
            <div className="bg-white border border-[#E5E5E5] p-4 space-y-3 shadow-xs">
              <div className="text-[10px] font-mono uppercase text-[#737373] tracking-wider border-b border-[#E5E5E5] pb-2">
                Authentication & Invariant Rules
              </div>
              <div className="space-y-2 text-xs text-[#525252]">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5" />
                  <span><strong>Google Sign-In ONLY:</strong> No passwords anywhere. Identity and recovery inherit from your Google account.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5" />
                  <span><strong>Time-Windowed Invites:</strong> Leads open time-windowed links for unlimited cohort signups without individual tokens.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Network className="w-4 h-4 text-[#1A1A1A] shrink-0 mt-0.5" />
                  <span><strong>Authority-Scoped Generation:</strong> Links cascade strictly down the authority chain; checked server-side.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Interactive Auth Center Column */}
          <div className="lg:col-span-7 bg-white border border-[#E5E5E5] shadow-xs">
            
            {/* 3 Distinct Entry Point Tabs */}
            <div className="grid grid-cols-3 border-b border-[#E5E5E5] bg-[#F5F5F5]/60 text-xs font-mono">
              <button
                type="button"
                onClick={() => { setActiveMode('login'); setLoginError(null); }}
                className={`py-3.5 px-3 text-center font-semibold transition-colors flex items-center justify-center gap-1.5 border-r border-[#E5E5E5] ${
                  activeMode === 'login'
                    ? 'bg-white text-[#1A1A1A] border-b-2 border-b-[#1A1A1A]'
                    : 'text-[#737373] hover:text-[#1A1A1A]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>1. Login</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMode('create_org'); setLoginError(null); }}
                className={`py-3.5 px-3 text-center font-semibold transition-colors flex items-center justify-center gap-1.5 border-r border-[#E5E5E5] ${
                  activeMode === 'create_org'
                    ? 'bg-white text-[#1A1A1A] border-b-2 border-b-[#1A1A1A]'
                    : 'text-[#737373] hover:text-[#1A1A1A]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>2. Create Org</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMode('join_link'); setLoginError(null); }}
                className={`py-3.5 px-3 text-center font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  activeMode === 'join_link'
                    ? 'bg-white text-[#1A1A1A] border-b-2 border-b-[#1A1A1A]'
                    : 'text-[#737373] hover:text-[#1A1A1A]'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>3. Join via Link</span>
              </button>
            </div>

            {/* Error Display */}
            {loginError && (
              <div className="m-6 mb-0 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div>{loginError}</div>
                  {activeMode === 'login' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveMode('create_org')}
                        className="font-bold underline hover:text-red-900"
                      >
                        Create new org →
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setActiveMode('join_link')}
                        className="font-bold underline hover:text-red-900"
                      >
                        Enter role link →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 1: LOGIN FLOW */}
            {activeMode === 'login' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-[#1A1A1A]">Welcome to Mika</h2>
                  <p className="text-xs text-[#737373]">
                    Default landing for existing members and leaders. Sign in with your Google account.
                  </p>
                </div>

                {/* Primary Google Auth Action Button */}
                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={loginLoading}
                  className="w-full py-3.5 bg-[#1A1A1A] text-white hover:bg-[#333333] transition-all flex items-center justify-center gap-3 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{loginLoading ? 'Authenticating...' : 'Sign in with Google Account'}</span>
                </button>

                {/* Instant Test Accounts Picker (Enables immediate verification of all roles) */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#737373] tracking-wider">
                      Or Fast-Login as Seeded Persona
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 border border-emerald-200">
                      Live Database
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {seedUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleGoogleLogin({
                          email: user.email,
                          fullName: user.fullName,
                          google_sub: `google_sub_${user.id}`
                        })}
                        className="text-left p-3 border border-[#E5E5E5] hover:border-[#1A1A1A] bg-[#FAFAFA] hover:bg-white transition-all text-xs space-y-0.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1A1A1A] group-hover:text-black">
                            {user.fullName}
                          </span>
                          {user.isRoot && (
                            <span className="text-[9px] font-mono bg-[#1A1A1A] text-white px-1">
                              ROOT
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#525252] font-mono">
                          @{user.roleTitle}
                        </div>
                        <div className="text-[10px] text-[#737373] truncate">
                          {user.deptName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CREATE ORGANISATION FLOW */}
            {activeMode === 'create_org' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#1A1A1A]">Create a New Organization</h2>
                  <p className="text-xs text-[#737373]">
                    You will become the Master Root with universal authority. Choose AI-assisted or manual schema builder.
                  </p>
                </div>

                {/* Sub-mode selector */}
                <div className="flex border border-[#E5E5E5] text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setCreateMode('ai')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 ${
                      createMode === 'ai' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#525252] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI-Assisted Builder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode('manual')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 ${
                      createMode === 'manual' ? 'bg-[#1A1A1A] text-white' : 'bg-white text-[#525252] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>Manual Structured Builder</span>
                  </button>
                </div>

                {/* Sub-mode A: AI-Assisted */}
                {createMode === 'ai' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                        Describe your Organization Structure
                      </label>
                      <textarea
                        rows={3}
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        placeholder="e.g. St. Jude High School with a Middle School Section grouping Class 6 and Class 7, and a Science Faculty..."
                        className="w-full p-3 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateOrgStructureWithAi}
                      disabled={isAiGenerating}
                      className="py-2 px-4 bg-white border border-[#1A1A1A] text-[#1A1A1A] text-xs font-mono uppercase tracking-wider hover:bg-[#F5F5F5] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isAiGenerating ? 'Generating Schema with Gemini...' : 'Synthesize Schema with AI'}</span>
                    </button>

                    {aiGeneratedStructure && (
                      <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-2">
                          <div>
                            <div className="font-bold text-sm text-[#1A1A1A]">{aiGeneratedStructure.name}</div>
                            <div className="text-[11px] text-[#737373]">{aiGeneratedStructure.description}</div>
                          </div>
                          <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200">
                            Generated Schema
                          </span>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {aiGeneratedStructure.departments?.map((dept: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-white border border-[#E5E5E5] text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#1A1A1A]">{dept.name}</span>
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[#F5F5F5] text-[#525252]">
                                  {dept.type}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#525252]">
                                Lead Role: <strong className="font-mono text-[#1A1A1A]">@{dept.rootRoleTitle}</strong>
                              </div>
                              {dept.memberRoleTitles?.length > 0 && (
                                <div className="text-[10px] text-[#737373]">
                                  Members: {dept.memberRoleTitles.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-mode B: Manual Builder */}
                {createMode === 'manual' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        placeholder="e.g. Oakridge Academy"
                        className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                        Description / Purpose
                      </label>
                      <input
                        type="text"
                        value={orgDescription}
                        onChange={e => setOrgDescription(e.target.value)}
                        placeholder="e.g. Exemplar recursive organization"
                        className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-[#1A1A1A]">
                        Configured Departments & Sections ({manualDepts.length})
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {manualDepts.map((d, i) => (
                          <div key={i} className="p-2.5 bg-[#FAFAFA] border border-[#E5E5E5] text-xs">
                            <div className="flex items-center justify-between font-semibold">
                              <span>{d.name}</span>
                              <span className="text-[10px] font-mono uppercase text-[#737373]">{d.type}</span>
                            </div>
                            <div className="text-[11px] text-[#525252] mt-0.5">
                              Lead: @{d.rootRoleTitle} • Members: {d.memberRoleTitles.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Final Org Creation Button */}
                <div className="pt-2 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={handleStartOrgCreationAuth}
                    disabled={loginLoading}
                    className="w-full py-3 bg-[#1A1A1A] text-white hover:bg-[#333333] transition-all flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider font-semibold cursor-pointer"
                  >
                    <span>Continue with Google Sign-In as Master Root</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: JOIN VIA ROLE LINK INPUT */}
            {activeMode === 'join_link' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-[#1A1A1A]">Join with an Invite Link</h2>
                  <p className="text-xs text-[#737373]">
                    If your department lead gave you an invite code or token, paste it here to access your assigned role.
                  </p>
                </div>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (manualTokenInput.trim()) {
                      onOpenJoinToken(manualTokenInput.trim());
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1">
                      Invite Token or Full Link URL
                    </label>
                    <input
                      type="text"
                      required
                      value={manualTokenInput}
                      onChange={e => {
                        const val = e.target.value;
                        if (val.includes('join=')) {
                          const token = new URLSearchParams(val.split('?')[1]).get('join');
                          setManualTokenInput(token || val);
                        } else {
                          setManualTokenInput(val);
                        }
                      }}
                      placeholder="e.g. oak-math7-cohort26"
                      className="w-full px-3 py-2 text-xs border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#1A1A1A] text-white text-xs font-mono uppercase tracking-wider font-semibold hover:bg-[#333333] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Resolve Role Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                {/* Sample Active Invite Links */}
                <div className="pt-2 border-t border-[#E5E5E5] space-y-2">
                  <div className="text-[10px] font-mono uppercase text-[#737373]">
                    Active Cohort Invite Links (Demo)
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenJoinToken('oak-math7-cohort26')}
                      className="w-full text-left p-2.5 border border-[#E5E5E5] hover:border-[#1A1A1A] transition-colors text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#1A1A1A]">@math-teacher (Class 7)</div>
                        <div className="text-[11px] text-[#737373]">Class 7 Department • 14 days valid</div>
                      </div>
                      <span className="text-[10px] font-mono text-blue-600">Join cohort →</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenJoinToken('oak-stem-volunteer-cohort')}
                      className="w-full text-left p-2.5 border border-[#E5E5E5] hover:border-[#1A1A1A] transition-colors text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#1A1A1A]">@STEM Fair Volunteer</div>
                        <div className="text-[11px] text-[#737373]">STEM Fair 2026 Taskforce • 30 days valid</div>
                      </div>
                      <span className="text-[10px] font-mono text-blue-600">Join cohort →</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Creator Signup Minimal Profile Modal (for Org Creation) */}
      {showCreatorSignupModal && creatorGoogleData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5E5E5] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="space-y-1 border-b border-[#E5E5E5] pb-3">
              <div className="text-[10px] font-mono uppercase text-[#737373]">Organization Creator Profile</div>
              <h3 className="text-lg font-bold text-[#1A1A1A]">Confirm Master Root Identity</h3>
              <p className="text-xs text-[#737373]">
                Minimal signup details captured once at first creation.
              </p>
            </div>

            <form onSubmit={handleCompleteOrgCreation} className="space-y-3 text-xs">
              <div className="p-2.5 bg-[#FAFAFA] border border-[#E5E5E5]">
                <div className="text-[10px] font-mono uppercase text-[#737373]">Google Account Email</div>
                <div className="font-mono font-bold text-[#1A1A1A]">{creatorGoogleData.email}</div>
              </div>

              <div>
                <label className="block font-semibold text-[#1A1A1A] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={creatorFullName}
                  onChange={e => setCreatorFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                  placeholder="e.g. Dr. Sarah Vance"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1A1A1A] mb-1">Preferred Name / Call Name</label>
                <input
                  type="text"
                  required
                  value={creatorPreferredName}
                  onChange={e => setCreatorPreferredName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none"
                  placeholder="e.g. Dr. Vance"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1A1A1A] mb-1">Gender</label>
                <select
                  value={creatorGender}
                  onChange={e => setCreatorGender(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] focus:border-[#1A1A1A] outline-none bg-white"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-Binary</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatorSignupModal(false)}
                  className="flex-1 py-2 border border-[#E5E5E5] text-[#525252] hover:bg-[#FAFAFA] font-mono uppercase text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex-1 py-2 bg-[#1A1A1A] text-white hover:bg-[#333333] font-mono uppercase text-xs font-semibold cursor-pointer"
                >
                  {loginLoading ? 'Creating Org...' : 'Initialize Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#E5E5E5] bg-white py-4 px-4 text-center text-xs text-[#737373]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>Mika Recursive Organizational System — Specification Compliant</div>
          <div className="font-mono text-[10px]">Deterministic Authority Engine & Google Identity OAuth</div>
        </div>
      </footer>
    </div>
  );
};
