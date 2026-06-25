/**
 * Unit tests for getProgress handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createGetProgressHandler } from './getProgress';
import type { ProgressDbClient, SubjectProgress, StreakData, RecentActivity } from './getProgress';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validStudentId = '550e8400-e29b-41d4-a716-446655440000';
const validSubjectId = '660e8400-e29b-41d4-a716-446655440001';

function createEvent(
  studentId: string | undefined,
  authenticated = true,
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    pathParameters: studentId ? { studentId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: authenticated ? { claims: { sub: validStudentId } } : undefined,
    },
    httpMethod: 'GET',
    path: `/progress/${studentId ?? ''}`,
    resource: '/progress/{studentId}',
  };
}

function createMockDbClient(overrides?: Partial<ProgressDbClient>): ProgressDbClient {
  const defaultSubjects: SubjectProgress[] = [
    { subjectId: validSubjectId, completedExercises: 5, totalExercises: 20, progressPercentage: 25 },
  ];

  const defaultStreak: StreakData = {
    currentStreak: 3,
    lastActivityDate: '2024-01-15',
  };

  const defaultRecentActivity: RecentActivity[] = [
    {
      id: '880e8400-e29b-41d4-a716-446655440005',
      exerciseId: '990e8400-e29b-41d4-a716-446655440006',
      subjectId: validSubjectId,
      isCorrect: true,
      score: 85,
      completedAt: '2024-01-15T10:30:00.000Z',
    },
  ];

  return {
    getSubjectProgress: vi.fn().mockResolvedValue(defaultSubjects),
    getStreak: vi.fn().mockResolvedValue(defaultStreak),
    getRecentActivity: vi.fn().mockResolvedValue(defaultRecentActivity),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('getProgress handler', () => {
  it('returns 200 with progress data for valid studentId', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.studentId).toBe(validStudentId);
    expect(body.subjects).toHaveLength(1);
    expect(body.subjects[0].subjectId).toBe(validSubjectId);
    expect(body.subjects[0].progressPercentage).toBe(25);
    expect(body.streak.currentStreak).toBe(3);
    expect(body.recentActivity).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(validStudentId, false));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 400 when studentId is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(undefined));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when studentId is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent('not-a-uuid'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('UUID');
  });

  it('returns default streak when no streak record exists', async () => {
    const dbClient = createMockDbClient({
      getStreak: vi.fn().mockResolvedValue(null),
    });
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.streak.currentStreak).toBe(0);
    expect(body.streak.lastActivityDate).toBeNull();
  });

  it('returns empty arrays when no progress data exists', async () => {
    const dbClient = createMockDbClient({
      getSubjectProgress: vi.fn().mockResolvedValue([]),
      getRecentActivity: vi.fn().mockResolvedValue([]),
    });
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.subjects).toEqual([]);
    expect(body.recentActivity).toEqual([]);
  });

  it('fetches recent activity with limit of 10', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetProgressHandler(dbClient);

    await handler(createEvent(validStudentId));

    expect(dbClient.getRecentActivity).toHaveBeenCalledWith(validStudentId, 10);
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getSubjectProgress: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createGetProgressHandler(dbClient);

    const result = await handler(createEvent(validStudentId));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
