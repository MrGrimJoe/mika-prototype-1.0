import React, { useState, useMemo, useRef } from 'react';
import { Department, Role, User, Assignment, ConfirmationMode, TaskAttachment, TaskMention } from '../types';
import { 
  CheckSquare, 
  X, 
  ShieldAlert, 
  Paperclip, 
  Upload, 
  Calendar, 
  FileText,
  FolderOpen,
  AtSign
} from 'lucide-react';
import { AuthorizationEngine } from '../lib/authorizationEngine';
import { canCreateTask, hasDirectAuthority } from '../lib/orgRules';
import { openGooglePicker } from '../lib/workspace';
import { MentionDropdown } from './MentionDropdown';
import { ModalOverlay } from './ui/ModalOverlay';

interface CreateTaskModalProps {
  currentUser: User;
  allDepts: Department[];
  allRoles: Role[];
  allUsers: User[];
  assignments?: Assignment[];
  authEngine?: AuthorizationEngine;
  masterRootUserId?: string;
  onClose: () => void;
  onCreateTask: (taskData: {
    title: string;
    description: string;
    deptId: string;
    targetRoleId: string;
    assignedToUserId: string;
    confirmationMode: ConfirmationMode;
    referenceFile?: TaskAttachment;
    dueDate?: string;
    requiresFileUpload?: boolean;
    mentions?: TaskMention[];
  }) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  currentUser,
  allDepts,
  allRoles,
  allUsers,
  assignments = [],
  masterRootUserId,
  onClose,
  onCreateTask
}) => {
  const authorizedDepts = useMemo(() => {
    return allDepts.filter(d => !d.isArchived && canCreateTask(currentUser.id, d.id, assignments, allRoles, allDepts, masterRootUserId));
  }, [currentUser.id, masterRootUserId, assignments, allRoles, allDepts]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Start on the first department that actually has a role you can assign to.
  const [selectedDeptId, setSelectedDeptId] = useState<string>(() => {
    const ownRoleIds = new Set(assignments.filter(a => a.userId === currentUser.id && a.isActive).map(a => a.roleId));
    const withTargets = authorizedDepts.find(d =>
      allRoles.some(r => r.deptId === d.id && !ownRoleIds.has(r.id) && hasDirectAuthority(currentUser.id, r.id, allDepts, allRoles, assignments, masterRootUserId).allowed)
    );
    return (withTargets || authorizedDepts[0])?.id || '';
  });
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  
  // Mentions State
  const [mentions, setMentions] = useState<TaskMention[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // B4: Confirmation Mode (file dropbox vs yes/no)
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('file');

  // B3: Reference File Context
  const [referenceFile, setReferenceFile] = useState<TaskAttachment | undefined>(undefined);

  const availableRoles = useMemo(() => {
    if (!selectedDeptId) return [];
    // You can't assign work to a role you hold yourself.
    const ownRoleIds = new Set(assignments.filter(a => a.userId === currentUser.id && a.isActive).map(a => a.roleId));
    return allRoles.filter(r => r.deptId === selectedDeptId && !ownRoleIds.has(r.id) && hasDirectAuthority(currentUser.id, r.id, allDepts, allRoles, assignments, masterRootUserId).allowed);
  }, [selectedDeptId, allRoles, currentUser.id, allDepts, assignments, masterRootUserId]);

  const availableMembers = useMemo(() => {
    // Only people who actually hold the chosen role (never the whole org).
    if (!selectedRoleId) return [];
    const roleMemberIds = new Set(
      assignments.filter(a => a.roleId === selectedRoleId && a.isActive).map(a => a.userId)
    );
    return allUsers.filter(u => roleMemberIds.has(u.id) && u.id !== currentUser.id);
  }, [selectedRoleId, assignments, allUsers, currentUser.id]);

  React.useEffect(() => {
    if (availableRoles.length > 0 && (!selectedRoleId || !availableRoles.some(r => r.id === selectedRoleId))) {
      setSelectedRoleId(availableRoles[0].id);
    }
  }, [availableRoles, selectedRoleId]);

  React.useEffect(() => {
    if (availableMembers.length > 0 && (!selectedUserId || !availableMembers.some(u => u.id === selectedUserId))) {
      setSelectedUserId(availableMembers[0].id);
    }
  }, [availableMembers, selectedUserId]);

  const handlePickFromDrive = () => {
    openGooglePicker((file) => {
      setReferenceFile({
        id: file.id,
        name: file.name,
        size: 'Drive Document',
        url: file.url,
        type: file.mimeType,
      });
    });
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setReferenceFile({
        id: `ref-${Date.now()}`,
        name: f.name,
        size: `${(f.size / 1024).toFixed(1)} KB`,
        url: URL.createObjectURL(f),
        type: f.type,
      });
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDescription(val);

    const cursor = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/@([a-zA-Z0-9_\-\.\/]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (item: TaskMention) => {
    const val = description;
    const cursor = textareaRef.current?.selectionStart || val.length;
    const beforeCursor = val.slice(0, cursor);
    const afterCursor = val.slice(cursor);
    const replacedBefore = beforeCursor.replace(/@([a-zA-Z0-9_\-\.\/]*)$/, `${item.displayName} `);
    setDescription(replacedBefore + afterCursor);
    setMentionQuery(null);

    if (!mentions.some(m => m.displayName === item.displayName)) {
      setMentions(prev => [...prev, item]);
    }
  };

  const handleRemoveMention = (displayName: string) => {
    setMentions(prev => prev.filter(m => m.displayName !== displayName));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedDeptId || !selectedRoleId) return;

    onCreateTask({
      title: title.trim(),
      description: description.trim(),
      deptId: selectedDeptId,
      targetRoleId: selectedRoleId || (availableRoles[0]?.id || ''),
      assignedToUserId: availableMembers.some(u => u.id === selectedUserId) ? selectedUserId : (availableMembers[0]?.id || ''),
      confirmationMode,
      referenceFile,
      dueDate: dueDate || undefined,
      requiresFileUpload: confirmationMode === 'file',
      mentions: mentions.length > 0 ? mentions : undefined
    });

    onClose();
  };

  if (authorizedDepts.length === 0) {
    return (
      <ModalOverlay onClose={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
        <div className="bg-surface rounded-xs shadow-2xl max-w-md w-full p-6 border border-hairline">
          <div className="flex items-center gap-2 text-st-pending mb-3">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-sm font-bold font-mono">
              Authority Required
            </h3>
          </div>
          <p className="text-xs text-ink-2 leading-relaxed mb-5">
            Only a department root or section root can create and assign tasks. You do not currently hold root authority over any department or section.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-accent hover:bg-accent-strong text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClose={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
      <div className="bg-surface rounded-xs shadow-2xl max-w-xl w-full p-6 border border-hairline max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-hairline mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-ink" />
            <h3 className="text-sm font-bold text-ink font-mono">
              Assign Authoritative Task
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-3 hover:text-ink rounded-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-xs text-ink-2 font-bold mb-1">
              Task Title:
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Submit Q1 Assessment Plan or Curriculum Draft"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-hairline rounded-xs bg-paper focus:bg-surface focus:outline-hidden focus:border-accent text-ink"
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-ink-2 font-bold">
                Description & Specifications:
              </label>
              <span className="text-xs text-slate-400 font-mono">
                Type <strong className="text-indigo-600">@</strong> to reference GitHub repos, Figma, Canva, or Docs
              </span>
            </div>
            <textarea
              ref={textareaRef}
              rows={3}
              placeholder="Specify required deliverables... Type @repo or @file to reference connected assets"
              value={description}
              onChange={handleDescriptionChange}
              className="w-full px-3 py-2 border border-hairline rounded-xs bg-paper focus:bg-surface focus:outline-hidden focus:border-accent text-ink"
            />

            {/* Mention Dropdown Popover */}
            {mentionQuery !== null && (
              <MentionDropdown
                query={mentionQuery}
                onSelect={handleSelectMention}
                onClose={() => setMentionQuery(null)}
              />
            )}

            {/* Referenced Mentions Chips */}
            {mentions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-bold text-slate-400 font-mono">Linked:</span>
                {mentions.map((m) => (
                  <span
                    key={m.displayName}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-xs font-mono rounded text-slate-800"
                  >
                    <span>{m.displayName}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMention(m.displayName)}
                      className="text-slate-400 hover:text-red-500 font-bold ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-2 font-bold mb-1">
                Authorized Department:
              </label>
              <select
                value={selectedDeptId}
                onChange={e => setSelectedDeptId(e.target.value)}
                className="w-full px-2.5 py-2 border border-hairline rounded-xs bg-paper text-ink focus:outline-hidden focus:border-accent cursor-pointer"
              >
                {authorizedDepts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-ink-2 font-bold mb-1">
                Target Role:
              </label>
              <select
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                className="w-full px-2.5 py-2 border border-hairline rounded-xs bg-paper text-ink focus:outline-hidden focus:border-accent cursor-pointer"
              >
                {availableRoles.length === 0 && (
                  <option value="">No role in this department you can assign to</option>
                )}
                {availableRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-2 font-bold mb-1">
                Assign to Member:
              </label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full px-2.5 py-2 border border-hairline rounded-xs bg-paper text-ink focus:outline-hidden focus:border-accent cursor-pointer"
              >
                {availableMembers.length === 0 && (
                  <option value="">Nobody holds this role yet (stays open for whoever joins)</option>
                )}
                {availableMembers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-ink-2 font-bold mb-1">
                Due Date (Google Calendar Sync):
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-2.5 py-2 border border-hairline rounded-xs bg-paper text-ink focus:outline-hidden focus:border-accent"
              />
            </div>
          </div>

          {/* B4: Confirmation Mode Selection */}
          <div className="pt-2">
            <label className="block text-xs text-ink-2 font-bold mb-2">
              Confirmation Mode (Creator Choice):
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`p-3 border rounded-xs cursor-pointer transition-all flex flex-col justify-between ${
                confirmationMode === 'file' 
                  ? 'border-accent bg-st-help-bg' 
                  : 'border-hairline bg-paper hover:bg-paper-raised'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="confirmationMode"
                    value="file"
                    checked={confirmationMode === 'file'}
                    onChange={() => setConfirmationMode('file')}
                    className="accent-accent"
                  />
                  <span className="font-bold text-ink text-xs">File Dropbox Mode</span>
                </div>
                <p className="text-xs text-ink-2 pl-5 leading-normal">
                  Assignee must submit a deliverable file before moving to review.
                </p>
              </label>

              <label className={`p-3 border rounded-xs cursor-pointer transition-all flex flex-col justify-between ${
                confirmationMode === 'yes_no' 
                  ? 'border-accent bg-st-help-bg' 
                  : 'border-hairline bg-paper hover:bg-paper-raised'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="confirmationMode"
                    value="yes_no"
                    checked={confirmationMode === 'yes_no'}
                    onChange={() => setConfirmationMode('yes_no')}
                    className="accent-accent"
                  />
                  <span className="font-bold text-ink text-xs">Yes/No Mode</span>
                </div>
                <p className="text-xs text-ink-2 pl-5 leading-normal">
                  Assignee marks task done with a single action, no file required.
                </p>
              </label>
            </div>
          </div>

          {/* B3: Reference File Context Attachment */}
          <div className="pt-2">
            <label className="block text-xs text-ink-2 font-bold mb-2">
              Reference Context File (Optional):
            </label>
            {referenceFile ? (
              <div className="p-3 bg-paper border border-hairline rounded-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-fg" />
                  <span className="text-xs text-ink font-bold">{referenceFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReferenceFile(undefined)}
                  className="text-xs text-st-pending hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper hover:bg-paper-raised border border-hairline rounded-xs cursor-pointer text-xs font-mono text-ink">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Attach File</span>
                  <input
                    type="file"
                    onChange={handleLocalFileSelect}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handlePickFromDrive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-paper hover:bg-paper-raised border border-hairline rounded-xs cursor-pointer text-xs font-mono text-accent-fg"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Pick from Google Drive</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-ink-2 hover:text-ink rounded-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !selectedRoleId}
              title={!selectedRoleId ? 'Pick a department that has a role you can assign to' : undefined}
              className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed bg-accent hover:bg-accent-strong text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer shadow-xs"
            >
              Assign Deliverable
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};
