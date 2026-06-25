import { describe, it, expect, vi } from 'vitest';
import {
  createGenerateRevisionQuestionsHandler,
  buildRevisionCacheKey,
  computeRevisionRequestHash,
  parseRevisionAiResponse,
  type RevisionAiGatewayClient,
  type RevisionDbClient,
  type RevisionQuestion,
} from './generateRevisionQuestions';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import type { AIGatewayResponse } from '@learnverse/service-ai-gateway';

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

function createMockAiGateway(
  response?: AIGatewayResponse,
  shouldFail = false,
): RevisionAiGatewayClient {
  const defaultResponse: AIGatewayResponse = {
    cached: false,
    data: {
      questions: [
        {
          questionType: 'mcq',
          questionText: 'What is the capital of Karnataka?',
          options: ['Bangalore', 'Mumbai', 'Chennai', 'Hyderabad'],
          correctAnswer: 'Bangalore',
          explanation: 'Bangalore (Bengaluru) is the capital city of Karnataka.',
        },
        {
          questionType: 'short_answer',
          questionText: 'Describe photosynthesis in one sentence.',
          correctAnswer: 'Photosynthesis is the process by which plants convert sunlight into energy.',
          explanation: 'Plants use chlorophyll to absorb light energy.',
        },
        {
          questionType: 'fill_blank',
          questionText: 'The process of converting light energy to chemical energy is called ___.',
          correctAnswer: 'photosynthesis',
          explanation: 'Photosynthesis occurs in chloroplasts.',
        },
      ],
    },
  };

  return {
    process: shouldFail
      ? vi.fn().mockRejectedValue(new Error('AI service unavailable'))
      : vi.fn().mockResolvedValue(response ?? defaultResponse),
  };
}

