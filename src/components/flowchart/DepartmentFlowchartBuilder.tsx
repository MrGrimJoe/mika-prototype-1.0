import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DepartmentNode, PaperStyle, Section } from './flowchartTypes';
import {
  createInitialTree,
  updateNodeInTree,
  addChildToNode,
  removeNodeFromTree,
  removeMultipleNodesFromTree,
  assignSectionToNodes,
  clearSectionFromTree,
  getAllDepartments,
  calculateStats,
  generateId,
} from './treeUtils';
import { HeaderBar } from './HeaderBar';
import { FlowchartCanvas } from './FlowchartCanvas';
import { SectionGroupBar } from './SectionGroupBar';
import { SectionsManagerModal } from './SectionsManagerModal';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'department_flowchart_tree_v1';
const SECTIONS_STORAGE_KEY = 'department_flowchart_sections_v1';
const PAPER_STYLE_KEY = 'department_flowchart_paper_style';

export interface DepartmentFlowchartBuilderProps {
  key?: React.Key;
  initialOrgName?: string;
  initialTree?: DepartmentNode;
  initialSections?: Section[];
  onApplyToOrg?: (tree: DepartmentNode, sections: Section[]) => void;
  onContinue?: (tree: DepartmentNode, sections: Section[]) => void;
  onBack?: () => void;
  onClose?: () => void;
  onBackToLanding?: () => void;
  onNavigateToSignIn?: () => void;
  showBackToLanding?: boolean;
  isEmbedded?: boolean;
}

