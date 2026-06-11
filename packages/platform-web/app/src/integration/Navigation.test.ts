// @vitest-environment happy-dom
/**
 * Integration Tests: Full Navigation Flow
 *
 * Feature: registration-and-password-reset
 * Requirements: 1.7, 1.8, 12.1–12.4
 *
 * Tests the hash-based router with real view factories to verify navigation
 * between views works end-to-end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRouter } from '../router/HashRouter';
import { createHomeView } from '../views/HomeView';
import { createRegistrationView } from '../views/RegistrationView';
import { createForgotPasswordView } from '../views/ForgotPasswordView';
import { createResetPasswordView } from '../views/ResetPasswordView';

// Mock AuthService to control login responses
vi.mock('../services/AuthService', () => ({
  loginWithRole: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  registerParent: vi.fn(),
  registerStudent: vi.fn(),
  API_BASE: 'http://localhost:3000',
}));

// Mock Header (irrelevant to navigation testing)
vi.mock('../components/Header', () => ({
  createHeader: (options: { onRegisterClick: () => void }) => {
    const el = document.createElement('header');
    el.className = 'home-header';
    const btn = document.createElement('button');
    btn.className = 'register-btn';
    btn.textContent = 'Register';
    btn.addEventListener('click', options.onRegisterClick);
    el.appendChild(btn);
    return el;
  },
}));

// Mock BackgroundWatermark (irrelevant to navigation testing)
vi.mock('../components/BackgroundWatermark', () => ({
  createBackgroundWatermark: () => {
    const el = document.createElement('div');
    el.className = 'background-watermark';
    return el;
  },
}));

// Mock HeaderLogo (used by Header)
vi.mock('../components/HeaderLogo', () => ({
  createHeaderLogo: () => {
    const el = document.createElement('div');
    el.className = 'header-logo';
    return el;
  },
}));

import { loginWithRole } from '../services/AuthService';

const mockedLoginWithRole = vi.mocked(loginWithRole);

describe('Navigation Integration', () => {
  let mountPoint: HTMLElement;
  let destroyRouter: (() => void) | null = null;

  function setupRouter(): void {
    destroyRouter = createRouter({
      mountPoint,
      routes: [
        { pattern: /^$/, handler: () => createHomeView() },
        { pattern: /^register$/, handler: () => createRegistrationView() },
        { pattern: /^forgot-password$/, handler: () => createForgotPasswordView() },
        { pattern: /^reset-password/, handler: (params) => createResetPasswordView(params.token || '') },
      ],
      fallback: () => createHomeView(),
    }).destroy;
  }

  function navigateTo(hash: string): void {
    window.location.hash = hash;
    window.dispatchEvent(new Event('hashchange'));
  }

  beforeEach(() => {
    mountPoint = document.createElement('div');
    mountPoint.id = 'app';
    document.body.appendChild(mountPoint);
    window.location.hash = '';
  });

  afterEach(() => {
    if (destroyRouter) {
      destroyRouter();
      destroyRouter = null;
    }
    window.location.hash = '';
    if (mountPoint && mountPoint.parentNode) {
      document.body.removeChild(mountPoint);
    }
    vi.clearAllMocks();
  });

  describe('hash changes render correct views (Req 12.4)', () => {
    it('renders HomeView for empty hash', () => {
      window.location.hash = '';
      setupRouter();

      expect(mountPoint.querySelector('.home-view')).not.toBeNull();
    });

    it('renders RegistrationView for #register', () => {
      window.location.hash = '#register';
      setupRouter();

      expect(mountPoint.querySelector('.registration-view')).not.toBeNull();
    });

    it('renders ForgotPasswordView for #forgot-password', () => {
      window.location.hash = '#forgot-password';
      setupRouter();

      expect(mountPoint.querySelector('.forgot-password-view')).not.toBeNull();
    });

    it('renders ResetPasswordView for #reset-password?token=abc', () => {
      window.location.hash = '#reset-password?token=abc';
      setupRouter();

      expect(mountPoint.querySelector('.reset-password-view')).not.toBeNull();
    });

    it('swaps views on hash change without page reload', () => {
      window.location.hash = '';
      setupRouter();

      expect(mountPoint.querySelector('.home-view')).not.toBeNull();

      navigateTo('#register');

      expect(mountPoint.querySelector('.registration-view')).not.toBeNull();
      expect(mountPoint.querySelector('.home-view')).toBeNull();
    });
  });

  describe('navigation from login failure actions (Req 1.7, 1.8)', () => {
    it('navigates to #register when Register link is clicked after login failure', async () => {
      window.location.hash = '';
      mockedLoginWithRole.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });

      // Flush any pending async events before setup
      await new Promise((resolve) => setTimeout(resolve, 0));

      setupRouter();

      // Select a role to show the LoginForm
      const parentRadio = mountPoint.querySelector('#role-parent') as HTMLInputElement;
      parentRadio.checked = true;
      parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

      // Submit the login form to trigger failure
      const loginForm = mountPoint.querySelector('.login-form') as HTMLFormElement;
      expect(loginForm).not.toBeNull();

      // Fill in credentials
      const usernameInput = mountPoint.querySelector('#login-username') as HTMLInputElement;
      const passwordInput = mountPoint.querySelector('#login-password') as HTMLInputElement;
      usernameInput.value = 'testuser';
      passwordInput.value = 'testpass';

      // Dispatch submit event on the form element
      loginForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Allow async operations (loginWithRole mock) to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Failure actions should now be visible
      const failureActions = mountPoint.querySelector('.login-form__failure-actions') as HTMLElement;
      expect(failureActions).not.toBeNull();
      expect(failureActions.style.display).toBe('block');

      // Click the Register link
      const registerLink = mountPoint.querySelector('a[href="#register"].login-form__action-link') as HTMLAnchorElement;
      expect(registerLink).not.toBeNull();
      registerLink.click();

      // Verify navigation occurred
      expect(window.location.hash).toBe('#register');
    });

    it('navigates to #forgot-password when Reset Password link is clicked after login failure', async () => {
      window.location.hash = '';
      mockedLoginWithRole.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });

      // Flush any pending async events before setup
      await new Promise((resolve) => setTimeout(resolve, 0));

      setupRouter();

      // Select a role
      const parentRadio = mountPoint.querySelector('#role-parent') as HTMLInputElement;
      parentRadio.checked = true;
      parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

      // Fill and submit login form
      const loginForm = mountPoint.querySelector('.login-form') as HTMLFormElement;
      const usernameInput = mountPoint.querySelector('#login-username') as HTMLInputElement;
      const passwordInput = mountPoint.querySelector('#login-password') as HTMLInputElement;
      usernameInput.value = 'testuser';
      passwordInput.value = 'testpass';

      loginForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Allow async operations to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Failure actions should now be visible
      const failureActions = mountPoint.querySelector('.login-form__failure-actions') as HTMLElement;
      expect(failureActions).not.toBeNull();
      expect(failureActions.style.display).toBe('block');

      // Click the Reset Password link
      const resetLink = mountPoint.querySelector('a[href="#forgot-password"].login-form__action-link') as HTMLAnchorElement;
      expect(resetLink).not.toBeNull();
      resetLink.click();

      // Verify navigation occurred
      expect(window.location.hash).toBe('#forgot-password');
    });
  });

  describe('"Back to Login" links work from all views (Req 12.1, 12.2, 12.3)', () => {
    it('RegistrationView "Back to Login" link navigates to hash # (Req 12.1)', () => {
      window.location.hash = '#register';
      setupRouter();

      const backLink = mountPoint.querySelector('.registration-view__back-link') as HTMLAnchorElement;
      expect(backLink).not.toBeNull();
      expect(backLink.href).toContain('#');
      expect(backLink.textContent).toBe('Back to Login');

      // Click the back link - it has href="#" so clicking navigates
      backLink.click();

      // The hash should be empty or '#'
      expect(window.location.hash === '' || window.location.hash === '#').toBe(true);
    });

    it('ForgotPasswordView "Back to Login" link navigates to hash # (Req 12.2)', () => {
      window.location.hash = '#forgot-password';
      setupRouter();

      const backLink = mountPoint.querySelector('.forgot-password-view__back-link') as HTMLAnchorElement;
      expect(backLink).not.toBeNull();
      expect(backLink.href).toContain('#');
      expect(backLink.textContent).toBe('Back to Login');

      backLink.click();

      expect(window.location.hash === '' || window.location.hash === '#').toBe(true);
    });

    it('ResetPasswordView "Back to Login" link navigates to hash # (Req 12.3)', () => {
      window.location.hash = '#reset-password?token=test123';
      setupRouter();

      const backLink = mountPoint.querySelector('.reset-password-view__back-link') as HTMLAnchorElement;
      expect(backLink).not.toBeNull();
      expect(backLink.href).toContain('#');
      expect(backLink.textContent).toBe('Back to Login');

      backLink.click();

      expect(window.location.hash === '' || window.location.hash === '#').toBe(true);
    });
  });

  describe('unknown hashes fall back to HomeView (Req 12.4)', () => {
    it('renders HomeView for unknown hash #unknown-page', () => {
      window.location.hash = '#unknown-page';
      setupRouter();

      expect(mountPoint.querySelector('.home-view')).not.toBeNull();
    });

    it('renders HomeView for random hash #abc123xyz', () => {
      window.location.hash = '#abc123xyz';
      setupRouter();

      expect(mountPoint.querySelector('.home-view')).not.toBeNull();
    });

    it('renders HomeView when navigating to unknown hash from a known view', () => {
      window.location.hash = '#register';
      setupRouter();

      expect(mountPoint.querySelector('.registration-view')).not.toBeNull();

      navigateTo('#nonexistent-route');

      expect(mountPoint.querySelector('.home-view')).not.toBeNull();
      expect(mountPoint.querySelector('.registration-view')).toBeNull();
    });
  });
});
