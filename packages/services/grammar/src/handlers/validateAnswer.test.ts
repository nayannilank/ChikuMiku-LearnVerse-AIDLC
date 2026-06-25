import { describe, it, expect, vi } from 'vitest';
import {
  createValidateAnswerHandler,
  buildFeedbackCacheKey,
  computeSimpleHash,
  parseFeedbackResponse,
  type ValidateAnswerAIGatewayClient,
  type ValidateAnswerDbClient,
} from './validateAnswer';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Test Helpers
// ============================================================

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {},
    httpMethod: 'POST',
    path: '/grammar/exercises/test/validate',
    resource: '/grammar/exercises/{id}/validate',
    ...overrides,
  };
}

const VALID_EXERCISE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const MOCK_GRAMMAR_EXERCISE = {
  id: VALID_EXERCISE_ID,
  subjectId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  chapterId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  exerciseType: 'grammar' as const,
  content: {
    sentence: 'She ___ to the market every day.',
    options: ['go', 'goes', 'going', 'gone'],
    grammarRule: 'subject-verb agreement',
    instruction: 'Choose the correct verb form.',
  },
  correctAnswer: {
    answer: 'goes',
    optionIndex: 1,
  },
  explanation: 'With third-person singular subjects, use "goes" instead of "go".',
};

function createMockAIGateway(options?: {
  feedbackResult?: Record<string, unknown>;
  cached?: boolean;
}): ValidateAnswerAIGatewayClient {
  const {
    feedbackResult = {
      text: JSON.stringify({
        feedback:
          'The correct answer is "goes". With third-person singular subjects like "she", we use the verb form with "-es". This is the subject-verb agreement rule.',
      }),
    },
    cached = false,
  } = options ?? {};

  return {
    process: vi.fn().mockResolvedValue({
      cached,
      data: feedbackResult,
    }),
  };
}

function createMockDbClient(options?: {
  exercise?: typeof MOCK_GRAMMAR_EXERCISE | null;
}): ValidateAnswerDbClient {
  const { exercise = MOCK_GRAMMAR_EXERCISE } = options ?? {};

  return {
    getGrammarExercise: vi.fn().mockResolvedValue(exercise),
  };
}

// ============================================================
// Unit Tests
// ============================================================

