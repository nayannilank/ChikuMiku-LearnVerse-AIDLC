// @vitest-environment happy-dom
/**
 * Property Tests: Route Parameter Extraction
 *
 * Feature: end-to-end-ui-integration, Property 3: Route Parameter Extraction
 *
 * **Validates: Requirements 2.5, 2.6, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 12.3**
 *
 * For any parameterized route pattern and valid ID string, the handler extracts
 * the correct ID value from the URL hash.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createRouter, type Route } from '../router/HashRouter';

// --- Route patterns from main.ts that use named capture groups ---

interface RouteParamConfig {
  /** Route prefix (e.g., 'upload') */
  prefix: string;
  /** Named capture group name (e.g., 'chapterId') */
  paramName: string;
  /** The regex pattern used in main.ts */
  pattern: RegExp;
}

const PARAMETERIZED_ROUTES: RouteParamConfig[] = [
  { prefix: 'upload', paramName: 'chapterId', pattern: /^upload\/(?<chapterId>[^/]+)$/ },
  { prefix: 'transcript', paramName: 'chapterId', pattern: /^transcript\/(?<chapterId>[^/]+)$/ },
  { prefix: 'explain', paramName: 'chapterId', pattern: /^explain\/(?<chapterId>[^/]+)$/ },
  { prefix: 'exercises', paramName: 'chapterId', pattern: /^exercises\/(?<chapterId>[^/]+)$/ },
  { prefix: 'pronunciation', paramName: 'subjectId', pattern: /^pronunciation\/(?<subjectId>[^/]+)$/ },
  { prefix: 'grammar', paramName: 'subjectId', pattern: /^grammar\/(?<subjectId>[^/]+)$/ },
  { prefix: 'quiz', paramName: 'subjectId', pattern: /^quiz\/(?<subjectId>[^/]+)$/ },
  { prefix: 'maths', paramName: 'subjectId', pattern: /^maths\/(?<subjectId>[^/]+)$/ },
  { prefix: 'computers', paramName: 'subjectId', pattern: /^computers\/(?<subjectId>[^/]+)$/ },
  { prefix: 'evs', paramName: 'subjectId', pattern: /^evs\/(?<subjectId>[^/]+)$/ },
  { prefix: 'edit-subjects', paramName: 'learnerId', pattern: /^edit-subjects\/(?<learnerId>[^/]+)$/ },
];

const SUBJECT_NAME_ROUTE: RouteParamConfig = {
  prefix: 'subject-',
  paramName: 'subjectName',
  pattern: /^subject-(?<subjectName>[^/]+)$/,
};

// --- Arbitraries ---

/**
 * Generates valid ID strings: alphanumeric, hyphens, underscores.
 * Matches the [^/]+ capture group (any character except forward slash).
 * Produces IDs like UUIDs, short IDs, and alphanumeric strings.
 */
const validIdArb = fc.oneof(
  // UUID-like IDs
  fc.uuid(),
  // Alphanumeric short IDs (1–40 chars)
  fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/),
  // Numeric-only IDs
  fc.stringMatching(/^[1-9][0-9]{0,9}$/),
);

/**
 * Generates valid subject name strings (lowercase, no slashes).
 * Matches subjectName group from `subject-{name}` pattern.
 */
const validSubjectNameArb = fc.oneof(
  fc.constantFrom('kannada', 'hindi', 'english', 'maths', 'computers', 'evs', 'science'),
  fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
);

// --- Property Tests ---

describe('Feature: end-to-end-ui-integration, Property 3: Route Parameter Extraction', () => {
  let destroyRouter: (() => void) | null = null;

  afterEach(() => {
    if (destroyRouter) {
      destroyRouter();
      destroyRouter = null;
    }
    window.location.hash = '';
  });

  /**
   * **Validates: Requirements 2.5, 2.6, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 12.3**
   *
   * For any parameterized route pattern (upload/{id}, transcript/{id}, explain/{id},
   * exercises/{id}, pronunciation/{id}, grammar/{id}, quiz/{id}, maths/{id},
   * computers/{id}, evs/{id}, edit-subjects/{id}) and any valid ID string,
   * the route handler extracts the correct ID value from the URL hash.
   */
  it('extracts the correct ID for any parameterized route and valid ID string', () => {
    // Generate a route config and a valid ID
    const routeConfigArb = fc.constantFrom(...PARAMETERIZED_ROUTES);

    fc.assert(
      fc.property(routeConfigArb, validIdArb, (routeConfig, id) => {
        const mountPoint = document.createElement('div');
        document.body.appendChild(mountPoint);

        let extractedParams: Record<string, string> = {};

        const routes: Route[] = [
          {
            pattern: routeConfig.pattern,
            handler: (params) => {
              extractedParams = params;
              const el = document.createElement('div');
              el.id = 'matched-view';
              return el;
            },
          },
        ];

        const fallback = () => {
          const el = document.createElement('div');
          el.id = 'fallback-view';
          return el;
        };

        // Set hash to the parameterized route
        const hash = `${routeConfig.prefix}/${id}`;
        window.location.hash = `#${hash}`;

        const router = createRouter({ mountPoint, routes, fallback });
        destroyRouter = router.destroy;

        // Assert the route matched (not fallback)
        expect(mountPoint.querySelector('#matched-view')).not.toBeNull();
        expect(mountPoint.querySelector('#fallback-view')).toBeNull();

        // Assert the parameter was extracted correctly
        expect(extractedParams[routeConfig.paramName]).toBe(id);

        // Clean up
        router.destroy();
        destroyRouter = null;
        document.body.removeChild(mountPoint);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.5, 2.6, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2, 9.2, 10.2, 12.3**
   *
   * For the subject-{name} route pattern and any valid subject name string,
   * the route handler extracts the correct subjectName from the URL hash.
   */
  it('extracts the correct subjectName for the subject-{name} route', () => {
    fc.assert(
      fc.property(validSubjectNameArb, (subjectName) => {
        const mountPoint = document.createElement('div');
        document.body.appendChild(mountPoint);

        let extractedParams: Record<string, string> = {};

        const routes: Route[] = [
          {
            pattern: SUBJECT_NAME_ROUTE.pattern,
            handler: (params) => {
              extractedParams = params;
              const el = document.createElement('div');
              el.id = 'subject-view';
              return el;
            },
          },
        ];

        const fallback = () => {
          const el = document.createElement('div');
          el.id = 'fallback-view';
          return el;
        };

        // Set hash to subject-{name}
        const hash = `subject-${subjectName}`;
        window.location.hash = `#${hash}`;

        const router = createRouter({ mountPoint, routes, fallback });
        destroyRouter = router.destroy;

        // Assert the route matched
        expect(mountPoint.querySelector('#subject-view')).not.toBeNull();
        expect(mountPoint.querySelector('#fallback-view')).toBeNull();

        // Assert the subjectName was extracted correctly
        expect(extractedParams.subjectName).toBe(subjectName);

        // Clean up
        router.destroy();
        destroyRouter = null;
        document.body.removeChild(mountPoint);
      }),
      { numRuns: 100 }
    );
  });
});
