/**
 * RoleChoiceScreen — Framework-agnostic role choice component for the registration flow.
 *
 * Creates an HTMLElement displaying a fieldset with two radio buttons allowing
 * the user to choose whether to register as a "Parent" or "Student". Uses proper
 * accessibility patterns with fieldset/legend and label associations.
 *
 * Usage:
 *   import { createRoleChoiceScreen } from './components/RoleChoiceScreen';
 *   document.body.appendChild(createRoleChoiceScreen({ onChoice: (choice) => { ... } }));
 *
 * Validates: Requirements 2.1, 13.5
 */

import type { UserRole } from '../types/auth';

/**
 * Configuration options for the role choice screen component.
 */
export interface RoleChoiceScreenOptions {
  /** Callback invoked when the user selects a registration role. */
  onChoice: (choice: 'parent' | 'student') => void;
}

/**
 * Creates a role choice screen DOM element with two radio buttons for registration.
 *
 * The returned element is a fieldset with a legend providing a visible group
 * label for screen reader context (Req 13.5). It contains two radio inputs
 * ("Parent" and "Student") that are mutually exclusive via a shared name
 * attribute (Req 2.1). When a selection changes, the `onChoice` callback is
 * invoked with the chosen role value.
 *
 * @param options - Configuration with `onChoice` callback.
 * @returns An HTMLElement suitable for insertion in the page.
 */
export function createRoleChoiceScreen(options: RoleChoiceScreenOptions): HTMLElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'role-choice-screen';

  // Visible group label for screen reader context (Req 13.5)
  const legend = document.createElement('legend');
  legend.textContent = 'Register as';
  fieldset.appendChild(legend);

  const roles: Array<{ value: UserRole; label: string }> = [
    { value: 'parent', label: 'Parent' },
    { value: 'student', label: 'Student' },
  ];

  for (const role of roles) {
    const wrapper = document.createElement('div');
    wrapper.className = 'role-choice-screen__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'registration-role';
    input.id = `reg-role-${role.value}`;
    input.value = role.value;

    input.addEventListener('change', () => {
      options.onChoice(role.value as 'parent' | 'student');
    });

    const label = document.createElement('label');
    label.htmlFor = `reg-role-${role.value}`;
    label.textContent = role.label;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    fieldset.appendChild(wrapper);
  }

  return fieldset;
}
