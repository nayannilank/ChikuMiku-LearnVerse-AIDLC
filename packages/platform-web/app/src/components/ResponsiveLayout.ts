/**
 * ResponsiveLayout — Responsive layout shell with breakpoint-based rendering.
 *
 * Detects viewport width and renders different layouts:
 * - Desktop (≥960px): NavigationShell with TopNav + Sidebar + content
 * - Mobile (<960px): Full-width content with bottom navigation bar
 *
 * Handles window resize events to dynamically switch between layouts.
 *
 * Usage:
 *   import { createResponsiveLayout } from './components/ResponsiveLayout';
 *   const layout = createResponsiveLayout({
 *     onNavigate: (route) => { ... },
 *     onLogout: () => { ... },
 *     activeRoute: '#dashboard',
 *     subjects: [...],
 *     onSelectSubject: (id) => { ... },
 *     content: myContentElement,
 *     onMobileTabPress: (tabId) => { ... },
 *     activeMobileTab: 'home',
 *   });
 *   document.body.appendChild(layout);
 *
 * Validates: Requirements 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { createNavigationShell, NavigationShellOptions } from './NavigationShell';
import { createMobileBottomNav, MobileBottomNavOptions } from './MobileBottomNav';
import { colors } from '../theme/tokens';
import { SidebarSubject } from './Sidebar';
import { TreeSidebarProps } from './TreeSidebar';

/** Breakpoint threshold: desktop ≥ 960px, mobile < 960px. */
const DESKTOP_BREAKPOINT = 960;

/**
 * Configuration options for the ResponsiveLayout component.
 * Combines NavigationShell options with mobile tab press handling.
 */
export interface ResponsiveLayoutOptions {
  /** Callback invoked when a top nav link is activated (desktop). */
  onNavigate: (route: string) => void;
  /** Callback invoked when the logout button is clicked. */
  onLogout: () => void;
  /** Currently active route hash for desktop nav highlighting. */
  activeRoute?: string;
  /** User name for the desktop avatar initials. */
  userName?: string;
  /** List of subjects for the desktop sidebar. */
  subjects: SidebarSubject[];
  /** Callback invoked when a desktop sidebar subject is selected. */
  onSelectSubject: (subjectId: string) => void;
  /** The content element to render in the main content area. */
  content: HTMLElement;
  /** Callback invoked when a mobile bottom nav tab is pressed. */
  onMobileTabPress: (tabId: string) => void;
  /** Currently active mobile tab ID for highlighting. */
  activeMobileTab?: string;
  /** Optional TreeSidebar props for hierarchical navigation. */
  treeSidebar?: TreeSidebarProps;
}

const RESPONSIVE_STYLE_ID = 'learnverse-responsive-layout-style';

/**
 * Injects responsive layout styles.
 * Mobile content gets bottom padding to account for the 44px bottom nav.
 */
function ensureResponsiveStyle(): void {
  if (document.getElementById(RESPONSIVE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = RESPONSIVE_STYLE_ID;
  style.textContent = `
    .learnverse-responsive-mobile-content {
      padding-bottom: 52px;
    }
    @media (min-width: ${DESKTOP_BREAKPOINT}px) {
      .learnverse-responsive-mobile-content {
        padding-bottom: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates a responsive layout element that switches between desktop and mobile modes.
 *
 * For desktop (≥960px):
 * - Renders the full NavigationShell (TopNav + Sidebar + content)
 *
 * For mobile (<960px):
 * - Renders full-width content with a fixed 44px bottom navigation bar
 *
 * The layout listens to window.matchMedia changes to switch layouts
 * dynamically when the viewport crosses the 960px threshold.
 *
 * @param options - Configuration combining desktop shell and mobile nav options.
 * @returns An HTMLElement containing the responsive layout.
 */
export function createResponsiveLayout(options: ResponsiveLayoutOptions): HTMLElement {
  ensureResponsiveStyle();

  const container = document.createElement('div');
  container.className = 'learnverse-responsive-layout';
  Object.assign(container.style, {
    minHeight: '100vh',
    backgroundColor: colors.background,
  });

  const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

  /**
   * Build the desktop layout using NavigationShell.
   */
  function buildDesktopLayout(): HTMLElement {
    const shellOptions: NavigationShellOptions = {
      onNavigate: options.onNavigate,
      onLogout: options.onLogout,
      activeRoute: options.activeRoute,
      userName: options.userName,
      subjects: options.subjects,
      onSelectSubject: options.onSelectSubject,
      content: options.content,
      treeSidebar: options.treeSidebar,
    };
    return createNavigationShell(shellOptions);
  }

  /**
   * Build the mobile layout with full-width content and bottom nav.
   */
  function buildMobileLayout(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'learnverse-responsive-mobile-wrapper';
    Object.assign(wrapper.style, {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    });

    // Full-width content area
    const contentArea = document.createElement('main');
    contentArea.className = 'learnverse-responsive-mobile-content';
    contentArea.setAttribute('role', 'main');
    Object.assign(contentArea.style, {
      flex: '1',
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px',
    });
    contentArea.appendChild(options.content);
    wrapper.appendChild(contentArea);

    // Bottom navigation bar (Req 4.1, 4.2, 3.5)
    const bottomNavOptions: MobileBottomNavOptions = {
      activeTab: options.activeMobileTab,
      onTabPress: options.onMobileTabPress,
    };
    const bottomNav = createMobileBottomNav(bottomNavOptions);
    wrapper.appendChild(bottomNav);

    return wrapper;
  }

  /**
   * Renders the appropriate layout based on current viewport width.
   */
  function renderLayout(): void {
    container.innerHTML = '';
    if (mediaQuery.matches) {
      container.appendChild(buildDesktopLayout());
    } else {
      container.appendChild(buildMobileLayout());
    }
  }

  // Initial render
  renderLayout();

  // Listen for viewport changes to switch layouts dynamically
  const handleMediaChange = (): void => {
    renderLayout();
  };

  // Use addEventListener for broader compatibility
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMediaChange);
  }

  return container;
}
