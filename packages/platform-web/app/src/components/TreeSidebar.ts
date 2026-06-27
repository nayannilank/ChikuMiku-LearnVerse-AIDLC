/**
 * TreeSidebar — Expandable/collapsible tree navigation for Parent and Learner dashboards.
 *
 * Renders a hierarchical tree structure in the left sidebar panel.
 * - Parent dashboard: shows learners → subjects → chapters → exercises/quizzes
 * - Learner dashboard: shows subjects → chapters → exercises/quizzes
 *
 * Each node can be expanded/collapsed by clicking its toggle arrow.
 * Nodes without children are leaf nodes (no toggle arrow).
 *
 * Usage:
 *   import { createTreeSidebar, TreeNode } from './components/TreeSidebar';
 *   const sidebar = createTreeSidebar({
 *     title: 'My Subjects',
 *     nodes: [...],
 *     onNodeClick: (nodeId) => { ... },
 *   });
 *   document.body.appendChild(sidebar);
 *
 * Validates: Requirements 3.6, 4.5
 */

import { colors, typography } from '../theme/tokens';

// ============================================================
// Interfaces
// ============================================================

/** A single node in the tree structure. */
export interface TreeNode {
  /** Unique identifier for the node. */
  id: string;
  /** Display label for the node. */
  label: string;
  /** Optional emoji or icon string displayed before the label. */
  icon?: string;
  /** Optional badge (count) displayed as a pill after the label. */
  badge?: string | number;
  /** Optional color for subject-specific styling (left border dot). */
  color?: string;
  /** Optional child nodes. Presence enables expand/collapse. */
  children?: TreeNode[];
  /** Optional click handler for this specific node. */
  onClick?: () => void;
  /** Whether this node starts in expanded state. Defaults to false. */
  isExpanded?: boolean;
}

/** Configuration options for the TreeSidebar component. */
export interface TreeSidebarProps {
  /** Title displayed at the top of the sidebar (e.g., "My Subjects" or "Learners"). */
  title: string;
  /** Root-level tree nodes to render. */
  nodes: TreeNode[];
  /** Optional callback invoked when any node is clicked. Receives the node ID. */
  onNodeClick?: (nodeId: string) => void;
}

// ============================================================
// Constants
// ============================================================

const TREE_SIDEBAR_CLASS = 'learnverse-tree-sidebar';
const TREE_STYLE_ID = 'learnverse-tree-sidebar-style';

/** Indentation per nesting level in pixels. */
const INDENT_PX = 16;

// ============================================================
// Style injection
// ============================================================

/**
 * Injects a <style> element with tree sidebar styles and media query.
 * Only visible on desktop (≥960px). Hidden on mobile.
 */
