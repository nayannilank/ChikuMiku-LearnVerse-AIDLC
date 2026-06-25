import { describe, it, expect, vi } from 'vitest';
import {
  createGenerateAudioHandler,
  buildTtsCacheKey,
  computeTtsRequestHash,
  type TtsAiGatewayClient,
  type TtsGatewayResponse,
  type AudioDbClient,
} from './generateAudio';
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
    path: '/chapters/test/explanation/audio',
    resource: '/chapters/{id}/explanation/audio',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SAMPLE_EXPLANATION = 'This is a detailed explanation of the chapter content for page one.';
const SAMPLE_CDN_URL = 'https://d1234abcdef.cloudfront.net/audio/chapter-a1b2c3d4-page-1.mp3';
const SAMPLE_S3_KEY = 'audio/tts/chapter-a1b2c3d4-page-1.mp3';

function createMockAiGateway(response?: Partial<TtsGatewayResponse>): TtsAiGatewayClient {
  const defaultResponse: TtsGatewayResponse = {
    cached: false,
    data: { durationSeconds: 12.5 },
    s3AssetKey: SAMPLE_S3_KEY,
    cdnUrl: SAMPLE_CDN_URL,
    ...response,
  };

  return {
    process: vi.fn().mockResolvedValue(defaultResponse),
  };
}

function createMockDbClient(overrides: {
  chapterExists?: boolean;
  explanationText?: string | null;
  pageCount?: number;
} = {}): AudioDbClient {
  const {
    chapterExists = true,
    explanationText = SAMPLE_EXPLANATION,
    pageCount = 5,
  } = overrides;

  return {
    chapterExists: vi.fn().mockResolvedValue(chapterExists),
    getExplanationText: vi.fn().mockResolvedValue(explanationText),
    getChapterPageCount: vi.fn().mockResolvedValue(pageCount),
  };
}

// ============================================================
// Tests
// ============================================================

describe('generateAudio handler', () => {
  describe('buildTtsCacheKey', () => {
    it('builds deterministic cache key from chapter ID and page number', () => {
      const key = buildTtsCacheKey('abc-123', 2);
      expect(key).toBe('chapter:abc-123:page:2:tts');
    });

    it('produces different keys for different pages', () => {
      const key1 = buildTtsCacheKey('abc-123', 1);
      const key2 = buildTtsCacheKey('abc-123', 2);
      expect(key1).not.toBe(key2);
    });

    it('produces different keys for different chapters', () => {
      const key1 = buildTtsCacheKey('abc-123', 1);
      const key2 = buildTtsCacheKey('def-456', 1);
      expect(key1).not.toBe(key2);
    });
  });

  describe('computeTtsRequestHash', () => {
    it('returns a 64-char hex string (SHA-256)', () => {
      const hash = computeTtsRequestHash('hello world');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns same hash for same input', () => {
      const hash1 = computeTtsRequestHash('same text');
      const hash2 = computeTtsRequestHash('same text');
      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different input', () => {
      const hash1 = computeTtsRequestHash('text one');
      const hash2 = computeTtsRequestHash('text two');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createGenerateAudioHandler(
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
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: null,
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_BODY');
    });

    it('returns 400 for invalid JSON body', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: 'not-json',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('returns 400 for missing pageNumber', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({}),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_PAGE_NUMBER');
    });

    it('returns 400 for non-integer pageNumber', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1.5 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_NUMBER');
    });

    it('returns 400 for zero pageNumber', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 0 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_NUMBER');
    });

    it('returns 400 for negative pageNumber', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: -1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_NUMBER');
    });
  });

  describe('chapter and page validation', () => {
    it('returns 404 when chapter does not exist', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient({ chapterExists: false }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 when pageNumber exceeds chapter page count', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient({ pageCount: 3 }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 5 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('PAGE_OUT_OF_RANGE');
    });

    it('returns 400 when no explanation text is available', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient({ explanationText: null }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_EXPLANATION');
    });

    it('returns 400 when explanation text is empty whitespace', async () => {
      const handler = createGenerateAudioHandler(
        createMockAiGateway(),
        createMockDbClient({ explanationText: '   \t\n  ' }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_EXPLANATION');
    });
  });

  describe('successful audio generation', () => {
    it('returns 200 with audioUrl and s3Key on success', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.audioUrl).toBe(SAMPLE_CDN_URL);
      expect(body.s3Key).toBe(SAMPLE_S3_KEY);
    });

    it('calls AI Gateway with correct cache key, service type, and payload', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 2 }),
      });
      await handler(event);

      const expectedCacheKey = `chapter:${VALID_CHAPTER_ID}:page:2:tts`;
      const expectedHash = computeTtsRequestHash(SAMPLE_EXPLANATION);

      expect(aiGateway.process).toHaveBeenCalledWith({
        cacheKey: expectedCacheKey,
        serviceType: 'tts',
        requestHash: expectedHash,
        payload: {
          text: SAMPLE_EXPLANATION,
          chapterId: VALID_CHAPTER_ID,
          pageNumber: 2,
        },
      });
    });

    it('retrieves explanation text for the correct chapter and page', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 3 }),
      });
      await handler(event);

      expect(dbClient.getExplanationText).toHaveBeenCalledWith(VALID_CHAPTER_ID, 3);
    });

    it('handles cached response from AI Gateway', async () => {
      const aiGateway = createMockAiGateway({ cached: true });
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.audioUrl).toBe(SAMPLE_CDN_URL);
      expect(body.s3Key).toBe(SAMPLE_S3_KEY);
    });
  });

  describe('error handling', () => {
    it('returns 500 when AI Gateway returns no s3AssetKey', async () => {
      const aiGateway = createMockAiGateway({
        s3AssetKey: undefined,
        cdnUrl: SAMPLE_CDN_URL,
      });
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('TTS_GENERATION_FAILED');
    });

    it('returns 500 when AI Gateway returns no cdnUrl', async () => {
      const aiGateway = createMockAiGateway({
        s3AssetKey: SAMPLE_S3_KEY,
        cdnUrl: undefined,
      });
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('TTS_GENERATION_FAILED');
    });

    it('returns 500 when AI Gateway throws an error', async () => {
      const aiGateway: TtsAiGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('Service unavailable')),
      };
      const dbClient = createMockDbClient();

      const handler = createGenerateAudioHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1 }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
