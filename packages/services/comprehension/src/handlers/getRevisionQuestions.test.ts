import { describe, it, expect, vi } from 'vitest';
import {
  createGetRevisionQuestionsHandler,
  type GetRevisionDbClient,
} from './getRevisionQuestions';
import type { RevisionQuestion } from './generateRevisionQuestions';
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
    httpMethod: 'GET',
    path: '/chapters/test/revision-questions',
    resource: '/chapters/{id}/revision-questions',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const SAMPLE_QUESTIONS: RevisionQuestion[] = [
  {
    id: `${VALID_CHAPTER_ID}-rev-q-0`,
    chapterId: VALID_CHAPTER_ID,
    questionType: 'mcq',
    questionText: 'What is the capital of Karnataka?',
    options: ['Bangalore', 'Mumbai', 'Chennai', 'Hyderabad'],
    correctAnswer: 'Bangalore',
    explanation: 'Bangalore (Bengaluru) is the capital city of Karnataka.',
  },
  {
    id: `${VALID_CHAPTER_ID}-rev-q-1`,
    chapterId: VALID_CHAPTER_ID,
    questionType: 'short_answer',
    questionText: 'Describe photosynthesis in one sentence.',
    correctAnswer: 'Photosynthesis is the process by which plants convert sunlight into energy.',
    explanation: 'Plants use chlorophyll to absorb light energy.',
  },
  {
    id: `${VALID_CHAPTER_ID}-rev-q-2`,
    chapterId: VALID_CHAPTER_ID,
    questionType: 'fill_blank',
    questionText: 'The process of converting light energy to chemical energy is called ___.',
    correctAnswer: 'photosynthesis',
    explanation: 'Photosynthesis occurs in chloroplasts.',
  },
];

function createMockDbClient(overrides: Partial<GetRevisionDbClient> = {}): GetRevisionDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(true),
    getRevisionQuestions: vi.fn().mockResolvedValue(SAMPLE_QUESTIONS),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('getRevisionQuestions handler', () => {
  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createGetRevisionQuestionsHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid chapter ID format', async () => {
      const handler = createGetRevisionQuestionsHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'invalid-id' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const dbClient = createMockDbClient({
        chapterExists: vi.fn().mockResolvedValue(false),
      });

      const handler = createGetRevisionQuestionsHandler(dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });
  });

  describe('fetching stored questions', () => {
    it('returns stored revision questions with 200', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetRevisionQuestionsHandler(dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.chapterId).toBe(VALID_CHAPTER_ID);
      expect(body.questions).toHaveLength(3);
    });

    it('returns questions with correct structure', async () => {
      const dbClient = createMockDbClient();
      const handler = createGetRevisionQuestionsHandler(dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      const body = JSON.parse(result.body);
      const mcq = body.questions.find((q: RevisionQuestion) => q.questionType === 'mcq');
      expect(mcq).toBeDefined();
      expect(mcq.options).toHaveLength(4);
      expect(mcq.correctAnswer).toBe('Bangalore');
      expect(mcq.explanation).toBeDefined();

      const shortAnswer = body.questions.find((q: RevisionQuestion) => q.questionType === 'short_answer');
      expect(shortAnswer).toBeDefined();
      expect(shortAnswer.options).toBeUndefined();

      const fillBlank = body.questions.find((q: RevisionQuestion) => q.questionType === 'fill_blank');
      expect(fillBlank).toBeDefined();
    });

    it('returns 404 when questions have not been generated', async () => {
      const dbClient = createMockDbClient({
        getRevisionQuestions: vi.fn().mockResolvedValue(null),
      });

      const handler = createGetRevisionQuestionsHandler(dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NOT_GENERATED');
      expect(body.message).toContain('not been generated');
    });

    it('returns 404 when questions array is empty', async () => {
      const dbClient = createMockDbClient({
        getRevisionQuestions: vi.fn().mockResolvedValue([]),
      });

      const handler = createGetRevisionQuestionsHandler(dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NOT_GENERATED');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected database error', async () => {
      const dbClient = createMockDbClient({
        getRevisionQuestions: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      });

      const handler = createGetRevisionQuestionsHandler(dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  describe('CORS headers', () => {
    it('includes CORS headers in success response', async () => {
      const handler = createGetRevisionQuestionsHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('includes CORS headers in error response', async () => {
      const handler = createGetRevisionQuestionsHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