function ensureTreeSidebarStyle(): void {
  if (document.getElementById(TREE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TREE_STYLE_ID;
  style.textContent = `
    .${TREE_SIDEBAR_CLASS} {
      display: flex;
    }
    @media (max-width: 959px) {
      .${TREE_SIDEBAR_CLASS} {
        display: none !important;
      }
    }
    .tree-node-row:hover {
      background-color: ${colors.background} !important;
    }
    .tree-node-row.selected {
      background-color: #FFF0F7 !important;
      border-left: 3px solid ${colors.primary} !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// Tree node rendering
// ============================================================

/**
 * Creates a single tree node row element.
 *
 * @param node - The tree node data.
 * @param depth - Current nesting depth (0 = root).
 * @param onNodeClick - Global click callback.
 * @returns An HTMLElement containing the node row and its children container.
 */
function createTreeNodeElement(
  node: TreeNode,
  depth: number,
  onNodeClick?: (nodeId: string) => void
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';
  wrapper.setAttribute('data-node-id', node.id);

  const hasChildren = node.children && node.children.length > 0;
  let expanded = node.isExpanded ?? false;

  // --- Node row ---
  const row = document.createElement('div');
  row.className = 'tree-node-row';
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-expanded', String(expanded));
  row.setAttribute('tabindex', '0');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 12px 5px ' + (12 + depth * INDENT_PX) + 'px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    borderLeft: '3px solid transparent',
    boxSizing: 'border-box',
    userSelect: 'none',
    gap: '6px',
    minHeight: '28px',
  });

  // Toggle arrow (▶ / ▼) for expandable nodes
  const toggle = document.createElement('span');
  toggle.className = 'tree-node-toggle';
  toggle.setAttribute('aria-hidden', 'true');
  Object.assign(toggle.style, {
    width: '14px',
    fontSize: '10px',
    color: colors.textMuted,
    flexShrink: '0',
    textAlign: 'center',
    transition: 'transform 0.15s',
  });
  if (hasChildren) {
    toggle.textContent = expanded ? '▼' : '▶';
  } else {
    // Spacer for leaf nodes to keep alignment
    toggle.textContent = '';
  }
  row.appendChild(toggle);

  // Subject color dot (if node has a color)
  if (node.color) {
    const dot = document.createElement('span');
    dot.className = 'tree-node-color-dot';
    dot.setAttribute('aria-hidden', 'true');
    Object.assign(dot.style, {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: node.color,
      flexShrink: '0',
    });
    row.appendChild(dot);
  }

  // Icon (emoji)
  if (node.icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'tree-node-icon';
    iconEl.textContent = node.icon;
    iconEl.setAttribute('aria-hidden', 'true');
    Object.assign(iconEl.style, {
      fontSize: '13px',
      flexShrink: '0',
    });
    row.appendChild(iconEl);
  }

  // Label
  const label = document.createElement('span');
  label.className = 'tree-node-label';
  label.textContent = node.label;
  // Section headers (depth 0) are semibold; deeper nodes are regular weight
  const isHeader = depth === 0 || (hasChildren && depth <= 1);
  Object.assign(label.style, {
    fontSize: isHeader ? '14px' : '13px',
    fontWeight: isHeader ? '600' : 'normal',
    color: colors.dark,
    flex: '1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });
  row.appendChild(label);

  // Badge (count pill)
  if (node.badge !== undefined && node.badge !== null) {
    const badge = document.createElement('span');
    badge.className = 'tree-node-badge';
    badge.textContent = String(node.badge);
    Object.assign(badge.style, {
      fontSize: '11px',
      fontWeight: '500',
      color: colors.textMuted,
      backgroundColor: '#F0EDF5',
      borderRadius: '10px',
      padding: '1px 7px',
      flexShrink: '0',
    });
    row.appendChild(badge);
  }

  wrapper.appendChild(row);

  // --- Children container ---
  let childrenContainer: HTMLElement | null = null;
  if (hasChildren) {
    childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-node-children';
    childrenContainer.setAttribute('role', 'group');
    Object.assign(childrenContainer.style, {
      display: expanded ? 'block' : 'none',
    });

    for (const child of node.children!) {
      childrenContainer.appendChild(createTreeNodeElement(child, depth + 1, onNodeClick));
    }
    wrapper.appendChild(childrenContainer);
  }

  // --- Event handlers ---
  function toggleExpand(): void {
    if (!hasChildren || !childrenContainer) return;
    expanded = !expanded;
    toggle.textContent = expanded ? '▼' : '▶';
    childrenContainer.style.display = expanded ? 'block' : 'none';
    row.setAttribute('aria-expanded', String(expanded));
  }

  row.addEventListener('click', () => {
    if (hasChildren) {
      toggleExpand();
    }
    // Fire callbacks
    if (node.onClick) node.onClick();
    if (onNodeClick) onNodeClick(node.id);
  });

  row.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      row.click();
    }
  });

  return wrapper;
}

// ============================================================
// Public API
// ============================================================

/**
 * Creates the tree sidebar DOM element.
 *
 * The sidebar is 240px wide, uses a white background with a subtle right border,
 * and only appears on viewports ≥ 960px (controlled via CSS media query).
 *
 * @param props - Configuration with title, nodes array, and optional click callback.
 * @returns An HTMLElement suitable for fixed positioning in the layout.
 */
export function createTreeSidebar(props: TreeSidebarProps): HTMLElement {
  ensureTreeSidebarStyle();

  const aside = document.createElement('aside');
  aside.className = TREE_SIDEBAR_CLASS;
  aside.setAttribute('aria-label', `${props.title} navigation`);
  aside.setAttribute('role', 'tree');
  Object.assign(aside.style, {
    width: '240px',
    minWidth: '240px',
    maxWidth: '240px',
    flexDirection: 'column',
    backgroundColor: colors.white,
    borderRight: `1px solid ${colors.border}`,
    padding: '12px 0',
    overflowY: 'auto',
    overflowX: 'hidden',
    boxSizing: 'border-box',
  });

  // Sidebar title
  const heading = document.createElement('h2');
  heading.className = 'tree-sidebar-heading';
  heading.textContent = props.title;
  Object.assign(heading.style, {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight,
    color: colors.dark,
    margin: '0',
    padding: '4px 16px 12px',
  });
  aside.appendChild(heading);

  // Empty state
  if (props.nodes.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'tree-sidebar-empty';
    emptyState.textContent = 'No items to display';
    Object.assign(emptyState.style, {
      fontSize: typography.body.size,
      color: colors.textMuted,
      padding: '8px 16px',
      margin: '0',
      fontStyle: 'italic',
    });
    aside.appendChild(emptyState);
    return aside;
  }

  // Render tree nodes
  for (const node of props.nodes) {
    aside.appendChild(createTreeNodeElement(node, 0, props.onNodeClick));
  }

  return aside;
}
