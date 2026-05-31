/**
 * Revision Mode Service
 *
 * Handles:
 * - Revision session creation with chapter selection and question generation
 * - Timed test mode with configurable time limits (5-120 minutes)
 * - Revision performance summary with per-chapter strengths/weaknesses
 * - Partial progress saving and session resume
 * - Session result recording
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import {
  Chapter,
  DifficultyLevel,
  RevisionQuestion,
  RevisionSession,
  SubjectModuleRegistry,
  SubjectModuleNotFoundError,
} from '@chikumiku/service-core';

// --- Constants ---

/** Minimum questions per chapter in revision mode */
export const MIN_QUESTIONS_PER_CHAPTER = 5;

/** Maximum questions per chapter in revision mode */
export const MAX_QUESTIONS_PER_CHAPTER = 20;

/** Minimum time limit for timed tests (minutes) */
export const MIN_TIME_LIMIT_MINUTES = 5;

/** Maximum time limit for timed tests (minutes) */
export const MAX_TIME_LIMIT_MINUTES = 120;

/** Strength threshold: scores at or above this are strengths */
export const STRENGTH_THRESHOLD = 70;

// --- Types ---

/** Options for creating a revision session */
export interface RevisionSessionOptions {
  learnerId: string;
  subjectId: string;
  chapterIds: string[];
  questionsPerChapter?: number; // defaults to 10, must be 5-20
  timeLimitMinutes?: number; // optional, 5-120 if provided
}

/** A chapter available for revision selection */
export interface RevisionChapterOption {
  chapterId: string;
  textbookName: string;
  chapterNumber: number;
  subjectId: string;
}

/** Per-chapter score breakdown in performance summary */
export interface ChapterScoreBreakdown {
  chapterId: string;
  score: number; // 0-100
  totalQuestions: number;
  answeredQuestions: number;
  isStrength: boolean; // score >= 70%
}

/** Revision performance summary */
export interface RevisionPerformanceSummary {
  sessionId: string;
  overallScore: number; // 0-100, based on answered questions only
  perChapterScores: ChapterScoreBreakdown[];
  strengths: string[]; // chapter IDs with score >= 70%
  weakAreas: string[]; // chapter IDs with score < 70%
  totalQuestions: number;
  answeredQuestions: number;
  unattemptedQuestions: number;
  isPartial: boolean;
}

/** Recorded session result for persistence */
export interface RevisionSessionResult {
  sessionId: string;
  learnerId: string;
  subjectId: string;
  chapterIds: string[];
  date: Date;
  perChapterScores: Record<string, number>;
  overallScore: number;
  questions: RevisionQuestion[];
  isPartial: boolean;
  timeLimitMinutes?: number;
}

/** Partial answer submitted during a session */
export interface PartialAnswer {
  questionId: string;
  answer: string;
  score: number; // 0-100
}

/** Error types for revision mode */
export class InvalidTimeLimitError extends Error {
  constructor(minutes: number) {
    super(
      `Time limit must be between ${MIN_TIME_LIMIT_MINUTES} and ${MAX_TIME_LIMIT_MINUTES} minutes. Got: ${minutes}`
    );
    this.name = 'InvalidTimeLimitError';
  }
}

export class InvalidQuestionCountError extends Error {
  constructor(count: number) {
    super(
      `Questions per chapter must be between ${MIN_QUESTIONS_PER_CHAPTER} and ${MAX_QUESTIONS_PER_CHAPTER}. Got: ${count}`
    );
    this.name = 'InvalidQuestionCountError';
  }
}

export class NoChaptersSelectedError extends Error {
  constructor() {
    super('At least one chapter must be selected for revision.');
    this.name = 'NoChaptersSelectedError';
  }
}

// --- Revision Session Creation (Task 11.1) ---

/**
 * Lists all stored chapters for a subject, providing selection options for revision.
 *
 * Requirements: 6.1
 */
