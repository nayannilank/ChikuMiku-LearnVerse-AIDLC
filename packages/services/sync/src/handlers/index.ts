/**
 * Progress Service Handlers
 *
 * Handlers for managing student learning streaks, quiz sessions, and progress tracking.
 */

// --- Streak Handlers ---
export { createGetStreakHandler } from './getStreak';
export type { StreakDbClient as GetStreakDbClient, StreakRecord as GetStreakRecord, StreakResponse } from './getStreak';

export { createUpdateStreakHandler, computeStreakUpdate, daysBetween, getToday } from './updateStreak';
export type { StreakDbClient as UpdateStreakDbClient, StreakRecord as UpdateStreakRecord, StreakUpdateResult } from './updateStreak';

// --- Quiz Session Handlers ---
export { createCreateQuizSessionHandler } from './createQuizSession';
export type {
  QuizSessionDbClient as CreateQuizSessionDbClient,
  QuizSessionRecord as CreateQuizSessionRecord,
  CreateQuizSessionRequest,
} from './createQuizSession';

export { createSubmitQuizAnswerHandler, evaluateAnswer } from './submitQuizAnswer';
export type {
  SubmitAnswerDbClient,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  QuizAnswerRecord,
  ExerciseRecord,
} from './submitQuizAnswer';

export { createSkipQuestionHandler } from './skipQuestion';
export type {
  SkipQuestionDbClient,
  SkipQuestionRequest,
  SkipQuestionResponse,
} from './skipQuestion';

export { createGetQuizResultHandler, isTimerExpired } from './getQuizResult';
export type {
  GetQuizResultDbClient,
  QuizResultResponse,
} from './getQuizResult';

// --- Progress Tracking Handlers ---
export { createGetProgressHandler } from './getProgress';
export type {
  ProgressDbClient,
  ProgressResponse,
  SubjectProgress,
  StreakData,
  RecentActivity,
} from './getProgress';

export { createRecordExerciseResultHandler } from './recordExerciseResult';
export type {
  ExerciseResultDbClient,
  RecordExerciseResultRequest,
  RecordExerciseResultResponse,
  ExerciseResultRecord,
  ProgressUpdate,
} from './recordExerciseResult';

export { createGetQuizHistoryHandler, isValidISODate } from './getQuizHistory';
export type {
  QuizHistoryDbClient,
  QuizHistoryQuery,
  QuizHistoryResult,
  QuizHistorySession,
  QuizHistoryResponse,
} from './getQuizHistory';
