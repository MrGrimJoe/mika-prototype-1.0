import React, { useState } from 'react';
import { TreeStats, PaperStyle, Section, DepartmentNode } from './flowchartTypes';
import { HelpCircle, RotateCcw, Printer, Layers, MessageSquare } from 'lucide-react';
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
}) => {
  const [showGuidance, setShowGuidance] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <header
      id="app-header-bar"
      className="w-full bg-paper border-b-2 border-neutral-900 px-5 py-2.5 flex flex-wrap items-center justify-between gap-4 select-none z-20 shadow-xs"
    >
      {/* Title & Branding */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-accent text-white flex items-center justify-center rounded-xs font-semibold text-xs shadow-[2px_2px_0px_#2F3B7A]">
          MK
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-neutral-900 font-sans">
              Mika Organizational Flowchart
            </h1>
            <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-xs">
              Mika Standard
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-mono">
            Recursive Departments • Section Groupings • Anchored Primary Root
          </p>
        </div>
      </div>

      {/* Center: Live Stats Counters with Lively Colored Status Badges */}
      <div
        id="stats-counters"
        className="hidden md:flex items-center gap-2 text-xs font-mono bg-surface border border-neutral-300 rounded-xs px-2.5 py-1 shadow-xs"
      >
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-xs text-neutral-500 font-semibold">Depts:</span>
          <span className="font-bold text-neutral-900">{stats.totalDepartments}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          <span className="text-xs text-neutral-500 font-semibold">Sections:</span>
          <span className="font-bold text-neutral-900">{stats.totalSections}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          <span className="text-xs text-neutral-500 font-semibold">Roots:</span>
          <span className="font-bold text-neutral-900">{stats.totalRoots}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
          <span className="text-xs text-neutral-500 font-semibold">Roles:</span>
          <span className="font-bold text-neutral-900">{stats.totalRoles}</span>
        </div>
        <span className="text-neutral-200">|</span>
        <div className="flex items-center gap-1.5 text-neutral-800">
          <span className="text-xs text-neutral-500 font-semibold">Tiers:</span>
          <span className="font-bold text-neutral-900">{stats.maxDepth}</span>
        </div>
      </div>

      {/* Right: Section Manager & Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Sections Manager Drawer Button */}
        <button aria-label="Manage grouped sections"
          type="button"
          id="manage-sections-btn"
          onClick={onOpenSectionsManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface hover:bg-neutral-100 text-neutral-800 border border-neutral-400 hover:border-neutral-900 rounded-xs shadow-[1.5px_1.5px_0px_#27272a] text-xs font-mono transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Manage grouped sections"
        >
          <Layers size={13} className="text-neutral-700" />
          <span>Sections ({sections.length})</span>
        </button>

        {/* Paper Style Selector */}
        <div className="hidden sm:flex items-center bg-surface border border-neutral-400 rounded-xs p-0.5 text-xs font-mono shadow-[1px_1px_0px_#27272a]">
          <button aria-label="Graph Grid"
            type="button"
            id="style-grid-btn"
            onClick={() => onPaperStyleChange('grid')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'grid'
                ? 'bg-accent text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Graph Grid"
          >
            Grid
          </button>
          <button aria-label="Dot Matrix"
            type="button"
            id="style-dots-btn"
            onClick={() => onPaperStyleChange('dots')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'dots'
                ? 'bg-accent text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Dot Matrix"
          >
            Dots
          </button>
          <button aria-label="Lined Ledger"
            type="button"
            id="style-ledger-btn"
            onClick={() => onPaperStyleChange('ledger')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'ledger'
                ? 'bg-accent text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Lined Ledger"
          >
            Ledger
          </button>
          <button aria-label="Clean Paper"
            type="button"
            id="style-clean-btn"
            onClick={() => onPaperStyleChange('clean')}
            className={`px-2 py-0.5 rounded-xs transition-colors ${
              paperStyle === 'clean'
                ? 'bg-accent text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Clean Paper"
          >
            Plain
          </button>
        </div>

        {/* Print Button */}
        <button aria-label="Print or Export PDF"
          type="button"
          id="print-diagram-btn"
          onClick={() => window.print()}
          className="p-1.5 bg-surface hover:bg-neutral-100 text-neutral-700 hover:text-neutral-950 border border-neutral-400 rounded-xs shadow-[1px_1px_0px_#27272a] transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Print or Export PDF"
        >
          <Printer size={14} />
        </button>

        {/* Reset Button (Triggers custom confirmation dialog) */}
        <button aria-label="Clear diagram and reset to primary department"
          type="button"
          id="reset-diagram-btn"
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1 px-2 py-1.5 bg-surface hover:bg-rose-50 text-neutral-700 hover:text-rose-700 border border-neutral-400 hover:border-rose-400 rounded-xs shadow-[1px_1px_0px_#27272a] text-xs font-mono transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Clear diagram and reset to primary department"
        >
          <RotateCcw size={12} />
          <span className="hidden lg:inline">Reset</span>
        </button>

        {/* Guidance / Help Button */}
        <button aria-label="View organizational specification and visual guide"
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
