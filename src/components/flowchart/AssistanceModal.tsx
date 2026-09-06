import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, PhoneCall, Send, X, Phone, RefreshCw, Sparkles, CheckCircle2, User, ChevronRight } from 'lucide-react';
import { DepartmentNode, Section } from './flowchartTypes';
import { createInitialTree } from './treeUtils';

interface AssistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyStructure?: (tree: DepartmentNode, sections: Section[]) => void;
}

interface ChatMessage {
  id: string;
  sender: 'helper' | 'user';
  text: string;
  time: string;
  suggestedAction?: {
    label: string;
    actionType: 'school' | 'company' | 'agency' | 'section' | 'custom';
    description: string;
    customTree?: DepartmentNode;
    customSections?: Section[];
  };
}

export const AssistanceModal: React.FC<AssistanceModalProps> = ({
  isOpen,
  onClose,
  onApplyStructure,
}) => {
  // User name state
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('mika_user_name') || '';
    } catch {
      return '';
    }
  });
  const [nameInput, setNameInput] = useState('');
  const [hasStartedChat, setHasStartedChat] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('mika_user_name'));
    } catch {
      return false;
    }
  });

  // Call toggle inside chat
  const [showCallOption, setShowCallOption] = useState(false);
  const [callbackNumber, setCallbackNumber] = useState('');
  const [callbackRequested, setCallbackRequested] = useState(false);

  // Chat message state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Format current time
  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Initialize or reset chat when user name is confirmed
  useEffect(() => {
    if (hasStartedChat && userName && messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'helper',
          text: `Hello ${userName}! I am your dedicated organizational specialist. My job is to construct your complete organization flowchart for free on the spot so you don't have to draft it by hand.`,
          time: getTimeString(),
        },
        {
          id: 'welcome-2',
          sender: 'helper',
          text: `Tell me what kind of organization you are building (for example: a tech company, an educational school, a creative agency, or a custom team). What departments or roles do you need?`,
          time: getTimeString(),
        },
      ]);
    }
  }, [hasStartedChat, userName, messages.length]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  if (!isOpen) return null;

  // Handle entering name and launching chat
  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem('mika_user_name', trimmed);
    } catch {
      // ignore
    }
    setUserName(trimmed);
    setHasStartedChat(true);
  };

  // Handle sending a user chat message
  const handleSendMessage = async (messageText: string = inputText) => {
    const textToSend = messageText.trim();
    if (!textToSend) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: getTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    let aiHandled = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch('/api/assistance/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToSend, userName }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) {
          aiHandled = true;
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `helper-${Date.now()}`,
              sender: 'helper',
              text: data.reply,
              time: getTimeString(),
              suggestedAction: data.tree ? {
                label: `Apply ${data.tree.department || 'Custom'} Hierarchy to Canvas`,
                actionType: 'custom',
                description: `Applies customized hierarchy generated for you.`,
                customTree: data.tree,
                customSections: data.sections || [],
              } : undefined,
            },
          ]);
        }
      }
    } catch {
      // Graceful fallback to smart instant specialist responses below
    }

    if (!aiHandled) {
      // Smart instant specialist fallback
      setTimeout(() => {
        setIsTyping(false);
        const lower = textToSend.toLowerCase();
        let reply = '';
        let suggestedAction: ChatMessage['suggestedAction'] = undefined;

        if (lower.includes('school') || lower.includes('education') || lower.includes('grade') || lower.includes('teacher') || lower.includes('student')) {
          reply = `I have drafted an institutional School structure for you: A Principal at the main root, Middle School and High School branches, with Class 7 and Class 8 departments, plus a cross-cutting Science & STEM Section that directly directs the science roles across classes. Would you like me to build this on your canvas?`;
          suggestedAction = {
            label: 'Apply School Hierarchy to Canvas',
            actionType: 'school',
            description: 'Generates Principal root, Middle/High School departments, and a STEM Section grouping.',
          };
        } else if (lower.includes('company') || lower.includes('business') || lower.includes('tech') || lower.includes('startup') || lower.includes('engineering') || lower.includes('sales')) {
          reply = `I have structured a modern corporate hierarchy for you: Executive Leadership (CEO & Managing Director), subdivided into Engineering & Technology, Product & Design, and Operations & Sales with dedicated leadership roots and specialized role tags. Click below to load it into your canvas:`;
          suggestedAction = {
            label: 'Apply Company Hierarchy to Canvas',
            actionType: 'company',
            description: 'Builds full C-Suite, Engineering, Product, and Sales departments with pre-configured roles.',
          };
        } else if (lower.includes('agency') || lower.includes('creative') || lower.includes('marketing') || lower.includes('client')) {
          reply = `I have prepared a Creative Agency structure: Managing Partner as top root, branching into Client Services, Creative Direction, and Media Strategy with active account managers and designers. Would you like me to apply this structure now?`;
          suggestedAction = {
            label: 'Apply Agency Hierarchy to Canvas',
            actionType: 'agency',
            description: 'Creates Managing Partner, Client Services, Design Studio, and Media departments.',
          };
        } else if (lower.includes('section') || lower.includes('group')) {
          reply = `Under the Mika specification, a Section is a horizontal grouping of subordinate departments where the Section Root directly directs roles inside grouped departments without overriding those departments' own internal roots. You can select any departments using the [SELECT] button on their cards and group them together, or I can create an example section for you right now.`;
          suggestedAction = {
            label: 'Create Sample Section Grouping',
            actionType: 'section',
            description: 'Selects and groups multiple branches under a unified section with drafting border styling.',
          };
        } else if (lower.includes('call') || lower.includes('phone') || lower.includes('speak') || lower.includes('voice')) {
          reply = `Certainly! You can speak directly with an employee over the phone right now. You can dial our toll-free line +1 (800) 555-0199 or enter your number using the Call Staff button at the top to receive an immediate callback.`;
          setShowCallOption(true);
        } else {
          reply = `Got it, ${userName}! I am assembling your hierarchy with those specifications. You can also click below to load one of our verified structural foundations and customize any department, root, or role tags as we speak.`;
          suggestedAction = {
            label: 'Build Enterprise Hierarchy on Canvas',
            actionType: 'company',
            description: 'Loads a clean multi-tier foundation that you and I can customize.',
          };
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `helper-${Date.now()}`,
            sender: 'helper',
            text: reply,
            time: getTimeString(),
            suggestedAction,
          },
        ]);
      }, 700);
    }
  };

  // Build predefined trees based on helper action
  const handleApplyAction = (
    action: NonNullable<ChatMessage['suggestedAction']> | 'school' | 'company' | 'agency' | 'section' | 'custom'
  ) => {
    if (!onApplyStructure) return;

    if (typeof action === 'object') {
      if (action.actionType === 'custom' && action.customTree) {
        const treeToApply = action.customTree;
        const sectionsToApply = action.customSections || [];
        onApplyStructure(treeToApply, sectionsToApply);
        setMessages((prev) => [
          ...prev,
          {
            id: `applied-${Date.now()}`,
            sender: 'helper',
            text: `Generated custom structure for "${treeToApply.department || 'organization'}" on your canvas!`,
            time: getTimeString(),
          },
        ]);
        return;
      }
      action = action.actionType;
    }
    const actionType = action;
    if (actionType === 'school') {
      const schoolTree: DepartmentNode = {
        id: 'root-department',
        department: 'Grandview Academy',
        roots: ['Principal'],
        roles: ['Administrative Dean'],
        isCollapsed: false,
        children: [
          {
            id: 'dept_middle_school',
            department: 'Middle School',
            roots: ['Headmaster'],
            roles: ['Guidance Counselor', 'Curriculum Director'],
            isCollapsed: false,
            children: [
              {
                id: 'dept_class_7',
                department: 'Class 7',
                roots: ['Class 7 Supervisor'],
                roles: ['Math Teacher', 'Science Teacher', 'English Teacher'],
                sectionId: 'sec_stem',
                isCollapsed: false,
                children: [],
              },
              {
                id: 'dept_class_8',
                department: 'Class 8',
                roots: ['Class 8 Supervisor'],
                roles: ['Physics Teacher', 'Biology Teacher', 'History Teacher'],
                sectionId: 'sec_stem',
                isCollapsed: false,
                children: [],
              },
            ],
          },
          {
            id: 'dept_high_school',
            department: 'High School',
            roots: ['High School Director'],
            roles: ['Senior Academic Advisor', 'Athletics Director'],
            isCollapsed: false,
            children: [
              {
                id: 'dept_grade_11',
                department: 'Grade 11 Honors',
                roots: ['Grade Lead'],
                roles: ['Chemistry Specialist', 'Literature Instructor'],
                isCollapsed: false,
                children: [],
              },
            ],
          },
        ],
      };

      const schoolSections: Section[] = [
        {
          id: 'sec_stem',
          name: 'Science & STEM Grouping',
          shade: 'slate',
          borderStyle: 'dashed',
        },
      ];

      onApplyStructure(schoolTree, schoolSections);
      setMessages((prev) => [
        ...prev,
        {
          id: `applied-${Date.now()}`,
          sender: 'helper',
          text: `I have applied the School structure to your canvas! The main root is set to Grandview Academy, with Middle School, High School, and a Science & STEM section grouping active. Take a look at your canvas!`,
          time: getTimeString(),
        },
      ]);
    } else if (actionType === 'company') {
      const companyTree: DepartmentNode = {
        id: 'root-department',
        department: 'Apex Global Enterprises',
        roots: ['Chief Executive Officer', 'Managing Director'],
        roles: ['Chief of Staff'],
        isCollapsed: false,
        children: [
          {
            id: 'dept_eng',
            department: 'Engineering & Technology',
            roots: ['VP of Engineering'],
            roles: ['Principal Architect', 'Staff Software Engineer', 'DevOps Specialist'],
            isCollapsed: false,
            children: [
              {
                id: 'dept_platform',
                department: 'Platform Core',
                roots: ['Tech Lead'],
                roles: ['Backend Engineer', 'Database Specialist'],
                sectionId: 'sec_product_squad',
                isCollapsed: false,
                children: [],
              },
            ],
          },
          {
            id: 'dept_product',
            department: 'Product & Design',
            roots: ['Head of Product'],
            roles: ['Senior Product Manager', 'Product Designer', 'Design Researcher'],
            sectionId: 'sec_product_squad',
            isCollapsed: false,
            children: [],
          },
          {
            id: 'dept_ops',
            department: 'Operations & Growth',
            roots: ['Chief Operating Officer'],
            roles: ['Finance Lead', 'Growth Marketing Specialist', 'People Operations'],
            isCollapsed: false,
            children: [],
          },
        ],
      };

      const companySections: Section[] = [
        {
          id: 'sec_product_squad',
          name: 'Cross-Functional Product Squad',
          shade: 'charcoal',
          borderStyle: 'solid',
        },
      ];

      onApplyStructure(companyTree, companySections);
      setMessages((prev) => [
        ...prev,
        {
          id: `applied-${Date.now()}`,
          sender: 'helper',
          text: `Apex Global Enterprises structure has been built on your canvas! It features C-Suite roots, Engineering, Product & Design, and an active Cross-Functional Section.`,
          time: getTimeString(),
        },
      ]);
    } else if (actionType === 'agency') {
      const agencyTree: DepartmentNode = {
        id: 'root-department',
        department: 'Vanguard Creative Studio',
        roots: ['Managing Partner'],
        roles: ['Executive Producer'],
        isCollapsed: false,
        children: [
          {
            id: 'dept_accounts',
            department: 'Client Services',
            roots: ['Accounts Director'],
            roles: ['Senior Account Lead', 'Project Manager'],
            isCollapsed: false,
            children: [],
          },
          {
            id: 'dept_creative',
            department: 'Creative & Art Direction',
            roots: ['Creative Director'],
            roles: ['Senior Art Director', 'Lead Copywriter', 'Motion Designer'],
            isCollapsed: false,
            children: [],
          },
          {
            id: 'dept_media',
            department: 'Media & Digital Strategy',
            roots: ['Strategy Director'],
            roles: ['Media Planner', 'Data & Analytics Lead'],
            isCollapsed: false,
            children: [],
          },
        ],
      };

      onApplyStructure(agencyTree, []);
      setMessages((prev) => [
        ...prev,
        {
          id: `applied-${Date.now()}`,
          sender: 'helper',
          text: `Vanguard Creative Studio hierarchy has been generated on your canvas with Client Services, Creative, and Media departments!`,
          time: getTimeString(),
        },
      ]);
    }
  };

  return (
    <div
      id="assistance-overlay"
      className="fixed inset-0 bg-neutral-950/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 z-50 font-mono select-none"
      onClick={onClose}
    >
      <div
        id="assistance-dialog"
        className="w-full max-w-xl bg-white border-2 border-neutral-900 rounded-sm shadow-[8px_8px_0px_#18181b] text-neutral-900 flex flex-col overflow-hidden max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* If user hasn't confirmed name yet, show brief explanation popup with name input */}
        {!hasStartedChat ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 text-white rounded-xs flex items-center justify-center shadow-[2px_2px_0px_#064e3b]">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg text-neutral-900 tracking-tight">
                      ASSISTANCE SERVICE
                    </h2>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-300 rounded-xs">
                      100% Free
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 font-sans">
                    Live organization building on the spot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-900 p-1 rounded-xs transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Brief Explanation */}
            <div className="bg-[#f2f7f4] border border-emerald-300/80 p-4 rounded-xs space-y-2 text-neutral-800">
              <span className="font-bold text-xs uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-700" />
                What This Option Does:
              </span>
              <p className="text-xs font-sans leading-relaxed text-neutral-700">
                You do not have to build your flowchart from scratch. By clicking Assistance, you connect directly with an employee or helper. Simply tell them what structure you want, and they will assemble and organize your departments, roots, section groupings, and roles for free on the spot.
              </p>
            </div>

            {/* Name Input Form */}
            <form onSubmit={handleStartChat} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wide flex items-center gap-1.5">
                  <User size={13} className="text-neutral-600" />
                  Add Your Name:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name (e.g. Jordan Smith)"
                  className="w-full bg-white border-2 border-neutral-300 focus:border-neutral-900 px-3 py-2.5 text-sm rounded-xs text-neutral-900 focus:outline-none transition-colors shadow-inner"
                />
                <p className="text-[11px] text-neutral-500 font-sans">
                  The helper will greet you by name and format your chart in real time.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!nameInput.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 text-white rounded-xs text-xs font-bold transition-all shadow-[2px_2px_0px_#064e3b] flex items-center gap-2 cursor-pointer"
                >
                  <span>Connect to Chat</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Live Chat UI with Employee Helper */
          <div className="flex flex-col h-[80vh]">
            {/* Chat Top Bar */}
            <div className="bg-[#1C2438] text-white px-4 py-3 border-b-2 border-neutral-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    MS
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#1C2438] rounded-full animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs tracking-tight text-white">
                      Mika Support Specialist
                    </span>
                    <span className="text-[9px] bg-emerald-800 text-emerald-200 font-semibold px-1.5 py-0.2 rounded-xs">
                      Live on duty
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-300 font-sans flex items-center gap-1.5">
                    <span>Chatting with <strong>{userName}</strong></span>
                    <button
                      type="button"
                      onClick={() => setHasStartedChat(false)}
                      className="text-emerald-300 hover:underline text-[10px]"
                      title="Change Name"
                    >
                      (Change)
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice Call toggle */}
                <button
                  type="button"
                  onClick={() => setShowCallOption(!showCallOption)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-xs transition-colors ${
                    showCallOption
                      ? 'bg-emerald-500 text-white'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-emerald-300 border border-emerald-500/40'
                  }`}
                  title="Phone Call Assistance"
                >
                  <PhoneCall size={12} />
                  <span>Call Staff</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-neutral-400 hover:text-white p-1 rounded-xs transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Optional Call Assistance banner dropdown */}
            {showCallOption && (
              <div className="bg-[#f0fdf4] border-b border-emerald-300 p-3 text-xs space-y-2 text-neutral-900 animate-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-700" />
                    Direct Phone Line & Instant Callback:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCallOption(false)}
                    className="text-neutral-400 hover:text-neutral-800"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between bg-white border border-emerald-300 p-2 rounded-xs">
                  <span className="text-xs font-bold text-neutral-800">
                    Toll-Free Helpline: +1 (800) 555-0199
                  </span>
                  <a
                    href="tel:+18005550199"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 text-[10px] font-bold rounded-xs flex items-center gap-1 transition-colors"
                  >
                    <PhoneCall size={10} />
                    Dial Now
                  </a>
                </div>

                {!callbackRequested ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (callbackNumber.trim()) setCallbackRequested(true);
                    }}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="tel"
                      required
                      placeholder="Or enter your phone number for callback..."
                      value={callbackNumber}
                      onChange={(e) => setCallbackNumber(e.target.value)}
                      className="flex-1 bg-white border border-neutral-300 px-2 py-1 text-xs rounded-xs focus:outline-none focus:border-neutral-900"
                    />
                    <button
                      type="submit"
                      disabled={!callbackNumber.trim()}
                      className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white px-3 py-1 text-xs font-bold rounded-xs"
                    >
                      Request Call
                    </button>
                  </form>
                ) : (
                  <div className="bg-emerald-100 border border-emerald-400 p-1.5 text-center rounded-xs text-[11px] font-semibold text-emerald-950">
                    Callback requested for {callbackNumber}. An employee is calling you now.
                  </div>
                )}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#faf9f5]">
              {messages.map((msg) => {
                const isHelper = msg.sender === 'helper';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isHelper ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-neutral-400 font-sans">
                      <span className="font-semibold text-neutral-600">
                        {isHelper ? 'Specialist Helper' : userName}
                      </span>
                      <span>•</span>
                      <span>{msg.time}</span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-sm p-3 text-xs leading-relaxed space-y-2 ${
                        isHelper
                          ? 'bg-white border-[1.5px] border-neutral-900 shadow-[2px_2px_0px_#18181b] text-neutral-900'
                          : 'bg-emerald-700 text-white shadow-[2px_2px_0px_#064e3b]'
                      }`}
                    >
                      <p className="font-sans whitespace-pre-wrap">{msg.text}</p>

                      {/* Interactive Canvas Action Trigger */}
                      {msg.suggestedAction && onApplyStructure && (
                        <div className="mt-2 pt-2 border-t border-neutral-200 bg-neutral-50 -mx-3 -mb-3 p-3 rounded-b-sm space-y-1.5">
                          <span className="text-[10px] font-mono font-bold text-neutral-600 uppercase tracking-wide block">
                            Prepared Structure:
                          </span>
                          <p className="text-[11px] font-sans text-neutral-600">
                            {msg.suggestedAction.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleApplyAction(msg.suggestedAction!)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold py-1.5 px-3 rounded-xs shadow-[1.5px_1.5px_0px_#064e3b] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            <span>{msg.suggestedAction.label}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-center gap-2 text-neutral-500 text-xs font-sans pl-1">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-[11px]">Specialist is typing your structure...</span>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="border-t border-neutral-200 bg-white px-3 py-2 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-[10px] text-neutral-400 font-bold uppercase shrink-0">
                Quick Prompts:
              </span>
              <button
                type="button"
                onClick={() => handleSendMessage('Build a Company with Engineering, Product and Sales')}
                className="whitespace-nowrap px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xs text-neutral-800 transition-colors shrink-0"
              >
                Build Tech Company
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Build a School structure with Grades and STEM Section')}
                className="whitespace-nowrap px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xs text-neutral-800 transition-colors shrink-0"
              >
                Build School Hierarchy
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Build a Creative Agency with Client Services and Design')}
                className="whitespace-nowrap px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-xs text-neutral-800 transition-colors shrink-0"
              >
                Build Creative Agency
              </button>
            </div>

            {/* Chat Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="border-t-2 border-neutral-900 bg-neutral-100 p-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Tell the helper what structure or departments you need..."
                className="flex-1 bg-white border border-neutral-300 focus:border-neutral-900 px-3 py-2 text-xs rounded-xs text-neutral-900 focus:outline-none transition-colors font-sans"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white p-2 rounded-xs transition-colors shadow-[2px_2px_0px_#71717a] cursor-pointer"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
