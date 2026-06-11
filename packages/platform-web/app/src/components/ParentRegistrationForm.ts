/**
 * ParentRegistrationForm — Registration form component for parent accounts.
 *
 * Creates an HTMLElement containing a form with username, name, phone, email, and
 * password inputs. On submit: validates using ValidationEngine, calls registerParent,
 * shows success message, and navigates to login view after 3 seconds with a fallback
 * link. All error messages are escaped via `escapeHtml` to prevent XSS.
 *
 * Validates: Requirements 3.1–3.6, 4.1–4.9, 5.1–5.4, 13.2, 13.3
 */

import {
  validate,
  lengthValidator,
  charsetValidator,
  emailValidator,
  phoneValidator,
  requiredValidator,
} from '../validation/ValidationEngine';
import type { ExtendedFieldRule } from '../validation/ValidationEngine';
import { registerParent } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';

/**
 * Configuration options for the parent registration form component.
 */
export interface ParentRegistrationFormOptions {
  onSuccess: () => void;
}

/** ID prefix to avoid conflicts with other forms on the page. */
const ID_PREFIX = 'parent-reg-';

const BUTTON_TEXT_DEFAULT = 'Register Parent';
const BUTTON_TEXT_LOADING = 'Registering...';

/** Navigation delay after successful registration (ms). */
const NAVIGATE_DELAY_MS = 3000;

/**
 * Field definitions for the parent registration form.
 * Each entry describes the field's id suffix, label text, input type, and autocomplete.
 */
const FIELDS: Array<{
  name: string;
  label: string;
  type: string;
  autocomplete: AutoFill;
}> = [
  { name: 'username', label: 'Username', type: 'text', autocomplete: 'username' },
  { name: 'name', label: 'Name', type: 'text', autocomplete: 'name' },
  { name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel' },
  { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password' },
];

/**
 * Validation rules for parent registration (Requirements 4.1–4.9).
 */
const VALIDATION_RULES: ExtendedFieldRule[] = [
  {
    fieldName: 'username',
    validators: [
      requiredValidator(),
      lengthValidator(8, 15),
      charsetValidator(/[a-zA-Z0-9_-]/),
    ],
  },
  {
    fieldName: 'name',
    validators: [
      requiredValidator(),
      lengthValidator(5, 20),
      charsetValidator(/[a-zA-Z ]/),
    ],
  },
  {
    fieldName: 'phone',
    validators: [
      requiredValidator(),
      phoneValidator(),
    ],
  },
  {
    fieldName: 'email',
    validators: [
      requiredValidator(),
      emailValidator(),
    ],
  },
  {
    fieldName: 'password',
    validators: [
      requiredValidator(),
      lengthValidator(8, 20),
      charsetValidator(/[a-zA-Z0-9!@#$%^&*]/),
    ],
  },
];

/**
 * Creates a parent registration form DOM element with all required fields,
 * inline validation, API submission, success messaging, and login navigation.
 *
 * @param options - Configuration with onSuccess callback.
 * @returns An HTMLElement containing the parent registration form UI.
 */
export function createParentRegistrationForm(
  options: ParentRegistrationFormOptions
): HTMLElement {
  const { onSuccess } = options;

  // Container
  const container = document.createElement('div');
  container.className = 'parent-registration-form-container';

  // Form
  const form = document.createElement('form');
  form.className = 'parent-registration-form';
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

    // Error element for inline validation (Req 4.9, 13.3: aria-describedby)
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

  // Submit button (Req 3.6, 5.3: loading state)
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'parent-registration-form__submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;
  form.appendChild(submitButton);

  container.appendChild(form);

  // API error area (Req 5.4: display error below form)
  const apiErrorArea = document.createElement('div');
  apiErrorArea.className = 'parent-registration-form__error';
  apiErrorArea.setAttribute('role', 'alert');
  apiErrorArea.style.display = 'none';
  container.appendChild(apiErrorArea);

  // Success message area
  const successArea = document.createElement('div');
  successArea.className = 'parent-registration-form__success';
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
    apiErrorArea.innerHTML = `<span class="parent-registration-form__error-message">${escapeHtml(message)}</span>`;
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
      `<p>Registration successful! Redirecting to login...</p>` +
      `<a href="#" class="parent-registration-form__login-link">Go to Login</a>`;
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

    // Step 1: Validate (Req 4.1–4.9)
    const result = validate(VALIDATION_RULES, values);

    if (!result.valid) {
      showInlineErrors(result.errors);
      return;
    }

    // Clear inline errors if validation passes
    clearInlineErrors();

    // Step 2: Set loading state (Req 5.3)
    setLoading(true);

    // Step 3: Call API (Req 5.1)
    const response = await registerParent({
      username: values.username,
      name: values.name,
      phone: values.phone,
      email: values.email,
      password: values.password,
    });

    setLoading(false);

    if (response.success) {
      // Step 4: Show success and navigate (Req 5.2)
      showSuccess();
      onSuccess();

      // Navigate to login after 3s with fallback link already visible
      setTimeout(() => {
        window.location.hash = '#';
      }, NAVIGATE_DELAY_MS);
    } else {
      // Step 5: API error takes priority — hide inline validation errors (error priority rule)
      clearInlineErrors();
      showApiError(response.error || 'Registration failed. Please try again.');
    }
  });

  return container;
}
