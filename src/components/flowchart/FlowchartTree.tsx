import React from 'react';
import { DepartmentNode, Section } from './flowchartTypes';
import { DepartmentCard } from './DepartmentCard';

interface FlowchartTreeProps {
  node: DepartmentNode;
  isRoot?: boolean;
  selectedNodeId: string | null;
  multiSelectedIds: Set<string>;
  sectionsMap: Map<string, Section>;
  onSelectNode: (nodeId: string) => void;
  onToggleMultiSelect: (nodeId: string) => void;
  onUpdateDepartment: (nodeId: string, name: string) => void;
  onAddRoot: (nodeId: string, rootText: string) => void;
  onRemoveRoot: (nodeId: string, index: number) => void;
  onAddRole: (nodeId: string, roleText: string) => void;
  onRemoveRole: (nodeId: string, index: number) => void;
  onAddChild: (parentId: string) => void;
  onDeleteNode: (nodeId: string, reparentChildren?: boolean) => void;
  onToggleCollapse: (nodeId: string) => void;
  onUnassignSection: (nodeId: string) => void;
}

export const FlowchartTree: React.FC<FlowchartTreeProps> = ({
  node,
  isRoot = false,
  selectedNodeId,
  multiSelectedIds,
  sectionsMap,
  onSelectNode,
  onToggleMultiSelect,
  onUpdateDepartment,
  onAddRoot,
  onRemoveRoot,
  onAddRole,
  onRemoveRole,
  onAddChild,
  onDeleteNode,
  onToggleCollapse,
  onUnassignSection,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = Boolean(node.isCollapsed);
  const isSelected = selectedNodeId === node.id;
  const isMultiSelected = multiSelectedIds.has(node.id);
  const section = node.sectionId ? sectionsMap.get(node.sectionId) : undefined;

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <DepartmentCard
        node={node}
        isRoot={isRoot}
        isSelected={isSelected}
        isMultiSelected={isMultiSelected}
        section={section}
        onSelect={onSelectNode}
        onToggleMultiSelect={onToggleMultiSelect}
        onUpdateDepartment={onUpdateDepartment}
        onAddRoot={onAddRoot}
        onRemoveRoot={onRemoveRoot}
        onAddRole={onAddRole}
        onRemoveRole={onRemoveRole}
        onAddChild={onAddChild}
        onDeleteNode={onDeleteNode}
        onToggleCollapse={onToggleCollapse}
        onUnassignSection={onUnassignSection}
      />

      {/* Children Branches */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center w-full">
          {/* Vertical stem from parent bottom down to junction */}
          <div className="relative flex flex-col items-center">
            {/* 32px vertical stem from parent card */}
            <div className="w-[1.5px] h-8 bg-neutral-800" />
            {/* Junction dot if multiple children */}
            {node.children.length > 1 && (
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 -mb-[3px] z-10" />
            )}
          </div>

          {/* Children container with connecting busbars */}
          <div className="flex justify-center items-start">
            {node.children.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === node.children.length - 1;
              const isSingleChild = node.children.length === 1;

              return (
                <div key={child.id} className="relative flex flex-col items-center px-4">
                  {/* Top connector zone */}
                  <div className="relative w-full h-8 flex justify-center">
                    {/* Horizontal line segments if multiple children */}
                    {!isSingleChild && (
                      <div
                        className="absolute top-0 h-[1.5px] bg-neutral-800"
                        style={{
                          left: isFirst ? '50%' : '0%',
                          right: isLast ? '50%' : '0%',
                        }}
                      />
                    )}

                    {/* Vertical line dropping into the child card */}
                    <div className="w-[1.5px] h-full bg-neutral-800" />

                    {/* Arrowhead at the bottom of drop line pointing into child */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] border-t-neutral-900" />
                  </div>

                  {/* Child subtree */}
                  <FlowchartTree
                    node={child}
                    isRoot={false}
                    selectedNodeId={selectedNodeId}
                    multiSelectedIds={multiSelectedIds}
                    sectionsMap={sectionsMap}
                    onSelectNode={onSelectNode}
                    onToggleMultiSelect={onToggleMultiSelect}
                    onUpdateDepartment={onUpdateDepartment}
                    onAddRoot={onAddRoot}
                    onRemoveRoot={onRemoveRoot}
                    onAddRole={onAddRole}
                    onRemoveRole={onRemoveRole}
                    onAddChild={onAddChild}
                    onDeleteNode={onDeleteNode}
                    onToggleCollapse={onToggleCollapse}
                    onUnassignSection={onUnassignSection}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
