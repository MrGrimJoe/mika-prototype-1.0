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
  onSignOut: () => void;
  onOpenWalkthrough?: () => void;
  onCreateTaskClick?: () => void;
  onViewProfile?: (user: User) => void;
  onOpenSettings?: () => void;
  isAnyRoot?: boolean;
  orgName?: string;
  orgs?: { id: string; name: string }[];
  currentOrgId?: string;
  onSwitchOrg?: (orgId: string) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentUser,
  currentUserRoles,
  masterRootUserId,
  activeTab,
  setActiveTab,
  hasSuperiors = false,
  isCurrentUserLead = false,
  isCollapsed,
  setIsCollapsed,
  taskCount,
  onSignOut,
  onViewProfile,
  onOpenSettings,
  isAnyRoot = false,
  orgName = '',
  orgs = [],
  currentOrgId,
  onSwitchOrg
}) => {

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
    // Only people with authority over others can invite staff or change org settings.
    ...(isCurrentUserLead ? [
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
    ] : [])
  ];

  return (
    <aside
      className={`relative z-30 flex flex-col shrink-0 bg-paper border-r border-hairline transition-all duration-200 ease-in-out select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER / BRAND LOCKUP
      ───────────────────────────────────────────────────────────── */}
      {!isCollapsed ? (
        <div className="h-16 flex items-center justify-between px-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-sm bg-accent text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
              M
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-[15px] text-ink tracking-tight truncate block leading-tight">
                {orgName}
              </span>
              {orgs.length > 1 && onSwitchOrg ? (
                <select
                  aria-label="Switch organisation"
                  value={currentOrgId}
                  onChange={e => onSwitchOrg(e.target.value)}
                  className="text-xs text-ink-3 bg-transparent max-w-full cursor-pointer"
                >
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <span className="text-xs text-ink-3 truncate block">Recursive Authority</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 text-ink-3 hover:text-ink hover:bg-paper-sunken rounded-xs transition-colors cursor-pointer shrink-0"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="shrink-0">
          <div className="h-14 flex items-center justify-center">
            <div className="w-9 h-9 rounded-sm bg-accent text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
              M
            </div>
          </div>
          <div className="py-1.5 px-2 flex items-center justify-center">
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full py-1 flex items-center justify-center text-ink-3 hover:text-ink hover:bg-paper-raised rounded-xs transition-colors cursor-pointer"
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
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto font-sans text-[14px]">
        <div className={`px-3 pt-1 pb-1.5 text-xs font-semibold text-ink-3 ${isCollapsed ? 'hidden' : 'block'}`}>
          Workspace
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 min-h-10 rounded-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-accent/10 text-accent-fg font-semibold'
                  : 'text-ink-2 hover:text-ink hover:bg-paper-sunken'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-accent-fg' : 'text-ink-3'}`} strokeWidth={isActive ? 2.1 : 1.75} />

              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-5 text-center ${
                      isActive 
                        ? 'bg-accent text-white' 
                        : 'bg-paper-sunken text-ink-2'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}

        <div className="pt-3 mt-2">
          {!isCollapsed && (
            <div className="px-3 pb-1.5 text-xs font-semibold text-ink-3">
              Account
            </div>
          )}

          <button
            onClick={onSignOut}
            title={isCollapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xs text-ink-2 hover:text-ink hover:bg-paper-raised transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 text-ink-3 shrink-0" />
            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          3. USER PROFILE & PERSONA SWITCHER
      ───────────────────────────────────────────────────────────── */}
      <div className="p-2.5 border-t border-hairline relative flex items-center justify-between gap-1">
        <button aria-label="Click to view your profile"
          onClick={() => {
            if (onViewProfile) onViewProfile(currentUser);
          }}
          className={`min-w-0 flex-1 flex items-center gap-2.5 p-1.5 hover:bg-paper rounded-xs transition-colors cursor-pointer text-left group ${
            isCollapsed ? 'justify-center p-1' : ''
          }`}
          title="Click to view your profile"
        >
          <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {currentUser.preferredName?.[0] || 'U'}
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-bold text-xs text-ink truncate group-hover:underline">
                  {currentUser.fullName}
                </span>
                {currentUser.id === masterRootUserId && (
                  <span className="text-xs font-mono bg-accent text-white px-1 rounded-xs shrink-0">
                    ROOT
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-ink-3 truncate">
                {currentUserRoles.map(r => `@${r.role?.title}`).join(', ') || 'No Role Assigned'}
              </div>
            </div>
          )}
        </button>

        {!isCollapsed && (
          <div className="flex items-center gap-1">
            {isAnyRoot && onOpenSettings && (
              <button aria-label="Settings & Integrations"
                id="sidebar-gear-settings-btn"
                onClick={onOpenSettings}
                className="p-1.5 text-ink-3 hover:text-ink hover:bg-paper rounded-xs transition-colors cursor-pointer"
                title="Settings & Integrations"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

      </div>
    </aside>
  );
};