describe('validateAnswer handler', () => {
  describe('helper functions', () => {
    it('computeSimpleHash returns deterministic hash', () => {
      const hash1 = computeSimpleHash('hello world');
      const hash2 = computeSimpleHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('computeSimpleHash returns different hashes for different inputs', () => {
      const hash1 = computeSimpleHash('goes');
      const hash2 = computeSimpleHash('go');
      expect(hash1).not.toBe(hash2);
    });

    it('buildFeedbackCacheKey normalizes input', () => {
      const key1 = buildFeedbackCacheKey('ex-1', 'Goes');
      const key2 = buildFeedbackCacheKey('ex-1', 'goes');
      expect(key1).toBe(key2);
    });

    it('buildFeedbackCacheKey includes exercise ID', () => {
      const key = buildFeedbackCacheKey('exercise-123', 'go');
      expect(key).toContain('grammar:exercise-123:feedback:');
    });
  });

  describe('parseFeedbackResponse', () => {
    it('parses JSON text response with feedback field', () => {
      const data = {
        text: JSON.stringify({
          feedback: 'Use "goes" because the subject is singular.',
        }),
      };
      const result = parseFeedbackResponse(data, 'goes', 'subject-verb agreement');
      expect(result).toBe('Use "goes" because the subject is singular.');
    });

    it('uses plain text when text field is not JSON', () => {
      const data = {
        text: 'The correct form is "goes" for third-person singular.',
      };
      const result = parseFeedbackResponse(data, 'goes', 'subject-verb agreement');
      expect(result).toBe('The correct form is "goes" for third-person singular.');
    });

    it('uses direct feedback field from data object', () => {
      const data = {
        feedback: 'Subject-verb agreement requires "goes" here.',
      };
      const result = parseFeedbackResponse(data, 'goes', 'subject-verb agreement');
      expect(result).toBe('Subject-verb agreement requires "goes" here.');
    });

    it('returns fallback when no feedback is parseable', () => {
      const result = parseFeedbackResponse({}, 'goes', 'subject-verb agreement');
      expect(result).toContain('goes');
      expect(result).toContain('subject-verb agreement');
    });

    it('ignores empty text field', () => {
      const data = { text: '   ' };
      const result = parseFeedbackResponse(data, 'goes', 'subject-verb agreement');
      expect(result).toContain('goes');
      expect(result).toContain('subject-verb agreement');
    });

    it('ignores empty feedback field', () => {
      const data = { feedback: '' };
      const result = parseFeedbackResponse(data, 'goes', 'subject-verb agreement');
      expect(result).toContain('goes');
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing exercise ID', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('exercise ID');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: VALID_EXERCISE_ID }, body: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_BODY');
    });

    it('returns 400 for invalid JSON body', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: 'not json',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('returns 400 for missing selectedAnswer field', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({}),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELD');
    });

    it('returns 400 for empty selectedAnswer', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: '   ' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELD');
    });
  });

  describe('exercise lookup', () => {
    it('returns 404 when exercise does not exist', async () => {
      const handler = createValidateAnswerHandler(
        createMockAIGateway(),
        createMockDbClient({ exercise: null }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'goes' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('EXERCISE_NOT_FOUND');
    });

    it('returns 400 when exercise is not grammar type', async () => {
      const nonGrammarExercise = {
        ...MOCK_GRAMMAR_EXERCISE,
        exerciseType: 'quiz',
      };
      const handler = createValidateAnswerHandler(
        createMockAIGateway(),
        createMockDbClient({ exercise: nonGrammarExercise as unknown as typeof MOCK_GRAMMAR_EXERCISE }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'goes' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_EXERCISE_TYPE');
    });
  });

  describe('correct answer (Requirement 13.5)', () => {
    it('returns isCorrect=true with success feedback for correct answer', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createValidateAnswerHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'goes' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.isCorrect).toBe(true);
      expect(body.correctAnswer).toBe('goes');
      expect(body.feedback).toContain('Correct');
      expect(body.grammarRule).toBe('subject-verb agreement');
    });

    it('matches answer case-insensitively', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'Goes' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.isCorrect).toBe(true);
    });

    it('does not call AI Gateway for correct answers', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createValidateAnswerHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'goes' }),
      });
      await handler(event);

      expect(aiGateway.process).not.toHaveBeenCalled();
    });

    it('feedback references the grammar rule for correct answers', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'goes' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.feedback).toContain('subject-verb agreement');
    });
  });

  describe('incorrect answer (Requirements 13.6, 13.7)', () => {
    it('returns isCorrect=false with explanatory feedback for incorrect answer', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createValidateAnswerHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'go' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.isCorrect).toBe(false);
      expect(body.correctAnswer).toBe('goes');
      expect(body.feedback).toContain('subject-verb agreement');
      expect(body.grammarRule).toBe('subject-verb agreement');
    });

    it('calls AI Gateway with correct prompt for feedback generation', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createValidateAnswerHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'go' }),
      });
      await handler(event);

      expect(aiGateway.process).toHaveBeenCalledTimes(1);
      const call = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.serviceType).toBe('text_generation');
      expect(call.payload.model).toBe('gpt-5-mini');

      const messages = call.payload.messages as Array<{ role: string; content: string }>;
      const systemMessage = messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('subject-verb agreement');

      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('She ___ to the market every day.');
      expect(userMessage?.content).toContain('"go"');
      expect(userMessage?.content).toContain('"goes"');
    });

    it('returns correct answer highlighted in response', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'going' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.correctAnswer).toBe('goes');
    });

    it('feedback references the grammar rule being tested', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'go' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.grammarRule).toBe('subject-verb agreement');
      // Feedback from AI also references the rule
      expect(body.feedback).toContain('subject-verb agreement');
    });

    it('returns cached=true when feedback was served from cache', async () => {
      const aiGateway = createMockAIGateway({ cached: true });
      const handler = createValidateAnswerHandler(aiGateway, createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'go' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.cached).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 500 when AI Gateway throws an error', async () => {
      const aiGateway: ValidateAnswerAIGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('Service unavailable')),
      };
      const dbClient = createMockDbClient();
      const handler = createValidateAnswerHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'go' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when database throws an error', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient: ValidateAnswerDbClient = {
        getGrammarExercise: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };
      const handler = createValidateAnswerHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ selectedAnswer: 'goes' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('includes CORS headers on all responses', async () => {
      const handler = createValidateAnswerHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'bad-id' } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });
  });
});