export function getRevisionChapterOptions(
  chapters: Chapter[],
  subjectId: string
): RevisionChapterOption[] {
  return chapters
    .filter((ch) => ch.subjectId === subjectId)
    .map((ch) => ({
      chapterId: ch.id,
      textbookName: ch.textbookName,
      chapterNumber: ch.chapterNumber,
      subjectId: ch.subjectId,
    }))
    .sort((a, b) => {
      if (a.textbookName !== b.textbookName) {
        return a.textbookName.localeCompare(b.textbookName);
      }
      return a.chapterNumber - b.chapterNumber;
    });
}

/**
 * Validates the time limit for a timed test.
 * Returns true if valid (between 5 and 120 inclusive), false otherwise.
 *
 * Requirements: 6.4
 */
export function isValidTimeLimit(minutes: number): boolean {
  return (
    Number.isFinite(minutes) &&
    Number.isInteger(minutes) &&
    minutes >= MIN_TIME_LIMIT_MINUTES &&
    minutes <= MAX_TIME_LIMIT_MINUTES
  );
}

/**
 * Generates revision questions for selected chapters.
 * Distributes questions across recall, understanding, and application levels
 * with at least 1 question of each level per chapter.
 *
 * Requirements: 6.2, 6.3
 */
export async function generateRevisionQuestions(
  chapters: Chapter[],
  questionsPerChapter: number,
  registry: SubjectModuleRegistry
): Promise<RevisionQuestion[]> {
  if (questionsPerChapter < MIN_QUESTIONS_PER_CHAPTER || questionsPerChapter > MAX_QUESTIONS_PER_CHAPTER) {
    throw new InvalidQuestionCountError(questionsPerChapter);
  }

  const allQuestions: RevisionQuestion[] = [];

  for (const chapter of chapters) {
    const module = registry.getModule(chapter.subjectId);
    const strategy = module.questionGenerationStrategy;

    // Ensure at least 1 question per difficulty level
    const difficulties: DifficultyLevel[] = ['recall', 'understanding', 'application'];
    const questionsForChapter: RevisionQuestion[] = [];

    // Generate at least 1 question per difficulty level
    for (const difficulty of difficulties) {
      const generated = await strategy.generateQuestions(
        chapter.extractedText,
        1,
        difficulty
      );
      if (generated.length > 0) {
        questionsForChapter.push({
          questionId: `${chapter.id}-${difficulty}-${questionsForChapter.length}`,
          chapterId: chapter.id,
          difficulty,
          isAttempted: false,
        });
      }
    }

    // Fill remaining slots with distributed difficulty
    const remaining = questionsPerChapter - questionsForChapter.length;
    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        const difficulty = difficulties[i % difficulties.length];
        const generated = await strategy.generateQuestions(
          chapter.extractedText,
          1,
          difficulty
        );
        if (generated.length > 0) {
          questionsForChapter.push({
            questionId: `${chapter.id}-${difficulty}-${questionsForChapter.length}`,
            chapterId: chapter.id,
            difficulty,
            isAttempted: false,
          });
        }
      }
    }

    allQuestions.push(...questionsForChapter);
  }

  return allQuestions;
}

/**
 * Creates a new revision session with generated questions.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
export async function createRevisionSession(
  options: RevisionSessionOptions,
  chapters: Chapter[],
  registry: SubjectModuleRegistry
): Promise<RevisionSession> {
  if (options.chapterIds.length === 0) {
    throw new NoChaptersSelectedError();
  }

  const questionsPerChapter = options.questionsPerChapter ?? 10;
  if (questionsPerChapter < MIN_QUESTIONS_PER_CHAPTER || questionsPerChapter > MAX_QUESTIONS_PER_CHAPTER) {
    throw new InvalidQuestionCountError(questionsPerChapter);
  }

  if (options.timeLimitMinutes !== undefined) {
    if (!isValidTimeLimit(options.timeLimitMinutes)) {
      throw new InvalidTimeLimitError(options.timeLimitMinutes);
    }
  }

  // Filter to only selected chapters
  const selectedChapters = chapters.filter((ch) =>
    options.chapterIds.includes(ch.id)
  );

  const questions = await generateRevisionQuestions(
    selectedChapters,
    questionsPerChapter,
    registry
  );

  const session: RevisionSession = {
    id: generateSessionId(),
    learnerId: options.learnerId,
    subjectId: options.subjectId,
    chapterIds: options.chapterIds,
    questions,
    timeLimitMinutes: options.timeLimitMinutes,
    startedAt: new Date(),
    isPartial: false,
    perChapterScores: {},
  };

  return session;
}

// --- Timed Test Mode (Task 11.3) ---

/**
 * Starts a timed test session. Validates the time limit and creates a session
 * with the timer configuration.
 *
 * Requirements: 6.4
 */
