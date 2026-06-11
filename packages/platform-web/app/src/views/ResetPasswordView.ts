/**
 * ResetPasswordView — Password reset form for the LearnVerse web application.
 *
 * Creates an HTMLElement containing a form with New Password and Confirm Password
 * fields. On submit: validates using ValidationEngine, calls resetPassword with the
 * provided token, shows success message, and navigates to login view after 3 seconds.
 * All error messages are escaped via `escapeHtml` to prevent XSS.
 *
 * Validates: Requirements 11.1–11.8, 12.3, 13.1, 13.2, 13.3
 */

import {
  validate,
  lengthValidator,
  charsetValidator,
  matchValidator,
  requiredValidator,
} from '../validation/ValidationEngine';
import type { ExtendedFieldRule } from '../validation/ValidationEngine';
import { resetPassword } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';

/** ID prefix to avoid conflicts with other forms on the page. */
const ID_PREFIX = 'reset-pw-';

const BUTTON_TEXT_DEFAULT = 'Reset Password';
const BUTTON_TEXT_LOADING = 'Resetting...';

/** Navigation delay after successful reset (ms). */
const NAVIGATE_DELAY_MS = 3000;

/**
 * Field definitions for the reset password form.
 * Each entry describes the field's id suffix, label text, input type, and autocomplete.
 */
const FIELDS: Array<{
  name: string;
  label: string;
  type: string;
  autocomplete: AutoFill;
}> = [
  { name: 'newPassword', label: 'New Password', type: 'password', autocomplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirm Password', type: 'password', autocomplete: 'new-password' },
];

/**
 * Validation rules for reset password form (Requirements 11.2–11.4).
 */
const VALIDATION_RULES: ExtendedFieldRule[] = [
  {
    fieldName: 'newPassword',
    validators: [
      requiredValidator(),
      lengthValidator(8, 20),
      charsetValidator(/[a-zA-Z0-9!@#$%^&*]/),
    ],
  },
  {
    fieldName: 'confirmPassword',
    validators: [
      requiredValidator(),
      matchValidator('newPassword'),
    ],
  },
];

/**
 * Creates a reset password view DOM element with password fields,
 * inline validation, API submission, success messaging, and login navigation.
 *
 * @param token - The password reset token extracted from the URL hash.
 * @returns An HTMLElement containing the reset password form UI.
 */
export function createResetPasswordView(token: string): HTMLElement {
  // Container
  const container = document.createElement('div');
  container.className = 'reset-password-view';

  // "Back to Login" link (Req 12.3)
  const backLink = document.createElement('a');
  backLink.href = '#';
  backLink.className = 'reset-password-view__back-link';
  backLink.textContent = 'Back to Login';
  container.appendChild(backLink);

  // Form
  const form = document.createElement('form');
  form.className = 'reset-password-form';
  form.noValidate = true;

  // Store references to inputs and error elements for each field
  const inputs: Record<string, HTMLInputElement> = {};
  const errorElements: Record<string, HTMLElement> = {};

  // Create form groups for each field (Req 13.2: label with matching for/id)
  for (const field of FIELDS) {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.htmlFor = `${ID_PREFIX}${field.name}`;
    label.textContent = field.label;

    const input = document.createElement('input');
    input.type = field.type;
    input.id = `${ID_PREFIX}${field.name}`;
    input.name = field.name;
    input.autocomplete = field.autocomplete;

    // Error element for inline validation (Req 13.3: aria-describedby)
    const errorEl = document.createElement('div');
    errorEl.id = `${ID_PREFIX}${field.name}-error`;
    errorEl.className = 'form-group__error';
    errorEl.setAttribute('role', 'alert');
    errorEl.style.display = 'none';

    // Associate input with its error element via aria-describedby
    input.setAttribute('aria-describedby', errorEl.id);

    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(errorEl);
    form.appendChild(group);

    inputs[field.name] = input;
    errorElements[field.name] = errorEl;
  }

  // Submit button (Req 11.7: loading state persists until resolve/reject)
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'reset-password-form__submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;
  form.appendChild(submitButton);

  container.appendChild(form);

  // API error area (Req 11.8: display error below form)
  const apiErrorArea = document.createElement('div');
  apiErrorArea.className = 'reset-password-form__error';
  apiErrorArea.setAttribute('role', 'alert');
  apiErrorArea.style.display = 'none';
  container.appendChild(apiErrorArea);

  // Success message area
  const successArea = document.createElement('div');
  successArea.className = 'reset-password-form__success';
  successArea.style.display = 'none';
  container.appendChild(successArea);

  // --- Helpers ---

  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
  }

  function showInlineErrors(errors: Record<string, string>): void {
    for (const field of FIELDS) {
      const errorEl = errorElements[field.name];
      const message = errors[field.name];
      if (message) {
        errorEl.innerHTML = `<span>${escapeHtml(message)}</span>`;
        errorEl.style.display = 'block';
      } else {
        errorEl.innerHTML = '';
        errorEl.style.display = 'none';
      }
    }
  }

  function clearInlineErrors(): void {
    for (const field of FIELDS) {
      const errorEl = errorElements[field.name];
      errorEl.innerHTML = '';
      errorEl.style.display = 'none';
    }
  }

  function showApiError(message: string): void {
    apiErrorArea.innerHTML = `<span class="reset-password-form__error-message">${escapeHtml(message)}</span>`;
    apiErrorArea.style.display = 'block';
  }

  function clearApiError(): void {
    apiErrorArea.innerHTML = '';
    apiErrorArea.style.display = 'none';
  }

  function showSuccess(): void {
    form.style.display = 'none';
    apiErrorArea.style.display = 'none';
    successArea.innerHTML =
      `<p>Password reset successful! Redirecting to login...</p>` +
      `<a href="#" class="reset-password-form__login-link">Go to Login</a>`;
    successArea.style.display = 'block';
  }

  // --- Form submit handler ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearApiError();

    // Gather form values
    const values: Record<string, string> = {};
    for (const field of FIELDS) {
      values[field.name] = inputs[field.name].value;
    }

    // Step 1: Validate (Req 11.2–11.4)
    const result = validate(VALIDATION_RULES, values);

    if (!result.valid) {
      showInlineErrors(result.errors);
      return;
    }

    // Clear inline errors if validation passes
    clearInlineErrors();

    // Step 2: Set loading state (Req 11.7 — persists until resolve/reject)
    setLoading(true);

    // Step 3: Call API (Req 11.5)
    const response = await resetPassword(token, values.newPassword);

    setLoading(false);

    if (response.success) {
      // Step 4: Show success and navigate (Req 11.6)
      showSuccess();

      // Navigate to login after 3s
      setTimeout(() => {
        window.location.hash = '#';
      }, NAVIGATE_DELAY_MS);
    } else {
      // Step 5: API error takes priority — hide inline validation errors (error priority rule)
      clearInlineErrors();
      showApiError(response.error || 'Password reset failed. Please try again.');
    }
  });

  return container;
}
