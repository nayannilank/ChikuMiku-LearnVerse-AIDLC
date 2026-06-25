/**
 * @vitest-environment happy-dom
 */
/**
 * Property Tests: Preservation — Valid Input Behavior & Login Flow Unchanged
 *
 * These tests encode the EXISTING behavior that must be preserved after fixing
 * the four login page bugs. They are written against UNFIXED code and should PASS,
 * confirming the baseline behavior we need to maintain.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createParentRegistrationForm } from '../ParentRegistrationForm';
import { createLoginForm } from '../LoginForm';
import { createHomeView } from '../../views/HomeView';

// Mock AuthService to control login responses
vi.mock('../../services/AuthService', () => ({
  loginWithRole: vi.fn(),
  registerParent: vi.fn(),
}));

// Mock Header to create a simple header with register button
vi.mock('../Header', () => ({
  createHeader: vi.fn((opts: { onRegisterClick: () => void }) => {
    const el = document.createElement('header');
    el.className = 'home-header';
    const btn = document.createElement('button');
    btn.textContent = 'Register';
    btn.className = 'register-btn';
    btn.addEventListener('click', opts.onRegisterClick);
    el.appendChild(btn);
    return el;
  }),
}));

// Mock BackgroundWatermark to create a simple div
vi.mock('../BackgroundWatermark', () => ({
  createBackgroundWatermark: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'background-watermark';
    return el;
  }),
}));

import { loginWithRole } from '../../services/AuthService';

const mockedLoginWithRole = vi.mocked(loginWithRole);

describe('Preservation 1 - Valid Phone/Email No Error on Blur', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any valid 10-digit phone number, blurring the phone input field
   * SHALL NOT display any error element for the phone field.
   * On unfixed code, blur listeners don't exist so nothing happens — no error shown.
   */
  it('does not show error on blur for valid phone values', () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
          { minLength: 10, maxLength: 10 }
        ),
        (validPhone) => {
          const form = createParentRegistrationForm({ onSuccess: vi.fn() });

          const phoneInput = form.querySelector('#parent-reg-phone') as HTMLInputElement;
          expect(phoneInput).not.toBeNull();

          // Set valid phone value
          phoneInput.value = validPhone;

          // Dispatch blur event
          phoneInput.dispatchEvent(new Event('blur', { bubbles: true }));

          // Assert: NO error element is displayed for the phone field
          const errorEl = form.querySelector('#parent-reg-phone-error') as HTMLElement;
          expect(errorEl).not.toBeNull();
          // Error element should be hidden (display: none) and have no content
          expect(errorEl.style.display).toBe('none');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * For any valid email address, blurring the email input field
   * SHALL NOT display any error element for the email field.
   * On unfixed code, blur listeners don't exist so nothing happens — no error shown.
   */
  it('does not show error on blur for valid email values', () => {
    fc.assert(
      fc.property(
        fc.emailAddress().filter((e) => e.length <= 30),
        (validEmail) => {
          const form = createParentRegistrationForm({ onSuccess: vi.fn() });

          const emailInput = form.querySelector('#parent-reg-email') as HTMLInputElement;
          expect(emailInput).not.toBeNull();

          // Set valid email value
          emailInput.value = validEmail;

          // Dispatch blur event
          emailInput.dispatchEvent(new Event('blur', { bubbles: true }));

          // Assert: NO error element is displayed for the email field
          const errorEl = form.querySelector('#parent-reg-email-error') as HTMLElement;
          expect(errorEl).not.toBeNull();
          // Error element should be hidden (display: none) and have no content
          expect(errorEl.style.display).toBe('none');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Preservation 2 - Non-Empty Credentials Login Flow', () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * For any non-empty credential pair (username, password), submitting the login
   * form SHALL call onSubmit with the trimmed username and password values.
   * On unfixed code, there is no validation so all non-empty credentials pass through.
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onSubmit with trimmed username and password for non-empty credentials', async () => {
    // Username must be 5-15 chars, alphanumeric + underscore + hyphen
    const validUsernameArb = fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
      { minLength: 5, maxLength: 15 }
    );
    // Password must be 8-20 chars with uppercase, lowercase, digit, and special char
    // Ensure minimum 8 chars total by using minLength: 2 for each category
    const validPasswordArb = fc.tuple(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 2, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 2, maxLength: 4 }),
      fc.stringOf(fc.constantFrom(...'!@#$%^&*'.split('')), { minLength: 2, maxLength: 4 }),
    ).map(([lower, upper, digit, special]) => lower + upper + digit + special);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: validUsernameArb,
          password: validPasswordArb,
        }),
        async (creds) => {
          const onSubmit = vi.fn().mockResolvedValue(undefined);

          const el = createLoginForm({
            role: 'parent',
            onSubmit,
            onForgotPassword: vi.fn(),
            onRegister: vi.fn(),
          });

          // Set input values
          const usernameInput = el.querySelector('#login-username') as HTMLInputElement;
          const passwordInput = el.querySelector('#login-password') as HTMLInputElement;
          usernameInput.value = creds.username;
          passwordInput.value = creds.password;

          // Dispatch submit event
          const form = el.querySelector('form') as HTMLFormElement;
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

          // Wait for async submit handler to complete
          await vi.waitFor(() => {
            expect(onSubmit).toHaveBeenCalled();
          });

          // Assert: onSubmit IS called with trimmed username and password
          expect(onSubmit).toHaveBeenCalledWith(
            creds.username.trim(),
            creds.password,
            'parent'
          );
        }
      ),
      { numRuns: 20 }
    );
  }, 15000);
});

