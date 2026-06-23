/**
 * LoginPanel — Self-contained login card component for the LearnVerse web application.
 *
 * Creates an HTMLElement containing a card wrapper with heading, subtitle, role tabs,
 * username/password fields, a pill-shaped login button, and a "Forgot Password?" link.
 * Handles client-side validation, loading states, and error display.
 *
 * Usage:
 *   import { createLoginPanel } from './components/LoginPanel';
 *   document.body.appendChild(createLoginPanel({
 *     onSubmit: async (username, password, role) => { ... },
 *     onForgotPassword: () => { ... },
 *   }));
 *
 * Validates: Requirements 2.6, 3.1, 3.2, 3.6, 3.7, 3.8, 3.9
 */

import type { UserRole } from '../types/auth';
import { createRoleTabs } from './RoleTabs';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Configuration options for the LoginPanel component.
 */
export interface LoginPanelOptions {
  /** Async handler invoked on valid form submission. Throws an Error with message on failure. */
  onSubmit: (username: string, password: string, role: UserRole) => Promise<void>;
  /** Callback invoked when the user clicks "Forgot Password?" */
  onForgotPassword: () => void;
}

const BUTTON_TEXT_DEFAULT = 'Login';
const BUTTON_TEXT_LOADING = 'Signing in...';

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

/**
 * Creates a login panel DOM element with card wrapper, role tabs, form fields,
 * submit button, and forgot password link.
 *
 * @param options - Configuration with onSubmit and onForgotPassword callbacks.
 * @returns An HTMLElement containing the complete login panel UI.
 */
