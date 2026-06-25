import { describe, it, expect, vi } from 'vitest';
import {
  createGetExplanationHandler,
  buildCacheKey,
  computeRequestHash,
  parseExplanationResponse,
  type ExplanationAIGatewayClient,
  type ExplanationAIGatewayResponse,
  type ExplanationDbClient,
} from './getExplanation';
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
    path: '/chapters/test/explanation',
    resource: '/chapters/{id}/explanation',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const MOCK_AI_RESPONSE: ExplanationAIGatewayResponse = {
  cached: false,
  data: {
    summary: 'This page explains the basics of Kannada vowels.',
    keyWords: [
      { word: 'ಅ', romanization: 'a', meaning: 'First vowel', language: 'kannada' },
      { word: 'ಆ', romanization: 'aa', meaning: 'Second vowel', language: 'kannada' },
    ],
    concepts: 'Kannada script uses vowels as the building blocks for word formation.',
  },
  s3AssetKey: undefined,
  cdnUrl: undefined,
};

const MOCK_CACHED_AI_RESPONSE: ExplanationAIGatewayResponse = {
  ...MOCK_AI_RESPONSE,
  cached: true,
};

function createMockAIGateway(response?: ExplanationAIGatewayResponse): ExplanationAIGatewayClient {
  return {
    process: vi.fn().mockResolvedValue(response ?? MOCK_AI_RESPONSE),
  };
}

function createMockDbClient(options?: {
  exists?: boolean;
  pageCount?: number;
  pageText?: string | null;
}): ExplanationDbClient {
  const { exists = true, pageCount = 5, pageText = 'ಅ ಆ ಇ ಈ ಉ ಊ. These are Kannada vowels.' } =
    options ?? {};

  return {
    getChapterInfo: vi.fn().mockResolvedValue(exists ? { exists, pageCount } : null),
    getPageText: vi.fn().mockResolvedValue(pageText),
  };
}

// ============================================================
// Unit Tests
// ============================================================

