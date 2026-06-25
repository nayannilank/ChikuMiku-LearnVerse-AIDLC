import { describe, it, expect, vi } from 'vitest';
import {
  createUploadPagesHandler,
  generateS3Key,
  type S3Client,
  type PagesDbClient,
  type UuidGenerator,
  type ChapterPageRecord,
} from './uploadPages';
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
    path: '/chapters/test/pages',
    resource: '/chapters/{id}/pages',
    ...overrides,
  };
}

function createMockS3Client(): S3Client {
  return {
    upload: vi.fn().mockResolvedValue({ key: 'mock-key' }),
  };
}

function createMockDbClient(existingPageCount = 0, chapterExists = true): PagesDbClient {
  return {
    getExistingPageCount: vi.fn().mockResolvedValue(existingPageCount),
    insertPages: vi.fn().mockResolvedValue(undefined),
    chapterExists: vi.fn().mockResolvedValue(chapterExists),
  };
}

function createMockUuidGenerator(): UuidGenerator {
  let counter = 0;
  return {
    generate: () => `00000000-0000-0000-0000-${String(++counter).padStart(12, '0')}`,
  };
}

const VALID_CHAPTER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function validPageData(): string {
  // Small base64-encoded "image" (well under 10MB)
  return Buffer.from('fake-image-data-for-testing').toString('base64');
}

// ============================================================
// Tests
// ============================================================

describe('uploadPages handler', () => {
  describe('generateS3Key', () => {
    it('generates correct S3 key pattern', () => {
      const key = generateS3Key('chapter-123', 1, 'uuid-abc', 'jpeg');
      expect(key).toBe('chapters/chapter-123/pages/1_uuid-abc.jpeg');
    });

    it('includes page number and format in key', () => {
      const key = generateS3Key('ch-id', 5, 'my-uuid', 'png');
      expect(key).toBe('chapters/ch-id/pages/5_my-uuid.png');
    });
  });

  describe('request validation', () => {
    it('returns 400 for missing chapter ID', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(),
        createMockUuidGenerator(),
      );

      const event = makeEvent({ pathParameters: null });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 400 for invalid chapter ID format', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(),
        createMockUuidGenerator(),
      );

      const event = makeEvent({ pathParameters: { id: 'not-a-uuid' } });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PARAMETER');
    });

    it('returns 404 when chapter does not exist', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(0, false),
        createMockUuidGenerator(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pages: [{ data: validPageData(), format: 'jpeg', pageNumber: 1 }] }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('CHAPTER_NOT_FOUND');
    });

    it('returns 400 for missing request body', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(),
        createMockUuidGenerator(),
      );

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
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(),
        createMockUuidGenerator(),
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

    it('returns 400 for empty pages array', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(),
        createMockUuidGenerator(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({ pages: [] }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('returns 400 for unsupported image format', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(),
        createMockUuidGenerator(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ data: validPageData(), format: 'gif', pageNumber: 1 }],
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_FORMAT');
    });

    it('returns 400 when page limit would be exceeded', async () => {
      const handler = createUploadPagesHandler(
        createMockS3Client(),
        createMockDbClient(48), // already 48 pages
        createMockUuidGenerator(),
      );

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { data: validPageData(), format: 'jpeg', pageNumber: 49 },
            { data: validPageData(), format: 'jpeg', pageNumber: 50 },
            { data: validPageData(), format: 'jpeg', pageNumber: 51 },
          ],
        }),
      });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('PAGE_LIMIT_EXCEEDED');
    });
  });

  describe('successful upload', () => {
    it('uploads pages to S3 and inserts DB records', async () => {
      const s3Client = createMockS3Client();
      const dbClient = createMockDbClient(0);
      const uuidGen = createMockUuidGenerator();

      const handler = createUploadPagesHandler(s3Client, dbClient, uuidGen);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [
            { data: validPageData(), format: 'jpeg', pageNumber: 1 },
            { data: validPageData(), format: 'png', pageNumber: 2 },
          ],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.uploadedPages).toHaveLength(2);
      expect(body.totalPages).toBe(2);

      // Verify S3 uploads
      expect(s3Client.upload).toHaveBeenCalledTimes(2);

      // Verify DB insert
      expect(dbClient.insertPages).toHaveBeenCalledTimes(1);
      const insertedPages = (dbClient.insertPages as ReturnType<typeof vi.fn>).mock.calls[0][0] as ChapterPageRecord[];
      expect(insertedPages).toHaveLength(2);
      expect(insertedPages[0].ocrStatus).toBe('pending');
      expect(insertedPages[0].pageNumber).toBe(1);
      expect(insertedPages[1].pageNumber).toBe(2);
    });

    it('generates correct S3 keys for uploaded pages', async () => {
      const s3Client = createMockS3Client();
      const dbClient = createMockDbClient(0);
      const uuidGen = createMockUuidGenerator();

      const handler = createUploadPagesHandler(s3Client, dbClient, uuidGen);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ data: validPageData(), format: 'jpeg', pageNumber: 1 }],
        }),
      });

      await handler(event);

      const uploadCall = (s3Client.upload as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(uploadCall.key).toMatch(/^chapters\/.*\/pages\/1_.*\.jpeg$/);
      expect(uploadCall.contentType).toBe('image/jpeg');
    });

    it('tracks total page count including existing pages', async () => {
      const s3Client = createMockS3Client();
      const dbClient = createMockDbClient(10); // 10 existing pages
      const uuidGen = createMockUuidGenerator();

      const handler = createUploadPagesHandler(s3Client, dbClient, uuidGen);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ data: validPageData(), format: 'jpeg', pageNumber: 11 }],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.totalPages).toBe(11); // 10 existing + 1 new
    });
  });

  describe('error handling', () => {
    it('returns 500 on unexpected S3 error', async () => {
      const s3Client: S3Client = {
        upload: vi.fn().mockRejectedValue(new Error('S3 connection failed')),
      };
      const dbClient = createMockDbClient(0);
      const uuidGen = createMockUuidGenerator();

      const handler = createUploadPagesHandler(s3Client, dbClient, uuidGen);

      const event = makeEvent({
        pathParameters: { id: VALID_CHAPTER_ID },
        body: JSON.stringify({
          pages: [{ data: validPageData(), format: 'jpeg', pageNumber: 1 }],
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
