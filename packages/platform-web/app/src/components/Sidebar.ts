/**
 * Sidebar — Framework-agnostic sidebar component for web viewports.
 *
 * Creates an HTMLElement displaying a sidebar listing all subjects with their
 * colored icons and progress indicators. The sidebar is 180-220px wide and
 * only visible on screens wider than 960px (controlled via CSS media query).
 *
 * Usage:
 *   import { createSidebar } from './components/Sidebar';
 *   document.body.appendChild(createSidebar({
 *     subjects: [{ name: 'Maths', color: '#E94F9B', progress: 75 }],
 *     onSelectSubject: (id) => { ... },
 *   }));
 *
 * Validates: Requirements 4.5, 3.6
 */

import { colors, typography } from '../theme/tokens';

/** Subject item for the sidebar. */
export interface SidebarSubject {
  /** Display name of the subject. */
  name: string;
  /** Color hex string used for the subject's dot icon. */
  color: string;
  /** Progress percentage (0-100). */
  progress: number;
}

/**
 * Configuration options for the Sidebar component.
 */
export interface SidebarOptions {
  /** List of subjects to display with their color and progress. */
  subjects: SidebarSubject[];
  /** Callback invoked when a subject is clicked. Receives the subject name as ID. */
  onSelectSubject: (subjectId: string) => void;
  /** Currently active route hash for highlighting the corresponding subject. */
  activeRoute?: string;
}

/** Unique class name used for the sidebar's media query style injection. */
const SIDEBAR_CLASS = 'learnverse-sidebar';
const STYLE_ID = 'learnverse-sidebar-media-style';

/**
 * Maps known exercise route prefixes to subject names (lowercase).
 * Used to determine which sidebar subject should be highlighted.
 */
const EXERCISE_ROUTE_SUBJECT_MAP: Record<string, string> = {
  pronunciation: '', // subjectId resolved at render time
  grammar: '',
  quiz: '',
  maths: 'maths',
  computers: 'computers',
  evs: 'evs',
};

/**
 * Determines the active subject name from the current route hash.
 * Returns the lowercase subject name if the route is an exercise route,
 * or the subject name from a `#subject-{name}` route.
 */
function getActiveSubjectFromRoute(activeRoute: string | undefined): string | null {
  if (!activeRoute) return null;

  // Strip leading # if present
  const route = activeRoute.startsWith('#') ? activeRoute.slice(1) : activeRoute;

  // Match #subject-{name}
  const subjectMatch = route.match(/^subject-(.+)$/);
  if (subjectMatch) return subjectMatch[1].toLowerCase();

  // Match exercise routes like #pronunciation/{subjectId}, #grammar/{subjectId}, etc.
  // For subject-specific routes (maths, computers, evs), the route prefix IS the subject
  const exerciseMatch = route.match(/^(pronunciation|grammar|quiz|maths|computers|evs)\/(.+)$/);
  if (exerciseMatch) {
    const routePrefix = exerciseMatch[1];
    const subjectIdOrName = exerciseMatch[2];
    // For maths/computers/evs, the route prefix is the subject name
    if (EXERCISE_ROUTE_SUBJECT_MAP[routePrefix]) {
      return EXERCISE_ROUTE_SUBJECT_MAP[routePrefix];
    }
    // For language exercise routes (pronunciation, grammar, quiz),
    // the subjectId parameter is often the subject name (lowercase).
    // Return it so it can be matched against sidebar subject names.
    return subjectIdOrName.toLowerCase();
  }

  return null;
}

/**
 * Injects a <style> element with a media query that hides the sidebar
 * on viewports narrower than 960px. Only injects once.
 */
function ensureMediaQueryStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${SIDEBAR_CLASS} {
      display: flex;
    }
    @media (max-width: 959px) {
      .${SIDEBAR_CLASS} {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Creates a sidebar DOM element listing subjects with progress indicators.
 *
 * The sidebar is 200px wide (within the 180-220px range per Req 3.6),
 * uses a light background, and only appears on viewports ≥ 960px.
 * Each subject row displays a colored dot, the subject name, and a
 * progress percentage.
 *
 * @param options - Configuration with subjects array and selection callback.
 * @returns An HTMLElement suitable for fixed positioning in the layout.
 */
export function createSidebar(options: SidebarOptions): HTMLElement {
  ensureMediaQueryStyle();

  const aside = document.createElement('aside');
  aside.className = SIDEBAR_CLASS;
  aside.setAttribute('aria-label', 'Subject navigation');
  Object.assign(aside.style, {
    width: '200px',
    minWidth: '180px',
    maxWidth: '220px',
    flexDirection: 'column',
    backgroundColor: colors.white,
    borderRight: `1px solid ${colors.border}`,
    padding: '12px 0',
    overflowY: 'auto',
    boxSizing: 'border-box',
  });

  // Sidebar heading
  const heading = document.createElement('h2');
  heading.className = 'sidebar-heading';
  heading.textContent = 'Subjects';
  Object.assign(heading.style, {
    fontSize: typography.heading.size,
    fontWeight: typography.heading.weight,
    color: colors.dark,
    margin: '0',
    padding: '4px 16px 12px',
  });
  aside.appendChild(heading);

  // Empty state when no subjects are available
  if (options.subjects.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'sidebar-empty-state';
    emptyState.textContent = 'No subjects to display';
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

  // Subject list
  const list = document.createElement('ul');
  list.className = 'sidebar-subject-list';
  list.setAttribute('role', 'list');
  Object.assign(list.style, {
    listStyle: 'none',
    margin: '0',
    padding: '0',
  });

  // Determine which subject should be highlighted based on activeRoute
  const activeSubject = getActiveSubjectFromRoute(options.activeRoute);

  for (const subject of options.subjects) {
    const item = document.createElement('li');
    item.className = 'sidebar-subject-item';
    item.setAttribute('role', 'listitem');

    const isActive = activeSubject !== null &&
      subject.name.toLowerCase() === activeSubject;

    const button = document.createElement('button');
    button.className = 'sidebar-subject-button';
    button.type = 'button';
    button.setAttribute('aria-label', `${subject.name} - ${subject.progress}% complete`);
    if (isActive) {
      button.setAttribute('aria-current', 'true');
    }
    Object.assign(button.style, {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      padding: '8px 16px',
      border: 'none',
      backgroundColor: isActive ? `${subject.color}18` : 'transparent',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'background-color 0.2s',
      gap: '10px',
      boxSizing: 'border-box',
      borderLeft: isActive ? `3px solid ${subject.color}` : '3px solid transparent',
    });

    // Hover/focus styles
    button.addEventListener('mouseenter', () => {
      if (!isActive) {
        button.style.backgroundColor = colors.background;
      }
    });
    button.addEventListener('mouseleave', () => {
      if (!isActive) {
        button.style.backgroundColor = 'transparent';
      }
    });
    button.addEventListener('focus', () => {
      button.style.outline = `2px solid ${colors.primary}`;
      button.style.outlineOffset = '-2px';
    });
    button.addEventListener('blur', () => {
      button.style.outline = 'none';
    });

    // Click handler
    button.addEventListener('click', () => {
      options.onSelectSubject(subject.name);
    });

    // Color dot icon
    const dot = document.createElement('span');
    dot.className = 'sidebar-subject-dot';
    dot.setAttribute('aria-hidden', 'true');
    Object.assign(dot.style, {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: subject.color,
      flexShrink: '0',
    });

    // Subject name
    const nameEl = document.createElement('span');
    nameEl.className = 'sidebar-subject-name';
    nameEl.textContent = subject.name;
    Object.assign(nameEl.style, {
      fontSize: typography.body.size,
      fontWeight: typography.body.weight,
      color: colors.dark,
      flex: '1',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });

    // Progress indicator
    const progressEl = document.createElement('span');
    progressEl.className = 'sidebar-subject-progress';
    progressEl.textContent = `${Math.round(subject.progress)}%`;
    Object.assign(progressEl.style, {
      fontSize: typography.caption.size,
      fontWeight: typography.label.weight,
      color: colors.textMuted,
      flexShrink: '0',
    });

    button.appendChild(dot);
    button.appendChild(nameEl);
    button.appendChild(progressEl);
    item.appendChild(button);
    list.appendChild(item);
  }

  aside.appendChild(list);
  return aside;
}
