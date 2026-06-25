import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter, createDefaultRoutes, ApiRequest } from './endpoints';
import { clearContentStore } from './contentHandlers';
import { createTokenPair, getJwtConfig } from '@learnverse/service-auth';

describe('Content API Handlers (Textbooks, Chapters, Pages)', () => {
  let router: ApiRouter;
  const learnerId = 'test-learner-content';

  function makeRequest(method: 'GET' | 'POST', path: string, body?: unknown): ApiRequest {
    const jwtConfig = getJwtConfig();
    const { accessToken } = createTokenPair(learnerId, ['student'], jwtConfig);
    return {
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-learner-id': learnerId,
      },
      body,
    };
  }

  beforeEach(() => {
    clearContentStore();
    router = new ApiRouter();
    for (const route of createDefaultRoutes()) {
      router.register(route);
    }
  });

  describe('GET /api/v1/subjects/:subjectId/textbooks', () => {
    it('should return empty list when no textbooks exist', async () => {
      const res = await router.dispatch(makeRequest('GET', '/api/v1/subjects/english/textbooks'));
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(0);
    });

    it('should return textbooks for the subject', async () => {
      // Create a textbook first
      await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'English Grade 5' })
      );

      const res = await router.dispatch(makeRequest('GET', '/api/v1/subjects/english/textbooks'));
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(1);
      expect((res.body as any).data[0].name).toBe('English Grade 5');
    });

    it('should not return textbooks for a different subject', async () => {
      await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'English Book' })
      );

      const res = await router.dispatch(makeRequest('GET', '/api/v1/subjects/hindi/textbooks'));
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(0);
    });

    it('should require authentication', async () => {
      const req: ApiRequest = {
        method: 'GET',
        path: '/api/v1/subjects/english/textbooks',
        headers: { 'Content-Type': 'application/json' },
      };
      const res = await router.dispatch(req);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/subjects/:subjectId/textbooks', () => {
    it('should create a textbook with valid name', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'English Grade 5' })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.name).toBe('English Grade 5');
      expect((res.body as any).data.subjectId).toBe('english');
      expect((res.body as any).data.learnerId).toBe(learnerId);
      expect((res.body as any).data.id).toBeDefined();
    });

    it('should reject empty name', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: '' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      expect((res.body as any).field).toBe('name');
    });

    it('should reject whitespace-only name', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: '   ' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
    });

    it('should reject name exceeding 200 characters', async () => {
      const longName = 'A'.repeat(201);
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: longName })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      expect((res.body as any).field).toBe('name');
    });

    it('should preserve submitted values in validation error response (Req 4.9)', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: '' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).submittedValues).toBeDefined();
      expect((res.body as any).submittedValues.name).toBe('');
    });

    it('should trim whitespace from name', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: '  My Textbook  ' })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.name).toBe('My Textbook');
    });
  });

  describe('GET /api/v1/textbooks/:textbookId/chapters', () => {
    it('should return 404 when textbook does not exist', async () => {
      const res = await router.dispatch(
        makeRequest('GET', '/api/v1/textbooks/non-existent/chapters')
      );
      expect(res.status).toBe(404);
      expect((res.body as any).code).toBe('TEXTBOOK_NOT_FOUND');
    });

    it('should return empty chapters list for new textbook', async () => {
      const createRes = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'Textbook' })
      );
      const textbookId = (createRes.body as any).data.id;

      const res = await router.dispatch(
        makeRequest('GET', `/api/v1/textbooks/${textbookId}/chapters`)
      );
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(0);
    });

    it('should list chapters after creation', async () => {
      const createRes = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'Textbook' })
      );
      const textbookId = (createRes.body as any).data.id;

      await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: 'Chapter 1' })
      );

      const res = await router.dispatch(
        makeRequest('GET', `/api/v1/textbooks/${textbookId}/chapters`)
      );
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(1);
      expect((res.body as any).data[0].name).toBe('Chapter 1');
    });
  });

  describe('POST /api/v1/textbooks/:textbookId/chapters', () => {
    let textbookId: string;

    beforeEach(async () => {
      const createRes = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'My Textbook' })
      );
      textbookId = (createRes.body as any).data.id;
    });

    it('should create a chapter with valid name', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: 'Chapter 1' })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.name).toBe('Chapter 1');
      expect((res.body as any).data.textbookId).toBe(textbookId);
      expect((res.body as any).data.chapterNumber).toBe(1);
    });

    it('should auto-increment chapter numbers', async () => {
      await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: 'Chapter 1' })
      );
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: 'Chapter 2' })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.chapterNumber).toBe(2);
    });

    it('should reject empty chapter name', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: '' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      expect((res.body as any).field).toBe('name');
    });

    it('should reject chapter name exceeding 200 chars', async () => {
      const longName = 'B'.repeat(201);
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: longName })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent textbook', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/textbooks/fake-id/chapters', { name: 'Chapter 1' })
      );
      expect(res.status).toBe(404);
      expect((res.body as any).code).toBe('TEXTBOOK_NOT_FOUND');
    });

    it('should preserve submitted values in error response (Req 4.9)', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: '' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).submittedValues).toBeDefined();
      expect((res.body as any).submittedValues.name).toBe('');
    });
  });

  describe('POST /api/v1/chapters/:chapterId/pages', () => {
    let chapterId: string;

    beforeEach(async () => {
      const tbRes = await router.dispatch(
        makeRequest('POST', '/api/v1/subjects/english/textbooks', { name: 'Textbook' })
      );
      const textbookId = (tbRes.body as any).data.id;

      const chRes = await router.dispatch(
        makeRequest('POST', `/api/v1/textbooks/${textbookId}/chapters`, { name: 'Chapter 1' })
      );
      chapterId = (chRes.body as any).data.id;
    });

    it('should add a valid JPEG page', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/page1.jpg',
          imageSizeBytes: 1024,
          imageFormat: 'jpeg',
        })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.imageUri).toBe('/images/page1.jpg');
      expect((res.body as any).data.pageNumber).toBe(1);
      expect((res.body as any).data.imageFormat).toBe('jpeg');
    });

    it('should add a valid PNG page', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/page1.png',
          imageSizeBytes: 2048,
          imageFormat: 'png',
        })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.imageFormat).toBe('png');
    });

    it('should reject invalid image format', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/page1.gif',
          imageSizeBytes: 1024,
          imageFormat: 'gif',
        })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      expect((res.body as any).field).toBe('imageFormat');
    });

    it('should reject image exceeding 10 MB', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/huge.jpg',
          imageSizeBytes: 10_485_761, // 10 MB + 1 byte
          imageFormat: 'jpeg',
        })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      expect((res.body as any).field).toBe('imageSizeBytes');
    });

    it('should accept exactly 10 MB image', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/max.jpg',
          imageSizeBytes: 10_485_760, // exactly 10 MB
          imageFormat: 'jpeg',
        })
      );
      expect(res.status).toBe(201);
    });

    it('should return 404 for non-existent chapter', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/chapters/fake-chapter/pages', {
          imageUri: '/images/page.jpg',
          imageSizeBytes: 1024,
          imageFormat: 'jpeg',
        })
      );
      expect(res.status).toBe(404);
      expect((res.body as any).code).toBe('CHAPTER_NOT_FOUND');
    });

    it('should auto-increment page numbers', async () => {
      await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/page1.jpg',
          imageSizeBytes: 1024,
          imageFormat: 'jpeg',
        })
      );
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/page2.jpg',
          imageSizeBytes: 2048,
          imageFormat: 'png',
        })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).data.pageNumber).toBe(2);
    });

    it('should preserve submitted values in error response (Req 4.9)', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageUri: '/images/page.gif',
          imageSizeBytes: 500,
          imageFormat: 'gif',
        })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).submittedValues).toBeDefined();
      expect((res.body as any).submittedValues.imageUri).toBe('/images/page.gif');
      expect((res.body as any).submittedValues.imageSizeBytes).toBe(500);
      expect((res.body as any).submittedValues.imageFormat).toBe('gif');
    });

    it('should reject missing imageUri', async () => {
      const res = await router.dispatch(
        makeRequest('POST', `/api/v1/chapters/${chapterId}/pages`, {
          imageSizeBytes: 1024,
          imageFormat: 'jpeg',
        })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).field).toBe('imageUri');
    });
  });
});
