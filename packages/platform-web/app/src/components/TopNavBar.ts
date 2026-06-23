/**
 * TopNavBar — Framework-agnostic top navigation bar component.
 *
 * Creates an HTMLElement displaying a fixed-height navigation bar with the
 * ChikuMiku LearnVerse logo on the left, navigation links in the center,
 * and a user avatar on the right. All links are keyboard-navigable and
 * trigger hash-based navigation via the provided callback.
 *
 * Usage:
 *   import { createTopNavBar } from './components/TopNavBar';
 *   document.body.appendChild(createTopNavBar({ onNavigate: (route) => { ... } }));
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
 */

import { createHeaderLogo } from './HeaderLogo';

/**
 * Configuration options for the TopNavBar component.
 */
export interface TopNavBarOptions {
  /** Callback invoked when a navigation link is activated (click or Enter key). */
  onNavigate: (route: string) => void;
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
 * Creates a top navigation bar DOM element.
 *
 * The returned `<nav>` element is 36px tall with a dark background (#2C2341).
 * It contains the ChikuMiku LearnVerse logo on the left, four navigation
 * links (Dashboard, Subjects, Revision, Progress) in the center, and a
 * circular avatar with the letter "A" on the right.
 *
 * All navigation links are focusable via Tab/Shift+Tab, display hover/focus
 * indicators, and trigger the `onNavigate` callback with the hash route on
 * click or Enter key press.
 *
 * @param options - Configuration with `onNavigate` callback.
 * @returns An HTMLElement suitable for insertion at the top of the page.
 */
export function createTopNavBar(options: TopNavBarOptions): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'top-nav-bar';
  nav.setAttribute('aria-label', 'Main navigation');
  Object.assign(nav.style, {
    display: 'flex',
    alignItems: 'center',
    height: '36px',
    backgroundColor: '#2C2341',
    padding: '0 16px',
    boxSizing: 'border-box',
  });

  // Logo on the left (Req 1.1, 1.2)
  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 36,
    altText: 'ChikuMiku LearnVerse',
  });
  logo.style.marginRight = '24px';
  logo.style.flexShrink = '0';
  nav.appendChild(logo);

  // Navigation links container (Req 1.3, 1.4, 1.5, 1.6, 1.7)
  const linksContainer = document.createElement('div');
  linksContainer.className = 'top-nav-links';
  Object.assign(linksContainer.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    flex: '1',
  });

  for (const { label, route } of NAV_LINKS) {
    const link = document.createElement('a');
    link.className = 'top-nav-link';
    link.textContent = label;
    link.href = route;
    link.setAttribute('role', 'link');
    link.tabIndex = 0;

    Object.assign(link.style, {
      color: '#FFFFFF',
      fontSize: '12px',
      fontWeight: '600',
      textDecoration: 'none',
      cursor: 'pointer',
      padding: '4px 8px',
      borderRadius: '4px',
      transition: 'background-color 0.2s, text-decoration 0.2s',
    });

    // Hover indicator (Req 1.6)
    link.addEventListener('mouseenter', () => {
      link.style.textDecoration = 'underline';
      link.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    link.addEventListener('mouseleave', () => {
      link.style.textDecoration = 'none';
      link.style.backgroundColor = 'transparent';
    });

    // Focus indicator (Req 1.6)
    link.addEventListener('focus', () => {
      link.style.textDecoration = 'underline';
      link.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    link.addEventListener('blur', () => {
      link.style.textDecoration = 'none';
      link.style.backgroundColor = 'transparent';
    });

    // Click handler (Req 1.8, 1.9)
    link.addEventListener('click', (e) => {
      e.preventDefault();
      options.onNavigate(route);
    });

    // Keyboard navigation — Enter key (Req 1.7, 1.8)
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        options.onNavigate(route);
      }
    });

    linksContainer.appendChild(link);
  }

  nav.appendChild(linksContainer);

  // Avatar on the right (Req 1.3)
  const avatar = document.createElement('div');
  avatar.className = 'top-nav-avatar';
  avatar.textContent = 'A';
  avatar.setAttribute('aria-label', 'User avatar');
  Object.assign(avatar.style, {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#E94F9B',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: '0',
  });

  nav.appendChild(avatar);

  return nav;
}
