/**
 * Unit tests for getStreak handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createGetStreakHandler } from './getStreak';
import type { StreakDbClient, StreakRecord } from './getStreak';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

function createEvent(studentId: string | undefined): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: studentId ? { studentId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: 'auth-user-id' },
      },
    },
    httpMethod: 'GET',
    path: `/progress/${studentId ?? ''}/streak`,
    resource: '/progress/{studentId}/streak',
  };
}

function createMockDbClient(overrides?: Partial<StreakDbClient>): StreakDbClient {
  return {
    getStreak: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('getStreak handler', () => {
  const validStudentId = '550e8400-e29b-41d4-a716-446655440000';

  it('returns 200 with streak data when record exists', async () => {
    const record: StreakRecord = {
      studentId: validStudentId,
      currentStreak: 5,
      lastActivityDate: '2024-01-15',
      streakResetDate: null,
      updatedAt: '2024-01-15T10:00:00.000Z',
    };
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(record),
    });
    const handler = createGetStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.studentId).toBe(validStudentId);
    expect(body.currentStreak).toBe(5);
    expect(body.lastActivityDate).toBe('2024-01-15');
  });

  it('returns 200 with zero streak when no record exists', async () => {
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(null),
    });
    const handler = createGetStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.studentId).toBe(validStudentId);
    expect(body.currentStreak).toBe(0);
    expect(body.lastActivityDate).toBeNull();
  });

  it('returns 400 when studentId is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetStreakHandler(dbClient);

    const result = await handler(createEvent(undefined));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when studentId is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetStreakHandler(dbClient);

    const result = await handler(createEvent('not-a-uuid'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('valid UUID');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });
    const handler = createGetStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
