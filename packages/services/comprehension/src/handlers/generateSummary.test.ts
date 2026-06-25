import { describe, it, expect, vi } from 'vitest';
import {
  createGenerateSummaryHandler,
  buildCacheKey,
  computeRequestHash,
  parseAiResponse,
  type SummaryAiGatewayClient,
  type SummaryDbClient,
  type ChapterSummary,
} from './generateSummary';
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
    path: '/chapters/test/summary',
    resource: '/chapters/{id}/summary',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function createMockAiGateway(
  response?: Partial<{ cached: boolean; data: Record<string, unknown> }>,
): SummaryAiGatewayClient {
  const defaultData = {
    keyPoints: ['Water cycle involves evaporation', 'Condensation forms clouds'],
    importantConcepts: ['Evaporation', 'Condensation', 'Precipitation'],
    examPreparationNotes: ['Remember the three stages of water cycle'],
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
  chapterContent?: string | null;
  existingSummary?: ChapterSummary | null;
} = {}): SummaryDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(overrides.chapterExists ?? true),
    getChapterContent: vi.fn().mockResolvedValue(
      overrides.chapterContent !== undefined
        ? overrides.chapterContent
        : 'The water cycle is the continuous movement of water within Earth.',
    ),
    getSummary: vi.fn().mockResolvedValue(overrides.existingSummary ?? null),
    saveSummary: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('generateSummary handler', () => {
  describe('buildCacheKey', () => {
    it('returns correct cache key pattern', () => {
      expect(buildCacheKey('abc-123')).toBe('chapter:abc-123:summary');
    });
  });

  describe('computeRequestHash', () => {
    it('returns consistent hash for same payload', () => {
      const payload = { chapterId: 'test', content: 'hello' };
      expect(computeRequestHash(payload)).toBe(computeRequestHash(payload));
    });

    it('returns different hash for different payloads', () => {
      const hash1 = computeRequestHash({ content: 'hello' });
      const hash2 = computeRequestHash({ content: 'world' });
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('parseAiResponse', () => {
    it('parses a valid AI response into ChapterSummary', () => {
      const data = {
        keyPoints: ['Point 1', 'Point 2'],
        importantConcepts: ['Concept A'],
        examPreparationNotes: ['Note 1', 'Note 2'],
      };

      const result = parseAiResponse(VALID_CHAPTER_ID, data);

      expect(result.chapterId).toBe(VALID_CHAPTER_ID);
      expect(result.keyPoints).toEqual(['Point 1', 'Point 2']);
      expect(result.importantConcepts).toEqual(['Concept A']);
      expect(result.examPreparationNotes).toEqual(['Note 1', 'Note 2']);
      expect(result.generatedAt).toBeDefined();
    });

    it('filters out non-string and empty entries', () => {
      const data = {
        keyPoints: ['Valid', '', null, 42, 'Also valid'],
        importantConcepts: [undefined, 'Concept'],
        examPreparationNotes: ['  ', 'Note'],
      };

      const result = parseAiResponse(VALID_CHAPTER_ID, data as unknown as Record<string, unknown>);

      expect(result.keyPoints).toEqual(['Valid', 'Also valid']);
      expect(result.importantConcepts).toEqual(['Concept']);
      expect(result.examPreparationNotes).toEqual(['Note']);
    });

    it('handles missing arrays gracefully', () => {
      const data = {};
      const result = parseAiResponse(VALID_CHAPTER_ID, data);

      expect(result.keyPoints).toEqual([]);
      expect(result.importantConcepts).toEqual([]);
      expect(result.examPreparationNotes).toEqual([]);
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createGenerateSummaryHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createGenerateSummaryHandler(
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
      const handler = createGenerateSummaryHandler(
        createMockAiGateway(),
        createMockDbClient({ chapterExists: false }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 when chapter has no content', async () => {
      const handler = createGenerateSummaryHandler(
        createMockAiGateway(),
        createMockDbClient({ chapterContent: null }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_CONTENT');
    });

    it('returns 400 when chapter content is empty whitespace', async () => {
      const handler = createGenerateSummaryHandler(
        createMockAiGateway(),
        createMockDbClient({ chapterContent: '   ' }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_CONTENT');
    });
  });

  describe('generate-once-store-permanently pattern', () => {
    it('returns existing summary without calling AI Gateway', async () => {
      const existingSummary: ChapterSummary = {
        chapterId: VALID_CHAPTER_ID,
        keyPoints: ['Stored point'],
        importantConcepts: ['Stored concept'],
        examPreparationNotes: ['Stored note'],
        generatedAt: '2024-01-01T00:00:00.000Z',
      };

      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient({ existingSummary });

      const handler = createGenerateSummaryHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.cached).toBe(true);
      expect(body.summary.keyPoints).toEqual(['Stored point']);
      expect(aiGateway.process).not.toHaveBeenCalled();
    });
  });

  describe('successful generation', () => {
    it('generates summary and stores it permanently', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateSummaryHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.cached).toBe(false);
      expect(body.summary.chapterId).toBe(VALID_CHAPTER_ID);
      expect(body.summary.keyPoints).toHaveLength(2);
      expect(body.summary.importantConcepts).toHaveLength(3);
      expect(body.summary.examPreparationNotes).toHaveLength(1);
      expect(body.summary.generatedAt).toBeDefined();

      // Verify summary was saved
      expect(dbClient.saveSummary).toHaveBeenCalledTimes(1);
      const savedSummary = (dbClient.saveSummary as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedSummary.chapterId).toBe(VALID_CHAPTER_ID);
    });

    it('calls AI Gateway with correct serviceType and cache key', async () => {
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient();

      const handler = createGenerateSummaryHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      expect(aiGateway.process).toHaveBeenCalledTimes(1);
      const request = (aiGateway.process as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(request.serviceType).toBe('summary');
      expect(request.cacheKey).toBe(`chapter:${VALID_CHAPTER_ID}:summary`);
      expect(request.payload.chapterId).toBe(VALID_CHAPTER_ID);
      expect(request.payload.chapterContent).toBeDefined();
      expect(request.requestHash).toBeDefined();
    });

    it('returns 500 when AI returns empty summary', async () => {
      const aiGateway = createMockAiGateway({
        data: { keyPoints: [], importantConcepts: [], examPreparationNotes: [] },
      });
      const dbClient = createMockDbClient();

      const handler = createGenerateSummaryHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('GENERATION_FAILED');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected errors', async () => {
      const aiGateway: SummaryAiGatewayClient = {
        process: vi.fn().mockRejectedValue(new Error('AI service down')),
      };
      const dbClient = createMockDbClient();

      const handler = createGenerateSummaryHandler(aiGateway, dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
