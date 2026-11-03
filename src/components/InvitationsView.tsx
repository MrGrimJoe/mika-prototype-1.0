import React, { useState } from 'react';
import { Department, Role, User, JoinLink, Assignment } from '../types';
import { 
  UserPlus, 
  Link2, 
  Copy, 
  Check, 
  QrCode, 
  Clock, 
  Sparkles, 
  Trash2, 
  Calendar, 
  Building2, 
  ShieldCheck, 
  Share2,
  Users,
  ShieldAlert
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INTEGRATION_TOOLS } from '../lib/integrationService';
import { ModalOverlay } from './ui/ModalOverlay';

interface InvitationsViewProps {
  currentUser: User;
  allDepts: Department[];
  allRoles: Role[];
  allUsers: User[];
  assignments: Assignment[];
  joinLinks: JoinLink[];
  onGenerateJoinLink: (roleId: string, roleTitle: string, deptName: string, daysValid: number, requiredIntegrations?: string[]) => Promise<JoinLink | null> | JoinLink | null;
  onSimulateJoin?: (roleId: string, deptId: string, user: { name: string; email: string }) => void;
}

export const InvitationsView: React.FC<InvitationsViewProps> = ({
  currentUser,
  allDepts,
  allRoles,
  allUsers,
  assignments,
  joinLinks,
  onGenerateJoinLink,
  onSimulateJoin
}) => {
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [qrModalLink, setQrModalLink] = useState<JoinLink | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(allDepts[0]?.id || '');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [validityDays, setValidityDays] = useState<number>(7);
  const [selectedRequiredTools, setSelectedRequiredTools] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Available roles for selected department
  const deptRoles = allRoles.filter(r => r.deptId === selectedDeptId && r.roleType !== 'master_root');

  const handleCopyLink = (link: JoinLink) => {
    const fullUrl = `${window.location.origin}/?join=${link.token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkId(link.id);
    confetti({ particleCount: 20, spread: 50 });
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoleId) {
      setMessage('Please select a role to invite.');
      return;
    }
    const role = allRoles.find(r => r.id === selectedRoleId);
    const dept = allDepts.find(d => d.id === (role?.deptId || selectedDeptId));
    if (!role || !dept) return;

    setIsGenerating(true);
    setMessage(null);
    try {
      const created = await onGenerateJoinLink(role.id, role.title, dept.name, validityDays, selectedRequiredTools);
      if (created) {
        setMessage(`Invitation created for ${role.title}!`);
        setSelectedRequiredTools([]);
        confetti({ particleCount: 30, spread: 60 });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-hairline">
        <div>
          <div className="text-[11px] font-mono text-ink-3 mb-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
            <span>Staff onboarding</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Invitations
          </h1>
          <p className="text-xs sm:text-sm text-ink-3 mt-1">
            Generate and manage invite links that bind incoming staff directly into target department roles.
          </p>
        </div>

        <div className="px-3 py-1.5 bg-surface border border-hairline rounded-xs text-[13px] text-ink-2 flex items-center gap-2 shadow-2xs self-start sm:self-auto">
          <Link2 className="w-3.5 h-3.5 text-ink-3" />
          <span>{joinLinks.length} Active Links</span>
        </div>
      </div>

      {/* Generate Invitation Link Card */}
      <div className="bg-surface border border-hairline rounded-xs p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-paper-raised">
          <div className="w-8 h-8 rounded-xs bg-accent text-white flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink tracking-tight">
              Create New Role Invitation
            </h2>
            <p className="text-xs text-ink-3">
              Create a cryptographic invite link that assigns an applicant to an exact role upon signup.
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-ink-2 mb-1.5">
                1. Department
              </label>
              <select
                value={selectedDeptId}
                onChange={e => {
                  setSelectedDeptId(e.target.value);
                  setSelectedRoleId('');
                }}
                className="w-full px-3 py-2 bg-paper border border-hairline rounded-xs text-xs text-ink focus:ring-1 focus:ring-ink focus:border-ink outline-hidden cursor-pointer"
              >
                {allDepts.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-2 mb-1.5">
                2. Target Role
              </label>
              <select
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2 bg-paper border border-hairline rounded-xs text-xs text-ink focus:ring-1 focus:ring-ink focus:border-ink outline-hidden cursor-pointer"
              >
                <option value="">Select a role...</option>
                {deptRoles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.title} {r.isRoot ? '(Root Lead)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono text-ink-2 mb-1.5">
                3. Link Validity
              </label>
              <div className="flex gap-2">
                <select
                  value={validityDays}
                  onChange={e => setValidityDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-paper border border-hairline rounded-xs text-xs text-ink focus:ring-1 focus:ring-ink outline-hidden cursor-pointer"
                >
                  <option value={1}>24 Hours</option>
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                </select>
                <button
                  type="submit"
                  disabled={!selectedRoleId || isGenerating}
                  className="px-4 py-2 bg-accent hover:bg-accent-strong disabled:opacity-40 text-white rounded-xs text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3.2: Require tool connections before joining */}
          <div className="pt-3 border-t border-paper-raised space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-ink-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-ink-2" />
                <span>Require tool connections before joining (Optional)</span>
              </span>
              <span className="text-[11px] font-mono text-ink-3">
                {selectedRequiredTools.length > 0 ? `${selectedRequiredTools.length} required` : 'None required'}
              </span>
            </div>
            <p className="text-[11px] text-ink-3">
              Incoming members will be required to authenticate these accounts during the join flow before their role is activated.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
              {INTEGRATION_TOOLS.map(tool => {
                const isChecked = selectedRequiredTools.includes(tool.key);
                return (
                  <label
                    key={tool.key}
                    className={`flex items-center gap-2 p-2 rounded-xs border cursor-pointer transition-colors text-xs ${
                      isChecked
                        ? 'border-ink bg-paper text-ink font-medium'
                        : 'border-hairline hover:border-hairline text-ink-2'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedRequiredTools(prev => [...prev, tool.key]);
                        } else {
                          setSelectedRequiredTools(prev => prev.filter(k => k !== tool.key));
                        }
                      }}
                      className="rounded-xs border-hairline text-ink focus:ring-0"
                    />
                    <span className="truncate">Require {tool.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>

        {message && (
          <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] rounded-xs text-xs flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-[#065F46] hover:opacity-75 font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Active Invitation Links List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-ink-2" />
            <h2 className="text-sm font-bold font-mono text-ink">
              Active Invitation Links
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-paper-raised text-ink-2 rounded-xs">
              {joinLinks.length}
            </span>
          </div>
        </div>

        {joinLinks.length === 0 ? (
          <div className="p-10 bg-surface border border-hairline rounded-xs text-center">
            <div className="w-12 h-12 rounded-full bg-paper border border-hairline flex items-center justify-center mx-auto mb-3 text-ink-3">
              <Link2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-ink">No active invitations</h3>
            <p className="text-xs text-ink-3 mt-1 max-w-sm mx-auto">
              Generate an invitation link above to allow employees to join your organization directly into a specified role.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {joinLinks.map(link => {
              const role = allRoles.find(r => r.id === link.roleId);
              const dept = allDepts.find(d => d.id === role?.deptId);
              const isCopied = copiedLinkId === link.id;
              const fullUrl = `${window.location.origin}/?join=${link.token}`;

              return (
                <div
                  key={link.id}
                  className="p-4 bg-surface border border-hairline rounded-xs shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink truncate">
                        {link.roleTitle || role?.title || 'Target Role'}
                      </span>
                      <span className="text-xs text-ink-3">
                        • {link.deptName || dept?.name || 'Department'}
                      </span>
                    </div>

                    {/* Required Integrations Badges */}
                    {link.requiredIntegrations && link.requiredIntegrations.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-mono text-ink-3">Requires:</span>
                        {link.requiredIntegrations.map(k => {
                          const tool = INTEGRATION_TOOLS.find(t => t.key === k);
                          return (
                            <span 
                              key={k} 
                              className="px-1.5 py-0.5 rounded-xs bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[11px] font-medium"
                            >
                              {tool?.name || k}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs font-mono text-ink-3">
                      <span className="truncate max-w-md bg-paper px-2 py-0.5 rounded-xs border border-hairline text-[11px]">
                        {fullUrl}
                      </span>
                      <span className="flex items-center gap-1 shrink-0 text-[11px]">
                        <Clock className="w-3 h-3" />
                        Expires: {new Date(link.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyLink(link)}
                      className={`px-3 py-1.5 rounded-xs text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isCopied
                          ? 'bg-[#10B981] text-white'
                          : 'bg-accent hover:bg-accent-strong text-white shadow-2xs'
                      }`}
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                    </button>

                    <button aria-label="Show QR Code"
                      onClick={() => setQrModalLink(link)}
                      className="p-1.5 text-ink-2 hover:text-ink hover:bg-paper-raised rounded-xs border border-hairline transition-colors cursor-pointer"
                      title="Show QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {qrModalLink && (
        <ModalOverlay onClose={() => setQrModalLink(null)} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-hairline rounded-xs p-6 max-w-sm w-full shadow-lg text-center space-y-4">
            <h3 className="text-base font-bold text-ink">
              Scan to Join {qrModalLink.roleTitle}
            </h3>
            <p className="text-xs text-ink-3">
              Scan this QR code with a mobile device to open the invitation link.
            </p>
            <div className="p-4 bg-paper border border-hairline rounded-xs flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `${window.location.origin}/?join=${qrModalLink.token}`
                )}`}
                alt="Join QR Code"
                className="w-44 h-44"
              />
            </div>
            <button
              onClick={() => setQrModalLink(null)}
              className="w-full py-2 bg-accent hover:bg-accent-strong text-white text-xs font-semibold rounded-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};