describe('Preservation 3 - Submit-time Registration Validation', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * When the registration form is submitted with empty/invalid data,
   * inline validation errors SHALL appear for required fields.
   * On unfixed code, this already works via the submit event handler.
   */
  it('shows inline validation errors on submit with empty fields', () => {
    const form = createParentRegistrationForm({ onSuccess: vi.fn() });

    // Leave all fields empty and dispatch form submit
    const formEl = form.querySelector('form') as HTMLFormElement;
    formEl.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Assert: inline validation errors appear for required fields
    const errorElements = form.querySelectorAll('.form-group__error');
    const visibleErrors = Array.from(errorElements).filter(
      (el) => (el as HTMLElement).style.display !== 'none' && el.textContent !== ''
    );

    // At least the required fields (username, name, phone, email, password) should show errors
    expect(visibleErrors.length).toBeGreaterThan(0);
  });
});

describe('Preservation 4 - Login Failure Shows Error and Action Links', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * When onSubmit throws an error, the login form SHALL display the error
   * message in the error area and show the failure actions (Register + Reset Password links).
   * On unfixed code, this already works correctly.
   */
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error message and failure actions when onSubmit throws', async () => {
    const errorMessage = 'Invalid credentials';
    const onSubmit = vi.fn().mockRejectedValue(new Error(errorMessage));

    const el = createLoginForm({
      role: 'parent',
      onSubmit,
      onForgotPassword: vi.fn(),
      onRegister: vi.fn(),
    });

    // Set non-empty input values that pass validation so submission proceeds
    const usernameInput = el.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = el.querySelector('#login-password') as HTMLInputElement;
    usernameInput.value = 'testuser1';
    passwordInput.value = 'Test1234!';

    // Dispatch submit event
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for async error handling to complete
    await vi.waitFor(() => {
      const errorArea = el.querySelector('.login-form__error') as HTMLElement;
      expect(errorArea.style.display).toBe('block');
    });

    // Assert: error area becomes visible with the error message
    const errorArea = el.querySelector('.login-form__error') as HTMLElement;
    expect(errorArea.style.display).toBe('block');
    expect(errorArea.textContent).toContain(errorMessage);

    // Assert: failure actions (Register + Reset Password links) become visible
    const failureActions = el.querySelector('.login-form__failure-actions') as HTMLElement;
    expect(failureActions.style.display).toBe('block');

    // Verify the links exist
    const links = failureActions.querySelectorAll('a');
    expect(links.length).toBe(2);
    const linkTexts = Array.from(links).map((l) => l.textContent);
    expect(linkTexts).toContain('Register');
    expect(linkTexts).toContain('Reset Password');
  });
});

describe('Preservation 5 - Header Register Navigation', () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * Clicking the Register button in the header SHALL navigate to #register.
   * On unfixed code, this already works via the onRegisterClick callback in HomeView.
   */
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('navigates to #register when header register button is clicked', () => {
    const view = createHomeView();

    // Find the register button in the header
    const registerBtn = view.querySelector('.register-btn') as HTMLButtonElement;
    expect(registerBtn).not.toBeNull();
    expect(registerBtn.textContent).toBe('Register');

    // Click the register button
    registerBtn.click();

    // Assert: window.location.hash changes to #register
    expect(window.location.hash).toBe('#register');
  });
});
