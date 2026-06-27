/**
 * @vitest-environment jsdom
 */
/**
 * Property Tests: React Bridge Lifecycle
 *
 * Feature: end-to-end-ui-integration, Property 1: React Bridge Props Round-Trip
 * Feature: end-to-end-ui-integration, Property 2: Fresh Root Per Navigation
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createElement } from 'react';
import { renderReactRoute, cleanupCurrentMount, getCurrentMount } from './reactBridge';

// ============================================================
// Test Components
// ============================================================

/**
 * A component that renders all props as data attributes and JSON text content.
 * This allows us to verify props were received correctly without needing to
 * inspect React internals.
 */
function PropsCapture(props: Record<string, unknown>) {
  // Render each prop as a data attribute (stringified) and the full props as JSON
  const dataAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    dataAttrs[`data-prop-${key}`] = JSON.stringify(value);
  }
  return createElement('div', {
    'data-testid': 'props-capture',
    ...dataAttrs,
  }, JSON.stringify(props));
}

// ============================================================
// Arbitraries
// ============================================================

/**
 * Generates a safe prop key: valid JS identifier-like strings that work as
 * HTML data attribute suffixes (lowercase alphanumeric).
 * Excludes React reserved props (key, ref, children) which are not passed through.
 */
const RESERVED_REACT_PROPS = new Set(['key', 'ref', 'children']);
const propKeyArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => /^[a-z][a-z0-9]*$/.test(s) && !RESERVED_REACT_PROPS.has(s));

/**
 * Generates prop values: strings, numbers, booleans, null, arrays, objects.
 * These are JSON-serializable values suitable for round-trip testing.
 */
const propValueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string({ maxLength: 50 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.double({ min: -100, max: 100, noNaN: true }),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.oneof(fc.string({ maxLength: 20 }), fc.integer()), { maxLength: 5 }),
);

/**
 * Generates a props object with 1-5 key-value pairs.
 * Keys are unique lowercase strings, values are JSON-serializable.
 */
const propsArb = fc
  .uniqueArray(propKeyArb, { minLength: 1, maxLength: 5 })
  .chain((keys) =>
    fc.tuple(
      fc.constant(keys),
      fc.array(propValueArb, { minLength: keys.length, maxLength: keys.length })
    )
  )
  .map(([keys, values]) => {
    const props: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) {
      props[keys[i]] = values[i];
    }
    return props;
  });

/**
 * Generates a navigation count between 1 and 10 (inclusive).
 */
const navigationCountArb = fc.integer({ min: 1, max: 10 });

// ============================================================
// Property 1: React Bridge Props Round-Trip
// ============================================================

