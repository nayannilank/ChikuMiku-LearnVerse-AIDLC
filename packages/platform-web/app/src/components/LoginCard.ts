/**
 * LoginCard — Centered login form component for the LearnVerse web application.
 *
 * Creates an HTMLElement containing a styled card with username/password inputs,
 * a submit button, forgot-password link, client-side validation, and submission
 * state management. All error messages are escaped via `escapeHtml` to prevent XSS.
 *
 * Usage:
 *   import { createLoginCard } from './components/LoginCard';
 *   document.body.appendChild(createLoginCard({
 *     onForgotPassword: () => { ... },
 *     onSubmit: async (username, password) => { ... },
 *   }));
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3
 */

import { escapeHtml } from '../utils/escapeHtml';

/**
 * Configuration options for the login card component.
 */
export interface LoginCardOptions {
  /** Callback invoked when the user clicks the forgot-password link. */
  onForgotPassword: () => void;
  /** Async handler invoked on valid form submission. Throws an Error with message on failure. */
  onSubmit: (username: string, password: string) => Promise<void>;
}

const BUTTON_TEXT_DEFAULT = 'Log In';
const BUTTON_TEXT_LOADING = 'Signing in...';

/**
 * Creates a login card DOM element with form inputs, validation, and submission handling.
 *
 * @param options - Configuration with onForgotPassword and onSubmit callbacks.
 * @returns An HTMLElement containing the full login card UI.
 */
export function createLoginCard(options: LoginCardOptions): HTMLElement {
  const { onForgotPassword, onSubmit } = options;

  // Wrapper — flex centered container
  const wrapper = document.createElement('div');
  wrapper.className = 'login-card-wrapper';

  // Card container
  const card = document.createElement('div');
  card.className = 'login-card';

  // Heading
  const heading = document.createElement('h2');
  heading.textContent = 'Sign In';
  card.appendChild(heading);

  // Form
  const form = document.createElement('form');
  form.noValidate = true;

  // --- Username form group ---
  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'form-group';

  const usernameLabel = document.createElement('label');
  usernameLabel.htmlFor = 'username';
  usernameLabel.textContent = 'Username';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.id = 'username';
  usernameInput.name = 'username';
  usernameInput.autocomplete = 'username';

  const usernameError = document.createElement('span');
  usernameError.id = 'username-error';
  usernameError.className = 'validation-error';
  usernameError.setAttribute('role', 'alert');
  usernameError.style.display = 'none';

  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);
  usernameGroup.appendChild(usernameError);

  // --- Password form group ---
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';

  const passwordLabel = document.createElement('label');
  passwordLabel.htmlFor = 'password';
  passwordLabel.textContent = 'Password';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';

  const passwordError = document.createElement('span');
  passwordError.id = 'password-error';
  passwordError.className = 'validation-error';
  passwordError.setAttribute('role', 'alert');
  passwordError.style.display = 'none';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  passwordGroup.appendChild(passwordError);

  // --- Submit button ---
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'login-btn';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;

  form.appendChild(usernameGroup);
  form.appendChild(passwordGroup);
  form.appendChild(submitButton);

  card.appendChild(form);

  // --- Forgot password link ---
  const forgotLink = document.createElement('a');
  forgotLink.href = '#';
  forgotLink.className = 'forgot-password-link';
  forgotLink.textContent = 'Forgot password?';
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    onForgotPassword();
  });

  card.appendChild(forgotLink);

  // --- Message area for server errors ---
  const messageArea = document.createElement('div');
  messageArea.id = 'message-area';
  messageArea.style.display = 'none';

  card.appendChild(messageArea);

  // --- Validation helper ---
  function clearValidation(): void {
    usernameError.textContent = '';
    usernameError.style.display = 'none';
    usernameInput.removeAttribute('aria-describedby');

    passwordError.textContent = '';
    passwordError.style.display = 'none';
    passwordInput.removeAttribute('aria-describedby');
  }

  function validate(): boolean {
    let isValid = true;

    if (usernameInput.value.trim() === '') {
      usernameError.textContent = 'Username is required';
      usernameError.style.display = 'block';
      usernameInput.setAttribute('aria-describedby', 'username-error');
      isValid = false;
    }

    if (passwordInput.value.trim() === '') {
      passwordError.textContent = 'Password is required';
      passwordError.style.display = 'block';
      passwordInput.setAttribute('aria-describedby', 'password-error');
      isValid = false;
    }

    return isValid;
  }

  // --- Submission state management ---
  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
  }

  function showError(message: string): void {
    messageArea.innerHTML = `<div class="message error">${escapeHtml(message)}</div>`;
    messageArea.style.display = 'block';
  }

  function clearError(): void {
    messageArea.innerHTML = '';
    messageArea.style.display = 'none';
  }

  // --- Form submit handler ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearValidation();
    clearError();

    if (!validate()) {
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    setLoading(true);

    try {
      await onSubmit(username, password);
      // On success, keep loading state — parent handles navigation
    } catch (error: unknown) {
      setLoading(false);
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.';
      showError(message);
    }
  });

  wrapper.appendChild(card);
  return wrapper;
}