function createMockDbClient(overrides: Partial<RevisionDbClient> = {}): RevisionDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(true),
    getChapterContent: vi.fn().mockResolvedValue('This is the chapter content about Karnataka and photosynthesis.'),
    getRevisionQuestions: vi.fn().mockResolvedValue(null),
    saveRevisionQuestions: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('generateRevisionQuestions handler', () => {
  describe('buildRevisionCacheKey', () => {
    it('builds correct cache key pattern', () => {
      expect(buildRevisionCacheKey('chapter-123')).toBe('chapter:chapter-123:revision-questions');
    });

    it('uses the chapter ID in the key', () => {
      expect(buildRevisionCacheKey(VALID_CHAPTER_ID)).toBe(`chapter:${VALID_CHAPTER_ID}:revision-questions`);
    });
  });

  describe('computeRevisionRequestHash', () => {
    it('produces consistent hash for same payload', () => {
      const payload = { chapterId: '123', content: 'test' };
      const hash1 = computeRevisionRequestHash(payload);
      const hash2 = computeRevisionRequestHash(payload);
      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different payloads', () => {
      const hash1 = computeRevisionRequestHash({ chapterId: '123' });
      const hash2 = computeRevisionRequestHash({ chapterId: '456' });
      expect(hash1).not.toBe(hash2);
    });

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = computeRevisionRequestHash({ test: 'data' });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('parseRevisionAiResponse', () => {
    it('parses questions from AI response data', () => {
      const data = {
        questions: [
          {
            questionType: 'mcq',
            questionText: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
            explanation: 'Because A is correct.',
          },
        ],
      };

      const result = parseRevisionAiResponse(VALID_CHAPTER_ID, data);
      expect(result).toHaveLength(1);
      expect(result[0].chapterId).toBe(VALID_CHAPTER_ID);
      expect(result[0].questionType).toBe('mcq');
      expect(result[0].options).toEqual(['A', 'B', 'C', 'D']);
    });

    it('returns empty array when no questions in response', () => {
      expect(parseRevisionAiResponse(VALID_CHAPTER_ID, {})).toEqual([]);
      expect(parseRevisionAiResponse(VALID_CHAPTER_ID, { questions: 'not-array' })).toEqual([]);
    });

    it('defaults unknown question type to short_answer', () => {
      const data = {
        questions: [
          {
            questionType: 'unknown_type',
            questionText: 'Test?',
            correctAnswer: 'Answer',
            explanation: 'Explanation',
          },
        ],
      };

      const result = parseRevisionAiResponse(VALID_CHAPTER_ID, data);
      expect(result[0].questionType).toBe('short_answer');
    });

    it('does not include options for non-MCQ questions', () => {
      const data = {
        questions: [
          {
            questionType: 'short_answer',
            questionText: 'Test?',
            correctAnswer: 'Answer',
            explanation: 'Explanation',
          },
        ],
      };

      const result = parseRevisionAiResponse(VALID_CHAPTER_ID, data);
      expect(result[0].options).toBeUndefined();
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createGenerateRevisionQuestionsHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid chapter ID format', async () => {
      const handler = createGenerateRevisionQuestionsHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const dbClient = createMockDbClient({
        chapterExists: vi.fn().mockResolvedValue(false),
      });

      const handler = createGenerateRevisionQuestionsHandler(
        createMockAiGateway(),
        dbClient,
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 when chapter has no content', async () => {
      const dbClient = createMockDbClient({
        getChapterContent: vi.fn().mockResolvedValue(null),
      });

      const handler = createGenerateRevisionQuestionsHandler(
        createMockAiGateway(),
        dbClient,
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_CONTENT');
    });

    it('returns 400 when chapter content is empty', async () => {
      const dbClient = createMockDbClient({
        getChapterContent: vi.fn().mockResolvedValue('   '),
      });

      const handler = createGenerateRevisionQuestionsHandler(
        createMockAiGateway(),
        dbClient,
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_CONTENT');
    });
  });

  describe('generate-once-store-permanently pattern', () => {
    it('returns cached questions without calling AI gateway', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient({
        getRevisionQuestions: vi.fn().mockResolvedValue(SAMPLE_QUESTIONS),
      });

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.cached).toBe(true);
      expect(body.questions).toHaveLength(3);
      // AI Gateway should not have been called
      expect(aiGateway.process).not.toHaveBeenCalled();
    });

    it('calls AI gateway when no cached questions exist', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(aiGateway.process).toHaveBeenCalledTimes(1);
    });

    it('stores generated questions in the database', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      expect(dbClient.saveRevisionQuestions).toHaveBeenCalledTimes(1);
      expect(dbClient.saveRevisionQuestions).toHaveBeenCalledWith(
        VALID_CHAPTER_ID,
        expect.arrayContaining([
          expect.objectContaining({ chapterId: VALID_CHAPTER_ID }),
        ]),
      );
    });
  });

  describe('successful generation', () => {
    it('generates MCQs, short answer, and fill-in-the-blank questions', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.chapterId).toBe(VALID_CHAPTER_ID);

      const types = body.questions.map((q: RevisionQuestion) => q.questionType);
      expect(types).toContain('mcq');
      expect(types).toContain('short_answer');
      expect(types).toContain('fill_blank');
    });

    it('sends correct AI Gateway request with serviceType revision', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      expect(aiGateway.process).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: `chapter:${VALID_CHAPTER_ID}:revision-questions`,
          serviceType: 'revision',
          requestHash: expect.any(String),
          payload: expect.objectContaining({
            chapterId: VALID_CHAPTER_ID,
            chapterContent: expect.any(String),
            questionTypes: ['mcq', 'short_answer', 'fill_blank'],
          }),
        }),
      );
    });

    it('returns cached: false for freshly generated questions', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.cached).toBe(false);
    });
  });

  describe('error handling', () => {
    it('returns 500 when AI gateway fails', async () => {
      const aiGateway = createMockAiGateway(undefined, true);
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when AI returns empty questions array', async () => {
      const aiGateway = createMockAiGateway({
        cached: false,
        data: { questions: [] },
      });
      const dbClient = createMockDbClient();

      const handler = createGenerateRevisionQuestionsHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('GENERATION_FAILED');
    });
  });
});
