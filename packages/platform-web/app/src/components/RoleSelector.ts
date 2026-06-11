/**
 * RoleSelector — Framework-agnostic role selection component for the web platform.
 *
 * Creates an HTMLElement displaying a fieldset with two radio buttons allowing
 * the user to choose between "Parent" and "Student" roles. Uses proper
 * accessibility patterns with fieldset/legend and label associations.
 *
 * Usage:
 *   import { createRoleSelector } from './components/RoleSelector';
 *   document.body.appendChild(createRoleSelector({ onRoleSelected: (role) => { ... } }));
 *
 * Validates: Requirements 1.1, 13.4
 */

import type { UserRole } from '../types/auth';

/**
 * Configuration options for the role selector component.
 */
export interface RoleSelectorOptions {
  /** Callback invoked when the user selects a role. */
  onRoleSelected: (role: UserRole) => void;
}

/**
 * Creates a role selector DOM element with two radio buttons.
 *
 * The returned element is a fieldset with a legend providing a visible group
 * label for screen reader context (Req 13.4). It contains two radio inputs
 * ("Parent" and "Student") that are mutually exclusive via a shared name
 * attribute (Req 1.1). When a selection changes, the `onRoleSelected`
 * callback is invoked with the chosen role value.
 *
 * @param options - Configuration with `onRoleSelected` callback.
 * @returns An HTMLElement suitable for insertion in the page.
 */
export function createRoleSelector(options: RoleSelectorOptions): HTMLElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'role-selector';

  // Visible group label for screen reader context (Req 13.4)
  const legend = document.createElement('legend');
  legend.textContent = 'Select Your Role';
  fieldset.appendChild(legend);

  const roles: Array<{ value: UserRole; label: string }> = [
    { value: 'parent', label: 'Parent' },
    { value: 'student', label: 'Student' },
  ];

  for (const role of roles) {
    const wrapper = document.createElement('div');
    wrapper.className = 'role-selector__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'role';
    input.id = `role-${role.value}`;
    input.value = role.value;

    input.addEventListener('change', () => {
      options.onRoleSelected(role.value);
    });

    const label = document.createElement('label');
    label.htmlFor = `role-${role.value}`;
    label.textContent = role.label;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    fieldset.appendChild(wrapper);
  }

  return fieldset;
}