export async function startTimedTest(
  options: RevisionSessionOptions & { timeLimitMinutes: number },
  chapters: Chapter[],
  registry: SubjectModuleRegistry
): Promise<RevisionSession> {
  if (!isValidTimeLimit(options.timeLimitMinutes)) {
    throw new InvalidTimeLimitError(options.timeLimitMinutes);
  }

  return createRevisionSession(options, chapters, registry);
}

/**
 * Checks whether a timed session has exceeded its time limit.
 *
 * Requirements: 6.8
 */
export function isSessionTimedOut(session: RevisionSession, currentTime: Date): boolean {
  if (!session.timeLimitMinutes) {
    return false;
  }

  const elapsedMs = currentTime.getTime() - session.startedAt.getTime();
  const limitMs = session.timeLimitMinutes * 60 * 1000;
  return elapsedMs >= limitMs;
}

/**
 * Ends a timed session that has reached its time limit.
 * Marks unanswered questions as unattempted and scores based on answered questions only.
 *
 * Requirements: 6.8
 */
export function endTimedSession(session: RevisionSession): RevisionSession {
  const updatedQuestions = session.questions.map((q) => ({
    ...q,
    // Questions without an answer remain unattempted
    isAttempted: q.isAttempted,
  }));

  const perChapterScores = calculatePerChapterScores(updatedQuestions);

  return {
    ...session,
    questions: updatedQuestions,
    completedAt: new Date(),
    isPartial: false,
    perChapterScores,
  };
}

// --- Partial Progress and Resume (Task 11.5) ---

/**
 * Saves partial progress for a revision session.
 * Updates answered questions with their responses and scores.
 *
 * Requirements: 6.7
 */
export function savePartialProgress(
  session: RevisionSession,
  answers: PartialAnswer[]
): RevisionSession {
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  const updatedQuestions = session.questions.map((q) => {
    const answer = answerMap.get(q.questionId);
    if (answer) {
      return {
        ...q,
        learnerAnswer: answer.answer,
        score: answer.score,
        isAttempted: true,
      };
    }
    return q;
  });

  const perChapterScores = calculatePerChapterScores(updatedQuestions);

  return {
    ...session,
    questions: updatedQuestions,
    isPartial: true,
    perChapterScores,
  };
}

/**
 * Ends a session (either by completion or early exit).
 * Calculates final scores and marks session as complete or partial.
 *
 * Requirements: 6.5, 6.7
 */
export function endSession(
  session: RevisionSession,
  isEarlyExit: boolean
): RevisionSession {
  const perChapterScores = calculatePerChapterScores(session.questions);

  return {
    ...session,
    completedAt: new Date(),
    isPartial: isEarlyExit,
    perChapterScores,
  };
}

// --- Revision Performance Summary (Task 11.5) ---

/**
 * Generates a performance summary for a completed or partial revision session.
 * Classifies chapters as strengths (>=70%) or weak areas (<70%).
 * Scores are based on answered questions only.
 *
 * Requirements: 6.5, 6.8
 */
