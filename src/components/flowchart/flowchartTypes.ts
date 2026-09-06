export interface Section {
  id: string;
  name: string;
  shade: 'ash' | 'silver' | 'slate' | 'charcoal' | 'graphite' | 'sand' | 'emerald' | 'indigo' | 'amber' | 'rose' | 'sky';
  borderStyle?: 'solid' | 'dashed' | 'double';
}

export interface DepartmentNode {
  id: string;
  department: string;
  roots: string[];
  roles: string[];
  children: DepartmentNode[];
  isCollapsed?: boolean;
  sectionId?: string; // ID of section it belongs to (never on root)
}

export type PaperStyle = 'clean' | 'grid' | 'dots' | 'ledger';

export interface TreeStats {
  totalDepartments: number;
  totalRoots: number;
  totalRoles: number;
  maxDepth: number;
  totalSections: number;
}
