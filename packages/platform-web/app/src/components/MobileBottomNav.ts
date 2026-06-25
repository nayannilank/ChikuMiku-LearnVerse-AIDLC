/**
 * MobileBottomNav — DOM-based bottom navigation bar for web mobile viewports.
 *
 * Creates an HTMLElement displaying a fixed 44px bottom tab bar with 5 tabs:
 * Home, Chapters, Scan, Revision, Me. Each tab has an icon and label with
 * active tab highlighting.
 *
 * This is a DOM component for the web app's mobile view (≤959px), separate
 * from the class-based BottomNavigation in platform-mobile/ui.
 *
 * Usage:
 *   import { createMobileBottomNav } from './components/MobileBottomNav';
 *   document.body.appendChild(createMobileBottomNav({
 *     activeTab: 'home',
 *     onTabPress: (tabId) => { ... },
 *   }));
 *
 * Validates: Requirements 4.1, 4.2, 3.5
 */

import { colors, typography } from '../theme/tokens';

/** Tab definition for the mobile bottom navigation. */
export interface MobileTab {
  id: string;
  label: string;
  icon: string;
  route: string;
}

/** Configuration options for createMobileBottomNav. */
export interface MobileBottomNavOptions {
  /** Currently active tab ID for visual highlighting. */
  activeTab?: string;
  /** Callback invoked when a tab is pressed. Receives the tab ID. */
  onTabPress: (tabId: string) => void;
}

/** The five default tabs per Requirement 4.1. */
const MOBILE_TABS: MobileTab[] = [
  { id: 'home', label: 'Home', icon: '⌂', route: '#dashboard' },
  { id: 'chapters', label: 'Chapters', icon: '📖', route: '#subjects' },
  { id: 'scan', label: 'Scan', icon: '📷', route: '#scan' },
  { id: 'revision', label: 'Revision', icon: '🔄', route: '#revision' },
  { id: 'me', label: 'Me', icon: '👤', route: '#me' },
];

const BOTTOM_NAV_STYLE_ID = 'learnverse-mobile-bottom-nav-style';

/**
 * Injects a <style> element for the mobile bottom nav.
 * Only visible on viewports < 960px.
 */
function ensureBottomNavStyle(): void {
  if (document.getElementById(BOTTOM_NAV_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = BOTTOM_NAV_STYLE_ID;
  style.textContent = `
    .learnverse-mobile-bottom-nav {
      display: flex;
    }
    @media (min-width: 960px) {
      .learnverse-mobile-bottom-nav {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates a DOM-based mobile bottom navigation bar element.
 *
 * The returned `<nav>` element is 44px tall, fixed at the bottom of the
 * viewport, full-width, and contains 5 evenly-spaced tabs with icons
 * and labels. The active tab is visually highlighted with the primary color.
 *
 * @param options - Configuration with active tab and tab press callback.
 * @returns An HTMLElement suitable for fixed positioning at the viewport bottom.
 */
export function createMobileBottomNav(options: MobileBottomNavOptions): HTMLElement {
  ensureBottomNavStyle();

  const nav = document.createElement('nav');
  nav.className = 'learnverse-mobile-bottom-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');
  Object.assign(nav.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    right: '0',
    height: '44px',
    backgroundColor: colors.white,
    borderTop: `1px solid ${colors.border}`,
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: '200',
    boxSizing: 'border-box',
  });

  for (const tab of MOBILE_TABS) {
    const isActive = options.activeTab === tab.id;

    const button = document.createElement('button');
    button.className = 'mobile-bottom-nav-tab';
    button.type = 'button';
    button.setAttribute('aria-label', tab.label);
    if (isActive) {
      button.setAttribute('aria-current', 'page');
    }

    Object.assign(button.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '1',
      height: '100%',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      padding: '2px 0',
      color: isActive ? colors.primary : colors.textMuted,
      transition: 'color 0.2s',
    });

    // Icon
    const iconEl = document.createElement('span');
    iconEl.className = 'mobile-bottom-nav-icon';
    iconEl.textContent = tab.icon;
    iconEl.setAttribute('aria-hidden', 'true');
    Object.assign(iconEl.style, {
      fontSize: '16px',
      lineHeight: '1',
    });

    // Label
    const labelEl = document.createElement('span');
    labelEl.className = 'mobile-bottom-nav-label';
    labelEl.textContent = tab.label;
    Object.assign(labelEl.style, {
      fontSize: typography.captionSm.size,
      fontWeight: isActive ? typography.label.weight : typography.caption.weight,
      marginTop: '1px',
      lineHeight: '1',
    });

    button.appendChild(iconEl);
    button.appendChild(labelEl);

    // Tab press handler (Req 4.2)
    button.addEventListener('click', () => {
      options.onTabPress(tab.id);
    });

    // Focus style for accessibility
    button.addEventListener('focus', () => {
      button.style.outline = `2px solid ${colors.primary}`;
      button.style.outlineOffset = '-2px';
    });
    button.addEventListener('blur', () => {
      button.style.outline = 'none';
    });

    nav.appendChild(button);
  }

  return nav;
}

/** Exported MOBILE_TABS for reference by other components. */
export { MOBILE_TABS };
