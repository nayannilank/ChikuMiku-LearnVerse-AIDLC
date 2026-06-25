/**
 * ParentRegistrationForm — Screen-level parent registration form component.
 *
 * Renders a form with username, name, phone, email, and password fields.
 * Performs inline validation on blur and as the user types.
 * Handles server errors including duplicate username/email/phone and 5xx errors.
 * Preserves all field values on error; only highlights invalid fields.
 *
 * Validates: Requirements 1.14–1.19, 1.44–1.49
 */

import { escapeHtml } from '../utils/escapeHtml';

// ─── Exported Interfaces ───────────────────────────────────────────────────────

export interface FieldError {
  field: string;
  message: string;
}

export interface ParentRegistrationFormProps {
  onSubmit: (data: {
    username: string;
    name: string;
    phone: string;
    email: string;
    password: string;
  }) => Promise<{ success: boolean; fieldErrors?: FieldError[] }>;
  onBack?: () => void;
  isLoading?: boolean;
}

// ─── Design System Colors ──────────────────────────────────────────────────────

const COLORS = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  red: '#E74C3C',
  green: '#27AE60',
  white: '#FFFFFF',
  muted: '#7A6E8A',
} as const;

// ─── Validation Rules ──────────────────────────────────────────────────────────

interface FieldConfig {
  name: string;
  label: string;
  type: string;
  autocomplete: AutoFill;
  placeholder: string;
  validate: (value: string) => string | null;
}

function validateUsername(value: string): string | null {
  if (value.trim().length === 0) return 'Username is required';
  if (value.length < 8 || value.length > 15) return 'Username must be between 8 and 15 characters';
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Username can only contain letters, numbers, hyphens, and underscores';
  return null;
}

function validateName(value: string): string | null {
  if (value.trim().length === 0) return 'Name is required';
  if (value.length < 5 || value.length > 20) return 'Name must be between 5 and 20 characters';
  if (!/^[a-zA-Z ]+$/.test(value)) return 'Name can only contain letters and spaces';
  return null;
}

function validatePhone(value: string): string | null {
  if (value.trim().length === 0) return 'Phone number is required';
  if (!/^\d{10}$/.test(value)) return 'Phone number must be exactly 10 digits';
  return null;
}

function validateEmail(value: string): string | null {
  if (value.trim().length === 0) return 'Email is required';
  if (value.length > 30) return 'Email must be 30 characters or less';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return 'Please enter a valid email address';
  return null;
}

function validatePassword(value: string): string | null {
  if (value.trim().length === 0) return 'Password is required';
  if (value.length < 8 || value.length > 20) return 'Password must be between 8 and 20 characters';
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) return 'Password must contain at least one special character';
  return null;
}

