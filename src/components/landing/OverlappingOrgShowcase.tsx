import React, { useState } from 'react';

interface ShowcaseNode {
  id: string;
  label: string;
  role: string;
  type: 'department' | 'section' | 'subject' | 'role';
  x: number; // percentage
  y: number; // percentage
  subtext?: string;
  connectedTo: string[]; // IDs of connected nodes
}

export const OverlappingOrgShowcase: React.FC = () => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodes: ShowcaseNode[] = [
    {
      id: 'school',
      label: 'School',
      role: 'root: Principal',
      type: 'department',
      x: 50,
      y: 12,
      subtext: 'Master Department Root',
      connectedTo: ['middleschool', 'physics']
    },
    {
      id: 'middleschool',
      label: 'Middle School',
      role: 'root: Middle Head (Section)',
      type: 'section',
      x: 32,
      y: 38,
      subtext: 'Section grouping Class 6 & Class 7',
      connectedTo: ['school', 'class6', 'class7', 'math_t1', 'eng_t1', 'math_t2']
    },
    {
      id: 'physics',
      label: 'Physics',
      role: 'root: Physics Coordinator',
      type: 'subject',
      x: 74,
      y: 38,
      subtext: 'Subject Department (Matrix)',
      connectedTo: ['school', 'phys_t', 'class7']
    },
    {
      id: 'class6',
      label: 'Class 6',
      role: 'root: Class 6 Lead',
      type: 'department',
      x: 20,
      y: 65,
      subtext: 'Department with own root',
      connectedTo: ['middleschool', 'math_t1', 'eng_t1']
    },
    {
      id: 'class7',
      label: 'Class 7',
      role: 'root: Class 7 Lead',
      type: 'department',
      x: 44,
      y: 65,
      subtext: 'Department with own root',
      connectedTo: ['middleschool', 'math_t2', 'physics']
    },
    {
      id: 'phys_t',
      label: 'Physics Teacher',
      role: 'role: Assigned Faculty',
      type: 'role',
      x: 74,
      y: 65,
      subtext: 'Under Physics Coordinator',
      connectedTo: ['physics', 'class7']
    },
    {
      id: 'math_t1',
      label: 'Math Teacher',
      role: 'role (Class 6)',
      type: 'role',
      x: 12,
      y: 88,
      subtext: 'Controlled by Middle Head & Class 6 Lead',
      connectedTo: ['class6', 'middleschool']
    },
    {
      id: 'eng_t1',
      label: 'English Teacher',
      role: 'role (Class 6)',
      type: 'role',
      x: 28,
      y: 88,
      subtext: 'Controlled by Middle Head & Class 6 Lead',
      connectedTo: ['class6', 'middleschool']
    },
    {
      id: 'math_t2',
      label: 'Math Teacher',
      role: 'role (Class 7)',
      type: 'role',
      x: 44,
      y: 88,
      subtext: 'Controlled by Middle Head & Class 7 Lead',
      connectedTo: ['class7', 'middleschool']
    }
  ];

  // Connections definition
  const connections = [
    // Ordinary nesting (solid)
    { from: 'school', to: 'middleschool', type: 'solid', label: 'Direct root authority (d=1)' },
    { from: 'school', to: 'physics', type: 'solid', label: 'Direct root authority (d=1)' },
    { from: 'class6', to: 'math_t1', type: 'solid', label: 'Department root → internal role' },
    { from: 'class6', to: 'eng_t1', type: 'solid', label: 'Department root → internal role' },
    { from: 'class7', to: 'math_t2', type: 'solid', label: 'Department root → internal role' },
    { from: 'physics', to: 'phys_t', type: 'solid', label: 'Subject root → internal role' },

    // Section reach directly to roles (dotted)
    { from: 'middleschool', to: 'math_t1', type: 'dotted', label: 'Section root reaches roles directly (skips class root)' },
    { from: 'middleschool', to: 'eng_t1', type: 'dotted', label: 'Section root reaches roles directly (skips class root)' },
    { from: 'middleschool', to: 'math_t2', type: 'dotted', label: 'Section root reaches roles directly (skips class root)' },

    // Overlapping subject matrix connection (sideways cross-cut)
    { from: 'phys_t', to: 'class7', type: 'sideways', label: 'Subject role cross-cuts into Grade cohort' }
  ];

  const activeNode = nodes.find(n => n.id === hoveredNodeId);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Visual Canvas Panel */}
      <div className="relative w-full h-[460px] sm:h-[480px] bg-[#EFEBE2] border border-[#DAD5C9] rounded-sm p-4 overflow-hidden select-none">
        {/* Subtle ledger graph grid */}
        <div className="absolute inset-0 bg-ledger-grid opacity-60 pointer-events-none" />

        {/* SVG Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <marker
              id="arrow-indigo"
              viewBox="0 0 6 6"
              refX="5"
              refY="3"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" fill="#2F3B7A" />
            </marker>
          </defs>
          {connections.map((conn, idx) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            const isRelated = hoveredNodeId 
              ? conn.from === hoveredNodeId || conn.to === hoveredNodeId
              : false;

            const isDimmed = hoveredNodeId !== null && !isRelated;

            let strokeColor = '#DAD5C9';
            if (isRelated) {
              strokeColor = '#2F3B7A';
            } else if (!hoveredNodeId) {
              strokeColor = conn.type === 'dotted' ? '#8A8578' : '#5C574B';
            }

            const strokeWidth = isRelated ? 2 : (conn.type === 'dotted' ? 1.5 : 1.25);
            const strokeDasharray = conn.type === 'dotted' ? '4,4' : conn.type === 'sideways' ? '2,3' : 'none';

            return (
              <line
                key={idx}
                x1={`${fromNode.x}%`}
                y1={`${fromNode.y}%`}
                x2={`${toNode.x}%`}
                y2={`${toNode.y}%`}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeOpacity={isDimmed ? 0.2 : 0.9}
                className="transition-all duration-200"
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const isHovered = hoveredNodeId === node.id;
          const isConnected = hoveredNodeId !== null && activeNode?.connectedTo.includes(node.id);
          const isDimmed = hoveredNodeId !== null && !isHovered && !isConnected;

          return (
            <div
              key={node.id}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className={`absolute z-20 cursor-pointer transition-all duration-200 ${
                isDimmed ? 'opacity-35 scale-98' : 'opacity-100'
              } ${isHovered ? 'scale-102 z-30' : ''}`}
            >
              <div 
                className={`px-3 py-2 rounded-xs border text-left transition-all ${
                  isHovered 
                    ? 'bg-[#F7F5F0] border-[#2F3B7A] shadow-[0_2px_8px_rgba(47,59,122,0.18)] ring-1 ring-[#2F3B7A]' 
                    : isConnected 
                      ? 'bg-[#F7F5F0] border-[#2F3B7A] shadow-xs'
                      : 'bg-[#F7F5F0] border-[#DAD5C9] hover:border-[#1C2438] shadow-xs'
                } ${node.type === 'role' ? 'min-w-[110px]' : 'min-w-[130px]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-bold tracking-tight font-serif ${
                    isHovered || isConnected ? 'text-[#2F3B7A]' : 'text-[#1C2438]'
                  }`}>
                    {node.label}
                  </span>
                  {node.type === 'section' && (
                    <span className="text-[8px] font-mono uppercase px-1 py-0.2 bg-[#E8E4DA] text-[#5C574B] rounded-xs">
                      section
                    </span>
                  )}
                  {node.type === 'subject' && (
                    <span className="text-[8px] font-mono uppercase px-1 py-0.2 bg-[#E8E4DA] text-[#5C574B] rounded-xs">
                      subject
                    </span>
                  )}
                </div>

                <div className="text-[9px] font-mono text-[#8A8578] mt-0.5 tracking-tight truncate">
                  {node.role}
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend Overlay bottom-left */}
        <div className="absolute bottom-3 left-3 z-20 bg-[#F7F5F0]/90 backdrop-blur-xs border border-[#DAD5C9] rounded-xs px-3 py-2 flex flex-wrap items-center gap-4 text-[10px] font-mono text-[#5C574B]">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-[1.5px] bg-[#1C2438] inline-block" />
            <span>Normal root nesting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0 border-t border-dashed border-[#2F3B7A] inline-block" />
            <span className="text-[#2F3B7A]">Section reach directly to roles</span>
          </div>
        </div>

        {/* Interactive inspection hint bottom-right */}
        <div className="absolute bottom-3 right-3 z-20 text-[10px] font-mono text-[#8A8578]">
          {activeNode ? (
            <span className="text-[#1C2438] font-semibold">
              Inspecting: {activeNode.label} &mdash; {activeNode.subtext}
            </span>
          ) : (
            <span>Hover any node to inspect relationship reach</span>
          )}
        </div>
      </div>

      {/* Caption beneath in muted mono text, one short line */}
      <p className="text-xs font-mono text-[#8A8578] text-center mt-3 tracking-tight">
        Structures overlap without merging. Authority flows by relationship semantics, never diagram position.
      </p>
    </div>
  );
};