describe('Feature: end-to-end-ui-integration, Property 1: React Bridge Props Round-Trip', () => {
  beforeEach(() => {
    cleanupCurrentMount();
  });

  afterEach(() => {
    cleanupCurrentMount();
  });

  it('for ANY arbitrary props, mounting via renderReactRoute produces a container where the component receives exactly those props', async () => {
    await fc.assert(
      fc.asyncProperty(propsArb, async (props) => {
        // Mount the PropsCapture component with the generated props
        const container = renderReactRoute(createElement(PropsCapture, props));

        // Wait for React to render (createRoot is asynchronous)
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify the container is a valid HTMLElement
        expect(container).toBeInstanceOf(HTMLDivElement);
        expect(container.className).toBe('react-route-container');

        // Find the rendered component
        const captureEl = container.querySelector('[data-testid="props-capture"]');
        expect(captureEl).not.toBeNull();

        // Verify each prop was received by checking data attributes
        for (const [key, value] of Object.entries(props)) {
          const attrValue = captureEl!.getAttribute(`data-prop-${key}`);
          expect(attrValue).toBe(JSON.stringify(value));
        }

        // Additionally verify the full props JSON in text content
        const renderedProps = JSON.parse(captureEl!.textContent || '{}');
        expect(renderedProps).toEqual(props);

        // Cleanup for next iteration
        cleanupCurrentMount();
      }),
      { numRuns: 100 }
    );
  });

  it('renderReactRoute returns an HTMLElement containing the mounted component (Requirement 1.1)', async () => {
    await fc.assert(
      fc.asyncProperty(propsArb, async (props) => {
        const container = renderReactRoute(createElement(PropsCapture, props));

        // Must return an HTMLElement
        expect(container).toBeInstanceOf(HTMLElement);

        // Must contain the mounted React tree after rendering
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(container.querySelector('[data-testid="props-capture"]')).not.toBeNull();

        cleanupCurrentMount();
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// Property 2: Fresh Root Per Navigation
// ============================================================

describe('Feature: end-to-end-ui-integration, Property 2: Fresh Root Per Navigation', () => {
  beforeEach(() => {
    cleanupCurrentMount();
  });

  afterEach(() => {
    cleanupCurrentMount();
  });

  it('for ANY sequence of N navigations (N >= 1), exactly N roots are created and only one remains active', async () => {
    await fc.assert(
      fc.asyncProperty(navigationCountArb, async (n) => {
        const containers: HTMLElement[] = [];
        let rootCreationCount = 0;

        for (let i = 0; i < n; i++) {
          const props = { step: i, label: `nav-${i}` };
          const container = renderReactRoute(createElement(PropsCapture, props));
          containers.push(container);
          rootCreationCount++;

          // Wait for React to render
          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        // Exactly N roots were created (one per navigation)
        expect(rootCreationCount).toBe(n);

        // Only one root remains active (the last one)
        const currentMount = getCurrentMount();
        expect(currentMount).not.toBeNull();
        expect(currentMount!.container).toBe(containers[containers.length - 1]);

        // Previous containers should be unmounted (empty content after unmount)
        for (let i = 0; i < n - 1; i++) {
          expect(containers[i].textContent).toBe('');
        }

        // The active container should have content
        const activeContainer = containers[n - 1];
        expect(activeContainer.querySelector('[data-testid="props-capture"]')).not.toBeNull();

        cleanupCurrentMount();
      }),
      { numRuns: 100 }
    );
  });

  it('each navigation creates a fresh root — repeated navigations to the same route produce a new root every time (Requirement 1.4)', async () => {
    await fc.assert(
      fc.asyncProperty(navigationCountArb, async (n) => {
        const mounts: Array<{ container: HTMLElement }> = [];

        for (let i = 0; i < n; i++) {
          // Use identical props each time to simulate "same route"
          const container = renderReactRoute(createElement(PropsCapture, { id: 'same' }));
          const mount = getCurrentMount();
          expect(mount).not.toBeNull();
          mounts.push({ container });

          await new Promise((resolve) => setTimeout(resolve, 5));
        }

        // Each navigation should have produced a distinct container
        const uniqueContainers = new Set(mounts.map((m) => m.container));
        expect(uniqueContainers.size).toBe(n);

        // Only the last mount is still active
        const finalMount = getCurrentMount();
        expect(finalMount).not.toBeNull();
        expect(finalMount!.container).toBe(mounts[mounts.length - 1].container);

        cleanupCurrentMount();
      }),
      { numRuns: 100 }
    );
  });

  it('the previous React root is unmounted before creating the next (Requirement 1.2 - no memory leaks)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }),
        async (n) => {
          // Track that at any point during the sequence, at most one root is active
          for (let i = 0; i < n; i++) {
            // Before this navigation, getCurrentMount may have a previous mount
            const prevMount = getCurrentMount();

            const container = renderReactRoute(createElement(PropsCapture, { step: i }));
            await new Promise((resolve) => setTimeout(resolve, 5));

            // After navigation, only one mount should be active
            const currentMount = getCurrentMount();
            expect(currentMount).not.toBeNull();
            expect(currentMount!.container).toBe(container);

            // If there was a previous mount, it should have been cleaned up
            if (prevMount) {
              // The previous container should be unmounted (empty)
              expect(prevMount.container.textContent).toBe('');
            }
          }

          cleanupCurrentMount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
