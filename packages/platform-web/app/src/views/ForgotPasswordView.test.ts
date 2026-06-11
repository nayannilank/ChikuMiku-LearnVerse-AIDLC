// @vitest-environment happy-dom
/**
 * Unit Tests: ForgotPasswordView
 *
 * Feature: registration-and-password-reset
 * Requirements: 10.1–10.8, 12.2, 13.1, 13.2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createForgotPasswordView } from './ForgotPasswordView';

// Mock AuthService
vi.mock('../services/AuthService', () => ({
  forgotPassword: vi.fn(),
}));

import { forgotPassword } from '../services/AuthService';

const mockedForgotPassword = vi.mocked(forgotPassword);

describe('ForgotPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders an input labeled "Parent Username or Email" (Req 10.1)', () => {
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');

      const label = view.querySelector('label[for="forgot-pw-identifier"]');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe('Parent Username or Email');
    });

    it('displays helper text explaining reset link goes to parent email (Req 10.2)', () => {
      const view = createForgotPasswordView();

      const helperText = view.querySelector('.form-group__helper-text');
      expect(helperText).not.toBeNull();
      expect(helperText!.textContent).toContain('reset link');
      expect(helperText!.textContent).toContain("parent");
      expect(helperText!.textContent).toContain('email');
    });

    it('has a submit button labeled "Send Reset Link" (Req 10.3)', () => {
      const view = createForgotPasswordView();

      const button = view.querySelector('.forgot-password-view__submit') as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Send Reset Link');
      expect(button.type).toBe('submit');
    });

    it('has a "Back to Login" link navigating to hash "#" (Req 12.2)', () => {
      const view = createForgotPasswordView();

      const backLink = view.querySelector('.forgot-password-view__back-link') as HTMLAnchorElement;
      expect(backLink).not.toBeNull();
      expect(backLink.textContent).toBe('Back to Login');
      expect(backLink.href).toContain('#');
    });

    it('input has associated label with matching for/id (Req 13.2)', () => {
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      const label = view.querySelector('label[for="forgot-pw-identifier"]') as HTMLLabelElement;

      expect(input).not.toBeNull();
      expect(label).not.toBeNull();
      expect(label.htmlFor).toBe(input.id);
    });
  });

  describe('Form Submission - Success', () => {
    it('calls forgotPassword API with non-empty value on submit (Req 10.4)', async () => {
      mockedForgotPassword.mockResolvedValue({ success: true });
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'parent@example.com';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(mockedForgotPassword).toHaveBeenCalledWith('parent@example.com');
      });
    });

    it('shows confirmation message on success (Req 10.5)', async () => {
      mockedForgotPassword.mockResolvedValue({ success: true });
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'testuser';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const successArea = view.querySelector('.forgot-password-view__success') as HTMLElement;
        expect(successArea.style.display).toBe('block');
        expect(successArea.textContent).toContain('reset link has been sent');
      });
    });

    it('hides form on success (Req 10.5)', async () => {
      mockedForgotPassword.mockResolvedValue({ success: true });
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'testuser';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(form.style.display).toBe('none');
      });
    });
  });

  describe('Loading State', () => {
    it('disables button and shows loading text during submission (Req 10.6)', async () => {
      let resolvePromise: (value: { success: boolean }) => void;
      mockedForgotPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'testuser';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      const button = view.querySelector('.forgot-password-view__submit') as HTMLButtonElement;

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe('Sending...');
      });

      // Resolve to clean up
      resolvePromise!({ success: true });
    });

    it('re-enables button after submission completes (Req 10.6)', async () => {
      mockedForgotPassword.mockResolvedValue({ success: false, error: 'Not found' });
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'testuser';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      const button = view.querySelector('.forgot-password-view__submit') as HTMLButtonElement;

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(button.disabled).toBe(false);
        expect(button.textContent).toBe('Send Reset Link');
      });
    });
  });

  describe('Error Priority Rule', () => {
    it('API error displays below form and hides inline validation errors (Req 10.7)', async () => {
      mockedForgotPassword.mockResolvedValue({ success: false, error: 'User not found' });
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'nonexistent';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const apiError = view.querySelector('.forgot-password-view__error') as HTMLElement;
        expect(apiError.style.display).toBe('block');
        expect(apiError.textContent).toContain('User not found');

        // Inline error should be hidden
        const inlineError = view.querySelector('#forgot-pw-identifier-error') as HTMLElement;
        expect(inlineError.style.display).toBe('none');
      });
    });

    it('empty submit shows inline validation error and hides API error (Req 10.8)', async () => {
      // First trigger an API error
      mockedForgotPassword.mockResolvedValue({ success: false, error: 'Some API error' });
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = 'testuser';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const apiError = view.querySelector('.forgot-password-view__error') as HTMLElement;
        expect(apiError.style.display).toBe('block');
      });

      // Now submit with empty value
      input.value = '';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        // Inline error should be visible
        const inlineError = view.querySelector('#forgot-pw-identifier-error') as HTMLElement;
        expect(inlineError.style.display).toBe('block');

        // API error should be hidden
        const apiError = view.querySelector('.forgot-password-view__error') as HTMLElement;
        expect(apiError.style.display).toBe('none');
      });
    });

    it('empty submit shows inline error without prior API error (Req 10.8)', () => {
      const view = createForgotPasswordView();

      const input = view.querySelector('#forgot-pw-identifier') as HTMLInputElement;
      input.value = '';

      const form = view.querySelector('.forgot-password-view__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const inlineError = view.querySelector('#forgot-pw-identifier-error') as HTMLElement;
      expect(inlineError.style.display).toBe('block');
    });
  });
});
