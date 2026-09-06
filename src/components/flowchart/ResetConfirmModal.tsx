import React from 'react';
import { RotateCcw, X, AlertTriangle } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="reset-confirm-overlay"
      className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 font-mono select-none"
      onClick={onClose}
    >
      <div
        id="reset-confirm-dialog"
        className="w-full max-w-md bg-white border-2 border-neutral-900 rounded-sm shadow-[6px_6px_0px_#18181b] text-neutral-900 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-neutral-900 text-white flex items-center justify-center rounded-xs">
              <RotateCcw size={14} />
            </div>
            <h3 className="font-bold text-sm text-neutral-900">
              RESET FLOWCHART CANVAS
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 text-xs text-neutral-700 leading-relaxed">
          <div className="bg-[#fafaf7] border border-neutral-300 p-3 rounded-xs flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-neutral-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-neutral-900 block mb-1">
                Are you sure you want to reset?
              </span>
              <p className="text-[11px] text-neutral-600">
                This action will restore the flowchart back to a single primary top department block, clear all assigned sections, and remove any child branches.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono italic">
            Note: All current local diagram changes will be replaced with fresh starter defaults.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
          <button
            type="button"
            id="cancel-reset-btn"
            onClick={onClose}
            className="px-3 py-1.5 bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 rounded-xs text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-reset-btn"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xs text-xs font-bold transition-colors shadow-[2px_2px_0px_#71717a] flex items-center gap-1.5"
          >
            <RotateCcw size={12} />
            Confirm Reset
          </button>
        </div>
      </div>
    </div>
  );
};
