import { describe, it, expect, beforeEach } from 'vitest';
import {
  startLearningSession,
  selectSubject,
  selectChapter,
  startNewChapter,
  endCurrentChapter,
  endLearningSession,
  getCurrentSession,
  canAccessChapters,
  clearSessionStore,
} from './learningSession';
import {
  enrollSubject,
  clearEnrollmentStore,
  addChapterToSubject,
} from './enrollment';
import { Chapter } from './types';

describe('Learning Session Workflow', () => {
  const learnerId = 'learner-1';
  const subjectA = 'english';
  const subjectB = 'hindi';

  beforeEach(() => {
    clearSessionStore();
    clearEnrollmentStore();
  });

  describe('startLearningSession', () => {
    it('should fail if learner has no enrolled subjects', () => {
      const result = startLearningSession(learnerId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_SUBJECTS_ENROLLED');
      }
    });

    it('should start at subject_selection step with enrolled subjects listed', () => {
      enrollSubject(learnerId, subjectA);
      enrollSubject(learnerId, subjectB);

      const result = startLearningSession(learnerId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.currentStep).toBe('subject_selection');
        expect(result.value.selectedSubjectId).toBeNull();
        expect(result.value.selectedChapterId).toBeNull();
        expect(result.value.availableSubjects).toHaveLength(2);
        expect(result.value.availableSubjects.map((s) => s.subjectId)).toContain(subjectA);
        expect(result.value.availableSubjects.map((s) => s.subjectId)).toContain(subjectB);
      }
    });
  });

  describe('selectSubject', () => {
    it('should fail if no active session', () => {
      const result = selectSubject(learnerId, subjectA);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_ACTIVE_SESSION');
      }
    });

    it('should fail if subject is not enrolled', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);

      const result = selectSubject(learnerId, 'physics');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUBJECT_NOT_ENROLLED');
      }
    });

    it('should transition to chapter_selection and list available chapters', () => {
      enrollSubject(learnerId, subjectA);

      const chapter: Chapter = {
        id: 'ch-1',
        learnerId,
        subjectId: subjectA,
        textbookName: 'English Textbook',
        chapterNumber: 1,
        pages: [],
        extractedText: 'Hello world',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, subjectA, chapter);

      startLearningSession(learnerId);
      const result = selectSubject(learnerId, subjectA);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.currentStep).toBe('chapter_selection');
        expect(result.value.selectedSubjectId).toBe(subjectA);
        expect(result.value.availableChapters).toHaveLength(1);
        expect(result.value.availableChapters[0].id).toBe('ch-1');
      }
    });

    it('should allow re-selecting a different subject from chapter_selection', () => {
      enrollSubject(learnerId, subjectA);
      enrollSubject(learnerId, subjectB);
      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);

      const result = selectSubject(learnerId, subjectB);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.selectedSubjectId).toBe(subjectB);
        expect(result.value.currentStep).toBe('chapter_selection');
      }
    });

    it('should not allow subject change while in learning step', () => {
      enrollSubject(learnerId, subjectA);
      enrollSubject(learnerId, subjectB);

      const chapter: Chapter = {
        id: 'ch-1',
        learnerId,
        subjectId: subjectA,
        textbookName: 'English Textbook',
        chapterNumber: 1,
        pages: [],
        extractedText: 'Content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, subjectA, chapter);

      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);
      selectChapter(learnerId, 'ch-1');

      const result = selectSubject(learnerId, subjectB);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STEP');
      }
    });
  });

  describe('selectChapter', () => {
    it('should fail if session is at subject_selection step', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);

      const result = selectChapter(learnerId, 'ch-1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STEP');
        expect(result.error.message).toContain('select a subject first');
      }
    });

    it('should fail if chapter is not in the selected subject', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);

      const result = selectChapter(learnerId, 'nonexistent-chapter');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CHAPTER_NOT_FOUND');
      }
    });

    it('should transition to learning step on valid chapter selection', () => {
      enrollSubject(learnerId, subjectA);

      const chapter: Chapter = {
        id: 'ch-1',
        learnerId,
        subjectId: subjectA,
        textbookName: 'English Textbook',
        chapterNumber: 1,
        pages: [],
        extractedText: 'Content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, subjectA, chapter);

      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);
      const result = selectChapter(learnerId, 'ch-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.currentStep).toBe('learning');
        expect(result.value.selectedChapterId).toBe('ch-1');
      }
    });
  });

  describe('startNewChapter', () => {
    it('should fail if subject not selected yet', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);

      const result = startNewChapter(learnerId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_STEP');
      }
    });

    it('should transition to learning with null chapterId (new chapter flow)', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);

      const result = startNewChapter(learnerId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.currentStep).toBe('learning');
        expect(result.value.selectedChapterId).toBeNull();
      }
    });
  });

  describe('endCurrentChapter', () => {
    it('should return to chapter_selection step', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);
      startNewChapter(learnerId);

      const result = endCurrentChapter(learnerId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.currentStep).toBe('chapter_selection');
        expect(result.value.selectedChapterId).toBeNull();
      }
    });
  });

  describe('endLearningSession', () => {
    it('should remove the session', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);

      const result = endLearningSession(learnerId);
      expect(result.success).toBe(true);
      expect(getCurrentSession(learnerId)).toBeNull();
    });

    it('should fail if no session exists', () => {
      const result = endLearningSession(learnerId);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NO_ACTIVE_SESSION');
      }
    });
  });

  describe('canAccessChapters', () => {
    it('should return false with no session', () => {
      expect(canAccessChapters(learnerId)).toBe(false);
    });

    it('should return false at subject_selection step', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);
      expect(canAccessChapters(learnerId)).toBe(false);
    });

    it('should return true at chapter_selection step', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);
      expect(canAccessChapters(learnerId)).toBe(true);
    });

    it('should return true at learning step', () => {
      enrollSubject(learnerId, subjectA);
      startLearningSession(learnerId);
      selectSubject(learnerId, subjectA);
      startNewChapter(learnerId);
      expect(canAccessChapters(learnerId)).toBe(true);
    });
  });

  describe('Full workflow: subject → chapter → learning → end', () => {
    it('should enforce the complete subject-first flow', () => {
      // Setup: enroll and add a chapter
      enrollSubject(learnerId, subjectA);
      const chapter: Chapter = {
        id: 'ch-1',
        learnerId,
        subjectId: subjectA,
        textbookName: 'English Textbook',
        chapterNumber: 1,
        pages: [],
        extractedText: 'Content',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      };
      addChapterToSubject(learnerId, subjectA, chapter);

      // Step 1: Start session — must select subject
      const startResult = startLearningSession(learnerId);
      expect(startResult.success).toBe(true);
      if (startResult.success) {
        expect(startResult.value.currentStep).toBe('subject_selection');
      }

      // Cannot access chapters yet
      expect(canAccessChapters(learnerId)).toBe(false);

      // Step 2: Select subject — now can see chapters
      const subjectResult = selectSubject(learnerId, subjectA);
      expect(subjectResult.success).toBe(true);
      if (subjectResult.success) {
        expect(subjectResult.value.currentStep).toBe('chapter_selection');
        expect(subjectResult.value.availableChapters).toHaveLength(1);
      }

      // Can access chapters now
      expect(canAccessChapters(learnerId)).toBe(true);

      // Step 3: Select chapter — now learning
      const chapterResult = selectChapter(learnerId, 'ch-1');
      expect(chapterResult.success).toBe(true);
      if (chapterResult.success) {
        expect(chapterResult.value.currentStep).toBe('learning');
      }

      // Step 4: End chapter — back to chapter selection
      const endChapterResult = endCurrentChapter(learnerId);
      expect(endChapterResult.success).toBe(true);
      if (endChapterResult.success) {
        expect(endChapterResult.value.currentStep).toBe('chapter_selection');
      }

      // Step 5: End session
      const endResult = endLearningSession(learnerId);
      expect(endResult.success).toBe(true);
      expect(getCurrentSession(learnerId)).toBeNull();
    });
  });
});
