import React, { useState } from 'react';
import { 
  Users, 
  CheckSquare, 
  HardDrive, 
  MessageSquare, 
  Video,
  LogOut, 
  ChevronDown, 
  PanelLeftClose,
  PanelLeft,
  Layers,
  UserPlus,
  ShieldCheck,
  Settings as SettingsIcon
} from 'lucide-react';
import { User, Role, Department } from '../../types';

export type SidebarTab = 'dashboard' | 'tasks' | 'team' | 'files' | 'chat' | 'invites' | 'meetings' | 'admin' | 'settings';

interface AppSidebarProps {
  currentUser: User;
  currentUserRoles: { role?: Role; dept?: Department }[];
  masterRootUserId?: string;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  isCurrentUserLead: boolean;
  hasSuperiors?: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  taskCount: number;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
  onSignOut: () => void;
  onOpenWalkthrough?: () => void;
  onCreateTaskClick?: () => void;
  onViewProfile?: (user: User) => void;
  onOpenSettings?: () => void;
  isAnyRoot?: boolean;
  orgName?: string;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentUser,
  currentUserRoles,
  masterRootUserId,
  activeTab,
  setActiveTab,
  hasSuperiors = false,
  isCollapsed,
  setIsCollapsed,
  taskCount,
  allUsers,
  onSwitchUser,
  onSignOut,
  onViewProfile,
  onOpenSettings,
  isAnyRoot = false,
  orgName = 'Oakridge Academy'
}) => {
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  // Nav items per specification (Part A6: Meetings is a sibling to Dashboard/Chat/File Vault)
  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      shortLabel: 'Home',
      icon: Layers
    },
    {
      id: 'team' as const,
      label: 'Staff Directory',
      shortLabel: 'Staff',
      icon: Users
    },
    ...(hasSuperiors ? [{
      id: 'tasks' as const,
      label: 'Task Feed',
      shortLabel: 'Tasks',
      icon: CheckSquare,
      badge: taskCount > 0 ? String(taskCount) : undefined
    }] : []),
    {
      id: 'meetings' as const,
      label: 'Meetings',
      shortLabel: 'Meet',
      icon: Video
    },
    {
      id: 'chat' as const,
      label: 'Messages',
      shortLabel: 'Chat',
      icon: MessageSquare
    },
    {
      id: 'files' as const,
      label: 'File Vault',
      shortLabel: 'Files',
      icon: HardDrive
    },
    {
      id: 'invites' as const,
      label: 'Invitations',
      shortLabel: 'Invites',
      icon: UserPlus
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      shortLabel: 'Settings',
      icon: SettingsIcon
    }
  ];

  return (
    <aside
      className={`relative z-30 flex flex-col shrink-0 bg-[#F7F5F0] border-r border-[#DAD5C9] transition-all duration-200 ease-in-out select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER / BRAND LOCKUP
      ───────────────────────────────────────────────────────────── */}
      {!isCollapsed ? (
        <div className="h-16 flex items-center justify-between px-3.5 bg-white border-b border-[#DAD5C9] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-xs bg-[#1C2438] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs font-mono">
              M.
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm text-[#1C2438] tracking-tight truncate block">
                {orgName}
              </span>
              <span className="text-[10px] font-mono text-[#8A8578] truncate block">
                Recursive Authority
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-[#8A8578] hover:text-[#1C2438] hover:bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="bg-white border-b border-[#DAD5C9] shrink-0">
          <div className="h-12 flex items-center justify-center">
            <div className="w-8 h-8 rounded-xs bg-[#1C2438] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs font-mono">
              M.
            </div>
          </div>
          <div className="py-1.5 px-2 bg-[#F7F5F0] border-t border-[#DAD5C9] flex items-center justify-center">
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full py-1 flex items-center justify-center text-[#8A8578] hover:text-[#1C2438] hover:bg-[#EFEBE2] rounded-xs transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGATION MENU ITEMS
      ───────────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto font-sans text-xs">
        <div className={`px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#8A8578] ${isCollapsed ? 'hidden' : 'block'}`}>
          WORKSPACE
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white text-[#1C2438] font-bold border border-[#DAD5C9] shadow-2xs'
                  : 'text-[#5C574B] hover:text-[#1C2438] hover:bg-[#EFEBE2]'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#2F3B7A]' : 'text-[#8A8578]'}`} />

              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-xs ${
                      isActive 
                        ? 'bg-[#1C2438] text-white' 
                        : 'bg-[#DAD5C9] text-[#1C2438]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}

        <div className="pt-3 border-t border-[#DAD5C9] my-2">
          {!isCollapsed && (
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[#8A8578]">
              SYSTEM
            </div>
          )}

          <button
            onClick={onSignOut}
            title={isCollapsed ? 'Exit to Landing Page' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xs text-[#5C574B] hover:text-[#1C2438] hover:bg-[#EFEBE2] transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 text-[#8A8578] shrink-0" />
            {!isCollapsed && <span>Exit to Landing Page</span>}
          </button>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          3. USER PROFILE & PERSONA SWITCHER
      ───────────────────────────────────────────────────────────── */}
      <div className="p-2.5 border-t border-[#DAD5C9] bg-white relative flex items-center justify-between gap-1">
        <button
          onClick={() => {
            if (onViewProfile) onViewProfile(currentUser);
          }}
          className={`min-w-0 flex-1 flex items-center gap-2.5 p-1.5 hover:bg-[#F7F5F0] rounded-xs transition-colors cursor-pointer text-left group ${
            isCollapsed ? 'justify-center p-1' : ''
          }`}
          title="Click to view your profile"
        >
          <div className="w-8 h-8 rounded-xs bg-[#1C2438] text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-xs">
            {currentUser.preferredName?.[0] || 'U'}
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-bold text-xs text-[#1C2438] truncate group-hover:underline">
                  {currentUser.fullName}
                </span>
                {currentUser.id === masterRootUserId && (
                  <span className="text-[9px] font-mono bg-[#1C2438] text-white px-1 rounded-xs shrink-0">
                    ROOT
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-[#8A8578] truncate">
                {currentUserRoles.map(r => `@${r.role?.title}`).join(', ') || 'No Role Assigned'}
              </div>
            </div>
          )}
        </button>

        {!isCollapsed && (
          <div className="flex items-center gap-1">
            {isAnyRoot && onOpenSettings && (
              <button
                id="sidebar-gear-settings-btn"
                onClick={onOpenSettings}
                className="p-1.5 text-[#8A8578] hover:text-[#1C2438] hover:bg-[#F7F5F0] rounded-xs transition-colors cursor-pointer"
                title="Settings & Integrations"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="p-1.5 text-[#8A8578] hover:text-[#1C2438] hover:bg-[#F7F5F0] rounded-xs transition-colors cursor-pointer"
              title="Switch active user identity (Test Mode)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showPersonaMenu && (
          <div className="absolute left-0 bottom-full mb-1 w-64 bg-white border border-[#DAD5C9] shadow-xl rounded-xs py-2 z-50 font-mono text-xs animate-in fade-in duration-100">
            <div className="px-3 py-1.5 border-b border-[#DAD5C9] text-[10px] uppercase font-bold text-[#8A8578] flex items-center justify-between">
              <span>Switch User Identity</span>
              <span className="text-[9px] font-mono text-[#8A8578]">Test Mode</span>
            </div>
            <div className="px-3 py-1 text-[11px] text-[#5C574B] bg-[#F7F5F0] border-b border-[#DAD5C9]">
              Active: <strong className="text-[#1C2438]">{currentUser.email}</strong>
            </div>

            <div className="max-h-52 overflow-y-auto py-1 divide-y divide-[#EFEBE2]">
              {allUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSwitchUser(u.id);
                    setShowPersonaMenu(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#F7F5F0] transition-colors cursor-pointer ${
                    u.id === currentUser.id ? 'bg-[#EFF6FF] text-[#2F3B7A] font-bold' : 'text-[#1C2438]'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold truncate">{u.fullName}</div>
                    <div className="text-[10px] text-[#8A8578] truncate">{u.email}</div>
                  </div>
                  {u.id === masterRootUserId && (
                    <span className="text-[9px] bg-[#1C2438] text-white px-1 rounded-xs shrink-0">
                      ROOT
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
