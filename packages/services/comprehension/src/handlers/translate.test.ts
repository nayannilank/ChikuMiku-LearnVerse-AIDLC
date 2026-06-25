import { describe, it, expect, vi } from 'vitest';
import {
  createTranslateHandler,
  buildTranslationCacheKey,
  computeTranslationRequestHash,
  parseTranslateBody,
  parseTranslationResponse,
  type TranslationAiGatewayClient,
  type TranslationDbClient,
  type ChapterTranslation,
  type TranslationLanguage,
} from './translate';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Test Helpers
// ============================================================

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ pageNumber: 1, language: 'english' }),
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {},
    httpMethod: 'POST',
    path: '/chapters/test/translate',
    resource: '/chapters/{id}/translate',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function createMockAiGateway(
  response?: Partial<{ cached: boolean; data: Record<string, unknown> }>,
): TranslationAiGatewayClient {
  const defaultData = {
    translatedText: 'This is the translated explanation content in English.',
  };

  return {
    process: vi.fn().mockResolvedValue({
      cached: response?.cached ?? false,
      data: response?.data ?? defaultData,
    }),
  };
}

function createMockDbClient(overrides: {
  chapterExists?: boolean;
  pageCount?: number;
  explanation?: string | null;
  existingTranslation?: ChapterTranslation | null;
} = {}): TranslationDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(overrides.chapterExists ?? true),
    getPageCount: vi.fn().mockResolvedValue(overrides.pageCount ?? 5),
    getExplanation: vi.fn().mockResolvedValue(
      overrides.explanation !== undefined
        ? overrides.explanation
        : 'ಈ ಅಧ್ಯಾಯವು ಕನ್ನಡ ವ್ಯಾಕರಣದ ಮೂಲಭೂತ ಅಂಶಗಳನ್ನು ವಿವರಿಸುತ್ತದೆ.',
    ),
    getTranslation: vi.fn().mockResolvedValue(overrides.existingTranslation ?? null),
    saveTranslation: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('translate handler', () => {
  describe('buildTranslationCacheKey', () => {
    it('returns correct cache key pattern', () => {
      expect(buildTranslationCacheKey('abc-123', 1, 'english')).toBe(
        'chapter:abc-123:page:1:translation:english',
      );
    });

    it('includes page number and language in cache key', () => {
      expect(buildTranslationCacheKey('abc-123', 3, 'hindi')).toBe(
        'chapter:abc-123:page:3:translation:hindi',
      );
    });

    it('produces different keys for different languages', () => {
      const englishKey = buildTranslationCacheKey('abc-123', 1, 'english');
      const hindiKey = buildTranslationCacheKey('abc-123', 1, 'hindi');
      expect(englishKey).not.toBe(hindiKey);
    });

    it('produces different keys for different pages', () => {
      const page1Key = buildTranslationCacheKey('abc-123', 1, 'english');
      const page2Key = buildTranslationCacheKey('abc-123', 2, 'english');
      expect(page1Key).not.toBe(page2Key);
    });
  });

  describe('computeTranslationRequestHash', () => {
    it('returns consistent hash for same payload', () => {
      const payload = { chapterId: 'test', pageNumber: 1, language: 'english' };
      expect(computeTranslationRequestHash(payload)).toBe(computeTranslationRequestHash(payload));
    });

    it('returns different hash for different payloads', () => {
      const hash1 = computeTranslationRequestHash({ language: 'english' });
      const hash2 = computeTranslationRequestHash({ language: 'hindi' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('parseTranslateBody', () => {
    it('parses valid body with english language', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 1, language: 'english' }));
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.pageNumber).toBe(1);
        expect(result.data.language).toBe('english');
      }
    });

    it('parses valid body with hindi language', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 2, language: 'hindi' }));
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.pageNumber).toBe(2);
        expect(result.data.language).toBe('hindi');
      }
    });

    it('normalizes language to lowercase', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 1, language: 'English' }));
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.language).toBe('english');
      }
    });

    it('returns error for null body', () => {
      const result = parseTranslateBody(null);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Request body is required');
      }
    });

    it('returns error for invalid JSON', () => {
      const result = parseTranslateBody('not json');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('Invalid JSON in request body');
      }
    });

    it('returns error for missing pageNumber', () => {
      const result = parseTranslateBody(JSON.stringify({ language: 'english' }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('pageNumber is required');
      }
    });

    it('returns error for non-positive pageNumber', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 0, language: 'english' }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('pageNumber must be a positive integer');
      }
    });

    it('returns error for non-integer pageNumber', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 1.5, language: 'english' }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('pageNumber must be a positive integer');
      }
    });

    it('returns error for missing language', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 1 }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe('language is required');
      }
    });

    it('returns error for invalid language', () => {
      const result = parseTranslateBody(JSON.stringify({ pageNumber: 1, language: 'french' }));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('language must be one of');
      }
    });
  });

  describe('parseTranslationResponse', () => {
    it('parses valid AI response into ChapterTranslation', () => {
      const data = { translatedText: 'Translated content' };
      const result = parseTranslationResponse(VALID_CHAPTER_ID, 1, 'english', data);

      expect(result.chapterId).toBe(VALID_CHAPTER_ID);
      expect(result.pageNumber).toBe(1);
      expect(result.language).toBe('english');
      expect(result.translatedText).toBe('Translated content');
      expect(result.generatedAt).toBeDefined();
    });

    it('handles missing translatedText gracefully', () => {
      const data = {};
      const result = parseTranslationResponse(VALID_CHAPTER_ID, 2, 'hindi', data);

      expect(result.translatedText).toBe('');
    });

    it('handles non-string translatedText gracefully', () => {
      const data = { translatedText: 123 };
      const result = parseTranslationResponse(VALID_CHAPTER_ID, 1, 'english', data as unknown as Record<string, unknown>);

      expect(result.translatedText).toBe('');
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createTranslateHandler(createMockAiGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createTranslateHandler(createMockAiGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createTranslateHandler(createMockAiGateway(), createMockDbClient());

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID }, body: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid language in body', async () => {
      const handler = createTranslateHandler(createMockAiGateway(), createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 1, language: 'spanish' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const handler = createTranslateHandler(
        createMockAiGateway(),
        createMockDbClient({ chapterExists: false }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 when page number exceeds total pages', async () => {
      const handler = createTranslateHandler(
        createMockAiGateway(),
        createMockDbClient({ pageCount: 3 }),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 5, language: 'english' }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('PAGE_OUT_OF_RANGE');
    });

    it('returns 400 when no explanation is available', async () => {
      const handler = createTranslateHandler(
        createMockAiGateway(),
        createMockDbClient({ explanation: null }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_EXPLANATION');
    });

    it('returns 400 when explanation is empty whitespace', async () => {
      const handler = createTranslateHandler(
        createMockAiGateway(),
        createMockDbClient({ explanation: '   ' }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_EXPLANATION');
    });
  });

  describe('generate-once-store-permanently pattern', () => {
    it('returns existing translation without calling AI Gateway', async () => {
      const existingTranslation: ChapterTranslation = {
        chapterId: VALID_CHAPTER_ID,
        pageNumber: 1,
        language: 'english',
        translatedText: 'Previously translated content',
        generatedAt: '2024-01-01T00:00:00.000Z',
      };

      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient({ existingTranslation });

      const handler = createTranslateHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.cached).toBe(true);
      expect(body.translation.translatedText).toBe('Previously translated content');
      expect(aiGateway.process).not.toHaveBeenCalled();
    });
  });

  describe('successful generation', () => {
    it('generates translation and stores it permanently', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createTranslateHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.cached).toBe(false);
      expect(body.translation.chapterId).toBe(VALID_CHAPTER_ID);
      expect(body.translation.pageNumber).toBe(1);
      expect(body.translation.language).toBe('english');
      expect(body.translation.translatedText).toBeDefined();
      expect(body.translation.generatedAt).toBeDefined();

      // Verify translation was saved
      expect(dbClient.saveTranslation).toHaveBeenCalledTimes(1);
      const savedTranslation = (dbClient.saveTranslation as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedTranslation.chapterId).toBe(VALID_CHAPTER_ID);
      expect(savedTranslation.language).toBe('english');
    });

    it('calls AI Gateway with correct serviceType and cache key', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createTranslateHandler(aiGateway, dbClient);
      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pageNumber: 2, language: 'hindi' }),
      });
      await handler(event);

      expect(aiGateway.process).toHaveBeenCalledTimes(1);
      const request = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(request.serviceType).toBe('translation');
      expect(request.cacheKey).toBe(`chapter:${VALID_CHAPTER_ID}:page:2:translation:hindi`);
      expect(request.payload.chapterId).toBe(VALID_CHAPTER_ID);
      expect(request.payload.pageNumber).toBe(2);
      expect(request.payload.targetLanguage).toBe('hindi');
      expect(request.payload.explanationText).toBeDefined();
      expect(request.requestHash).toBeDefined();
    });

    it('returns 500 when AI returns empty translation', async () => {
      const aiGateway = createMockAiGateway({
        data: { translatedText: '' },
      });
      const dbClient = createMockDbClient();

      const handler = createTranslateHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('GENERATION_FAILED');
    });

    it('returns 500 when AI returns whitespace-only translation', async () => {
      const aiGateway = createMockAiGateway({
        data: { translatedText: '   \n  ' },
      });
      const dbClient = createMockDbClient();

      const handler = createTranslateHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('GENERATION_FAILED');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected errors', async () => {
      const aiGateway: TranslationAiGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('AI service down')),
      };
      const dbClient = createMockDbClient();

      const handler = createTranslateHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
