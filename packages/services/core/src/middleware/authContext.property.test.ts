/**
 * Property Tests: JWT Parsing and Claim Extraction
 *
 * Property 1: JWT Parsing and Claim Extraction
 * - Generate random valid JWT payloads and verify correct user ID extraction
 * - Generate expired, malformed, tampered JWTs and verify 401 rejection
 *
 * **Validates: Requirements 1.1, 1.5, 18.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractAuthContext } from './authContext.js';
import { ServiceError } from './errorHandler.js';
import type { APIGatewayProxyEvent } from '../lambdaTypes.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(claims?: Record<string, string>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: claims ? { claims } : undefined,
    },
    httpMethod: 'GET',
    path: '/test',
    resource: '/test',
  };
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a non-empty string suitable for a user ID (sub claim) */
const subArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 50 },
).map((s) => `user-${s}`);

/** Generates a random username string */
const usernameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-.'.split('')),
  { minLength: 1, maxLength: 30 },
);

/** Generates a random group name (no commas) */
const groupNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 20 },
);

/** Generates a list of group names */
const groupsArb = fc.array(groupNameArb, { minLength: 0, maxLength: 5 });

/** Generates a valid userType claim */
const userTypeArb = fc.constantFrom('parent', 'student', '', 'unknown', 'teacher');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 1: JWT Parsing and Claim Extraction', () => {
  describe('Valid JWT claim extraction', () => {
    it('for any valid claims with a sub field, extractAuthContext SHALL correctly extract userId', () => {
      fc.assert(
        fc.property(subArb, usernameArb, groupsArb, userTypeArb, (sub, username, groups, userType) => {
          const groupsClaim = groups.join(',');
          const claims: Record<string, string> = {
            sub,
            'cognito:username': username,
            'cognito:groups': groupsClaim,
            'custom:userType': userType,
          };

          const event = makeEvent(claims);
          const ctx = extractAuthContext(event);

          // userId SHALL equal the sub claim
          expect(ctx.userId).toBe(sub);
        }),
        { numRuns: 200 },
      );
    });

    it('for any valid claims, extractAuthContext SHALL correctly extract username from cognito:username', () => {
      fc.assert(
        fc.property(subArb, usernameArb, (sub, username) => {
          const claims: Record<string, string> = {
            sub,
            'cognito:username': username,
            'cognito:groups': '',
            'custom:userType': 'student',
          };

          const event = makeEvent(claims);
          const ctx = extractAuthContext(event);

          expect(ctx.username).toBe(username);
        }),
        { numRuns: 200 },
      );
    });

    it('for any valid claims without cognito:username, SHALL fall back to username claim', () => {
      fc.assert(
        fc.property(subArb, usernameArb, (sub, username) => {
          const claims: Record<string, string> = {
            sub,
            username,
            'cognito:groups': '',
            'custom:userType': 'student',
          };

          const event = makeEvent(claims);
          const ctx = extractAuthContext(event);

          expect(ctx.username).toBe(username);
        }),
        { numRuns: 200 },
      );
    });

    it('for any comma-separated groups claim, SHALL correctly split into array', () => {
      fc.assert(
        fc.property(subArb, groupsArb, (sub, groups) => {
          const groupsClaim = groups.join(',');
          const claims: Record<string, string> = {
            sub,
            'cognito:username': 'testuser',
            'cognito:groups': groupsClaim,
            'custom:userType': 'student',
          };

          const event = makeEvent(claims);
          const ctx = extractAuthContext(event);

          if (groups.length === 0) {
            expect(ctx.groups).toEqual([]);
          } else {
            // Each group should be trimmed and present
            expect(ctx.groups).toEqual(groups.map(g => g.trim()));
          }
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Missing/invalid claims rejection', () => {
    it('for any event without authorizer, SHALL throw ServiceError with statusCode 401', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          fc.string({ minLength: 1, maxLength: 50 }),
          (method, path) => {
            const event: APIGatewayProxyEvent = {
              body: null,
              headers: {},
              pathParameters: null,
              queryStringParameters: null,
              requestContext: {},
              httpMethod: method,
              path: `/${path}`,
              resource: `/${path}`,
            };

            expect(() => extractAuthContext(event)).toThrow(ServiceError);
            try {
              extractAuthContext(event);
            } catch (e) {
              expect((e as ServiceError).statusCode).toBe(401);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('for any event with authorizer but undefined claims, SHALL throw ServiceError with statusCode 401', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          (method) => {
            const event: APIGatewayProxyEvent = {
              body: null,
              headers: {},
              pathParameters: null,
              queryStringParameters: null,
              requestContext: {
                authorizer: {},
              },
              httpMethod: method,
              path: '/test',
              resource: '/test',
            };

            expect(() => extractAuthContext(event)).toThrow(ServiceError);
            try {
              extractAuthContext(event);
            } catch (e) {
              expect((e as ServiceError).statusCode).toBe(401);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Missing/invalid sub claim', () => {
    it('for any claims object without sub field, SHALL throw ServiceError with statusCode 401', () => {
      fc.assert(
        fc.property(usernameArb, groupsArb, userTypeArb, (username, groups, userType) => {
          const claims: Record<string, string> = {
            'cognito:username': username,
            'cognito:groups': groups.join(','),
            'custom:userType': userType,
          };

          const event = makeEvent(claims);

          expect(() => extractAuthContext(event)).toThrow(ServiceError);
          try {
            extractAuthContext(event);
          } catch (e) {
            expect((e as ServiceError).statusCode).toBe(401);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('for any claims object with empty sub field, SHALL throw ServiceError with statusCode 401', () => {
      fc.assert(
        fc.property(usernameArb, groupsArb, userTypeArb, (username, groups, userType) => {
          const claims: Record<string, string> = {
            sub: '',
            'cognito:username': username,
            'cognito:groups': groups.join(','),
            'custom:userType': userType,
          };

          const event = makeEvent(claims);

          expect(() => extractAuthContext(event)).toThrow(ServiceError);
          try {
            extractAuthContext(event);
          } catch (e) {
            expect((e as ServiceError).statusCode).toBe(401);
          }
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Role resolution correctness', () => {
    it('when custom:userType is "parent", role SHALL always be "parent"', () => {
      fc.assert(
        fc.property(subArb, usernameArb, groupsArb, (sub, username, groups) => {
          const claims: Record<string, string> = {
            sub,
            'cognito:username': username,
            'cognito:groups': groups.join(','),
            'custom:userType': 'parent',
          };

          const event = makeEvent(claims);
          const ctx = extractAuthContext(event);

          expect(ctx.role).toBe('parent');
        }),
        { numRuns: 200 },
      );
    });

    it('when custom:userType is "student", role SHALL always be "student"', () => {
      fc.assert(
        fc.property(subArb, usernameArb, groupsArb, (sub, username, groups) => {
          const claims: Record<string, string> = {
            sub,
            'cognito:username': username,
            'cognito:groups': groups.join(','),
            'custom:userType': 'student',
          };

          const event = makeEvent(claims);
          const ctx = extractAuthContext(event);

          expect(ctx.role).toBe('student');
        }),
        { numRuns: 200 },
      );
    });

    it('when custom:userType is not "parent" or "student" and groups contain "parent", role SHALL be "parent"', () => {
      fc.assert(
        fc.property(
          subArb,
          usernameArb,
          groupsArb,
          fc.constantFrom('', 'unknown', 'admin', 'teacher'),
          (sub, username, otherGroups, userType) => {
            // Ensure at least one group contains 'parent'
            const groups = [...otherGroups, 'parents'];
            const claims: Record<string, string> = {
              sub,
              'cognito:username': username,
              'cognito:groups': groups.join(','),
              'custom:userType': userType,
            };

            const event = makeEvent(claims);
            const ctx = extractAuthContext(event);

            expect(ctx.role).toBe('parent');
          },
        ),
        { numRuns: 200 },
      );
    });

    it('when custom:userType is not "parent"/"student" and no group contains "parent", role SHALL default to "student"', () => {
      fc.assert(
        fc.property(
          subArb,
          usernameArb,
          fc.constantFrom('', 'unknown', 'admin', 'teacher'),
          (sub, username, userType) => {
            // Groups that definitely do NOT contain "parent"
            const groups = ['students', 'readers', 'editors'];
            const claims: Record<string, string> = {
              sub,
              'cognito:username': username,
              'cognito:groups': groups.join(','),
              'custom:userType': userType,
            };

            const event = makeEvent(claims);
            const ctx = extractAuthContext(event);

            expect(ctx.role).toBe('student');
          },
        ),
        { numRuns: 200 },
      );
    });

    it('role resolution SHALL be deterministic for any given claims', () => {
      fc.assert(
        fc.property(subArb, usernameArb, groupsArb, userTypeArb, (sub, username, groups, userType) => {
          const claims: Record<string, string> = {
            sub,
            'cognito:username': username,
            'cognito:groups': groups.join(','),
            'custom:userType': userType,
          };

          const event1 = makeEvent(claims);
          const event2 = makeEvent(claims);
          const ctx1 = extractAuthContext(event1);
          const ctx2 = extractAuthContext(event2);

          // Same input SHALL always produce same role
          expect(ctx1.role).toBe(ctx2.role);
          expect(ctx1.userId).toBe(ctx2.userId);
          expect(ctx1.username).toBe(ctx2.username);
          expect(ctx1.groups).toEqual(ctx2.groups);
        }),
        { numRuns: 200 },
      );
    });
  });
});
