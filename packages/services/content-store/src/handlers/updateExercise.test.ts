/**
 * Unit tests for updateExercise handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createUpdateExerciseHandler } from './updateExercise';
import type { UpdateExerciseDbClient, ExerciseRecord } from './updateExercise';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validExerciseId = '550e8400-e29b-41d4-a716-446655440000';

const updatedExercise: ExerciseRecord = {
  id: validExerciseId,
  subjectId: '660e8400-e29b-41d4-a716-446655440001',
  chapterId: '770e8400-e29b-41d4-a716-446655440002',
  exerciseType: 'grammar',
  difficultyLevel: 'hard',
  sequenceNumber: 2,
  content: { question: 'Updated question' },
  correctAnswer: { answer: 'Updated' },
  explanation: 'Updated explanation',
};

function createEvent(
  exerciseId: string | undefined,
  body: unknown,
  authenticated = true
): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: exerciseId ? { id: exerciseId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: authenticated
        ? { claims: { sub: 'user-123' } }
        : undefined,
    },
    httpMethod: 'PUT',
    path: `/exercises/${exerciseId ?? ''}`,
    resource: '/exercises/{id}',
  };
}

function createMockDbClient(overrides?: Partial<UpdateExerciseDbClient>): UpdateExerciseDbClient {
  return {
    updateExercise: vi.fn().mockResolvedValue(updatedExercise),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('updateExercise handler', () => {
  it('returns 401 when not authenticated', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { difficultyLevel: 'hard' }, false));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 200 with updated exercise on valid input', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { difficultyLevel: 'hard' }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.id).toBe(validExerciseId);
    expect(body.difficultyLevel).toBe('hard');
  });

  it('returns 400 when exercise ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent('not-a-uuid', { difficultyLevel: 'hard' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('valid UUID');
  });

  it('returns 400 when exercise ID is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(undefined, { difficultyLevel: 'hard' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when body is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, null));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const event = createEvent(validExerciseId, { difficultyLevel: 'hard' });
    event.body = 'not-json{';

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when subjectId is invalid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { subjectId: 'bad-uuid' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const error = body.errors.find((e: { field: string }) => e.field === 'subjectId');
    expect(error).toBeDefined();
  });

  it('returns 400 when exerciseType is invalid', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { exerciseType: 'invalid' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const error = body.errors.find((e: { field: string }) => e.field === 'exerciseType');
    expect(error).toBeDefined();
  });

  it('returns 400 when sequenceNumber is not a positive integer', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { sequenceNumber: 0 }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const error = body.errors.find((e: { field: string }) => e.field === 'sequenceNumber');
    expect(error).toBeDefined();
  });

  it('returns 404 when exercise not found', async () => {
    const dbClient = createMockDbClient({
      updateExercise: vi.fn().mockResolvedValue(null),
    });
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { difficultyLevel: 'easy' }));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('allows setting chapterId to null', async () => {
    const updateFn = vi.fn().mockResolvedValue({ ...updatedExercise, chapterId: null });
    const dbClient = createMockDbClient({ updateExercise: updateFn });
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { chapterId: null }));

    expect(result.statusCode).toBe(200);
    expect(updateFn).toHaveBeenCalledWith(validExerciseId, { chapterId: null });
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      updateExercise: vi.fn().mockRejectedValue(new Error('Update failed')),
    });
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { difficultyLevel: 'hard' }));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createUpdateExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, { difficultyLevel: 'hard' }));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
