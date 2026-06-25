import { describe, it, expect, vi } from 'vitest';
import {
  createSaveTranscriptHandler,
  type TranscriptDbClient,
} from './saveTranscript';
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
    httpMethod: 'PUT',
    path: '/chapters/test/transcript',
    resource: '/chapters/{id}/transcript',
    ...overrides,
  };
}

function createMockDbClient(chapterExists = true): TranscriptDbClient {
  return {
    chapterExists: vi.fn().mockResolvedValue(chapterExists),
    updatePageText: vi.fn().mockResolvedValue(undefined),
    updateChapterContent: vi.fn().mockResolvedValue(undefined),
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_PAGE_ID_1 = '11111111-1111-1111-1111-111111111111';
const VALID_PAGE_ID_2 = '22222222-2222-2222-2222-222222222222';

function validPagesPayload() {
  return {
    pages: [
      { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 'Hello world from page one' },
      { pageId: VALID_PAGE_ID_2, pageNumber: 2, text: 'Second page content here today' },
    ],
  };
}

// ============================================================
// Tests
// ============================================================

describe('saveTranscript handler', () => {
  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid chapter ID format', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient(false));

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify(validPagesPayload()),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: null,
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('returns 400 for invalid JSON body', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: 'not-json{{{',
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('returns 400 for empty pages array', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pages: [] }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('returns 400 for missing pages field', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ notPages: [] }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('returns 400 for invalid page ID', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ pageId: 'bad-id', pageNumber: 1, text: 'hello' }],
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_ID');
    });

    it('returns 400 for invalid page number (zero)', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ pageId: VALID_PAGE_ID_1, pageNumber: 0, text: 'hello' }],
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_NUMBER');
    });

    it('returns 400 for non-integer page number', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ pageId: VALID_PAGE_ID_1, pageNumber: 1.5, text: 'hello' }],
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PAGE_NUMBER');
    });

    it('returns 400 for non-string text field', async () => {
      const handler = createSaveTranscriptHandler(createMockDbClient());

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 123 }],
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_TEXT');
    });
  });

  describe('successful transcript save', () => {
    it('updates page text and chapter metadata', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify(validPagesPayload()),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.chapterId).toBe(VALID_CHAPTER_ID);
      expect(body.updatedPages).toBe(2);
      expect(body.hasContent).toBe(true);
    });

    it('calculates correct total word count', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 'one two three' }, // 3 words
            { pageId: VALID_PAGE_ID_2, pageNumber: 2, text: 'four five' }, // 2 words
          ],
        }),
      });

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.totalWordCount).toBe(5);
    });

    it('handles empty text (zero word count)', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: '' },
          ],
        }),
      });

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.totalWordCount).toBe(0);
      expect(body.hasContent).toBe(true);
    });

    it('calls updatePageText for each page with correct word counts', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 'hello world' },
            { pageId: VALID_PAGE_ID_2, pageNumber: 2, text: 'one two three four' },
          ],
        }),
      });

      await handler(event);

      expect(dbClient.updatePageText).toHaveBeenCalledTimes(2);
      expect(dbClient.updatePageText).toHaveBeenCalledWith(VALID_PAGE_ID_1, 'hello world', 2);
      expect(dbClient.updatePageText).toHaveBeenCalledWith(VALID_PAGE_ID_2, 'one two three four', 4);
    });

    it('calls updateChapterContent with correct total word count', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 'hello world' }, // 2 words
            { pageId: VALID_PAGE_ID_2, pageNumber: 2, text: 'a b c' }, // 3 words
          ],
        }),
      });

      await handler(event);

      expect(dbClient.updateChapterContent).toHaveBeenCalledTimes(1);
      expect(dbClient.updateChapterContent).toHaveBeenCalledWith(VALID_CHAPTER_ID, true, 5);
    });

    it('handles text with extra whitespace correctly', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: '  hello   world  ' }, // 2 words
          ],
        }),
      });

      const result = await handler(event);
      const body = JSON.parse(result.body);

      expect(body.totalWordCount).toBe(2);
    });

    it('preserves unicode text content', async () => {
      const dbClient = createMockDbClient();
      const handler = createSaveTranscriptHandler(dbClient);

      const kannadaText = 'ಕನ್ನಡ ಭಾಷೆ ಸುಂದರ';
      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { pageId: VALID_PAGE_ID_1, pageNumber: 1, text: kannadaText },
          ],
        }),
      });

      await handler(event);

      expect(dbClient.updatePageText).toHaveBeenCalledWith(VALID_PAGE_ID_1, kannadaText, 3);
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected database error', async () => {
      const dbClient: TranscriptDbClient = {
        chapterExists: vi.fn().mockResolvedValue(true),
        updatePageText: vi.fn().mockRejectedValue(new Error('DB connection failed')),
        updateChapterContent: vi.fn().mockResolvedValue(undefined),
      };

      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 'hello' }],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('returns 500 on updateChapterContent failure', async () => {
      const dbClient: TranscriptDbClient = {
        chapterExists: vi.fn().mockResolvedValue(true),
        updatePageText: vi.fn().mockResolvedValue(undefined),
        updateChapterContent: vi.fn().mockRejectedValue(new Error('DB write failed')),
      };

      const handler = createSaveTranscriptHandler(dbClient);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ pageId: VALID_PAGE_ID_1, pageNumber: 1, text: 'hello' }],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
