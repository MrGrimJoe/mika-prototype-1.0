import React, { useState, useRef, useEffect } from 'react';
import { 
  Task, 
  User, 
  Role, 
  Department, 
  Comment, 
  TaskStatus, 
  TaskAttachment,
  SubmissionEvidence,
  TaskMention
} from '../types';
import { 
  ArrowLeft, 
  HelpCircle, 
  Calendar as CalendarIcon, 
  Clock, 
  User as UserIcon, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Upload, 
  Download, 
  Send, 
  Star, 
  ShieldCheck, 
  Paperclip, 
  ExternalLink,
  AlertTriangle,
  Keyboard,
  Github,
  Figma,
  Layers,
  Copy,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Badge, Button } from './ui';
import { taskStateColors, colors, typography } from '../lib/designSystem';

interface TaskFullPageViewProps {
  task: Task;
  currentUser: User;
  allUsers: User[];
  allRoles: Role[];
  allDepts: Department[];
  comments: Comment[];
  hasAuthorityToReview: boolean;
  onBack: () => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus, reason?: string) => void;
  onAddComment: (taskId: string, content: string, isHelp?: boolean) => void;
  onFileUpload: (taskId: string, file: File) => void;
  onRateTask?: (taskId: string, score: number, comment: string, isAnonymous: boolean) => void;
  onViewProfile?: (user: User) => void;
  onUpdateTask?: (updatedTask: Task) => void;
}

