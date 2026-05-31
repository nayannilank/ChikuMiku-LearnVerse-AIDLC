/**
 * Unit tests for the Revision Mode Service.
 *
 * Tests cover:
 * - Revision session creation with chapter selection (Task 11.1)
 * - Question generation with difficulty distribution (Task 11.1)
 * - Timed test mode with time limit validation (Task 11.3)
 * - Auto-end on timeout with unattempted marking (Task 11.3)
 * - Performance summary with strengths/weaknesses (Task 11.5)
 * - Partial progress saving and resume (Task 11.5)
 * - Session result recording (Task 11.5)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import { describe, it, expect } from 'vitest';
import {
  getRevisionChapterOptions,
  isValidTimeLimit,
  generateRevisionQuestions,
  createRevisionSession,
  startTimedTest,
  isSessionTimedOut,
  endTimedSession,
  savePartialProgress,
  endSession,
  generatePerformanceSummary,
  createSessionResult,
  InvalidTimeLimitError,
  InvalidQuestionCountError,
  NoChaptersSelectedError,
  MIN_QUESTIONS_PER_CHAPTER,
  MAX_QUESTIONS_PER_CHAPTER,
  MIN_TIME_LIMIT_MINUTES,
  MAX_TIME_LIMIT_MINUTES,
  STRENGTH_THRESHOLD,
} from './revisionMode';
import {
  Chapter,
  RevisionSession,
  RevisionQuestion,
  SubjectModuleRegistry,
  SubjectModule,
} from '@chikumiku/service-core';

// --- Test Helpers ---

function createTestChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'chapter-1',
    learnerId: 'learner-1',
    subjectId: 'science',
    textbookName: 'General Science',
    chapterNumber: 1,
    pages: [],
    extractedText:
      'Photosynthesis is the process by which green plants make food using sunlight. ' +
      'Plants absorb carbon dioxide from the air and water from the soil.',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
    ...overrides,
  };
}

function createMockSubjectModule(subjectId = 'science'): SubjectModule {
  return {
    subjectId,
    name: 'Science',
    contentTypes: ['text'],
    extractionPipeline: {
      pipelineId: `${subjectId}-extraction`,
      supportedContentTypes: ['text'],
      extract: async () => ({
        extractedText: 'Extracted text.',
        confidence: 0.95,
      }),
    },
    questionGenerationStrategy: {
      strategyId: `${subjectId}-questions`,
      supportedQuestionTypes: ['short-answer', 'fill-in-the-blank', 'descriptive'],
      generateQuestions: async (_content, count, difficulty) => {
        const questions = [];
        for (let i = 0; i < count; i++) {
          questions.push({
            text: `Question about ${difficulty}`,
            type: 'short-answer',
            modelAnswer: 'Model answer',
            difficulty: difficulty || 'recall',
          });
        }
        return questions;
      },
    },
    renderingConfig: {
      displayName: 'Science',
      isLanguageSubject: false,
    },
  };
}

function createTestRegistry(subjectId = 'science'): SubjectModuleRegistry {
  const registry = new SubjectModuleRegistry();
  registry.register(createMockSubjectModule(subjectId));
  return registry;
}

function createTestSession(overrides: Partial<RevisionSession> = {}): RevisionSession {
  return {
    id: 'session-1',
    learnerId: 'learner-1',
    subjectId: 'science',
    chapterIds: ['chapter-1', 'chapter-2'],
    questions: [
      { questionId: 'q1', chapterId: 'chapter-1', difficulty: 'recall', isAttempted: true, score: 80, learnerAnswer: 'answer1' },
      { questionId: 'q2', chapterId: 'chapter-1', difficulty: 'understanding', isAttempted: true, score: 60, learnerAnswer: 'answer2' },
      { questionId: 'q3', chapterId: 'chapter-1', difficulty: 'application', isAttempted: false },
      { questionId: 'q4', chapterId: 'chapter-2', difficulty: 'recall', isAttempted: true, score: 90, learnerAnswer: 'answer4' },
      { questionId: 'q5', chapterId: 'chapter-2', difficulty: 'understanding', isAttempted: true, score: 75, learnerAnswer: 'answer5' },
      { questionId: 'q6', chapterId: 'chapter-2', difficulty: 'application', isAttempted: true, score: 85, learnerAnswer: 'answer6' },
    ],
    startedAt: new Date('2024-01-01T10:00:00Z'),
    isPartial: false,
    perChapterScores: {},
    ...overrides,
  };
}

// --- Tests ---

describe('Revision Mode Service', () => {
  describe('getRevisionChapterOptions (Task 11.1)', () => {
    it('returns chapters filtered by subject', () => {
      const chapters: Chapter[] = [
        createTestChapter({ id: 'ch-1', subjectId: 'science' }),
        createTestChapter({ id: 'ch-2', subjectId: 'maths' }),
        createTestChapter({ id: 'ch-3', subjectId: 'science' }),
      ];

      const options = getRevisionChapterOptions(chapters, 'science');
      expect(options).toHaveLength(2);
      expect(options.every((o) => o.subjectId === 'science')).toBe(true);
    });

    it('returns empty array when no chapters match subject', () => {
      const chapters: Chapter[] = [
        createTestChapter({ id: 'ch-1', subjectId: 'maths' }),
      ];

      const options = getRevisionChapterOptions(chapters, 'science');
      expect(options).toHaveLength(0);
    });

    it('sorts chapters by textbook name then chapter number', () => {
      const chapters: Chapter[] = [
        createTestChapter({ id: 'ch-3', textbookName: 'Biology', chapterNumber: 3 }),
        createTestChapter({ id: 'ch-1', textbookName: 'Biology', chapterNumber: 1 }),
        createTestChapter({ id: 'ch-2', textbookName: 'Anatomy', chapterNumber: 2 }),
      ];

      const options = getRevisionChapterOptions(chapters, 'science');
      expect(options[0].textbookName).toBe('Anatomy');
      expect(options[1].chapterNumber).toBe(1);
      expect(options[2].chapterNumber).toBe(3);
    });

    it('includes textbook name and chapter number in options', () => {
      const chapters: Chapter[] = [
        createTestChapter({ id: 'ch-1', textbookName: 'Physics', chapterNumber: 5 }),
      ];

      const options = getRevisionChapterOptions(chapters, 'science');
      expect(options[0]).toEqual({
        chapterId: 'ch-1',
        textbookName: 'Physics',
        chapterNumber: 5,
        subjectId: 'science',
      });
    });
  });

  describe('isValidTimeLimit (Task 11.3)', () => {
    it('accepts minimum time limit (5 minutes)', () => {
      expect(isValidTimeLimit(5)).toBe(true);
    });

    it('accepts maximum time limit (120 minutes)', () => {
      expect(isValidTimeLimit(120)).toBe(true);
    });

    it('accepts values within range', () => {
      expect(isValidTimeLimit(30)).toBe(true);
      expect(isValidTimeLimit(60)).toBe(true);
      expect(isValidTimeLimit(90)).toBe(true);
    });

    it('rejects values below minimum', () => {
      expect(isValidTimeLimit(4)).toBe(false);
      expect(isValidTimeLimit(0)).toBe(false);
      expect(isValidTimeLimit(-1)).toBe(false);
    });

    it('rejects values above maximum', () => {
      expect(isValidTimeLimit(121)).toBe(false);
      expect(isValidTimeLimit(200)).toBe(false);
    });

    it('rejects non-integer values', () => {
      expect(isValidTimeLimit(5.5)).toBe(false);
      expect(isValidTimeLimit(10.1)).toBe(false);
    });

    it('rejects NaN and Infinity', () => {
      expect(isValidTimeLimit(NaN)).toBe(false);
      expect(isValidTimeLimit(Infinity)).toBe(false);
    });
  });

  describe('generateRevisionQuestions (Task 11.1)', () => {
    it('generates questions for each chapter', async () => {
      const chapters = [
        createTestChapter({ id: 'ch-1' }),
        createTestChapter({ id: 'ch-2' }),
      ];
      const registry = createTestRegistry();

      const questions = await generateRevisionQuestions(chapters, 5, registry);
      const ch1Questions = questions.filter((q) => q.chapterId === 'ch-1');
      const ch2Questions = questions.filter((q) => q.chapterId === 'ch-2');

      expect(ch1Questions.length).toBe(5);
      expect(ch2Questions.length).toBe(5);
    });

    it('ensures at least 1 question per difficulty level per chapter', async () => {
      const chapters = [createTestChapter({ id: 'ch-1' })];
      const registry = createTestRegistry();

      const questions = await generateRevisionQuestions(chapters, 5, registry);
      const difficulties = questions.map((q) => q.difficulty);

      expect(difficulties).toContain('recall');
      expect(difficulties).toContain('understanding');
      expect(difficulties).toContain('application');
    });

    it('throws InvalidQuestionCountError for count below minimum', async () => {
      const chapters = [createTestChapter()];
      const registry = createTestRegistry();

      await expect(
        generateRevisionQuestions(chapters, 4, registry)
      ).rejects.toThrow(InvalidQuestionCountError);
    });

    it('throws InvalidQuestionCountError for count above maximum', async () => {
      const chapters = [createTestChapter()];
      const registry = createTestRegistry();

      await expect(
        generateRevisionQuestions(chapters, 21, registry)
      ).rejects.toThrow(InvalidQuestionCountError);
    });

    it('generates questions with isAttempted set to false', async () => {
      const chapters = [createTestChapter()];
      const registry = createTestRegistry();

      const questions = await generateRevisionQuestions(chapters, 5, registry);
      expect(questions.every((q) => q.isAttempted === false)).toBe(true);
    });

    it('generates between 5 and 20 questions per chapter', async () => {
      const chapters = [createTestChapter()];
      const registry = createTestRegistry();

      for (const count of [5, 10, 15, 20]) {
        const questions = await generateRevisionQuestions(chapters, count, registry);
        expect(questions.length).toBe(count);
      }
    });
  });

  describe('createRevisionSession (Task 11.1)', () => {
    it('creates a session with generated questions', async () => {
      const chapters = [
        createTestChapter({ id: 'ch-1' }),
        createTestChapter({ id: 'ch-2' }),
      ];
      const registry = createTestRegistry();

      const session = await createRevisionSession(
        {
          learnerId: 'learner-1',
          subjectId: 'science',
          chapterIds: ['ch-1', 'ch-2'],
          questionsPerChapter: 5,
        },
        chapters,
        registry
      );

      expect(session.learnerId).toBe('learner-1');
      expect(session.subjectId).toBe('science');
      expect(session.chapterIds).toEqual(['ch-1', 'ch-2']);
      expect(session.questions.length).toBe(10); // 5 per chapter × 2 chapters
      expect(session.isPartial).toBe(false);
      expect(session.startedAt).toBeInstanceOf(Date);
    });

    it('throws NoChaptersSelectedError when no chapters selected', async () => {
      const registry = createTestRegistry();

      await expect(
        createRevisionSession(
          { learnerId: 'l1', subjectId: 'science', chapterIds: [] },
          [],
          registry
        )
      ).rejects.toThrow(NoChaptersSelectedError);
    });

    it('defaults to 10 questions per chapter when not specified', async () => {
      const chapters = [createTestChapter({ id: 'ch-1' })];
      const registry = createTestRegistry();

      const session = await createRevisionSession(
        { learnerId: 'l1', subjectId: 'science', chapterIds: ['ch-1'] },
        chapters,
        registry
      );

      expect(session.questions.length).toBe(10);
    });

    it('validates time limit when provided', async () => {
      const chapters = [createTestChapter({ id: 'ch-1' })];
      const registry = createTestRegistry();

      await expect(
        createRevisionSession(
          { learnerId: 'l1', subjectId: 'science', chapterIds: ['ch-1'], timeLimitMinutes: 3 },
          chapters,
          registry
        )
      ).rejects.toThrow(InvalidTimeLimitError);
    });

    it('sets timeLimitMinutes on session when provided', async () => {
      const chapters = [createTestChapter({ id: 'ch-1' })];
      const registry = createTestRegistry();

      const session = await createRevisionSession(
        { learnerId: 'l1', subjectId: 'science', chapterIds: ['ch-1'], timeLimitMinutes: 30 },
        chapters,
        registry
      );

      expect(session.timeLimitMinutes).toBe(30);
    });
  });

  describe('startTimedTest (Task 11.3)', () => {
    it('creates a timed session with valid time limit', async () => {
      const chapters = [createTestChapter({ id: 'ch-1' })];
      const registry = createTestRegistry();

      const session = await startTimedTest(
        { learnerId: 'l1', subjectId: 'science', chapterIds: ['ch-1'], timeLimitMinutes: 60 },
        chapters,
        registry
      );

      expect(session.timeLimitMinutes).toBe(60);
      expect(session.questions.length).toBeGreaterThan(0);
    });

    it('throws InvalidTimeLimitError for invalid time limit', async () => {
      const chapters = [createTestChapter({ id: 'ch-1' })];
      const registry = createTestRegistry();

      await expect(
        startTimedTest(
          { learnerId: 'l1', subjectId: 'science', chapterIds: ['ch-1'], timeLimitMinutes: 200 },
          chapters,
          registry
        )
      ).rejects.toThrow(InvalidTimeLimitError);
    });
  });

  describe('isSessionTimedOut (Task 11.3)', () => {
    it('returns false when no time limit is set', () => {
      const session = createTestSession({ timeLimitMinutes: undefined });
      const currentTime = new Date('2024-01-01T12:00:00Z');
      expect(isSessionTimedOut(session, currentTime)).toBe(false);
    });

    it('returns false when time limit has not been reached', () => {
      const session = createTestSession({ timeLimitMinutes: 60 });
      // 30 minutes after start
      const currentTime = new Date('2024-01-01T10:30:00Z');
      expect(isSessionTimedOut(session, currentTime)).toBe(false);
    });

    it('returns true when time limit is exactly reached', () => {
      const session = createTestSession({ timeLimitMinutes: 60 });
      // Exactly 60 minutes after start
      const currentTime = new Date('2024-01-01T11:00:00Z');
      expect(isSessionTimedOut(session, currentTime)).toBe(true);
    });

    it('returns true when time limit is exceeded', () => {
      const session = createTestSession({ timeLimitMinutes: 30 });
      // 45 minutes after start
      const currentTime = new Date('2024-01-01T10:45:00Z');
      expect(isSessionTimedOut(session, currentTime)).toBe(true);
    });
  });

  describe('endTimedSession (Task 11.3)', () => {
    it('marks session as completed', () => {
      const session = createTestSession({ timeLimitMinutes: 30 });
      const ended = endTimedSession(session);
      expect(ended.completedAt).toBeInstanceOf(Date);
      expect(ended.isPartial).toBe(false);
    });

    it('preserves unanswered questions as unattempted', () => {
      const session = createTestSession();
      const ended = endTimedSession(session);
      const unattempted = ended.questions.filter((q) => !q.isAttempted);
      expect(unattempted.length).toBe(1); // q3 was unattempted
      expect(unattempted[0].questionId).toBe('q3');
    });

    it('calculates per-chapter scores based on answered questions only', () => {
      const session = createTestSession();
      const ended = endTimedSession(session);

      // chapter-1: q1 (80) + q2 (60) = 140/2 = 70 (q3 unattempted, excluded)
      expect(ended.perChapterScores['chapter-1']).toBe(70);
      // chapter-2: q4 (90) + q5 (75) + q6 (85) = 250/3 ≈ 83
      expect(ended.perChapterScores['chapter-2']).toBe(83);
    });
  });

  describe('savePartialProgress (Task 11.5)', () => {
    it('updates questions with provided answers', () => {
      const session = createTestSession({
        questions: [
          { questionId: 'q1', chapterId: 'ch-1', difficulty: 'recall', isAttempted: false },
          { questionId: 'q2', chapterId: 'ch-1', difficulty: 'understanding', isAttempted: false },
        ],
      });

      const updated = savePartialProgress(session, [
        { questionId: 'q1', answer: 'my answer', score: 75 },
      ]);

      expect(updated.questions[0].isAttempted).toBe(true);
      expect(updated.questions[0].learnerAnswer).toBe('my answer');
      expect(updated.questions[0].score).toBe(75);
      expect(updated.questions[1].isAttempted).toBe(false);
    });

    it('marks session as partial', () => {
      const session = createTestSession({
        questions: [
          { questionId: 'q1', chapterId: 'ch-1', difficulty: 'recall', isAttempted: false },
        ],
      });

      const updated = savePartialProgress(session, [
        { questionId: 'q1', answer: 'answer', score: 50 },
      ]);

      expect(updated.isPartial).toBe(true);
    });

    it('calculates per-chapter scores from answered questions', () => {
      const session = createTestSession({
        chapterIds: ['ch-1'],
        questions: [
          { questionId: 'q1', chapterId: 'ch-1', difficulty: 'recall', isAttempted: false },
          { questionId: 'q2', chapterId: 'ch-1', difficulty: 'understanding', isAttempted: false },
        ],
      });

      const updated = savePartialProgress(session, [
        { questionId: 'q1', answer: 'a', score: 80 },
      ]);

      // Only q1 is answered: score = 80
      expect(updated.perChapterScores['ch-1']).toBe(80);
    });

    it('preserves unanswered questions unchanged', () => {
      const session = createTestSession({
        questions: [
          { questionId: 'q1', chapterId: 'ch-1', difficulty: 'recall', isAttempted: false },
          { questionId: 'q2', chapterId: 'ch-1', difficulty: 'understanding', isAttempted: false },
        ],
      });

      const updated = savePartialProgress(session, [
        { questionId: 'q1', answer: 'a', score: 60 },
      ]);

      expect(updated.questions[1].isAttempted).toBe(false);
      expect(updated.questions[1].learnerAnswer).toBeUndefined();
      expect(updated.questions[1].score).toBeUndefined();
    });
  });

  describe('endSession (Task 11.5)', () => {
    it('marks session as partial on early exit', () => {
      const session = createTestSession();
      const ended = endSession(session, true);
      expect(ended.isPartial).toBe(true);
      expect(ended.completedAt).toBeInstanceOf(Date);
    });

    it('marks session as complete on normal end', () => {
      const session = createTestSession();
      const ended = endSession(session, false);
      expect(ended.isPartial).toBe(false);
      expect(ended.completedAt).toBeInstanceOf(Date);
    });

    it('calculates per-chapter scores', () => {
      const session = createTestSession();
      const ended = endSession(session, false);
      expect(ended.perChapterScores['chapter-1']).toBe(70);
      expect(ended.perChapterScores['chapter-2']).toBe(83);
    });
  });

  describe('generatePerformanceSummary (Task 11.5)', () => {
    it('classifies chapters with score >= 70% as strengths', () => {
      const session = createTestSession();
      const summary = generatePerformanceSummary(session);

      // chapter-1: (80+60)/2 = 70 → strength (>= 70)
      // chapter-2: (90+75+85)/3 ≈ 83 → strength
      expect(summary.strengths).toContain('chapter-1');
      expect(summary.strengths).toContain('chapter-2');
    });

    it('classifies chapters with score < 70% as weak areas', () => {
      const session = createTestSession({
        questions: [
          { questionId: 'q1', chapterId: 'chapter-1', difficulty: 'recall', isAttempted: true, score: 50, learnerAnswer: 'a' },
          { questionId: 'q2', chapterId: 'chapter-1', difficulty: 'understanding', isAttempted: true, score: 40, learnerAnswer: 'b' },
          { questionId: 'q3', chapterId: 'chapter-2', difficulty: 'recall', isAttempted: true, score: 90, learnerAnswer: 'c' },
        ],
      });

      const summary = generatePerformanceSummary(session);
      // chapter-1: (50+40)/2 = 45 → weak
      // chapter-2: 90 → strength
      expect(summary.weakAreas).toContain('chapter-1');
      expect(summary.strengths).toContain('chapter-2');
    });

    it('calculates overall score from answered questions only', () => {
      const session = createTestSession();
      const summary = generatePerformanceSummary(session);

      // Answered: q1(80) + q2(60) + q4(90) + q5(75) + q6(85) = 390/5 = 78
      expect(summary.overallScore).toBe(78);
    });

    it('counts total, answered, and unattempted questions', () => {
      const session = createTestSession();
      const summary = generatePerformanceSummary(session);

      expect(summary.totalQuestions).toBe(6);
      expect(summary.answeredQuestions).toBe(5);
      expect(summary.unattemptedQuestions).toBe(1);
    });

    it('handles session with no answered questions', () => {
      const session = createTestSession({
        questions: [
          { questionId: 'q1', chapterId: 'chapter-1', difficulty: 'recall', isAttempted: false },
          { questionId: 'q2', chapterId: 'chapter-2', difficulty: 'recall', isAttempted: false },
        ],
      });

      const summary = generatePerformanceSummary(session);
      expect(summary.overallScore).toBe(0);
      expect(summary.answeredQuestions).toBe(0);
      expect(summary.unattemptedQuestions).toBe(2);
      expect(summary.weakAreas).toContain('chapter-1');
      expect(summary.weakAreas).toContain('chapter-2');
    });

    it('reflects partial status from session', () => {
      const session = createTestSession({ isPartial: true });
      const summary = generatePerformanceSummary(session);
      expect(summary.isPartial).toBe(true);
    });

    it('includes session ID in summary', () => {
      const session = createTestSession({ id: 'my-session-123' });
      const summary = generatePerformanceSummary(session);
      expect(summary.sessionId).toBe('my-session-123');
    });
  });

  describe('createSessionResult (Task 11.5)', () => {
    it('creates a result record with all session data', () => {
      const session = createTestSession({
        completedAt: new Date('2024-01-01T11:00:00Z'),
      });

      const result = createSessionResult(session);

      expect(result.sessionId).toBe('session-1');
      expect(result.learnerId).toBe('learner-1');
      expect(result.subjectId).toBe('science');
      expect(result.chapterIds).toEqual(['chapter-1', 'chapter-2']);
      expect(result.date).toEqual(new Date('2024-01-01T11:00:00Z'));
      expect(result.questions).toEqual(session.questions);
      expect(result.isPartial).toBe(false);
    });

    it('calculates overall score for the result', () => {
      const session = createTestSession();
      const result = createSessionResult(session);

      // Answered: q1(80) + q2(60) + q4(90) + q5(75) + q6(85) = 390/5 = 78
      expect(result.overallScore).toBe(78);
    });

    it('uses current date when session has no completedAt', () => {
      const session = createTestSession({ completedAt: undefined });
      const before = new Date();
      const result = createSessionResult(session);
      const after = new Date();

      expect(result.date.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.date.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('includes time limit when present', () => {
      const session = createTestSession({ timeLimitMinutes: 45 });
      const result = createSessionResult(session);
      expect(result.timeLimitMinutes).toBe(45);
    });

    it('records partial status', () => {
      const session = createTestSession({ isPartial: true });
      const result = createSessionResult(session);
      expect(result.isPartial).toBe(true);
    });
  });
});
