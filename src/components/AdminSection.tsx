import React, { useState } from 'react';
import { 
  Department, 
  Role, 
  User, 
  Assignment, 
  Task, 
  EventBinding, 
  JoinLink, 
  DeptType,
  Organization,
  OrgIntegrations
} from '../types';
import { 
  Building2, 
  FolderPlus, 
  UserPlus, 
  Link2, 
  QrCode, 
  Calendar, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Flame, 
  Users2, 
  Clock, 
  ShieldCheck, 
  Plus,
  Network
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { IntegrationsPanel } from './IntegrationsPanel';

interface AdminSectionProps {
  currentUser: User;
  allDepts: Department[];
  allRoles: Role[];
  allUsers: User[];
  assignments: Assignment[];
  joinLinks: JoinLink[];
  events: EventBinding[];
  organization?: Organization;
  onUpdateIntegrations?: (integrations: OrgIntegrations) => void;
  onCreateDepartment: (dept: Partial<Department>) => void;
  onCreateRole: (role: Partial<Role>) => void;
  onGenerateJoinLink: (roleId: string, roleTitle: string, deptName: string, daysValid: number) => Promise<JoinLink | null> | JoinLink | null;
  onCreateEvent: (title: string, description: string, deptIds: string[]) => void;
  onArchiveTempDept: (deptId: string) => void;
  onRemoveMember: (assignmentId: string) => void;
}

export const AdminSection: React.FC<AdminSectionProps> = ({
  currentUser,
  allDepts,
  allRoles,
  allUsers,
  assignments,
  joinLinks,
  events,
  organization,
  onUpdateIntegrations,
  onCreateDepartment,
  onCreateRole,
  onGenerateJoinLink,
  onCreateEvent,
  onArchiveTempDept,
  onRemoveMember
}) => {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'links' | 'events' | 'temp' | 'integrations'>('hierarchy');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [qrModalLink, setQrModalLink] = useState<JoinLink | null>(null);
  const [linkGenError, setLinkGenError] = useState<string | null>(null);
  const [linkGenSuccessMessage, setLinkGenSuccessMessage] = useState<string | null>(null);

  // New Department Modal Form State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptType, setNewDeptType] = useState<DeptType>('department');
  const [newDeptParentId, setNewDeptParentId] = useState<string>('');
  const [newDeptRootTitle, setNewDeptRootTitle] = useState('');
  const [groupedDeptIds, setGroupedDeptIds] = useState<string[]>([]);

  // New Role Form State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleDeptId, setNewRoleDeptId] = useState('');
  const [newRoleIsRoot, setNewRoleIsRoot] = useState(false);

  // Link Generation State
  const [selectedRoleIdForLink, setSelectedRoleIdForLink] = useState('');
  const [linkValidityDays, setLinkValidityDays] = useState(7);

  // Event Creation State
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDeptIds, setEventDeptIds] = useState<string[]>([]);

  const handleCopyLink = (link: JoinLink) => {
    const fullUrl = `${window.location.origin}/?join=${link.token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkId(link.id);
    confetti({ particleCount: 25, spread: 40 });
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  const handleCreateDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    onCreateDepartment({
      name: newDeptName,
      slug: newDeptName.toLowerCase().replace(/\s+/g, '-'),
      type: newDeptType,
      parentDeptId: newDeptParentId || undefined,
      groupedDeptIds: newDeptType === 'section' ? groupedDeptIds : undefined,
      isTemporary: newDeptType === 'temp',
      validFrom: newDeptType === 'temp' ? new Date().toISOString() : undefined,
      validTo: newDeptType === 'temp' ? new Date(Date.now() + 90 * 86400000).toISOString() : undefined
    });

    setShowDeptModal(false);
    setNewDeptName('');
    setNewDeptType('department');
    setGroupedDeptIds([]);
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleTitle.trim() || !newRoleDeptId) return;

    onCreateRole({
      title: newRoleTitle,
      slug: newRoleTitle.toLowerCase().replace(/\s+/g, '-'),
      deptId: newRoleDeptId,
      isRoot: newRoleIsRoot,
      roleType: newRoleIsRoot ? 'dept_root' : 'member'
    });

    setShowRoleModal(false);
    setNewRoleTitle('');
  };

  const handleGenerateLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkGenError(null);
    setLinkGenSuccessMessage(null);

    if (!selectedRoleIdForLink) return;
    const role = allRoles.find(r => r.id === selectedRoleIdForLink);
    const dept = allDepts.find(d => d.id === role?.deptId);
    if (!role || !dept) return;

    try {
      const link = await onGenerateJoinLink(role.id, role.title, dept.name, linkValidityDays);
      if (link) {
        setSelectedRoleIdForLink('');
        setQrModalLink(link);
        setLinkGenSuccessMessage(`Time-windowed link generated for @${role.title} (${linkValidityDays} days valid). Unlimited users can join during this window.`);
        confetti({ particleCount: 30, spread: 50 });
      }
    } catch (err: any) {
      setLinkGenError(err.message || 'Failed to generate link: authority check failed.');
    }
  };

  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || eventDeptIds.length < 2) return;

    onCreateEvent(eventTitle, eventDesc, eventDeptIds);
    setShowEventModal(false);
    setEventTitle('');
    setEventDesc('');
    setEventDeptIds([]);
    confetti({ particleCount: 40, spread: 60 });
  };

  return (
    <div className="space-y-4">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E5E5E5]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A1A1A1] mb-1 font-mono">
            Administration Module // 06
          </div>
          <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#1A1A1A]" />
            Organizational Structure & Access Topology
          </h2>
          <p className="text-xs text-[#717171] mt-0.5">
            Configure recursive departments, sections, time-windowed invite links, and horizontal bindings.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-[#FAFAFA] border border-[#E5E5E5] p-1 rounded-xs">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xs transition-all cursor-pointer ${
              activeTab === 'hierarchy' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#717171] hover:text-[#1A1A1A]'
            }`}
          >
            Org Hierarchy
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xs transition-all cursor-pointer ${
              activeTab === 'links' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#717171] hover:text-[#1A1A1A]'
            }`}
          >
            Invite Links ({joinLinks.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xs transition-all cursor-pointer ${
              activeTab === 'events' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#717171] hover:text-[#1A1A1A]'
            }`}
          >
            Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('temp')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xs transition-all cursor-pointer ${
              activeTab === 'temp' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#717171] hover:text-[#1A1A1A]'
            }`}
          >
            Temp Depts
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider font-bold rounded-xs transition-all cursor-pointer ${
              activeTab === 'integrations' ? 'bg-[#1A1A1A] text-white shadow-xs' : 'text-[#717171] hover:text-[#1A1A1A]'
            }`}
          >
            Integrations
          </button>
        </div>
      </div>

      {/* Tab 1: Org Hierarchy Manager */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowDeptModal(true)}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#333333] text-white text-[10px] font-mono uppercase tracking-widest font-bold rounded-xs inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Add Department / Section
            </button>
            <button
              onClick={() => setShowRoleModal(true)}
              className="px-4 py-2 bg-[#FAFAFA] hover:bg-[#F5F5F5] text-[#1A1A1A] border border-[#E5E5E5] text-[10px] font-mono uppercase tracking-widest font-bold rounded-xs inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#1A1A1A]" />
              Add Role
            </button>
          </div>

          {/* Department Tree Rendering */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allDepts.map(dept => {
              const deptRoles = allRoles.filter(r => r.deptId === dept.id);
              const isSection = dept.type === 'section';
              const isSubject = dept.type === 'subject';
              const isTemp = dept.isTemporary;

              return (
                <div 
                  key={dept.id} 
                  className={`bg-white rounded-xs p-4 border transition-all shadow-xs ${
                    isSection ? 'border-2 border-[#1A1A1A]' : 
                    isSubject ? 'border border-[#A1A1A1]' : 
                    isTemp ? 'border border-amber-300 bg-amber-50/10' : 'border border-[#E5E5E5]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xs border ${
                        isSection ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' :
                        isSubject ? 'bg-[#FAFAFA] text-[#1A1A1A] border-[#E5E5E5]' :
                        isTemp ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-[#F5F5F5] text-[#1A1A1A] border-[#E5E5E5]'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1A1A1A] text-xs font-mono uppercase tracking-wide">{dept.name}</h3>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-xs font-mono uppercase font-bold bg-[#FAFAFA] border border-[#E5E5E5] text-[#717171]">
                          TYPE: {dept.type}
                        </span>
                      </div>
                    </div>

                    {isTemp && !dept.isArchived && (
                      <button
                        onClick={() => onArchiveTempDept(dept.id)}
                        className="text-[10px] font-mono uppercase tracking-wider text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
                      >
                        Archive Dept
                      </button>
                    )}
                  </div>

                  {/* Section groupings info if section */}
                  {isSection && dept.groupedDeptIds && dept.groupedDeptIds.length > 0 && (
                    <div className="mb-3 p-3 rounded-xs bg-[#FAFAFA] border border-[#E5E5E5] text-xs font-mono">
                      <p className="font-bold text-[#1A1A1A] text-[10px] uppercase tracking-wider mb-1.5">
                        Direct Role Reaches inside Grouped Departments:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {dept.groupedDeptIds.map(gId => {
                          const gDept = allDepts.find(d => d.id === gId);
                          return (
                            <span key={gId} className="px-2 py-0.5 rounded-xs bg-white text-[#1A1A1A] border border-[#E5E5E5] font-mono text-[10px]">
                              {gDept?.name || gId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Roles defined in this department */}
                  <div className="space-y-1.5 mt-3 pt-3 border-t border-[#E5E5E5]">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#A1A1A1] font-mono">Defined Roles ({deptRoles.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {deptRoles.map(role => {
                        const assignedUsers = assignments
                          .filter(a => a.roleId === role.id && a.isActive)
                          .map(a => allUsers.find(u => u.id === a.userId))
                          .filter(Boolean);

                        return (
                          <div
                            key={role.id}
                            className={`p-1.5 rounded-xs text-[11px] border flex items-center gap-1.5 font-mono ${
                              role.isRoot 
                                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] font-bold' 
                                : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#1A1A1A]'
                            }`}
                          >
                            <span>@{role.title}</span>
                            {role.isRoot && <span className="text-[8px] px-1 bg-[#333333] border border-[#555555] rounded-xs uppercase font-bold">root</span>}
                            <span className={`text-[10px] ${role.isRoot ? 'text-[#A1A1A1]' : 'text-[#717171]'}`}>({assignedUsers.length})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Invite Links Cascade */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          {linkGenError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Authority Check Failed:</strong> {linkGenError}
              </div>
            </div>
          )}

          {linkGenSuccessMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>{linkGenSuccessMessage}</div>
            </div>
          )}

          {/* Link Generator Form */}
          <form onSubmit={handleGenerateLinkSubmit} className="bg-white p-4 rounded-xs border border-[#E5E5E5] shadow-xs flex flex-wrap items-end gap-3 font-mono">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#717171] mb-1">
                Target Role for Invite Link:
              </label>
              <select
                value={selectedRoleIdForLink}
                onChange={e => setSelectedRoleIdForLink(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] text-[#1A1A1A] focus:outline-hidden focus:border-[#1A1A1A]"
              >
                <option value="">-- Choose Role --</option>
                {allRoles.map(r => {
                  const dept = allDepts.find(d => d.id === r.deptId);
                  return (
                    <option key={r.id} value={r.id}>
                      {r.title} ({dept?.name})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="w-36">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#717171] mb-1">
                Validity Window:
              </label>
              <select
                value={linkValidityDays}
                onChange={e => setLinkValidityDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] text-[#1A1A1A] focus:outline-hidden focus:border-[#1A1A1A]"
              >
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!selectedRoleIdForLink}
              className="px-5 py-2 bg-[#1A1A1A] hover:bg-[#333333] disabled:opacity-50 text-white rounded-xs text-[10px] font-mono uppercase tracking-widest font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              Generate Scoped Link
            </button>
          </form>

          {/* Active Links Table */}
          <div className="bg-white rounded-xs border border-[#E5E5E5] overflow-hidden shadow-xs">
            <div className="p-3 bg-[#FAFAFA] border-b border-[#E5E5E5]">
              <h3 className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-wider font-mono">
                Active Multi-Use Invite Tokens
              </h3>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {joinLinks.map(link => (
                <div key={link.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-[#FAFAFA]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#1A1A1A] text-xs font-mono">
                        @{link.roleTitle}
                      </span>
                      <span className="text-[#717171] text-xs font-mono">in {link.deptName}</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-[#10B981] border border-emerald-200 rounded-xs text-[9px] font-mono uppercase font-bold">
                        ACTIVE_TOKEN
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#717171] font-mono text-[11px]">
                      <span>Expires: {new Date(link.expiresAt).toLocaleDateString()}</span>
                      <span>Uses: {link.useCount} {link.maxUses ? `/ ${link.maxUses}` : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQrModalLink(link)}
                      className="p-1.5 text-[#1A1A1A] hover:bg-[#F5F5F5] border border-[#E5E5E5] rounded-xs cursor-pointer"
                      title="Show QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(link)}
                      className={`px-3 py-1.5 rounded-xs text-[10px] font-mono uppercase tracking-wider font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                        copiedLinkId === link.id
                          ? 'bg-emerald-50 text-[#10B981] border-emerald-300'
                          : 'bg-white hover:bg-[#FAFAFA] text-[#1A1A1A] border-[#E5E5E5]'
                      }`}
                    >
                      {copiedLinkId === link.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedLinkId === link.id ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              ))}
              {joinLinks.length === 0 && (
                <div className="p-8 text-center text-xs font-mono text-[#A1A1A1]">
                  No active join links issued. Select a role above to generate.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Horizontal Events */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs font-mono text-[#717171] max-w-lg">
              Events bind two or more departments horizontally for collaboration without creating hierarchical authority between them.
            </p>
            <button
              onClick={() => setShowEventModal(true)}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#333333] text-white text-[10px] font-mono uppercase tracking-widest font-bold rounded-xs inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Event Binding
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map(event => (
              <div key={event.id} className="bg-white rounded-xs p-4 border border-[#E5E5E5] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#1A1A1A] text-xs font-mono uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#1A1A1A]" />
                    {event.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded-xs text-[9px] font-mono uppercase font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
                    ACTIVE_BINDING
                  </span>
                </div>
                <p className="text-xs text-[#717171] mb-3 font-mono">{event.description}</p>
                <div className="border-t border-[#E5E5E5] pt-2.5">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[#A1A1A1] font-mono mb-1.5">Bound Departments:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {event.departmentIds.map(dId => {
                      const dept = allDepts.find(d => d.id === dId);
                      return (
                        <span key={dId} className="px-2 py-0.5 rounded-xs bg-[#FAFAFA] text-[#1A1A1A] border border-[#E5E5E5] text-[10px] font-mono">
                          {dept?.name || dId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Temp Departments */}
      {activeTab === 'temp' && (
        <div className="space-y-4">
          <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 rounded-xs text-xs text-[#1A1A1A] font-mono">
            <h4 className="font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Clock className="w-4 h-4 text-[#1A1A1A]" />
              Temporary Department Lifecycle & History Preservation
            </h4>
            <p className="text-xs text-[#717171] leading-relaxed">
              Temporary departments are first-class containers for ad-hoc initiatives or contractor teams.
              When closed, current authority ceases, but tasks, deliverables, and records remain archived in the File Vault.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allDepts.filter(d => d.isTemporary).map(d => (
              <div key={d.id} className="bg-white rounded-xs p-4 border border-[#E5E5E5] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#1A1A1A] text-xs font-mono uppercase">{d.name}</h3>
                  <span className={`px-2 py-0.5 rounded-xs text-[9px] font-mono uppercase font-bold ${
                    d.isArchived ? 'bg-[#FAFAFA] text-[#717171] border border-[#E5E5E5]' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {d.isArchived ? 'ARCHIVED' : 'ACTIVE_TEMPORAL'}
                  </span>
                </div>
                <p className="text-xs text-[#717171] mb-3 font-mono">
                  Valid: {d.validFrom ? new Date(d.validFrom).toLocaleDateString() : 'Now'} → {d.validTo ? new Date(d.validTo).toLocaleDateString() : 'Ongoing'}
                </p>
                {!d.isArchived && (
                  <button
                    onClick={() => onArchiveTempDept(d.id)}
                    className="px-3.5 py-1.5 bg-[#1A1A1A] hover:bg-[#333333] text-white rounded-xs text-[10px] font-mono uppercase tracking-wider font-bold cursor-pointer"
                  >
                    Close & Archive Department
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: External Tool Integrations (Google Workspace, GitHub, Figma, Canva) */}
      {activeTab === 'integrations' && (
        <div className="bg-white rounded-xs p-6 border border-[#E5E5E5] shadow-xs">
          <IntegrationsPanel
            organization={organization}
            onUpdateIntegrations={onUpdateIntegrations}
          />
        </div>
      )}

      {/* QR Code & Join Link Modal */}
      {qrModalLink && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs shadow-2xl max-w-sm w-full p-6 text-center border border-[#E5E5E5]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A1A1A1] mb-1 font-mono">
              Access Token
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] font-mono uppercase mb-1">
              Join Link & QR Code
            </h3>
            <p className="text-xs text-[#717171] font-mono mb-4">
              Scoped to <strong className="text-[#1A1A1A]">@{qrModalLink.roleTitle}</strong> in {qrModalLink.deptName}
            </p>

            {/* Generated QR visual */}
            <div className="w-48 h-48 mx-auto bg-[#FAFAFA] border border-[#E5E5E5] rounded-xs p-3 flex flex-col items-center justify-center mb-4">
              <QrCode className="w-32 h-32 text-[#1A1A1A]" />
              <p className="text-[10px] text-[#A1A1A1] font-mono mt-2 uppercase font-bold tracking-widest">SCAN TO SIGN UP</p>
            </div>

            <div className="bg-[#FAFAFA] p-2.5 rounded-xs border border-[#E5E5E5] text-[11px] font-mono truncate mb-4 text-[#1A1A1A]">
              {window.location.origin}/?join={qrModalLink.token}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQrModalLink(null)}
                className="flex-1 px-3 py-2 text-xs font-mono uppercase tracking-wider font-bold text-[#717171] bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-[#E5E5E5] rounded-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleCopyLink(qrModalLink)}
                className="flex-1 px-3 py-2 text-xs font-mono uppercase tracking-wider font-bold text-white bg-[#1A1A1A] hover:bg-[#333333] rounded-xs cursor-pointer"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs shadow-2xl max-w-md w-full p-6 border border-[#E5E5E5]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A1A1A1] mb-1 font-mono">
              Topology Setup
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] font-mono uppercase mb-4">
              Add Department or Section
            </h3>
            <form onSubmit={handleCreateDeptSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 9 or High School Section"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] focus:bg-white focus:outline-hidden focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Structural Type:</label>
                <select
                  value={newDeptType}
                  onChange={e => setNewDeptType(e.target.value as DeptType)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] text-[#1A1A1A] focus:outline-hidden focus:border-[#1A1A1A]"
                >
                  <option value="department">Standard Department (subordinate root)</option>
                  <option value="section">Section (reaches roles inside grouped depts directly)</option>
                  <option value="subject">Subject Department (cross-cutting subject matrix)</option>
                  <option value="temp">Temporary Department (ad-hoc / contractor initiative)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Parent Department:</label>
                <select
                  value={newDeptParentId}
                  onChange={e => setNewDeptParentId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] text-[#1A1A1A] focus:outline-hidden focus:border-[#1A1A1A]"
                >
                  <option value="">None (Top-Level under Org)</option>
                  {allDepts.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                  ))}
                </select>
              </div>

              {newDeptType === 'section' && (
                <div>
                  <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">
                    Select Departments Grouped by this Section:
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-[#E5E5E5] rounded-xs p-2.5 bg-[#FAFAFA]">
                    {allDepts.filter(d => d.type === 'department').map(d => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={groupedDeptIds.includes(d.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setGroupedDeptIds([...groupedDeptIds, d.id]);
                            } else {
                              setGroupedDeptIds(groupedDeptIds.filter(id => id !== d.id));
                            }
                          }}
                        />
                        <span className="text-xs font-mono">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-3.5 py-1.5 text-[#717171] hover:text-[#1A1A1A] hover:bg-[#FAFAFA] rounded-xs border border-transparent hover:border-[#E5E5E5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1A1A1A] hover:bg-[#333333] text-white rounded-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Create Container
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs shadow-2xl max-w-md w-full p-6 border border-[#E5E5E5]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A1A1A1] mb-1 font-mono">
              Role Position Definition
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] font-mono uppercase mb-4">
              Define New Role
            </h3>
            <form onSubmit={handleCreateRoleSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Role Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. math-teacher, lab-assistant, lead-developer"
                  value={newRoleTitle}
                  onChange={e => setNewRoleTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] focus:bg-white focus:outline-hidden focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Belongs to Department:</label>
                <select
                  value={newRoleDeptId}
                  onChange={e => setNewRoleDeptId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] text-[#1A1A1A] focus:outline-hidden focus:border-[#1A1A1A]"
                >
                  <option value="">-- Select Department --</option>
                  {allDepts.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isRootCheck"
                  checked={newRoleIsRoot}
                  onChange={e => setNewRoleIsRoot(e.target.checked)}
                />
                <label htmlFor="isRootCheck" className="text-[#1A1A1A] font-bold text-xs cursor-pointer">
                  This role is the Root / Lead of this department
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-3.5 py-1.5 text-[#717171] hover:text-[#1A1A1A] hover:bg-[#FAFAFA] rounded-xs border border-transparent hover:border-[#E5E5E5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#1A1A1A] hover:bg-[#333333] text-white rounded-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xs shadow-2xl max-w-md w-full p-6 border border-[#E5E5E5]">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A1A1A1] mb-1 font-mono">
              Horizontal Binding
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] font-mono uppercase mb-4">
              Create Horizontal Event Binding
            </h3>
            <form onSubmit={handleCreateEventSubmit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Event Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Fair 2026 or Joint Term Assessment"
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] focus:bg-white focus:outline-hidden focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">Description:</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the collaboration scope..."
                  value={eventDesc}
                  onChange={e => setEventDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-xs bg-[#FAFAFA] focus:bg-white focus:outline-hidden focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#717171] text-[10px] uppercase tracking-wider mb-1">
                  Select 2 or more Departments to Bind:
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-[#E5E5E5] rounded-xs p-2.5 bg-[#FAFAFA]">
                  {allDepts.map(d => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eventDeptIds.includes(d.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setEventDeptIds([...eventDeptIds, d.id]);
                          } else {
                            setEventDeptIds(eventDeptIds.filter(id => id !== d.id));
                          }
                        }}
                      />
                      <span className="text-xs font-mono">{d.name} ({d.type})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-3.5 py-1.5 text-[#717171] hover:text-[#1A1A1A] hover:bg-[#FAFAFA] rounded-xs border border-transparent hover:border-[#E5E5E5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={eventDeptIds.length < 2 || !eventTitle.trim()}
                  className="px-4 py-1.5 bg-[#1A1A1A] hover:bg-[#333333] disabled:opacity-50 text-white rounded-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Bind Departments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
