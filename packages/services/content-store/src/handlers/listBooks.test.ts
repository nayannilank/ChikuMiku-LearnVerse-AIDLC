/**
 * Unit tests for listBooks handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createListBooksHandler } from './listBooks';
import type { ListBooksDbClient, BookRecord } from './listBooks';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const VALID_SUBJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_STUDENT_ID = '660e8400-e29b-41d4-a716-446655440000';

function createEvent(
  subjectId?: string,
  overrides?: Partial<APIGatewayProxyEvent>,
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: subjectId ? { id: subjectId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: VALID_STUDENT_ID },
      },
    },
    httpMethod: 'GET',
    path: `/subjects/${subjectId ?? ''}/books`,
    resource: '/subjects/{id}/books',
    ...overrides,
  };
}

function createMockDbClient(overrides?: Partial<ListBooksDbClient>): ListBooksDbClient {
  return {
    getBooksForSubject: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('listBooks handler', () => {
  it('returns 200 with books for a subject', async () => {
    const books: BookRecord[] = [
      { id: 'b1', subjectId: VALID_SUBJECT_ID, name: 'Algebra', sequenceNumber: 1, chapterCount: 5 },
      { id: 'b2', subjectId: VALID_SUBJECT_ID, name: 'Geometry', sequenceNumber: 2, chapterCount: 3 },
    ];
    const dbClient = createMockDbClient({
      getBooksForSubject: vi.fn().mockResolvedValue(books),
    });
    const handler = createListBooksHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.books).toHaveLength(2);
    expect(body.books[0].name).toBe('Algebra');
    expect(body.books[0].chapterCount).toBe(5);
  });

  it('returns 200 with empty array when no books exist', async () => {
    const dbClient = createMockDbClient();
    const handler = createListBooksHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.books).toEqual([]);
  });

  it('returns 401 when no auth claims present', async () => {
    const dbClient = createMockDbClient();
    const handler = createListBooksHandler(dbClient);

    const result = await handler(
      createEvent(VALID_SUBJECT_ID, { requestContext: { authorizer: { claims: {} } } }),
    );

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 400 when subject ID is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createListBooksHandler(dbClient);

    const result = await handler(createEvent(undefined));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when subject ID is not a valid UUID', async () => {
    const dbClient = createMockDbClient();
    const handler = createListBooksHandler(dbClient);

    const result = await handler(createEvent('not-a-uuid'));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
    expect(body.message).toContain('valid UUID');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getBooksForSubject: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createListBooksHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createListBooksHandler(dbClient);

    const result = await handler(createEvent(VALID_SUBJECT_ID));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });

  it('passes correct subjectId and studentId to db client', async () => {
    const mockFn = vi.fn().mockResolvedValue([]);
    const dbClient = createMockDbClient({ getBooksForSubject: mockFn });
    const handler = createListBooksHandler(dbClient);

    await handler(createEvent(VALID_SUBJECT_ID));

    expect(mockFn).toHaveBeenCalledWith(VALID_SUBJECT_ID, VALID_STUDENT_ID);
  });
});
