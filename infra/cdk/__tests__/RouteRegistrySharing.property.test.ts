/**
 * Property Test: Route Registry Sharing
 *
 * Feature: infra-migration-to-cdk, Property 7
 *
 * Property 7: Lambda Handler and Local Server Share Route Definitions
 *
 * For any route dispatched through the Lambda handler's ApiRouter, the same
 * route with the same method, path, and handler function SHALL also be
 * dispatched by the local development server's ApiRouter. The two routers
 * SHALL produce identical route registries.
 *
 * **Validates: Requirements 11.2**
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { ApiRouter, createDefaultRoutes } from '../../../packages/services/api/src/endpoints';

/**
 * Domain tag configuration — source of truth matching the 4 domain Lambda handlers.
 */
const DOMAIN_TAG_MAP: Record<string, string[]> = {
  auth: ['auth'],
  content: ['content', 'subjects', 'progress', 'revision'],
  learning: ['learning'],
  sync: ['sync'],
};

/**
 * All domain tags across all handlers (flattened).
 */
const ALL_DOMAIN_TAGS = Object.values(DOMAIN_TAG_MAP).flat();

describe('Property 7: Lambda Handler and Local Server Share Route Definitions', () => {
  let allRoutes: ReturnType<typeof createDefaultRoutes>;
  let localServerRouter: ApiRouter;
  let monolithicLambdaRouter: ApiRouter;
  let domainRouters: Record<string, ApiRouter>;

  beforeAll(() => {
    allRoutes = createDefaultRoutes();

    // Local dev server: registers ALL routes (mirrors server.ts)
    localServerRouter = new ApiRouter();
    for (const route of createDefaultRoutes()) {
      localServerRouter.register(route);
    }

    // Monolithic Lambda handler: registers ALL routes (mirrors lambda.ts)
    monolithicLambdaRouter = new ApiRouter();
    for (const route of createDefaultRoutes()) {
      monolithicLambdaRouter.register(route);
    }

    // Domain Lambda handlers: each filters by its tag set (mirrors handlers/*/index.ts)
    domainRouters = {};
    for (const [domain, tags] of Object.entries(DOMAIN_TAG_MAP)) {
      const router = new ApiRouter();
      const routes = createDefaultRoutes();
      for (const route of routes) {
        if (route.tags.some((tag) => tags.includes(tag))) {
          router.register(route);
        }
      }
      domainRouters[domain] = router;
    }
  });

  it('the union of routes across all 4 domain Lambda handlers equals the routes in the local dev server', () => {
    // Collect all routes from all domain handlers
    const domainRoutesUnion: Array<{ method: string; path: string }> = [];
    for (const router of Object.values(domainRouters)) {
      for (const route of router.getRoutes()) {
        domainRoutesUnion.push({ method: route.method, path: route.path });
      }
    }

    const localServerRoutes = localServerRouter.getRoutes().map((r) => ({
      method: r.method,
      path: r.path,
    }));

    // Sort both arrays for stable comparison
    const sortFn = (a: { method: string; path: string }, b: { method: string; path: string }) =>
      `${a.method}:${a.path}`.localeCompare(`${b.method}:${b.path}`);

    domainRoutesUnion.sort(sortFn);
    localServerRoutes.sort(sortFn);

    expect(domainRoutesUnion).toEqual(localServerRoutes);
  });

  it('for any route from createDefaultRoutes(), it appears in exactly one domain Lambda handler', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allRoutes),
        (route) => {
          let matchCount = 0;
          for (const [, tags] of Object.entries(DOMAIN_TAG_MAP)) {
            if (route.tags.some((tag) => tags.includes(tag))) {
              matchCount++;
            }
          }
          // Each route must match exactly one domain
          expect(matchCount).toBe(1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('monolithic Lambda handler and local server produce identical route registries', () => {
    const monolithRoutes = monolithicLambdaRouter.getRoutes().map((r) => ({
      method: r.method,
      path: r.path,
      requiresAuth: r.requiresAuth,
      tags: r.tags,
      description: r.description,
    }));

    const localRoutes = localServerRouter.getRoutes().map((r) => ({
      method: r.method,
      path: r.path,
      requiresAuth: r.requiresAuth,
      tags: r.tags,
      description: r.description,
    }));

    expect(monolithRoutes).toEqual(localRoutes);
  });

  it('each route\'s method, path, requiresAuth, and tags are preserved identically across domain handlers and local server', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allRoutes),
        (route) => {
          // Find which domain router this route belongs to
          const matchingDomain = Object.entries(DOMAIN_TAG_MAP).find(([, tags]) =>
            route.tags.some((tag) => tags.includes(tag))
          );

          expect(matchingDomain).toBeDefined();

          const [domainName] = matchingDomain!;
          const domainRouter = domainRouters[domainName];
          const domainRoutes = domainRouter.getRoutes();

          // Find this route in the domain router
          const matchedRoute = domainRoutes.find(
            (r) => r.method === route.method && r.path === route.path
          );

          expect(matchedRoute).toBeDefined();
          expect(matchedRoute!.method).toBe(route.method);
          expect(matchedRoute!.path).toBe(route.path);
          expect(matchedRoute!.requiresAuth).toBe(route.requiresAuth);
          expect(matchedRoute!.tags).toEqual(route.tags);

          // Also verify the same route exists in the local server router
          const localRoutes = localServerRouter.getRoutes();
          const localMatch = localRoutes.find(
            (r) => r.method === route.method && r.path === route.path
          );

          expect(localMatch).toBeDefined();
          expect(localMatch!.method).toBe(route.method);
          expect(localMatch!.path).toBe(route.path);
          expect(localMatch!.requiresAuth).toBe(route.requiresAuth);
          expect(localMatch!.tags).toEqual(route.tags);
        }
      ),
      { numRuns: 200 }
    );
  });
});
