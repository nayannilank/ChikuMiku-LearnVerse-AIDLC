/**
 * wrapInResponsiveLayout — Utility that wraps a content element in the
 * ResponsiveLayout shell for use by route handlers and the async route container.
 *
 * Provides desktop NavigationShell (TopNav + Sidebar) at ≥960px
 * and mobile full-width + bottom nav at <960px.
 *
 * Extracted from main.ts so it can be shared across route utilities.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 15.4
 */

import { createResponsiveLayout } from '../components/ResponsiveLayout';
import { SidebarSubject } from '../components/Sidebar';
import { TreeSidebarProps } from '../components/TreeSidebar';

/** Maps mobile tab IDs to hash routes for navigation. */
const MOBILE_TAB_ROUTES: Record<string, string> = {
  home: '#dashboard',
  chapters: '#subjects',
  scan: '#scan',
  revision: '#revision',
  me: '#me',
};

/** Maps hash routes to mobile tab IDs for highlighting. */
function getActiveMobileTab(hash: string): string {
  switch (hash) {
    case '#dashboard':
      return 'home';
    case '#subjects':
      return 'chapters';
    case '#scan':
      return 'scan';
    case '#revision':
      return 'revision';
    case '#me':
    case '#progress':
      return 'me';
    default:
      return 'home';
  }
}

/**
 * Wraps a content element in the ResponsiveLayout shell.
 * Provides desktop NavigationShell (TopNav + Sidebar) at ≥960px
 * and mobile full-width + bottom nav at <960px.
 *
 * The sidebar shows an empty state when no real learner data is available.
 * When treeSidebar props are provided, uses the tree sidebar instead.
 *
 * @param content - The HTMLElement to render as the main content area.
 * @param activeRoute - The current hash route (e.g., '#explain/abc123') for nav highlighting.
 * @param treeSidebar - Optional TreeSidebarProps for hierarchical navigation.
 * @returns An HTMLElement containing the full responsive layout wrapping the content.
 */
export function wrapInResponsiveLayout(
  content: HTMLElement,
  activeRoute: string,
  treeSidebar?: TreeSidebarProps
): HTMLElement {
  // No hardcoded subjects — show empty sidebar until real data is loaded from API
  const subjects: SidebarSubject[] = [];

  const username = localStorage.getItem('learnverse_username') || 'User';

  return createResponsiveLayout({
    onNavigate: (route: string) => {
      window.location.hash = route;
    },
    onLogout: () => {
      window.location.hash = '#';
    },
    activeRoute,
    userName: username,
    subjects,
    onSelectSubject: (subjectId: string) => {
      window.location.hash = `#subject-${subjectId.toLowerCase()}`;
    },
    content,
    onMobileTabPress: (tabId: string) => {
      const route = MOBILE_TAB_ROUTES[tabId] || '#dashboard';
      window.location.hash = route;
    },
    activeMobileTab: getActiveMobileTab(activeRoute),
    treeSidebar,
  });
}
