import { describe, it, expect, vi } from 'vitest';
import {
  createEvaluateHandler,
  buildEmbeddingCacheKey,
  buildEvaluateCacheKey,
  computeSimpleHash,
  parseEvaluationResponse,
  type EvaluateAIGatewayClient,
  type EvaluateDbClient,
  type SimilarParagraph,
} from './evaluate';
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
    path: '/exercises/test/evaluate',
    resource: '/exercises/{id}/evaluate',
    ...overrides,
  };
}

const VALID_EXERCISE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_CHAPTER_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

const MOCK_EXERCISE = {
  id: VALID_EXERCISE_ID,
  chapterId: VALID_CHAPTER_ID,
  questionText: 'What is the capital of Karnataka?',
  correctAnswer: 'Bengaluru',
  exerciseType: 'short_answer',
  gradeLevel: 'CBSE Grade 4',
  subject: 'EVS',
};

const MOCK_EMBEDDING = Array(1536).fill(0.01);

const MOCK_SIMILAR_PARAGRAPHS: SimilarParagraph[] = [
  {
    pageNumber: 3,
    paragraphIndex: 1,
    textContent: 'Karnataka is a state in southern India. Its capital city is Bengaluru, formerly known as Bangalore.',
    similarity: 0.92,
  },
  {
    pageNumber: 3,
    paragraphIndex: 2,
    textContent: 'Bengaluru is known as the Silicon Valley of India due to its thriving IT industry.',
    similarity: 0.85,
  },
  {
    pageNumber: 4,
    paragraphIndex: 0,
    textContent: 'The state of Karnataka has 31 districts. The capital district is Bengaluru Urban.',
    similarity: 0.78,
  },
  {
    pageNumber: 2,
    paragraphIndex: 3,
    textContent: 'Karnataka was formed on 1 November 1956 from the princely state of Mysore.',
    similarity: 0.65,
  },
  {
    pageNumber: 5,
    paragraphIndex: 1,
    textContent: 'Major cities in Karnataka include Mysuru, Hubballi, and Mangaluru.',
    similarity: 0.60,
  },
];

function createMockAIGateway(options?: {
  embeddingResult?: number[];
  evaluationResult?: Record<string, unknown>;
  evaluationCached?: boolean;
}): EvaluateAIGatewayClient {
  const {
    embeddingResult = MOCK_EMBEDDING,
    evaluationResult = {
      text: JSON.stringify({
        isCorrect: true,
        score: 100,
        feedback: 'Excellent! Bengaluru is indeed the capital of Karnataka.',
        referencedSectionIndex: null,
      }),
    },
    evaluationCached = false,
  } = options ?? {};

  return {
    process: vi.fn().mockImplementation((request: { serviceType: string }) => {
      if (request.serviceType === 'embedding') {
        return Promise.resolve({
          cached: true,
          data: { embedding: embeddingResult },
        });
      }
      if (request.serviceType === 'text_generation') {
        return Promise.resolve({
          cached: evaluationCached,
          data: evaluationResult,
        });
      }
      return Promise.reject(new Error(`Unknown service type: ${request.serviceType}`));
    }),
  };
}

function createMockDbClient(options?: {
  exercise?: typeof MOCK_EXERCISE | null;
  paragraphs?: SimilarParagraph[];
}): EvaluateDbClient {
  const { exercise = MOCK_EXERCISE, paragraphs = MOCK_SIMILAR_PARAGRAPHS } = options ?? {};

  return {
    getExerciseInfo: vi.fn().mockResolvedValue(exercise),
    findSimilarParagraphs: vi.fn().mockResolvedValue(paragraphs),
  };
}

// ============================================================
// Unit Tests
// ============================================================

