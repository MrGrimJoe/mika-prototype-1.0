import React, { useState } from 'react';
import { Section, DepartmentNode } from './flowchartTypes';
import { Layers, Trash2, Edit3, Check, X, ShieldAlert } from 'lucide-react';

interface SectionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  departments: Array<{ id: string; name: string; sectionId?: string; isRoot: boolean }>;
  onUpdateSection: (sectionId: string, name: string, shade: Section['shade'], borderStyle: Section['borderStyle']) => void;
  onDeleteSection: (sectionId: string) => void;
  onRemoveDepartmentFromSection: (deptId: string) => void;
  onHighlightSection: (sectionId: string) => void;
}

export const SectionsManagerModal: React.FC<SectionsManagerModalProps> = ({
  isOpen,
  onClose,
  sections,
  departments,
  onUpdateSection,
  onDeleteSection,
  onRemoveDepartmentFromSection,
  onHighlightSection,
}) => {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editShade, setEditShade] = useState<Section['shade']>('ash');
  const [editBorderStyle, setEditBorderStyle] = useState<Section['borderStyle']>('dashed');

  if (!isOpen) return null;

  const handleStartEdit = (sec: Section) => {
    setEditingSectionId(sec.id);
    setEditName(sec.name);
    setEditShade(sec.shade);
    setEditBorderStyle(sec.borderStyle || 'dashed');
  };

  const handleSaveEdit = (secId: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      onUpdateSection(secId, trimmed, editShade, editBorderStyle);
    }
    setEditingSectionId(null);
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
      id="sections-manager-overlay"
      className="fixed inset-0 bg-neutral-950/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 font-mono select-none"
      onClick={onClose}
    >
      <div
        id="sections-manager-dialog"
        className="w-full max-w-lg bg-white border-2 border-neutral-900 p-6 rounded-sm shadow-[6px_6px_0px_#18181b] text-neutral-900 space-y-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-neutral-800" />
            <h2 className="font-bold text-base tracking-tight">MANAGED SECTIONS</h2>
            <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 border border-neutral-300 rounded-xs">
              {sections.length} Active
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice regarding main department rule */}
        <div className="flex items-start gap-2 bg-[#f6f6f3] border border-neutral-300 p-2.5 rounded-xs text-[11px] text-neutral-600">
          <ShieldAlert size={15} className="text-neutral-800 mt-0.5 shrink-0" />
          <span>
            <strong>System Rule:</strong> The primary Root Department cannot belong to any section and cannot be removed, ensuring the organizational flowchart foundation remains anchored.
          </span>
        </div>

        {/* Sections List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {sections.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-xs italic">
              No sections created yet. Select one or more departments on the canvas to group them into a section.
            </div>
          ) : (
            sections.map((section) => {
              const assignedDepts = departments.filter((d) => d.sectionId === section.id);
              const isEditing = editingSectionId === section.id;

              return (
                <div
                  key={section.id}
                  id={`section-item-${section.id}`}
                  className="border border-neutral-300 bg-[#fafaf8] p-3 rounded-xs space-y-2"
                >
                  {isEditing ? (
                    <div className="space-y-2 border-b border-neutral-200 pb-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-neutral-900 px-2 py-1 text-xs rounded-xs text-neutral-900 font-bold"
                        autoFocus
                      />
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-neutral-500">Shade:</span>
                          <div className="flex items-center gap-1">
                            {SHADES.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setEditShade(s.id)}
                                className={`w-4 h-4 rounded-xs border ${s.bg} ${
                                  editShade === s.id ? 'border-neutral-950 scale-110' : 'border-neutral-300'
                                }`}
                                title={s.label}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(section.id)}
                            className="bg-neutral-900 text-white px-2 py-0.5 rounded-xs text-[11px] flex items-center gap-1"
                          >
                            <Check size={12} /> Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSectionId(null)}
                            className="text-neutral-500 hover:text-neutral-900 text-[11px] px-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900 flex items-center gap-1">
                          <span className="text-neutral-400">§</span>
                          {section.name}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-neutral-200 text-neutral-700 rounded-xs">
                          {section.shade}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          ({assignedDepts.length} {assignedDepts.length === 1 ? 'dept' : 'depts'})
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(section)}
                          className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 rounded-xs transition-colors"
                          title="Rename / Edit"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Ungroup section "${section.name}"? (Departments will remain)`)) {
                              onDeleteSection(section.id);
                            }
                          }}
                          className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 rounded-xs transition-colors"
                          title="Delete Section (Ungroup all members)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Departments inside this section */}
                  {assignedDepts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {assignedDepts.map((dept) => (
                        <div
                          key={dept.id}
                          className="flex items-center gap-1 bg-white border border-neutral-300 px-2 py-0.5 rounded-xs text-[11px] text-neutral-800"
                        >
                          <span>{dept.name}</span>
                          <button
                            type="button"
                            onClick={() => onRemoveDepartmentFromSection(dept.id)}
                            className="text-neutral-400 hover:text-neutral-900 ml-0.5"
                            title="Remove department from this section"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 italic">No departments currently assigned</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-1.5 text-xs rounded-xs shadow-[2px_2px_0px_#71717a] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
