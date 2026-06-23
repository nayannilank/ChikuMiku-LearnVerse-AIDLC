/**
 * RoleTabs — Framework-agnostic pill-shaped role tab component.
 *
 * Creates an HTMLElement displaying two pill-shaped toggle buttons ("Parent" | "Learner")
 * allowing the user to switch the login context between parent and student roles.
 * Uses proper ARIA tablist/tab semantics with aria-selected state management.
 *
 * Usage:
 *   import { createRoleTabs } from './components/RoleTabs';
 *   document.body.appendChild(createRoleTabs({ onRoleSelected: (role) => { ... } }));
 *
 * Validates: Requirements 3.3, 3.4, 3.5, 3.10
 */

import type { UserRole } from '../types/auth';

/**
 * Configuration options for the RoleTabs component.
 */
export interface RoleTabsOptions {
  /** The role to display as active on initial render. Defaults to 'parent'. */
  defaultRole?: UserRole;
  /** Callback invoked when a role tab is activated. */
  onRoleSelected: (role: UserRole) => void;
}

/** Tab definition mapping role values to display labels. */
interface RoleTab {
  role: UserRole;
  label: string;
}

const ROLE_TABS: RoleTab[] = [
  { role: 'parent', label: 'Parent' },
  { role: 'student', label: 'Learner' },
];

/** CSS class applied to the active tab for styling and test assertions. */
const ACTIVE_CLASS = 'role-tab--active';

/**
 * Creates a role tabs DOM element with two pill-shaped toggle buttons.
 *
 * The returned element uses `role="tablist"` with each tab button marked as
 * `role="tab"`. The active tab is styled with background #E94F9B and white
 * text; the inactive tab has a transparent background and dark text (#2C2341).
 * Both tabs have a pill-shaped border-radius of 22px.
 *
 * On initial render, the tab matching `options.defaultRole` (or "Parent" if
 * unspecified) is active. Clicking a tab updates the visual state and fires
 * the `onRoleSelected` callback with the corresponding role value.
 *
 * @param options - Configuration with optional `defaultRole` and `onRoleSelected` callback.
 * @returns An HTMLElement suitable for insertion in a login form.
 */
export function createRoleTabs(options: RoleTabsOptions): HTMLElement {
  const { defaultRole = 'parent', onRoleSelected } = options;

  const container = document.createElement('div');
  container.className = 'role-tabs';
  container.setAttribute('role', 'tablist');
  container.setAttribute('aria-label', 'Select login role');
  Object.assign(container.style, {
    display: 'inline-flex',
    gap: '0px',
    borderRadius: '22px',
    overflow: 'hidden',
    border: '1px solid #E0D8EC',
  });

  let activeRole: UserRole = defaultRole;

  /** Applies the correct styles and ARIA state to a tab button. */
  function applyTabStyles(button: HTMLButtonElement, role: UserRole): void {
    const isActive = role === activeRole;

    button.setAttribute('aria-selected', String(isActive));
    button.setAttribute('tabindex', isActive ? '0' : '-1');

    if (isActive) {
      button.classList.add(ACTIVE_CLASS);
      Object.assign(button.style, {
        backgroundColor: '#E94F9B',
        color: '#FFFFFF',
      });
    } else {
      button.classList.remove(ACTIVE_CLASS);
      Object.assign(button.style, {
        backgroundColor: 'transparent',
        color: '#2C2341',
      });
    }
  }

  const tabButtons: HTMLButtonElement[] = [];

  for (const { role, label } of ROLE_TABS) {
    const button = document.createElement('button');
    button.className = 'role-tab';
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('data-role', role);

    Object.assign(button.style, {
      border: 'none',
      padding: '8px 20px',
      fontSize: '12px',
      fontWeight: '600',
      borderRadius: '22px',
      cursor: 'pointer',
      transition: 'background-color 0.2s, color 0.2s',
      outline: 'none',
    });

    applyTabStyles(button, role);

    button.addEventListener('click', () => {
      activeRole = role;
      for (const btn of tabButtons) {
        const btnRole = btn.getAttribute('data-role') as UserRole;
        applyTabStyles(btn, btnRole);
      }
      onRoleSelected(role);
    });

    // Keyboard navigation within the tablist (arrow keys)
    button.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const currentIndex = tabButtons.indexOf(button);
        const nextIndex = e.key === 'ArrowRight'
          ? (currentIndex + 1) % tabButtons.length
          : (currentIndex - 1 + tabButtons.length) % tabButtons.length;
        tabButtons[nextIndex].focus();
      }
    });

    tabButtons.push(button);
    container.appendChild(button);
  }

  return container;
}
