/**
 * RegistrationView — Assembles the registration flow for the LearnVerse web application.
 *
 * Uses an internal state machine to transition between sub-screens:
 *   RoleChoiceScreen → (Parent → ParentRegistrationForm)
 *                    | (Student → ParentLoginGate → StudentRegistrationForm)
 *
 * A "Back to Login" link is always visible at the top, navigating to hash `#`.
 *
 * Usage:
 *   import { createRegistrationView } from './views/RegistrationView';
 *   document.getElementById('app')!.appendChild(createRegistrationView());
 *
 * Validates: Requirements 2.1–2.3, 12.1
 */

import { createRoleChoiceScreen } from '../components/RoleChoiceScreen';
import { createParentRegistrationForm } from '../components/ParentRegistrationForm';
import { createParentLoginGate } from '../components/ParentLoginGate';
import { createStudentRegistrationForm } from '../components/StudentRegistrationForm';

/**
 * Creates the complete registration view element with state machine navigation.
 *
 * The returned element contains:
 * - A "Back to Login" link at the top (Req 12.1)
 * - A content area that transitions between screens based on user choices
 *
 * State machine flow:
 * 1. Initial: RoleChoiceScreen (Req 2.1)
 * 2. Parent selected → ParentRegistrationForm (Req 2.2)
 * 3. Student selected → ParentLoginGate (Req 2.3) → StudentRegistrationForm
 *
 * @returns An HTMLElement representing the full registration view.
 */
export function createRegistrationView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'registration-view';

  // "Back to Login" link (Req 12.1)
  const backLink = document.createElement('a');
  backLink.href = '#';
  backLink.className = 'registration-view__back-link';
  backLink.textContent = 'Back to Login';
  container.appendChild(backLink);

  // Content area for state machine screens
  const contentArea = document.createElement('div');
  contentArea.className = 'registration-view__content';
  container.appendChild(contentArea);

  /**
   * Replaces the current content area with the given element.
   */
  function showScreen(element: HTMLElement): void {
    contentArea.innerHTML = '';
    contentArea.appendChild(element);
  }

  // Initial state: RoleChoiceScreen (Req 2.1)
  showScreen(createRoleChoiceScreen({
    onChoice: (choice) => {
      if (choice === 'parent') {
        // Req 2.2: Parent selected → show ParentRegistrationForm
        showScreen(createParentRegistrationForm({ onSuccess: () => {} }));
      } else {
        // Req 2.3: Student selected → show ParentLoginGate
        showScreen(createParentLoginGate({
          onAuthenticated: (parentUsername, token) => {
            // Parent authenticated → show StudentRegistrationForm
            showScreen(createStudentRegistrationForm({
              parentUsername,
              parentToken: token,
              onSuccess: () => {},
            }));
          },
        }));
      }
    },
  }));

  return container;
}
