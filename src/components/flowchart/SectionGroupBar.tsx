import React, { useState } from 'react';
import { Section } from './flowchartTypes';
import { Layers, Plus, Trash2, X, Check, ArrowRight } from 'lucide-react';

interface SectionGroupBarProps {
  selectedNodeIds: string[];
  sections: Section[];
  departmentsMap: Map<string, { name: string; sectionId?: string }>;
  onCreateSection: (name: string, shade: Section['shade'], borderStyle: Section['borderStyle']) => void;
  onAssignToSection: (sectionId: string) => void;
  onRemoveFromSection: () => void;
  onDeleteSelected: (reparent: boolean) => void;
  onClearSelection: () => void;
}

export const SectionGroupBar: React.FC<SectionGroupBarProps> = ({
  selectedNodeIds,
  sections,
  departmentsMap,
  onCreateSection,
  onAssignToSection,
  onRemoveFromSection,
  onDeleteSelected,
  onClearSelection,
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedShade, setSelectedShade] = useState<Section['shade']>('ash');
  const [selectedBorderStyle, setSelectedBorderStyle] = useState<Section['borderStyle']>('dashed');
  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (selectedNodeIds.length === 0) return null;

  const count = selectedNodeIds.length;
  const anyHasSection = selectedNodeIds.some((id) => departmentsMap.get(id)?.sectionId);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    onCreateSection(trimmed, selectedShade, selectedBorderStyle);
    setNewSectionName('');
    setIsCreatingNew(false);
  };

  const SHADES: Array<{ id: Section['shade']; label: string; bg: string }> = [
    { id: 'ash', label: 'Ash (Grey-100)', bg: 'bg-[#eeeeea]' },
    { id: 'silver', label: 'Silver (Zinc-200)', bg: 'bg-[#e4e4e7]' },
    { id: 'slate', label: 'Slate (Slate-200)', bg: 'bg-[#e2e8f0]' },
    { id: 'charcoal', label: 'Charcoal (Grey-300)', bg: 'bg-[#d4d4d8]' },
    { id: 'graphite', label: 'Graphite (Zinc-400)', bg: 'bg-[#a1a1aa]' },
    { id: 'sand', label: 'Vellum', bg: 'bg-[#fef3c7]' },
    { id: 'emerald', label: 'Emerald Mint', bg: 'bg-[#a7f3d0]' },
    { id: 'indigo', label: 'Indigo Royal', bg: 'bg-[#c7d2fe]' },
    { id: 'amber', label: 'Amber Gold', bg: 'bg-[#fde68a]' },
    { id: 'rose', label: 'Rose Coral', bg: 'bg-[#fecdd3]' },
    { id: 'sky', label: 'Sky Azure', bg: 'bg-[#bae6fd]' },
  ];

  return (
    <div
      id="selection-group-dock"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border-2 border-neutral-900 rounded-sm shadow-[4px_4px_0px_#18181b] p-2.5 z-40 flex flex-col gap-2 max-w-2xl w-[94vw] sm:w-auto animate-in slide-in-from-bottom-3 duration-150 font-mono text-xs select-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Selection Count Badge */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-neutral-900 rounded-full animate-pulse" />
          <span className="font-bold text-neutral-900 text-xs">
            {count} {count === 1 ? 'department' : 'departments'} selected
          </span>
          <span className="text-[10px] text-neutral-500 hidden sm:inline">
            (Main dept excluded)
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Create Section Button */}
          {!isCreatingNew && (
            <button
              type="button"
              id="group-new-section-btn"
              onClick={() => {
                setIsCreatingNew(true);
                setIsAssignDropdownOpen(false);
                setShowDeleteConfirm(false);
              }}
              className="flex items-center gap-1 bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1.5 rounded-xs transition-colors shadow-[1px_1px_0px_#52525b]"
            >
              <Layers size={13} />
              <span>Group into Section</span>
            </button>
          )}

          {/* Assign to Existing Section Dropdown */}
          {!isCreatingNew && sections.length > 0 && (
            <div className="relative">
              <button
                type="button"
                id="assign-existing-section-btn"
                onClick={() => {
                  setIsAssignDropdownOpen(!isAssignDropdownOpen);
                  setShowDeleteConfirm(false);
                }}
                className="flex items-center gap-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-400 hover:border-neutral-900 px-2 py-1.5 rounded-xs transition-colors"
              >
                <span>Add to Existing ({sections.length})</span>
              </button>

              {isAssignDropdownOpen && (
                <div
                  id="existing-sections-menu"
                  className="absolute bottom-full mb-2 left-0 w-56 bg-white border border-neutral-900 rounded-xs shadow-[3px_3px_0px_#18181b] p-1 z-50 flex flex-col gap-1 max-h-48 overflow-y-auto"
                >
                  <div className="text-[10px] uppercase font-bold text-neutral-500 px-2 py-1 border-b border-neutral-200">
                    Choose Section
                  </div>
                  {sections.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        onAssignToSection(sec.id);
                        setIsAssignDropdownOpen(false);
                      }}
                      className="flex items-center justify-between px-2 py-1 text-left hover:bg-[#f3f3f0] rounded-xs text-neutral-800 text-xs transition-colors"
                    >
                      <span className="truncate">§ {sec.name}</span>
                      <span className="text-[10px] text-neutral-500 capitalize">{sec.shade}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Remove from Section Button */}
          {anyHasSection && !isCreatingNew && (
            <button
              type="button"
              id="ungroup-section-btn"
              onClick={onRemoveFromSection}
              className="text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 border border-neutral-300 px-2 py-1.5 rounded-xs transition-colors"
              title="Remove selected departments from their sections"
            >
              Ungroup
            </button>
          )}

          {/* Remove / Delete Selected Departments */}
          {!isCreatingNew && !showDeleteConfirm && (
            <button
              type="button"
              id="delete-selected-departments-btn"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 text-neutral-800 hover:text-white hover:bg-neutral-900 border border-neutral-400 hover:border-neutral-900 px-2 py-1.5 rounded-xs transition-colors"
              title="Remove selected departments from diagram"
            >
              <Trash2 size={13} />
              <span>Remove ({count})</span>
            </button>
          )}

          {/* Deselect All */}
          <button
            type="button"
            id="deselect-all-btn"
            onClick={onClearSelection}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-xs transition-colors"
            title="Deselect all"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Inline Create Section Form */}
      {isCreatingNew && (
        <form
          onSubmit={handleCreateSubmit}
          className="border-t border-neutral-200 pt-2.5 flex flex-col gap-2 bg-[#fafaf8] p-2 rounded-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-neutral-900">Create New Section</span>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="text-neutral-400 hover:text-neutral-900"
            >
              <X size={13} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              type="text"
              id="new-section-name-input"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="e.g. Finance Division, Technical Ops..."
              autoFocus
              className="flex-1 bg-white border border-neutral-400 focus:border-neutral-900 px-2.5 py-1 text-xs rounded-xs text-neutral-900 focus:outline-none"
            />

            {/* Shades Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-500 uppercase">Shade:</span>
              <div className="flex items-center gap-1 bg-white p-1 border border-neutral-300 rounded-xs">
                {SHADES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedShade(s.id)}
                    className={`w-5 h-5 rounded-xs border transition-all ${s.bg} ${
                      selectedShade === s.id
                        ? 'border-neutral-950 scale-110 shadow-[1px_1px_0px_#000]'
                        : 'border-neutral-400 hover:border-neutral-700'
                    }`}
                    title={s.label}
                  />
                ))}
              </div>
            </div>

            {/* Border Style Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-500 uppercase">Border:</span>
              <select
                value={selectedBorderStyle}
                onChange={(e) => setSelectedBorderStyle(e.target.value as Section['borderStyle'])}
                className="bg-white border border-neutral-300 text-[11px] px-1.5 py-1 rounded-xs focus:outline-none"
              >
                <option value="dashed">Dashed</option>
                <option value="solid">Solid</option>
                <option value="double">Double</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!newSectionName.trim()}
              className="bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white px-3 py-1 rounded-xs flex items-center justify-center gap-1 transition-colors"
            >
              <Check size={13} />
              <span>Confirm</span>
            </button>
          </div>
        </form>
      )}

      {/* Delete Confirmation Options */}
      {showDeleteConfirm && (
        <div className="border-t border-neutral-300 pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#f4f4f0] p-2 rounded-xs">
          <div className="text-xs text-neutral-800 font-medium">
            Remove {count} selected department(s)? Sub-branches behavior:
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="confirm-delete-all-btn"
              onClick={() => {
                onDeleteSelected(false);
                setShowDeleteConfirm(false);
              }}
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-2.5 py-1 rounded-xs text-[11px] transition-colors"
              title="Delete departments and all their child branches"
            >
              Delete All Sub-Branches
            </button>
            <button
              type="button"
              id="confirm-reparent-btn"
              onClick={() => {
                onDeleteSelected(true);
                setShowDeleteConfirm(false);
              }}
              className="bg-white hover:bg-neutral-200 border border-neutral-400 text-neutral-900 px-2.5 py-1 rounded-xs text-[11px] transition-colors"
              title="Preserve sub-branches by connecting them to parent"
            >
              Reparent Sub-Branches
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-neutral-500 hover:text-neutral-900 text-[11px] px-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
