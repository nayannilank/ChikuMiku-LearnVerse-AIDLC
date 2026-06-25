import { describe, it, expect, vi } from 'vitest';
import {
  createGetSummaryHandler,
  type GetSummaryDbClient,
} from './getSummary';
import type { ChapterSummary } from './generateSummary';
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
    path: '/chapters/test/summary',
    resource: '/chapters/{id}/summary',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const STORED_SUMMARY: ChapterSummary = {
  chapterId: VALID_CHAPTER_ID,
  keyPoints: ['Water evaporates from oceans', 'Clouds form through condensation'],
  importantConcepts: ['Evaporation', 'Condensation', 'Precipitation'],
  examPreparationNotes: ['Draw the water cycle diagram', 'Remember three states of water'],
  generatedAt: '2024-06-15T10:30:00.000Z',
};

function createMockDbClient(overrides: {
  chapterExists?: boolean;
  summary?: ChapterSummary | null;
} = {}): GetSummaryDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(overrides.chapterExists ?? true),
    getSummary: vi.fn().mockResolvedValue(overrides.summary !== undefined ? overrides.summary : STORED_SUMMARY),
  };
}

// ============================================================
// Tests
// ============================================================

describe('getSummary handler', () => {
  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createGetSummaryHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid UUID format', async () => {
      const handler = createGetSummaryHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'bad-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const handler = createGetSummaryHandler(
        createMockDbClient({ chapterExists: false }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });
  });

  describe('summary retrieval', () => {
    it('returns stored summary when it exists', async () => {
      const handler = createGetSummaryHandler(
        createMockDbClient({ summary: STORED_SUMMARY }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.summary.chapterId).toBe(VALID_CHAPTER_ID);
      expect(body.summary.keyPoints).toEqual(STORED_SUMMARY.keyPoints);
      expect(body.summary.importantConcepts).toEqual(STORED_SUMMARY.importantConcepts);
      expect(body.summary.examPreparationNotes).toEqual(STORED_SUMMARY.examPreparationNotes);
      expect(body.summary.generatedAt).toBe('2024-06-15T10:30:00.000Z');
    });

    it('returns 404 when summary has not been generated', async () => {
      const handler = createGetSummaryHandler(
        createMockDbClient({ summary: null }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe('SUMMARY_NOT_FOUND');
      expect(body.message).toContain('No summary has been generated');
    });
  });

  describe('CORS headers', () => {
    it('includes CORS headers on success response', async () => {
      const handler = createGetSummaryHandler(
        createMockDbClient({ summary: STORED_SUMMARY }),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('includes CORS headers on error response', async () => {
      const handler = createGetSummaryHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected database error', async () => {
      const dbClient: GetSummaryDbClient = {
        chapterExists: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        getSummary: vi.fn(),
      };

      const handler = createGetSummaryHandler(dbClient);
      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
