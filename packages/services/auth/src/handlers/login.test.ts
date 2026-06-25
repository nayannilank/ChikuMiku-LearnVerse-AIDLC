/**
 * Unit tests for the login Lambda handler.
 *
 * Tests authentication flow, role-based routing, error handling,
 * and credential failure scenarios.
 *
 * Requirements: 1.2, 1.6, 1.7, 1.8, 1.9, 1.11, 1.12
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createLoginHandler,
  type CognitoAuthClient,
  type LoginSuccessResponse,
  type LoginErrorResponse,
} from './login';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: body === null ? null : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { requestId: 'test-request-id' },
    httpMethod: 'POST',
    path: '/auth/login',
    resource: '/auth/login',
  };
}

function createValidLoginBody(role: 'parent' | 'student' = 'parent') {
  return {
    username: 'testuser01',
    password: 'Pass1234!',
    role,
  };
}

function createMockAuthClient(role: 'parent' | 'student' = 'parent'): CognitoAuthClient {
  return {
    authenticate: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      idToken: 'mock-id-token',
    }),
    getUserGroups: vi.fn().mockResolvedValue([role]),
  };
}

// ============================================================
// Tests
// ============================================================

describe('login handler', () => {
  let authClient: CognitoAuthClient;
  let handler: ReturnType<typeof createLoginHandler>;

  beforeEach(() => {
    authClient = createMockAuthClient('parent');
    handler = createLoginHandler(authClient);
  });

  describe('successful login', () => {
    it('should return 200 with tokens for valid parent login', async () => {
      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body: LoginSuccessResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.accessToken).toBe('mock-access-token');
      expect(body.refreshToken).toBe('mock-refresh-token');
      expect(body.role).toBe('parent');
      expect(body.redirectTo).toBe('/parent/dashboard');
    });

    it('should return 200 with tokens for valid student login', async () => {
      authClient = createMockAuthClient('student');
      handler = createLoginHandler(authClient);

      const event = createMockEvent(createValidLoginBody('student'));
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body: LoginSuccessResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.accessToken).toBe('mock-access-token');
      expect(body.refreshToken).toBe('mock-refresh-token');
      expect(body.role).toBe('student');
      expect(body.redirectTo).toBe('/dashboard');
    });

    it('should call authenticate with correct username and password', async () => {
      const input = createValidLoginBody('parent');
      const event = createMockEvent(input);
      await handler(event);

      expect(authClient.authenticate).toHaveBeenCalledWith({
        username: input.username,
        password: input.password,
      });
    });

    it('should call getUserGroups with the username', async () => {
      const input = createValidLoginBody('parent');
      const event = createMockEvent(input);
      await handler(event);

      expect(authClient.getUserGroups).toHaveBeenCalledWith(input.username);
    });
  });

  describe('role-based routing', () => {
    it('should redirect parent to /parent/dashboard', async () => {
      authClient = createMockAuthClient('parent');
      handler = createLoginHandler(authClient);

      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      const body: LoginSuccessResponse = JSON.parse(result.body);
      expect(body.redirectTo).toBe('/parent/dashboard');
    });

    it('should redirect student to /dashboard', async () => {
      authClient = createMockAuthClient('student');
      handler = createLoginHandler(authClient);

      const event = createMockEvent(createValidLoginBody('student'));
      const result = await handler(event);

      const body: LoginSuccessResponse = JSON.parse(result.body);
      expect(body.redirectTo).toBe('/dashboard');
    });

    it('should return 401 when user has no recognized role group', async () => {
      // User is authenticated but belongs to no recognized group
      (authClient.getUserGroups as ReturnType<typeof vi.fn>).mockResolvedValue(['admin']);

      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.message).toBe('incorrect username or password');
    });
  });

  describe('invalid credentials (401)', () => {
    it('should return 401 with correct message on auth failure', async () => {
      (authClient.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('NotAuthorizedException'),
      );

      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.message).toBe('incorrect username or password');
      expect(body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 when user is not found', async () => {
      (authClient.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('UserNotFoundException'),
      );

      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.message).toBe('incorrect username or password');
      expect(body.errorCode).toBe('INVALID_CREDENTIALS');
    });

    it('should preserve username in 401 response', async () => {
      (authClient.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('NotAuthorizedException'),
      );

      const input = createValidLoginBody('parent');
      const event = createMockEvent(input);
      const result = await handler(event);

      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.username).toBe(input.username);
    });

    it('should not include password in 401 response', async () => {
      (authClient.authenticate as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('NotAuthorizedException'),
      );

      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.password).toBeUndefined();
    });
  });

  describe('request body validation (400)', () => {
    it('should return 400 when body is null', async () => {
      const event = createMockEvent(null);
      event.body = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({});
      event.body = 'not json';
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('should return 400 when username is missing', async () => {
      const event = createMockEvent({ password: 'Pass1234!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELDS');
      expect(body.missingFields).toContain('username');
    });

    it('should return 400 when password is missing', async () => {
      const event = createMockEvent({ username: 'testuser01' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELDS');
      expect(body.missingFields).toContain('password');
    });

    it('should return 400 listing all missing fields', async () => {
      const event = createMockEvent({});
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.missingFields).toContain('username');
      expect(body.missingFields).toContain('password');
    });

    it('should return 400 when username is empty string', async () => {
      const event = createMockEvent({ username: '', password: 'Pass1234!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.missingFields).toContain('username');
    });

    it('should return 400 when password is empty string', async () => {
      const event = createMockEvent({ username: 'testuser01', password: '' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.missingFields).toContain('password');
    });
  });

  describe('internal error handling (500)', () => {
    it('should return 500 when getUserGroups fails unexpectedly', async () => {
      (authClient.getUserGroups as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error'),
      );

      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body: LoginErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers on success', async () => {
      const event = createMockEvent(createValidLoginBody('parent'));
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('should include CORS headers on error', async () => {
      const event = createMockEvent(null);
      event.body = null;
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
