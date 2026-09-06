import React, { useState } from 'react';
import { 
  Building2, 
  School, 
  Building, 
  HeartHandshake, 
  Sparkles, 
  Crown, 
  Layers, 
  Folder, 
  Users, 
  HardDrive, 
  Copy, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Shield,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Wand2,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INTEGRATION_TOOLS } from '../lib/integrationService';
import { IntegrationConnection, Role, Department } from '../types';
import { OAuthConnectModal } from './OAuthConnectModal';
import { IntegrationChecklist } from './IntegrationChecklist';
import { IntegrationAccessConfigModal } from './IntegrationAccessConfigModal';

interface OnboardingWalkthroughProps {
  onComplete: () => void;
  onSelectTemplate: (templateType: 'school' | 'company' | 'nonprofit' | 'custom') => void;
}

export const OnboardingWalkthrough: React.FC<OnboardingWalkthroughProps> = ({
  onComplete,
  onSelectTemplate
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedTemplate, setSelectedTemplate] = useState<'school' | 'company' | 'nonprofit' | 'custom'>('school');
  
  // Pricing state (Part VII §4-6: linear-per-unit continuous model)
  const [peopleCount, setPeopleCount] = useState<number>(50);
  const [storageGiB, setStorageGiB] = useState<number>(250);
  const [bringOwnStorage, setBringOwnStorage] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // AI Prompt for Org Builder
  const [aiGenPrompt, setAiGenPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiCustomOrgName, setAiCustomOrgName] = useState('');

  // Org Creation Tools & Integrations State (Section 2.1)
  const [connectedTools, setConnectedTools] = useState<IntegrationConnection[]>([]);
  const [subStepWhoGetsAccess, setSubStepWhoGetsAccess] = useState(false);
  const [walkthroughNotice, setWalkthroughNotice] = useState<string | null>(null);

  const stepLabels = [
    'Landing',
    'Choose start',
    'Build the org',
    'Size and storage',
    'Connect tools',
    'Authority cascade',
    'Staff task feed'
  ];

  // Continuous linear calculation: people * $0.30 + storageGiB * $0.08 ($20 / 250 GiB)
  const peopleCost = peopleCount * 0.30;
  const storageCost = bringOwnStorage ? 0 : (storageGiB * (20 / 250));
  const totalMonthly = peopleCost + storageCost;

  // Mock roles and departments for 'Who gets to use these?' in walkthrough
  const demoRoles: Role[] = [
    { id: 'role_principal', orgId: 'org_demo', slug: 'principal', isRoot: true, title: 'Principal', deptId: 'dept_leadership', roleType: 'master_root' },
    { id: 'role_sec_head', orgId: 'org_demo', slug: 'sec_head', isRoot: false, isSectionRoot: true, title: 'Middle School Section Head', deptId: 'dept_middle_sec', roleType: 'section_root' },
    { id: 'role_c6_lead', orgId: 'org_demo', slug: 'c6_lead', isRoot: true, title: 'Class 6 Lead', deptId: 'dept_c6', roleType: 'dept_root' },
    { id: 'role_math_t', orgId: 'org_demo', slug: 'math_t', isRoot: false, title: 'Math Teacher', deptId: 'dept_c6', roleType: 'member' },
    { id: 'role_eng_t', orgId: 'org_demo', slug: 'eng_t', isRoot: false, title: 'English Teacher', deptId: 'dept_c6', roleType: 'member' },
    { id: 'role_sci_t', orgId: 'org_demo', slug: 'sci_t', isRoot: false, title: 'Science Teacher', deptId: 'dept_c7', roleType: 'member' },
  ];

  const demoDepts: Department[] = [
    { id: 'dept_leadership', orgId: 'org_demo', slug: 'leadership', type: 'department', name: 'Executive Leadership', createdAt: new Date().toISOString(), isTemporary: false },
    { id: 'dept_middle_sec', orgId: 'org_demo', slug: 'middle-sec', type: 'section', name: 'Middle School Section', createdAt: new Date().toISOString(), isTemporary: false },
    { id: 'dept_c6', orgId: 'org_demo', slug: 'c6', type: 'department', name: 'Class 6 Department', createdAt: new Date().toISOString(), isTemporary: false },
    { id: 'dept_c7', orgId: 'org_demo', slug: 'c7', type: 'department', name: 'Class 7 Department', createdAt: new Date().toISOString(), isTemporary: false },
  ];

  const handleNext = () => {
    // Check if at Connect Tools step (Step 4)
    if (currentStep === 4 && !subStepWhoGetsAccess) {
      if (connectedTools.length > 0) {
        // At least one tool connected: show 'Who gets to use these?'
        setSubStepWhoGetsAccess(true);
        return;
      } else {
        // Nothing checked: non-blocking subtle notice
        setWalkthroughNotice("You haven't connected any tools yet. You can add them anytime from Settings.");
        setCurrentStep(5);
        return;
      }
    }

    if (currentStep === 4 && subStepWhoGetsAccess) {
      setSubStepWhoGetsAccess(false);
      setCurrentStep(5);
      return;
    }

    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep === 4 && subStepWhoGetsAccess) {
      setSubStepWhoGetsAccess(false);
      return;
    }
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConnectInWalkthrough = (toolKey: string, accountLabel: string) => {
    const newConn: IntegrationConnection = {
      id: `conn-walkthrough-${toolKey}`,
      integrationKey: toolKey,
      orgId: 'org_demo',
      scope: 'org',
      accessRoleIds: 'all',
      connectedByUserId: 'user_creator',
      accountLabel,
      connectedAt: new Date().toISOString()
    };
    setConnectedTools(prev => [...prev.filter(c => c.integrationKey !== toolKey), newConn]);
  };

  const handleDisconnectInWalkthrough = (connId: string) => {
    setConnectedTools(prev => prev.filter(c => c.id !== connId));
  };

  const handleCopyDemoLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?join=join_c7_math_98234`);
    setCopiedLink(true);
    confetti({ particleCount: 25, spread: 40 });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerateCustomOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiGenPrompt.trim()) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-org-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgDescription: aiGenPrompt, domainType: selectedTemplate })
      });
      const data = await res.json();
      setAiCustomOrgName(data.name || 'Synthesized Org');
      confetti({ particleCount: 30, spread: 50 });
    } catch {
      setAiCustomOrgName('Custom Generated Workspace');
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-stone-300 rounded-2xl shadow-xl overflow-hidden my-4">
      {/* Progress Dots Bar */}
      <div className="flex gap-1.5 p-4 pt-5 px-6">
        {[0, 1, 2, 3, 4, 5, 6].map(idx => (
          <div
            key={idx}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              idx <= currentStep ? 'bg-[#2F3B7A]' : 'bg-stone-200'
            }`}
          />
        ))}
      </div>

      <p className="text-[11px] font-mono-code text-stone-500 px-6 uppercase tracking-wider">
        {currentStep + 1} / 7 · {stepLabels[currentStep]}
      </p>

      <div className="p-6">
        {/* STEP 0: Landing (Log In / Create an organisation) */}
        {currentStep === 0 && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 text-[#2F3B7A] shadow-xs">
              <Layers className="w-7 h-7 text-[#2F3B7A]" />
            </div>
            <h2 className="text-3xl font-bold text-[#1C2438] mb-2 font-serif-heading">
              Mika
            </h2>
            <p className="text-sm text-stone-600 mb-8 max-w-sm mx-auto leading-relaxed">
              Tasks, chat and files, organised the way your team actually works. Layered relationship graphs with deterministic authority.
            </p>

            <div className="space-y-3 max-w-xs mx-auto">
              <button
                onClick={handleNext}
                className="w-full h-11 bg-[#2F3B7A] hover:bg-[#232c5c] text-white font-medium rounded-lg text-sm shadow-sm transition-all cursor-pointer"
              >
                Create an organisation
              </button>
              <button
                onClick={onComplete}
                className="w-full h-11 bg-stone-100 hover:bg-stone-200 text-stone-800 font-medium rounded-lg text-sm border border-stone-200 transition-all cursor-pointer"
              >
                Log in with Google
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Template Selection (School, Company, Nonprofit, Build my own) */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-bold text-[#1C2438] mb-1 font-serif-heading">
              Start your organisation
            </h2>
            <p className="text-xs text-stone-600 mb-5">
              Pick a domain starting point. Templates pre-populate a department/section/role skeleton which remains fully editable.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                onClick={() => { setSelectedTemplate('school'); onSelectTemplate('school'); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedTemplate === 'school'
                    ? 'border-[#2F3B7A] bg-indigo-50/40 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-[#FAF9F6]'
                }`}
              >
                <School className="w-6 h-6 text-[#2F3B7A] mb-2" />
                <h4 className="text-sm font-semibold text-stone-900">School</h4>
                <p className="text-[11px] text-stone-500 mt-1">Sections, grade levels & subject departments</p>
              </div>

              <div
                onClick={() => { setSelectedTemplate('company'); onSelectTemplate('company'); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedTemplate === 'company'
                    ? 'border-[#2F3B7A] bg-indigo-50/40 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-[#FAF9F6]'
                }`}
              >
                <Building className="w-6 h-6 text-[#2F3B7A] mb-2" />
                <h4 className="text-sm font-semibold text-stone-900">Company</h4>
                <p className="text-[11px] text-stone-500 mt-1">Cross-functional squads, leads & platform matrix</p>
              </div>

              <div
                onClick={() => { setSelectedTemplate('nonprofit'); onSelectTemplate('nonprofit'); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedTemplate === 'nonprofit'
                    ? 'border-[#2F3B7A] bg-indigo-50/40 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-[#FAF9F6]'
                }`}
              >
                <HeartHandshake className="w-6 h-6 text-[#2F3B7A] mb-2" />
                <h4 className="text-sm font-semibold text-stone-900">Nonprofit</h4>
                <p className="text-[11px] text-stone-500 mt-1">Programs, chapters & field volunteer teams</p>
              </div>

              <div
                onClick={() => { setSelectedTemplate('custom'); onSelectTemplate('custom'); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedTemplate === 'custom'
                    ? 'border-[#2F3B7A] bg-indigo-50/40 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 bg-[#FAF9F6]'
                }`}
              >
                <Sparkles className="w-6 h-6 text-[#7C3AED] mb-2" />
                <h4 className="text-sm font-semibold text-stone-900">Build my own</h4>
                <p className="text-[11px] text-stone-500 mt-1">AI-assisted or blank canvas from scratch</p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Org Builder Canvas (Part VII §3) */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-bold text-[#1C2438] mb-1 font-serif-heading">
              Build your org
            </h2>
            <p className="text-xs text-stone-600 mb-3">
              Drag departments, sections and roles onto the canvas, or let Gemini structure it.
            </p>

            {/* AI Generator Box */}
            <form onSubmit={handleGenerateCustomOrg} className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Describe your organization (e.g., 'Hospital with ICU and triage nurse leads')..."
                value={aiGenPrompt}
                onChange={e => setAiGenPrompt(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
              />
              <button
                type="submit"
                disabled={isAiGenerating || !aiGenPrompt.trim()}
                className="px-3 py-1.5 bg-[#7C3AED] hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1 shadow-xs"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {isAiGenerating ? 'Structuring...' : 'AI Generate'}
              </button>
            </form>

            {aiCustomOrgName && (
              <div className="mb-3 p-2 bg-purple-50 text-purple-900 text-xs rounded-lg border border-purple-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                <span>Generated structure for <strong>{aiCustomOrgName}</strong>!</span>
              </div>
            )}

            {/* Canvas Demo Preview */}
            <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-4 text-xs font-mono-code space-y-2">
              <div className="flex items-center gap-2 text-stone-900 font-bold">
                <Crown className="w-4 h-4 text-[#2F3B7A]" />
                <span>School</span>
                <span className="text-stone-400 font-normal font-sans text-[11px]">root: Principal</span>
              </div>

              <div className="ml-4 pl-3 border-l-2 border-indigo-200 space-y-2">
                <div className="flex items-center gap-2 text-[#2F3B7A] font-semibold">
                  <Layers className="w-4 h-4 text-[#2F3B7A]" />
                  <span>Middle School</span>
                  <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[10px]">section</span>
                </div>

                <div className="ml-4 pl-3 border-l border-stone-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-stone-700">
                    <Folder className="w-3.5 h-3.5 text-stone-400" />
                    <span>Class 6</span>
                  </div>
                  <div className="flex gap-1.5 ml-5">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#2F3B7A] border border-indigo-200 text-[10px]">
                      math-teacher
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#2F3B7A] border border-indigo-200 text-[10px]">
                      english-teacher
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-stone-700 pt-1">
                    <Folder className="w-3.5 h-3.5 text-stone-400" />
                    <span>Class 7</span>
                  </div>
                  <div className="flex gap-1.5 ml-5">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#2F3B7A] border border-indigo-200 text-[10px]">
                      math-teacher
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-500 mt-2 italic">
              * Section root reaches subordinate roles directly — Class 6's own root keeps its authority intact (Part I §6).
            </p>
          </div>
        )}

        {/* STEP 3: Sizing & Storage Pricing (Part VII §4-6) */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-bold text-[#1C2438] mb-1 font-serif-heading">
              Priced per unit, not per block
            </h2>
            <p className="text-xs text-stone-600 mb-5">
              Continuous smooth sliders: $0.30 per person, $0.08 per GiB ($20/250 GiB). The total never jumps abruptly at tier boundaries.
            </p>

            {/* People Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-1">
                <span>Team Headcount</span>
                <span className="font-mono-code text-[#2F3B7A] text-sm">{peopleCount} people</span>
              </div>
              <input
                type="range"
                min="1"
                max="1000"
                value={peopleCount}
                onChange={e => setPeopleCount(Number(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#2F3B7A]"
              />
              <p className="text-[11px] text-stone-500 mt-1 font-mono-code">
                {peopleCount} × $0.30 = ${peopleCost.toFixed(2)}/mo
              </p>
            </div>

            {/* Storage Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 mb-1">
                <span>Cloud Storage Capacity</span>
                <span className="font-mono-code text-[#2F3B7A] text-sm">
                  {bringOwnStorage ? 'Bring Your Own (Free)' : `${storageGiB} GiB`}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="2000"
                step="10"
                disabled={bringOwnStorage}
                value={storageGiB}
                onChange={e => setStorageGiB(Number(e.target.value))}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#2F3B7A] disabled:opacity-40"
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-stone-500 font-mono-code">
                  {bringOwnStorage ? '$0.00 (Google Drive Connected)' : `${storageGiB} GiB × $0.08 = $${storageCost.toFixed(2)}/mo`}
                </p>
                <label className="text-[11px] text-stone-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bringOwnStorage}
                    onChange={e => setBringOwnStorage(e.target.checked)}
                  />
                  <span>Bring own storage (Free)</span>
                </label>
              </div>
            </div>

            {/* Total Display */}
            <div className="border-t border-stone-200 pt-4 flex items-baseline justify-between bg-[#F7F5F0] p-4 rounded-xl border">
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">Total Monthly Cost</span>
                <span className="text-[11px] text-stone-500 font-mono-code">
                  (${peopleCost.toFixed(2)} + ${storageCost.toFixed(2)})
                </span>
              </div>
              <div className="text-right">
                <span className="text-3xl font-extrabold text-[#2F3B7A] font-mono-code">
                  ${totalMonthly.toFixed(2)}
                </span>
                <span className="text-xs text-stone-500 font-medium"> / month</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Connect Tools & Integrations (Section 2.1) */}
        {currentStep === 4 && !subStepWhoGetsAccess && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[#1C2438] mb-1 font-serif-heading">
                Connect Tools & Integrations
              </h2>
              <p className="text-xs text-stone-600">
                Connect Google Workspace, GitHub, Figma, and Canva org-wide. Connecting is optional — you can skip or add tools anytime later from Settings.
              </p>
            </div>

            <IntegrationChecklist
              connections={connectedTools}
              scope="org"
              isEnterpriseOrg={bringOwnStorage}
              onConnect={handleConnectInWalkthrough}
              onDisconnect={handleDisconnectInWalkthrough}
            />

            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-500 flex items-center gap-2">
              <Info className="w-4 h-4 text-stone-400 shrink-0" />
              <span>
                Connected tools will be configured org-wide. In the next step, you can choose whether all roles or specific roles get access.
              </span>
            </div>
          </div>
        )}

        {/* STEP 4 SUB-STEP: Who gets to use these? (Section 2.1 / 2.2) */}
        {currentStep === 4 && subStepWhoGetsAccess && (
          <div>
            <IntegrationAccessConfigModal
              connections={connectedTools}
              roles={demoRoles}
              departments={demoDepts}
              isInline={true}
              onSave={(updated) => {
                setConnectedTools(updated);
              }}
              onContinue={() => {
                setSubStepWhoGetsAccess(false);
                setCurrentStep(5);
              }}
            />
          </div>
        )}

        {/* STEP 5: Root Admin View & Invites (Part VII §8) */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-xl font-bold text-[#1C2438] mb-1 font-serif-heading">
              Your people & authority cascade
            </h2>
            <p className="text-xs text-stone-600 mb-3">
              Invite links cascade strictly along the authority chain. Master roots can issue for anyone; sub-roots issue only for roles beneath them.
            </p>

            {walkthroughNotice && (
              <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{walkthroughNotice}</span>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAF9F6] border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-[#7C3AED] font-bold text-xs flex items-center justify-center">
                    MH
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900">Middle Head</h4>
                    <span className="text-[10px] text-[#7C3AED] font-mono-code font-semibold">section root</span>
                  </div>
                </div>
                <span className="text-xs text-stone-500">2 active tasks</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#FAF9F6] border border-stone-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 font-bold text-xs flex items-center justify-center">
                    AK
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900">Amara K.</h4>
                    <span className="text-[10px] text-stone-500 font-mono-code">math-teacher @ Class 6</span>
                  </div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]"></span>
              </div>
            </div>

            {/* Scoped Invite Link Card */}
            <div className="bg-[#EEF2FF] border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[#2F3B7A] font-mono-code">
                  math-teacher · Class 7
                </span>
                <span className="text-[10px] text-indigo-700 font-medium">Expires in 4 days</span>
              </div>
              <p className="text-[11px] text-stone-600 mb-3">
                Multi-use link for all incoming math teachers. Accounts bind automatically upon Google Sign-In.
              </p>
              <button
                onClick={handleCopyDemoLink}
                className="w-full py-2 bg-white hover:bg-stone-50 text-[#2F3B7A] border border-indigo-300 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'Invite Link Copied!' : 'Copy Invite Link'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Staff Task Feed (Part IV §6) */}
        {currentStep === 6 && (
          <div>
            <h2 className="text-xl font-bold text-[#1C2438] mb-1 font-serif-heading">
              Your tasks (Employee Feed)
            </h2>
            <p className="text-xs text-stone-600 mb-4">
              math-teacher · Class 6 (Single surface view of deliverables)
            </p>

            <div className="space-y-2">
              <div className="bg-white border-l-4 border-l-[#DC2626] border border-stone-200 rounded-lg p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-stone-900">Term 2 Exam Math Questions</h4>
                  <span className="text-[10px] text-red-600 font-semibold font-mono-code">DUE TOMORROW</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">Delegated by Section Head · Middle School</p>
              </div>

              <div className="bg-white border-l-4 border-l-[#16A34A] border border-stone-200 rounded-lg p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-stone-900">Update lesson plan template</h4>
                  <span className="text-[10px] text-emerald-600 font-medium">Submitted & Reviewed</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">File archived in Class 6 File Vault</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#F7F5F0] border-t border-stone-200">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <button
          onClick={handleNext}
          className="px-6 py-2 bg-[#2F3B7A] hover:bg-[#232c5c] text-white text-xs font-semibold rounded-lg shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
        >
          {currentStep === 6 ? (
            <>
              Launch Workspace <CheckCircle2 className="w-4 h-4" />
            </>
          ) : currentStep === 4 && !subStepWhoGetsAccess ? (
            <>
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Next <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
