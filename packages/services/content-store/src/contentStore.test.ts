import { describe, it, expect, beforeEach } from 'vitest';
import { ContentStore, WEAK_ACTIVITY_THRESHOLD } from './contentStore';
import type { Chapter, ActivityType } from '@learnverse/service-core';

function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    learnerId: 'learner-1',
    subjectId: 'kannada',
    textbookName: 'Kannada Textbook',
    chapterNumber: 1,
    pages: [],
    extractedText: 'Sample text',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('ContentStore', () => {
  let store: ContentStore;

  beforeEach(() => {
    store = new ContentStore();
    store.registerSubjectType('kannada', true);
    store.registerSubjectType('maths', false);
    store.registerSubjectType('science', false);
    store.registerSubjectType('english', true);
  });

  // --- Task 5.1: Chapter Persistence ---

  describe('Chapter Persistence (Task 5.1)', () => {
    it('should save and retrieve a chapter', () => {
      const chapter = createChapter();
      const result = store.saveChapter(chapter);

      expect(result.success).toBe(true);

      const retrieved = store.getChapter('ch-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('ch-1');
      expect(retrieved!.learnerId).toBe('learner-1');
      expect(retrieved!.subjectId).toBe('kannada');
      expect(retrieved!.textbookName).toBe('Kannada Textbook');
      expect(retrieved!.chapterNumber).toBe(1);
    });

    it('should return null for non-existent chapter', () => {
      const retrieved = store.getChapter('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should associate chapter with learner and subject', () => {
      const chapter = createChapter({ subjectId: 'maths' });
      store.saveChapter(chapter);

      const retrieved = store.getChapter('ch-1');
      expect(retrieved!.subjectId).toBe('maths');
      expect(retrieved!.learnerId).toBe('learner-1');
    });

    it('should list chapters for a learner filtered by subject', () => {
      store.saveChapter(createChapter({ id: 'ch-1', subjectId: 'kannada', chapterNumber: 1 }));
      store.saveChapter(createChapter({ id: 'ch-2', subjectId: 'maths', chapterNumber: 1 }));
      store.saveChapter(createChapter({ id: 'ch-3', subjectId: 'kannada', chapterNumber: 2 }));

      const kannadaChapters = store.listChapters('learner-1', 'kannada');
      expect(kannadaChapters).toHaveLength(2);
      expect(kannadaChapters.every((ch) => ch.subjectId === 'kannada')).toBe(true);

      const mathsChapters = store.listChapters('learner-1', 'maths');
      expect(mathsChapters).toHaveLength(1);
      expect(mathsChapters[0].subjectId).toBe('maths');
    });

    it('should organize chapters by subject, textbook, and chapter number', () => {
      store.saveChapter(createChapter({ id: 'ch-3', textbookName: 'Book B', chapterNumber: 2 }));
      store.saveChapter(createChapter({ id: 'ch-1', textbookName: 'Book A', chapterNumber: 1 }));
      store.saveChapter(createChapter({ id: 'ch-2', textbookName: 'Book A', chapterNumber: 3 }));

      const chapters = store.listChapters('learner-1', 'kannada');
      expect(chapters[0].textbookName).toBe('Book A');
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[1].textbookName).toBe('Book A');
      expect(chapters[1].chapterNumber).toBe(3);
      expect(chapters[2].textbookName).toBe('Book B');
      expect(chapters[2].chapterNumber).toBe(2);
    });

    it('should list all chapters for a learner when no subject filter', () => {
      store.saveChapter(createChapter({ id: 'ch-1', subjectId: 'kannada' }));
      store.saveChapter(createChapter({ id: 'ch-2', subjectId: 'maths' }));

      const allChapters = store.listChapters('learner-1');
      expect(allChapters).toHaveLength(2);
    });

    it('should not return chapters from other learners', () => {
      store.saveChapter(createChapter({ id: 'ch-1', learnerId: 'learner-1' }));
      store.saveChapter(createChapter({ id: 'ch-2', learnerId: 'learner-2' }));

      const chapters = store.listChapters('learner-1');
      expect(chapters).toHaveLength(1);
      expect(chapters[0].id).toBe('ch-1');
    });

    it('should update lastAccessedAt on retrieval', () => {
      const chapter = createChapter({ lastAccessedAt: new Date('2024-01-01') });
      store.saveChapter(chapter);

      const before = new Date();
      const retrieved = store.getChapter('ch-1');
      expect(retrieved!.lastAccessedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // --- Task 5.3: Progress Tracking ---

  describe('Progress Tracking (Task 5.3)', () => {
    it('should track completion percentage per chapter', () => {
      store.registerSubjectType('kannada', true);
      // Language subject has 4 activities: comprehension, pronunciation, grammar, revision
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 80,
        completedAt: new Date(),
      });

      const progress = store.getProgress('learner-1', 'kannada');
      expect(progress.chapters).toHaveLength(1);
      // 1 out of 4 activities completed = 25%
      expect(progress.chapters[0].completionPercentage).toBe(25);
    });

    it('should track individual scores per activity type', () => {
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 85,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'grammar',
        score: 45,
        completedAt: new Date(),
      });

      const progress = store.getProgress('learner-1', 'kannada');
      const scores = progress.chapters[0].activityScores;
      expect(scores).toHaveLength(2);
      expect(scores.find((s) => s.activityType === 'comprehension')!.score).toBe(85);
      expect(scores.find((s) => s.activityType === 'grammar')!.score).toBe(45);
    });

    it('should track last accessed date', () => {
      const accessDate = new Date('2024-06-15');
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 70,
        completedAt: accessDate,
      });

      const progress = store.getProgress('learner-1', 'kannada');
      expect(progress.chapters[0].lastAccessedAt).toEqual(accessDate);
    });

    it('should identify weak activities (below 60%)', () => {
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 80,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'grammar',
        score: 45,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'pronunciation',
        score: 59,
        completedAt: new Date(),
      });

      const progress = store.getProgress('learner-1', 'kannada');
      const weak = progress.chapters[0].weakActivities;
      expect(weak).toContain('grammar');
      expect(weak).toContain('pronunciation');
      expect(weak).not.toContain('comprehension');
    });

    it('should not identify activities at exactly 60% as weak', () => {
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'grammar',
        score: 60,
        completedAt: new Date(),
      });

      const progress = store.getProgress('learner-1', 'kannada');
      expect(progress.chapters[0].weakActivities).not.toContain('grammar');
    });

    it('should calculate completion for non-language subjects correctly', () => {
      // Non-language subject has 2 activities: comprehension, revision
      store.trackProgress('learner-1', 'ch-1', 'maths', {
        activityType: 'comprehension',
        score: 90,
        completedAt: new Date(),
      });

      const progress = store.getProgress('learner-1', 'maths');
      // 1 out of 2 activities = 50%
      expect(progress.chapters[0].completionPercentage).toBe(50);
    });

    it('should update existing activity score on re-tracking', () => {
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 50,
        completedAt: new Date('2024-01-01'),
      });
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 90,
        completedAt: new Date('2024-02-01'),
      });

      const progress = store.getProgress('learner-1', 'kannada');
      const scores = progress.chapters[0].activityScores;
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(90);
    });

    it('should calculate overall completion percentage across chapters', () => {
      // Language subject: 4 activities each
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 80,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'grammar',
        score: 70,
        completedAt: new Date(),
      });
      // ch-1: 2/4 = 50%

      store.trackProgress('learner-1', 'ch-2', 'kannada', {
        activityType: 'comprehension',
        score: 90,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-2', 'kannada', {
        activityType: 'grammar',
        score: 60,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-2', 'kannada', {
        activityType: 'pronunciation',
        score: 75,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-2', 'kannada', {
        activityType: 'revision',
        score: 85,
        completedAt: new Date(),
      });
      // ch-2: 4/4 = 100%

      const progress = store.getProgress('learner-1', 'kannada');
      // Average: (50 + 100) / 2 = 75
      expect(progress.overallCompletionPercentage).toBe(75);
    });
  });

  // --- Task 5.5: Revision Material Presentation ---

  describe('Revision Material Presentation (Task 5.5)', () => {
    it('should present comprehension options for all subjects', () => {
      const mathsOptions = store.getRevisionOptions('maths');
      expect(mathsOptions.comprehension).toBe(true);

      const kannadaOptions = store.getRevisionOptions('kannada');
      expect(kannadaOptions.comprehension).toBe(true);
    });

    it('should add pronunciation and grammar options only for language subjects', () => {
      const kannadaOptions = store.getRevisionOptions('kannada');
      expect(kannadaOptions.pronunciation).toBe(true);
      expect(kannadaOptions.grammar).toBe(true);

      const mathsOptions = store.getRevisionOptions('maths');
      expect(mathsOptions.pronunciation).toBe(false);
      expect(mathsOptions.grammar).toBe(false);
    });

    it('should present revision materials with correct options per chapter', () => {
      store.saveChapter(createChapter({ id: 'ch-1', subjectId: 'kannada' }));
      store.saveChapter(createChapter({ id: 'ch-2', subjectId: 'kannada', chapterNumber: 2 }));

      const materials = store.getRevisionMaterials('learner-1', 'kannada');
      expect(materials).toHaveLength(2);
      expect(materials[0].options.pronunciation).toBe(true);
      expect(materials[0].options.grammar).toBe(true);
      expect(materials[0].options.comprehension).toBe(true);
    });

    it('should present non-language revision materials without pronunciation/grammar', () => {
      store.saveChapter(createChapter({ id: 'ch-1', subjectId: 'maths' }));

      const materials = store.getRevisionMaterials('learner-1', 'maths');
      expect(materials).toHaveLength(1);
      expect(materials[0].options.pronunciation).toBe(false);
      expect(materials[0].options.grammar).toBe(false);
      expect(materials[0].options.comprehension).toBe(true);
    });

    it('should aggregate progress summaries across enrolled subjects on dashboard', () => {
      store.saveChapter(createChapter({ id: 'ch-1', subjectId: 'kannada' }));
      store.saveChapter(createChapter({ id: 'ch-2', subjectId: 'maths' }));
      store.saveChapter(createChapter({ id: 'ch-3', subjectId: 'maths', chapterNumber: 2 }));

      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 80,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-2', 'maths', {
        activityType: 'comprehension',
        score: 90,
        completedAt: new Date(),
      });

      const dashboard = store.getDashboardProgress('learner-1', ['kannada', 'maths']);
      expect(dashboard.subjectSummaries).toHaveLength(2);

      const kannadaSummary = dashboard.subjectSummaries.find((s) => s.subjectId === 'kannada')!;
      expect(kannadaSummary.chapterCount).toBe(1);

      const mathsSummary = dashboard.subjectSummaries.find((s) => s.subjectId === 'maths')!;
      expect(mathsSummary.chapterCount).toBe(2);
    });

    it('should not cross-contaminate progress between subjects', () => {
      store.trackProgress('learner-1', 'ch-1', 'kannada', {
        activityType: 'comprehension',
        score: 80,
        completedAt: new Date(),
      });
      store.trackProgress('learner-1', 'ch-2', 'maths', {
        activityType: 'comprehension',
        score: 40,
        completedAt: new Date(),
      });

      const kannadaProgress = store.getProgress('learner-1', 'kannada');
      const mathsProgress = store.getProgress('learner-1', 'maths');

      // Kannada progress should not include maths scores
      expect(kannadaProgress.chapters).toHaveLength(1);
      expect(kannadaProgress.chapters[0].activityScores[0].score).toBe(80);

      // Maths progress should not include kannada scores
      expect(mathsProgress.chapters).toHaveLength(1);
      expect(mathsProgress.chapters[0].activityScores[0].score).toBe(40);
    });
  });

  // --- Task 5.7: Error Handling ---

  describe('Error Handling (Task 5.7)', () => {
    it('should display error on save failure and retain content locally', () => {
      const chapter = createChapter();
      const result = store.saveChapter(chapter, true); // simulate failure

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PERSISTENCE_FAILURE');
        expect(result.error.retryable).toBe(true);
        expect(result.error.message).toContain('retained locally');
      }

      // Chapter should be in retry queue
      const retryQueue = store.getLocalRetryQueue();
      expect(retryQueue).toHaveLength(1);
      expect(retryQueue[0].id).toBe('ch-1');

      // Chapter should NOT be in main store
      expect(store.getChapter('ch-1')).toBeNull();
    });

    it('should allow retry of failed save', () => {
      const chapter = createChapter();
      store.saveChapter(chapter, true); // simulate failure

      // Retry should succeed
      const retryResult = store.retrySave('ch-1');
      expect(retryResult.success).toBe(true);

      // Chapter should now be in main store
      expect(store.getChapter('ch-1')).not.toBeNull();

      // Retry queue should be empty
      expect(store.getLocalRetryQueue()).toHaveLength(0);
    });

    it('should return error when retrying non-existent chapter', () => {
      const result = store.retrySave('non-existent');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_IN_RETRY_QUEUE');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('should display guidance when no chapters stored for a subject', () => {
      const guidance = store.getNoContentGuidance('learner-1', 'kannada');
      expect(guidance).not.toBeNull();
      expect(guidance!.message).toContain('No chapters');
      expect(guidance!.suggestedAction).toContain('content ingestion');
    });

    it('should return null guidance when chapters exist', () => {
      store.saveChapter(createChapter({ subjectId: 'kannada' }));
      const guidance = store.getNoContentGuidance('learner-1', 'kannada');
      expect(guidance).toBeNull();
    });

    it('should retain multiple failed chapters in retry queue', () => {
      store.saveChapter(createChapter({ id: 'ch-1' }), true);
      store.saveChapter(createChapter({ id: 'ch-2' }), true);

      const retryQueue = store.getLocalRetryQueue();
      expect(retryQueue).toHaveLength(2);
    });

    it('should remove chapter from retry queue on successful save', () => {
      const chapter = createChapter();
      store.saveChapter(chapter, true); // fail first
      expect(store.getLocalRetryQueue()).toHaveLength(1);

      store.saveChapter(chapter, false); // succeed
      expect(store.getLocalRetryQueue()).toHaveLength(0);
    });
  });

  // --- Edge Cases ---

  describe('Edge Cases', () => {
    it('should handle empty progress records', () => {
      const progress = store.getProgress('learner-1', 'kannada');
      expect(progress.chapters).toHaveLength(0);
      expect(progress.overallCompletionPercentage).toBe(0);
    });

    it('should handle dashboard with no chapters in any subject', () => {
      const dashboard = store.getDashboardProgress('learner-1', ['kannada', 'maths']);
      expect(dashboard.subjectSummaries).toHaveLength(2);
      expect(dashboard.subjectSummaries[0].chapterCount).toBe(0);
      expect(dashboard.subjectSummaries[1].chapterCount).toBe(0);
      expect(dashboard.overallCompletionPercentage).toBe(0);
    });

    it('should handle subject with no registered type as non-language', () => {
      const options = store.getRevisionOptions('unknown-subject');
      expect(options.isLanguageSubject).toBe(false);
      expect(options.pronunciation).toBe(false);
      expect(options.grammar).toBe(false);
      expect(options.comprehension).toBe(true);
    });

    it('WEAK_ACTIVITY_THRESHOLD should be 60', () => {
      expect(WEAK_ACTIVITY_THRESHOLD).toBe(60);
    });
  });
});
