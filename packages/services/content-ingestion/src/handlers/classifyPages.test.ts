import { describe, it, expect, vi } from 'vitest';
import {
  createClassifyPagesHandler,
  generatePrompt,
  CONFIDENCE_THRESHOLD,
  type ClassificationAiClient,
  type ClassifyDbClient,
  type ClassificationResponse,
  type ClassificationType,
} from './classifyPages';
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
    path: '/chapters/test/classify-pages',
    resource: '/chapters/{id}/classify-pages',
    ...overrides,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_PAGE_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const VALID_PAGE_ID_2 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

function createCompletedPage(
  pageNumber: number,
  text: string = 'Some page text content here',
): ChapterPageRecord {
  return {
    id: `page-${pageNumber}-id-${String(pageNumber).padStart(4, '0')}-abcd-ef1234567890`.slice(0, 36).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5') || `page-${pageNumber}`,
    chapterId: VALID_CHAPTER_ID,
    pageNumber,
    s3ImageKey: `chapters/${VALID_CHAPTER_ID}/pages/${pageNumber}_uuid.jpeg`,
    extractedText: text,
    wordCount: text.split(/\s+/).length,
    isExercisePage: false,
    ocrStatus: 'completed',
    createdAt: new Date().toISOString(),
  };
}

function createCompletedPageWithId(
  pageId: string,
  pageNumber: number,
  text: string = 'Some page text content here',
): ChapterPageRecord {
  return {
    id: pageId,
    chapterId: VALID_CHAPTER_ID,
    pageNumber,
    s3ImageKey: `chapters/${VALID_CHAPTER_ID}/pages/${pageNumber}_uuid.jpeg`,
    extractedText: text,
    wordCount: text.split(/\s+/).length,
    isExercisePage: false,
    ocrStatus: 'completed',
    createdAt: new Date().toISOString(),
  };
}

function createMockAiClient(
  defaultResponse?: ClassificationResponse,
): ClassificationAiClient {
  const response: ClassificationResponse = defaultResponse ?? {
    classification: 'exercise',
    confidence: 0.9,
  };

  return {
    classifyPageContent: vi.fn().mockResolvedValue(response),
  };
}

