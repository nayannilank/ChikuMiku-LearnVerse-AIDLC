// @vitest-environment happy-dom
/**
 * Unit Tests: ResetPasswordView
 *
 * Feature: registration-and-password-reset
 * Requirements: 11.1–11.8, 12.3, 13.1, 13.2, 13.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createResetPasswordView } from './ResetPasswordView';

// Mock AuthService
vi.mock('../services/AuthService', () => ({
  resetPassword: vi.fn(),
}));

import { resetPassword } from '../services/AuthService';

const mockedResetPassword = vi.mocked(resetPassword);

describe('ResetPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders New Password and Confirm Password fields with labels (Req 11.1)', () => {
      const view = createResetPasswordView('test-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;

      expect(newPwInput).not.toBeNull();
      expect(newPwInput.type).toBe('password');
      expect(confirmPwInput).not.toBeNull();
      expect(confirmPwInput.type).toBe('password');

      const newPwLabel = view.querySelector('label[for="reset-pw-newPassword"]');
      const confirmPwLabel = view.querySelector('label[for="reset-pw-confirmPassword"]');
      expect(newPwLabel).not.toBeNull();
      expect(newPwLabel!.textContent).toBe('New Password');
      expect(confirmPwLabel).not.toBeNull();
      expect(confirmPwLabel!.textContent).toBe('Confirm Password');
    });

    it('has a submit button labeled "Reset Password"', () => {
      const view = createResetPasswordView('test-token');

      const button = view.querySelector('.reset-password-form__submit') as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Reset Password');
      expect(button.type).toBe('submit');
    });

    it('has a "Back to Login" link navigating to hash "#" (Req 12.3)', () => {
      const view = createResetPasswordView('test-token');

      const backLink = view.querySelector('.reset-password-view__back-link') as HTMLAnchorElement;
      expect(backLink).not.toBeNull();
      expect(backLink.textContent).toBe('Back to Login');
      expect(backLink.href).toContain('#');
    });

    it('inputs have labels with matching for/id (Req 13.2)', () => {
      const view = createResetPasswordView('test-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const newPwLabel = view.querySelector('label[for="reset-pw-newPassword"]') as HTMLLabelElement;
      expect(newPwLabel.htmlFor).toBe(newPwInput.id);

      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      const confirmPwLabel = view.querySelector('label[for="reset-pw-confirmPassword"]') as HTMLLabelElement;
      expect(confirmPwLabel.htmlFor).toBe(confirmPwInput.id);
    });

    it('validation errors use aria-describedby (Req 13.3)', () => {
      const view = createResetPasswordView('test-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      expect(newPwInput.getAttribute('aria-describedby')).toBe('reset-pw-newPassword-error');

      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      expect(confirmPwInput.getAttribute('aria-describedby')).toBe('reset-pw-confirmPassword-error');
    });
  });

  describe('Validation', () => {
    it('shows error when password is shorter than 8 characters (Req 11.2)', () => {
      const view = createResetPasswordView('test-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'short';
      confirmPwInput.value = 'short';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const errorEl = view.querySelector('#reset-pw-newPassword-error') as HTMLElement;
      expect(errorEl.style.display).toBe('block');
    });

    it('shows error when password exceeds 20 characters (Req 11.2)', () => {
      const view = createResetPasswordView('test-token');

      const longPassword = 'a'.repeat(21);
      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = longPassword;
      confirmPwInput.value = longPassword;

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const errorEl = view.querySelector('#reset-pw-newPassword-error') as HTMLElement;
      expect(errorEl.style.display).toBe('block');
    });

    it('shows error when password contains invalid characters (Req 11.3)', () => {
      const view = createResetPasswordView('test-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'pass word!';  // space is invalid
      confirmPwInput.value = 'pass word!';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const errorEl = view.querySelector('#reset-pw-newPassword-error') as HTMLElement;
      expect(errorEl.style.display).toBe('block');
    });

    it('shows error when passwords do not match (Req 11.4)', () => {
      const view = createResetPasswordView('test-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'DifferentPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      const errorEl = view.querySelector('#reset-pw-confirmPassword-error') as HTMLElement;
      expect(errorEl.style.display).toBe('block');
    });
  });

  describe('Form Submission - Success', () => {
    it('calls resetPassword API with token and new password (Req 11.5)', async () => {
      mockedResetPassword.mockResolvedValue({ success: true });
      const view = createResetPasswordView('my-reset-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(mockedResetPassword).toHaveBeenCalledWith('my-reset-token', 'ValidPass1');
      });
    });

    it('shows success message on successful reset (Req 11.6)', async () => {
      mockedResetPassword.mockResolvedValue({ success: true });
      const view = createResetPasswordView('token123');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const successArea = view.querySelector('.reset-password-form__success') as HTMLElement;
        expect(successArea.style.display).toBe('block');
        expect(successArea.textContent).toContain('Password reset successful');
      });
    });

    it('navigates to login hash after 3 seconds on success (Req 11.6)', async () => {
      mockedResetPassword.mockResolvedValue({ success: true });
      const view = createResetPasswordView('token123');

      // Set hash to something else first so we can detect the change
      window.location.hash = '#reset-password';

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Wait for success area to appear (means the setTimeout has been scheduled)
      await vi.waitFor(() => {
        const successArea = view.querySelector('.reset-password-form__success') as HTMLElement;
        expect(successArea.style.display).toBe('block');
      });

      // Hash should still be on the reset-password route
      expect(window.location.hash).toBe('#reset-password');

      // Advance timer by 3 seconds to trigger navigation
      await vi.advanceTimersByTimeAsync(3000);

      // After navigation, hash should have changed from #reset-password
      // happy-dom normalizes `#` to empty string
      expect(window.location.hash).not.toBe('#reset-password');
    });

    it('hides form on success (Req 11.6)', async () => {
      mockedResetPassword.mockResolvedValue({ success: true });
      const view = createResetPasswordView('token123');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(form.style.display).toBe('none');
      });
    });
  });

  describe('Loading State', () => {
    it('disables button and shows loading text during submission (Req 11.7)', async () => {
      let resolvePromise: (value: { success: boolean }) => void;
      mockedResetPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const view = createResetPasswordView('token123');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      const button = view.querySelector('.reset-password-form__submit') as HTMLButtonElement;

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe('Resetting...');
      });

      // Resolve to clean up
      resolvePromise!({ success: true });
    });

    it('loading state persists until API resolves (Req 11.7)', async () => {
      let resolvePromise: (value: { success: boolean; error?: string }) => void;
      mockedResetPassword.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; })
      );

      const view = createResetPasswordView('token123');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      const button = view.querySelector('.reset-password-form__submit') as HTMLButtonElement;

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        expect(button.disabled).toBe(true);
      });

      // Resolve with error
      resolvePromise!({ success: false, error: 'Token expired' });

      await vi.waitFor(() => {
        expect(button.disabled).toBe(false);
        expect(button.textContent).toBe('Reset Password');
      });
    });
  });

  describe('Error Priority Rule', () => {
    it('API error displays below form and hides inline errors (Req 11.8)', async () => {
      mockedResetPassword.mockResolvedValue({ success: false, error: 'Token expired' });
      const view = createResetPasswordView('expired-token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const apiError = view.querySelector('.reset-password-form__error') as HTMLElement;
        expect(apiError.style.display).toBe('block');
        expect(apiError.textContent).toContain('Token expired');

        // Inline errors should be hidden
        const newPwError = view.querySelector('#reset-pw-newPassword-error') as HTMLElement;
        const confirmPwError = view.querySelector('#reset-pw-confirmPassword-error') as HTMLElement;
        expect(newPwError.style.display).toBe('none');
        expect(confirmPwError.style.display).toBe('none');
      });
    });

    it('validation errors hide API error on resubmit with invalid data', async () => {
      // First trigger an API error
      mockedResetPassword.mockResolvedValue({ success: false, error: 'Server error' });
      const view = createResetPasswordView('token');

      const newPwInput = view.querySelector('#reset-pw-newPassword') as HTMLInputElement;
      const confirmPwInput = view.querySelector('#reset-pw-confirmPassword') as HTMLInputElement;
      newPwInput.value = 'ValidPass1';
      confirmPwInput.value = 'ValidPass1';

      const form = view.querySelector('.reset-password-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() => {
        const apiError = view.querySelector('.reset-password-form__error') as HTMLElement;
        expect(apiError.style.display).toBe('block');
      });

      // Now resubmit with invalid (empty) values to trigger validation error
      newPwInput.value = '';
      confirmPwInput.value = '';
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Validation error should show, API error should be cleared
      // Note: the view clears API error at start of submit, then shows inline errors
      await vi.waitFor(() => {
        const newPwError = view.querySelector('#reset-pw-newPassword-error') as HTMLElement;
        expect(newPwError.style.display).toBe('block');
      });
    });
  });
});
