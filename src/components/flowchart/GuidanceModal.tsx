import React, { useState } from 'react';
import { BookOpen, Layers, GitFork, ShieldCheck, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';

interface GuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidanceModal: React.FC<GuidanceModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'model' | 'sections' | 'mainRoot' | 'workflow' | 'rules'>('model');

  if (!isOpen) return null;

  return (
    <div
      id="guidance-overlay"
      className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 font-mono select-none"
      onClick={onClose}
    >
      <div
        id="guidance-dialog"
        className="w-full max-w-2xl bg-white border-2 border-neutral-900 rounded-sm shadow-[6px_6px_0px_#18181b] text-neutral-900 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#f5f5f0] border-b-2 border-neutral-900 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-neutral-900 text-white rounded-xs flex items-center justify-center shadow-[1px_1px_0px_#52525b]">
              <BookOpen size={16} />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base tracking-tight text-neutral-900">
                ORGANIZATIONAL SPECIFICATION & FLOWCHART GUIDE
              </h2>
              <p className="text-[11px] text-neutral-600">
                Recursive hierarchy, sections, roots, and authority boundaries
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-guidance-btn"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1 rounded-xs transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-300 bg-neutral-100 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('model')}
            className={`py-2 px-3 text-center font-semibold whitespace-nowrap transition-colors border-r border-neutral-300 ${
              activeSection === 'model'
                ? 'bg-white text-neutral-900 border-b-2 border-b-neutral-900 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            1. Recursive Containers
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('sections')}
            className={`py-2 px-3 text-center font-semibold whitespace-nowrap transition-colors border-r border-neutral-300 ${
              activeSection === 'sections'
                ? 'bg-white text-neutral-900 border-b-2 border-b-neutral-900 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            2. Sections & Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('mainRoot')}
            className={`py-2 px-3 text-center font-semibold whitespace-nowrap transition-colors border-r border-neutral-300 ${
              activeSection === 'mainRoot'
                ? 'bg-white text-neutral-900 border-b-2 border-b-neutral-900 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            3. Main Dept Anchor
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('workflow')}
            className={`py-2 px-3 text-center font-semibold whitespace-nowrap transition-colors border-r border-neutral-300 ${
              activeSection === 'workflow'
                ? 'bg-white text-neutral-900 border-b-2 border-b-neutral-900 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            4. Canvas Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('rules')}
            className={`py-2 px-3 text-center font-semibold whitespace-nowrap transition-colors ${
              activeSection === 'rules'
                ? 'bg-white text-neutral-900 border-b-2 border-b-neutral-900 font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            5. Core Invariants
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh] text-xs space-y-4 leading-relaxed text-neutral-800">
          {activeSection === 'model' && (
            <div className="space-y-3">
              <div className="border border-neutral-300 bg-[#fafaf8] p-3.5 rounded-xs space-y-2">
                <span className="font-bold text-neutral-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <GitFork size={14} className="text-neutral-700" />
                  The Recursive Triple: Department &rarr; Root &rarr; Roles
                </span>
                <p className="text-[11px] text-neutral-700">
                  Organizations are structured using universal building blocks rather than isolated ad-hoc categories. Every organizational tier behaves consistently regardless of whether it represents an entire institution, a division, a project group, or a class.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-neutral-200 bg-white p-3 rounded-xs space-y-1.5">
                  <span className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider block border-b border-neutral-200 pb-1">
                    Department Primitive
                  </span>
                  <p className="text-[11px] text-neutral-600">
                    The primary container. It represents any structural entity: School, Enterprise, Engineering, Marketing, Grade 8, or Project Phoenix. A department holds subordinate departments, a root, and roles.
                  </p>
                </div>

                <div className="border border-neutral-200 bg-white p-3 rounded-xs space-y-1.5">
                  <span className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider block border-b border-neutral-200 pb-1">
                    Roots (Leadership)
                  </span>
                  <p className="text-[11px] text-neutral-600">
                    The designated head of a department (e.g. Principal, Director, Headmaster). Roots hold direct authority over immediately subordinate department heads, and direct authority over tasks within their scope.
                  </p>
                </div>

                <div className="border border-neutral-200 bg-white p-3 rounded-xs space-y-1.5">
                  <span className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider block border-b border-neutral-200 pb-1">
                    Roles (Functional Positions)
                  </span>
                  <p className="text-[11px] text-neutral-600">
                    Specific functions inside a department (e.g. Mathematics Teacher, Software Engineer, Nurse). A role can hold multiple individuals, and one person can hold roles across several departments simultaneously.
                  </p>
                </div>

                <div className="border border-neutral-200 bg-white p-3 rounded-xs space-y-1.5">
                  <span className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider block border-b border-neutral-200 pb-1">
                    Direct vs. Indirect Authority
                  </span>
                  <p className="text-[11px] text-neutral-600">
                    Direct authority (value = 1) connects a department root to its immediate subordinates. Authority further down the chain is indirect and passes sequentially through intermediate roots.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'sections' && (
            <div className="space-y-3">
              <div className="border border-neutral-300 bg-[#fafaf8] p-3.5 rounded-xs space-y-2">
                <span className="font-bold text-neutral-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Layers size={14} className="text-neutral-700" />
                  Why Sections Exist: Solving Overlapping Dimensions
                </span>
                <p className="text-[11px] text-neutral-700">
                  Real organizations cannot be forced into a rigid single-parent hierarchy without causing duplicate entries or broken reporting chains. Sections solve this by allowing multiple departments to be grouped under a shared banner without changing their primary tree structure.
                </p>
              </div>

              <div className="border-l-2 border-neutral-900 pl-3 py-1 space-y-1 bg-neutral-50/70 p-2 rounded-r-xs">
                <span className="font-bold text-neutral-900 text-[11px] uppercase tracking-wider block">
                  The Fundamental Section Rule
                </span>
                <p className="text-[11px] text-neutral-700">
                  A Section Root exercises direct authority over the <strong>roles inside its grouped departments</strong>, but does <strong>not</strong> override or usurp those departments' own internal roots.
                </p>
              </div>

              <div className="border border-neutral-200 bg-white p-3 rounded-xs space-y-1.5 text-[11px] text-neutral-700">
                <span className="font-bold text-neutral-900 block">Matrix Example:</span>
                <p className="text-neutral-600">
                  A school can simultaneously have grade-level classes (Class 6, 7, 8) and a subject coordinator (e.g. Physics Department). By grouping Class 6, 7, and 8 into a Physics section:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-600 pl-1">
                  <li>The Physics Coordinator directs the physics teachers inside those classes.</li>
                  <li>Each class retains its own internal head (Class Root) for administrative matters.</li>
                  <li>No duplicate teacher or class entries are created.</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'mainRoot' && (
            <div className="space-y-3">
              <div className="border border-neutral-900 bg-[#f4f4f0] p-3.5 rounded-xs space-y-2">
                <span className="font-bold text-neutral-950 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-neutral-900" />
                  The Main Department: Permanent Institutional Anchor
                </span>
                <p className="text-[11px] text-neutral-700">
                  The top-most department block serves as the master root of your organization. It represents the foundational entity from which all branches descend.
                </p>
              </div>

              <div className="space-y-2">
                <div className="border border-neutral-300 bg-white p-3 rounded-xs flex items-start gap-2.5">
                  <span className="w-5 h-5 bg-neutral-900 text-white rounded-xs flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <span className="font-bold text-neutral-900 text-[11px] block">No Section Assignment</span>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      The Main Department cannot be selected or grouped into any section. Sections are designed to group subordinate departments; the apex root remains above all section groupings.
                    </p>
                  </div>
                </div>

                <div className="border border-neutral-300 bg-white p-3 rounded-xs flex items-start gap-2.5">
                  <span className="w-5 h-5 bg-neutral-900 text-white rounded-xs flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <span className="font-bold text-neutral-900 text-[11px] block">Protected from Deletion</span>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      The Main Department cannot be removed or destroyed. All child departments can be modified, re-parented, or pruned, but the organizational anchor always remains preserved.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'workflow' && (
            <div className="space-y-3">
              <div className="border border-neutral-300 bg-[#fafaf8] p-3 rounded-xs space-y-2">
                <span className="font-bold text-neutral-950 text-xs uppercase tracking-wide">
                  Visual Flowchart Operations:
                </span>
                <p className="text-[11px] text-neutral-600">
                  Step-by-step actions available directly on the flowchart canvas:
                </p>
              </div>

              <div className="space-y-2">
                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 text-[11px]">Selecting Departments:</span>
                    <span className="text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-xs font-semibold">[SELECT] Button</span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    Click the SELECT toggle on any subordinate department. Pick one or multiple departments. A floating action bar will open at the bottom.
                  </p>
                </div>

                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 text-[11px]">Grouping into a Section:</span>
                    <span className="text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-xs font-semibold">Floating Dock</span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    Enter a section name, choose a border style (solid, dashed, or double), and select a paper grey tone. Grouped departments display a dedicated section badge and border styling.
                  </p>
                </div>

                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 text-[11px]">Branch Removal & Reparenting:</span>
                    <span className="text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-xs font-semibold">Trash Icon</span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    When deleting an intermediate department with child branches, you can select Reparent Sub-Branches to lift child nodes up to the parent, preserving the lower branches.
                  </p>
                </div>

                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 text-[11px]">Adding Roots & Roles:</span>
                    <span className="text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded-xs font-semibold">Enter Key</span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    Type a title into the Root or Roles input field and press Enter. Click the X mark on any tag to remove an entry.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'rules' && (
            <div className="space-y-3">
              <div className="border border-neutral-300 bg-[#fafaf8] p-3 rounded-xs space-y-2">
                <span className="font-bold text-neutral-950 text-xs uppercase tracking-wide">
                  Core Invariants & Boundaries
                </span>
                <p className="text-[11px] text-neutral-600">
                  Fundamental axioms governing organizational validity:
                </p>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-950">Membership does not equal Authority:</strong>
                    <span className="text-neutral-600 block mt-0.5">
                      Belonging to a department or participating in a section does not automatically give a member authority over that container or its members.
                    </span>
                  </div>
                </div>

                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-950">Downward Flow of Authority:</strong>
                    <span className="text-neutral-600 block mt-0.5">
                      Authority strictly cascades downward from roots to subordinate departments or roles. Authority never flows upward to control one's own supervisor or lead.
                    </span>
                  </div>
                </div>

                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-950">Contextual Role Assignments:</strong>
                    <span className="text-neutral-600 block mt-0.5">
                      A single team member can hold distinct roles in separate branches (e.g. Lead in a project team and Staff in a general division) without blurring boundaries.
                    </span>
                  </div>
                </div>

                <div className="border border-neutral-200 bg-white p-2.5 rounded-xs flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-neutral-900 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-neutral-950">Non-Destructive Sections:</strong>
                    <span className="text-neutral-600 block mt-0.5">
                      Ungrouping or modifying a section removes only the horizontal grouping tag; it leaves the underlying departments and their hierarchy completely intact.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 bg-[#f5f5f2] px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Info size={12} className="text-neutral-400" />
            <span>Mika Recursive Organizational Specification</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-1 rounded-xs text-xs transition-colors shadow-[1.5px_1.5px_0px_#71717a]"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
};
