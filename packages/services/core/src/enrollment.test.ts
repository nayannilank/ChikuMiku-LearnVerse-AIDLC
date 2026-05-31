import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_ENROLLED_SUBJECTS,
  clearEnrollmentStore,
  getEnrollmentState,
  initializeFromLearner,
  enrollSubject,
  unenrollSubject,
  switchActiveSubject,
  getActiveSubjectSpace,
  listEnrolledSubjects,
  addChapterToSubject,
  getChaptersForSubject,
  recordProgressForSubject,
  getProgressForSubject,
  getAggregateProgress,
} from './enrollment';
import { Learner, Chapter, ProgressRecord } from './types';

// --- Test Helpers ---

function createTestLearner(overrides: Partial<Learner> = {}): Learner {
  return {
    id: 'learner-1',
    displayName: 'Test Learner',
    contactType: 'email',
    contactValue: 'test@example.com',
    passwordHash: 'hashed',
    grade: 5,
    enrolledSubjects: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createTestChapter(subjectId: string, overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: `chapter-${Math.random().toString(36).slice(2, 8)}`,
    learnerId: 'learner-1',
    subjectId,
    textbookName: 'Test Textbook',
    chapterNumber: 1,
    pages: [],
    extractedText: 'Sample chapter content',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastAccessedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createTestProgress(
  subjectId: string,
  chapterId: string,
  overrides: Partial<ProgressRecord> = {}
): ProgressRecord {
  return {
    learnerId: 'learner-1',
    chapterId,
    subjectId,
    completionPercentage: 50,
    activityScores: [
      { activityType: 'comprehension', score: 75, completedAt: new Date('2024-01-15') },
    ],
    lastAccessedAt: new Date('2024-01-15'),
    ...overrides,
  };
}

describe('Enrollment Service', () => {
  beforeEach(() => {
    clearEnrollmentStore();
  });

  describe('enrollSubject', () => {
    it('should enroll a learner in a subject successfully', () => {
      const result = enrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.subjects.has('kannada')).toBe(true);
        expect(result.value.subjects.get('kannada')!.subjectId).toBe('kannada');
      }
    });

    it('should create an isolated subject space on enrollment', () => {
      const result = enrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(true);
      if (result.success) {
        const space = result.value.subjects.get('kannada')!;
        expect(space.chapters).toEqual([]);
        expect(space.progressRecords).toEqual([]);
        expect(space.activeChapterId).toBeNull();
      }
    });

    it('should set the first enrolled subject as active', () => {
      const result = enrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.activeSubjectId).toBe('kannada');
      }
    });

    it('should not change active subject when enrolling additional subjects', () => {
      enrollSubject('learner-1', 'kannada');
      const result = enrollSubject('learner-1', 'maths');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.activeSubjectId).toBe('kannada');
      }
    });

    it('should allow enrollment in up to 10 subjects', () => {
      for (let i = 1; i <= MAX_ENROLLED_SUBJECTS; i++) {
        const result = enrollSubject('learner-1', `subject-${i}`);
        expect(result.success).toBe(true);
      }

      const state = getEnrollmentState('learner-1');
      expect(state.subjects.size).toBe(MAX_ENROLLED_SUBJECTS);
    });

    it('should reject enrollment beyond 10 subjects', () => {
      for (let i = 1; i <= MAX_ENROLLED_SUBJECTS; i++) {
        enrollSubject('learner-1', `subject-${i}`);
      }

      const result = enrollSubject('learner-1', 'subject-11');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MAX_SUBJECTS_REACHED');
      }
    });

    it('should reject duplicate enrollment', () => {
      enrollSubject('learner-1', 'kannada');
      const result = enrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ALREADY_ENROLLED');
      }
    });

    it('should use provided timestamp for enrolledAt', () => {
      const enrollDate = new Date('2024-06-15');
      const result = enrollSubject('learner-1', 'kannada', enrollDate);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.subjects.get('kannada')!.enrolledAt).toEqual(enrollDate);
      }
    });
  });

  describe('unenrollSubject', () => {
    it('should remove a subject enrollment', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');

      const result = unenrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.subjects.has('kannada')).toBe(false);
        expect(result.value.subjects.has('maths')).toBe(true);
      }
    });

    it('should switch active subject when removing the active one', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');

      const result = unenrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.activeSubjectId).toBe('maths');
      }
    });

    it('should set active subject to null when removing the last subject', () => {
      enrollSubject('learner-1', 'kannada');

      const result = unenrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.activeSubjectId).toBeNull();
      }
    });

    it('should fail when unenrolling from a subject not enrolled in', () => {
      const result = unenrollSubject('learner-1', 'kannada');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_ENROLLED');
      }
    });

    it('should not affect other subjects when removing one', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');
      enrollSubject('learner-1', 'science');

      // Add content to maths and science
      const mathsChapter = createTestChapter('maths', { id: 'maths-ch1' });
      const scienceChapter = createTestChapter('science', { id: 'science-ch1' });
      addChapterToSubject('learner-1', 'maths', mathsChapter);
      addChapterToSubject('learner-1', 'science', scienceChapter);

      // Remove kannada
      unenrollSubject('learner-1', 'kannada');

      // Verify maths and science are unaffected
      const mathsResult = getChaptersForSubject('learner-1', 'maths');
      const scienceResult = getChaptersForSubject('learner-1', 'science');

      expect(mathsResult.success).toBe(true);
      expect(scienceResult.success).toBe(true);
      if (mathsResult.success) expect(mathsResult.value).toHaveLength(1);
      if (scienceResult.success) expect(scienceResult.value).toHaveLength(1);
    });
  });

  describe('switchActiveSubject (Requirement 10.6)', () => {
    it('should switch the active subject', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');

      const result = switchActiveSubject('learner-1', 'maths');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.activeSubjectId).toBe('maths');
      }
    });

    it('should fail when switching to a subject not enrolled in', () => {
      enrollSubject('learner-1', 'kannada');

      const result = switchActiveSubject('learner-1', 'maths');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_ENROLLED');
      }
    });

    it('should not affect content or progress when switching subjects', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');

      const kannadaChapter = createTestChapter('kannada', { id: 'kn-ch1' });
      addChapterToSubject('learner-1', 'kannada', kannadaChapter);

      // Switch to maths
      switchActiveSubject('learner-1', 'maths');

      // Verify kannada content is still intact
      const kannadaChapters = getChaptersForSubject('learner-1', 'kannada');
      expect(kannadaChapters.success).toBe(true);
      if (kannadaChapters.success) {
        expect(kannadaChapters.value).toHaveLength(1);
        expect(kannadaChapters.value[0].id).toBe('kn-ch1');
      }
    });
  });

  describe('getActiveSubjectSpace', () => {
    it('should return the active subject space', () => {
      enrollSubject('learner-1', 'kannada');

      const space = getActiveSubjectSpace('learner-1');

      expect(space).not.toBeNull();
      expect(space!.subjectId).toBe('kannada');
    });

    it('should return null when no subject is active', () => {
      const space = getActiveSubjectSpace('learner-1');
      expect(space).toBeNull();
    });
  });

  describe('listEnrolledSubjects', () => {
    it('should return empty array for a learner with no enrollments', () => {
      const subjects = listEnrolledSubjects('learner-1');
      expect(subjects).toEqual([]);
    });

    it('should return all enrolled subjects with enrollment dates', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-02-01');

      enrollSubject('learner-1', 'kannada', date1);
      enrollSubject('learner-1', 'maths', date2);

      const subjects = listEnrolledSubjects('learner-1');

      expect(subjects).toHaveLength(2);
      expect(subjects).toContainEqual({ subjectId: 'kannada', enrolledAt: date1 });
      expect(subjects).toContainEqual({ subjectId: 'maths', enrolledAt: date2 });
    });
  });

  describe('Subject Isolation - Content (Requirement 10.1, 10.2)', () => {
    beforeEach(() => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');
      enrollSubject('learner-1', 'science');
    });

    it('should store chapters in the correct subject space only', () => {
      const kannadaChapter = createTestChapter('kannada', { id: 'kn-ch1' });
      const mathsChapter = createTestChapter('maths', { id: 'math-ch1' });

      addChapterToSubject('learner-1', 'kannada', kannadaChapter);
      addChapterToSubject('learner-1', 'maths', mathsChapter);

      const kannadaResult = getChaptersForSubject('learner-1', 'kannada');
      const mathsResult = getChaptersForSubject('learner-1', 'maths');
      const scienceResult = getChaptersForSubject('learner-1', 'science');

      expect(kannadaResult.success && kannadaResult.value).toHaveLength(1);
      expect(mathsResult.success && mathsResult.value).toHaveLength(1);
      expect(scienceResult.success && scienceResult.value).toHaveLength(0);

      if (kannadaResult.success) expect(kannadaResult.value[0].id).toBe('kn-ch1');
      if (mathsResult.success) expect(mathsResult.value[0].id).toBe('math-ch1');
    });

    it('should reject chapters with mismatched subject ID', () => {
      const chapter = createTestChapter('maths', { id: 'math-ch1' });

      const result = addChapterToSubject('learner-1', 'kannada', chapter);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUBJECT_MISMATCH');
      }
    });

    it('should not affect other subjects when adding chapters to one', () => {
      // Add multiple chapters to kannada
      for (let i = 1; i <= 5; i++) {
        addChapterToSubject(
          'learner-1',
          'kannada',
          createTestChapter('kannada', { id: `kn-ch${i}`, chapterNumber: i })
        );
      }

      // Verify maths and science are unaffected
      const mathsResult = getChaptersForSubject('learner-1', 'maths');
      const scienceResult = getChaptersForSubject('learner-1', 'science');

      expect(mathsResult.success && mathsResult.value).toHaveLength(0);
      expect(scienceResult.success && scienceResult.value).toHaveLength(0);
    });

    it('should fail when adding chapter to unenrolled subject', () => {
      const chapter = createTestChapter('hindi', { id: 'hindi-ch1' });

      const result = addChapterToSubject('learner-1', 'hindi', chapter);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_ENROLLED');
      }
    });
  });

  describe('Subject Isolation - Progress (Requirement 10.1, 10.2)', () => {
    beforeEach(() => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');
    });

    it('should store progress in the correct subject space only', () => {
      const kannadaProgress = createTestProgress('kannada', 'kn-ch1', {
        completionPercentage: 80,
      });
      const mathsProgress = createTestProgress('maths', 'math-ch1', {
        completionPercentage: 60,
      });

      recordProgressForSubject('learner-1', 'kannada', kannadaProgress);
      recordProgressForSubject('learner-1', 'maths', mathsProgress);

      const kannadaResult = getProgressForSubject('learner-1', 'kannada');
      const mathsResult = getProgressForSubject('learner-1', 'maths');

      expect(kannadaResult.success && kannadaResult.value).toHaveLength(1);
      expect(mathsResult.success && mathsResult.value).toHaveLength(1);

      if (kannadaResult.success) {
        expect(kannadaResult.value[0].completionPercentage).toBe(80);
      }
      if (mathsResult.success) {
        expect(mathsResult.value[0].completionPercentage).toBe(60);
      }
    });

    it('should reject progress with mismatched subject ID', () => {
      const progress = createTestProgress('maths', 'math-ch1');

      const result = recordProgressForSubject('learner-1', 'kannada', progress);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUBJECT_MISMATCH');
      }
    });

    it('should update existing progress record for same chapter', () => {
      const progress1 = createTestProgress('kannada', 'kn-ch1', {
        completionPercentage: 30,
      });
      const progress2 = createTestProgress('kannada', 'kn-ch1', {
        completionPercentage: 80,
      });

      recordProgressForSubject('learner-1', 'kannada', progress1);
      recordProgressForSubject('learner-1', 'kannada', progress2);

      const result = getProgressForSubject('learner-1', 'kannada');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].completionPercentage).toBe(80);
      }
    });

    it('should not affect other subjects when recording progress', () => {
      // Record progress for kannada multiple times
      for (let i = 1; i <= 3; i++) {
        recordProgressForSubject(
          'learner-1',
          'kannada',
          createTestProgress('kannada', `kn-ch${i}`, { completionPercentage: i * 25 })
        );
      }

      // Verify maths progress is unaffected
      const mathsResult = getProgressForSubject('learner-1', 'maths');
      expect(mathsResult.success && mathsResult.value).toHaveLength(0);
    });
  });

  describe('Enrollment Limit Enforcement (Requirement 10.1)', () => {
    it('should enforce exactly 10 as the maximum', () => {
      expect(MAX_ENROLLED_SUBJECTS).toBe(10);
    });

    it('should allow exactly 10 enrollments', () => {
      const subjects = Array.from({ length: 10 }, (_, i) => `subject-${i + 1}`);

      for (const subject of subjects) {
        const result = enrollSubject('learner-1', subject);
        expect(result.success).toBe(true);
      }

      const enrolled = listEnrolledSubjects('learner-1');
      expect(enrolled).toHaveLength(10);
    });

    it('should reject the 11th enrollment attempt', () => {
      for (let i = 1; i <= 10; i++) {
        enrollSubject('learner-1', `subject-${i}`);
      }

      const result = enrollSubject('learner-1', 'subject-11');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MAX_SUBJECTS_REACHED');
        expect(result.error.message).toContain('10');
      }
    });

    it('should allow re-enrollment after unenrolling (back under limit)', () => {
      for (let i = 1; i <= 10; i++) {
        enrollSubject('learner-1', `subject-${i}`);
      }

      // Remove one
      unenrollSubject('learner-1', 'subject-5');

      // Should now allow a new enrollment
      const result = enrollSubject('learner-1', 'new-subject');
      expect(result.success).toBe(true);
    });
  });

  describe('initializeFromLearner', () => {
    it('should hydrate enrollment state from a Learner object', () => {
      const learner = createTestLearner({
        id: 'learner-1',
        enrolledSubjects: ['kannada', 'maths', 'science'],
      });

      const state = initializeFromLearner(learner);

      expect(state.subjects.size).toBe(3);
      expect(state.subjects.has('kannada')).toBe(true);
      expect(state.subjects.has('maths')).toBe(true);
      expect(state.subjects.has('science')).toBe(true);
    });

    it('should set first subject as active when initializing', () => {
      const learner = createTestLearner({
        id: 'learner-2',
        enrolledSubjects: ['hindi', 'english'],
      });

      const state = initializeFromLearner(learner);

      expect(state.activeSubjectId).not.toBeNull();
    });

    it('should not duplicate subjects already in state', () => {
      enrollSubject('learner-1', 'kannada');

      const learner = createTestLearner({
        id: 'learner-1',
        enrolledSubjects: ['kannada', 'maths'],
      });

      const state = initializeFromLearner(learner);

      expect(state.subjects.size).toBe(2);
    });
  });

  describe('getAggregateProgress (Requirement 10.7)', () => {
    it('should return aggregate progress across all enrolled subjects', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');

      // Add chapters and progress
      addChapterToSubject('learner-1', 'kannada', createTestChapter('kannada', { id: 'kn-ch1' }));
      addChapterToSubject('learner-1', 'kannada', createTestChapter('kannada', { id: 'kn-ch2' }));
      addChapterToSubject('learner-1', 'maths', createTestChapter('maths', { id: 'math-ch1' }));

      recordProgressForSubject(
        'learner-1',
        'kannada',
        createTestProgress('kannada', 'kn-ch1', { completionPercentage: 100 })
      );
      recordProgressForSubject(
        'learner-1',
        'kannada',
        createTestProgress('kannada', 'kn-ch2', { completionPercentage: 50 })
      );
      recordProgressForSubject(
        'learner-1',
        'maths',
        createTestProgress('maths', 'math-ch1', { completionPercentage: 80 })
      );

      const aggregate = getAggregateProgress('learner-1');

      expect(aggregate.size).toBe(2);

      const kannadaAgg = aggregate.get('kannada')!;
      expect(kannadaAgg.totalChapters).toBe(2);
      expect(kannadaAgg.completionPercentage).toBe(75); // (100 + 50) / 2

      const mathsAgg = aggregate.get('maths')!;
      expect(mathsAgg.totalChapters).toBe(1);
      expect(mathsAgg.completionPercentage).toBe(80);
    });

    it('should return zero values for subjects with no progress', () => {
      enrollSubject('learner-1', 'kannada');

      const aggregate = getAggregateProgress('learner-1');
      const kannadaAgg = aggregate.get('kannada')!;

      expect(kannadaAgg.totalChapters).toBe(0);
      expect(kannadaAgg.averageScore).toBe(0);
      expect(kannadaAgg.completionPercentage).toBe(0);
    });

    it('should not cross-contaminate progress between subjects', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');

      // Only add progress to kannada
      recordProgressForSubject(
        'learner-1',
        'kannada',
        createTestProgress('kannada', 'kn-ch1', {
          completionPercentage: 90,
          activityScores: [
            { activityType: 'comprehension', score: 95, completedAt: new Date() },
          ],
        })
      );

      const aggregate = getAggregateProgress('learner-1');

      const mathsAgg = aggregate.get('maths')!;
      expect(mathsAgg.averageScore).toBe(0);
      expect(mathsAgg.completionPercentage).toBe(0);
    });
  });

  describe('Cross-subject isolation - comprehensive (Requirement 10.1)', () => {
    it('should maintain complete isolation when enrolling, progressing, and removing subjects', () => {
      // Enroll in 3 subjects
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-1', 'maths');
      enrollSubject('learner-1', 'science');

      // Add content to each
      addChapterToSubject('learner-1', 'kannada', createTestChapter('kannada', { id: 'kn-1' }));
      addChapterToSubject('learner-1', 'maths', createTestChapter('maths', { id: 'math-1' }));
      addChapterToSubject('learner-1', 'science', createTestChapter('science', { id: 'sci-1' }));

      // Record progress for each
      recordProgressForSubject(
        'learner-1',
        'kannada',
        createTestProgress('kannada', 'kn-1', { completionPercentage: 40 })
      );
      recordProgressForSubject(
        'learner-1',
        'maths',
        createTestProgress('maths', 'math-1', { completionPercentage: 70 })
      );
      recordProgressForSubject(
        'learner-1',
        'science',
        createTestProgress('science', 'sci-1', { completionPercentage: 90 })
      );

      // Remove maths - should not affect kannada or science
      unenrollSubject('learner-1', 'maths');

      // Verify kannada is intact
      const kannadaChapters = getChaptersForSubject('learner-1', 'kannada');
      const kannadaProgress = getProgressForSubject('learner-1', 'kannada');
      expect(kannadaChapters.success && kannadaChapters.value).toHaveLength(1);
      expect(kannadaProgress.success && kannadaProgress.value).toHaveLength(1);
      if (kannadaProgress.success) {
        expect(kannadaProgress.value[0].completionPercentage).toBe(40);
      }

      // Verify science is intact
      const scienceChapters = getChaptersForSubject('learner-1', 'science');
      const scienceProgress = getProgressForSubject('learner-1', 'science');
      expect(scienceChapters.success && scienceChapters.value).toHaveLength(1);
      expect(scienceProgress.success && scienceProgress.value).toHaveLength(1);
      if (scienceProgress.success) {
        expect(scienceProgress.value[0].completionPercentage).toBe(90);
      }

      // Verify maths is gone
      const mathsChapters = getChaptersForSubject('learner-1', 'maths');
      expect(mathsChapters.success).toBe(false);
    });

    it('should isolate different learners enrollment states', () => {
      enrollSubject('learner-1', 'kannada');
      enrollSubject('learner-2', 'maths');

      const learner1Subjects = listEnrolledSubjects('learner-1');
      const learner2Subjects = listEnrolledSubjects('learner-2');

      expect(learner1Subjects).toHaveLength(1);
      expect(learner1Subjects[0].subjectId).toBe('kannada');

      expect(learner2Subjects).toHaveLength(1);
      expect(learner2Subjects[0].subjectId).toBe('maths');
    });
  });
});
