/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createLoginView } from '../LoginView';

// Mock AuthService to prevent real API calls
vi.mock('../../services/AuthService', () => ({
  loginWithRole: vi.fn(),
}));

describe('LoginView', () => {
  /**
   * Validates: Requirements 2.1, 2.2, 1.9
   */

  describe('two-panel structure', () => {
    it('contains a content area with class "login-view__content"', () => {
      const view = createLoginView();
      const content = view.querySelector('.login-view__content');
      expect(content).not.toBeNull();
    });

    it('content area contains BrandingPanel (class "branding-panel") as a child', () => {
      const view = createLoginView();
      const content = view.querySelector('.login-view__content');
      const brandingPanel = content!.querySelector('.branding-panel');
      expect(brandingPanel).not.toBeNull();
    });

    it('content area contains LoginPanel (class "login-panel") as a child', () => {
      const view = createLoginView();
      const content = view.querySelector('.login-view__content');
      const loginPanel = content!.querySelector('.login-panel');
      expect(loginPanel).not.toBeNull();
    });

    it('BrandingPanel and LoginPanel are siblings within the content area', () => {
      const view = createLoginView();
      const content = view.querySelector('.login-view__content')!;
      const branding = content.querySelector('.branding-panel');
      const login = content.querySelector('.login-panel');

      // Both exist as direct children of content
      expect(branding).not.toBeNull();
      expect(login).not.toBeNull();
      expect(branding!.parentElement).toBe(content);
      expect(login!.parentElement).toBe(content);
    });
  });

  describe('auth header (minimal, no authenticated nav)', () => {
    it('renders a header element with class "login-view__header"', () => {
      const view = createLoginView();
      const header = view.querySelector('header.login-view__header');
      expect(header).not.toBeNull();
    });

    it('auth header is a direct child of the container', () => {
      const view = createLoginView();
      const header = view.querySelector('header.login-view__header');
      expect(header!.parentElement).toBe(view);
    });

    it('does NOT render authenticated navigation links (Dashboard, Subjects, etc.)', () => {
      const view = createLoginView();
      const navLinks = view.querySelectorAll('.top-nav-link, .top-navigation-link');
      expect(navLinks.length).toBe(0);
    });

    it('contains a Register link', () => {
      const view = createLoginView();
      const registerLink = view.querySelector('.login-view__register-link');
      expect(registerLink).not.toBeNull();
      expect(registerLink!.textContent).toBe('Register');
    });
  });

  describe('background class and style', () => {
    it('container has class "login-view"', () => {
      const view = createLoginView();
      expect(view.className).toBe('login-view');
    });

    it('container has backgroundColor via CSS class "login-view"', () => {
      const view = createLoginView();
      // Background color is now applied via the .login-view CSS class
      // (defined in login-view.css as var(--cm-color-background) = #F8F5FF)
      // In JSDOM, CSS classes are not computed, so we verify the class is applied
      expect(view.classList.contains('login-view')).toBe(true);
    });
  });
});
