/**
 * ParentLoginGate — A login gate component that authenticates a parent before
 * allowing student registration to proceed.
 *
 * Creates an HTMLElement containing a form with username/password inputs and a
 * "Login as Parent" submit button. On successful authentication via `loginWithRole`,
 * the parent's token and username are passed to the `onAuthenticated` callback.
 *
 * Usage:
 *   import { createParentLoginGate } from './components/ParentLoginGate';
 *   document.body.appendChild(createParentLoginGate({
 *     onAuthenticated: (parentUsername, token) => { ... },
 *   }));
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { loginWithRole } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Configuration options for the ParentLoginGate component.
 */
export interface ParentLoginGateOptions {
  /** Callback invoked on successful parent authentication with username and token. */
  onAuthenticated: (parentUsername: string, token: string) => void;
}

const BUTTON_TEXT_DEFAULT = 'Login as Parent';
const BUTTON_TEXT_LOADING = 'Signing in...';

/**
 * Creates a parent login gate DOM element with username/password inputs and
 * submission handling. On success, calls onAuthenticated with the parent's
 * username and auth token.
 *
 * @param options - Configuration with onAuthenticated callback.
 * @returns An HTMLElement containing the parent login gate UI.
 */
export function createParentLoginGate(options: ParentLoginGateOptions): HTMLElement {
  const { onAuthenticated } = options;

  // Container
  const container = document.createElement('div');
  container.className = 'parent-login-gate-container';

  // Form
  const form = document.createElement('form');
  form.className = 'parent-login-gate';
  form.noValidate = true;

  // --- Username form group (Req 13.2: label with matching for/id) ---
  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'form-group';

  const usernameLabel = document.createElement('label');
  usernameLabel.htmlFor = 'parent-gate-username';
  usernameLabel.textContent = 'Username';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.id = 'parent-gate-username';
  usernameInput.name = 'username';
  usernameInput.autocomplete = 'username';

  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);

  // --- Password form group (Req 13.2: label with matching for/id) ---
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'parent-gate-password';
  passwordLabel.textContent = 'Password';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'parent-gate-password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);

  // --- Submit button (Req 6.4: loading state) ---
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'parent-login-gate__submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;

  form.appendChild(usernameGroup);
  form.appendChild(passwordGroup);
  form.appendChild(submitButton);

  container.appendChild(form);

  // --- Error message area (Req 6.5: display error message on API failure) ---
  const errorArea = document.createElement('div');
  errorArea.className = 'parent-login-gate__error';
  errorArea.setAttribute('role', 'alert');
  errorArea.style.display = 'none';

  container.appendChild(errorArea);

  // --- Helpers ---
  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
  }

  function showError(message: string): void {
    errorArea.innerHTML = `<span class="parent-login-gate__error-message">${escapeHtml(message)}</span>`;
    errorArea.style.display = 'block';
  }

  function clearError(): void {
    errorArea.innerHTML = '';
    errorArea.style.display = 'none';
  }

  // --- Form submit handler (Req 6.2: call loginWithRole with role "parent") ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Req 6.4: disable submit button and display loading indicator
    setLoading(true);

    // Req 6.2: call loginWithRole with role "parent"
    const result = await loginWithRole(username, password, 'parent');

    if (result.success && result.data) {
      // Req 6.3: pass token and username to onAuthenticated callback
      onAuthenticated(result.data.username, result.data.token);
    } else {
      // Req 6.5: on API error, display error message below the form
      setLoading(false);
      const message = result.error || 'Login failed. Please try again.';
      showError(message);
    }
  });

  return container;
}
