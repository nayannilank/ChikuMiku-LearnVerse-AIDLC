/**
 * NavigationShell — Layout wrapper combining TopNavigation + Sidebar + content area.
 *
 * Creates an HTMLElement that provides the full desktop navigation layout:
 * - TopNavigation fixed at the top (full-width, 36px height)
 * - Sidebar fixed on the left below TopNav (visible only at ≥ 960px)
 * - Main content area filling the remaining space
 *
 * Usage:
 *   import { createNavigationShell } from './components/NavigationShell';
 *   const shell = createNavigationShell({
 *     onNavigate: (route) => { ... },
 *     onLogout: () => { ... },
 *     activeRoute: '#dashboard',
 *     subjects: [...],
 *     onSelectSubject: (id) => { ... },
 *     content: myContentElement,
 *   });
 *   document.body.appendChild(shell);
 *
 * Validates: Requirements 4.3, 4.4, 4.5, 3.6
 */

import { createTopNavigation, TopNavigationOptions } from './TopNavigation';
import { createSidebar, SidebarSubject, SidebarOptions } from './Sidebar';
import { createTreeSidebar, TreeSidebarProps } from './TreeSidebar';
import { colors } from '../theme/tokens';

/**
 * Configuration options for the NavigationShell component.
 */
export interface NavigationShellOptions {
  /** Callback invoked when a top nav link is activated. */
  onNavigate: (route: string) => void;
  /** Callback invoked when the logout button is clicked. */
  onLogout: () => void;
  /** Currently active route hash for visual highlighting. */
  activeRoute?: string;
  /** User name for the avatar initials. */
  userName?: string;
  /** List of subjects to display in the sidebar (legacy flat sidebar). */
  subjects: SidebarSubject[];
  /** Callback invoked when a sidebar subject is selected. */
  onSelectSubject: (subjectId: string) => void;
  /** The content element to render in the main content area. */
  content: HTMLElement;
  /**
   * Optional TreeSidebar props. When provided, renders the tree sidebar
   * instead of the flat subject sidebar. Used for Parent and Learner dashboards.
   */
  treeSidebar?: TreeSidebarProps;
}

/** Unique class name for the shell's responsive media query. */
const SHELL_CONTENT_CLASS = 'learnverse-shell-content';
const SHELL_STYLE_ID = 'learnverse-shell-media-style';

/**
 * Injects a <style> element for responsive content margin adjustment.
 * On viewports ≥ 960px, the content gets a left margin for the sidebar.
 * On narrower viewports, it fills the full width.
 */
function ensureShellMediaStyle(): void {
  if (document.getElementById(SHELL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHELL_STYLE_ID;
  style.textContent = `
    .${SHELL_CONTENT_CLASS} {
      margin-left: 0;
    }
    @media (min-width: 960px) {
      .${SHELL_CONTENT_CLASS} {
        margin-left: 200px;
      }
      .${SHELL_CONTENT_CLASS}.tree-sidebar-active {
        margin-left: 240px;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates the full navigation shell layout.
 *
 * Layout structure:
 * - Fixed top bar (36px, full width, z-index 100)
 * - Fixed sidebar (200px, left, below top bar, visible ≥ 960px)
 * - Content area (fills remaining space with appropriate margins)
 *
 * @param options - Configuration combining top nav, sidebar, and content options.
 * @returns An HTMLElement containing the complete navigation shell layout.
 */
export function createNavigationShell(options: NavigationShellOptions): HTMLElement {
  ensureShellMediaStyle();

  const shell = document.createElement('div');
  shell.className = 'navigation-shell';
  Object.assign(shell.style, {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: colors.background,
  });

  // Top Navigation (fixed at top, full width)
  const topNavOptions: TopNavigationOptions = {
    onNavigate: options.onNavigate,
    onLogout: options.onLogout,
    activeRoute: options.activeRoute,
    userName: options.userName,
  };
  const topNav = createTopNavigation(topNavOptions);
  Object.assign(topNav.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '100',
  });
  shell.appendChild(topNav);

  // Body area below the top nav
  const body = document.createElement('div');
  body.className = 'navigation-shell-body';
  Object.assign(body.style, {
    display: 'flex',
    flex: '1',
    marginTop: '36px', // Height of the top nav
  });

  // Sidebar (fixed left, below top nav)
  // Use TreeSidebar if treeSidebar props are provided; otherwise fall back to flat sidebar
  let sidebar: HTMLElement;
  let useTreeSidebar = false;

  if (options.treeSidebar) {
    useTreeSidebar = true;
    sidebar = createTreeSidebar(options.treeSidebar);
  } else {
    const sidebarOptions: SidebarOptions = {
      subjects: options.subjects,
      onSelectSubject: options.onSelectSubject,
      activeRoute: options.activeRoute,
    };
    sidebar = createSidebar(sidebarOptions);
  }
  Object.assign(sidebar.style, {
    position: 'fixed',
    top: '36px',
    left: '0',
    bottom: '0',
    zIndex: '90',
  });
  body.appendChild(sidebar);

  // Main content area
  const main = document.createElement('main');
  main.className = SHELL_CONTENT_CLASS + (useTreeSidebar ? ' tree-sidebar-active' : '');
  main.setAttribute('role', 'main');
  Object.assign(main.style, {
    flex: '1',
    padding: '16px',
    boxSizing: 'border-box',
    minHeight: '0',
  });

  main.appendChild(options.content);
  body.appendChild(main);
  shell.appendChild(body);

  return shell;
}