describe('getExplanation handler', () => {
  describe('buildCacheKey', () => {
    it('builds cache key from chapter ID and page number', () => {
      const key = buildCacheKey('abc-123', 3);
      expect(key).toBe('chapter:abc-123:page:3:explanation');
    });

    it('defaults page 1 produces correct key', () => {
      const key = buildCacheKey(VALID_CHAPTER_ID, 1);
      expect(key).toBe(`chapter:${VALID_CHAPTER_ID}:page:1:explanation`);
    });
  });

  describe('computeRequestHash', () => {
    it('returns a deterministic hash for same inputs', () => {
      const hash1 = computeRequestHash('id1', 1, 'hello world');
      const hash2 = computeRequestHash('id1', 1, 'hello world');
      expect(hash1).toBe(hash2);
    });

    it('returns different hashes for different inputs', () => {
      const hash1 = computeRequestHash('id1', 1, 'hello');
      const hash2 = computeRequestHash('id1', 2, 'hello');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('parseExplanationResponse', () => {
    it('parses valid AI response data into ChapterExplanation', () => {
      const result = parseExplanationResponse(VALID_CHAPTER_ID, 1, MOCK_AI_RESPONSE.data);
      expect(result.chapterId).toBe(VALID_CHAPTER_ID);
      expect(result.pageNumber).toBe(1);
      expect(result.summary).toBe('This page explains the basics of Kannada vowels.');
      expect(result.keyWords).toHaveLength(2);
      expect(result.keyWords[0].word).toBe('ಅ');
      expect(result.keyWords[0].romanization).toBe('a');
      expect(result.concepts).toContain('Kannada script');
    });

    it('handles missing or malformed fields gracefully', () => {
      const result = parseExplanationResponse(VALID_CHAPTER_ID, 1, {});
      expect(result.summary).toBe('');
      expect(result.keyWords).toEqual([]);
      expect(result.concepts).toBe('');
    });

    it('includes audio fields when provided', () => {
      const result = parseExplanationResponse(
        VALID_CHAPTER_ID,
        1,
        MOCK_AI_RESPONSE.data,
        'audio/chapter-1-page-1.mp3',
        'https://cdn.example.com/audio/chapter-1-page-1.mp3',
      );
      expect(result.audioS3Key).toBe('audio/chapter-1-page-1.mp3');
      expect(result.audioCdnUrl).toBe('https://cdn.example.com/audio/chapter-1-page-1.mp3');
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('chapter ID');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid page number (zero)', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        queryStringParameters: { page: '0' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
      expect(body.message).toContain('positive integer');
    });

    it('returns 400 for negative page number', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        queryStringParameters: { page: '-1' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for non-numeric page', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        queryStringParameters: { page: 'abc' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });
  });

  describe('chapter and page validation', () => {
    it('returns 404 when chapter does not exist', async () => {
      const handler = createGetExplanationHandler(
        createMockAIGateway(),
        createMockDbClient({ exists: false }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 when chapter has no pages', async () => {
      const handler = createGetExplanationHandler(
        createMockAIGateway(),
        createMockDbClient({ pageCount: 0 }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_CONTENT');
    });

    it('returns 400 when page number exceeds total pages', async () => {
      const handler = createGetExplanationHandler(
        createMockAIGateway(),
        createMockDbClient({ pageCount: 3 }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        queryStringParameters: { page: '5' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('PAGE_OUT_OF_RANGE');
      expect(body.message).toContain('5');
      expect(body.message).toContain('3');
    });

    it('returns 400 when page has no extracted text', async () => {
      const handler = createGetExplanationHandler(
        createMockAIGateway(),
        createMockDbClient({ pageText: null }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_TEXT_CONTENT');
    });

    it('returns 400 when page text is only whitespace', async () => {
      const handler = createGetExplanationHandler(
        createMockAIGateway(),
        createMockDbClient({ pageText: '   \n\t  ' }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_TEXT_CONTENT');
    });
  });

  describe('successful explanation generation', () => {
    it('returns explanation for default page 1 when no page param provided', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.explanation.chapterId).toBe(VALID_CHAPTER_ID);
      expect(body.explanation.pageNumber).toBe(1);
      expect(body.explanation.summary).toBe('This page explains the basics of Kannada vowels.');
      expect(body.explanation.keyWords).toHaveLength(2);
      expect(body.explanation.concepts).toContain('Kannada script');
      expect(body.totalPages).toBe(5);
      expect(body.cached).toBe(false);
    });

    it('passes correct cache key to AI Gateway', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient();
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        queryStringParameters: { page: '3' },
      });
      await handler(event);

      const processCall = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(processCall.cacheKey).toBe(`chapter:${VALID_CHAPTER_ID}:page:3:explanation`);
      expect(processCall.serviceType).toBe('explanation');
      expect(processCall.payload.chapterId).toBe(VALID_CHAPTER_ID);
      expect(processCall.payload.pageNumber).toBe(3);
    });

    it('returns cached=true when AI Gateway returns cached response', async () => {
      const aiGateway = createMockAIGateway(MOCK_CACHED_AI_RESPONSE);
      const dbClient = createMockDbClient();
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.cached).toBe(true);
    });

    it('includes page text in AI Gateway payload', async () => {
      const pageText = 'ಕನ್ನಡ ಭಾಷೆ ಕಲಿಯಿರಿ.';
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient({ pageText });
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      const processCall = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(processCall.payload.pageText).toBe(pageText);
      expect(processCall.payload.instruction).toBeDefined();
    });

    it('navigates between pages via query parameter', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient = createMockDbClient({ pageCount: 10 });
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        queryStringParameters: { page: '7' },
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.explanation.pageNumber).toBe(7);
      expect(body.totalPages).toBe(10);
    });
  });

  describe('error handling', () => {
    it('returns 500 when AI Gateway throws an error', async () => {
      const aiGateway: ExplanationAIGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      };
      const dbClient = createMockDbClient();
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('returns 500 when database throws an error', async () => {
      const aiGateway = createMockAIGateway();
      const dbClient: ExplanationDbClient = {
        getChapterInfo: vi.fn().mockRejectedValue(new Error('Connection refused')),
        getPageText: vi.fn().mockResolvedValue(null),
      };
      const handler = createGetExplanationHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('includes CORS headers on error responses', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'bad-id' } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('includes CORS headers on success responses', async () => {
      const handler = createGetExplanationHandler(createMockAIGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
