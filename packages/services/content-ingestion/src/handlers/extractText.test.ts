import { describe, it, expect, vi } from 'vitest';
import {
  createExtractTextHandler,
  countWords,
  DEFAULT_LANGUAGE_HINTS,
  type AiGatewayClient,
  type ExtractDbClient,
  type OcrResponse,
} from './extractText';
import type { ChapterPageRecord } from './uploadPages';
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
    path: '/chapters/test/extract',
    resource: '/chapters/{id}/extract',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function createMockPage(pageNumber: number, ocrStatus = 'pending' as const): ChapterPageRecord {
  return {
    id: `page-${pageNumber}-id`,
    chapterId: VALID_CHAPTER_ID,
    pageNumber,
    s3ImageKey: `chapters/${VALID_CHAPTER_ID}/pages/${pageNumber}_uuid.jpeg`,
    extractedText: null,
    wordCount: 0,
    isExercisePage: false,
    ocrStatus,
    createdAt: new Date().toISOString(),
  };
}

function createMockAiGateway(responses?: Map<string, OcrResponse>): AiGatewayClient {
  const defaultResponse: OcrResponse = {
    extractedText: 'This is extracted text from the page.',
    confidence: 0.95,
    detectedLanguages: ['en'],
  };

  return {
    extractTextFromImage: vi.fn().mockImplementation((req) => {
      if (responses && responses.has(req.imageS3Key)) {
        return Promise.resolve(responses.get(req.imageS3Key));
      }
      return Promise.resolve(defaultResponse);
    }),
  };
}

function createMockDbClient(
  pages: ChapterPageRecord[] = [],
  chapterExists = true,
): ExtractDbClient {
  return {
    getChapterPages: vi.fn().mockResolvedValue(pages),
    updatePageOcrStatus: vi.fn().mockResolvedValue(undefined),
    updateChapterWordCount: vi.fn().mockResolvedValue(undefined),
    chapterExists: vi.fn().mockResolvedValue(chapterExists),
  };
}

// ============================================================
// Tests
// ============================================================

describe('extractText handler', () => {
  describe('countWords', () => {
    it('counts whitespace-separated tokens', () => {
      expect(countWords('hello world')).toBe(2);
    });

    it('handles multiple spaces between words', () => {
      expect(countWords('hello   world   foo')).toBe(3);
    });

    it('handles tabs and newlines', () => {
      expect(countWords('hello\tworld\nfoo')).toBe(3);
    });

    it('returns 0 for empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('returns 0 for whitespace-only string', () => {
      expect(countWords('   \t\n  ')).toBe(0);
    });

    it('counts single word', () => {
      expect(countWords('hello')).toBe(1);
    });

    it('handles Kannada text', () => {
      expect(countWords('ಕನ್ನಡ ಭಾಷೆ ಕಲಿಯಿರಿ')).toBe(3);
    });

    it('handles Hindi text', () => {
      expect(countWords('हिंदी भाषा सीखें')).toBe(3);
    });

    it('handles mixed language text', () => {
      expect(countWords('Hello ಕನ್ನಡ world')).toBe(3);
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createExtractTextHandler(
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
      const handler = createExtractTextHandler(
        createMockAiGateway(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: { id: 'bad-id' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const handler = createExtractTextHandler(
        createMockAiGateway(),
        createMockDbClient([], false),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 when no pages exist', async () => {
      const handler = createExtractTextHandler(
        createMockAiGateway(),
        createMockDbClient([]),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_PAGES');
    });
  });

  describe('successful extraction', () => {
    it('extracts text from pending pages and returns results', async () => {
      const pages = [createMockPage(1), createMockPage(2)];
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient(pages);

      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.results).toHaveLength(2);
      expect(body.summary.successfulPages).toBe(2);
      expect(body.summary.failedPages).toBe(0);
      expect(body.summary.totalWordCount).toBe(14); // 7 words x 2 pages
    });

    it('passes language hints to AI gateway', async () => {
      const pages = [createMockPage(1)];
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient(pages);

      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      expect(aiGateway.extractTextFromImage).toHaveBeenCalledWith({
        imageS3Key: pages[0].s3ImageKey,
        languageHints: DEFAULT_LANGUAGE_HINTS,
      });
    });

    it('uses custom language hints when provided', async () => {
      const pages = [createMockPage(1)];
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient(pages);

      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ languageHints: ['kn', 'en'] }),
      });
      await handler(event);

      expect(aiGateway.extractTextFromImage).toHaveBeenCalledWith({
        imageS3Key: pages[0].s3ImageKey,
        languageHints: ['kn', 'en'],
      });
    });

    it('updates page OCR status to processing then completed', async () => {
      const pages = [createMockPage(1)];
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient(pages);

      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      const updateCalls = (dbClient.updatePageOcrStatus as ReturnType<typeof vi.fn>).mock.calls;
      // First call: mark as processing
      expect(updateCalls[0]).toEqual(['page-1-id', 'processing', null, 0]);
      // Second call: mark as completed
      expect(updateCalls[1][0]).toBe('page-1-id');
      expect(updateCalls[1][1]).toBe('completed');
      expect(updateCalls[1][2]).toBe('This is extracted text from the page.');
      expect(updateCalls[1][3]).toBe(7);
    });

    it('updates chapter total word count', async () => {
      const pages = [createMockPage(1), createMockPage(2)];
      const aiGateway = createMockAiGateway();
      const dbClient = createMockDbClient(pages);

      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      expect(dbClient.updateChapterWordCount).toHaveBeenCalledWith(VALID_CHAPTER_ID, 14);
    });
  });

  describe('partial failure handling', () => {
    it('marks failed pages while continuing with others', async () => {
      const pages = [createMockPage(1), createMockPage(2), createMockPage(3)];

      // Page 2 will fail
      const aiGateway: AiGatewayClient = {
        extractTextFromImage: vi.fn().mockImplementation((req) => {
          if (req.imageS3Key.includes('/2_')) {
            return Promise.reject(new Error('OCR service unavailable'));
          }
          return Promise.resolve({
            extractedText: 'Extracted text content here.',
            confidence: 0.9,
            detectedLanguages: ['en'],
          });
        }),
      };

      const dbClient = createMockDbClient(pages);
      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.summary.successfulPages).toBe(2);
      expect(body.summary.failedPages).toBe(1);

      // Check page 2 is marked failed
      const failedPage = body.results.find((r: { pageNumber: number }) => r.pageNumber === 2);
      expect(failedPage.ocrStatus).toBe('failed');
      expect(failedPage.error).toBe('OCR service unavailable');
    });

    it('handles timeout gracefully', async () => {
      const pages = [createMockPage(1)];

      const aiGateway: AiGatewayClient = {
        extractTextFromImage: vi.fn().mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 50)),
        ),
      };

      const dbClient = createMockDbClient(pages);
      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.summary.failedPages).toBe(1);
      expect(body.results[0].ocrStatus).toBe('failed');
    });
  });

  describe('already-processed pages', () => {
    it('returns 200 with existing state when no pending pages', async () => {
      const completedPage: ChapterPageRecord = {
        ...createMockPage(1),
        ocrStatus: 'completed',
        extractedText: 'Already extracted text.',
        wordCount: 3,
      };

      const dbClient = createMockDbClient([completedPage]);
      const aiGateway = createMockAiGateway();

      const handler = createExtractTextHandler(aiGateway, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.summary.successfulPages).toBe(1);
      // Should not have called AI gateway
      expect(aiGateway.extractTextFromImage).not.toHaveBeenCalled();
    });
  });
});