describe('evaluate handler', () => {
  describe('helper functions', () => {
    it('computeSimpleHash returns deterministic hash', () => {
      const hash1 = computeSimpleHash('hello world');
      const hash2 = computeSimpleHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('computeSimpleHash returns different hashes for different inputs', () => {
      const hash1 = computeSimpleHash('hello');
      const hash2 = computeSimpleHash('world');
      expect(hash1).not.toBe(hash2);
    });

    it('buildEmbeddingCacheKey normalizes input', () => {
      const key1 = buildEmbeddingCacheKey('Hello World');
      const key2 = buildEmbeddingCacheKey('hello world');
      expect(key1).toBe(key2);
    });

    it('buildEvaluateCacheKey includes exercise ID', () => {
      const key = buildEvaluateCacheKey('exercise-123', 'Bengaluru');
      expect(key).toContain('exercise:exercise-123:evaluate:');
    });
  });

  describe('parseEvaluationResponse', () => {
    it('parses JSON text response for correct answer', () => {
      const data = {
        text: JSON.stringify({
          isCorrect: true,
          score: 100,
          feedback: 'Great job!',
          referencedSectionIndex: null,
        }),
      };
      const result = parseEvaluationResponse(data, MOCK_SIMILAR_PARAGRAPHS);
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(100);
      expect(result.feedback).toBe('Great job!');
      expect(result.referencedSection).toBeUndefined();
    });

    it('parses JSON text response for incorrect answer with referenced section', () => {
      const data = {
        text: JSON.stringify({
          isCorrect: false,
          score: 20,
          feedback: 'Not quite. Review page 3 about Karnataka.',
          referencedSectionIndex: 0,
        }),
      };
      const result = parseEvaluationResponse(data, MOCK_SIMILAR_PARAGRAPHS);
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(20);
      expect(result.feedback).toBe('Not quite. Review page 3 about Karnataka.');
      expect(result.referencedSection).toBeDefined();
      expect(result.referencedSection?.pageNumber).toBe(3);
      expect(result.referencedSection?.paragraphIndex).toBe(1);
    });

    it('defaults to first paragraph when referencedSectionIndex is invalid', () => {
      const data = {
        text: JSON.stringify({
          isCorrect: false,
          score: 0,
          feedback: 'Incorrect.',
          referencedSectionIndex: 99,
        }),
      };
      const result = parseEvaluationResponse(data, MOCK_SIMILAR_PARAGRAPHS);
      expect(result.referencedSection?.pageNumber).toBe(3);
      expect(result.referencedSection?.paragraphIndex).toBe(1);
    });

    it('parses direct fields from data object', () => {
      const data = {
        isCorrect: true,
        score: 85,
        feedback: 'Good answer!',
      };
      const result = parseEvaluationResponse(data, MOCK_SIMILAR_PARAGRAPHS);
      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(85);
      expect(result.feedback).toBe('Good answer!');
    });

    it('clamps score to 0-100 range', () => {
      const data = {
        text: JSON.stringify({ isCorrect: true, score: 150, feedback: 'Over' }),
      };
      const result = parseEvaluationResponse(data, MOCK_SIMILAR_PARAGRAPHS);
      expect(result.score).toBe(100);
    });

    it('clamps negative score to 0', () => {
      const data = {
        text: JSON.stringify({ isCorrect: false, score: -10, feedback: 'Under' }),
      };
      const result = parseEvaluationResponse(data, MOCK_SIMILAR_PARAGRAPHS);
      expect(result.score).toBe(0);
    });

    it('returns fallback when no data is parseable', () => {
      const result = parseEvaluationResponse({}, []);
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Unable to evaluate');
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing exercise ID', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('exercise ID');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: VALID_EXERCISE_ID }, body: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_BODY');
    });

    it('returns 400 for invalid JSON body', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: 'not json',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('returns 400 for missing answer field', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({}),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELD');
    });

    it('returns 400 for empty answer', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: '   ' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELD');
    });
  });

  describe('exercise lookup', () => {
    it('returns 404 when exercise does not exist', async () => {
      const handler = createEvaluateHandler(
        createMockAIGateway(),
        createMockDbClient({ exercise: null }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('EXERCISE_NOT_FOUND');
    });
  });

  describe('successful evaluation — correct answer', () => {
    it('returns isCorrect=true and score=100 for correct answer', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.isCorrect).toBe(true);
      expect(body.score).toBe(100);
      expect(body.feedback).toContain('Bengaluru');
      expect(body.referencedSection).toBeUndefined();
    });

    it('does not include referencedSection for correct answers', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.referencedSection).toBeUndefined();
    });
  });

  describe('successful evaluation — incorrect answer', () => {
    it('returns isCorrect=false with referencedSection for incorrect answer', async () => {
      const aiGateway = createMockAIGateway({
        evaluationResult: {
          text: JSON.stringify({
            isCorrect: false,
            score: 20,
            feedback: 'Not quite. The capital of Karnataka is not Mysuru. Check page 3 of your chapter.',
            referencedSectionIndex: 0,
          }),
        },
      });
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Mysuru' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.isCorrect).toBe(false);
      expect(body.score).toBe(20);
      expect(body.feedback).toContain('Not quite');
      expect(body.referencedSection).toBeDefined();
      expect(body.referencedSection.pageNumber).toBe(3);
      expect(body.referencedSection.similarity).toBe(0.92);
    });
  });

  describe('AI Gateway interactions', () => {
    it('calls embedding service with exercise question text', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      await handler(event);

      const calls = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0].serviceType).toBe('embedding');
      expect(calls[0][0].payload.text).toBe(MOCK_EXERCISE.questionText);
      expect(calls[0][0].payload.model).toBe('text-embedding-3-small');
    });

    it('calls text_generation with grade-appropriate prompt', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      await handler(event);

      const calls = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[1][0].serviceType).toBe('text_generation');
      expect(calls[1][0].payload.model).toBe('gpt-5-mini');

      const messages = calls[1][0].payload.messages as Array<{ role: string; content: string }>;
      const systemMessage = messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('CBSE Grade 4');
      expect(systemMessage?.content).toContain('EVS');
    });

    it('includes correct answer and student answer in evaluation prompt', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Mumbai' }),
      });
      await handler(event);

      const calls = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls;
      const messages = calls[1][0].payload.messages as Array<{ role: string; content: string }>;
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('Correct Answer: Bengaluru');
      expect(userMessage?.content).toContain("Student's Answer: Mumbai");
    });

    it('performs similarity search on the exercise chapter', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      await handler(event);

      expect(dbClient.findSimilarParagraphs).toHaveBeenCalledWith(
        VALID_CHAPTER_ID,
        MOCK_EMBEDDING,
        5,
      );
    });
  });

  describe('error handling', () => {
    it('returns 500 when embedding fails (empty result)', async () => {
      const aiGateway: EvaluateAIGatewayClient = {
        process: vi.fn().mockResolvedValue({ cached: false, data: {} }),
      };
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('EMBEDDING_FAILED');
    });

    it('returns 500 when AI Gateway throws an error', async () => {
      const aiGateway: EvaluateAIGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('Service unavailable')),
      };
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when database throws an error', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient: EvaluateDbClient = {
        getExerciseInfo: vi.fn().mockRejectedValue(new Error('Connection refused')),
        findSimilarParagraphs: vi.fn().mockResolvedValue([]),
      };
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('includes CORS headers on all responses', async () => {
      const handler = createEvaluateHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'bad-id' } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('returns cached=true when evaluation is cached', async () => {
      const aiGateway = createMockAIGateway({ evaluationCached: true });
      const dbClient = createMockDbClient();
      const handler = createEvaluateHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ answer: 'Bengaluru' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.cached).toBe(true);
    });
  });
});
