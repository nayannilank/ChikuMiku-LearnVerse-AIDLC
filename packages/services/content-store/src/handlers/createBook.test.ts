/**
 * Unit tests for createBook handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCreateBookHandler } from './createBook';
import type { CreateBookDbClient, CreatedBookRecord } from './createBook';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const VALID_SUBJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_STUDENT_ID = '660e8400-e29b-41d4-a716-446655440000';

function createEvent(
  subjectId?: string,
  body?: Record<string, unknown> | string | null,
  overrides?: Partial<APIGatewayProxyEvent>,
): APIGatewayProxyEvent {
  const bodyStr = body === null ? null : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    body: bodyStr,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: subjectId ? { id: subjectId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: VALID_STUDENT_ID },
      },
    },
    httpMethod: 'POST',
    path: `/subjects/${subjectId ?? ''}/books`,
    resource: '/subjects/{id}/books',
    ...overrides,
  };
}

function createMockDbClient(overrides?: Partial<CreateBookDbClient>): CreateBookDbClient {
  const defaultRecord: CreatedBookRecord = {
    id: 'new-book-id',
    subjectId: VALID_SUBJECT_ID,
    studentId: VALID_STUDENT_ID,
    name: 'Test Book',
    sequenceNumber: 1,
  };
  return {
    createBook: vi.fn().mockResolvedValue(defaultRecord),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('createBook handler', () => {
  it('returns 201 with created book on success', async () => {
    const created: CreatedBookRecord = {
      id: 'book-abc',
      subjectId: VALID_SUBJECT_ID,
      studentId: VALID_STUDENT_ID,
      name: 'Algebra Basics',
      sequenceNumber: 3,
    };
    const dbClient = createMockDbClient({
      createBook: vi.fn().mockResolvedValue(created),
    });
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID, { name: 'Algebra Basics' }));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.book.name).toBe('Algebra Basics');
    expect(body.book.sequenceNumber).toBe(3);
  });

  it('returns 401 when no auth claims present', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(
      createEvent(VALID_SUBJECT_ID, { name: 'Test' }, { requestContext: { authorizer: { claims: {} } } }),
    );

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 400 when subject ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent('bad-id', { name: 'Test' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID, 'not-json{'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_BODY');
  });

  it('returns 400 when name is empty', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID, { name: '' }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('1 and 200');
  });

  it('returns 400 when name is too long (>200 chars)', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const longName = 'A'.repeat(201);
    const result = await handler(createEvent(VALID_SUBJECT_ID, { name: longName }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID, {}));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('trims whitespace from name before saving', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      id: 'id', subjectId: VALID_SUBJECT_ID, studentId: VALID_STUDENT_ID, name: 'Trimmed', sequenceNumber: 1,
    });
    const dbClient = createMockDbClient({ createBook: mockFn });
    const handler = createCreateBookHandler(dbClient);

    await handler(createEvent(VALID_SUBJECT_ID, { name: '  Trimmed  ' }));

    expect(mockFn).toHaveBeenCalledWith(VALID_SUBJECT_ID, VALID_STUDENT_ID, 'Trimmed');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      createBook: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID, { name: 'Test' }));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateBookHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID, { name: 'Test' }));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
