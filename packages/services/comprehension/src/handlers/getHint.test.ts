import { describe, it, expect, vi } from 'vitest';
import {
  createGetHintHandler,
  buildEmbeddingCacheKey,
  buildHintCacheKey,
  computeSimpleHash,
  parseHintResponse,
  type HintAIGatewayClient,
  type HintDbClient,
  type SimilarParagraph,
} from './getHint';
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
    path: '/exercises/test/hint',
    resource: '/exercises/{id}/hint',
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
  gradeLevel: 'Grade 4',
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
  hintText?: string;
  hintCached?: boolean;
}): HintAIGatewayClient {
  const { embeddingResult = MOCK_EMBEDDING, hintText = 'Look at the chapter about Karnataka to find which city is its capital.', hintCached = false } =
    options ?? {};

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
          cached: hintCached,
          data: { text: JSON.stringify({ hint: hintText }) },
        });
      }
      return Promise.reject(new Error(`Unknown service type: ${request.serviceType}`));
    }),
  };
}

function createMockDbClient(options?: {
  exercise?: typeof MOCK_EXERCISE | null;
  paragraphs?: SimilarParagraph[];
}): HintDbClient {
  const { exercise = MOCK_EXERCISE, paragraphs = MOCK_SIMILAR_PARAGRAPHS } = options ?? {};

  return {
    getExerciseInfo: vi.fn().mockResolvedValue(exercise),
    findSimilarParagraphs: vi.fn().mockResolvedValue(paragraphs),
  };
}

// ============================================================
// Unit Tests
// ============================================================

describe('getHint handler', () => {
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

    it('buildHintCacheKey includes exercise ID', () => {
      const key = buildHintCacheKey('exercise-123', 'What is 2+2?');
      expect(key).toContain('exercise:exercise-123:hint:');
    });
  });

  describe('parseHintResponse', () => {
    it('parses JSON text with hint field', () => {
      const result = parseHintResponse({
        text: JSON.stringify({ hint: 'Think about the chapter section on capitals.' }),
      });
      expect(result).toBe('Think about the chapter section on capitals.');
    });

    it('returns plain text when text is not JSON', () => {
      const result = parseHintResponse({ text: 'Try re-reading page 3.' });
      expect(result).toBe('Try re-reading page 3.');
    });

    it('uses hint field directly from data', () => {
      const result = parseHintResponse({ hint: 'Look at the map on page 4.' });
      expect(result).toBe('Look at the map on page 4.');
    });

    it('returns fallback when no hint available', () => {
      const result = parseHintResponse({});
      expect(result).toContain('review the chapter content');
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing exercise ID', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('exercise ID');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: VALID_EXERCISE_ID }, body: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_BODY');
    });

    it('returns 400 for invalid JSON body', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: 'not json',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('returns 400 for missing questionText', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({}),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELD');
    });

    it('returns 400 for empty questionText', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: '   ' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_FIELD');
    });
  });

  describe('exercise lookup', () => {
    it('returns 404 when exercise does not exist', async () => {
      const handler = createGetHintHandler(
        createMockAIGateway(),
        createMockDbClient({ exercise: null }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital?' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('EXERCISE_NOT_FOUND');
    });
  });

  describe('successful hint generation', () => {
    it('returns hint and referenced sections on success', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital of Karnataka?' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.hint).toBe('Look at the chapter about Karnataka to find which city is its capital.');
      expect(body.referencedSections).toHaveLength(5);
      expect(body.referencedSections[0].pageNumber).toBe(3);
      expect(body.referencedSections[0].similarity).toBe(0.92);
      expect(body.cached).toBe(false);
    });

    it('calls AI Gateway with embedding service type first', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital of Karnataka?' }),
      });
      await handler(event);

      const calls = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0][0].serviceType).toBe('embedding');
      expect(calls[0][0].payload.model).toBe('text-embedding-3-small');
    });

    it('calls AI Gateway with text_generation service type for hint', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital of Karnataka?' }),
      });
      await handler(event);

      const calls = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[1][0].serviceType).toBe('text_generation');
      expect(calls[1][0].payload.model).toBe('gpt-5-mini');
    });

    it('passes top 5 paragraphs as context to text generation', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital of Karnataka?' }),
      });
      await handler(event);

      const calls = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls;
      const messages = calls[1][0].payload.messages as Array<{ role: string; content: string }>;
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('[Section 1');
      expect(userMessage?.content).toContain('Page 3');
      expect(userMessage?.content).toContain('Karnataka is a state');
    });

    it('calls findSimilarParagraphs with correct parameters', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital of Karnataka?' }),
      });
      await handler(event);

      expect(dbClient.findSimilarParagraphs).toHaveBeenCalledWith(
        VALID_CHAPTER_ID,
        MOCK_EMBEDDING,
        5,
      );
    });

    it('truncates long text snippets in referenced sections', async () => {
      const longText = 'A'.repeat(200);
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient({
        paragraphs: [
          { pageNumber: 1, paragraphIndex: 0, textContent: longText, similarity: 0.9 },
        ],
      });
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital?' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.referencedSections[0].textSnippet.length).toBeLessThanOrEqual(153); // 150 + '...'
      expect(body.referencedSections[0].textSnippet).toContain('...');
    });

    it('returns cached=true when hint response is cached', async () => {
      const aiGateway = createMockAIGateway({ hintCached: true });
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital?' }),
      });
      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.cached).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 500 when embedding fails (empty result)', async () => {
      const aiGateway: HintAIGatewayClient = {
        process: vi.fn().mockResolvedValue({ cached: false, data: {} }),
      };
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital?' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('EMBEDDING_FAILED');
    });

    it('returns 500 when AI Gateway throws an error', async () => {
      const aiGateway: HintAIGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('Service unavailable')),
      };
      const dbClient = createMockDbClient();
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital?' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when database throws an error', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient: HintDbClient = {
        getExerciseInfo: vi.fn().mockRejectedValue(new Error('Connection refused')),
        findSimilarParagraphs: vi.fn().mockResolvedValue([]),
      };
      const handler = createGetHintHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_EXERCISE_ID },
        body: JSON.stringify({ questionText: 'What is the capital?' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('includes CORS headers on all responses', async () => {
      const handler = createGetHintHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'bad-id' } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });
  });
});
