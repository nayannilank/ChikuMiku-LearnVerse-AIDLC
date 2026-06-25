/**
 * Unit tests for deleteExercise handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createDeleteExerciseHandler } from './deleteExercise';
import type { DeleteExerciseDbClient } from './deleteExercise';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validExerciseId = '550e8400-e29b-41d4-a716-446655440000';

function createEvent(
  exerciseId: string | undefined,
  authenticated = true
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: exerciseId ? { id: exerciseId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: authenticated
        ? { claims: { sub: 'user-123' } }
        : undefined,
    },
    httpMethod: 'DELETE',
    path: `/exercises/${exerciseId ?? ''}`,
    resource: '/exercises/{id}',
  };
}

function createMockDbClient(overrides?: Partial<DeleteExerciseDbClient>): DeleteExerciseDbClient {
  return {
    deleteExercise: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('deleteExercise handler', () => {
  it('returns 401 when not authenticated', async () => {
    const dbClient = createMockDbClient();
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId, false));

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 204 on successful deletion', async () => {
    const dbClient = createMockDbClient();
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId));

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
  });

  it('returns 400 when exercise ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent('not-a-uuid'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('valid UUID');
  });

  it('returns 400 when exercise ID is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent(undefined));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 404 when exercise not found', async () => {
    const dbClient = createMockDbClient({
      deleteExercise: vi.fn().mockResolvedValue(false),
    });
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      deleteExercise: vi.fn().mockRejectedValue(new Error('Delete failed')),
    });
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createDeleteExerciseHandler(dbClient);

    const result = await handler(createEvent(validExerciseId));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
  });
});