export function generatePerformanceSummary(
  session: RevisionSession
): RevisionPerformanceSummary {
  const perChapterScores = calculateChapterScoreBreakdowns(session);

  const strengths: string[] = [];
  const weakAreas: string[] = [];

  for (const chapterScore of perChapterScores) {
    if (chapterScore.answeredQuestions === 0) {
      // Chapters with no answered questions are weak areas
      weakAreas.push(chapterScore.chapterId);
    } else if (chapterScore.isStrength) {
      strengths.push(chapterScore.chapterId);
    } else {
      weakAreas.push(chapterScore.chapterId);
    }
  }

  const totalQuestions = session.questions.length;
  const answeredQuestions = session.questions.filter((q) => q.isAttempted).length;
  const unattemptedQuestions = totalQuestions - answeredQuestions;

  // Overall score based on answered questions only
  const overallScore = calculateOverallScore(session.questions);

  return {
    sessionId: session.id,
    overallScore,
    perChapterScores,
    strengths,
    weakAreas,
    totalQuestions,
    answeredQuestions,
    unattemptedQuestions,
    isPartial: session.isPartial,
  };
}

/**
 * Creates a session result record for persistence.
 *
 * Requirements: 6.6
 */
export function createSessionResult(session: RevisionSession): RevisionSessionResult {
  return {
    sessionId: session.id,
    learnerId: session.learnerId,
    subjectId: session.subjectId,
    chapterIds: session.chapterIds,
    date: session.completedAt ?? new Date(),
    perChapterScores: session.perChapterScores,
    overallScore: calculateOverallScore(session.questions),
    questions: session.questions,
    isPartial: session.isPartial,
    timeLimitMinutes: session.timeLimitMinutes,
  };
}

// --- Internal Helpers ---

/**
 * Calculates per-chapter scores from revision questions.
 * Only considers attempted questions for scoring.
 */
function calculatePerChapterScores(
  questions: RevisionQuestion[]
): Record<string, number> {
  const chapterQuestions = groupByChapter(questions);
  const scores: Record<string, number> = {};

  for (const [chapterId, chQuestions] of Object.entries(chapterQuestions)) {
    const attempted = chQuestions.filter((q) => q.isAttempted);
    if (attempted.length === 0) {
      scores[chapterId] = 0;
    } else {
      const totalScore = attempted.reduce((sum, q) => sum + (q.score ?? 0), 0);
      scores[chapterId] = Math.round(totalScore / attempted.length);
    }
  }

  return scores;
}

/**
 * Calculates detailed per-chapter score breakdowns for the performance summary.
 */
function calculateChapterScoreBreakdowns(
  session: RevisionSession
): ChapterScoreBreakdown[] {
  const chapterQuestions = groupByChapter(session.questions);
  const breakdowns: ChapterScoreBreakdown[] = [];

  for (const chapterId of session.chapterIds) {
    const questions = chapterQuestions[chapterId] ?? [];
    const attempted = questions.filter((q) => q.isAttempted);
    const totalQuestions = questions.length;
    const answeredQuestions = attempted.length;

    let score = 0;
    if (answeredQuestions > 0) {
      const totalScore = attempted.reduce((sum, q) => sum + (q.score ?? 0), 0);
      score = Math.round(totalScore / answeredQuestions);
    }

    breakdowns.push({
      chapterId,
      score,
      totalQuestions,
      answeredQuestions,
      isStrength: answeredQuestions > 0 && score >= STRENGTH_THRESHOLD,
    });
  }

  return breakdowns;
}

/**
 * Calculates overall score based on answered questions only.
 */
function calculateOverallScore(questions: RevisionQuestion[]): number {
  const attempted = questions.filter((q) => q.isAttempted);
  if (attempted.length === 0) {
    return 0;
  }
  const totalScore = attempted.reduce((sum, q) => sum + (q.score ?? 0), 0);
  return Math.round(totalScore / attempted.length);
}

/**
 * Groups questions by their chapter ID.
 */
function groupByChapter(
  questions: RevisionQuestion[]
): Record<string, RevisionQuestion[]> {
  const groups: Record<string, RevisionQuestion[]> = {};
  for (const q of questions) {
    if (!groups[q.chapterId]) {
      groups[q.chapterId] = [];
    }
    groups[q.chapterId].push(q);
  }
  return groups;
}

/**
 * Generates a unique session ID.
 */
function generateSessionId(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
