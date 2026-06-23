/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createParentRegistrationView } from '../ParentRegistrationView';

// Mock AuthService to prevent real API calls
vi.mock('../../services/AuthService', () => ({
  registerParent: vi.fn(),
}));

describe('ParentRegistrationView', () => {
  /**
   * Validates: Requirements 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1
   */

  describe('TopNavBar presence', () => {
    it('renders a nav element with class "top-nav-bar"', () => {
      const view = createParentRegistrationView();
      const nav = view.querySelector('nav.top-nav-bar');
      expect(nav).not.toBeNull();
    });
  });

  describe('heading and subtitle', () => {
    it('displays heading text "Create Parent Account"', () => {
      const view = createParentRegistrationView();
      const heading = view.querySelector('.registration-card__heading');
      expect(heading).not.toBeNull();
      expect(heading!.textContent).toBe('Create Parent Account');
    });

    it('displays subtitle text "Register first, then add your children"', () => {
      const view = createParentRegistrationView();
      const subtitle = view.querySelector('.registration-card__subtitle');
      expect(subtitle).not.toBeNull();
      expect(subtitle!.textContent).toBe('Register first, then add your children');
    });
  });

  describe('form fields with correct placeholders', () => {
    it('renders "Parent Username *" field with placeholder "8-15 characters allowed"', () => {
      const view = createParentRegistrationView();
      const labels = view.querySelectorAll('.form-field__label');
      const inputs = view.querySelectorAll('.form-field__input');

      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Parent Username *');

      const usernameInput = view.querySelector('input[name="username"]') as HTMLInputElement;
      expect(usernameInput).not.toBeNull();
      expect(usernameInput.placeholder).toBe('8-15 characters allowed');
    });

    it('renders "Name *" field with placeholder "5-20 characters allowed"', () => {
      const view = createParentRegistrationView();
      const labels = view.querySelectorAll('.form-field__label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Name *');

      const nameInput = view.querySelector('input[name="name"]') as HTMLInputElement;
      expect(nameInput).not.toBeNull();
      expect(nameInput.placeholder).toBe('5-20 characters allowed');
    });

    it('renders "Phone *" field with placeholder "10 digits required"', () => {
      const view = createParentRegistrationView();
      const labels = view.querySelectorAll('.form-field__label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Phone *');

      const phoneInput = view.querySelector('input[name="phone"]') as HTMLInputElement;
      expect(phoneInput).not.toBeNull();
      expect(phoneInput.placeholder).toBe('10 digits required');
    });

    it('renders "Email *" field with placeholder "30 characters maximum"', () => {
      const view = createParentRegistrationView();
      const labels = view.querySelectorAll('.form-field__label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Email *');

      const emailInput = view.querySelector('input[name="email"]') as HTMLInputElement;
      expect(emailInput).not.toBeNull();
      expect(emailInput.placeholder).toBe('30 characters maximum');
    });

    it('renders "Password *" field with placeholder "8-20 chars, uppercase, lowercase, number, symbol"', () => {
      const view = createParentRegistrationView();
      const labels = view.querySelectorAll('.form-field__label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Password *');

      const passwordInput = view.querySelector('input[name="password"]') as HTMLInputElement;
      expect(passwordInput).not.toBeNull();
      expect(passwordInput.placeholder).toBe('8-20 chars, uppercase, lowercase, number, symbol');
    });
  });

  describe('PasswordStrengthIndicator', () => {
    it('renders PasswordStrengthIndicator below the password field', () => {
      const view = createParentRegistrationView();
      const indicator = view.querySelector('.password-strength-indicator');
      expect(indicator).not.toBeNull();
    });
  });

  describe('submit button', () => {
    it('renders submit button with text "Register Parent"', () => {
      const view = createParentRegistrationView();
      const button = view.querySelector('.registration-form__submit');
      expect(button).not.toBeNull();
      expect(button!.textContent).toBe('Register Parent');
    });

    it('submit button has class "registration-form__submit"', () => {
      const view = createParentRegistrationView();
      const button = view.querySelector('button.registration-form__submit');
      expect(button).not.toBeNull();
    });
  });
});