const FIELD_CONFIGS: FieldConfig[] = [
  { name: 'username', label: 'Username', type: 'text', autocomplete: 'username', placeholder: '8-15 characters', validate: validateUsername },
  { name: 'name', label: 'Name', type: 'text', autocomplete: 'name', placeholder: '5-20 characters, letters and spaces', validate: validateName },
  { name: 'phone', label: 'Phone Number', type: 'tel', autocomplete: 'tel', placeholder: '10 digits', validate: validatePhone },
  { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', placeholder: 'name@example.com', validate: validateEmail },
  { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', placeholder: '8-20 characters', validate: validatePassword },
];

// ─── Server Error Messages ─────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Record<string, string> = {
  username: 'Username already taken \u2014 please choose a different username',
  email: 'Email already registered \u2014 try logging in or use a different email',
  phone: 'Phone number already registered \u2014 try logging in or use a different number',
};

const GENERIC_SERVER_ERROR = 'Something went wrong \u2014 please try again after some time';

// ─── Inline Styles ─────────────────────────────────────────────────────────────

const styles = {
  container: {
    backgroundColor: COLORS.background,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as Partial<CSSStyleDeclaration>,

  card: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    padding: '2rem',
    width: '100%',
    maxWidth: '440px',
  } as Partial<CSSStyleDeclaration>,

  heading: {
    fontSize: '26px',
    fontWeight: '700',
    color: COLORS.dark,
    margin: '0 0 0.25rem 0',
    textAlign: 'center',
  } as Partial<CSSStyleDeclaration>,

  subtitle: {
    fontSize: '13px',
    color: COLORS.muted,
    margin: '0 0 1.5rem 0',
    textAlign: 'center',
  } as Partial<CSSStyleDeclaration>,

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  } as Partial<CSSStyleDeclaration>,

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
  } as Partial<CSSStyleDeclaration>,

  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: '0.25rem',
  } as Partial<CSSStyleDeclaration>,

  input: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '13px',
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
    backgroundColor: COLORS.white,
    color: COLORS.dark,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  } as Partial<CSSStyleDeclaration>,

  inputError: {
    borderColor: COLORS.red,
    boxShadow: `0 0 0 2px rgba(231, 76, 60, 0.15)`,
  } as Partial<CSSStyleDeclaration>,

  inputFocus: {
    borderColor: COLORS.primary,
    boxShadow: `0 0 0 3px rgba(233, 79, 155, 0.15)`,
  } as Partial<CSSStyleDeclaration>,

  errorMessage: {
    color: COLORS.red,
    fontSize: '10px',
    marginTop: '0.25rem',
    lineHeight: '1.4',
  } as Partial<CSSStyleDeclaration>,

  submitButton: {
    width: '100%',
    padding: '0.625rem 1rem',
    fontSize: '13px',
    fontWeight: '600',
    color: COLORS.white,
    backgroundColor: COLORS.primary,
    border: 'none',
    borderRadius: '22px',
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  } as Partial<CSSStyleDeclaration>,

  submitButtonDisabled: {
    opacity: '0.6',
    cursor: 'not-allowed',
  } as Partial<CSSStyleDeclaration>,

  generalError: {
    marginTop: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    color: COLORS.red,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    fontSize: '12px',
    textAlign: 'center',
  } as Partial<CSSStyleDeclaration>,

  backButton: {
    display: 'inline-block',
    marginBottom: '1rem',
    fontSize: '12px',
    color: COLORS.secondary,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: '0',
    textDecoration: 'underline',
  } as Partial<CSSStyleDeclaration>,

  loadingSpinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: COLORS.white,
    borderRadius: '50%',
    marginRight: '0.5rem',
    verticalAlign: 'middle',
  } as Partial<CSSStyleDeclaration>,
};

// ─── Helper to apply styles ────────────────────────────────────────────────────

function applyStyles(el: HTMLElement, styleObj: Partial<CSSStyleDeclaration>): void {
  for (const [key, value] of Object.entries(styleObj)) {
    if (value !== undefined) {
      (el.style as unknown as Record<string, string>)[key] = value as string;
    }
  }
}

// ─── Component Factory ─────────────────────────────────────────────────────────

/**
 * Creates a Parent Registration Form DOM element.
 *
 * @param props - Component props including onSubmit handler, optional onBack, and isLoading state
 * @returns An HTMLElement containing the registration form
 */