export const TaskFullPageView: React.FC<TaskFullPageViewProps> = ({
  task,
  currentUser,
  allUsers,
  allRoles,
  allDepts,
  comments,
  hasAuthorityToReview,
  onBack,
  onStatusChange,
  onAddComment,
  onFileUpload,
  onRateTask,
  onViewProfile,
  onUpdateTask
}) => {
  const [commentText, setCommentText] = useState('');
  const [denialModalOpen, setDenialModalOpen] = useState(false);
  const [denialReason, setDenialReason] = useState('');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [isAnonymousRating, setIsAnonymousRating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Integration & Confirmation states
  const [confirmationInputText, setConfirmationInputText] = useState(task.confirmationText || '');
  const [showUserscriptModal, setShowUserscriptModal] = useState(false);
  const [isActiveForShortcut, setIsActiveForShortcut] = useState(() => {
    return localStorage.getItem('mika_active_task_id') === task.id;
  });
  const [isCopiedShortcut, setIsCopiedShortcut] = useState(false);
  const [isExportingFigma, setIsExportingFigma] = useState(false);
  const [isExportingCanva, setIsExportingCanva] = useState(false);

  // Global Ctrl+Alt+M Keyboard Shortcut Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleSubmitShortcut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [task.id, onStatusChange, onAddComment]);

  const handleSetActiveTask = () => {
    localStorage.setItem('mika_active_task_id', task.id);
    localStorage.setItem('mika_session_token', currentUser.id);
    setIsActiveForShortcut(true);
    setIsCopiedShortcut(true);
    setTimeout(() => setIsCopiedShortcut(false), 2500);
    confetti({ particleCount: 25, spread: 45 });
  };

  const handleSubmitShortcut = () => {
    const evidence: SubmissionEvidence = {
      source: 'keyboard-shortcut',
      host: window.location.hostname,
      url: window.location.href,
      capturedAt: new Date().toISOString()
    };
    
    if (onUpdateTask) {
      onUpdateTask({
        ...task,
        status: 'submitted',
        submissionEvidence: evidence
      });
    } else {
      onStatusChange(task.id, 'submitted');
    }

    onAddComment(
      task.id,
      `Captured deliverable confirmation via Ctrl+Alt+M shortcut from ${window.location.hostname}.`
    );
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
  };

  const handleSaveConfirmationText = () => {
    if (!confirmationInputText.trim()) return;
    if (onUpdateTask) {
      onUpdateTask({
        ...task,
        confirmationText: confirmationInputText.trim(),
        status: 'submitted'
      });
    } else {
      onStatusChange(task.id, 'submitted');
    }

    onAddComment(
      task.id,
      `Plain text response submitted: "${confirmationInputText.trim()}"`
    );
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleFigmaExport = async () => {
    setIsExportingFigma(true);
    try {
      const res = await fetch('/api/integrations/figma/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          fileKey: 'fig_brand_v1',
          frameId: '0-1',
          exportType: 'preview_link'
        })
      });
      const data = await res.json();
      if (onUpdateTask) {
        onUpdateTask({
          ...task,
          status: 'submitted',
          submissionEvidence: data.evidence
        });
      } else {
        onStatusChange(task.id, 'submitted');
      }
      onAddComment(task.id, `Imported verified Figma design frame deliverable.`);
      confetti({ particleCount: 45, spread: 60 });
    } catch (err) {
      console.warn('Figma export failed:', err);
    } finally {
      setIsExportingFigma(false);
    }
  };

  const handleCanvaExport = async () => {
    setIsExportingCanva(true);
    try {
      const res = await fetch('/api/integrations/canva/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          designId: 'canva_pres_q3'
        })
      });
      const data = await res.json();
      if (onUpdateTask) {
        onUpdateTask({
          ...task,
          status: 'submitted',
          submissionEvidence: data.evidence
        });
      } else {
        onStatusChange(task.id, 'submitted');
      }
      onAddComment(task.id, `Imported verified Canva presentation deliverable.`);
      confetti({ particleCount: 45, spread: 60 });
    } catch (err) {
      console.warn('Canva export failed:', err);
    } finally {
      setIsExportingCanva(false);
    }
  };

  const assigner = allUsers.find(u => u.id === task.assignedByUserId);
  const assignee = allUsers.find(u => u.id === task.assignedToUserId);
  const targetRole = allRoles.find(r => r.id === task.assignedToRoleId);
  const department = allDepts.find(d => d.id === task.deptId);
  const taskComments = comments.filter(c => c.taskId === task.id);

  const statusConfig = taskStateColors[task.status] || taskStateColors.pending;

  // B2: Help Button behavior (turns task Blue, notifies creator, posts help notice)
  const handleHelpClick = () => {
    onStatusChange(task.id, 'help');
    onAddComment(
      task.id,
      `🚨 Help requested by ${currentUser.fullName} (${currentUser.preferredName}). Creator has been notified.`,
      true
    );
  };

  // Submit via Yes/No (Mode 2) -> Moves task to submitted (Yellow)
  const handleMarkDoneYesNo = () => {
    onStatusChange(task.id, 'submitted');
    onAddComment(
      task.id,
      `Action completed by ${currentUser.fullName}. Submitted for review.`
    );
  };

  // Review approval (Green)
  const handleApprove = () => {
    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.6 }
    });
    onStatusChange(task.id, 'done');
    onAddComment(
      task.id,
      `Approved by ${currentUser.fullName}. Assignment completed.`
    );
    if (onRateTask && ratingScore > 0) {
      onRateTask(task.id, ratingScore, ratingComment, isAnonymousRating);
    }
  };

  // Review denial (Red)
  const handleConfirmDenial = () => {
    if (!denialReason.trim()) return;
    onStatusChange(task.id, 'rejected', denialReason.trim());
    onAddComment(
      task.id,
      `Denied by ${currentUser.fullName}: ${denialReason.trim()}`
    );
    setDenialModalOpen(false);
    setDenialReason('');
  };

  // Deliverable file upload (Mode 1)
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(task.id, e.dataTransfer.files[0]);
    }
  };

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(task.id, e.target.files[0]);
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(task.id, commentText.trim());
    setCommentText('');
  };

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1C2438] pb-16 font-sans">
      {/* Top sticky navigation bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#DAD5C9] px-4 md:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#5C574B] hover:text-[#1C2438] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tasks</span>
          </button>

          {/* B2: Help Button Fixed at Top Right & Global Shortcut Controls */}
          <div className="flex items-center gap-3">
            {/* Global Shortcut Active Toggle */}
            <button
              id="btn-set-active-task"
              onClick={handleSetActiveTask}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-mono font-bold uppercase tracking-wider transition-all border shadow-xs cursor-pointer ${
                isActiveForShortcut 
                  ? 'bg-amber-50 text-amber-900 border-amber-300' 
                  : 'bg-white text-slate-700 border-[#DAD5C9] hover:bg-[#F7F5F0]'
              }`}
              title="Set this task as the target for Ctrl+Alt+M shortcut across any browser tab"
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-600" />
              <span>{isCopiedShortcut ? 'Active (Ctrl+Alt+M)' : isActiveForShortcut ? 'Shortcut Active' : 'Set Active (Ctrl+Alt+M)'}</span>
            </button>

            {/* Tampermonkey userscript modal trigger */}
            <button
              onClick={() => setShowUserscriptModal(true)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xs hover:bg-slate-100 transition"
              title="Userscript Shortcut Instructions"
            >
              <Info className="w-4 h-4" />
            </button>

            {task.status === 'help' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-xs text-xs font-mono font-bold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4" />
                Help Requested (Assigner Notified)
              </span>
            ) : task.status !== 'done' && (
              <button
                id="btn-task-help-topright"
                onClick={handleHelpClick}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xs text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                title="Request help and notify assigner"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Need Help</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-8 space-y-6">
        {/* Main Task Header Card */}
        <div className="bg-white border border-[#DAD5C9] rounded-xs p-6 md:p-8 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Status Badge per B7 */}
            <Badge
              variant={task.status as any}
              className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-1"
            >
              <span 
                className="w-2 h-2 rounded-full mr-1.5 inline-block" 
                style={{ backgroundColor: statusConfig.dot }} 
              />
              {statusConfig.label}
            </Badge>

            {department && (
              <span className="px-2.5 py-1 bg-[#F7F5F0] border border-[#DAD5C9] text-xs font-mono text-[#5C574B] rounded-xs">
                Dept: {department.name}
              </span>
            )}

            {targetRole && (
              <span className="px-2.5 py-1 bg-[#F7F5F0] border border-[#DAD5C9] text-xs font-mono text-[#5C574B] rounded-xs">
                Role: {targetRole.title}
              </span>
            )}

            {/* B5: Google Calendar Sync Indicator */}
            {(task.isCalendarSynced || task.calendarEventId) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] text-xs font-mono rounded-xs">
                <CalendarIcon className="w-3.5 h-3.5" />
                Synced to Google Calendar
              </span>
            )}

            {task.dueDate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F5F0] text-[#5C574B] border border-[#DAD5C9] text-xs font-mono rounded-xs">
                <Clock className="w-3.5 h-3.5" />
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>

          <h1 
            className="text-2xl md:text-3xl font-bold tracking-tight text-[#1C2438] mb-4"
            style={{ fontFamily: typography.fontSerif }}
          >
            {task.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#5C574B] pt-4 border-t border-[#DAD5C9]">
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase text-[#8A8578]">Assigned by:</span>
              <span className="font-bold text-[#1C2438]">{assigner?.fullName || 'Root Authority'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase text-[#8A8578]">Assignee:</span>
              <span className="font-bold text-[#1C2438]">{assignee?.fullName || targetRole?.title || 'Department Staff'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase text-[#8A8578]">Created:</span>
              <span>{new Date(task.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* B3: Reference File Attachment Section */}
        {task.referenceFile && (
          <div className="bg-white border border-[#DAD5C9] rounded-xs p-5 shadow-xs">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#5C574B] mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#2F3B7A]" />
              Reference Context File (From Assigner)
            </h3>
            <div className="flex items-center justify-between p-3 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#2F3B7A]" />
                <div>
                  <p className="text-xs font-bold text-[#1C2438] font-mono">{task.referenceFile.name}</p>
                  <p className="text-[11px] text-[#8A8578] font-mono">{task.referenceFile.size || 'Attached File'}</p>
                </div>
              </div>
              {task.referenceFile.url && (
                <a
                  href={task.referenceFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#EFEBE2] border border-[#DAD5C9] text-xs font-mono font-bold text-[#1C2438] rounded-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Reference</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Description & Objective Card */}
        <div className="bg-white border border-[#DAD5C9] rounded-xs p-6 md:p-8 shadow-xs">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A8578] mb-3">
            Task Description & Specifications
          </h3>
          <div className="text-sm leading-relaxed text-[#1C2438] whitespace-pre-wrap">
            {task.description || 'No detailed instructions provided.'}
          </div>

          {/* Connected Mentions Chips (GitHub repos/files, Figma, Canva, Drive) */}
          {task.mentions && task.mentions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#DAD5C9]">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8A8578] mb-2 flex items-center gap-1.5">
                <span>Referenced Assets & Repositories</span>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                  {task.mentions.length}
                </span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {task.mentions.map((m, idx) => (
                  <a
                    key={idx}
                    href={m.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-xs font-mono rounded-md text-slate-800 transition"
                  >
                    {m.type.includes('github') ? (
                      <Github className="w-3.5 h-3.5 text-slate-800" />
                    ) : m.type === 'figma_file' ? (
                      <Figma className="w-3.5 h-3.5 text-purple-600" />
                    ) : m.type === 'canva_design' ? (
                      <Layers className="w-3.5 h-3.5 text-cyan-600" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span>{m.displayName}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Submission Evidence details if captured */}
          {task.submissionEvidence && (
            <div className="mt-4 p-3 bg-indigo-50/70 border border-indigo-100 rounded-md text-xs font-mono">
              <div className="flex items-center gap-1.5 text-indigo-900 font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Verified Integration Evidence Captured</span>
              </div>
              <div className="text-slate-600 space-y-0.5 text-[11px]">
                <div><span className="text-slate-400">Source:</span> {task.submissionEvidence.source}</div>
                {task.submissionEvidence.host && (
                  <div><span className="text-slate-400">Origin Host:</span> {task.submissionEvidence.host}</div>
                )}
                {task.submissionEvidence.commitHash && (
                  <div><span className="text-slate-400">Git Commit:</span> {task.submissionEvidence.commitHash} ({task.submissionEvidence.branch})</div>
                )}
                {task.submissionEvidence.url && (
                  <div>
                    <span className="text-slate-400">Captured URL:</span>{' '}
                    <a href={task.submissionEvidence.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline truncate inline-block max-w-sm align-bottom">
                      {task.submissionEvidence.url}
                    </a>
                  </div>
                )}
                {task.submissionEvidence.capturedAt && (
                  <div><span className="text-slate-400">Timestamp:</span> {new Date(task.submissionEvidence.capturedAt).toLocaleString()}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* B4 & B8: Deliverable / Confirmation Section */}
        <div className="bg-white border border-[#DAD5C9] rounded-xs p-6 md:p-8 shadow-xs">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A8578] mb-4 flex items-center justify-between">
            <span>Confirmation & Completion Status</span>
            <span className="font-normal normal-case text-xs text-[#5C574B]">
              Mode: {task.confirmationMode === 'yes_no' ? 'Yes/No Confirmation' : 'File Dropbox Confirmation'}
            </span>
          </h3>

          {/* Section 0.3: Plain-Text Response Field (Always available for quick explanations) */}
          <div className="mb-5 pb-5 border-b border-[#DAD5C9]">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#5C574B] mb-1.5">
              Deliverable Summary / Plain Text Response:
            </label>
            {task.confirmationText ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xs text-xs text-slate-800">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold font-mono mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Submitted Text Response:</span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{task.confirmationText}</p>
              </div>
            ) : task.status !== 'done' ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={confirmationInputText}
                  onChange={(e) => setConfirmationInputText(e.target.value)}
                  placeholder="Provide a written summary, resolution notes, or plain-text response..."
                  className="w-full p-2.5 text-xs border border-[#DAD5C9] bg-[#F7F5F0] focus:bg-white rounded-xs focus:outline-hidden font-sans"
                />
                <button
                  type="button"
                  id="btn-submit-confirmation-text"
                  onClick={handleSaveConfirmationText}
                  disabled={!confirmationInputText.trim()}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs disabled:opacity-40 transition cursor-pointer"
                >
                  Save & Submit Text Response
                </button>
              </div>
            ) : null}
          </div>

          {/* Connected Design Tools Quick-Export Bar */}
          {task.status !== 'done' && (
            <div className="mb-5 p-3.5 bg-slate-50 border border-slate-200 rounded-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700">
                  Quick Export from Design Integrations
                </span>
                <span className="text-[10px] text-slate-400 font-mono">1-Click Deliverable Capture</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  id="btn-export-figma"
                  onClick={handleFigmaExport}
                  disabled={isExportingFigma}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-purple-700 text-xs font-mono font-bold rounded-xs transition cursor-pointer"
                >
                  <Figma className="w-3.5 h-3.5" />
                  <span>{isExportingFigma ? 'Exporting...' : 'Export from Figma Frame'}</span>
                </button>

                <button
                  type="button"
                  id="btn-export-canva"
                  onClick={handleCanvaExport}
                  disabled={isExportingCanva}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 text-cyan-700 text-xs font-mono font-bold rounded-xs transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isExportingCanva ? 'Exporting...' : 'Export from Canva Design'}</span>
                </button>

                <button
                  type="button"
                  id="btn-trigger-shortcut-submit"
                  onClick={handleSubmitShortcut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-amber-800 text-xs font-mono font-bold rounded-xs transition cursor-pointer"
                >
                  <Keyboard className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulate Ctrl+Alt+M Shortcut</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode 1: File Dropbox */}
          {task.confirmationMode !== 'yes_no' && (
            <div className="space-y-4">
              {task.confirmationFile ? (
                <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                    <div>
                      <p className="text-xs font-bold text-[#16A34A] font-mono">Deliverable File Submitted</p>
                      <p className="text-xs text-[#1C2438]">{task.confirmationFile.name}</p>
                    </div>
                  </div>
                  {task.confirmationFile.url && (
                    <a
                      href={task.confirmationFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BBF7D0] text-xs font-mono text-[#16A34A] rounded-xs hover:bg-[#F0FDF4]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              ) : task.status !== 'done' ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropFile}
                  className={`border-2 border-dashed rounded-xs p-8 text-center transition-colors ${
                    isDragging ? 'border-[#2F3B7A] bg-[#EFF6FF]' : 'border-[#DAD5C9] bg-[#F7F5F0]'
                  }`}
                >
                  <Upload className="w-8 h-8 mx-auto text-[#8A8578] mb-2" />
                  <p className="text-xs font-bold font-mono uppercase text-[#1C2438] mb-1">
                    Drop Deliverable File Here
                  </p>
                  <p className="text-xs text-[#8A8578] mb-4">
                    Attach required deliverable to submit task for authority review
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleSelectFile}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white hover:bg-[#EFEBE2] border border-[#DAD5C9] text-xs font-mono font-bold text-[#1C2438] rounded-xs cursor-pointer shadow-xs"
                  >
                    Select File from Device
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Mode 2: Yes/No Confirmation */}
          {task.confirmationMode === 'yes_no' && (
            <div className="space-y-4">
              {task.status === 'pending' || task.status === 'help' || task.status === 'rejected' ? (
                <div className="p-4 bg-[#F7F5F0] border border-[#DAD5C9] rounded-xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold font-mono uppercase text-[#1C2438]">Ready to submit?</p>
                    <p className="text-xs text-[#8A8578]">Tap Mark Done to alert root authority for review.</p>
                  </div>
                  <button
                    id="btn-mark-done-yesno"
                    onClick={handleMarkDoneYesNo}
                    className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer shadow-xs transition-colors"
                  >
                    Mark Done
                  </button>
                </div>
              ) : task.status === 'submitted' ? (
                <div className="p-4 bg-[#FEFCE8] border border-[#FEF08A] rounded-xs flex items-center gap-3 text-[#CA8A04]">
                  <Clock className="w-5 h-5" />
                  <div>
                    <p className="text-xs font-bold font-mono uppercase">Submitted — Awaiting Review</p>
                    <p className="text-xs text-[#854D0E]">Assignment marked done. Awaiting root authority decision.</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Denied status notice */}
          {task.status === 'rejected' && task.rejectionReason && (
            <div className="mt-4 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xs flex items-start gap-3 text-[#DC2626]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold font-mono uppercase">Task Denied by Root Authority</p>
                <p className="text-xs text-[#991B1B] mt-1">{task.rejectionReason}</p>
                <p className="text-[11px] text-[#B91C1C] mt-2 font-mono">
                  Please revise your work and resubmit when ready.
                </p>
              </div>
            </div>
          )}

          {/* B8: Root Review Decision Controls (Pass / Deny) */}
          {hasAuthorityToReview && task.status === 'submitted' && (
            <div className="mt-6 pt-6 border-t border-[#DAD5C9] bg-[#F7F5F0] p-4 rounded-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C2438] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2F3B7A]" />
                  Root Authority Review Actions
                </span>
                <span className="text-[11px] font-mono text-[#8A8578]">Decision Required</span>
              </div>

              {/* Submitted deliverable summary for reviewer */}
              {(task.confirmationText || task.submissionEvidence || task.confirmationFile) && (
                <div className="mb-4 p-3 bg-white border border-[#DAD5C9] rounded-xs text-xs space-y-2">
                  <div className="font-mono font-bold uppercase tracking-wider text-[11px] text-[#5C574B]">
                    Submitted Deliverables for Inspection:
                  </div>
                  {task.confirmationText && (
                    <div className="p-2 bg-[#F7F5F0] rounded border border-slate-200">
                      <span className="font-bold text-slate-700">Assignee Text Response:</span>
                      <p className="mt-1 text-slate-800 whitespace-pre-wrap">{task.confirmationText}</p>
                    </div>
                  )}
                  {task.submissionEvidence && (
                    <div className="p-2 bg-indigo-50/60 rounded border border-indigo-200 text-indigo-900 flex items-center justify-between">
                      <div>
                        <span className="font-bold">Verified Evidence:</span> {task.submissionEvidence.source} ({task.submissionEvidence.host || 'web'})
                      </div>
                      {task.submissionEvidence.url && (
                        <a href={task.submissionEvidence.url} target="_blank" rel="noreferrer" className="underline font-medium text-[11px]">
                          View External Source ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Star rating picker for root */}
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-[#5C574B] font-mono">Execution Score:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingScore(star)}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= ratingScore ? 'fill-[#EAB308] text-[#EAB308]' : 'text-[#DAD5C9]'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  id="btn-approve-task"
                  onClick={handleApprove}
                  className="flex-1 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Pass / Approve Task</span>
                </button>

                <button
                  id="btn-deny-task"
                  onClick={() => setDenialModalOpen(true)}
                  className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Deny Task</span>
                </button>
              </div>
            </div>
          )}

          {/* Approved notice */}
          {task.status === 'done' && (
            <div className="mt-4 p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xs flex items-center gap-3 text-[#16A34A]">
              <CheckCircle2 className="w-5 h-5" />
              <div>
                <p className="text-xs font-bold font-mono uppercase">Approved and Completed</p>
                <p className="text-xs text-[#15803D]">Root authority reviewed and approved this assignment.</p>
              </div>
            </div>
          )}
        </div>

        {/* Comments & Discussion Thread */}
        <div className="bg-white border border-[#DAD5C9] rounded-xs p-6 md:p-8 shadow-xs">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A8578] mb-4">
            Activity & Comment Thread ({taskComments.length})
          </h3>

          <div className="space-y-3 mb-6">
            {taskComments.length > 0 ? (
              taskComments.map((comment) => (
                <div 
                  key={comment.id}
                  className={`p-3 rounded-xs border ${
                    comment.isHelpNotice 
                      ? 'bg-[#EFF6FF] border-[#BFDBFE] text-[#1E40AF]' 
                      : 'bg-[#F7F5F0] border-[#DAD5C9] text-[#1C2438]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#8A8578] mb-1">
                    <span className="font-bold text-[#1C2438]">{comment.authorName}</span>
                    <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs leading-relaxed">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#8A8578] italic font-mono">No comments on this assignment yet.</p>
            )}
          </div>

          {/* Add comment box */}
          <form onSubmit={handleSendComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Post a follow-up or reply..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-[#DAD5C9] bg-[#F7F5F0] focus:bg-white rounded-xs focus:outline-hidden font-sans"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="px-4 py-2 bg-[#1C2438] hover:bg-[#12151C] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs cursor-pointer disabled:opacity-40 flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Denial Reason Modal */}
      {denialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DAD5C9] rounded-xs max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#DC2626] mb-2 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              State Reason for Denial
            </h3>
            <p className="text-xs text-[#5C574B] mb-4">
              Explain why this assignment is denied. The assignee will be alerted and invited to address issues.
            </p>
            <textarea
              rows={4}
              value={denialReason}
              onChange={(e) => setDenialReason(e.target.value)}
              placeholder="Provide specific feedback..."
              className="w-full p-3 text-xs border border-[#DAD5C9] rounded-xs mb-4 focus:outline-hidden font-sans"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDenialModalOpen(false)}
                className="px-3 py-1.5 border border-[#DAD5C9] text-xs font-mono text-[#5C574B] rounded-xs hover:bg-[#F7F5F0] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDenial}
                disabled={!denialReason.trim()}
                className="px-4 py-1.5 bg-[#DC2626] text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xs hover:bg-[#B91C1C] cursor-pointer disabled:opacity-40"
              >
                Confirm Denial
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Userscript Shortcut Modal (Section 0.2) */}
      {showUserscriptModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DAD5C9] rounded-xs max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#DAD5C9] mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-900">
                  Global Task Shortcut (Ctrl+Alt+M)
                </h3>
              </div>
              <button 
                onClick={() => setShowUserscriptModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 font-sans">
              <p>
                Submit deliverables directly from whatever tab you are working in (Figma, Canva, Google Docs, Sheets, or GitHub) with a single global keystroke:
              </p>
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] space-y-1.5">
                <div className="font-bold text-slate-900">How it works:</div>
                <div>1. Click <strong className="text-amber-700">Set Active (Ctrl+Alt+M)</strong> on this task.</div>
                <div>2. Switch to your work in Figma, Canva, or Google Docs.</div>
                <div>3. Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-2xs font-bold text-slate-900">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-2xs font-bold text-slate-900">Alt</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-2xs font-bold text-slate-900">M</kbd>.</div>
                <div>4. Mika captures the active URL & metadata and submits the deliverable!</div>
              </div>

              <div className="pt-2">
                <div className="font-bold text-slate-800 mb-1 font-mono text-[11px] uppercase">
                  Install Browser Userscript:
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Requires Tampermonkey, Violentmonkey, or Violent Chrome extension. Click below to install with 1 click:
                </p>
                <a
                  href="/userscript/mika-submit.user.js"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-mono font-bold transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Mika Userscript (.user.js)</span>
                </a>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[#DAD5C9] flex justify-end">
              <button
                onClick={() => setShowUserscriptModal(false)}
                className="px-4 py-1.5 bg-[#1C2438] text-white text-xs font-mono font-bold uppercase rounded-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
