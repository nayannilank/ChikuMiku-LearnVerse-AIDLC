/**
 * Unit tests for listSubjects handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createListSubjectsHandler } from './listSubjects';
import type { ListSubjectsDbClient, SubjectRecord } from './listSubjects';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

function createEvent(overrides?: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: '550e8400-e29b-41d4-a716-446655440000' },
      },
    },
    httpMethod: 'GET',
    path: '/subjects',
    resource: '/subjects',
    ...overrides,
  };
}

function createMockDbClient(overrides?: Partial<ListSubjectsDbClient>): ListSubjectsDbClient {
  return {
    getSubjectsForStudent: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('listSubjects handler', () => {
  it('returns 200 with subjects for authenticated student', async () => {
    const subjects: SubjectRecord[] = [
      { id: 'aaa-111', name: 'Math', isDefault: true, color: '#FF0000', iconName: 'calculator' },
      { id: 'bbb-222', name: 'Science', isDefault: false, color: '#00FF00', iconName: 'flask' },
    ];
    const dbClient = createMockDbClient({
      getSubjectsForStudent: vi.fn().mockResolvedValue(subjects),
    });
    const handler = createListSubjectsHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.subjects).toHaveLength(2);
    expect(body.subjects[0].name).toBe('Math');
    expect(body.subjects[1].name).toBe('Science');
  });

  it('returns 200 with empty array when no subjects assigned', async () => {
    const dbClient = createMockDbClient();
    const handler = createListSubjectsHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.subjects).toEqual([]);
  });

  it('returns 401 when no auth claims present', async () => {
    const dbClient = createMockDbClient();
    const handler = createListSubjectsHandler(dbClient);

    const result = await handler(
      createEvent({ requestContext: { authorizer: { claims: {} } } }),
    );

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('returns 401 when authorizer is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createListSubjectsHandler(dbClient);

    const result = await handler(createEvent({ requestContext: {} }));

    expect(result.statusCode).toBe(401);
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getSubjectsForStudent: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createListSubjectsHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createListSubjectsHandler(dbClient);

    const result = await handler(createEvent());

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
    expect(result.headers?.['Access-Control-Allow-Methods']).toBe('GET,POST,PUT,DELETE,OPTIONS');
  });

  it('passes correct studentId to db client', async () => {
    const mockFn = vi.fn().mockResolvedValue([]);
    const dbClient = createMockDbClient({ getSubjectsForStudent: mockFn });
    const handler = createListSubjectsHandler(dbClient);

    await handler(createEvent());

    expect(mockFn).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
  });
});