export function createParentRegistrationScreen(props: ParentRegistrationFormProps): HTMLElement {
  const { onSubmit, onBack, isLoading: externalLoading } = props;

  let internalLoading = false;

  // --- Container ---
  const container = document.createElement('div');
  applyStyles(container, styles.container);

  // --- Card ---
  const card = document.createElement('div');
  applyStyles(card, styles.card);

  // --- Back button ---
  if (onBack) {
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '\u2190 Back';
    applyStyles(backBtn, styles.backButton);
    backBtn.addEventListener('click', onBack);
    card.appendChild(backBtn);
  }

  // --- Heading ---
  const heading = document.createElement('h1');
  heading.textContent = 'Parent Registration';
  applyStyles(heading, styles.heading);
  card.appendChild(heading);

  // --- Subtitle ---
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Create your parent account to manage learners';
  applyStyles(subtitle, styles.subtitle);
  card.appendChild(subtitle);

  // --- Form ---
  const form = document.createElement('form');
  form.noValidate = true;
  form.setAttribute('aria-label', 'Parent Registration Form');
  applyStyles(form, styles.form);

  // Field references
  const inputs: Record<string, HTMLInputElement> = {};
  const errorEls: Record<string, HTMLElement> = {};
  const fieldGroups: Record<string, HTMLElement> = {};
  const touchedFields = new Set<string>();

  // --- Create fields ---
  for (const fieldConfig of FIELD_CONFIGS) {
    const group = document.createElement('div');
    applyStyles(group, styles.fieldGroup);

    // Label
    const label = document.createElement('label');
    label.htmlFor = `preg-${fieldConfig.name}`;
    label.textContent = fieldConfig.label;
    applyStyles(label, styles.label);

    // Input
    const input = document.createElement('input');
    input.type = fieldConfig.type;
    input.id = `preg-${fieldConfig.name}`;
    input.name = fieldConfig.name;
    input.autocomplete = fieldConfig.autocomplete;
    input.placeholder = fieldConfig.placeholder;
    input.setAttribute('aria-describedby', `preg-${fieldConfig.name}-error`);
    applyStyles(input, styles.input);

    // Error element
    const errorEl = document.createElement('div');
    errorEl.id = `preg-${fieldConfig.name}-error`;
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'polite');
    applyStyles(errorEl, styles.errorMessage);
    errorEl.style.display = 'none';

    // Focus style handlers
    input.addEventListener('focus', () => {
      if (!errorEl.textContent) {
        applyStyles(input, styles.inputFocus);
      }
    });

    input.addEventListener('blur', () => {
      touchedFields.add(fieldConfig.name);
      // Reset focus ring
      input.style.boxShadow = '';
      if (!errorEl.textContent) {
        input.style.borderColor = COLORS.border;
      }
      // Validate on blur
      const error = fieldConfig.validate(input.value);
      showFieldError(fieldConfig.name, error);
    });

    // Validate as user types (only after field has been touched)
    input.addEventListener('input', () => {
      if (touchedFields.has(fieldConfig.name)) {
        const error = fieldConfig.validate(input.value);
        showFieldError(fieldConfig.name, error);
      }
    });

    group.appendChild(label);
    group.appendChild(input);
    group.appendChild(errorEl);
    form.appendChild(group);

    inputs[fieldConfig.name] = input;
    errorEls[fieldConfig.name] = errorEl;
    fieldGroups[fieldConfig.name] = group;
  }

  // --- Submit button ---
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Register Parent';
  applyStyles(submitBtn, styles.submitButton);
  form.appendChild(submitBtn);

  card.appendChild(form);

  // --- General error area (for 5xx errors) ---
  const generalErrorEl = document.createElement('div');
  generalErrorEl.setAttribute('role', 'alert');
  generalErrorEl.setAttribute('aria-live', 'polite');
  applyStyles(generalErrorEl, styles.generalError);
  generalErrorEl.style.display = 'none';
  card.appendChild(generalErrorEl);

  container.appendChild(card);

  // --- CSS animation for spinner (inject once) ---
  if (!document.getElementById('preg-spinner-keyframes')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'preg-spinner-keyframes';
    styleSheet.textContent = `
      @keyframes preg-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // ─── Helper Functions ──────────────────────────────────────────────────────────

  function showFieldError(fieldName: string, message: string | null): void {
    const errorEl = errorEls[fieldName];
    const input = inputs[fieldName];
    if (!errorEl || !input) return;

    if (message) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      input.setAttribute('aria-invalid', 'true');
      input.style.borderColor = COLORS.red;
      input.style.boxShadow = `0 0 0 2px rgba(231, 76, 60, 0.15)`;
    } else {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
      input.setAttribute('aria-invalid', 'false');
      input.style.borderColor = COLORS.border;
      input.style.boxShadow = '';
    }
  }

  function clearAllFieldErrors(): void {
    for (const fieldConfig of FIELD_CONFIGS) {
      showFieldError(fieldConfig.name, null);
    }
  }

  function showGeneralError(message: string): void {
    generalErrorEl.textContent = message;
    generalErrorEl.style.display = 'block';
  }

  function clearGeneralError(): void {
    generalErrorEl.textContent = '';
    generalErrorEl.style.display = 'none';
  }

  function setLoading(loading: boolean): void {
    internalLoading = loading;
    const isDisabled = loading || externalLoading;
    submitBtn.disabled = !!isDisabled;

    if (isDisabled) {
      applyStyles(submitBtn, styles.submitButtonDisabled);
    } else {
      submitBtn.style.opacity = '';
      submitBtn.style.cursor = 'pointer';
    }

    if (loading) {
      submitBtn.innerHTML = '';
      const spinner = document.createElement('span');
      applyStyles(spinner, styles.loadingSpinner);
      spinner.style.animation = 'preg-spin 0.6s linear infinite';
      submitBtn.appendChild(spinner);
      submitBtn.appendChild(document.createTextNode('Registering...'));
    } else {
      submitBtn.textContent = 'Register Parent';
    }
  }

  function validateAllFields(): boolean {
    let allValid = true;
    for (const fieldConfig of FIELD_CONFIGS) {
      touchedFields.add(fieldConfig.name);
      const error = fieldConfig.validate(inputs[fieldConfig.name].value);
      showFieldError(fieldConfig.name, error);
      if (error) allValid = false;
    }
    return allValid;
  }

  // ─── Form Submit Handler ───────────────────────────────────────────────────────

  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();

    if (internalLoading || externalLoading) return;

    clearGeneralError();

    // Step 1: Client-side validation
    const isValid = validateAllFields();
    if (!isValid) {
      // Focus the first invalid field
      for (const fieldConfig of FIELD_CONFIGS) {
        if (fieldConfig.validate(inputs[fieldConfig.name].value)) {
          inputs[fieldConfig.name].focus();
          break;
        }
      }
      return;
    }

    // Step 2: Clear all errors and show loading
    clearAllFieldErrors();
    clearGeneralError();
    setLoading(true);

    // Step 3: Call onSubmit
    try {
      const result = await onSubmit({
        username: inputs.username.value,
        name: inputs.name.value,
        phone: inputs.phone.value,
        email: inputs.email.value,
        password: inputs.password.value,
      });

      setLoading(false);

      if (result.success) {
        // Success — the parent component handles navigation
        return;
      }

      // Step 4: Handle field-specific server errors
      if (result.fieldErrors && result.fieldErrors.length > 0) {
        let hasKnownDuplicate = false;
        for (const fieldError of result.fieldErrors) {
          const fieldName = fieldError.field;
          // Map server duplicate errors to user-friendly messages
          const friendlyMessage = SERVER_ERROR_MESSAGES[fieldName];
          if (friendlyMessage) {
            showFieldError(fieldName, friendlyMessage);
            hasKnownDuplicate = true;
          } else {
            // Use the server-provided message for unknown field errors
            showFieldError(fieldName, escapeHtml(fieldError.message));
          }
        }

        if (!hasKnownDuplicate) {
          // If no recognizable duplicate errors, show generic server error
          showGeneralError(GENERIC_SERVER_ERROR);
        }
      } else {
        // No fieldErrors → treat as 5xx / generic error
        showGeneralError(GENERIC_SERVER_ERROR);
      }
    } catch {
      setLoading(false);
      // Network or unexpected error — preserve all fields
      showGeneralError(GENERIC_SERVER_ERROR);
    }
  });

  return container;
}
