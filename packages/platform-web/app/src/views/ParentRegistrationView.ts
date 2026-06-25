/**
 * ParentRegistrationView — Refactored parent registration page for the LearnVerse web application.
 *
 * Composes a minimal auth header at the top and a registration card with styled form fields,
 * PasswordStrengthIndicator, and a pill-shaped submit button. Uses design tokens
 * from registration-view.css and follows the ChikuMiku LearnVerse design mockups.
 *
 * The auth header only shows the logo and a Login link — authenticated
 * navigation items (Dashboard, Subjects, etc.) are NOT shown on this screen.
 *
 * Usage:
 *   import { createParentRegistrationView } from './views/ParentRegistrationView';
 *   document.getElementById('app')!.appendChild(createParentRegistrationView());
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.5, 8.1, 8.2, 8.3
 */

import { createHeaderLogo } from '../components/HeaderLogo';
import { createPasswordStrengthIndicator } from '../components/PasswordStrengthIndicator';
import { registerParent } from '../services/AuthService';
import {
  validate,
  lengthValidator,
  charsetValidator,
  emailValidator,
  phoneValidator,
  requiredValidator,
} from '../validation/ValidationEngine';
import type { ExtendedFieldRule } from '../validation/ValidationEngine';
import { escapeHtml } from '../utils/escapeHtml';
import '../styles/registration-view.css';

/**
 * Field definition for the registration form.
 */
interface FormFieldDef {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  autocomplete: AutoFill;
}

/**
 * Form field definitions matching the design mockup (Req 6.1–6.5).
 */
const FIELDS: FormFieldDef[] = [
  {
    name: 'username',
    label: 'Parent Username *',
    type: 'text',
    placeholder: '8-15 characters allowed',
    autocomplete: 'username',
  },
  {
    name: 'name',
    label: 'Name *',
    type: 'text',
    placeholder: '5-20 characters allowed',
    autocomplete: 'name',
  },
  {
    name: 'phone',
    label: 'Phone *',
    type: 'tel',
    placeholder: '10 digits required',
    autocomplete: 'tel',
  },
  {
    name: 'email',
    label: 'Email *',
    type: 'email',
    placeholder: '30 characters maximum',
    autocomplete: 'email',
  },
  {
    name: 'password',
    label: 'Password *',
    type: 'password',
    placeholder: '8-20 chars, uppercase, lowercase, number, symbol',
    autocomplete: 'new-password',
  },
];

/**
 * Validation rules for parent registration (Req 6.1–6.5).
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
 * Creates the complete parent registration view element.
 *
 * The returned element contains:
 * - A minimal auth header with logo and Login link (no authenticated nav)
 * - A registration card with heading, subtitle, form fields, password strength
 *   indicator, and a pill-shaped submit button (Req 5.2–5.5, 6.1–6.7, 7.1, 7.5, 8.1–8.3)
 *
 * @returns An HTMLElement representing the full parent registration page.
 */
