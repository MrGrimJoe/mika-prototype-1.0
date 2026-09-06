import { DepartmentNode, TreeStats, Section } from './flowchartTypes';

export function generateId(prefix: string = 'dept'): string {
  return `${prefix}_` + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export function createNewDepartment(departmentName: string = ''): DepartmentNode {
  return {
    id: generateId('dept'),
    department: departmentName,
    roots: [],
    roles: [],
    children: [],
    isCollapsed: false,
  };
}

export function createInitialTree(): DepartmentNode {
  return {
    id: 'root-department',
    department: 'Primary Department',
    roots: ['Headquarters'],
    roles: [],
    children: [],
    isCollapsed: false,
  };
}

export function findNodeById(root: DepartmentNode, id: string): DepartmentNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function findNodeParent(root: DepartmentNode, targetId: string): DepartmentNode | null {
  for (const child of root.children) {
    if (child.id === targetId) return root;
    const foundInChild = findNodeParent(child, targetId);
    if (foundInChild) return foundInChild;
  }
  return null;
}

export function updateNodeInTree(
  root: DepartmentNode,
  id: string,
  updater: (node: DepartmentNode) => DepartmentNode
): DepartmentNode {
  if (root.id === id) {
    return updater({ ...root });
  }

  return {
    ...root,
    children: root.children.map((child) => updateNodeInTree(child, id, updater)),
  };
}

export function addChildToNode(
  root: DepartmentNode,
  parentId: string,
  newChildName: string = ''
): { updatedTree: DepartmentNode; newChildId: string } {
  const newChild = createNewDepartment(newChildName);
  const updatedTree = updateNodeInTree(root, parentId, (node) => ({
    ...node,
    isCollapsed: false, // ensure visible
    children: [...node.children, newChild],
  }));

  return { updatedTree, newChildId: newChild.id };
}

/**
 * Remove a node from tree with option to reparent children or delete entire branch.
 * The root node can NEVER be deleted.
 */
export function removeNodeFromTree(
  root: DepartmentNode,
  idToDelete: string,
  reparentChildren: boolean = false
): DepartmentNode | null {
  // CRITICAL RULE: Root department cannot be removed
  if (root.id === idToDelete) {
    return null;
  }

  function processNode(node: DepartmentNode): DepartmentNode {
    const nextChildren: DepartmentNode[] = [];

    for (const child of node.children) {
      if (child.id === idToDelete) {
        if (reparentChildren && child.children.length > 0) {
          // Adopt the child's children
          nextChildren.push(...child.children.map(processNode));
        }
        // otherwise simply don't add the child
      } else {
        nextChildren.push(processNode(child));
      }
    }

    return {
      ...node,
      children: nextChildren,
    };
  }

  return processNode(root);
}

/**
 * Remove multiple nodes from tree in batch.
 * The root node is strictly excluded from deletion.
 */
export function removeMultipleNodesFromTree(
  root: DepartmentNode,
  idsToDelete: string[],
  reparentChildren: boolean = false
): DepartmentNode {
  const idsSet = new Set(idsToDelete);
  // Ensure root is never deleted
  idsSet.delete(root.id);

  if (idsSet.size === 0) return root;

  function processNode(node: DepartmentNode): DepartmentNode {
    const nextChildren: DepartmentNode[] = [];

    for (const child of node.children) {
      if (idsSet.has(child.id)) {
        if (reparentChildren && child.children.length > 0) {
          nextChildren.push(...child.children.map(processNode));
        }
      } else {
        nextChildren.push(processNode(child));
      }
    }

    return {
      ...node,
      children: nextChildren,
    };
  }

  return processNode(root);
}

/**
 * Assign or unassign section for a list of node IDs.
 * The root department can NEVER be added to a section.
 */
export function assignSectionToNodes(
  root: DepartmentNode,
  nodeIds: string[],
  sectionId: string | undefined
): DepartmentNode {
  const targetIds = new Set(nodeIds);
  // Root node cannot be in any section
  targetIds.delete(root.id);

  function traverse(node: DepartmentNode): DepartmentNode {
    const shouldUpdate = targetIds.has(node.id);
    const updatedNode: DepartmentNode = shouldUpdate
      ? { ...node, sectionId: sectionId }
      : { ...node };

    // Root department MUST never have a sectionId
    if (node.id === root.id) {
      delete updatedNode.sectionId;
    }

    return {
      ...updatedNode,
      children: node.children.map(traverse),
    };
  }

  return traverse(root);
}

/**
 * Remove a section entirely from the tree (clears sectionId on all matching nodes).
 */
export function clearSectionFromTree(root: DepartmentNode, sectionId: string): DepartmentNode {
  function traverse(node: DepartmentNode): DepartmentNode {
    const updated = node.sectionId === sectionId ? { ...node, sectionId: undefined } : { ...node };
    return {
      ...updated,
      children: node.children.map(traverse),
    };
  }
  return traverse(root);
}

export function getAllDepartments(root: DepartmentNode): Array<{ id: string; name: string; sectionId?: string; isRoot: boolean }> {
  const list: Array<{ id: string; name: string; sectionId?: string; isRoot: boolean }> = [];

  function traverse(node: DepartmentNode, isRoot: boolean) {
    list.push({
      id: node.id,
      name: node.department || (isRoot ? 'Primary Department' : 'Untitled Department'),
      sectionId: node.sectionId,
      isRoot,
    });
    for (const child of node.children) {
      traverse(child, false);
    }
  }

  traverse(root, true);
  return list;
}

export function calculateStats(root: DepartmentNode, totalSections: number = 0): TreeStats {
  let totalDepartments = 0;
  let totalRoots = 0;
  let totalRoles = 0;
  let maxDepth = 0;

  function traverse(node: DepartmentNode, depth: number) {
    totalDepartments += 1;
    totalRoots += node.roots.length;
    totalRoles += node.roles.length;
    if (depth > maxDepth) maxDepth = depth;

    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  }

  traverse(root, 1);
  return { totalDepartments, totalRoots, totalRoles, maxDepth, totalSections };
}
