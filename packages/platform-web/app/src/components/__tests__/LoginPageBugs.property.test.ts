/**
 * @vitest-environment happy-dom
 */
/**
 * Property Tests: Bug Condition Exploration — Login Page Missing Validation & Navigation Bugs
 *
 * This test encodes the EXPECTED (correct) behavior for each of the four bugs.
 * It is designed to FAIL on unfixed code, proving the bugs exist.
 * Once the fixes are applied, this test should PASS.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7**
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

// Mock Header and BackgroundWatermark to simplify DOM for HomeView tests
vi.mock('../Header', () => ({
  createHeader: vi.fn((opts: { onRegisterClick: () => void }) => {
    const el = document.createElement('header');
    el.className = 'home-header';
    const btn = document.createElement('button');
    btn.textContent = 'Register';
    btn.addEventListener('click', opts.onRegisterClick);
    el.appendChild(btn);
    return el;
  }),
}));

vi.mock('../BackgroundWatermark', () => ({
  createBackgroundWatermark: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'background-watermark';
    return el;
  }),
}));

import { loginWithRole } from '../../services/AuthService';

const mockedLoginWithRole = vi.mocked(loginWithRole);

describe('Bug 1 - Blur Validation (Registration Form): Phone field', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * For any invalid phone string (non-10-digit or contains non-digit characters),
   * when the phone input loses focus (blur event), the ParentRegistrationForm
   * SHALL display an inline error element below the phone field.
   */
  it('displays inline error on blur for invalid phone values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => {
          // Invalid phone: not exactly 10 digits
          return !/^\d{10}$/.test(s);
        }),
        (invalidPhone) => {
          const form = createParentRegistrationForm({ onSuccess: vi.fn() });

          const phoneInput = form.querySelector('#parent-reg-phone') as HTMLInputElement;
          expect(phoneInput).not.toBeNull();

          // Set the invalid phone value
          phoneInput.value = invalidPhone;

          // Dispatch blur event
          phoneInput.dispatchEvent(new Event('blur', { bubbles: true }));

          // Assert: inline error element should be visible
          const errorEl = form.querySelector('#parent-reg-phone-error') as HTMLElement;
          expect(errorEl).not.toBeNull();
          expect(errorEl.style.display).not.toBe('none');
          expect(errorEl.textContent).not.toBe('');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Bug 1 - Blur Validation (Registration Form): Email field', () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * For any invalid email string (not matching standard email patterns),
   * when the email input loses focus (blur event), the ParentRegistrationForm
   * SHALL display an inline error element below the email field.
   */
  it('displays inline error on blur for invalid email values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => {
          // Invalid email: no @ or no domain part
          return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        }),
        (invalidEmail) => {
          const form = createParentRegistrationForm({ onSuccess: vi.fn() });

          const emailInput = form.querySelector('#parent-reg-email') as HTMLInputElement;
          expect(emailInput).not.toBeNull();

          // Set the invalid email value
          emailInput.value = invalidEmail;

          // Dispatch blur event
          emailInput.dispatchEvent(new Event('blur', { bubbles: true }));

          // Assert: inline error element should be visible
          const errorEl = form.querySelector('#parent-reg-email-error') as HTMLElement;
          expect(errorEl).not.toBeNull();
          expect(errorEl.style.display).not.toBe('none');
          expect(errorEl.textContent).not.toBe('');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Bug 2 - Forgot Password Link (Login Form)', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any initial render of the login form (regardless of role),
   * a visible "Forgot password?" link element SHALL exist in the DOM
   * that is NOT hidden inside the failure actions section.
   */
  it('renders a visible forgot-password link on initial render', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('parent' as const, 'student' as const),
        (role) => {
          const el = createLoginForm({
            role,
            onSubmit: vi.fn().mockResolvedValue(undefined),
            onForgotPassword: vi.fn(),
            onRegister: vi.fn(),
          });

          // Assert: a .forgot-password-link element exists AND is visible (not inside hidden container)
          const forgotLink = el.querySelector('.forgot-password-link') as HTMLElement | null;

          // Alternative: any visible link with "Forgot password?" text
          const allLinks = el.querySelectorAll('a');
          const forgotTextLink = Array.from(allLinks).find((link) => {
            const text = link.textContent || '';
            if (!text.includes('Forgot password')) return false;
            // Must not be inside a hidden parent
            let parent = link.parentElement;
            while (parent && parent !== el) {
              if ((parent as HTMLElement).style.display === 'none') return false;
              parent = parent.parentElement;
            }
            return true;
          });

          // The forgot-password-link must exist as a dedicated, always-visible element
          const found = forgotLink ?? forgotTextLink ?? null;
          expect(found).not.toBeNull();

          // If found, it must be visible (not hidden)
          if (found) {
            // Check it's not inside a hidden container
            let parent = (found as HTMLElement).parentElement;
            while (parent && parent !== el) {
              expect((parent as HTMLElement).style.display).not.toBe('none');
              parent = parent.parentElement;
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Bug 3 - Empty Credentials Validation (Login Form)', () => {
  /**
   * **Validates: Requirements 1.4, 1.5, 1.6**
   *
   * For any credential pair where at least one of (username, password) is empty,
   * the login form SHALL prevent submission (onSubmit not called) and SHALL
   * display inline validation errors for the empty field(s).
   */
  it('blocks submission and shows validation errors when credentials have empty fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          username: fc.oneof(fc.constant(''), fc.string({ minLength: 0, maxLength: 20 })),
          password: fc.oneof(fc.constant(''), fc.string({ minLength: 0, maxLength: 20 })),
        }).filter((creds) => creds.username.trim() === '' || creds.password === ''),
        (creds) => {
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

          // Assert: onSubmit was NOT called (submission was blocked)
          expect(onSubmit).not.toHaveBeenCalled();

          // Assert: inline validation error elements are visible for the empty field(s)
          if (creds.username.trim() === '') {
            const usernameError = el.querySelector('.validation-error, [role="alert"]');
            // There should be some visible validation error in the form
            const allErrors = el.querySelectorAll('[role="alert"]');
            const visibleErrors = Array.from(allErrors).filter(
              (err) => (err as HTMLElement).style.display !== 'none' && err.textContent !== ''
            );
            expect(visibleErrors.length).toBeGreaterThan(0);
          }

          if (creds.password === '') {
            const allErrors = el.querySelectorAll('[role="alert"]');
            const visibleErrors = Array.from(allErrors).filter(
              (err) => (err as HTMLElement).style.display !== 'none' && err.textContent !== ''
            );
            expect(visibleErrors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Bug 4 - Post-Login Navigation (HomeView)', () => {
  /**
   * **Validates: Requirements 1.7**
   *
   * After a successful login, the HomeView SHALL set window.location.hash
   * to '#dashboard', triggering navigation to the dashboard route.
   */
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('navigates to #dashboard after successful login', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: true,
      data: { token: 'mock-token', username: 'testuser' },
    });

    const view = createHomeView();

    // Select the parent role
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Fill in credentials
    const usernameInput = view.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = view.querySelector('#login-password') as HTMLInputElement;
    usernameInput.value = 'testuser';
    passwordInput.value = 'testpass';

    // Submit the form
    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for async login to complete and check navigation
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#dashboard');
    });
  });
});
