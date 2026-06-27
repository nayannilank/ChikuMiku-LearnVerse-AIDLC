/**
 * @vitest-environment jsdom
 */
/**
 * Property Tests for Async Route Container — Error States
 *
 * Feature: end-to-end-ui-integration, Property 8: Loading State on Data Fetch
 * Feature: end-to-end-ui-integration, Property 9: Error State with Retry
 * Feature: end-to-end-ui-integration, Property 10: Auth Redirect on 401
 *
 * **Validates: Requirements 14.1, 14.2, 14.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { createElement } from 'react';
import { createAsyncRouteContainer } from './asyncRoute';
import { cleanupCurrentMount } from './reactBridge';

// Mock wrapInResponsiveLayout to pass through the content element
// (avoids coupling to the full responsive layout component in property tests)
vi.mock('./wrapInResponsiveLayout', () => ({
  wrapInResponsiveLayout: (content: HTMLElement) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'responsive-layout-mock';
    wrapper.appendChild(content);
    return wrapper;
  },
}));

// Mock clearTokens to track invocations
const clearTokensMock = vi.fn();
vi.mock('../services/api', () => ({
  clearTokens: () => clearTokensMock(),
}));

// Simple React component for successful renders
function TestScreen({ label }: { label: string }) {
  return createElement('div', { 'data-testid': 'test-screen' }, label);
}

/**
 * Flushes the microtask queue to allow promise .then/.catch handlers to execute.
 * Uses setTimeout(0) which defers to the next macrotask, ensuring all
 * microtasks (promise continuations) are processed first.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ============================================================
// Arbitraries
// ============================================================

/**
 * Generates valid route strings (hash routes like #scan, #explain/abc123).
 */
const routeArb = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '/', '_'
  ),
  { minLength: 1, maxLength: 40 }
).map((s) => `#${s}`);

/**
 * Generates error messages for API failures.
 */
const errorMessageArb = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', ' ', '.', '!', ':'
  ),
  { minLength: 1, maxLength: 80 }
);

/** Arbitrary for 5xx status codes */
const serverErrorStatusArb = fc.constantFrom(500, 501, 502, 503, 504);

/** Arbitrary for network error status (0 = no response) */
const networkErrorStatusArb = fc.constant(0);

/** Combined non-401 error status arbitrary */
const nonAuthErrorStatusArb = fc.oneof(serverErrorStatusArb, networkErrorStatusArb);

// ============================================================
// Property 8: Loading State on Data Fetch
// ============================================================

