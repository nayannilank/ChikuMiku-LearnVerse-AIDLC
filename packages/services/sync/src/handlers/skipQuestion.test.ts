/**
 * Unit tests for skipQuestion handler.
 */

import { describe, it, expect, vi } from 'vitest';
import { createSkipQuestionHandler } from './skipQuestion';
import type { SkipQuestionDbClient, QuizSessionRecord } from './skipQuestion';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

const validSessionId = '880e8400-e29b-41d4-a716-446655440005';
const validQuestionId = '770e8400-e29b-41d4-a716-446655440002';
const validQuestionIds = [
  '770e8400-e29b-41d4-a716-446655440002',
  '770e8400-e29b-41d4-a716-446655440003',
  '770e8400-e29b-41d4-a716-446655440004',
];

const activeSession: QuizSessionRecord = {
  id: validSessionId,
  studentId: '550e8400-e29b-41d4-a716-446655440000',
  subjectId: '660e8400-e29b-41d4-a716-446655440001',
  questionIds: validQuestionIds,
  timerDurationSeconds: 300,
  startedAt: '2024-01-15T10:00:00.000Z',
  endedAt: null,
  totalQuestions: 3,
  correctAnswers: 0,
  scorePercentage: null,
  status: 'active',
};

function createEvent(sessionId: string | undefined, body: unknown): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: sessionId ? { id: sessionId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: { claims: { sub: 'auth-user-id' } },
    },
    httpMethod: 'POST',
    path: `/quiz/sessions/${sessionId ?? ''}/skip`,
    resource: '/quiz/sessions/{id}/skip',
  };
}

function createMockDbClient(overrides?: Partial<SkipQuestionDbClient>): SkipQuestionDbClient {
  return {
    getSession: vi.fn().mockResolvedValue(activeSession),
    getAnswer: vi.fn().mockResolvedValue(null),
    saveSkip: vi.fn().mockResolvedValue(undefined),
    getAnsweredCount: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('skipQuestion handler', () => {
  const validBody = { questionId: validQuestionId };

  it('returns 200 with skip confirmation', async () => {
    const dbClient = createMockDbClient();
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.sessionId).toBe(validSessionId);
    expect(body.questionId).toBe(validQuestionId);
    expect(body.skipped).toBe(true);
    expect(body.answeredCount).toBe(1);
    expect(body.totalQuestions).toBe(3);
  });

  it('calls saveSkip with correct parameters', async () => {
    const dbClient = createMockDbClient();
    const handler = createSkipQuestionHandler(dbClient);

    await handler(createEvent(validSessionId, validBody));

    expect(dbClient.saveSkip).toHaveBeenCalledWith({
      sessionId: validSessionId,
      questionId: validQuestionId,
    });
  });

  it('returns 404 when session does not exist', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue(null),
    });
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('returns 409 when session is not active', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockResolvedValue({ ...activeSession, status: 'completed' }),
    });
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('SESSION_NOT_ACTIVE');
  });

  it('returns 400 when question does not belong to session', async () => {
    const dbClient = createMockDbClient();
    const handler = createSkipQuestionHandler(dbClient);

    const otherQuestionId = '990e8400-e29b-41d4-a716-446655440099';
    const result = await handler(createEvent(validSessionId, { questionId: otherQuestionId }));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_QUESTION');
  });

  it('returns 409 when question already answered/skipped', async () => {
    const dbClient = createMockDbClient({
      getAnswer: vi.fn().mockResolvedValue({
        sessionId: validSessionId,
        questionId: validQuestionId,
        selectedOption: null,
        isCorrect: false,
        answeredAt: '2024-01-15T10:01:00.000Z',
      }),
    });
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(409);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('DUPLICATE_ANSWER');
  });

  it('returns 400 when session ID is invalid', async () => {
    const dbClient = createMockDbClient();
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent('not-a-uuid', validBody));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_PARAMETER');
  });

  it('returns 400 when body is missing', async () => {
    const dbClient = createMockDbClient();
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent(validSessionId, null));

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INVALID_REQUEST');
  });

  it('returns 500 when database throws', async () => {
    const dbClient = createMockDbClient({
      getSession: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const handler = createSkipQuestionHandler(dbClient);

    const result = await handler(createEvent(validSessionId, validBody));

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.errorCode).toBe('INTERNAL_ERROR');
  });
});
