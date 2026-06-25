/**
 * Unit tests for recordExerciseResult handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createRecordExerciseResultHandler } from './recordExerciseResult';
import type { ExerciseResultDbClient, ExerciseResultRecord } from './recordExerciseResult';
import type { StreakRecord } from './updateStreak';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validStudentId = '550e8400-e29b-41d4-a716-446655440000';
const validExerciseId = '660e8400-e29b-41d4-a716-446655440001';
const validSubjectId = '770e8400-e29b-41d4-a716-446655440002';

function createEvent(
  studentId: string | undefined,
  body: unknown,
  authenticated = true,
): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: studentId ? { studentId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: authenticated ? { claims: { sub: validStudentId } } : undefined,
    },
    httpMethod: 'POST',
    path: `/progress/${studentId ?? ''}/exercise-result`,
    resource: '/progress/{studentId}/exercise-result',
  };
}

const validBody = {
  exerciseId: validExerciseId,
  subjectId: validSubjectId,
  isCorrect: true,
  score: 85.5,
  answerGiven: { selectedOption: 'B' },
};

function createMockDbClient(overrides?: Partial<ExerciseResultDbClient>): ExerciseResultDbClient {
  const defaultResult: ExerciseResultRecord = {
    id: '880e8400-e29b-41d4-a716-446655440005',
    studentId: validStudentId,
    exerciseId: validExerciseId,
    subjectId: validSubjectId,
    isCorrect: true,
    score: 85.5,
    answerGiven: { selectedOption: 'B' },
    completedAt: '2024-01-15T10:30:00.000Z',
  };

  const defaultStreak: StreakRecord = {
    studentId: validStudentId,
    currentStreak: 3,
    lastActivityDate: '2024-01-14',
    streakResetDate: null,
    updatedAt: '2024-01-14T10:00:00.000Z',
  };

  return {
    insertExerciseResult: vi.fn().mockResolvedValue(defaultResult),
    getProgressForSubject: vi.fn().mockResolvedValue({ completedExercises: 5, totalExercises: 20 }),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    getStreak: vi.fn().mockResolvedValue(defaultStreak),
    upsertStreak: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('recordExerciseResult handler', () => {
  it('returns 201 with result on valid request', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.result.studentId).toBe(validStudentId);
    expect(body.result.exerciseId).toBe(validExerciseId);
    expect(body.result.isCorrect).toBe(true);
    expect(body.progressUpdate).toBeDefined();
    expect(body.streakUpdate).toBeDefined();
  });

  it('returns 401 when not authenticated', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody, false));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 400 when studentId is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(undefined, validBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when studentId is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent('invalid-id', validBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when body is null', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, null));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const event = createEvent(validStudentId, null);
    event.body = 'not-json';
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('returns 400 when exerciseId is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, { ...validBody, exerciseId: undefined }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('exerciseId');
  });

  it('returns 400 when subjectId is invalid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, { ...validBody, subjectId: 'bad' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('subjectId');
  });

  it('returns 400 when isCorrect is not a boolean', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, { ...validBody, isCorrect: 'yes' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('isCorrect');
  });

  it('returns 400 when score is out of range', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, { ...validBody, score: 150 }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('score');
  });

  it('returns 400 when answerGiven is undefined', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, { ...validBody, answerGiven: undefined }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('answerGiven');
  });

  it('correctly calculates progress percentage', async () => {
    const dbClient = createMockDbClient({
      getProgressForSubject: vi.fn().mockResolvedValue({ completedExercises: 9, totalExercises: 20 }),
    });
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    // (9+1)/20 * 100 = 50
    expect(body.progressUpdate.completedExercises).toBe(10);
    expect(body.progressUpdate.totalExercises).toBe(20);
    expect(body.progressUpdate.progressPercentage).toBe(50);
  });

  it('clamps progress percentage to 100', async () => {
    const dbClient = createMockDbClient({
      getProgressForSubject: vi.fn().mockResolvedValue({ completedExercises: 20, totalExercises: 20 }),
    });
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    // (20+1)/20 = 105% -> clamped to 100
    expect(body.progressUpdate.progressPercentage).toBe(100);
  });

  it('handles first exercise when no progress record exists', async () => {
    const dbClient = createMockDbClient({
      getProgressForSubject: vi.fn().mockResolvedValue(null),
    });
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    // First exercise: (0+1)/1 * 100 = 100
    expect(body.progressUpdate.completedExercises).toBe(1);
    expect(body.progressUpdate.totalExercises).toBe(1);
    expect(body.progressUpdate.progressPercentage).toBe(100);
  });

  it('triggers streak update', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.streakUpdate.currentStreak).toBeGreaterThanOrEqual(1);
    expect(body.streakUpdate.lastActivityDate).toBeDefined();
    expect(dbClient.getStreak).toHaveBeenCalledWith(validStudentId);
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      insertExerciseResult: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createRecordExerciseResultHandler(dbClient);

    const result = await handler(createEvent(validStudentId, validBody));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
