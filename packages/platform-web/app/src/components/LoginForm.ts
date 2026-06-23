/**
 * LoginForm — Role-aware login form component for the LearnVerse web application.
 *
 * Creates an HTMLElement containing a form with username/password inputs, a submit
 * button with loading state, and LoginFailureActions (Register + Reset Password links)
 * that appear on first login failure. All error messages are escaped via `escapeHtml`
 * to prevent XSS.
 *
 * Usage:
 *   import { createLoginForm } from './components/LoginForm';
 *   document.body.appendChild(createLoginForm({
 *     role: 'parent',
 *     onSubmit: async (username, password, role) => { ... },
 *     onForgotPassword: () => { ... },
 *     onRegister: () => { ... },
 *   }));
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 13.1, 13.2
 */

import type { UserRole } from '../types/auth';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Configuration options for the login form component.
 */
export interface LoginFormOptions {
  /** The role already selected by the RoleSelector. */
  role: UserRole;
  /** Async handler invoked on valid form submission. Throws an Error with message on failure. */
  onSubmit: (username: string, password: string, role: UserRole) => Promise<void>;
  /** Callback invoked when the user clicks "Reset Password" in failure actions. */
  onForgotPassword: () => void;
  /** Callback invoked when the user clicks "Register" in failure actions. */
  onRegister: () => void;
}

const BUTTON_TEXT_DEFAULT = 'Log In';
const BUTTON_TEXT_LOADING = 'Signing in...';

/**
 * Creates a login form DOM element with username/password inputs, submission handling,
 * and LoginFailureActions that appear after the first login failure.
 *
 * @param options - Configuration with role, onSubmit, onForgotPassword, and onRegister callbacks.
 * @returns An HTMLElement containing the login form UI.
 */
