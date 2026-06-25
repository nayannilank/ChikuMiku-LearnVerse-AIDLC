import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter, createDefaultRoutes, ApiRequest } from './endpoints';
import { clearEnrollmentStore, clearSessionStore, enrollSubject, addChapterToSubject } from '@learnverse/service-core';
import type { Chapter } from '@learnverse/service-core';
import { createTokenPair, getJwtConfig } from '@learnverse/service-auth';

describe('Learning Session API Handlers (Integration)', () => {
  let router: ApiRouter;
  const learnerId = 'test-learner-1';

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
    clearEnrollmentStore();
    clearSessionStore();
    router = new ApiRouter();
    for (const route of createDefaultRoutes()) {
      router.register(route);
    }
  });

  describe('POST /api/v1/subjects/:subjectId/enroll', () => {
    it('should enroll a learner in a subject', async () => {
      const res = await router.dispatch(makeRequest('POST', '/api/v1/subjects/english/enroll'));
      expect(res.status).toBe(200);
      expect((res.body as any).message).toContain('Enrolled successfully');
      expect((res.body as any).enrolledSubjects).toHaveLength(1);
    });

    it('should reject duplicate enrollment', async () => {
      await router.dispatch(makeRequest('POST', '/api/v1/subjects/english/enroll'));
      const res = await router.dispatch(makeRequest('POST', '/api/v1/subjects/english/enroll'));
      expect(res.status).toBe(409);
      expect((res.body as any).code).toBe('ALREADY_ENROLLED');
    });
  });

  describe('GET /api/v1/subjects', () => {
    it('should return empty list when no subjects enrolled', async () => {
      const res = await router.dispatch(makeRequest('GET', '/api/v1/subjects'));
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(0);
    });

    it('should return enrolled subjects', async () => {
      enrollSubject(learnerId, 'english');
      enrollSubject(learnerId, 'hindi');
      const res = await router.dispatch(makeRequest('GET', '/api/v1/subjects'));
      expect(res.status).toBe(200);
      expect((res.body as any).data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/learning/start', () => {
    it('should fail if no subjects enrolled', async () => {
      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('NO_SUBJECTS_ENROLLED');
      expect((res.body as any).suggestedAction).toContain('Enroll');
    });

    it('should start session with available subjects', async () => {
      enrollSubject(learnerId, 'english');
      enrollSubject(learnerId, 'hindi');

      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      expect(res.status).toBe(201);
      expect((res.body as any).step).toBe('subject_selection');
      expect((res.body as any).availableSubjects).toHaveLength(2);
    });
  });

  describe('POST /api/v1/learning/select-subject', () => {
    it('should fail without active session', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-subject', { subjectId: 'english' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('NO_ACTIVE_SESSION');
    });

    it('should fail with missing subjectId', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));

      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/select-subject', {}));
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('MISSING_FIELD');
    });

    it('should transition to chapter_selection with chapters listed', async () => {
      enrollSubject(learnerId, 'english');
      const chapter: Chapter = {
        id: 'ch-1',
        learnerId,
        subjectId: 'english',
        textbookName: 'English Grade 5',
        chapterNumber: 1,
        pages: [],
        extractedText: 'Hello',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, 'english', chapter);

      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-subject', { subjectId: 'english' })
      );

      expect(res.status).toBe(200);
      expect((res.body as any).step).toBe('chapter_selection');
      expect((res.body as any).selectedSubjectId).toBe('english');
      expect((res.body as any).availableChapters).toHaveLength(1);
      expect((res.body as any).availableChapters[0].id).toBe('ch-1');
    });
  });

  describe('POST /api/v1/learning/select-chapter', () => {
    it('should fail if subject not selected first', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));

      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-chapter', { chapterId: 'ch-1' })
      );
      expect(res.status).toBe(409);
      expect((res.body as any).code).toBe('INVALID_STEP');
    });

    it('should transition to learning on valid chapter', async () => {
      enrollSubject(learnerId, 'english');
      const chapter: Chapter = {
        id: 'ch-1',
        learnerId,
        subjectId: 'english',
        textbookName: 'English Grade 5',
        chapterNumber: 1,
        pages: [],
        extractedText: 'Content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, 'english', chapter);

      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-subject', { subjectId: 'english' })
      );
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-chapter', { chapterId: 'ch-1' })
      );

      expect(res.status).toBe(200);
      expect((res.body as any).step).toBe('learning');
      expect((res.body as any).selectedChapterId).toBe('ch-1');
    });
  });

  describe('POST /api/v1/learning/new-chapter', () => {
    it('should fail without subject selection', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));

      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/new-chapter'));
      expect(res.status).toBe(409);
    });

    it('should transition to learning after subject selected', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-subject', { subjectId: 'english' })
      );

      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/new-chapter'));
      expect(res.status).toBe(201);
      expect((res.body as any).step).toBe('learning');
      expect((res.body as any).selectedSubjectId).toBe('english');
    });
  });

  describe('POST /api/v1/learning/end-chapter', () => {
    it('should return to chapter_selection', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-subject', { subjectId: 'english' })
      );
      await router.dispatch(makeRequest('POST', '/api/v1/learning/new-chapter'));

      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/end-chapter'));
      expect(res.status).toBe(200);
      expect((res.body as any).step).toBe('chapter_selection');
    });
  });

  describe('POST /api/v1/learning/end', () => {
    it('should end the session', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));

      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/end'));
      expect(res.status).toBe(200);
      expect((res.body as any).message).toContain('ended');
    });

    it('should fail if no session exists', async () => {
      const res = await router.dispatch(makeRequest('POST', '/api/v1/learning/end'));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/learning/session', () => {
    it('should return null when no session', async () => {
      const res = await router.dispatch(makeRequest('GET', '/api/v1/learning/session'));
      expect(res.status).toBe(200);
      expect((res.body as any).session).toBeNull();
    });

    it('should return session state', async () => {
      enrollSubject(learnerId, 'english');
      await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));

      const res = await router.dispatch(makeRequest('GET', '/api/v1/learning/session'));
      expect(res.status).toBe(200);
      expect((res.body as any).session.currentStep).toBe('subject_selection');
      expect((res.body as any).session.availableSubjects).toHaveLength(1);
    });
  });

  describe('Full workflow through API', () => {
    it('should enforce subject → chapter → learning flow', async () => {
      // Enroll
      await router.dispatch(makeRequest('POST', '/api/v1/subjects/english/enroll'));

      // Add a chapter via enrollment service directly (simulating prior content)
      const chapter: Chapter = {
        id: 'ch-101',
        learnerId,
        subjectId: 'english',
        textbookName: 'English Grade 7',
        chapterNumber: 3,
        pages: [],
        extractedText: 'Vocabulary',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, 'english', chapter);

      // Start learning
      const startRes = await router.dispatch(makeRequest('POST', '/api/v1/learning/start'));
      expect(startRes.status).toBe(201);
      expect((startRes.body as any).step).toBe('subject_selection');

      // Select subject
      const subjectRes = await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-subject', { subjectId: 'english' })
      );
      expect(subjectRes.status).toBe(200);
      expect((subjectRes.body as any).step).toBe('chapter_selection');
      expect((subjectRes.body as any).availableChapters[0].id).toBe('ch-101');

      // Select chapter
      const chapterRes = await router.dispatch(
        makeRequest('POST', '/api/v1/learning/select-chapter', { chapterId: 'ch-101' })
      );
      expect(chapterRes.status).toBe(200);
      expect((chapterRes.body as any).step).toBe('learning');

      // End chapter
      const endChRes = await router.dispatch(makeRequest('POST', '/api/v1/learning/end-chapter'));
      expect(endChRes.status).toBe(200);
      expect((endChRes.body as any).step).toBe('chapter_selection');

      // End session
      const endRes = await router.dispatch(makeRequest('POST', '/api/v1/learning/end'));
      expect(endRes.status).toBe(200);
    });
  });
});
