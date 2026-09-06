import React, { useState, useMemo, useEffect } from 'react';
import { Department, User, Role, Assignment, Message } from '../types';
import { 
  MessageSquare, 
  Send, 
  Search, 
  ChevronDown, 
  ShieldCheck, 
  Layers, 
  User as UserIcon,
  ArrowRight,
  Radio,
  ExternalLink
} from 'lucide-react';
import { 
  getUserContexts, 
  getReachableContactsForContext, 
  UserContext, 
  ReachablePerson 
} from '../lib/orgRules';
import { sendGoogleChatMessage } from '../lib/workspace';
import { upsertMessage } from '../lib/firestoreService';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  channelId: string;
  content: string;
  timestamp: string;
}

interface ChatPanelProps {
  currentUser: User;
  allUsers: User[];
  allDepts: Department[];
  allRoles: Role[];
  assignments: Assignment[];
  onViewProfile?: (user: User) => void;
  initialTargetUserId?: string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  currentUser,
  allUsers,
  allDepts,
  allRoles,
  assignments,
  onViewProfile,
  initialTargetUserId
}) => {
  // 1. Compute all active contexts held by the current user
  const userContexts = useMemo(() => {
    return getUserContexts(currentUser.id, allDepts, allRoles, assignments);
  }, [currentUser.id, allDepts, allRoles, assignments]);

  // 2. Active Context state (default to first role/dept held)
  const [selectedContextIndex, setSelectedContextIndex] = useState<number>(0);
  const activeContext: UserContext | undefined = userContexts[selectedContextIndex] || userContexts[0];

  // 3. Compute reachable contacts strictly for the active context under Rules A, B, and C
  const reachableContacts = useMemo(() => {
    if (!activeContext) return [];
    return getReachableContactsForContext(
      currentUser.id,
      activeContext,
      allUsers,
      allDepts,
      allRoles,
      assignments
    );
  }, [currentUser.id, activeContext, allUsers, allDepts, allRoles, assignments]);

  // 4. Selected contact for 1-to-1 conversation
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');

  // Auto-select contact when context changes or initialTargetUserId is set
  useEffect(() => {
    if (initialTargetUserId && reachableContacts.some(c => c.user.id === initialTargetUserId)) {
      setSelectedUserId(initialTargetUserId);
      return;
    }

    if (reachableContacts.length > 0) {
      if (!reachableContacts.some(c => c.user.id === selectedUserId)) {
        setSelectedUserId(reachableContacts[0].user.id);
      }
    } else {
      setSelectedUserId('');
    }
  }, [activeContext, reachableContacts, initialTargetUserId]);

  const activeContact = useMemo(() => {
    return reachableContacts.find(c => c.user.id === selectedUserId) || null;
  }, [reachableContacts, selectedUserId]);

  // Group contacts by rule for authoritative presentation
  const groupedContacts = useMemo(() => {
    const groups: { [key: string]: ReachablePerson[] } = {
      'Department Peers': [],
      'Subordinate Department': [],
      'Department Root': [],
      'Grouped Section': [],
      'Section Root': []
    };

    const filtered = contactSearch(reachableContacts, searchQuery);

    filtered.forEach(item => {
      if (groups[item.ruleLabel]) {
        groups[item.ruleLabel].push(item);
      } else {
        groups[item.ruleLabel] = [item];
      }
    });

    return groups;
  }, [reachableContacts, searchQuery]);

  // In-session messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'seed_1',
      senderId: 'u_preschool_head',
      senderName: 'Preschool Headmaster',
      senderRole: 'Preschool Lead',
      channelId: getDmChannelId(currentUser.id, 'u_preschool_head'),
      content: 'Early childhood assessment rubric is finalized and uploaded to the file vault.',
      timestamp: 'Today at 08:30 AM'
    }
  ]);

  function getDmChannelId(u1: string, u2: string) {
    return `dm_${[u1, u2].sort().join('_')}`;
  }

  function contactSearch(items: ReachablePerson[], query: string): ReachablePerson[] {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i => 
      i.user.fullName.toLowerCase().includes(q) ||
      i.roleTitles.some(r => r.toLowerCase().includes(q)) ||
      i.deptNames.some(d => d.toLowerCase().includes(q))
    );
  }

  const activeChannelKey = activeContact ? getDmChannelId(currentUser.id, activeContact.user.id) : '';
  const currentMessages = messages.filter(m => m.channelId === activeChannelKey);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeContact) return;

    const contentText = messageInput.trim();
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      senderRole: activeContext ? activeContext.role.title : 'Staff',
      channelId: activeChannelKey,
      content: contentText,
      timestamp: 'Just now'
    };

    setMessages(prev => [...prev, newMsg]);
    setMessageInput('');

    // Part A5: Backed by Google Chat API
    try {
      await sendGoogleChatMessage(activeChannelKey, `${currentUser.fullName}: ${contentText}`);
    } catch (err) {
      console.warn('Google Chat push sync notice:', err);
    }

    // Persist to Firestore
    try {
      const persistedMessage: Message = {
        id: newMsg.id,
        senderId: currentUser.id,
        recipientId: activeContact.user.id,
        channelId: activeChannelKey,
        content: contentText,
        createdAt: new Date().toISOString(),
        read: false
      };
      await upsertMessage(persistedMessage);
    } catch (err) {
      console.warn('Firestore message persist notice:', err);
    }
  };

  return (
    <div className="bg-white border border-[#DAD5C9] rounded-xs shadow-2xs overflow-hidden h-[calc(100vh-140px)] min-h-[520px] flex font-sans">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: CONTEXT SWITCHER & STRICT REACHABLE CONTACTS
      ───────────────────────────────────────────────────────────── */}
      <div className="w-80 border-r border-[#DAD5C9] bg-[#F7F5F0] flex flex-col shrink-0">
        {/* Context Switcher Block */}
        <div className="p-3.5 border-b border-[#DAD5C9] bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8578] font-bold">
              Messaging Context
            </span>
            <span className="text-[9px] font-mono bg-[#F7F5F0] text-[#5C574B] px-1.5 py-0.5 rounded-xs border border-[#DAD5C9]">
              Rules A, B, C
            </span>
          </div>

          {userContexts.length > 1 ? (
            <div>
              <label htmlFor="context-select" className="sr-only">Switch active messaging role/department</label>
              <div className="relative">
                <select
                  id="context-select"
                  value={selectedContextIndex}
                  onChange={e => setSelectedContextIndex(Number(e.target.value))}
                  className="w-full text-xs font-mono bg-[#F7F5F0] border border-[#DAD5C9] text-[#1C2438] py-2 px-2.5 pr-8 rounded-xs focus:outline-hidden focus:border-[#1C2438] cursor-pointer appearance-none"
                >
                  {userContexts.map((ctx, idx) => (
                    <option key={ctx.assignmentId} value={idx}>
                      {ctx.role.title} ({ctx.dept.name})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#8A8578] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : activeContext ? (
            <div className="text-xs font-mono text-[#1C2438] bg-[#F7F5F0] px-2.5 py-1.5 rounded-xs border border-[#DAD5C9] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#2F3B7A]" />
              <span className="truncate">{activeContext.role.title} • {activeContext.dept.name}</span>
            </div>
          ) : (
            <div className="text-xs text-[#DC2626] font-mono">No active assignment held.</div>
          )}
        </div>

        {/* Reachable Contact Search */}
        <div className="p-2 border-b border-[#DAD5C9] bg-[#F7F5F0]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8A8578] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search eligible peers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono bg-white border border-[#DAD5C9] rounded-xs focus:outline-hidden focus:border-[#1C2438] text-[#1C2438]"
            />
          </div>
        </div>

        {/* Reachable Contacts List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {reachableContacts.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#8A8578] font-mono leading-relaxed">
              No contacts reachable under your active role/department context.
            </div>
          ) : (
            (Object.entries(groupedContacts) as [string, ReachablePerson[]][]).map(([ruleLabel, items]) => {
              if (items.length === 0) return null;

              return (
                <div key={ruleLabel} className="space-y-1">
                  <div className="px-1 text-[10px] font-mono uppercase tracking-wider text-[#8A8578] font-bold">
                    {ruleLabel} ({items.length})
                  </div>

                  <div className="space-y-1">
                    {items.map(item => {
                      const isSelected = selectedUserId === item.user.id;
                      const ruleBadge = 
                        item.ruleType === 'rule_a' ? 'Rule A' :
                        item.ruleType === 'rule_b' ? 'Rule B' : 'Rule C';

                      return (
                        <div
                          key={item.user.id}
                          className={`w-full group rounded-xs transition-colors flex items-center justify-between p-2 cursor-pointer border ${
                            isSelected
                              ? 'bg-white border-[#1C2438] shadow-2xs'
                              : 'bg-white border-[#DAD5C9] hover:border-[#8A8578]'
                          }`}
                          onClick={() => setSelectedUserId(item.user.id)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                if (onViewProfile) onViewProfile(item.user);
                              }}
                              className="w-7 h-7 rounded-xs bg-[#1C2438] text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0 cursor-pointer"
                              title={`View ${item.user.fullName}'s profile`}
                            >
                              {item.user.preferredName?.[0] || item.user.fullName[0]}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-[#1C2438] truncate text-left">
                                  {item.user.fullName}
                                </span>
                                <span className={`text-[8px] font-mono px-1 rounded-xs uppercase tracking-wider shrink-0 font-semibold ${
                                  item.ruleType === 'rule_a' 
                                    ? 'bg-[#F7F5F0] text-[#5C574B]'
                                    : item.ruleType === 'rule_b'
                                    ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                                    : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                                }`}>
                                  {ruleBadge}
                                </span>
                              </div>

                              <div className="text-[10px] font-mono text-[#8A8578] truncate mt-0.5">
                                {item.roleTitles.join(', ') || item.contextDescription}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: CONVERSATION STAGE
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white">
        {activeContact ? (
          <>
            {/* Conversation Header */}
            <div className="px-6 py-3.5 border-b border-[#DAD5C9] bg-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => onViewProfile && onViewProfile(activeContact.user)}
                  className="w-9 h-9 rounded-xs bg-[#1C2438] text-white flex items-center justify-center font-mono font-bold text-sm shrink-0 cursor-pointer"
                  title={`View ${activeContact.user.fullName}'s profile`}
                >
                  {activeContact.user.preferredName?.[0] || activeContact.user.fullName[0]}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#1C2438] truncate text-left">
                      {activeContact.user.fullName}
                    </span>
                    <span className="text-[10px] font-mono bg-[#F7F5F0] text-[#5C574B] px-1.5 py-0.2 rounded-xs border border-[#DAD5C9]">
                      {activeContact.ruleLabel}
                    </span>
                    {/* Part A5: Backed by Google Chat indicator */}
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] px-1.5 py-0.2 rounded-xs">
                      <Radio className="w-2.5 h-2.5" />
                      Backed by Google Chat
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#8A8578] truncate">
                    {activeContact.contextDescription} · {activeContact.user.email}
                  </p>
                </div>
              </div>

              {onViewProfile && (
                <button
                  type="button"
                  onClick={() => onViewProfile(activeContact.user)}
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-mono text-[#5C574B] hover:text-[#1C2438] px-2.5 py-1 rounded-xs border border-[#DAD5C9] hover:bg-[#F7F5F0] transition-colors cursor-pointer"
                >
                  <span>View Profile</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Conversation Message Log */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F7F5F0]">
              <div className="p-3 bg-white border border-[#DAD5C9] rounded-xs text-xs font-mono text-[#8A8578] space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-[#1C2438]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Authoritative Channel Established</span>
                </div>
                <p className="text-[11px] text-[#5C574B]">
                  This conversation is strictly authorized under {activeContact.ruleLabel} ({
                    activeContact.ruleType === 'rule_a' ? 'Rule A: Shared Department' :
                    activeContact.ruleType === 'rule_b' ? 'Rule B: Direct Root Authority' :
                    'Rule C: Section Root to Grouped Roles'
                  }). Synced to Google Chat space.
                </p>
              </div>

              {currentMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#8A8578] font-mono">
                  No previous messages in this channel. Send a dispatch below.
                </div>
              ) : (
                currentMessages.map(msg => {
                  const isSelf = msg.senderId === currentUser.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-bold text-[#1C2438] font-mono">
                          {isSelf ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[10px] text-[#8A8578] font-mono">
                          {msg.timestamp}
                        </span>
                      </div>

                      <div
                        className={`max-w-md px-4 py-2.5 rounded-xs text-xs leading-relaxed shadow-2xs ${
                          isSelf
                            ? 'bg-[#1C2438] text-white'
                            : 'bg-white border border-[#DAD5C9] text-[#1C2438]'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#DAD5C9] flex items-center gap-2">
              <input
                type="text"
                placeholder={`Message ${activeContact.user.fullName}...`}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs font-mono bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs focus:bg-white focus:outline-hidden focus:border-[#1C2438] text-[#1C2438]"
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="px-4 py-2 bg-[#1C2438] hover:bg-[#12151C] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-mono uppercase tracking-wider font-bold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F7F5F0]">
            <div className="w-12 h-12 rounded-full bg-white border border-[#DAD5C9] flex items-center justify-center text-[#8A8578] mb-3 shadow-2xs">
              <MessageSquare className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="font-bold text-sm text-[#1C2438]">
              No Contact Selected
            </h3>
            <p className="text-xs text-[#5C574B] max-w-xs mt-1">
              Select an authorized peer from the left panel to begin an exchange.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