function createMockDbClient(
  pages: ChapterPageRecord[] = [],
  chapterExists = true,
): ClassifyDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(chapterExists),
    getCompletedPages: vi.fn().mockResolvedValue(pages),
    updatePageExerciseStatus: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('classifyPages handler', () => {
  describe('generatePrompt', () => {
    it('returns exercise confirmation prompt for high-confidence exercise', () => {
      const prompt = generatePrompt('exercise', 0.85);
      expect(prompt).toBe('This page appears to contain exercises. Confirm?');
    });

    it('returns manual classification prompt for uncertain pages', () => {
      const prompt = generatePrompt('uncertain', 0.5);
      expect(prompt).toBe(
        'Unable to determine if this page contains exercises. Please classify manually.',
      );
    });

    it('returns manual classification prompt for low-confidence exercise', () => {
      const prompt = generatePrompt('exercise', 0.5);
      expect(prompt).toBe(
        'Unable to determine if this page contains exercises. Please classify manually.',
      );
    });

    it('returns content prompt for content classification', () => {
      const prompt = generatePrompt('content', 0.9);
      expect(prompt).toBe('This page appears to contain regular content (not exercises).');
    });

    it('uses threshold boundary correctly', () => {
      // Exactly at threshold
      const atThreshold = generatePrompt('exercise', CONFIDENCE_THRESHOLD);
      expect(atThreshold).toBe('This page appears to contain exercises. Confirm?');

      // Just below threshold
      const belowThreshold = generatePrompt('exercise', CONFIDENCE_THRESHOLD - 0.01);
      expect(belowThreshold).toBe(
        'Unable to determine if this page contains exercises. Please classify manually.',
      );
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid chapter ID format', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
        createMockDbClient(),
      );

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
        createMockDbClient([], false),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 for invalid JSON body', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
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
  });

  describe('classification flow', () => {
    it('returns 400 when no completed pages exist', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
        createMockDbClient([]),
      );

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('NO_COMPLETED_PAGES');
    });

    it('classifies pages and returns results with prompts', async () => {
      const pages = [
        createCompletedPage(1, 'Fill in the blanks: The cat sat on the ___'),
        createCompletedPage(2, 'Chapter 3: The Water Cycle explains evaporation'),
      ];

      const aiClient: ClassificationAiClient = {
        classifyPageContent: vi.fn()
          .mockResolvedValueOnce({ classification: 'exercise', confidence: 0.92 })
          .mockResolvedValueOnce({ classification: 'content', confidence: 0.88 }),
      };

      const dbClient = createMockDbClient(pages);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.classifications).toHaveLength(2);
      expect(body.classifications[0].classification).toBe('exercise');
      expect(body.classifications[0].prompt).toBe(
        'This page appears to contain exercises. Confirm?',
      );
      expect(body.classifications[1].classification).toBe('content');
      expect(body.summary.exercisePages).toBe(1);
      expect(body.summary.contentPages).toBe(1);
      expect(body.summary.uncertainPages).toBe(0);
    });

    it('marks pages as uncertain when AI classification fails', async () => {
      const pages = [createCompletedPage(1, 'Some text here')];

      const aiClient: ClassificationAiClient = {
        classifyPageContent: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      };

      const dbClient = createMockDbClient(pages);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.classifications[0].classification).toBe('uncertain');
      expect(body.classifications[0].confidence).toBe(0);
      expect(body.classifications[0].prompt).toContain('Please classify manually');
      expect(body.summary.uncertainPages).toBe(1);
    });

    it('handles uncertain classification from AI', async () => {
      const pages = [createCompletedPage(1, 'Mixed content with some questions maybe')];

      const aiClient = createMockAiClient({
        classification: 'uncertain',
        confidence: 0.45,
      });

      const dbClient = createMockDbClient(pages);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.classifications[0].classification).toBe('uncertain');
      expect(body.classifications[0].prompt).toContain('Please classify manually');
    });

    it('skips pages without extracted text', async () => {
      const pageWithText = createCompletedPage(1, 'Some content');
      const pageWithoutText: ChapterPageRecord = {
        ...createCompletedPage(2),
        extractedText: null,
        wordCount: 0,
      };

      const aiClient = createMockAiClient();
      const dbClient = createMockDbClient([pageWithText, pageWithoutText]);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Only the page with text should be classified
      expect(body.classifications).toHaveLength(1);
      expect(aiClient.classifyPageContent).toHaveBeenCalledTimes(1);
    });

    it('sorts classification results by page number', async () => {
      const pages = [
        createCompletedPage(3, 'Page 3 text'),
        createCompletedPage(1, 'Page 1 text'),
        createCompletedPage(2, 'Page 2 text'),
      ];

      const aiClient = createMockAiClient();
      const dbClient = createMockDbClient(pages);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      const body = JSON.parse(result.body);
      expect(body.classifications[0].pageNumber).toBe(1);
      expect(body.classifications[1].pageNumber).toBe(2);
      expect(body.classifications[2].pageNumber).toBe(3);
    });

    it('passes correct text and page number to AI client', async () => {
      const pages = [createCompletedPage(1, 'Question 1: What is photosynthesis?')];

      const aiClient = createMockAiClient();
      const dbClient = createMockDbClient(pages);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      await handler(event);

      expect(aiClient.classifyPageContent).toHaveBeenCalledWith({
        text: 'Question 1: What is photosynthesis?',
        pageNumber: 1,
      });
    });
  });

  describe('confirmation flow', () => {
    it('updates page exercise status when confirmedPages provided', async () => {
      const dbClient = createMockDbClient();
      const handler = createClassifyPagesHandler(createMockAiClient(), dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          confirmedPages: [
            { pageId: VALID_PAGE_ID, isExercise: true },
            { pageId: VALID_PAGE_ID_2, isExercise: false },
          ],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.updatedPages).toHaveLength(2);
      expect(body.updatedPages[0]).toEqual({
        pageId: VALID_PAGE_ID,
        isExercisePage: true,
      });
      expect(body.updatedPages[1]).toEqual({
        pageId: VALID_PAGE_ID_2,
        isExercisePage: false,
      });

      expect(dbClient.updatePageExerciseStatus).toHaveBeenCalledWith(VALID_PAGE_ID, true);
      expect(dbClient.updatePageExerciseStatus).toHaveBeenCalledWith(VALID_PAGE_ID_2, false);
    });

    it('returns 400 for invalid page ID in confirmation', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          confirmedPages: [{ pageId: 'bad-id', isExercise: true }],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_ID');
    });

    it('returns 400 when isExercise is not a boolean', async () => {
      const handler = createClassifyPagesHandler(
        createMockAiClient(),
        createMockDbClient(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          confirmedPages: [{ pageId: VALID_PAGE_ID, isExercise: 'yes' }],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_CONFIRMATION');
    });

    it('runs classification when confirmedPages is empty array', async () => {
      const pages = [createCompletedPage(1, 'Some text')];
      const aiClient = createMockAiClient();
      const dbClient = createMockDbClient(pages);
      const handler = createClassifyPagesHandler(aiClient, dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ confirmedPages: [] }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // Should go through classification flow since confirmedPages is empty
      expect(body.classifications).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('returns 500 for unexpected errors', async () => {
      const dbClient: ClassifyDbClient = {
        chapterExists: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        getCompletedPages: vi.fn(),
        updatePageExerciseStatus: vi.fn(),
      };

      const handler = createClassifyPagesHandler(createMockAiClient(), dbClient);

      const event = makeEvent({ pathParameters: { id: VALID_CHAPTER_ID } });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