export function createLoginForm(options: LoginFormOptions): HTMLElement {
  const { role, onSubmit, onForgotPassword, onRegister } = options;

  // Container
  const container = document.createElement('div');
  container.className = 'login-form-container';

  // Form
  const form = document.createElement('form');
  form.className = 'login-form';
  form.noValidate = true;

  // --- Username form group (Req 13.2: label with matching for/id) ---
  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'form-group';

  const usernameLabel = document.createElement('label');
  usernameLabel.htmlFor = 'login-username';
  usernameLabel.textContent = 'Username';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.id = 'login-username';
  usernameInput.name = 'username';
  usernameInput.autocomplete = 'username';

  const usernameError = document.createElement('span');
  usernameError.className = 'validation-error';
  usernameError.setAttribute('role', 'alert');
  usernameError.style.display = 'none';

  const usernameTooltip = document.createElement('div');
  usernameTooltip.className = 'validation-tooltip';
  usernameTooltip.setAttribute('role', 'tooltip');
  usernameTooltip.style.display = 'none';
  usernameTooltip.textContent = 'Username should be between 5–15 characters, and contain letters, numbers, hyphens, and underscores only.';

  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);
  usernameGroup.appendChild(usernameError);
  usernameGroup.appendChild(usernameTooltip);

  // Blur validation for username
  usernameInput.addEventListener('blur', () => {
    const value = usernameInput.value.trim();
    if (value === '') {
      usernameTooltip.style.display = 'none';
      return;
    }
    const error = validateLoginUsername(value);
    if (error) {
      usernameError.textContent = error;
      usernameError.style.display = 'block';
      usernameTooltip.style.display = 'block';
    } else {
      usernameError.textContent = '';
      usernameError.style.display = 'none';
      usernameTooltip.style.display = 'none';
    }
  });

  // --- Password form group (Req 13.2: label with matching for/id) ---
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'login-password';
  passwordLabel.textContent = 'Password';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'login-password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';

  const passwordError = document.createElement('span');
  passwordError.className = 'validation-error';
  passwordError.setAttribute('role', 'alert');
  passwordError.style.display = 'none';

  const passwordTooltip = document.createElement('div');
  passwordTooltip.className = 'validation-tooltip';
  passwordTooltip.setAttribute('role', 'tooltip');
  passwordTooltip.style.display = 'none';
  passwordTooltip.textContent = 'Password should be between 8–20 characters, and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  passwordGroup.appendChild(passwordError);
  passwordGroup.appendChild(passwordTooltip);

  // Blur validation for password
  passwordInput.addEventListener('blur', () => {
    const value = passwordInput.value;
    if (value === '') {
      passwordTooltip.style.display = 'none';
      return;
    }
    const error = validateLoginPassword(value);
    if (error) {
      passwordError.textContent = error;
      passwordError.style.display = 'block';
      passwordTooltip.style.display = 'block';
    } else {
      passwordError.textContent = '';
      passwordError.style.display = 'none';
      passwordTooltip.style.display = 'none';
    }
  });

  // --- Submit button (Req 1.4: loading state) ---
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'login-form__submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;

  form.appendChild(usernameGroup);
  form.appendChild(passwordGroup);
  form.appendChild(submitButton);

  container.appendChild(form);

  // --- Forgot password link (Req 2.3: visible on initial render, no dependency on hasFailedOnce) ---
  const forgotPasswordLink = document.createElement('a');
  forgotPasswordLink.className = 'forgot-password-link';
  forgotPasswordLink.href = '#forgot-password';
  forgotPasswordLink.textContent = 'Forgot password?';
  forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    onForgotPassword();
  });

  container.appendChild(forgotPasswordLink);

  // --- Error message area (Req 1.5: display error message on failure) ---
  const errorArea = document.createElement('div');
  errorArea.className = 'login-form__error';
  errorArea.setAttribute('role', 'alert');
  errorArea.style.display = 'none';

  container.appendChild(errorArea);

  // --- LoginFailureActions (Req 1.5, 1.6: hidden until first failure, shown with error) ---
  const failureActions = document.createElement('div');
  failureActions.className = 'login-form__failure-actions';
  failureActions.style.display = 'none';

  const registerLink = document.createElement('a');
  registerLink.href = '#register';
  registerLink.className = 'login-form__action-link';
  registerLink.textContent = 'Register';
  registerLink.addEventListener('click', (e) => {
    e.preventDefault();
    onRegister();
  });

  const resetPasswordLink = document.createElement('a');
  resetPasswordLink.href = '#forgot-password';
  resetPasswordLink.className = 'login-form__action-link';
  resetPasswordLink.textContent = 'Reset Password';
  resetPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    onForgotPassword();
  });

  failureActions.appendChild(registerLink);
  failureActions.appendChild(resetPasswordLink);

  container.appendChild(failureActions);

  // --- State ---
  let hasFailedOnce = false;

  // --- Helpers ---
  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
  }

  function showError(message: string): void {
    errorArea.innerHTML = `<span class="login-form__error-message">${escapeHtml(message)}</span>`;
    errorArea.style.display = 'block';
  }

  function clearError(): void {
    errorArea.innerHTML = '';
    errorArea.style.display = 'none';
  }

  function clearValidation(): void {
    usernameError.textContent = '';
    usernameError.style.display = 'none';
    usernameTooltip.style.display = 'none';
    passwordError.textContent = '';
    passwordError.style.display = 'none';
    passwordTooltip.style.display = 'none';
  }

  /**
   * Validates username format: 5–15 chars, alphanumeric + underscore + hyphen.
   * Returns error message or null if valid.
   */
  function validateLoginUsername(value: string): string | null {
    if (value.length < 5) {
      return 'Username must be at least 5 characters';
    }
    if (value.length > 15) {
      return 'Username must not exceed 15 characters';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Username must contain only letters, numbers, underscores, and hyphens';
    }
    return null;
  }

  /**
   * Validates password format: 8–20 chars, uppercase + lowercase + digit + special char.
   * Returns error message or null if valid.
   */
  function validateLoginPassword(value: string): string | null {
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (value.length > 20) {
      return 'Password must not exceed 20 characters';
    }
    if (!/[A-Z]/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(value)) {
      return 'Password must contain at least one digit';
    }
    if (!/[^a-zA-Z0-9\s]/.test(value)) {
      return 'Password must contain at least one special character';
    }
    return null;
  }

  function showFailureActions(): void {
    failureActions.style.display = 'block';
  }

  // --- Form submit handler (Req 1.3, 13.1: Enter key submits) ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    clearValidation();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // --- Client-side validation (Req 2.4, 2.5, 2.6) ---
    let hasValidationError = false;

    if (username === '') {
      usernameError.textContent = 'Username is required';
      usernameError.style.display = 'block';
      usernameTooltip.style.display = 'block';
      hasValidationError = true;
    } else {
      const usernameFormatError = validateLoginUsername(username);
      if (usernameFormatError) {
        usernameError.textContent = usernameFormatError;
        usernameError.style.display = 'block';
        usernameTooltip.style.display = 'block';
        hasValidationError = true;
      }
    }

    if (password === '') {
      passwordError.textContent = 'Password is required';
      passwordError.style.display = 'block';
      passwordTooltip.style.display = 'block';
      hasValidationError = true;
    } else {
      const passwordFormatError = validateLoginPassword(password);
      if (passwordFormatError) {
        passwordError.textContent = passwordFormatError;
        passwordError.style.display = 'block';
        passwordTooltip.style.display = 'block';
        hasValidationError = true;
      }
    }

    if (hasValidationError) {
      return;
    }

    setLoading(true);

    try {
      await onSubmit(username, password, role);
      // On success, keep loading state — caller handles navigation
    } catch (error: unknown) {
      setLoading(false);

      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.';
      showError(message);

      // Req 1.6: LoginFailureActions remain hidden until first failure, then always shown
      if (!hasFailedOnce) {
        hasFailedOnce = true;
      }
      showFailureActions();
    }
  });

  return container;
}
