/**
 * TopNavigation — Enhanced top navigation bar component.
 *
 * Creates an HTMLElement displaying a fixed-height navigation bar with the
 * ChikuMiku LearnVerse logo on the left, navigation links (Dashboard, Subjects,
 * Revision, Progress) in the center, and a user avatar + logout button on the right.
 * All links are keyboard-navigable with hover/focus states and active highlighting.
 *
 * This is the enhanced version of TopNavBar, adding logout functionality and
 * active route highlighting.
 *
 * Usage:
 *   import { createTopNavigation } from './components/TopNavigation';
 *   document.body.appendChild(createTopNavigation({
 *     onNavigate: (route) => { ... },
 *     onLogout: () => { ... },
 *     activeRoute: '#dashboard',
 *   }));
 *
 * Validates: Requirements 4.3, 4.4
 */

import { createHeaderLogo } from './HeaderLogo';
import { colors, typography } from '../theme/tokens';

/**
 * Configuration options for the TopNavigation component.
 */
export interface TopNavigationOptions {
  /** Callback invoked when a navigation link is activated (click or Enter key). */
  onNavigate: (route: string) => void;
  /** Callback invoked when the logout button is clicked. */
  onLogout: () => void;
  /** The currently active route hash (e.g. '#dashboard'). Used for visual highlighting. */
  activeRoute?: string;
  /** User name displayed as initials in the avatar. Defaults to 'A'. */
  userName?: string;
}

/** Navigation link definition. */
interface NavLink {
  label: string;
  route: string;
}

const NAV_LINKS: NavLink[] = [
  { label: 'Dashboard', route: '#dashboard' },
  { label: 'Subjects', route: '#subjects' },
  { label: 'Revision', route: '#revision' },
  { label: 'Progress', route: '#progress' },
];

/**
 * Returns the user's initials from a name string.
 * Falls back to 'A' if no name provided.
 */
function getInitials(name?: string): string {
  if (!name || name.trim().length === 0) return 'A';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Creates an enhanced top navigation bar DOM element.
 *
 * The returned `<nav>` element is 36px tall with a dark (#2C2341) background.
 * It contains the ChikuMiku LearnVerse logo on the left, four navigation
 * links (Dashboard, Subjects, Revision, Progress) in the center, and a
 * user avatar + logout button on the right.
 *
 * All navigation links are focusable via Tab/Shift+Tab, display hover/focus
 * indicators, visually highlight the active route, and trigger the `onNavigate`
 * callback with the hash route on click or Enter key press.
 *
 * @param options - Configuration with callbacks, active route, and user name.
 * @returns An HTMLElement suitable for insertion at the top of the page.
 */
export function createTopNavigation(options: TopNavigationOptions): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'top-navigation';
  nav.setAttribute('aria-label', 'Main navigation');
  Object.assign(nav.style, {
    display: 'flex',
    alignItems: 'center',
    height: '36px',
    backgroundColor: colors.dark,
    padding: '0 16px',
    boxSizing: 'border-box',
    position: 'relative',
    zIndex: '100',
  });

  // Logo on the left
  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 28,
    altText: 'ChikuMiku LearnVerse',
  });
  logo.style.marginRight = '24px';
  logo.style.flexShrink = '0';
  nav.appendChild(logo);

  // Navigation links container
  const linksContainer = document.createElement('div');
  linksContainer.className = 'top-navigation-links';
  Object.assign(linksContainer.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flex: '1',
  });

  for (const { label, route } of NAV_LINKS) {
    const link = document.createElement('a');
    link.className = 'top-navigation-link';
    link.textContent = label;
    link.href = route;
    link.setAttribute('role', 'link');
    link.tabIndex = 0;

    const isActive = options.activeRoute === route;

    Object.assign(link.style, {
      color: colors.white,
      fontSize: typography.bodySm.size,
      fontWeight: typography.button.weight,
      textDecoration: 'none',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px',
      transition: 'background-color 0.2s, text-decoration 0.2s',
      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
      borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
    });

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    }

    // Hover indicator (Req 4.4)
    link.addEventListener('mouseenter', () => {
      if (!isActive) {
        link.style.textDecoration = 'underline';
        link.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      }
    });
    link.addEventListener('mouseleave', () => {
      if (!isActive) {
        link.style.textDecoration = 'none';
        link.style.backgroundColor = 'transparent';
      }
    });

    // Focus indicator (Req 4.4)
    link.addEventListener('focus', () => {
      link.style.outline = `2px solid ${colors.primary}`;
      link.style.outlineOffset = '2px';
      if (!isActive) {
        link.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      }
    });
    link.addEventListener('blur', () => {
      link.style.outline = 'none';
      if (!isActive) {
        link.style.backgroundColor = 'transparent';
      }
    });

    // Click handler (Req 4.4)
    link.addEventListener('click', (e) => {
      e.preventDefault();
      options.onNavigate(route);
    });

    // Keyboard navigation — Enter key (Req 4.4)
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        options.onNavigate(route);
      }
    });

    linksContainer.appendChild(link);
  }

  nav.appendChild(linksContainer);

  // Right section: avatar + logout
  const rightSection = document.createElement('div');
  rightSection.className = 'top-navigation-right';
  Object.assign(rightSection.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: '0',
  });

  // User avatar (Req 4.3)
  const avatar = document.createElement('div');
  avatar.className = 'top-navigation-avatar';
  avatar.textContent = getInitials(options.userName);
  avatar.setAttribute('aria-label', `User avatar${options.userName ? ': ' + options.userName : ''}`);
  Object.assign(avatar.style, {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    backgroundColor: colors.primary,
    color: colors.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: typography.labelSm.size,
    fontWeight: typography.button.weight,
  });

  rightSection.appendChild(avatar);

  // Logout button (Req 4.3)
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'top-navigation-logout';
  logoutBtn.textContent = 'Logout';
  logoutBtn.type = 'button';
  logoutBtn.setAttribute('aria-label', 'Logout');
  Object.assign(logoutBtn.style, {
    backgroundColor: 'transparent',
    border: `1px solid rgba(255, 255, 255, 0.4)`,
    borderRadius: '4px',
    color: colors.white,
    fontSize: typography.labelSm.size,
    fontWeight: typography.button.weight,
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
  });

  logoutBtn.addEventListener('mouseenter', () => {
    logoutBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    logoutBtn.style.borderColor = 'rgba(255, 255, 255, 0.7)';
  });
  logoutBtn.addEventListener('mouseleave', () => {
    logoutBtn.style.backgroundColor = 'transparent';
    logoutBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
  });
  logoutBtn.addEventListener('focus', () => {
    logoutBtn.style.outline = `2px solid ${colors.primary}`;
    logoutBtn.style.outlineOffset = '2px';
  });
  logoutBtn.addEventListener('blur', () => {
    logoutBtn.style.outline = 'none';
  });

  logoutBtn.addEventListener('click', () => {
    options.onLogout();
  });

  rightSection.appendChild(logoutBtn);
  nav.appendChild(rightSection);

  return nav;
}
