/**
 * Unit tests for createExercise handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCreateExerciseHandler } from './createExercise';
import type { CreateExerciseDbClient, ExerciseRecord } from './createExercise';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validInput = {
  subjectId: '660e8400-e29b-41d4-a716-446655440001',
  chapterId: '770e8400-e29b-41d4-a716-446655440002',
  exerciseType: 'grammar',
  difficultyLevel: 'medium',
  sequenceNumber: 1,
  content: { question: 'Fill in the blank: ___ cat sat on the mat.' },
  correctAnswer: { answer: 'The' },
  explanation: 'Use "The" as a definite article before a noun.',
};

const createdExercise: ExerciseRecord = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  subjectId: validInput.subjectId,
  chapterId: validInput.chapterId,
  exerciseType: 'grammar',
  difficultyLevel: 'medium',
  sequenceNumber: 1,
  content: validInput.content,
  correctAnswer: validInput.correctAnswer,
  explanation: validInput.explanation,
};

function createEvent(
  body: unknown,
  authenticated = true
): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: authenticated
        ? { claims: { sub: 'user-123' } }
        : undefined,
    },
    httpMethod: 'POST',
    path: '/exercises',
    resource: '/exercises',
  };
}

function createMockDbClient(overrides?: Partial<CreateExerciseDbClient>): CreateExerciseDbClient {
  return {
    createExercise: vi.fn().mockResolvedValue(createdExercise),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('createExercise handler', () => {
  it('returns 401 when not authenticated', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent(validInput, false));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 201 with created exercise on valid input', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent(validInput));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.id).toBe(createdExercise.id);
    expect(body.subjectId).toBe(validInput.subjectId);
    expect(body.exerciseType).toBe('grammar');
  });

  it('returns 400 when body is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent(null));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const event = createEvent(validInput);
    event.body = 'not-json{';

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.errors[0].message).toContain('Invalid JSON');
  });

  it('returns 400 with field-specific errors when required fields are missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({}));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.errors.length).toBeGreaterThan(0);

    const fieldNames = body.errors.map((e: { field: string }) => e.field);
    expect(fieldNames).toContain('subjectId');
    expect(fieldNames).toContain('exerciseType');
    expect(fieldNames).toContain('difficultyLevel');
    expect(fieldNames).toContain('sequenceNumber');
    expect(fieldNames).toContain('content');
    expect(fieldNames).toContain('correctAnswer');
  });

  it('returns 400 when subjectId is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({ ...validInput, subjectId: 'invalid' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const subjectError = body.errors.find((e: { field: string }) => e.field === 'subjectId');
    expect(subjectError).toBeDefined();
    expect(subjectError.message).toContain('valid UUID');
  });

  it('returns 400 when exerciseType is invalid', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({ ...validInput, exerciseType: 'unknown' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const typeError = body.errors.find((e: { field: string }) => e.field === 'exerciseType');
    expect(typeError).toBeDefined();
  });

  it('returns 400 when difficultyLevel is invalid', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({ ...validInput, difficultyLevel: 'extreme' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const levelError = body.errors.find((e: { field: string }) => e.field === 'difficultyLevel');
    expect(levelError).toBeDefined();
  });

  it('returns 400 when sequenceNumber is not a positive integer', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({ ...validInput, sequenceNumber: -1 }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const seqError = body.errors.find((e: { field: string }) => e.field === 'sequenceNumber');
    expect(seqError).toBeDefined();
    expect(seqError.message).toContain('positive integer');
  });

  it('returns 400 when content is not an object', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({ ...validInput, content: 'string-value' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    const contentError = body.errors.find((e: { field: string }) => e.field === 'content');
    expect(contentError).toBeDefined();
  });

  it('allows chapterId to be null', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent({ ...validInput, chapterId: null }));

    expect(result.statusCode).toBe(201);
  });

  it('allows chapterId to be omitted', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const { chapterId: _, ...inputWithoutChapter } = validInput;
    const result = await handler(createEvent(inputWithoutChapter));

    expect(result.statusCode).toBe(201);
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      createExercise: vi.fn().mockRejectedValue(new Error('Insert failed')),
    });
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent(validInput));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateExerciseHandler(dbClient);

    const result = await handler(createEvent(validInput));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
