/**
 * Unit tests for createQuizSession handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCreateQuizSessionHandler } from './createQuizSession';
import type { QuizSessionDbClient, QuizSessionRecord } from './createQuizSession';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validStudentId = '550e8400-e29b-41d4-a716-446655440000';
const validSubjectId = '660e8400-e29b-41d4-a716-446655440001';
const validQuestionIds = [
  '770e8400-e29b-41d4-a716-446655440002',
  '770e8400-e29b-41d4-a716-446655440003',
  '770e8400-e29b-41d4-a716-446655440004',
];

function createEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: { claims: { sub: validStudentId } },
    },
    httpMethod: 'POST',
    path: '/quiz/sessions',
    resource: '/quiz/sessions',
  };
}

function createMockDbClient(overrides?: Partial<QuizSessionDbClient>): QuizSessionDbClient {
  const defaultSession: QuizSessionRecord = {
    id: '880e8400-e29b-41d4-a716-446655440005',
    studentId: validStudentId,
    subjectId: validSubjectId,
    questionIds: validQuestionIds,
    timerDurationSeconds: 300,
    startedAt: '2024-01-15T10:00:00.000Z',
    endedAt: null,
    totalQuestions: 3,
    correctAnswers: 0,
    scorePercentage: null,
    status: 'active',
  };

  return {
    createSession: vi.fn().mockResolvedValue(defaultSession),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('createQuizSession handler', () => {
  const validBody = {
    studentId: validStudentId,
    subjectId: validSubjectId,
    questionIds: validQuestionIds,
    timerDurationSeconds: 300,
  };

  it('returns 201 with session data on valid request', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent(validBody));

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.id).toBeDefined();
    expect(body.studentId).toBe(validStudentId);
    expect(body.subjectId).toBe(validSubjectId);
    expect(body.questionIds).toEqual(validQuestionIds);
    expect(body.totalQuestions).toBe(3);
    expect(body.status).toBe('active');
  });

  it('calls createSession with correct parameters', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    await handler(createEvent(validBody));

    expect(dbClient.createSession).toHaveBeenCalledWith({
      studentId: validStudentId,
      subjectId: validSubjectId,
      questionIds: validQuestionIds,
      timerDurationSeconds: 300,
    });
  });

  it('returns 400 when body is null', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent(null));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const event = createEvent(null);
    event.body = 'not-json';
    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('returns 400 when studentId is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent({ ...validBody, studentId: undefined }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('studentId');
  });

  it('returns 400 when questionIds is empty', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent({ ...validBody, questionIds: [] }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('questionIds');
  });

  it('returns 400 when timerDurationSeconds is below 30', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent({ ...validBody, timerDurationSeconds: 10 }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('timerDurationSeconds');
  });

  it('returns 400 when timerDurationSeconds exceeds 3600', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent({ ...validBody, timerDurationSeconds: 5000 }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      createSession: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent(validBody));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });

  it('includes CORS headers in response', async () => {
    const dbClient = createMockDbClient();
    const handler = createCreateQuizSessionHandler(dbClient);

    const result = await handler(createEvent(validBody));

    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers?.['Content-Type']).toBe('application/json');
  });
});
