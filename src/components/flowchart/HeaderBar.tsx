import React, { useState } from 'react';
import { TreeStats, PaperStyle, Section, DepartmentNode } from './flowchartTypes';
import { HelpCircle, RotateCcw, Printer, Layers, MessageSquare } from 'lucide-react';
import { AssistanceModal } from './AssistanceModal';
import { GuidanceModal } from './GuidanceModal';
import { ResetConfirmModal } from './ResetConfirmModal';

interface HeaderBarProps {
  stats: TreeStats;
  sections: Section[];
  paperStyle: PaperStyle;
  isSelectionActive: boolean;
  selectedCount: number;
  onPaperStyleChange: (style: PaperStyle) => void;
  onOpenSectionsManager: () => void;
  onClearSelection: () => void;
  onReset: () => void;
  onApplyStructure?: (tree: DepartmentNode, sections: Section[]) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  stats,
  sections,
  paperStyle,
  isSelectionActive,
  selectedCount,
  onPaperStyleChange,
  onOpenSectionsManager,
  onClearSelection,
  onReset,
  onApplyStructure,
}) => {
  const [showAssistance, setShowAssistance] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <header
      id="app-header-bar"
      className="w-full bg-[#f6f5f0] border-b-2 border-neutral-900 px-5 py-2.5 flex flex-wrap items-center justify-between gap-4 select-none z-20 shadow-xs"
    >
      {/* Title & Branding */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-[#1C2438] text-white flex items-center justify-center rounded-xs font-mono font-bold text-xs shadow-[2px_2px_0px_#2F3B7A]">
          MK
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-neutral-900 font-sans">
              Mika Organizational Flowchart
            </h1>
            <span className="font-mono text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-xs">
              Mika Standard
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono">
            Recursive Departments • Section Groupings • Anchored Primary Root
          </p>
        </div>
      </div>

      {/* Center: Live Stats Counters with Lively Colored Status Badges */}
      <div
        id="stats-counters"
        className="hidden md:flex items-center gap-2 text-xs font-mono bg-white border border-neutral-300 rounded-xs px-2.5 py-1 shadow-xs"
      >
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-[10px] uppercase text-neutral-500 font-semibold">Depts:</span>
          <span className="font-bold text-neutral-900">{stats.totalDepartments}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          <span className="text-[10px] uppercase text-neutral-500 font-semibold">Sections:</span>
          <span className="font-bold text-neutral-900">{stats.totalSections}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          <span className="text-[10px] uppercase text-neutral-500 font-semibold">Roots:</span>
          <span className="font-bold text-neutral-900">{stats.totalRoots}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
          <span className="text-[10px] uppercase text-neutral-500 font-semibold">Roles:</span>
          <span className="font-bold text-neutral-900">{stats.totalRoles}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="text-[10px] uppercase text-neutral-500 font-semibold">Tiers:</span>
          <span className="font-bold text-neutral-900">{stats.maxDepth}</span>
        </div>
      </div>

      {/* Right: Section Manager & Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Assistance Button - Named "Assistance", Green with Hover and Pulse */}
        <button
          type="button"
          id="call-assistance-top-btn"
          onClick={() => setShowAssistance(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-mono text-xs font-semibold rounded-xs shadow-[2px_2px_0px_#064e3b] transition-all cursor-pointer hover:-translate-y-0.5"
          title="Connect with an employee to build your organization for free on the spot"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
          </span>
          <MessageSquare size={13} className="text-white" />
          <span>Assistance</span>
        </button>

        {/* Sections Manager Drawer Button */}
        <button
          type="button"
          id="manage-sections-btn"
          onClick={onOpenSectionsManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-400 hover:border-neutral-900 rounded-xs shadow-[1.5px_1.5px_0px_#27272a] text-xs font-mono transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Manage grouped sections"
        >
          <Layers size={13} className="text-neutral-700" />
          <span>Sections ({sections.length})</span>
        </button>

        {/* Paper Style Selector */}
        <div className="hidden sm:flex items-center bg-white border border-neutral-400 rounded-xs p-0.5 text-[11px] font-mono shadow-[1px_1px_0px_#27272a]">
          <button
            type="button"
            id="style-grid-btn"
            onClick={() => onPaperStyleChange('grid')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'grid'
                ? 'bg-[#1C2438] text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Graph Grid"
          >
            Grid
          </button>
          <button
            type="button"
            id="style-dots-btn"
            onClick={() => onPaperStyleChange('dots')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'dots'
                ? 'bg-[#1C2438] text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Dot Matrix"
          >
            Dots
          </button>
          <button
            type="button"
            id="style-ledger-btn"
            onClick={() => onPaperStyleChange('ledger')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'ledger'
                ? 'bg-[#1C2438] text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Lined Ledger"
          >
            Ledger
          </button>
          <button
            type="button"
            id="style-clean-btn"
            onClick={() => onPaperStyleChange('clean')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'clean'
                ? 'bg-[#1C2438] text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Clean Paper"
          >
            Plain
          </button>
        </div>

        {/* Print Button */}
        <button
          type="button"
          id="print-diagram-btn"
          onClick={() => window.print()}
          className="p-1.5 bg-white hover:bg-neutral-100 text-neutral-700 hover:text-neutral-950 border border-neutral-400 rounded-xs shadow-[1px_1px_0px_#27272a] transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Print or Export PDF"
        >
          <Printer size={14} />
        </button>

        {/* Reset Button (Triggers custom confirmation dialog) */}
        <button
          type="button"
          id="reset-diagram-btn"
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-rose-50 text-neutral-700 hover:text-rose-700 border border-neutral-400 hover:border-rose-400 rounded-xs shadow-[1px_1px_0px_#27272a] text-xs font-mono transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Clear diagram and reset to primary department"
        >
          <RotateCcw size={12} />
          <span className="hidden lg:inline">Reset</span>
        </button>

        {/* Guidance / Help Button */}
        <button
          type="button"
          id="help-guidance-btn"
          onClick={() => setShowGuidance(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xs shadow-[1.5px_1.5px_0px_#71717a] text-xs font-mono transition-all hover:-translate-y-0.5 cursor-pointer"
          title="View organizational specification and visual guide"
        >
          <HelpCircle size={13} className="text-neutral-300" />
          <span>Guide</span>
        </button>
      </div>

      {/* Assistance Modal (Name Input -> Chat UI) */}
      <AssistanceModal
        isOpen={showAssistance}
        onClose={() => setShowAssistance(false)}
        onApplyStructure={onApplyStructure}
      />

      {/* Guide Modal */}
      <GuidanceModal
        isOpen={showGuidance}
        onClose={() => setShowGuidance(false)}
      />

      {/* In-app Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          onReset();
          setShowResetConfirm(false);
        }}
      />
    </header>
  );
};
