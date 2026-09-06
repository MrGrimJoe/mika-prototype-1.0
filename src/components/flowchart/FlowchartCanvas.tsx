import React, { useRef, useEffect, useState } from 'react';
import { DepartmentNode, PaperStyle, Section } from './flowchartTypes';
import { FlowchartTree } from './FlowchartTree';
import { ZoomIn, ZoomOut, Maximize2, Target } from 'lucide-react';

interface FlowchartCanvasProps {
  rootNode: DepartmentNode;
  selectedNodeId: string | null;
  multiSelectedIds: Set<string>;
  sectionsMap: Map<string, Section>;
  paperStyle: PaperStyle;
  onSelectNode: (nodeId: string | null) => void;
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

export const FlowchartCanvas: React.FC<FlowchartCanvasProps> = ({
  rootNode,
  selectedNodeId,
  multiSelectedIds,
  sectionsMap,
  paperStyle,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // Auto-center root department initially and when requested
  const centerRoot = (smooth: boolean = true) => {
    if (!containerRef.current || !contentRef.current) return;
    const container = containerRef.current;
    const content = contentRef.current;

    const scrollLeft = (content.scrollWidth - container.clientWidth) / 2;
    container.scrollTo({
      left: Math.max(0, scrollLeft),
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      centerRoot(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleFitToScreen = () => {
    if (!containerRef.current || !contentRef.current) return;
    const container = containerRef.current;
    const content = contentRef.current;

    const availableWidth = container.clientWidth - 64;
    const availableHeight = container.clientHeight - 80;
    const contentWidth = content.scrollWidth / zoom;
    const contentHeight = content.scrollHeight / zoom;

    if (contentWidth > 0 && contentHeight > 0) {
      const scaleX = availableWidth / contentWidth;
      const scaleY = availableHeight / contentHeight;
      const calculatedScale = Math.min(scaleX, scaleY, 1);
      const newZoom = Math.max(0.4, Math.min(calculatedScale, 1));
      setZoom(Number(newZoom.toFixed(2)));
      setTimeout(() => centerRoot(true), 50);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(1.4, Number((prev + 0.1).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(0.4, Number((prev - 0.1).toFixed(2))));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setTimeout(() => centerRoot(true), 50);
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('input') ||
      target.closest('button') ||
      target.closest('[id^="dept-card-"]') ||
      target.closest('#selection-group-dock')
    ) {
      return;
    }

    if (e.button === 0 && containerRef.current) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollLeft: containerRef.current.scrollLeft,
        scrollTop: containerRef.current.scrollTop,
      });
      onSelectNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    containerRef.current.scrollLeft = panStart.scrollLeft - dx;
    containerRef.current.scrollTop = panStart.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const getBackgroundStyle = () => {
    switch (paperStyle) {
      case 'grid':
        return {
          backgroundImage:
            'linear-gradient(to right, #e8e8e4 1px, transparent 1px), linear-gradient(to bottom, #e8e8e4 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        };
      case 'dots':
        return {
          backgroundImage: 'radial-gradient(#c8c8c2 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        };
      case 'ledger':
        return {
          backgroundImage:
            'linear-gradient(to bottom, transparent 23px, #e4e4df 24px)',
          backgroundSize: '100% 24px',
        };
      case 'clean':
      default:
        return {};
    }
  };

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col select-none">
      {/* Scrollable Viewport */}
      <div
        ref={containerRef}
        id="flowchart-viewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 w-full h-full overflow-auto bg-[#faf9f5] ${
          isPanning ? 'cursor-grabbing' : 'cursor-default'
        } scrollbar-thin`}
        style={getBackgroundStyle()}
      >
        {/* Flowchart Tree Container */}
        <div
          ref={contentRef}
          id="flowchart-content-root"
          className="min-w-full w-max flex flex-col items-center pt-8 pb-36 px-12 transition-transform origin-top"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Top Paper Header Stamp */}
          <div className="mb-6 flex items-center gap-2 text-neutral-400 font-mono text-[11px] tracking-widest uppercase">
            <span className="w-8 h-[1px] bg-neutral-300" />
            <span>ORGANIZATION FLOWCHART</span>
            <span className="w-8 h-[1px] bg-neutral-300" />
          </div>

          {/* Root Department at top center */}
          <FlowchartTree
            node={rootNode}
            isRoot={true}
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
      </div>

      {/* Floating Canvas Navigation & Zoom Controller */}
      <div
        id="canvas-controls-toolbar"
        className="absolute bottom-5 right-5 flex items-center bg-white border-[1.5px] border-neutral-900 rounded-sm shadow-[2.5px_2.5px_0px_#18181b] p-1 gap-1 z-30 font-mono text-xs"
      >
        <button
          type="button"
          id="zoom-out-btn"
          onClick={handleZoomOut}
          disabled={zoom <= 0.4}
          className="p-1.5 text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 rounded-xs disabled:opacity-30 transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut size={14} />
        </button>

        <button
          type="button"
          id="reset-zoom-btn"
          onClick={handleResetZoom}
          className="px-1.5 py-1 text-[11px] font-semibold text-neutral-800 hover:bg-neutral-100 rounded-xs transition-colors min-w-11 text-center"
          title="Reset to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        <button
          type="button"
          id="zoom-in-btn"
          onClick={handleZoomIn}
          disabled={zoom >= 1.4}
          className="p-1.5 text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 rounded-xs disabled:opacity-30 transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn size={14} />
        </button>

        <div className="w-[1px] h-4 bg-neutral-300 mx-0.5" />

        <button
          type="button"
          id="fit-view-btn"
          onClick={handleFitToScreen}
          className="p-1.5 text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 rounded-xs transition-colors"
          title="Fit All on Screen"
        >
          <Maximize2 size={14} />
        </button>

        <button
          type="button"
          id="center-root-btn"
          onClick={() => centerRoot(true)}
          className="p-1.5 text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 rounded-xs transition-colors flex items-center gap-1"
          title="Center Top Root"
        >
          <Target size={14} />
        </button>
      </div>
    </div>
  );
};
