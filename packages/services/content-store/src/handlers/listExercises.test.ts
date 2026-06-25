/**
 * Unit tests for listExercises handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createListExercisesHandler } from './listExercises';
import type { ExerciseDbClient, ExerciseRecord } from './listExercises';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

function createEvent(
  queryParams?: Record<string, string>,
  authenticated = true
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: queryParams ?? null,
    requestContext: {
      authorizer: authenticated
        ? { claims: { sub: 'user-123' } }
        : undefined,
    },
    httpMethod: 'GET',
    path: '/exercises',
    resource: '/exercises',
  };
}

function createMockDbClient(overrides?: Partial<ExerciseDbClient>): ExerciseDbClient {
  return {
    listExercises: vi.fn().mockResolvedValue({ exercises: [], total: 0 }),
    ...overrides,
  };
}

const sampleExercise: ExerciseRecord = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  subjectId: '660e8400-e29b-41d4-a716-446655440001',
  chapterId: '770e8400-e29b-41d4-a716-446655440002',
  exerciseType: 'grammar',
  difficultyLevel: 'medium',
  sequenceNumber: 1,
  content: { question: 'Fill in the blank' },
  correctAnswer: { answer: 'the' },
  explanation: 'Articles are used before nouns',
};

// ============================================================
// Tests
// ============================================================

describe('listExercises handler', () => {
  it('returns 401 when not authenticated', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent(undefined, false));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 200 with empty list when no exercises match', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.exercises).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it('returns 200 with exercises and pagination info', async () => {
    const dbClient = createMockDbClient({
      listExercises: vi.fn().mockResolvedValue({
        exercises: [sampleExercise],
        total: 1,
      }),
    });
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.exercises).toHaveLength(1);
    expect(body.exercises[0].id).toBe(sampleExercise.id);
    expect(body.total).toBe(1);
  });

  it('passes filters to db client', async () => {
    const listFn = vi.fn().mockResolvedValue({ exercises: [], total: 0 });
    const dbClient = createMockDbClient({ listExercises: listFn });
    const handler = createListExercisesHandler(dbClient);

    await handler(
      createEvent({
        subjectId: '660e8400-e29b-41d4-a716-446655440001',
        chapterId: '770e8400-e29b-41d4-a716-446655440002',
        exerciseType: 'grammar',
        difficultyLevel: 'hard',
        limit: '50',
        offset: '10',
      })
    );

    expect(listFn).toHaveBeenCalledWith({
      subjectId: '660e8400-e29b-41d4-a716-446655440001',
      chapterId: '770e8400-e29b-41d4-a716-446655440002',
      exerciseType: 'grammar',
      difficultyLevel: 'hard',
      limit: 50,
      offset: 10,
    });
  });

  it('uses default page size of 20 when not specified', async () => {
    const listFn = vi.fn().mockResolvedValue({ exercises: [], total: 0 });
    const dbClient = createMockDbClient({ listExercises: listFn });
    const handler = createListExercisesHandler(dbClient);

    await handler(createEvent());

    expect(listFn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });

  it('returns 400 when page size exceeds 100', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ limit: '150' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('page size');
  });

  it('returns 400 when page size is zero', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ limit: '0' }));

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when offset is negative', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ offset: '-1' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 for invalid subjectId format', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ subjectId: 'not-a-uuid' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('subjectId');
  });

  it('returns 400 for invalid chapterId format', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ chapterId: 'invalid' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('chapterId');
  });

  it('returns 400 for invalid exercise type', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ exerciseType: 'invalid_type' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('exercise type');
  });

  it('returns 400 for invalid difficulty level', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent({ difficultyLevel: 'extreme' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('difficulty level');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      listExercises: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    });
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createListExercisesHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
  });
});