export function createLoginPanel(options: LoginPanelOptions): HTMLElement {
  const { onSubmit, onForgotPassword } = options;

  // --- Card wrapper (Req 2.6: 16px radius, box-shadow) ---
  const card = document.createElement('div');
  card.className = 'login-panel';
  Object.assign(card.style, {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '32px 28px',
    width: '100%',
    maxWidth: '400px',
  });

  // --- Heading (Req 3.1: "Welcome Back!" 16-18px Bold #2C2341) ---
  const heading = document.createElement('h2');
  heading.className = 'login-panel__heading';
  heading.textContent = 'Welcome Back!';
  Object.assign(heading.style, {
    fontSize: '18px',
    fontWeight: '700',
    color: '#2C2341',
    margin: '0 0 4px 0',
  });

  // --- Subtitle (Req 3.2: "Log in to continue learning" 12-14px Regular #6B7280) ---
  const subtitle = document.createElement('p');
  subtitle.className = 'login-panel__subtitle';
  subtitle.textContent = 'Log in to continue learning';
  Object.assign(subtitle.style, {
    fontSize: '13px',
    fontWeight: '400',
    color: '#6B7280',
    margin: '0 0 20px 0',
  });

  // --- Role Tabs (default: Parent) ---
  let currentRole: UserRole = 'parent';
  const roleTabs = createRoleTabs({
    defaultRole: 'parent',
    onRoleSelected: (role: UserRole) => {
      currentRole = role;
    },
  });
  const roleTabsWrapper = document.createElement('div');
  roleTabsWrapper.className = 'login-panel__role-tabs';
  Object.assign(roleTabsWrapper.style, {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px',
  });
  roleTabsWrapper.appendChild(roleTabs);

  // --- Form ---
  const form = document.createElement('form');
  form.className = 'login-panel__form';
  form.noValidate = true;

  // --- Username field (Req 3.6) ---
  const usernameGroup = document.createElement('div');
  usernameGroup.className = 'login-panel__field';
  Object.assign(usernameGroup.style, {
    marginBottom: '14px',
  });

  const usernameLabel = document.createElement('label');
  usernameLabel.className = 'login-panel__label';
  usernameLabel.htmlFor = 'login-panel-username';
  usernameLabel.textContent = 'Username';
  Object.assign(usernameLabel.style, {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: '#2C2341',
    marginBottom: '4px',
  });

  const usernameInput = document.createElement('input');
  usernameInput.className = 'login-panel__input';
  usernameInput.type = 'text';
  usernameInput.id = 'login-panel-username';
  usernameInput.name = 'username';
  usernameInput.autocomplete = 'username';
  Object.assign(usernameInput.style, {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid #E0D8EC',
    outline: 'none',
    boxSizing: 'border-box',
  });

  const usernameError = document.createElement('span');
  usernameError.className = 'login-panel__field-error';
  usernameError.setAttribute('role', 'alert');
  Object.assign(usernameError.style, {
    display: 'none',
    fontSize: '10px',
    color: '#E74C3C',
    marginTop: '4px',
  });

  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);
  usernameGroup.appendChild(usernameError);

  // --- Password field (Req 3.7) ---
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'login-panel__field';
  Object.assign(passwordGroup.style, {
    marginBottom: '18px',
  });

  const passwordLabel = document.createElement('label');
  passwordLabel.className = 'login-panel__label';
  passwordLabel.htmlFor = 'login-panel-password';
  passwordLabel.textContent = 'Password';
  Object.assign(passwordLabel.style, {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    color: '#2C2341',
    marginBottom: '4px',
  });

  const passwordInput = document.createElement('input');
  passwordInput.className = 'login-panel__input';
  passwordInput.type = 'password';
  passwordInput.id = 'login-panel-password';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';
  Object.assign(passwordInput.style, {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid #E0D8EC',
    outline: 'none',
    boxSizing: 'border-box',
  });

  const passwordError = document.createElement('span');
  passwordError.className = 'login-panel__field-error';
  passwordError.setAttribute('role', 'alert');
  Object.assign(passwordError.style, {
    display: 'none',
    fontSize: '10px',
    color: '#E74C3C',
    marginTop: '4px',
  });

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  passwordGroup.appendChild(passwordError);

  // --- Login button (Req 3.8: pill-shaped, full-width, #E94F9B) ---
  const submitButton = document.createElement('button');
  submitButton.className = 'login-panel__submit';
  submitButton.type = 'submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;
  Object.assign(submitButton.style, {
    width: '100%',
    padding: '12px',
    backgroundColor: '#E94F9B',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '22px',
    cursor: 'pointer',
    marginBottom: '14px',
  });

  form.appendChild(usernameGroup);
  form.appendChild(passwordGroup);
  form.appendChild(submitButton);

  // --- Forgot Password link (Req 3.9: 10-12px #E94F9B, center-aligned) ---
  const forgotLink = document.createElement('a');
  forgotLink.className = 'login-panel__forgot-password';
  forgotLink.href = '#forgot-password';
  forgotLink.textContent = 'Forgot Password?';
  Object.assign(forgotLink.style, {
    display: 'block',
    textAlign: 'center',
    fontSize: '11px',
    color: '#E94F9B',
    textDecoration: 'none',
    cursor: 'pointer',
  });
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    onForgotPassword();
  });

  // --- Error display area ---
  const errorArea = document.createElement('div');
  errorArea.className = 'login-panel__error';
  errorArea.setAttribute('role', 'alert');
  Object.assign(errorArea.style, {
    display: 'none',
    backgroundColor: '#FDF2F2',
    border: '1px solid #E74C3C',
    borderRadius: '8px',
    padding: '10px 12px',
    marginTop: '14px',
    fontSize: '11px',
    color: '#E74C3C',
  });

  // --- Assemble card ---
  card.appendChild(heading);
  card.appendChild(subtitle);
  card.appendChild(roleTabsWrapper);
  card.appendChild(form);
  card.appendChild(forgotLink);
  card.appendChild(errorArea);

  // --- Helpers ---
  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
    submitButton.style.opacity = loading ? '0.7' : '1';
    submitButton.style.cursor = loading ? 'not-allowed' : 'pointer';
  }

  function showError(message: string): void {
    errorArea.innerHTML = `<span class="login-panel__error-message">${escapeHtml(message)}</span>`;
    errorArea.style.display = 'block';
  }

  function clearError(): void {
    errorArea.innerHTML = '';
    errorArea.style.display = 'none';
  }

  function showFieldError(el: HTMLElement, message: string): void {
    el.textContent = message;
    el.style.display = 'block';
  }

  function clearFieldErrors(): void {
    usernameError.textContent = '';
    usernameError.style.display = 'none';
    passwordError.textContent = '';
    passwordError.style.display = 'none';
  }

  // --- Form submit handler ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    clearFieldErrors();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Client-side validation
    let hasValidationError = false;

    if (username === '') {
      showFieldError(usernameError, 'Username is required');
      hasValidationError = true;
    } else {
      const usernameFormatError = validateLoginUsername(username);
      if (usernameFormatError) {
        showFieldError(usernameError, usernameFormatError);
        hasValidationError = true;
      }
    }

    if (password === '') {
      showFieldError(passwordError, 'Password is required');
      hasValidationError = true;
    } else {
      const passwordFormatError = validateLoginPassword(password);
      if (passwordFormatError) {
        showFieldError(passwordError, passwordFormatError);
        hasValidationError = true;
      }
    }

    if (hasValidationError) {
      return;
    }

    // Submit
    setLoading(true);

    try {
      await onSubmit(username, password, currentRole);
      // On success, keep loading state — caller handles navigation
    } catch (error: unknown) {
      setLoading(false);
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred.';
      showError(message);
    }
  });

  return card;
}
