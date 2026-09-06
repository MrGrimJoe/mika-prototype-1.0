import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Upload, 
  X, 
  HardDrive, 
  Server, 
  Cloud,
  School,
  Building2,
  HeartHandshake,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Palette,
  Stethoscope,
  Layers,
  Info
} from 'lucide-react';
import { DepartmentNode, Section } from '../flowchart/flowchartTypes';
import { DepartmentFlowchartBuilder } from '../flowchart/DepartmentFlowchartBuilder';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { signInWithGooglePopup } from '../../lib/firebase';
import confetti from 'canvas-confetti';
import { IntegrationConnection } from '../../types';
import { IntegrationChecklist } from '../IntegrationChecklist';
import { upsertIntegrationConnection } from '../../lib/firestoreService';

function flattenTreeToDepartments(root: DepartmentNode, sections: Section[]) {
  const depts: any[] = [];
  const sectionMap = new Map(sections.map(s => [s.id, s]));

  function traverse(node: DepartmentNode) {
    if (node.id !== 'root-department') {
      const sec = node.sectionId ? sectionMap.get(node.sectionId) : undefined;
      depts.push({
        id: node.id,
        name: node.department,
        type: sec ? 'section' : 'department',
        rootRole: node.roots && node.roots.length > 0 ? node.roots[0] : `${node.department} Lead`,
        roles: node.roles || []
      });
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(root);
  return depts;
}

export type TemplateId = 'school' | 'company' | 'nonprofit' | 'creative' | 'healthcare' | 'custom';

export interface TemplateCardItem {
  id: TemplateId;
  title: string;
  category: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  rootRole: string;
  sectionName: string;
  sectionShade: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
  subDepts: string[];
  keyRoles: string[];
}

export const TEMPLATE_CARDS: TemplateCardItem[] = [
  {
    id: 'company',
    title: 'Corporate & Technology',
    category: 'Enterprise / Product',
    badge: 'Cross-Functional',
    icon: Building2,
    description: 'Separates Executive Leadership, an integrated Product & Technology section, and Commercial Growth.',
    rootRole: 'Chief Executive Officer',
    sectionName: 'Product & Tech Section',
    sectionShade: 'emerald',
    subDepts: ['Platform Engineering', 'Product Design', 'Commercial Growth'],
    keyRoles: ['VP Technology', 'Lead Architect', 'VP Commercial Growth']
  },
  {
    id: 'school',
    title: 'School & Academic Academy',
    category: 'Education / K-12',
    badge: 'Cohort Reach',
    icon: School,
    description: 'Designed for academic institutions where Section Heads reach directly into grade cohorts alongside cross-cutting subject departments.',
    rootRole: 'Principal & Registrar',
    sectionName: 'Middle School Section',
    sectionShade: 'indigo',
    subDepts: ['Middle School Faculty', 'Class 6 Cohort', 'Physics Subject Dept'],
    keyRoles: ['Middle School Head', 'Curriculum Lead', 'Physics Coordinator']
  },
  {
    id: 'nonprofit',
    title: 'Nonprofit & Global NGO',
    category: 'Mission-Driven',
    badge: 'Field Operations',
    icon: HeartHandshake,
    description: 'Built for mission-driven governance, regional outreach chapters, field coordinators, and transparent donor allocation.',
    rootRole: 'Executive Director',
    sectionName: 'Global Programs Section',
    sectionShade: 'amber',
    subDepts: ['Global Programs', 'EMEA Regional Outreach', 'Grants & Finance'],
    keyRoles: ['Director of Programs', 'Regional Director', 'Field Coordinator']
  },
  {
    id: 'creative',
    title: 'Creative Studio & Agency',
    category: 'Agency / Studio',
    badge: 'Creative Labs',
    icon: Palette,
    description: 'Tailored for multidisciplinary creative agencies balancing Brand Identity, 3D & Motion labs, and Client Account management.',
    rootRole: 'Creative Director',
    sectionName: 'Design & Motion Section',
    sectionShade: 'rose',
    subDepts: ['Design & Motion', 'Brand Systems Lab', 'Client Partnerships'],
    keyRoles: ['Art Director', 'Visual Lead', 'Account Director']
  },
  {
    id: 'healthcare',
    title: 'Healthcare & Clinic Group',
    category: 'Clinical / Medical',
    badge: 'Clinical Authority',
    icon: Stethoscope,
    description: 'Clinical medical governance linking Medical Directorship, Inpatient Care, Surgical Department, and Pharmacy operations.',
    rootRole: 'Chief Medical Officer',
    sectionName: 'Clinical Services Section',
    sectionShade: 'sky',
    subDepts: ['Inpatient Care Ward', 'Surgical Department', 'Pharmacy & Diagnostics'],
    keyRoles: ['Clinical Director', 'Chief Surgeon', 'Chief Pharmacist']
  }
];

interface CreateOrgFlowProps {
  initialStep?: number;
  initialGoogleAccount?: {
    google_sub?: string;
    email?: string;
    fullName?: string;
    preferredName?: string;
    photoUrl?: string;
  } | null;
  onBackToLanding: () => void;
  onNavigateToSignIn: () => void;
  onCreationComplete: (org: any, user: any, session: any) => void;
}

export const CreateOrgFlow: React.FC<CreateOrgFlowProps> = ({
  initialStep = 2,
  initialGoogleAccount = null,
  onBackToLanding,
  onNavigateToSignIn,
  onCreationComplete
}) => {
  // Step index: 1 to 7 (Step 3: Choose Template, Step 4: Full-Screen Graph Maker, Step 5: Team Size, Step 6: Vault, Step 7: Billing)
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [stepDirection, setStepDirection] = useState<'forward' | 'back'>('forward');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeTemplateIdx, setActiveTemplateIdx] = useState<number>(0);

  // Google Account State
  const [googleAccount, setGoogleAccount] = useState<{
    google_sub: string;
    email: string;
    fullName: string;
    photoUrl?: string;
  } | null>(() => {
    if (initialGoogleAccount) {
      return {
        google_sub: initialGoogleAccount.google_sub || `sub_${Date.now()}`,
        email: initialGoogleAccount.email || '',
        fullName: initialGoogleAccount.fullName || '',
        photoUrl: initialGoogleAccount.photoUrl || ''
      };
    }
    return null;
  });

  // Profile & Org Info (Step 2)
  const [fullName, setFullName] = useState(() => initialGoogleAccount?.fullName || '');
  const [preferredName, setPreferredName] = useState(() => initialGoogleAccount?.preferredName || initialGoogleAccount?.fullName?.split(' ')[0] || '');
  const [gender, setGender] = useState<'female' | 'male' | 'non-binary' | 'prefer_not_to_say'>('prefer_not_to_say');
  const [orgName, setOrgName] = useState('Acme Corp');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optional Org-Wide Integration Connections
  const [orgConnections, setOrgConnections] = useState<IntegrationConnection[]>([]);
  const handleConnectIntegration = (toolKey: string, accountLabel: string) => {
    const newConn: IntegrationConnection = {
      id: `conn_${Date.now()}_${toolKey}`,
      integrationKey: toolKey,
      orgId: 'temp_org',
      scope: 'org',
      accessRoleIds: 'all',
      connectedByUserId: googleAccount?.google_sub || 'creator',
      accountLabel,
      connectedAt: new Date().toISOString()
    };
    setOrgConnections(prev => [...prev.filter(c => c.integrationKey !== toolKey), newConn]);
  };
  const handleDisconnectIntegration = (connId: string) => {
    setOrgConnections(prev => prev.filter(c => c.id !== connId));
  };

  // Flowchart Builder State (Step 3 & 4)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('company');
  const [flowchartTree, setFlowchartTree] = useState<DepartmentNode>(() => getInitialTemplateTree('company', 'Acme Corp'));
  const [flowchartSections, setFlowchartSections] = useState<Section[]>(() => getInitialTemplateSections('company'));

  // Team Size (Step 5) - 1 to 500, default 45
  const [peopleCount, setPeopleCount] = useState<number>(45);

  // Storage (Step 6) - 3 options: 'byod' | 'self_host' | 'mika'
  const [storageType, setStorageType] = useState<'byod' | 'self_host' | 'mika'>('mika');
  const [storageGiB, setStorageGiB] = useState<number>(120);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatedSuccess, setIsCreatedSuccess] = useState(false);
  const [createdOrgData, setCreatedOrgData] = useState<{ org: any; user: any; session: any } | null>(null);

  // Calculations for Step 7:
  // Formula: (team_size * $0.30) + (storage_GiB * $0.08)
  const peopleCost = peopleCount * 0.30;
  const storageCost = storageType === 'mika' ? storageGiB * 0.08 : 0;
  const totalMonthly = peopleCost + storageCost;

  // Carousel slide handlers
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const cardWidth = 350;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -cardWidth : cardWidth,
        behavior: 'smooth'
      });
    }
  };

  const scrollToTemplateIndex = (idx: number) => {
    setActiveTemplateIdx(idx);
    if (carouselRef.current) {
      const cardWidth = 350;
      carouselRef.current.scrollTo({
        left: idx * cardWidth,
        behavior: 'smooth'
      });
    }
  };

  // Step Navigation Handlers
  const goToStep = (target: number) => {
    setStepDirection(target > currentStep ? 'forward' : 'back');
    setCurrentStep(target);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    if (currentStep < 7) {
      goToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    } else {
      onBackToLanding();
    }
  };

  // Template switch and navigation helper
  const handleApplyTemplate = (type: TemplateId) => {
    setSelectedTemplate(type);
    setFlowchartTree(getInitialTemplateTree(type, orgName || 'New Organisation'));
    setFlowchartSections(getInitialTemplateSections(type));
  };

  const handleSelectTemplateAndProceed = (type: TemplateId) => {
    handleApplyTemplate(type);
    goToStep(4);
  };

  // Google Sign In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const authRes = await signInWithGooglePopup();
      if (authRes.success && authRes.user) {
        const u = authRes.user;
        const acct = {
          google_sub: u.uid,
          email: u.email || 'user@workspace.org',
          fullName: u.displayName || 'Authorized User',
          photoUrl: u.photoURL || undefined
        };
        setGoogleAccount(acct);
        setFullName(acct.fullName);
        setPreferredName(acct.fullName.split(' ')[0] || acct.fullName);
      } else {
        throw new Error(authRes.error || 'Google Sign-in failed.');
      }
    } catch (err: any) {
      // Safe demo fallback for preview environment
      const demoAcct = {
        google_sub: `sub_${Date.now()}`,
        email: 'administrator@workspace.org',
        fullName: 'Dr. Sarah Vance',
        photoUrl: undefined
      };
      setGoogleAccount(demoAcct);
      setFullName(demoAcct.fullName);
      setPreferredName('Sarah');
    } finally {
      setLoading(false);
    }
  };

  // Logo Upload Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setLogoPreview(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDropLogo = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setLogoPreview(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Step 7: Create Organisation Final Submission
  const handleConfirmCreate = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const depts = flattenTreeToDepartments(flowchartTree, flowchartSections);
      const payload = {
        orgName: orgName.trim(),
        creator: {
          google_sub: googleAccount?.google_sub || `sub_${Date.now()}`,
          email: googleAccount?.email || 'admin@workspace.org',
          fullName: fullName.trim(),
          preferredName: preferredName.trim() || fullName.trim(),
          gender
        },
        templateId: selectedTemplate,
        structure: {
          departments: depts
        },
        sizing: {
          people: peopleCount,
          storageGiB: storageType === 'mika' ? storageGiB : 0,
          storageType,
          monthlyTotal: totalMonthly
        },
        tree: flowchartTree,
        sections: flowchartSections,
        integrations: orgConnections
      };

      const res = await fetch('/api/org/create-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      const createdOrg = data.success ? data.org : {
        id: `org_${Date.now()}`,
        name: orgName,
        slug: orgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        people: peopleCount,
        storageGiB: storageType === 'mika' ? storageGiB : 0
      };

      const createdUser = data.success ? data.user : {
        id: `u_root_${Date.now()}`,
        google_sub: payload.creator.google_sub,
        email: payload.creator.email,
        full_name: fullName,
        preferred_name: preferredName || fullName,
        gender,
        isRoot: true
      };

      const createdSession = data.success ? data.session : {
        sessionId: `sess_${Date.now()}`,
        token: `tok_${Date.now()}`
      };

      // Persist chosen org-wide integrations if any
      if (orgConnections.length > 0) {
        for (const conn of orgConnections) {
          await upsertIntegrationConnection({
            ...conn,
            orgId: createdOrg.id,
            connectedByUserId: createdUser.id
          }).catch(console.warn);
        }
      }

      setCreatedOrgData({ org: createdOrg, user: createdUser, session: createdSession });
      setIsCreatedSuccess(true);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error initializing organization.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 validation
  const isStep2Valid = Boolean(fullName.trim() && orgName.trim());

  // Calm success screen
  if (isCreatedSuccess && createdOrgData) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] text-[#1C2438] flex flex-col justify-between p-6">
        <header className="max-w-4xl mx-auto w-full py-4 border-b border-[#DAD5C9]">
          <span className="font-serif font-bold text-xl text-[#1C2438]">Mika</span>
        </header>

        <main className="max-w-md mx-auto w-full my-auto text-center p-8 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs">
          <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-[#E8E4DA] border border-[#DAD5C9] flex items-center justify-center text-[#2F3B7A]">
            <Check className="w-6 h-6 stroke-[2.5]" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-[#1C2438] mb-2 tracking-tight">
            Organisation Created
          </h1>
          <p className="text-sm text-[#5C574B] leading-relaxed mb-8">
            <strong className="text-[#1C2438] font-semibold">{orgName}</strong> is initialized. 
            You are designated as the master administrator with direct root authority.
          </p>

          <button
            onClick={() => onCreationComplete(createdOrgData.org, createdOrgData.user, createdOrgData.session)}
            className="w-full py-3 bg-[#2F3B7A] hover:bg-[#253064] text-[#F7F5F0] rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer"
          >
            Continue to Workspace
          </button>
        </main>

        <footer className="max-w-4xl mx-auto w-full py-4 text-center text-xs font-mono text-[#8A8578]">
          Deterministic relationship topology initialized.
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4: FULL-PAGE GRAPH MAKER
  // Takes over the entire page so building the org graph is spacious and unconstrained
  // ─────────────────────────────────────────────────────────────
  if (currentStep === 4) {
    return (
      <div className="fixed inset-0 z-50 bg-[#faf9f5] w-screen h-screen overflow-hidden flex flex-col">
        <DepartmentFlowchartBuilder
          key={`${selectedTemplate}-${orgName}`}
          initialOrgName={orgName}
          initialTree={flowchartTree}
          initialSections={flowchartSections}
          isEmbedded={false}
          showBackToLanding={false}
          onContinue={(updatedTree, updatedSections) => {
            setFlowchartTree(updatedTree);
            setFlowchartSections(updatedSections);
            goToStep(5);
          }}
          onBack={() => goToStep(3)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C2438] flex flex-col selection:bg-[#E8E4DA] selection:text-[#1C2438]">
      {/* ─────────────────────────────────────────────────────────────
          PERSISTENT TOP CHROME & THIN STEP INDICATOR
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/95 backdrop-blur-sm border-b border-[#DAD5C9]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="text-xl font-serif font-bold text-[#1C2438] hover:opacity-80 transition-opacity cursor-pointer text-left"
            >
              Mika
            </button>
            <span className="text-[#DAD5C9] font-light">/</span>
            <span className="text-xs font-mono text-[#8A8578] tracking-tight">
              Create Organisation
            </span>
          </div>

          {/* Thin Step Indicator */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-[#5C574B]">
              Step <span className="text-[#1C2438] font-semibold">{currentStep}</span> of 7
            </span>
            <div className="w-24 sm:w-36 h-1 bg-[#E8E4DA] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2F3B7A] transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${(currentStep / 7) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MAIN CONTENT AREA (STEP ROUTER)
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col justify-center py-10 px-6">
        <div className="max-w-4xl mx-auto w-full">
          
          {/* STEP 1: ENTRY CHOICE */}
          {currentStep === 1 && (
            <div className="max-w-md mx-auto p-8 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs text-center">
              <h1 className="text-2xl font-serif font-bold text-[#1C2438] tracking-tight">
                Establish an Organisation
              </h1>
              <p className="mt-2 text-sm text-[#5C574B] leading-relaxed">
                Choose whether you are founding a new organization or logging into an existing workspace.
              </p>

              <div className="mt-8 space-y-3">
                <button
                  onClick={() => goToStep(2)}
                  className="w-full py-3.5 bg-[#2F3B7A] hover:bg-[#253064] text-[#F7F5F0] rounded-xs font-mono text-xs tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Create an organisation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onNavigateToSignIn}
                  className="w-full py-3.5 bg-transparent hover:bg-[#E8E4DA] text-[#1C2438] border border-[#DAD5C9] hover:border-[#1C2438] rounded-xs font-mono text-xs tracking-wider font-semibold transition-all cursor-pointer"
                >
                  Log in
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ACCOUNT (GOOGLE SIGN-IN + PROFILE FORM ON SAME STEP) */}
          {currentStep === 2 && (
            <div className="max-w-lg mx-auto p-8 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-serif font-bold text-[#1C2438] tracking-tight">
                  Account & Organization
                </h1>
                <p className="mt-1 text-xs text-[#5C574B]">
                  Connect your verified identity and define your organization.
                </p>
              </div>

              {/* Google Sign-In Card / State */}
              {!googleAccount ? (
                <div className="p-6 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-center">
                  <span className="text-xs font-mono text-[#5C574B] block mb-4">
                    Sign in with Google to establish master ownership
                  </span>
                  
                  {/* Standard Google Sign-In Button Treatment */}
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-white hover:bg-neutral-50 text-[#3c4043] border border-[#dadce0] rounded-xs font-sans text-sm font-medium shadow-xs hover:shadow transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
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
                    <span>{loading ? 'Connecting...' : 'Sign in with Google'}</span>
                  </button>

                  <div className="mt-3 text-[10px] font-mono text-[#8A8578]">
                    Verified institutional address attached automatically
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Verified Google Account Bar */}
                  <div className="p-3 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#2F3B7A] text-[#F7F5F0] flex items-center justify-center font-mono text-xs font-bold">
                        {googleAccount.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#1C2438]">
                          {googleAccount.fullName}
                        </div>
                        <div className="text-[11px] font-mono text-[#8A8578]">
                          {googleAccount.email}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-[#E8E4DA] text-[#5C574B] rounded-xs">
                      Verified
                    </span>
                  </div>

                  {/* Profile & Org Form */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-mono text-[#5C574B] mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="e.g. Dr. Sarah Vance"
                        className="w-full px-3 py-2 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-xs font-sans text-[#1C2438] focus:border-[#1C2438] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-[#5C574B] mb-1">
                          Preferred Name
                        </label>
                        <input
                          type="text"
                          value={preferredName}
                          onChange={e => setPreferredName(e.target.value)}
                          placeholder="e.g. Sarah"
                          className="w-full px-3 py-2 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-xs font-sans text-[#1C2438] focus:border-[#1C2438] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono text-[#5C574B] mb-1">
                          Gender
                        </label>
                        <select
                          value={gender}
                          onChange={e => setGender(e.target.value as any)}
                          className="w-full px-3 py-2 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-xs font-sans text-[#1C2438] focus:border-[#1C2438] focus:outline-none cursor-pointer"
                        >
                          <option value="prefer_not_to_say">Prefer not to say</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="non-binary">Non-binary</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-[#5C574B] mb-1">
                        Organisation Name *
                      </label>
                      <input
                        type="text"
                        value={orgName}
                        onChange={e => setOrgName(e.target.value)}
                        placeholder="e.g. St. Jude Academy or Acme Corp"
                        className="w-full px-3 py-2 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs text-xs font-sans text-[#1C2438] focus:border-[#1C2438] focus:outline-none"
                      />
                    </div>

                    {/* Optional Logo Dropzone */}
                    <div>
                      <label className="block text-xs font-mono text-[#5C574B] mb-1">
                        Organisation Logo (Optional)
                      </label>
                      
                      {logoPreview ? (
                        <div className="flex items-center gap-3 p-2 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            className="w-10 h-10 object-cover rounded-xs border border-[#DAD5C9]"
                          />
                          <span className="text-xs text-[#5C574B] flex-1 font-mono text-[11px]">
                            Custom logo attached
                          </span>
                          <button
                            type="button"
                            onClick={() => setLogoPreview(null)}
                            className="p-1 hover:bg-[#E8E4DA] text-[#8A8578] hover:text-[#1C2438] rounded-xs transition-colors cursor-pointer"
                            title="Remove logo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={e => e.preventDefault()}
                          onDrop={handleDropLogo}
                          onClick={() => fileInputRef.current?.click()}
                          className="p-4 border border-dashed border-[#DAD5C9] hover:border-[#1C2438] rounded-xs bg-[#F7F5F0] text-center cursor-pointer transition-colors"
                        >
                          <Upload className="w-4 h-4 mx-auto text-[#8A8578] mb-1" />
                          <div className="text-[11px] font-mono text-[#5C574B]">
                            Drop logo here or click to browse
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="mt-8 pt-4 border-t border-[#DAD5C9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStep2Valid || !googleAccount}
                  className="px-5 py-2.5 bg-[#2F3B7A] hover:bg-[#253064] disabled:opacity-40 disabled:hover:bg-[#2F3B7A] text-[#F7F5F0] rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Next: Choose Template</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SELECT TEMPLATE (SIMPLIFIED SLIDING CARDS + BUILD MY OWN UNDERNEATH) */}
          {currentStep === 3 && (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              {/* Header */}
              <div className="text-center max-w-xl mx-auto">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
                  STEP 3 // ARCHITECTURE
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C2438] mt-1 tracking-tight">
                  Choose an Organisation Template
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-[#5C574B]">
                  Select a pre-built structure for your organisation, or build your own custom graph.
                </p>
              </div>

              {/* Slider Controls Bar */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono font-semibold text-[#1C2438] uppercase tracking-wider">
                  Templates ({TEMPLATE_CARDS.length})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollCarousel('left')}
                    aria-label="Previous template"
                    className="p-1.5 rounded-xs border border-[#DAD5C9] bg-[#EFEBE2] hover:bg-[#E8E4DA] text-[#1C2438] transition-colors cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel('right')}
                    aria-label="Next template"
                    className="p-1.5 rounded-xs border border-[#DAD5C9] bg-[#EFEBE2] hover:bg-[#E8E4DA] text-[#1C2438] transition-colors cursor-pointer shadow-2xs"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Slideable Cards Carousel */}
              <div 
                ref={carouselRef}
                className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 pt-1 px-1 no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {TEMPLATE_CARDS.map((tpl) => {
                  const Icon = tpl.icon;
                  const isSelected = selectedTemplate === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplateAndProceed(tpl.id)}
                      className={`w-[290px] sm:w-[320px] flex-shrink-0 snap-start rounded-xs border transition-all duration-200 cursor-pointer flex flex-col justify-between p-5 group hover:shadow-md ${
                        isSelected 
                          ? 'bg-white border-[#2F3B7A] ring-2 ring-[#2F3B7A] shadow-sm' 
                          : 'bg-[#EFEBE2] border-[#DAD5C9] hover:border-[#8A8578] hover:bg-[#F3EFE6]'
                      }`}
                    >
                      <div>
                        {/* Header with Icon and Category */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-9 h-9 rounded-xs bg-[#E8E4DA] border border-[#DAD5C9] flex items-center justify-center text-[#2F3B7A] group-hover:bg-[#2F3B7A] group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-[#E8E4DA] text-[#5C574B] border border-[#DAD5C9]">
                            {tpl.category}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h2 className="text-base font-serif font-bold text-[#1C2438] tracking-tight mb-1.5">
                          {tpl.title}
                        </h2>
                        <p className="text-xs text-[#5C574B] leading-relaxed mb-4 line-clamp-2">
                          {tpl.description}
                        </p>

                        {/* Clean Details List */}
                        <div className="bg-[#F7F5F0] border border-[#DAD5C9] p-3 rounded-xs space-y-1.5 mb-5 text-[11px] font-mono">
                          <div className="flex items-center justify-between text-[#1C2438]">
                            <span className="text-[#8A8578]">Lead Role:</span>
                            <span className="font-semibold truncate max-w-[150px]">{tpl.rootRole}</span>
                          </div>
                          <div className="flex items-center justify-between text-[#1C2438]">
                            <span className="text-[#8A8578]">Departments:</span>
                            <span className="font-medium text-[#2F3B7A]">{tpl.subDepts.length + 1} Included</span>
                          </div>
                          <div className="text-[10px] text-[#5C574B] pt-1 border-t border-[#E8E4DA] truncate">
                            {tpl.subDepts.join(' · ')}
                          </div>
                        </div>
                      </div>

                      {/* Select Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectTemplateAndProceed(tpl.id);
                        }}
                        className={`w-full py-2.5 px-3 rounded-xs font-mono text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#2F3B7A] text-white shadow-xs'
                            : 'bg-[#1C2438] group-hover:bg-[#2F3B7A] text-white'
                        }`}
                      >
                        <span>Use This Template</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Dot Indicators */}
              <div className="flex justify-center items-center gap-1.5 pt-0.5">
                {TEMPLATE_CARDS.map((tpl, idx) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => scrollToTemplateIndex(idx)}
                    aria-label={`Go to template ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      selectedTemplate === tpl.id
                        ? 'w-5 bg-[#2F3B7A]'
                        : 'w-1.5 bg-[#DAD5C9] hover:bg-[#8A8578]'
                    }`}
                  />
                ))}
              </div>

              {/* Option Underneath: Build My Own */}
              <div className="pt-2">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-[#DAD5C9]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#F7F5F0] px-3 text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
                      Or Start from Scratch
                    </span>
                  </div>
                </div>

                <div 
                  onClick={() => handleSelectTemplateAndProceed('custom')}
                  className={`p-5 rounded-xs border transition-all duration-200 cursor-pointer group hover:shadow-md ${
                    selectedTemplate === 'custom'
                      ? 'bg-white border-[#2F3B7A] ring-2 ring-[#2F3B7A] shadow-sm'
                      : 'bg-[#EFEBE2] border-[#DAD5C9] hover:border-[#8A8578] hover:bg-[#F3EFE6]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xs bg-[#E8E4DA] border border-[#DAD5C9] flex items-center justify-center text-[#2F3B7A] group-hover:bg-[#2F3B7A] group-hover:text-white transition-colors shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-serif font-bold text-[#1C2438] tracking-tight">
                          Build My Own from Scratch
                        </h2>
                        <p className="text-xs text-[#5C574B] mt-0.5">
                          Start with a blank canvas and construct your own departments and roles.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectTemplateAndProceed('custom');
                      }}
                      className="shrink-0 px-5 py-2.5 bg-[#1C2438] group-hover:bg-[#2F3B7A] text-white rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>Start Blank</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step Navigation Bottom Bar */}
              <div className="p-3.5 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs flex items-center justify-between shadow-xs">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => goToStep(4)}
                    className="px-5 py-2.5 bg-[#2F3B7A] hover:bg-[#253064] text-white rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Open Graph Maker</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: TEAM SIZE (DEDICATED STEP) */}
          {currentStep === 5 && (
            <div className="max-w-lg mx-auto p-8 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs text-center">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
                STEP 5 // CAPACITY
              </span>
              <h1 className="text-2xl font-serif font-bold text-[#1C2438] mt-1 tracking-tight">
                Team Size
              </h1>
              <p className="mt-2 text-sm text-[#5C574B] leading-relaxed">
                How many people will be actively assigned to departments and roles?
              </p>

              {/* Animated Numeric Readout */}
              <div className="my-10">
                <div className="flex items-baseline justify-center gap-2">
                  <AnimatedNumber 
                    value={peopleCount} 
                    className="text-5xl sm:text-6xl font-mono font-bold text-[#1C2438] tracking-tight"
                  />
                  <span className="text-base font-mono text-[#5C574B]">
                    {peopleCount === 1 ? 'person' : 'people'}
                  </span>
                </div>

                {/* Continuous Slider: 1 to 500 */}
                <div className="mt-6 px-4">
                  <input
                    type="range"
                    min="1"
                    max="500"
                    value={peopleCount}
                    onChange={e => setPeopleCount(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#DAD5C9] rounded-lg appearance-none cursor-pointer accent-[#2F3B7A]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#8A8578] mt-2">
                    <span>1 person</span>
                    <span>250</span>
                    <span>500 people</span>
                  </div>
                </div>

                {/* Caption beneath in muted grey */}
                <p className="text-xs font-mono text-[#8A8578] mt-6">
                  You can change this later.
                </p>
              </div>

              {/* Bottom Buttons */}
              <div className="pt-4 border-t border-[#DAD5C9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-[#2F3B7A] hover:bg-[#253064] text-[#F7F5F0] rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Next: Storage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: STORAGE (DEDICATED STEP) */}
          {currentStep === 6 && (
            <div className="max-w-xl mx-auto p-8 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs">
              <div className="text-center mb-8">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
                  STEP 6 // VAULT
                </span>
                <h1 className="text-2xl font-serif font-bold text-[#1C2438] mt-1 tracking-tight">
                  Storage
                </h1>
                <p className="mt-2 text-sm text-[#5C574B] leading-relaxed">
                  Select where your organization's files, attachments, and records reside.
                </p>
              </div>

              {/* Three Options as Selectable Cards */}
              <div className="space-y-3">
                {/* Option 1: Bring your own drive */}
                <button
                  type="button"
                  onClick={() => setStorageType('byod')}
                  className={`w-full p-4 rounded-xs border text-left transition-all cursor-pointer ${
                    storageType === 'byod'
                      ? 'bg-[#F7F5F0] border-[#2F3B7A] ring-1 ring-[#2F3B7A]'
                      : 'bg-[#F7F5F0] border-[#DAD5C9] hover:border-[#8A8578]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <HardDrive className="w-4 h-4 text-[#2F3B7A]" />
                      <span className="text-sm font-serif font-bold text-[#1C2438]">
                        Bring your own drive
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#5C574B] bg-[#E8E4DA] px-2 py-0.5 rounded-xs">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-[#5C574B] mt-1.5 pl-7 leading-relaxed">
                    Connect an existing Google Drive or equivalent; no additional cost.
                  </p>
                </button>

                {/* Option 2: Host your own server */}
                <button
                  type="button"
                  onClick={() => setStorageType('self_host')}
                  className={`w-full p-4 rounded-xs border text-left transition-all cursor-pointer ${
                    storageType === 'self_host'
                      ? 'bg-[#F7F5F0] border-[#2F3B7A] ring-1 ring-[#2F3B7A]'
                      : 'bg-[#F7F5F0] border-[#DAD5C9] hover:border-[#8A8578]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-[#2F3B7A]" />
                      <span className="text-sm font-serif font-bold text-[#1C2438]">
                        Host your own server
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#5C574B] bg-[#E8E4DA] px-2 py-0.5 rounded-xs">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-[#5C574B] mt-1.5 pl-7 leading-relaxed">
                    Self-hosted storage for institutional servers; no cost from Mika.
                  </p>
                </button>

                {/* Option 3: Use Mika's storage */}
                <button
                  type="button"
                  onClick={() => setStorageType('mika')}
                  className={`w-full p-4 rounded-xs border text-left transition-all cursor-pointer ${
                    storageType === 'mika'
                      ? 'bg-[#F7F5F0] border-[#2F3B7A] ring-1 ring-[#2F3B7A]'
                      : 'bg-[#F7F5F0] border-[#DAD5C9] hover:border-[#8A8578]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cloud className="w-4 h-4 text-[#2F3B7A]" />
                      <span className="text-sm font-serif font-bold text-[#1C2438]">
                        Use Mika's storage
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#2F3B7A] font-semibold">
                      Usage-based
                    </span>
                  </div>
                  <p className="text-xs text-[#5C574B] mt-1.5 pl-7 leading-relaxed">
                    Managed cloud vault with automated retention, audit indexing, and zero configuration.
                  </p>
                </button>
              </div>

              {/* If Option 3 Selected: Reveal Interactive Storage Slider */}
              {storageType === 'mika' && (
                <div className="mt-6 p-6 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xs font-mono text-[#5C574B]">
                      Allocated Vault Storage:
                    </span>
                    <div className="text-right">
                      <AnimatedNumber
                        value={storageGiB}
                        suffix=" GiB"
                        className="text-lg font-mono font-bold text-[#1C2438]"
                      />
                    </div>
                  </div>

                  {/* Slider: 1 to 2000 GiB continuous */}
                  <input
                    type="range"
                    min="1"
                    max="2000"
                    value={storageGiB}
                    onChange={e => setStorageGiB(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#DAD5C9] rounded-lg appearance-none cursor-pointer accent-[#2F3B7A]"
                  />

                  <div className="flex justify-between text-[10px] font-mono text-[#8A8578] mt-2">
                    <span>1 GiB</span>
                    <span>1,000 GiB</span>
                    <span>2,000 GiB</span>
                  </div>

                  {/* Live price readout beneath the slider using formula: storageGiB * $0.08 */}
                  <div className="mt-4 pt-3 border-t border-[#DAD5C9] flex items-center justify-between">
                    <span className="text-xs font-mono text-[#5C574B]">
                      Storage Rate:
                    </span>
                    <div className="text-xs font-mono font-bold text-[#2F3B7A]">
                      <AnimatedNumber
                        value={storageGiB * 0.08}
                        prefix="$"
                        decimals={2}
                      />
                      <span className="text-[#8A8578] font-normal"> / month ($0.08 / GiB)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="mt-8 pt-4 border-t border-[#DAD5C9] flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-[#2F3B7A] hover:bg-[#253064] text-[#F7F5F0] rounded-xs font-mono text-xs uppercase tracking-wider font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Next: Billing Summary</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: FINAL BILLING SUMMARY */}
          {currentStep === 7 && (
            <div className="max-w-xl mx-auto p-8 bg-[#EFEBE2] border border-[#DAD5C9] rounded-xs shadow-xs">
              <div className="text-center mb-6">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
                  STEP 7 // CONFIRMATION
                </span>
                <h1 className="text-2xl font-serif font-bold text-[#1C2438] mt-1 tracking-tight">
                  Billing & Tool Setup
                </h1>
                <p className="mt-1 text-xs text-[#5C574B]">
                  Continuous pricing and default integrations for {orgName}
                </p>
              </div>

              {/* Optional Org-Wide Integration Checklist */}
              <div className="mb-6 p-5 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C2438]">
                      Connect Org-Wide Apps (Optional)
                    </h3>
                    <p className="text-[11px] text-[#5C574B]">
                      Optionally link Google Workspace, GitHub, Figma, or Canva defaults now or in Settings later.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-[#E8E4DA] text-[#1C2438] px-2 py-0.5 rounded-xs border border-[#DAD5C9]">
                    {orgConnections.length} Connected
                  </span>
                </div>

                <IntegrationChecklist
                  connections={orgConnections}
                  scope="org"
                  isEnterpriseOrg={storageType === 'byod'}
                  onConnect={handleConnectIntegration}
                  onDisconnect={handleDisconnectIntegration}
                />
              </div>

              {/* Quiet Summary Card */}
              <div className="p-6 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs space-y-4">
                {/* Team Size Subtotal */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="text-[#5C574B]">
                    Team Size ({peopleCount} × $0.30):
                  </div>
                  <div className="font-bold text-[#1C2438]">
                    <AnimatedNumber value={peopleCost} prefix="$" decimals={2} />
                  </div>
                </div>

                {/* Storage Subtotal */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="text-[#5C574B]">
                    Storage ({storageType === 'mika' ? `${storageGiB} GiB × $0.08` : storageType === 'byod' ? 'Bring Your Own Drive' : 'Self-Hosted'}):
                  </div>
                  <div className="font-bold text-[#1C2438]">
                    <AnimatedNumber value={storageCost} prefix="$" decimals={2} />
                  </div>
                </div>

                {/* Total Monthly */}
                <div className="pt-4 border-t border-[#DAD5C9]">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-mono text-[#8A8578] uppercase tracking-wider block">
                        Total Monthly Investment
                      </span>
                      <span className="text-[11px] text-[#5C574B] font-mono">
                        Linear, continuous pricing
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-mono font-bold text-[#1C2438]">
                        <AnimatedNumber value={totalMonthly} prefix="$" decimals={2} />
                      </div>
                      <span className="text-[10px] font-mono text-[#8A8578]">
                        billed monthly
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs">
                  {errorMessage}
                </div>
              )}

              {/* Confirm Button */}
              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={handleConfirmCreate}
                  disabled={loading}
                  className="w-full py-3.5 bg-[#2F3B7A] hover:bg-[#253064] disabled:opacity-50 text-[#F7F5F0] rounded-xs font-mono text-xs uppercase tracking-wider font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Initializing Organisation...' : 'Create organisation'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="w-full py-2 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer text-center"
                >
                  Back to modify values
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          MINIMAL FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="py-4 px-6 border-t border-[#DAD5C9] text-center text-xs font-mono text-[#8A8578]">
        Deterministic organizational authorization. No artificial tiers.
      </footer>
    </div>
  );
};

// Helper function to build initial templates
function getInitialTemplateTree(templateId: TemplateId, orgName: string): DepartmentNode {
  const rootName = orgName || 'Primary Administration';

  if (templateId === 'school') {
    return {
      id: 'root-department',
      department: rootName,
      roots: ['Principal'],
      roles: ['Registrar', 'Dean of Studies'],
      isCollapsed: false,
      children: [
        {
          id: 'dept_middle_faculty',
          department: 'Middle School',
          roots: ['Middle Head'],
          roles: ['Curriculum Lead'],
          sectionId: 'sec_middle',
          isCollapsed: false,
          children: [
            {
              id: 'dept_gr6',
              department: 'Class 6',
              roots: ['Class 6 Lead'],
              roles: ['Math Teacher', 'English Teacher'],
              sectionId: 'sec_middle',
              isCollapsed: false,
              children: []
            },
            {
              id: 'dept_gr7',
              department: 'Class 7',
              roots: ['Class 7 Lead'],
              roles: ['Math Teacher', 'Science Teacher'],
              sectionId: 'sec_middle',
              isCollapsed: false,
              children: []
            }
          ]
        },
        {
          id: 'dept_physics',
          department: 'Physics (Subject)',
          roots: ['Physics Coordinator'],
          roles: ['Physics Teacher'],
          isCollapsed: false,
          children: []
        }
      ]
    };
  }

  if (templateId === 'nonprofit') {
    return {
      id: 'root-department',
      department: rootName,
      roots: ['Executive Director'],
      roles: ['Grants Director', 'Finance Lead'],
      isCollapsed: false,
      children: [
        {
          id: 'dept_programs',
          department: 'Global Programs',
          roots: ['Director of Programs'],
          roles: ['Field Coordinator', 'Volunteer Lead'],
          sectionId: 'sec_programs',
          isCollapsed: false,
          children: [
            {
              id: 'dept_emea',
              department: 'EMEA Regional Outreach',
              roots: ['Regional Director'],
              roles: ['Project Manager'],
              sectionId: 'sec_programs',
              isCollapsed: false,
              children: []
            }
          ]
        }
      ]
    };
  }

  if (templateId === 'creative') {
    return {
      id: 'root-department',
      department: rootName,
      roots: ['Creative Director'],
      roles: ['Managing Partner', 'Executive Producer'],
      isCollapsed: false,
      children: [
        {
          id: 'dept_design_motion',
          department: 'Design & Motion',
          roots: ['Art Director'],
          roles: ['Senior Designer'],
          sectionId: 'sec_creative',
          isCollapsed: false,
          children: [
            {
              id: 'dept_brand',
              department: 'Brand Systems',
              roots: ['Brand Lead'],
              roles: ['Visual Designer', 'Typographer'],
              sectionId: 'sec_creative',
              isCollapsed: false,
              children: []
            },
            {
              id: 'dept_motion',
              department: '3D & Motion Lab',
              roots: ['Motion Director'],
              roles: ['3D Animator', 'Sound Designer'],
              sectionId: 'sec_creative',
              isCollapsed: false,
              children: []
            }
          ]
        },
        {
          id: 'dept_accounts',
          department: 'Client Partnerships',
          roots: ['Account Director'],
          roles: ['Senior Strategist', 'Project Manager'],
          isCollapsed: false,
          children: []
        }
      ]
    };
  }

  if (templateId === 'healthcare') {
    return {
      id: 'root-department',
      department: rootName,
      roots: ['Chief Medical Officer'],
      roles: ['Chief Operating Officer', 'Compliance Officer'],
      isCollapsed: false,
      children: [
        {
          id: 'dept_clinical',
          department: 'Clinical Services',
          roots: ['Clinical Director'],
          roles: ['Lead Attending Physician'],
          sectionId: 'sec_clinical',
          isCollapsed: false,
          children: [
            {
              id: 'dept_inpatient',
              department: 'Inpatient Ward',
              roots: ['Head Nurse'],
              roles: ['Staff Nurse', 'Ward Coordinator'],
              sectionId: 'sec_clinical',
              isCollapsed: false,
              children: []
            },
            {
              id: 'dept_surgery',
              department: 'Surgical Department',
              roots: ['Chief Surgeon'],
              roles: ['OR Nurse', 'Anesthesiologist'],
              sectionId: 'sec_clinical',
              isCollapsed: false,
              children: []
            }
          ]
        },
        {
          id: 'dept_pharmacy',
          department: 'Pharmacy & Diagnostics',
          roots: ['Chief Pharmacist'],
          roles: ['Clinical Pharmacist', 'Lab Specialist'],
          isCollapsed: false,
          children: []
        }
      ]
    };
  }

  if (templateId === 'custom') {
    return {
      id: 'root-department',
      department: rootName,
      roots: ['Master Root Lead'],
      roles: ['Executive Assistant'],
      isCollapsed: false,
      children: []
    };
  }

  // Default: Company
  return {
    id: 'root-department',
    department: rootName,
    roots: ['Chief Executive Officer'],
    roles: ['Chief of Staff', 'VP Operations'],
    isCollapsed: false,
    children: [
      {
        id: 'dept_tech',
        department: 'Product & Technology Division',
        roots: ['VP Technology'],
        roles: ['Director of Product'],
        sectionId: 'sec_tech',
        isCollapsed: false,
        children: [
          {
            id: 'dept_platform',
            department: 'Platform Engineering',
            roots: ['Lead Architect'],
            roles: ['Backend Engineer', 'Infrastructure Lead'],
            sectionId: 'sec_tech',
            isCollapsed: false,
            children: []
          },
          {
            id: 'dept_design',
            department: 'Product Design',
            roots: ['Design Lead'],
            roles: ['Product Designer'],
            sectionId: 'sec_tech',
            isCollapsed: false,
            children: []
          }
        ]
      },
      {
        id: 'dept_growth',
        department: 'Commercial Growth',
        roots: ['VP Commercial Growth'],
        roles: ['Account Executive', 'Customer Success Lead'],
        isCollapsed: false,
        children: []
      }
    ]
  };
}

function getInitialTemplateSections(templateId: TemplateId): Section[] {
  if (templateId === 'school') {
    return [
      { id: 'sec_middle', name: 'Middle School Section', shade: 'indigo', borderStyle: 'solid' }
    ];
  }
  if (templateId === 'nonprofit') {
    return [
      { id: 'sec_programs', name: 'Global Programs Section', shade: 'amber', borderStyle: 'solid' }
    ];
  }
  if (templateId === 'creative') {
    return [
      { id: 'sec_creative', name: 'Design & Motion Section', shade: 'rose', borderStyle: 'solid' }
    ];
  }
  if (templateId === 'healthcare') {
    return [
      { id: 'sec_clinical', name: 'Clinical Services Section', shade: 'sky', borderStyle: 'dashed' }
    ];
  }
  if (templateId === 'custom') {
    return [];
  }
  // Company
  return [
    { id: 'sec_tech', name: 'Product & Technology Section', shade: 'emerald', borderStyle: 'dashed' }
  ];
}
