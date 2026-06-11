// @vitest-environment happy-dom
/**
 * Property Tests: HashRouter
 *
 * Feature: registration-and-password-reset
 *
 * **Validates: Requirements 12.4**
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createRouter, type Route } from './HashRouter';

// --- Known route patterns (must be excluded from generated hashes) ---

/** Matches the exact string "register" */
const registerPattern = /^register$/;

/** Matches the exact string "forgot-password" */
const forgotPasswordPattern = /^forgot-password$/;

/** Matches "reset-password" with a token query param */
const resetPasswordPattern = /^reset-password\?token=.+/;

// --- Arbitraries ---

/**
 * Generates arbitrary hash strings that do NOT match any known route pattern.
 * This ensures we only test with hashes the router cannot match.
 */
const unrecognizedHashArb = fc
  .string({ minLength: 0, maxLength: 100 })
  .filter((s) => {
    // Exclude hashes that would match any known route
    if (registerPattern.test(s)) return false;
    if (forgotPasswordPattern.test(s)) return false;
    if (resetPasswordPattern.test(s)) return false;
    return true;
  });

// --- Property Tests ---

describe('Feature: registration-and-password-reset, Property 5: Router renders fallback view for any unrecognized hash', () => {
  let destroyRouter: (() => void) | null = null;

  afterEach(() => {
    if (destroyRouter) {
      destroyRouter();
      destroyRouter = null;
    }
    // Reset hash
    window.location.hash = '';
  });

  /**
   * **Validates: Requirements 12.4**
   *
   * For any hash string that does not match the defined route patterns
   * (`#register`, `#forgot-password`, `#reset-password?token=...`),
   * the router SHALL render the Home_Page (fallback) view.
   */
  it('renders the fallback view for any unrecognized hash', () => {
    fc.assert(
      fc.property(unrecognizedHashArb, (hash) => {
        // Set up a fresh mount point
        const mountPoint = document.createElement('div');
        document.body.appendChild(mountPoint);

        // Create identifiable elements for routes and fallback
        const fallbackId = 'fallback-home-view';

        const routes: Route[] = [
          {
            pattern: registerPattern,
            handler: () => {
              const el = document.createElement('div');
              el.id = 'register-view';
              return el;
            },
          },
          {
            pattern: forgotPasswordPattern,
            handler: () => {
              const el = document.createElement('div');
              el.id = 'forgot-password-view';
              return el;
            },
          },
          {
            pattern: resetPasswordPattern,
            handler: (params) => {
              const el = document.createElement('div');
              el.id = 'reset-password-view';
              return el;
            },
          },
        ];

        const fallback = () => {
          const el = document.createElement('div');
          el.id = fallbackId;
          return el;
        };

        // Set the hash before creating the router (router renders on init)
        window.location.hash = `#${hash}`;

        const router = createRouter({ mountPoint, routes, fallback });
        destroyRouter = router.destroy;

        // Assert the fallback was rendered
        const rendered = mountPoint.querySelector(`#${fallbackId}`);
        expect(rendered).not.toBeNull();

        // Assert no route view was rendered
        expect(mountPoint.querySelector('#register-view')).toBeNull();
        expect(mountPoint.querySelector('#forgot-password-view')).toBeNull();
        expect(mountPoint.querySelector('#reset-password-view')).toBeNull();

        // Clean up
        router.destroy();
        destroyRouter = null;
        document.body.removeChild(mountPoint);
      }),
      { numRuns: 100 }
    );
  });
});