export function DepartmentFlowchartBuilder({
  initialOrgName,
  initialTree,
  initialSections,
  onApplyToOrg,
  onContinue,
  onBack,
  onClose,
  onBackToLanding,
  onNavigateToSignIn,
  showBackToLanding = true,
  isEmbedded = false,
}: DepartmentFlowchartBuilderProps) {
  // Tree state with local storage persistence or initial props
  const [rootNode, setRootNode] = useState<DepartmentNode>(() => {
    if (initialTree) {
      return JSON.parse(JSON.stringify(initialTree));
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id && parsed.department !== undefined) {
          if (initialOrgName && parsed.department === 'Primary Department') {
            parsed.department = initialOrgName;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading saved flowchart tree:', e);
    }
    const defaultTree = createInitialTree();
    if (initialOrgName) {
      defaultTree.department = initialOrgName;
    }
    return defaultTree;
  });

  // Sections state with local storage persistence or initial props
  const [sections, setSections] = useState<Section[]>(() => {
    if (initialSections && initialSections.length > 0) {
      return JSON.parse(JSON.stringify(initialSections));
    }
    try {
      const saved = localStorage.getItem(SECTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading saved sections:', e);
    }
    return [];
  });

  const [paperStyle, setPaperStyle] = useState<PaperStyle>(() => {
    try {
      const saved = localStorage.getItem(PAPER_STYLE_KEY);
      if (saved && ['clean', 'grid', 'dots', 'ledger'].includes(saved)) {
        return saved as PaperStyle;
      }
    } catch {
      // fallback
    }
    return 'grid';
  });

  // Single focused node ID (for action bar popover)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Multi-selection state for grouping and bulk actions
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());

  // Modal control
  const [isSectionsModalOpen, setIsSectionsModalOpen] = useState(false);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rootNode));
    } catch (e) {
      console.error('Failed to persist tree state:', e);
    }
  }, [rootNode]);

  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(sections));
    } catch (e) {
      console.error('Failed to persist sections:', e);
    }
  }, [sections]);

  useEffect(() => {
    try {
      localStorage.setItem(PAPER_STYLE_KEY, paperStyle);
    } catch (e) {
      console.error('Failed to persist paper style:', e);
    }
  }, [paperStyle]);

  // Global escape key to clear selections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        if (multiSelectedIds.size > 0) {
          setMultiSelectedIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [multiSelectedIds.size]);

  // Map of sections for O(1) lookup
  const sectionsMap = useMemo(() => {
    return new Map<string, Section>(sections.map((s) => [s.id, s]));
  }, [sections]);

  // Flattened department list
  const departmentsList = useMemo(() => {
    return getAllDepartments(rootNode);
  }, [rootNode]);

  // Departments map for quick lookup
  const departmentsMap = useMemo(() => {
    const map = new Map<string, { name: string; sectionId?: string; isRoot: boolean }>();
    departmentsList.forEach((d) => map.set(d.id, d));
    return map;
  }, [departmentsList]);

  // Update department name
  const handleUpdateDepartment = useCallback((nodeId: string, name: string) => {
    setRootNode((prev) =>
      updateNodeInTree(prev, nodeId, (node) => ({
        ...node,
        department: name,
      }))
    );
  }, []);

  // Add Root tag
  const handleAddRoot = useCallback((nodeId: string, rootText: string) => {
    setRootNode((prev) =>
      updateNodeInTree(prev, nodeId, (node) => ({
        ...node,
        roots: [...node.roots, rootText],
      }))
    );
  }, []);

  // Remove Root tag
  const handleRemoveRoot = useCallback((nodeId: string, index: number) => {
    setRootNode((prev) =>
      updateNodeInTree(prev, nodeId, (node) => ({
        ...node,
        roots: node.roots.filter((_, i) => i !== index),
      }))
    );
  }, []);

  // Add Role tag
  const handleAddRole = useCallback((nodeId: string, roleText: string) => {
    setRootNode((prev) =>
      updateNodeInTree(prev, nodeId, (node) => ({
        ...node,
        roles: [...node.roles, roleText],
      }))
    );
  }, []);

  // Remove Role tag
  const handleRemoveRole = useCallback((nodeId: string, index: number) => {
    setRootNode((prev) =>
      updateNodeInTree(prev, nodeId, (node) => ({
        ...node,
        roles: node.roles.filter((_, i) => i !== index),
      }))
    );
  }, []);

  // Add child department
  const handleAddChild = useCallback((parentId: string) => {
    setRootNode((prev) => {
      const { updatedTree, newChildId } = addChildToNode(prev, parentId, '');
      setSelectedNodeId(newChildId);
      return updatedTree;
    });
  }, []);

  // Toggle multi-select for a node
  // CRITICAL RULE: The main root department cannot be selected for grouping or deletion!
  const handleToggleMultiSelect = useCallback((nodeId: string) => {
    if (nodeId === rootNode.id) {
      // Main root department cannot be selected for a section
      return;
    }

    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, [rootNode.id]);

  // Create a new section and group selected departments into it
  const handleCreateSection = useCallback(
    (name: string, shade: Section['shade'], borderStyle: Section['borderStyle'] = 'dashed') => {
      if (multiSelectedIds.size === 0) return;

      const newSection: Section = {
        id: generateId('sec'),
        name,
        shade,
        borderStyle,
      };

      const selectedIdsArray: string[] = Array.from(multiSelectedIds);

      setSections((prev) => [...prev, newSection]);
      setRootNode((prev) => assignSectionToNodes(prev, selectedIdsArray, newSection.id));
      setMultiSelectedIds(new Set());
    },
    [multiSelectedIds]
  );

  // Assign selected departments to an existing section
  const handleAssignToExistingSection = useCallback(
    (sectionId: string) => {
      if (multiSelectedIds.size === 0) return;
      const selectedIdsArray: string[] = Array.from(multiSelectedIds);
      setRootNode((prev) => assignSectionToNodes(prev, selectedIdsArray, sectionId));
      setMultiSelectedIds(new Set());
    },
    [multiSelectedIds]
  );

  // Remove selected departments from their section(s)
  const handleRemoveFromSection = useCallback(() => {
    if (multiSelectedIds.size === 0) return;
    const selectedIdsArray: string[] = Array.from(multiSelectedIds);
    setRootNode((prev) => assignSectionToNodes(prev, selectedIdsArray, undefined));
    setMultiSelectedIds(new Set());
  }, [multiSelectedIds]);

  // Unassign single department from section directly
  const handleUnassignSingleDepartment = useCallback((nodeId: string) => {
    setRootNode((prev) => assignSectionToNodes(prev, [nodeId], undefined));
  }, []);

  // Update existing section details
  const handleUpdateSection = useCallback(
    (sectionId: string, name: string, shade: Section['shade'], borderStyle: Section['borderStyle']) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, name, shade, borderStyle } : s))
      );
    },
    []
  );

  // Delete section (removes section definition and clears it from all nodes)
  const handleDeleteSection = useCallback((sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setRootNode((prev) => clearSectionFromTree(prev, sectionId));
  }, []);

  // Delete individual node
  // CRITICAL RULE: The main root department cannot be removed!
  const handleDeleteNode = useCallback(
    (nodeId: string, reparentChildren: boolean = false) => {
      if (nodeId === rootNode.id) {
        // Can't remove the root department
        return;
      }

      setRootNode((prev) => {
        const result = removeNodeFromTree(prev, nodeId, reparentChildren);
        return result || prev;
      });

      setSelectedNodeId((current) => (current === nodeId ? null : current));
      setMultiSelectedIds((prev) => {
        if (!prev.has(nodeId)) return prev;
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [rootNode.id]
  );

  // Delete all multi-selected departments in bulk
  // CRITICAL RULE: Root department is strictly safeguarded from deletion!
  const handleDeleteSelected = useCallback(
    (reparentChildren: boolean = false) => {
      if (multiSelectedIds.size === 0) return;

      const idsToDelete: string[] = (Array.from(multiSelectedIds) as string[]).filter((id) => id !== rootNode.id);

      setRootNode((prev) => removeMultipleNodesFromTree(prev, idsToDelete, reparentChildren));
      setMultiSelectedIds(new Set());
      setSelectedNodeId(null);
    },
    [multiSelectedIds, rootNode.id]
  );

  // Toggle branch collapse
  const handleToggleCollapse = useCallback((nodeId: string) => {
    setRootNode((prev) =>
      updateNodeInTree(prev, nodeId, (node) => ({
        ...node,
        isCollapsed: !node.isCollapsed,
      }))
    );
  }, []);

  // Reset diagram
  const handleReset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SECTIONS_STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing storage on reset:', e);
    }
    const initial = createInitialTree();
    setRootNode(initial);
    setSections([]);
    setSelectedNodeId(initial.id);
    setMultiSelectedIds(new Set());
  }, []);

  // Apply structure generated by Assistance helper
  const handleApplyStructure = useCallback((newTree: DepartmentNode, newSections: Section[]) => {
    setRootNode(newTree);
    setSections(newSections);
    setSelectedNodeId(newTree.id);
    setMultiSelectedIds(new Set());
  }, []);

  // Real-time statistics
  const stats = useMemo(() => calculateStats(rootNode, sections.length), [rootNode, sections.length]);

  return (
    <div
      id="flowchart-app"
      className={`flex flex-col ${isEmbedded ? 'h-full w-full min-h-[680px]' : 'h-screen w-screen'} overflow-hidden bg-[#faf9f5]`}
    >
      {/* Integration Bar for Landing / Auth flows / Embedded step */}
      {(onBack || onContinue || onBackToLanding || onApplyToOrg || onNavigateToSignIn) && (
        <div className="bg-[#131A29] text-white px-6 sm:px-8 h-16 flex items-center justify-between text-xs font-mono border-b border-[#26324D] z-30 shrink-0 shadow-md">
          <div className="flex items-center gap-4 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#1F293D] hover:bg-[#2A3752] text-gray-200 hover:text-white rounded-xs border border-[#374563] font-mono text-xs transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft size={14} />
                <span>Switch Template</span>
              </button>
            )}
            {onBackToLanding && !onBack && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="flex items-center gap-2 px-3.5 py-2 bg-[#1F293D] hover:bg-[#2A3752] text-gray-200 hover:text-white rounded-xs border border-[#374563] font-mono text-xs transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft size={14} />
                <span>Return to Landing</span>
              </button>
            )}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-emerald-400 font-mono font-bold text-[11px] uppercase tracking-wider bg-emerald-950/80 px-2.5 py-1 rounded-xs border border-emerald-700/60 shrink-0">
                Step 4: Org Graph
              </span>
              <span className="text-white font-semibold text-sm hidden md:inline truncate max-w-sm">
                {initialOrgName || rootNode.department}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {onNavigateToSignIn && (
              <button
                type="button"
                onClick={onNavigateToSignIn}
                className="text-gray-400 hover:text-white underline cursor-pointer mr-2 text-xs"
              >
                Sign In
              </button>
            )}
            {onContinue && (
              <button
                type="button"
                onClick={() => onContinue(rootNode, sections)}
                className="flex items-center gap-2.5 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xs shadow-[0_2px_14px_rgba(16,185,129,0.45)] text-xs font-mono uppercase tracking-wider transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] border border-emerald-400"
              >
                <span className="tracking-wide">Save & Next: Team Size</span>
                <ArrowRight size={15} className="stroke-[2.5]" />
              </button>
            )}
            {onApplyToOrg && !onContinue && (
              <button
                type="button"
                onClick={() => onApplyToOrg(rootNode, sections)}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold rounded-xs shadow-md transition-all cursor-pointer text-xs uppercase tracking-wider"
              >
                <Check size={14} />
                <span>Apply Flowchart</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Header Bar with Controls, Sections Button and Stats */}
      <HeaderBar
        stats={stats}
        sections={sections}
        paperStyle={paperStyle}
        isSelectionActive={multiSelectedIds.size > 0}
        selectedCount={multiSelectedIds.size}
        onPaperStyleChange={setPaperStyle}
        onOpenSectionsManager={() => setIsSectionsModalOpen(true)}
        onClearSelection={() => setMultiSelectedIds(new Set())}
        onReset={handleReset}
        onApplyStructure={handleApplyStructure}
      />

      {/* Main Flowchart Canvas with Auto-Centering, Zoom, and Connections */}
      <main className="flex-1 relative w-full overflow-hidden flex flex-col">
        <FlowchartCanvas
          rootNode={rootNode}
          selectedNodeId={selectedNodeId}
          multiSelectedIds={multiSelectedIds}
          sectionsMap={sectionsMap}
          paperStyle={paperStyle}
          onSelectNode={setSelectedNodeId}
          onToggleMultiSelect={handleToggleMultiSelect}
          onUpdateDepartment={handleUpdateDepartment}
          onAddRoot={handleAddRoot}
          onRemoveRoot={handleRemoveRoot}
          onAddRole={handleAddRole}
          onRemoveRole={handleRemoveRole}
          onAddChild={handleAddChild}
          onDeleteNode={handleDeleteNode}
          onToggleCollapse={handleToggleCollapse}
          onUnassignSection={handleUnassignSingleDepartment}
        />

        {/* Floating Multi-Selection Dock for Section Grouping & Removal */}
        <SectionGroupBar
          selectedNodeIds={Array.from(multiSelectedIds) as string[]}
          sections={sections}
          departmentsMap={departmentsMap}
          onCreateSection={handleCreateSection}
          onAssignToSection={handleAssignToExistingSection}
          onRemoveFromSection={handleRemoveFromSection}
          onDeleteSelected={handleDeleteSelected}
          onClearSelection={() => setMultiSelectedIds(new Set())}
        />
      </main>

      {/* Sections Manager Drawer/Modal */}
      <SectionsManagerModal
        isOpen={isSectionsModalOpen}
        onClose={() => setIsSectionsModalOpen(false)}
        sections={sections}
        departments={departmentsList}
        onUpdateSection={handleUpdateSection}
        onDeleteSection={handleDeleteSection}
        onRemoveDepartmentFromSection={handleUnassignSingleDepartment}
        onHighlightSection={(sectionId) => {
          // Select all departments in this section
          const deptsInSection = departmentsList
            .filter((d) => d.sectionId === sectionId && !d.isRoot)
            .map((d) => d.id);
          setMultiSelectedIds(new Set(deptsInSection));
          setIsSectionsModalOpen(false);
        }}
      />
    </div>
  );
}