export function createParentRegistrationView(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'registration-view';

  // Minimal auth header (logo + Login link, no authenticated nav)
  const header = document.createElement('header');
  header.className = 'auth-header';
  header.setAttribute('aria-label', 'Site header');

  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 36,
    altText: 'ChikuMiku LearnVerse',
  });
  header.appendChild(logo);

  const loginLink = document.createElement('a');
  loginLink.className = 'auth-header__login-link';
  loginLink.textContent = 'Login';
  loginLink.href = '#login';
  loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#login';
  });
  header.appendChild(loginLink);

  container.appendChild(header);

  // Registration card wrapper (Req 5.5: 16px radius, card shadow)
  const card = document.createElement('div');
  card.className = 'registration-card';

  // Heading (Req 5.2: "Create Parent Account" 16-18px Bold #2C2341)
  const heading = document.createElement('h1');
  heading.className = 'registration-card__heading';
  heading.textContent = 'Create Parent Account';
  card.appendChild(heading);

  // Subtitle (Req 5.3: "Register first, then add your children")
  const subtitle = document.createElement('p');
  subtitle.className = 'registration-card__subtitle';
  subtitle.textContent = 'Register first, then add your children';
  card.appendChild(subtitle);

  // Form (Req 6.1–6.7)
  const form = document.createElement('form');
  form.className = 'registration-form';
  form.noValidate = true;

  // Store references to inputs and error elements
  const inputs: Record<string, HTMLInputElement> = {};
  const errorElements: Record<string, HTMLElement> = {};

  // Password strength indicator instance
  const { element: strengthElement, update: strengthUpdate } = createPasswordStrengthIndicator();

  // Create form fields
  for (const field of FIELDS) {
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'form-field';

    // Label (Req 6.7: 10-11px SemiBold #2C2341)
    const label = document.createElement('label');
    label.className = 'form-field__label';
    label.htmlFor = `parent-reg-${field.name}`;
    label.textContent = field.label;
    fieldGroup.appendChild(label);

    // Input (Req 6.6: 8px border-radius, #E0D8EC borders)
    const input = document.createElement('input');
    input.className = 'form-field__input';
    input.type = field.type;
    input.id = `parent-reg-${field.name}`;
    input.name = field.name;
    input.placeholder = field.placeholder;
    input.autocomplete = field.autocomplete;
    fieldGroup.appendChild(input);

    // Wire PasswordStrengthIndicator to password input (Req 7.1, 7.5)
    if (field.name === 'password') {
      input.addEventListener('input', () => {
        strengthUpdate(input.value);
      });
      // Also update on focus/blur for visibility
      input.addEventListener('focus', () => {
        if (input.value.length > 0) {
          strengthUpdate(input.value);
        }
      });
      fieldGroup.appendChild(strengthElement);
    }

    // Inline error element (Req 8.3: #E74C3C)
    const errorEl = document.createElement('div');
    errorEl.className = 'form-field__error';
    errorEl.id = `parent-reg-${field.name}-error`;
    errorEl.setAttribute('role', 'alert');
    errorEl.style.display = 'none';
    input.setAttribute('aria-describedby', errorEl.id);
    fieldGroup.appendChild(errorEl);

    form.appendChild(fieldGroup);
    inputs[field.name] = input;
    errorElements[field.name] = errorEl;
  }

  // Submit button (Req 8.1: pill-shaped, #E94F9B, 22px radius)
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'registration-form__submit';
  submitButton.textContent = 'Register Parent';
  form.appendChild(submitButton);

  card.appendChild(form);
  container.appendChild(card);

  // --- Helpers ---

  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? 'Registering...' : 'Register Parent';
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

  // --- Form submit handler ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gather form values
    const values: Record<string, string> = {};
    for (const field of FIELDS) {
      values[field.name] = inputs[field.name].value;
    }

    // Validate (Req 8.3: inline validation errors)
    const result = validate(VALIDATION_RULES, values);

    if (!result.valid) {
      showInlineErrors(result.errors);
      return;
    }

    // Clear inline errors if validation passes
    clearInlineErrors();

    // Set loading state (Req 8.2: disabled button, "Registering..." text)
    setLoading(true);

    // Call API
    const response = await registerParent({
      username: values.username,
      name: values.name,
      phone: values.phone,
      email: values.email,
      password: values.password,
    });

    setLoading(false);

    if (response.success) {
      // Navigate to login on success
      window.location.hash = '#login';
    } else {
      // Show API error as inline error on the relevant field or as a general message
      const errorMessage = response.error || 'Registration failed. Please try again.';
      // Display as a general error below the form by reusing the first field's error area
      // or create a general error display
      const generalError = document.createElement('div');
      generalError.className = 'form-field__error';
      generalError.style.display = 'block';
      generalError.style.textAlign = 'center';
      generalError.style.marginTop = '0.5rem';
      generalError.innerHTML = `<span>${escapeHtml(errorMessage)}</span>`;

      // Remove any previous general error
      const existingError = form.querySelector('.registration-form__general-error');
      if (existingError) {
        existingError.remove();
      }
      generalError.classList.add('registration-form__general-error');
      form.appendChild(generalError);
    }
  });

  return container;
}
