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
}

/** Unique class name used for the sidebar's media query style injection. */
const SIDEBAR_CLASS = 'learnverse-sidebar';
const STYLE_ID = 'learnverse-sidebar-media-style';

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

  // Subject list
  const list = document.createElement('ul');
  list.className = 'sidebar-subject-list';
  list.setAttribute('role', 'list');
  Object.assign(list.style, {
    listStyle: 'none',
    margin: '0',
    padding: '0',
  });

  for (const subject of options.subjects) {
    const item = document.createElement('li');
    item.className = 'sidebar-subject-item';
    item.setAttribute('role', 'listitem');

    const button = document.createElement('button');
    button.className = 'sidebar-subject-button';
    button.type = 'button';
    button.setAttribute('aria-label', `${subject.name} - ${subject.progress}% complete`);
    Object.assign(button.style, {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      padding: '8px 16px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'background-color 0.2s',
      gap: '10px',
      boxSizing: 'border-box',
    });

    // Hover/focus styles
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = colors.background;
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
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
