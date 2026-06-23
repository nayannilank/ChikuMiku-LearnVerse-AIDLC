/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createLoginPanel } from '../LoginPanel';

describe('LoginPanel', () => {
  describe('DOM structure', () => {
    it('renders heading "Welcome Back!" with class login-panel__heading', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const heading = panel.querySelector('.login-panel__heading');
      expect(heading).not.toBeNull();
      expect(heading!.textContent).toBe('Welcome Back!');
    });

    it('renders subtitle "Log in to continue learning" with class login-panel__subtitle', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const subtitle = panel.querySelector('.login-panel__subtitle');
      expect(subtitle).not.toBeNull();
      expect(subtitle!.textContent).toBe('Log in to continue learning');
    });
  });

  describe('RoleTabs presence', () => {
    it('contains a role-tabs wrapper with class login-panel__role-tabs', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const roleTabsWrapper = panel.querySelector('.login-panel__role-tabs');
      expect(roleTabsWrapper).not.toBeNull();
    });

    it('role-tabs wrapper contains an element with role="tablist"', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const roleTabsWrapper = panel.querySelector('.login-panel__role-tabs');
      const tablist = roleTabsWrapper!.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();
    });
  });

  describe('input labels', () => {
    it('renders a "Username" label with class login-panel__label', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const labels = panel.querySelectorAll('.login-panel__label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Username');
    });

    it('renders a "Password" label with class login-panel__label', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const labels = panel.querySelectorAll('.login-panel__label');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Password');
    });
  });

  describe('submit button', () => {
    it('renders a button with text "Login" and class login-panel__submit', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const button = panel.querySelector('.login-panel__submit');
      expect(button).not.toBeNull();
      expect(button!.textContent).toBe('Login');
    });
  });

  describe('forgot password link', () => {
    it('renders link with text "Forgot Password?" and class login-panel__forgot-password', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const link = panel.querySelector('.login-panel__forgot-password');
      expect(link).not.toBeNull();
      expect(link!.textContent).toBe('Forgot Password?');
    });

    it('has color style #E94F9B', () => {
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword: vi.fn() });
      const link = panel.querySelector('.login-panel__forgot-password') as HTMLElement;
      // JSDOM normalizes hex to rgb
      expect(link.style.color).toBe('rgb(233, 79, 155)');
    });

    it('calls onForgotPassword callback when clicked', () => {
      const onForgotPassword = vi.fn();
      const panel = createLoginPanel({ onSubmit: vi.fn(), onForgotPassword });
      const link = panel.querySelector('.login-panel__forgot-password')!;
      link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onForgotPassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('loading state', () => {
    it('shows "Signing in..." and disables button after valid form submit', async () => {
      const onSubmit = vi.fn(() => new Promise<void>(() => {})); // never resolves
      const panel = createLoginPanel({ onSubmit, onForgotPassword: vi.fn() });

      // Set valid input values
      const usernameInput = panel.querySelector('#login-panel-username') as HTMLInputElement;
      const passwordInput = panel.querySelector('#login-panel-password') as HTMLInputElement;
      usernameInput.value = 'testuser1';
      passwordInput.value = 'Test1234!';

      // Submit the form
      const form = panel.querySelector('.login-panel__form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Flush microtasks
      await new Promise((resolve) => setTimeout(resolve, 0));

      const button = panel.querySelector('.login-panel__submit') as HTMLButtonElement;
      expect(button.textContent).toBe('Signing in...');
      expect(button.disabled).toBe(true);
    });
  });
});
