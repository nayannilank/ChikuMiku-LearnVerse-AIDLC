/**
 * @vitest-environment jsdom
 */
/**
 * Property Tests: Preservation - Unauthenticated Pages Unchanged
 *
 * Feature: header-navigation-fix, Property 2: Preservation
 *
 * For any navigation to unauthenticated routes (#, #register, #forgot-password,
 * #reset-password), the rendered DOM SHALL produce exactly the same output as the
 * original code, preserving the existing header with Register button on the home page,
 * "Back to Login" links on registration/password pages, and all existing navigation behavior.
 *
 * These tests MUST PASS on unfixed code - they capture baseline behavior to preserve.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';

import { createHeader } from './Header';
import { createHeaderLogo } from './HeaderLogo';

// Import views to test preservation
import { createRegistrationView } from '../views/RegistrationView';
import { createForgotPasswordView } from '../views/ForgotPasswordView';
import { createResetPasswordView } from '../views/ResetPasswordView';

// --- Arbitraries ---

/** Generates arbitrary callback functions for the header's onRegisterClick */
const callbackArb = fc.constant(() => {});

/** Generates arbitrary reset password tokens */
const tokenArb = fc.string({ minLength: 0, maxLength: 100 });

describe('Feature: header-navigation-fix, Property 2: Preservation - Unauthenticated Pages Unchanged', () => {
  describe('Property 1: Home page header contains <header> with class home-header, logo element, and Register button (Requirement 3.1)', () => {
    it('for ANY onRegisterClick callback, createHeader renders a <header> with class home-header', () => {
      fc.assert(
        fc.property(callbackArb, (_cb) => {
          const header = createHeader({ onRegisterClick: () => {} });

          // Must be a <header> element
          expect(header.tagName.toLowerCase()).toBe('header');
          // Must have class 'home-header'
          expect(header.className).toBe('home-header');
        }),
        { numRuns: 50 }
      );
    });

    it('for ANY onRegisterClick callback, createHeader renders a logo element (.header-logo)', () => {
      fc.assert(
        fc.property(callbackArb, (_cb) => {
          const header = createHeader({ onRegisterClick: () => {} });

          // Must contain a .header-logo element
          const logo = header.querySelector('.header-logo');
          expect(logo).not.toBeNull();
        }),
        { numRuns: 50 }
      );
    });

    it('for ANY onRegisterClick callback, createHeader renders a Register button', () => {
      fc.assert(
        fc.property(callbackArb, (_cb) => {
          const header = createHeader({ onRegisterClick: () => {} });

          // Must contain a button with text "Register" and class "register-btn"
          const registerBtn = header.querySelector('button.register-btn');
          expect(registerBtn).not.toBeNull();
          expect(registerBtn!.textContent).toBe('Register');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: Register button click invokes the onRegisterClick callback (Requirement 3.4)', () => {
    it('for ANY invocation, clicking the Register button calls onRegisterClick exactly once', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (clickCount) => {
          const mockCallback = vi.fn();
          const header = createHeader({ onRegisterClick: mockCallback });

          const registerBtn = header.querySelector('button.register-btn') as HTMLButtonElement;
          expect(registerBtn).not.toBeNull();

          // Click the button `clickCount` times
          for (let i = 0; i < clickCount; i++) {
            registerBtn.click();
          }

          // Callback should have been invoked exactly `clickCount` times
          expect(mockCallback).toHaveBeenCalledTimes(clickCount);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 3: Registration view does NOT render a persistent <header> but contains "Back to Login" link (Requirement 3.2)', () => {
    it('createRegistrationView does NOT contain a <header> element', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const view = createRegistrationView();

          // Registration view should NOT have a persistent <header> element
          const header = view.querySelector('header');
          expect(header).toBeNull();
        }),
        { numRuns: 20 }
      );
    });

    it('createRegistrationView contains a "Back to Login" link pointing to #', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const view = createRegistrationView();

          // Must contain "Back to Login" link
          const backLink = view.querySelector('a.registration-view__back-link');
          expect(backLink).not.toBeNull();
          expect(backLink!.textContent).toBe('Back to Login');
          expect(backLink!.getAttribute('href')).toBe('#');
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 4: Forgot/Reset password views maintain their existing navigation links unchanged (Requirement 3.3)', () => {
    it('createForgotPasswordView contains a "Back to Login" link without a persistent <header>', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          const view = createForgotPasswordView();

          // Should NOT have a persistent <header> element
          const header = view.querySelector('header');
          expect(header).toBeNull();

          // Must contain "Back to Login" link
          const backLink = view.querySelector('a.forgot-password-view__back-link');
          expect(backLink).not.toBeNull();
          expect(backLink!.textContent).toBe('Back to Login');
          expect(backLink!.getAttribute('href')).toBe('#');
        }),
        { numRuns: 20 }
      );
    });

    it('for ANY reset token, createResetPasswordView contains a "Back to Login" link without a persistent <header>', () => {
      fc.assert(
        fc.property(tokenArb, (token) => {
          const view = createResetPasswordView(token);

          // Should NOT have a persistent <header> element
          const header = view.querySelector('header');
          expect(header).toBeNull();

          // Must contain "Back to Login" link
          const backLink = view.querySelector('a.reset-password-view__back-link');
          expect(backLink).not.toBeNull();
          expect(backLink!.textContent).toBe('Back to Login');
          expect(backLink!.getAttribute('href')).toBe('#');
        }),
        { numRuns: 50 }
      );
    });
  });
});
