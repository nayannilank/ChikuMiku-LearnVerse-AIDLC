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

  describe('TopNavBar presence', () => {
    it('renders a nav element with class "top-nav-bar"', () => {
      const view = createLoginView();
      const nav = view.querySelector('nav.top-nav-bar');
      expect(nav).not.toBeNull();
    });

    it('TopNavBar is a direct child of the container', () => {
      const view = createLoginView();
      const nav = view.querySelector('nav.top-nav-bar');
      expect(nav!.parentElement).toBe(view);
    });
  });

  describe('background class and style', () => {
    it('container has class "login-view"', () => {
      const view = createLoginView();
      expect(view.className).toBe('login-view');
    });

    it('container has backgroundColor of #F8F5FF', () => {
      const view = createLoginView();
      // JSDOM normalizes hex to rgb
      expect(view.style.backgroundColor).toBe('rgb(248, 245, 255)');
    });
  });
});