describe('Feature: end-to-end-ui-integration, Property 8: Loading State on Data Fetch', () => {
  beforeEach(() => {
    cleanupCurrentMount();
    clearTokensMock.mockClear();
  });

  afterEach(() => {
    cleanupCurrentMount();
  });

  it('initial render contains a loading indicator with role="status" for any async route', () => {
    fc.assert(
      fc.property(
        routeArb,
        (route) => {
          // Create a factory that never resolves (simulates pending fetch)
          const factory = () => new Promise<never>(() => {});

          const container = createAsyncRouteContainer(route, factory);

          // The container should immediately contain a loading indicator
          const loadingEl = container.querySelector('[role="status"]');
          expect(loadingEl).not.toBeNull();

          // The loading element should be visible within the responsive layout
          expect(container.querySelector('.responsive-layout-mock')).not.toBeNull();
          expect(container.querySelector('.loading-view')).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('loading indicator appears synchronously before factory resolves for any route', () => {
    fc.assert(
      fc.property(
        routeArb,
        fc.nat({ max: 5000 }),
        (route, delay) => {
          // Factory that resolves after some delay — but loading should be immediate
          const factory = () =>
            new Promise<never>((resolve) => {
              setTimeout(
                () => resolve(createElement(TestScreen, { label: 'done' }) as never),
                delay
              );
            });

          const container = createAsyncRouteContainer(route, factory);

          // Synchronously, the loading indicator must be present
          const loadingEl = container.querySelector('[role="status"]');
          expect(loadingEl).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 9: Error State with Retry
// ============================================================

describe('Feature: end-to-end-ui-integration, Property 9: Error State with Retry', () => {
  beforeEach(() => {
    cleanupCurrentMount();
    clearTokensMock.mockClear();
  });

  afterEach(() => {
    cleanupCurrentMount();
  });

  it('on failure with network/5xx error, shows role="alert" element and Retry button', async () => {
    await fc.assert(
      fc.asyncProperty(
        routeArb,
        nonAuthErrorStatusArb,
        errorMessageArb,
        async (route, status, message) => {
          const error = { status, message };
          const factory = vi.fn().mockRejectedValue(error);

          const container = createAsyncRouteContainer(route, factory);

          // Flush microtasks so the .catch() handler runs
          await flushPromises();

          // Error alert should now be present
          const alertEl = container.querySelector('[role="alert"]');
          expect(alertEl).not.toBeNull();

          // Error view should be present
          const errorView = container.querySelector('.error-view');
          expect(errorView).not.toBeNull();

          // Retry button should exist with correct text
          const retryBtn = container.querySelector('button');
          expect(retryBtn).not.toBeNull();
          expect(retryBtn!.textContent).toBe('Retry');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clicking Retry re-invokes the original fetch factory', async () => {
    await fc.assert(
      fc.asyncProperty(
        routeArb,
        nonAuthErrorStatusArb,
        errorMessageArb,
        async (route, status, message) => {
          const error = { status, message };
          let callCount = 0;
          const factory = vi.fn().mockImplementation(() => {
            callCount++;
            return Promise.reject(error);
          });

          const container = createAsyncRouteContainer(route, factory);

          // Flush microtasks for initial error
          await flushPromises();

          expect(callCount).toBe(1);
          expect(container.querySelector('[role="alert"]')).not.toBeNull();

          // Click retry button
          const retryBtn = container.querySelector('button');
          expect(retryBtn).not.toBeNull();
          retryBtn!.click();

          // Flush microtasks for the retry's promise rejection
          await flushPromises();

          // Factory should have been called again
          expect(callCount).toBeGreaterThanOrEqual(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 10: Auth Redirect on 401
// ============================================================

describe('Feature: end-to-end-ui-integration, Property 10: Auth Redirect on 401', () => {
  let originalHash: string;

  beforeEach(() => {
    cleanupCurrentMount();
    clearTokensMock.mockClear();
    originalHash = window.location.hash;
  });

  afterEach(() => {
    cleanupCurrentMount();
    window.location.hash = originalHash;
  });

  it('on 401 error, clears tokens and redirects to #login', async () => {
    await fc.assert(
      fc.asyncProperty(
        routeArb,
        errorMessageArb,
        async (route, message) => {
          clearTokensMock.mockClear();
          window.location.hash = route;

          const error = { status: 401, message };
          const factory = vi.fn().mockRejectedValue(error);

          createAsyncRouteContainer(route, factory);

          // Flush microtasks so the .catch() handler runs
          await flushPromises();

          // Tokens should be cleared exactly once
          expect(clearTokensMock).toHaveBeenCalledTimes(1);

          // Should redirect to #login
          expect(window.location.hash).toBe('#login');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('401 does not show error view — it redirects instead', async () => {
    await fc.assert(
      fc.asyncProperty(
        routeArb,
        async (route) => {
          clearTokensMock.mockClear();

          const error = { status: 401, message: 'Unauthorized' };
          const factory = vi.fn().mockRejectedValue(error);

          const container = createAsyncRouteContainer(route, factory);

          // Flush microtasks so the .catch() handler runs
          await flushPromises();

          // No error alert should be shown — 401 redirects, doesn't display error
          const alertEl = container.querySelector('[role="alert"]');
          expect(alertEl).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
