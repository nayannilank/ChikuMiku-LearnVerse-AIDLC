/**
 * Unit tests for the logout Lambda handler.
 *
 * Tests authentication, state validation, persistence, Cognito sign-out,
 * and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createLogoutHandler,
  type StatePersistenceClient,
  type CognitoSessionClient,
  type UserState,
} from './logout';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(body: unknown, options?: {
  userId?: string | null;
  authHeader?: string | null;
}): APIGatewayProxyEvent {
  const userId = options?.userId !== undefined ? options.userId : 'user-123';
  const authHeader = options?.authHeader !== undefined
    ? options.authHeader
    : 'Bearer valid-access-token';

  return {
    body: body === null ? null : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader !== null ? { Authorization: authHeader } : {}),
    },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: userId !== null ? { claims: { sub: userId } } : undefined,
      requestId: 'test-request-id',
    },
    httpMethod: 'POST',
    path: '/auth/logout',
    resource: '/auth/logout',
  };
}

function createValidState(): UserState {
  return {
    progressPercentages: { 'subject-1': 75, 'subject-2': 50 },
    currentStreak: 5,
    lastViewedChapterId: 'chapter-abc',
    lastViewedPageNumber: 3,
    pendingExerciseResults: [
      {
        exerciseId: 'ex-1',
        isCorrect: true,
        score: 100,
        answeredAt: '2024-01-15T10:30:00Z',
      },
    ],
  };
}

function createValidBody() {
  return { state: createValidState() };
}

function createMockStatePersistenceClient(): StatePersistenceClient {
  return {
    saveUserState: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockCognitoSessionClient(): CognitoSessionClient {
  return {
    globalSignOut: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('logout handler', () => {
  let statePersistenceClient: StatePersistenceClient;
  let cognitoSessionClient: CognitoSessionClient;
  let handler: ReturnType<typeof createLogoutHandler>;

  beforeEach(() => {
    statePersistenceClient = createMockStatePersistenceClient();
    cognitoSessionClient = createMockCognitoSessionClient();
    handler = createLogoutHandler(statePersistenceClient, cognitoSessionClient);
  });

  describe('successful logout', () => {
    it('should return 200 with success message and statePersisted true', async () => {
      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Logged out successfully');
      expect(body.statePersisted).toBe(true);
    });

    it('should persist user state with correct userId and state', async () => {
      const state = createValidState();
      const event = createMockEvent({ state });

      await handler(event);

      expect(statePersistenceClient.saveUserState).toHaveBeenCalledWith('user-123', state);
    });

    it('should call globalSignOut with the access token', async () => {
      const event = createMockEvent(createValidBody());

      await handler(event);

      expect(cognitoSessionClient.globalSignOut).toHaveBeenCalledWith('valid-access-token');
    });

    it('should persist state before calling globalSignOut', async () => {
      const callOrder: string[] = [];
      (statePersistenceClient.saveUserState as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('saveUserState');
      });
      (cognitoSessionClient.globalSignOut as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('globalSignOut');
      });

      const event = createMockEvent(createValidBody());
      await handler(event);

      expect(callOrder).toEqual(['saveUserState', 'globalSignOut']);
    });

    it('should handle state with empty progressPercentages', async () => {
      const state: UserState = {
        progressPercentages: {},
        currentStreak: 0,
        lastViewedChapterId: null,
        lastViewedPageNumber: null,
        pendingExerciseResults: [],
      };
      const event = createMockEvent({ state });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(statePersistenceClient.saveUserState).toHaveBeenCalledWith('user-123', state);
    });

    it('should handle state with null lastViewedChapterId and lastViewedPageNumber', async () => {
      const state: UserState = {
        progressPercentages: { 'sub-1': 100 },
        currentStreak: 10,
        lastViewedChapterId: null,
        lastViewedPageNumber: null,
        pendingExerciseResults: [],
      };
      const event = createMockEvent({ state });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('authentication (401)', () => {
    it('should return 401 when no JWT claims are present', async () => {
      const event = createMockEvent(createValidBody(), { userId: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
      expect(body.message).toBe('No valid JWT provided');
    });

    it('should return 401 when Authorization header is missing', async () => {
      const event = createMockEvent(createValidBody(), { authHeader: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
    });

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      const event = createMockEvent(createValidBody(), { authHeader: 'Basic some-token' });
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
    });

    it('should not persist state when unauthorized', async () => {
      const event = createMockEvent(createValidBody(), { userId: null });
      await handler(event);

      expect(statePersistenceClient.saveUserState).not.toHaveBeenCalled();
      expect(cognitoSessionClient.globalSignOut).not.toHaveBeenCalled();
    });
  });

  describe('request body validation (400)', () => {
    it('should return 400 when body is null', async () => {
      const event = createMockEvent(null);
      event.body = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({});
      event.body = 'not json';
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('should return 400 when state is missing from body', async () => {
      const event = createMockEvent({});
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when progressPercentages is not an object', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), progressPercentages: 'invalid' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when progressPercentages contains non-number values', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), progressPercentages: { 'sub-1': 'not-a-number' } },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when currentStreak is negative', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), currentStreak: -1 },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when currentStreak is not a number', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), currentStreak: 'five' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when pendingExerciseResults is not an array', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), pendingExerciseResults: 'not-array' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when exercise result is missing exerciseId', async () => {
      const event = createMockEvent({
        state: {
          ...createValidState(),
          pendingExerciseResults: [{ isCorrect: true, score: 100, answeredAt: '2024-01-01T00:00:00Z' }],
        },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when lastViewedChapterId is not string or null', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), lastViewedChapterId: 123 },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });

    it('should return 400 when lastViewedPageNumber is not number or null', async () => {
      const event = createMockEvent({
        state: { ...createValidState(), lastViewedPageNumber: 'three' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_STATE');
    });
  });

  describe('internal error handling (500)', () => {
    it('should return 500 when state persistence fails', async () => {
      (statePersistenceClient.saveUserState as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });

    it('should return 500 when Cognito globalSignOut fails', async () => {
      (cognitoSessionClient.globalSignOut as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cognito service unavailable'),
      );

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });
  });
});
