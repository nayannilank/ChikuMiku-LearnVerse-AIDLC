/**
 * Core data model types for ChikuMiku LearnVerse.
 *
 * These types define the domain entities used across the platform.
 */

// --- Grade ---

/** Valid grade values: 1 through 12 */
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

// --- Image Input ---

/** Supported image formats for upload */
export type ImageFormat = 'jpeg' | 'png' | 'heic';

/** Maximum image size in bytes (10 MB) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Image input for content ingestion */
export interface ImageInput {
  data: ArrayBuffer | Uint8Array;
  format: ImageFormat;
  sizeBytes: number;
}

// --- Contact ---

export type ContactType = 'email' | 'phone';

// --- Learner ---

export interface Learner {
  id: string;
  displayName: string;
  contactType: ContactType;
  contactValue: string;
  passwordHash: string;
  grade: Grade;
  enrolledSubjects: string[]; // max 10
  parentAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Region ---

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Page ---

export interface Page {
  id: string;
  orderIndex: number;
  originalImageUrl: string;
  compressedImageUrl: string;
  extractedText: string;
  confidence: number;
  partialRegions?: Region[];
}

// --- Chapter ---

/** Maximum number of pages per chapter */
export const MAX_PAGES_PER_CHAPTER = 50;

export interface Chapter {
  id: string;
  learnerId: string;
  subjectId: string;
  textbookName: string;
  chapterNumber: number;
  pages: Page[]; // max 50
  extractedText: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
}

// --- Question ---

export type QuestionType =
  | 'fill-in-the-blank'
  | 'short-answer'
  | 'match-the-following'
  | 'descriptive';

export type DifficultyLevel = 'recall' | 'understanding' | 'application';

export interface Question {
  id: string;
  chapterId: string;
  subjectId: string;
  text: string;
  type: QuestionType;
  modelAnswer?: string;
  difficulty: DifficultyLevel;
}

// --- Activity Score ---

export type ActivityType =
  | 'comprehension'
  | 'pronunciation'
  | 'grammar'
  | 'revision';

export interface ActivityScore {
  activityType: ActivityType;
  score: number; // 0-100
  completedAt: Date;
}

// --- Progress Record ---

export interface ProgressRecord {
  learnerId: string;
  chapterId: string;
  subjectId: string;
  completionPercentage: number;
  activityScores: ActivityScore[];
  lastAccessedAt: Date;
}

// --- Revision Session ---

export interface RevisionQuestion {
  questionId: string;
  chapterId: string;
  difficulty: DifficultyLevel;
  learnerAnswer?: string;
  score?: number;
  isAttempted: boolean;
}

export interface RevisionSession {
  id: string;
  learnerId: string;
  subjectId: string;
  chapterIds: string[];
  questions: RevisionQuestion[];
  timeLimitMinutes?: number; // 5-120 if timed
  startedAt: Date;
  completedAt?: Date;
  isPartial: boolean;
  perChapterScores: Record<string, number>;
}

// --- Grade Archive ---

export interface GradeArchive {
  learnerId: string;
  grade: Grade;
  archivedAt: Date;
  totalChaptersCompleted: number;
  overallScoresPerSubject: Record<string, number>;
  revisionSessionCount: number;
  isReadOnly: true;
}

// --- Queued Action ---

export type QueuedActionType =
  | 'save_answer'
  | 'mark_progress'
  | 'save_chapter'
  | 'update_score';

/** Maximum number of queued actions per learner */
export const MAX_QUEUED_ACTIONS = 50;

export interface QueuedAction {
  id: string;
  learnerId: string;
  action: QueuedActionType;
  payload: unknown;
  createdAt: Date;
  order: number; // sequential ordering for replay
}
