/**
 * Unit tests for updateStreak handler.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createUpdateStreakHandler,
  computeStreakUpdate,
  daysBetween,
} from './updateStreak';
import type { StreakDbClient, StreakRecord } from './updateStreak';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

function createEvent(studentId: string | undefined): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ exerciseId: 'exercise-123' }),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: studentId ? { studentId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: 'auth-user-id' },
      },
    },
    httpMethod: 'POST',
    path: `/progress/${studentId ?? ''}/streak`,
    resource: '/progress/{studentId}/streak',
  };
}

function createMockDbClient(overrides?: Partial<StreakDbClient>): StreakDbClient {
  return {
    getStreak: vi.fn().mockResolvedValue(null),
    upsertStreak: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================================
// Pure Logic Tests: computeStreakUpdate
// ============================================================

describe('computeStreakUpdate', () => {
  it('returns streak 1 when no existing record', () => {
    const result = computeStreakUpdate(null, '2024-01-15');
    expect(result.currentStreak).toBe(1);
    expect(result.wasIncremented).toBe(true);
    expect(result.wasReset).toBe(false);
  });

  it('returns streak 1 when existing record has null lastActivityDate', () => {
    const existing: StreakRecord = {
      studentId: 'student-1',
      currentStreak: 0,
      lastActivityDate: null,
      streakResetDate: null,
      updatedAt: '2024-01-15T00:00:00Z',
    };
    const result = computeStreakUpdate(existing, '2024-01-15');
    expect(result.currentStreak).toBe(1);
    expect(result.wasIncremented).toBe(true);
    expect(result.wasReset).toBe(false);
  });

  it('does not change streak when already active today', () => {
    const existing: StreakRecord = {
      studentId: 'student-1',
      currentStreak: 3,
      lastActivityDate: '2024-01-15',
      streakResetDate: null,
      updatedAt: '2024-01-15T08:00:00Z',
    };
    const result = computeStreakUpdate(existing, '2024-01-15');
    expect(result.currentStreak).toBe(3);
    expect(result.wasIncremented).toBe(false);
    expect(result.wasReset).toBe(false);
  });

  it('increments streak on consecutive day (gap = 1)', () => {
    const existing: StreakRecord = {
      studentId: 'student-1',
      currentStreak: 4,
      lastActivityDate: '2024-01-14',
      streakResetDate: null,
      updatedAt: '2024-01-14T10:00:00Z',
    };
    const result = computeStreakUpdate(existing, '2024-01-15');
    expect(result.currentStreak).toBe(5);
    expect(result.wasIncremented).toBe(true);
    expect(result.wasReset).toBe(false);
  });

  it('resets streak when gap is 2 days (second missed day)', () => {
    const existing: StreakRecord = {
      studentId: 'student-1',
      currentStreak: 10,
      lastActivityDate: '2024-01-13',
      streakResetDate: null,
      updatedAt: '2024-01-13T10:00:00Z',
    };
    // Today is Jan 15, gap of 2 days (missed Jan 14 entirely)
    const result = computeStreakUpdate(existing, '2024-01-15');
    expect(result.currentStreak).toBe(1);
    expect(result.wasIncremented).toBe(true);
    expect(result.wasReset).toBe(true);
  });

  it('resets streak when gap is more than 2 days', () => {
    const existing: StreakRecord = {
      studentId: 'student-1',
      currentStreak: 7,
      lastActivityDate: '2024-01-10',
      streakResetDate: null,
      updatedAt: '2024-01-10T10:00:00Z',
    };
    const result = computeStreakUpdate(existing, '2024-01-15');
    expect(result.currentStreak).toBe(1);
    expect(result.wasIncremented).toBe(true);
    expect(result.wasReset).toBe(true);
  });
});

// ============================================================
// Pure Logic Tests: daysBetween
// ============================================================

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween('2024-01-15', '2024-01-15')).toBe(0);
  });

  it('returns 1 for consecutive dates', () => {
    expect(daysBetween('2024-01-15', '2024-01-14')).toBe(1);
  });

  it('returns correct days across month boundary', () => {
    expect(daysBetween('2024-02-01', '2024-01-30')).toBe(2);
  });

  it('is symmetric (order does not matter)', () => {
    expect(daysBetween('2024-01-10', '2024-01-15')).toBe(5);
    expect(daysBetween('2024-01-15', '2024-01-10')).toBe(5);
  });
});

// ============================================================
// Handler Integration Tests
// ============================================================

describe('updateStreak handler', () => {
  const validStudentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates streak on first exercise completion', async () => {
    const upsertStreak = vi.fn().mockResolvedValue(undefined);
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(null),
      upsertStreak,
    });
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.currentStreak).toBe(1);
    expect(body.wasIncremented).toBe(true);
    expect(body.wasReset).toBe(false);
    expect(upsertStreak).toHaveBeenCalledWith({
      studentId: validStudentId,
      currentStreak: 1,
      lastActivityDate: '2024-01-15',
      streakResetDate: null,
    });
  });

  it('increments streak on consecutive day', async () => {
    const existing: StreakRecord = {
      studentId: validStudentId,
      currentStreak: 3,
      lastActivityDate: '2024-01-14',
      streakResetDate: null,
      updatedAt: '2024-01-14T10:00:00Z',
    };
    const upsertStreak = vi.fn().mockResolvedValue(undefined);
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(existing),
      upsertStreak,
    });
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.currentStreak).toBe(4);
    expect(body.wasIncremented).toBe(true);
    expect(upsertStreak).toHaveBeenCalledWith({
      studentId: validStudentId,
      currentStreak: 4,
      lastActivityDate: '2024-01-15',
      streakResetDate: null,
    });
  });

  it('does not update when already active today', async () => {
    const existing: StreakRecord = {
      studentId: validStudentId,
      currentStreak: 3,
      lastActivityDate: '2024-01-15',
      streakResetDate: null,
      updatedAt: '2024-01-15T08:00:00Z',
    };
    const upsertStreak = vi.fn().mockResolvedValue(undefined);
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(existing),
      upsertStreak,
    });
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.currentStreak).toBe(3);
    expect(body.wasIncremented).toBe(false);
    expect(upsertStreak).not.toHaveBeenCalled();
  });

  it('resets streak after two consecutive missed days', async () => {
    const existing: StreakRecord = {
      studentId: validStudentId,
      currentStreak: 10,
      lastActivityDate: '2024-01-13',
      streakResetDate: null,
      updatedAt: '2024-01-13T10:00:00Z',
    };
    const upsertStreak = vi.fn().mockResolvedValue(undefined);
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(existing),
      upsertStreak,
    });
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.currentStreak).toBe(1);
    expect(body.wasIncremented).toBe(true);
    expect(body.wasReset).toBe(true);
    expect(upsertStreak).toHaveBeenCalledWith({
      studentId: validStudentId,
      currentStreak: 1,
      lastActivityDate: '2024-01-15',
      streakResetDate: '2024-01-15',
    });
  });

  it('returns 400 when studentId is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(undefined));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when studentId is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent('invalid-id'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('valid UUID');
  });

  it('returns 500 when database throws on read', async () => {
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockRejectedValue(new Error('DB timeout')),
    });
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when database throws on write', async () => {
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(null),
      upsertStreak: vi.fn().mockRejectedValue(new Error('Write failed')),
    });
    const handler = createUpdateStreakHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });
});
