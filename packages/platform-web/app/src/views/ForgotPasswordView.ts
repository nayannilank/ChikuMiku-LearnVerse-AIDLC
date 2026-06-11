/**
 * ForgotPasswordView — Password recovery view for the LearnVerse web application.
 *
 * Renders a single input form where a user (parent or student) can request
 * a password reset link. The link is always sent to the parent's registered email.
 *
 * Usage:
 *   import { createForgotPasswordView } from './views/ForgotPasswordView';
 *   document.getElementById('app')!.appendChild(createForgotPasswordView());
 *
 * Validates: Requirements 10.1–10.8, 12.2, 13.1, 13.2
 */

import { validate, requiredValidator } from '../validation/ValidationEngine';
import type { ExtendedFieldRule } from '../validation/ValidationEngine';
import { forgotPassword } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';

/** ID prefix to avoid conflicts with other forms on the page. */
const ID_PREFIX = 'forgot-pw-';

const BUTTON_TEXT_DEFAULT = 'Send Reset Link';
const BUTTON_TEXT_LOADING = 'Sending...';

/**
 * Validation rules for the forgot password form (Req 10.8: required field).
 */
const VALIDATION_RULES: ExtendedFieldRule[] = [
  {
    fieldName: 'identifier',
    validators: [requiredValidator()],
  },
];

/**
 * Creates the forgot password view element.
 *
 * The returned element contains:
 * - A "Back to Login" link at the top (Req 12.2)
 * - A form with a single input labeled "Parent Username or Email" (Req 10.1)
 * - Helper text explaining the reset link is sent to parent's email (Req 10.2)
 * - A submit button labeled "Send Reset Link" (Req 10.3)
 * - An API error area below the form (Req 10.7)
 * - An inline validation error area (Req 10.8)
 * - A confirmation message area (Req 10.5)
 *
 * Error priority rule:
 * - API errors hide inline validation errors (Req 10.7)
 * - Resubmitting with empty field shows inline error and hides API error (Req 10.8)
 *
 * @returns An HTMLElement representing the forgot password view.
 */
export function createForgotPasswordView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'forgot-password-view';

  // "Back to Login" link (Req 12.2)
  const backLink = document.createElement('a');
  backLink.href = '#';
  backLink.className = 'forgot-password-view__back-link';
  backLink.textContent = 'Back to Login';
  container.appendChild(backLink);

  // Form
  const form = document.createElement('form');
  form.className = 'forgot-password-view__form';
  form.noValidate = true;

  // Input group
  const group = document.createElement('div');
  group.className = 'form-group';

  // Label (Req 10.1, 13.2: matching for/id attributes)
  const label = document.createElement('label');
  label.htmlFor = `${ID_PREFIX}identifier`;
  label.textContent = 'Parent Username or Email';

  // Input
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `${ID_PREFIX}identifier`;
  input.name = 'identifier';
  input.autocomplete = 'username';

  // Helper text (Req 10.2)
  const helperText = document.createElement('p');
  helperText.className = 'form-group__helper-text';
  helperText.textContent =
    'The reset link will be sent to the parent\'s registered email address. This applies to both parent and student accounts.';

  // Inline validation error (Req 10.8, 13.2: aria-describedby)
  const inlineError = document.createElement('div');
  inlineError.id = `${ID_PREFIX}identifier-error`;
  inlineError.className = 'form-group__error';
  inlineError.setAttribute('role', 'alert');
  inlineError.style.display = 'none';

  // Associate input with error element
  input.setAttribute('aria-describedby', inlineError.id);

  group.appendChild(label);
  group.appendChild(input);
  group.appendChild(helperText);
  group.appendChild(inlineError);
  form.appendChild(group);

  // Submit button (Req 10.3, 10.6: loading state)
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'forgot-password-view__submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;
  form.appendChild(submitButton);

  container.appendChild(form);

  // API error area (Req 10.7: display below form)
  const apiErrorArea = document.createElement('div');
  apiErrorArea.className = 'forgot-password-view__error';
  apiErrorArea.setAttribute('role', 'alert');
  apiErrorArea.style.display = 'none';
  container.appendChild(apiErrorArea);

  // Success/confirmation area (Req 10.5)
  const successArea = document.createElement('div');
  successArea.className = 'forgot-password-view__success';
  successArea.style.display = 'none';
  container.appendChild(successArea);

  // --- Helpers ---

  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
  }

  function showInlineError(message: string): void {
    inlineError.innerHTML = `<span>${escapeHtml(message)}</span>`;
    inlineError.style.display = 'block';
  }

  function clearInlineError(): void {
    inlineError.innerHTML = '';
    inlineError.style.display = 'none';
  }

  function showApiError(message: string): void {
    apiErrorArea.innerHTML = `<span class="forgot-password-view__error-message">${escapeHtml(message)}</span>`;
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
      `<p>A password reset link has been sent to the parent&#39;s registered email address.</p>`;
    successArea.style.display = 'block';
  }

  // --- Form submit handler ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const values: Record<string, string> = {
      identifier: input.value,
    };

    // Step 1: Validate (Req 10.8)
    const result = validate(VALIDATION_RULES, values);

    if (!result.valid) {
      // Empty field: show inline validation error, hide API error
      clearApiError();
      showInlineError(result.errors.identifier);
      return;
    }

    // Clear inline errors if validation passes
    clearInlineError();

    // Step 2: Set loading state (Req 10.6)
    setLoading(true);

    // Step 3: Call API (Req 10.4)
    const response = await forgotPassword(values.identifier);

    setLoading(false);

    if (response.success) {
      // Step 4: Show confirmation (Req 10.5)
      showSuccess();
    } else {
      // Step 5: API error takes priority — hide inline validation errors (Req 10.7)
      clearInlineError();
      showApiError(response.error || 'Request failed. Please try again.');
    }
  });

  return container;
}
