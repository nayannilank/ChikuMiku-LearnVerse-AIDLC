// @vitest-environment happy-dom
/**
 * Unit Tests: HashRouter
 *
 * Feature: registration-and-password-reset
 * Requirements: 12.4
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRouter, type Route } from './HashRouter';

describe('HashRouter', () => {
  let destroyFn: (() => void) | null = null;
  let mountPoint: HTMLElement;

  function setup() {
    mountPoint = document.createElement('div');
    document.body.appendChild(mountPoint);
  }

  function teardown() {
    if (destroyFn) {
      destroyFn();
      destroyFn = null;
    }
    window.location.hash = '';
    if (mountPoint && mountPoint.parentNode) {
      document.body.removeChild(mountPoint);
    }
  }

  afterEach(teardown);

  // Helper to create identifiable view elements
  function createView(id: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    return el;
  }

  // Standard routes used across tests
  function getRoutes(): Route[] {
    return [
      {
        pattern: /^register$/,
        handler: () => createView('register-view'),
      },
      {
        pattern: /^forgot-password$/,
        handler: () => createView('forgot-password-view'),
      },
      {
        pattern: /^reset-password\?token=.+/,
        handler: (params) => {
          const el = createView('reset-password-view');
          el.dataset.token = params.token || '';
          return el;
        },
      },
    ];
  }

  function fallback(): HTMLElement {
    return createView('home-view');
  }

  describe('known routes render correct views', () => {
    it('renders register view for #register', () => {
      setup();
      window.location.hash = '#register';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#register-view')).not.toBeNull();
      expect(mountPoint.children.length).toBe(1);
    });

    it('renders forgot-password view for #forgot-password', () => {
      setup();
      window.location.hash = '#forgot-password';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#forgot-password-view')).not.toBeNull();
      expect(mountPoint.children.length).toBe(1);
    });

    it('renders reset-password view for #reset-password?token=abc123', () => {
      setup();
      window.location.hash = '#reset-password?token=abc123';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#reset-password-view')).not.toBeNull();
      expect(mountPoint.children.length).toBe(1);
    });

    it('renders fallback view for unknown hash', () => {
      setup();
      window.location.hash = '#unknown-page';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#home-view')).not.toBeNull();
      expect(mountPoint.children.length).toBe(1);
    });

    it('renders fallback view for empty hash', () => {
      setup();
      window.location.hash = '';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#home-view')).not.toBeNull();
    });
  });

  describe('hash changes swap views without page reload', () => {
    it('re-renders when hashchange event fires', () => {
      setup();
      window.location.hash = '#register';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#register-view')).not.toBeNull();

      // Change hash and dispatch hashchange event
      window.location.hash = '#forgot-password';
      window.dispatchEvent(new Event('hashchange'));

      expect(mountPoint.querySelector('#forgot-password-view')).not.toBeNull();
      expect(mountPoint.querySelector('#register-view')).toBeNull();
    });

    it('swaps from route view to fallback on unrecognized hash change', () => {
      setup();
      window.location.hash = '#register';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      expect(mountPoint.querySelector('#register-view')).not.toBeNull();

      // Navigate to unknown hash
      window.location.hash = '#nonexistent';
      window.dispatchEvent(new Event('hashchange'));

      expect(mountPoint.querySelector('#home-view')).not.toBeNull();
      expect(mountPoint.querySelector('#register-view')).toBeNull();
    });

    it('clears previous content on each navigation', () => {
      setup();
      window.location.hash = '#register';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      // Navigate through multiple routes
      window.location.hash = '#forgot-password';
      window.dispatchEvent(new Event('hashchange'));

      window.location.hash = '#register';
      window.dispatchEvent(new Event('hashchange'));

      // Only the latest view should be present
      expect(mountPoint.children.length).toBe(1);
      expect(mountPoint.querySelector('#register-view')).not.toBeNull();
    });
  });

  describe('token parameter extraction from reset-password hash', () => {
    it('extracts token query parameter', () => {
      setup();
      window.location.hash = '#reset-password?token=abc123';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      const view = mountPoint.querySelector('#reset-password-view') as HTMLElement;
      expect(view).not.toBeNull();
      expect(view.dataset.token).toBe('abc123');
    });

    it('extracts complex token values', () => {
      setup();
      window.location.hash = '#reset-password?token=eyJhbGciOiJIUzI1NiJ9.test';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      const view = mountPoint.querySelector('#reset-password-view') as HTMLElement;
      expect(view).not.toBeNull();
      expect(view.dataset.token).toBe('eyJhbGciOiJIUzI1NiJ9.test');
    });

    it('does not match reset-password without token', () => {
      setup();
      window.location.hash = '#reset-password';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });
      destroyFn = router.destroy;

      // Should fall back since pattern requires token
      expect(mountPoint.querySelector('#reset-password-view')).toBeNull();
      expect(mountPoint.querySelector('#home-view')).not.toBeNull();
    });
  });

  describe('destroy() removes event listener', () => {
    it('stops re-rendering after destroy is called', () => {
      setup();
      window.location.hash = '#register';

      const router = createRouter({ mountPoint, routes: getRoutes(), fallback });

      expect(mountPoint.querySelector('#register-view')).not.toBeNull();

      // Destroy the router
      router.destroy();
      destroyFn = null;

      // Change hash and dispatch event
      window.location.hash = '#forgot-password';
      window.dispatchEvent(new Event('hashchange'));

      // Should still show the register view since listener was removed
      expect(mountPoint.querySelector('#register-view')).not.toBeNull();
      expect(mountPoint.querySelector('#forgot-password-view')).toBeNull();
    });
  });
});
