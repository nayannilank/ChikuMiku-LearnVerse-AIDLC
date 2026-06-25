/**
 * Property Test: Role-Based Navigation Routing
 *
 * **Property 4: Role-Based Navigation Routing**
 * For any authenticated user with a role of "parent", login SHALL navigate to
 * the Parent Dashboard (/parent/dashboard); for any authenticated user with a
 * role of "student", login SHALL navigate to the Learner Dashboard (/dashboard).
 *
 * **Validates: Requirements 1.11, 22.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createLoginHandler,
  type CognitoAuthClient,
  type UserRole,
  type LoginSuccessResponse,
} from '../handlers/login';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a random valid username (8-15 chars, alphanumeric + hyphens/underscores) */
const usernameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')),
  { minLength: 8, maxLength: 15 },
);

/** Generates a random valid password (8-20 chars with complexity requirements) */
const passwordArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 4 }),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 4 }),
  fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 4 }),
  fc.stringOf(fc.constantFrom(...'!@#$%^&*'.split('')), { minLength: 1, maxLength: 4 }),
).map(([upper, lower, digit, special]) => `${upper}${lower}${digit}${special}`);

/** Generates a random role: parent or student */
const roleArb: fc.Arbitrary<UserRole> = fc.constantFrom('parent', 'student');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock Cognito auth client that always authenticates successfully */
function createMockCognitoClient(role: UserRole): CognitoAuthClient {
  return {
    authenticate: async () => ({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      idToken: 'mock-id-token',
    }),
    getUserGroups: async () => [role],
  };
}

/** Builds a minimal API Gateway event with a login request body */
function buildLoginEvent(username: string, password: string): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ username, password }),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {},
    httpMethod: 'POST',
    path: '/auth/login',
    resource: '/auth/login',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 4: Role-Based Navigation Routing', () => {
  it('parent role ALWAYS routes to /parent/dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(usernameArb, passwordArb, async (username, password) => {
        const mockClient = createMockCognitoClient('parent');
        const handler = createLoginHandler(mockClient);
        const event = buildLoginEvent(username, password);

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        const body: LoginSuccessResponse = JSON.parse(result.body);
        expect(body.success).toBe(true);
        expect(body.role).toBe('parent');
        expect(body.redirectTo).toBe('/parent/dashboard');
      }),
      { numRuns: 200 },
    );
  });

  it('student role ALWAYS routes to /dashboard', async () => {
    await fc.assert(
      fc.asyncProperty(usernameArb, passwordArb, async (username, password) => {
        const mockClient = createMockCognitoClient('student');
        const handler = createLoginHandler(mockClient);
        const event = buildLoginEvent(username, password);

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        const body: LoginSuccessResponse = JSON.parse(result.body);
        expect(body.success).toBe(true);
        expect(body.role).toBe('student');
        expect(body.redirectTo).toBe('/dashboard');
      }),
      { numRuns: 200 },
    );
  });

  it('for any randomly assigned role, the correct redirect is returned', async () => {
    await fc.assert(
      fc.asyncProperty(usernameArb, passwordArb, roleArb, async (username, password, role) => {
        const mockClient = createMockCognitoClient(role);
        const handler = createLoginHandler(mockClient);
        const event = buildLoginEvent(username, password);

        const result = await handler(event);
        expect(result.statusCode).toBe(200);

        const body: LoginSuccessResponse = JSON.parse(result.body);
        expect(body.success).toBe(true);
        expect(body.role).toBe(role);

        // Verify role-based routing invariant
        if (role === 'parent') {
          expect(body.redirectTo).toBe('/parent/dashboard');
        } else {
          expect(body.redirectTo).toBe('/dashboard');
        }
      }),
      { numRuns: 200 },
    );
  });
});
