/**
 * API Types — Request and response types for all REST API endpoints.
 *
 * Organized by service domain matching the API endpoint specifications in the design doc.
 */

import type {
  Book,
  Chapter,
  ChapterExplanation,
  ChapterPage,
  ChapterSummary,
  Exercise,
  ExerciseType,
  Grade,
  PaginatedResponse,
  Parent,
  PronunciationResult,
  PronunciationWord,
  QuizAnswer,
  QuizSession,
  RevisionQuestion,
  Role,
  Streak,
  Student,
  StudentProgress,
  Subject,
  SubjectAssignment,
} from './models.js';

// ============================================================
// Auth — Registration
// ============================================================

export interface RegisterParentRequest {
  username: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterParentResponse {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface RegisterStudentRequest {
  parentUsername: string;
  username: string;
  name: string;
  password: string;
  grade: Grade;
  schoolName: string;
  subjects: string[]; // subject IDs
  customSubjects?: { name: string }[];
}

export interface RegisterStudentResponse {
  id: string;
  parentId: string;
  username: string;
  name: string;
  grade: Grade;
  schoolName: string;
  subjects: SubjectAssignment[];
  createdAt: string;
}

// ============================================================
// Auth — Login
// ============================================================

export interface LoginRequest {
  username: string;
  password: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    name: string;
    role: Role;
  };
}

// ============================================================
// Auth — Password Recovery
// ============================================================

export interface ForgotPasswordRequest {
  email: string;
  phone: string;
}

export interface ForgotPasswordResponse {
  message: string;
  otpSentTo: {
    email: boolean;
    phone: boolean;
  };
}

export interface VerifyOtpRequest {
  email: string;
  emailOtp: string;
  phoneOtp: string;
}

export interface VerifyOtpResponse {
  resetToken: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// ============================================================
// Auth — Token Management
// ============================================================

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface LogoutResponse {
  message: string;
}

// ============================================================
// Content Store — Subjects
// ============================================================

export interface GetSubjectsResponse {
  subjects: Subject[];
}

// ============================================================
// Content Store — Books
// ============================================================

export interface CreateBookRequest {
  name: string;
}

export interface CreateBookResponse {
  book: Book;
}

export interface GetBooksResponse {
  books: Book[];
}

// ============================================================
// Content Store — Chapters
// ============================================================

export interface CreateChapterRequest {
  name: string;
}

export interface CreateChapterResponse {
  chapter: Chapter;
}

export interface GetChaptersResponse {
  chapters: Chapter[];
}

// ============================================================
// Content Store — Exercises
// ============================================================

export interface GetExercisesRequest {
  subjectId?: string;
  chapterId?: string;
  exerciseType?: ExerciseType;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  page?: number;
  pageSize?: number;
}

export interface GetExercisesResponse extends PaginatedResponse<Exercise> {}

export interface CreateExerciseRequest {
  subjectId: string;
  chapterId?: string;
  exerciseType: ExerciseType;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  sequenceNumber: number;
  content: Record<string, unknown>;
  correctAnswer: Record<string, unknown>;
  explanation?: string;
}

export interface CreateExerciseResponse {
  exercise: Exercise;
}

export interface UpdateExerciseRequest {
  exerciseType?: ExerciseType;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  sequenceNumber?: number;
  content?: Record<string, unknown>;
  correctAnswer?: Record<string, unknown>;
  explanation?: string;
}

export interface UpdateExerciseResponse {
  exercise: Exercise;
}

export interface DeleteExerciseResponse {
  message: string;
}

// ============================================================
// Content Ingestion — Pages
// ============================================================

export interface UploadPagesRequest {
  pages: {
    fileName: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/heic';
    sizeBytes: number;
  }[];
}

export interface UploadPagesResponse {
  uploadUrls: {
    pageNumber: number;
    uploadUrl: string;
    s3Key: string;
  }[];
  totalPages: number;
}

// ============================================================
// Content Ingestion — Text Extraction
// ============================================================

export interface ExtractTextResponse {
  pages: {
    pageNumber: number;
    extractedText: string;
    wordCount: number;
    ocrStatus: 'completed' | 'failed';
  }[];
  totalPages: number;
  totalWordCount: number;
}

export interface SaveTranscriptRequest {
  pages: {
    pageNumber: number;
    text: string;
  }[];
}

export interface SaveTranscriptResponse {
  chapterId: string;
  totalPages: number;
  totalWordCount: number;
  savedAt: string;
}

// ============================================================
// Content Ingestion — Page Classification
// ============================================================

export interface ClassifyPagesRequest {
  pages: {
    pageNumber: number;
    isExercisePage: boolean;
  }[];
}

export interface ClassifyPagesResponse {
  chapterId: string;
  classifiedPages: number;
  exercisePages: number;
}

// ============================================================
// Comprehension — Explanation
// ============================================================

export interface GetExplanationResponse {
  explanation: ChapterExplanation;
  isGenerated: boolean;
}

export interface GenerateAudioResponse {
  audioUrl: string;
  cdnUrl: string;
  durationSeconds: number;
}

// ============================================================
// Comprehension — Revision Questions
// ============================================================

export interface GenerateRevisionQuestionsResponse {
  questions: RevisionQuestion[];
  generatedAt: string;
}

export interface GetRevisionQuestionsResponse {
  questions: RevisionQuestion[];
  generatedAt: string;
}

// ============================================================
// Comprehension — Summary
// ============================================================

export interface GenerateSummaryResponse {
  summary: ChapterSummary;
}

export interface GetSummaryResponse {
  summary: ChapterSummary;
}

// ============================================================
// Comprehension — Translation
// ============================================================

export interface TranslateRequest {
  targetLanguage: 'english' | 'hindi';
  pageNumber: number;
}

export interface TranslateResponse {
  translatedText: string;
  targetLanguage: 'english' | 'hindi';
  pageNumber: number;
  isCached: boolean;
}

// ============================================================
// Comprehension — Exercise Assistance
// ============================================================

export interface GetHintRequest {
  studentAnswer?: string;
  attemptNumber: number;
}

export interface GetHintResponse {
  hint: string;
  referenceParagraphs: string[];
  isContextual: boolean;
}

export interface EvaluateRequest {
  studentAnswer: string;
}

export interface EvaluateResponse {
  isCorrect: boolean;
  score: number;
  feedback: string;
  explanation: string;
  referenceParagraphs: string[];
}

// ============================================================
// Progress
// ============================================================

export interface GetProgressResponse {
  progress: StudentProgress[];
  overallPercentage: number;
}

export interface GetStreakResponse {
  streak: Streak;
}

export interface RecordExerciseResultRequest {
  exerciseId: string;
  subjectId: string;
  isCorrect: boolean;
  score?: number;
  answerGiven?: Record<string, unknown>;
}

export interface RecordExerciseResultResponse {
  resultId: string;
  updatedProgress: StudentProgress;
  streakUpdated: boolean;
  currentStreak: number;
}

// ============================================================
// Quiz
// ============================================================

export interface CreateQuizSessionRequest {
  subjectId: string;
  questionCount: number;
  timerDurationSeconds: number;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
}

export interface CreateQuizSessionResponse {
  session: QuizSession;
  questions: Exercise[];
}

export interface SubmitQuizAnswerRequest {
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D';
}

export interface SubmitQuizAnswerResponse {
  answer: QuizAnswer;
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  questionsRemaining: number;
}

export interface SkipQuestionRequest {
  questionId: string;
}

export interface SkipQuestionResponse {
  skipped: boolean;
  questionsRemaining: number;
}

export interface GetQuizResultResponse {
  session: QuizSession;
  answers: QuizAnswer[];
  scorePercentage: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
}

// ============================================================
// Pronunciation
// ============================================================

export interface UploadRecordingRequest {
  wordId: string;
  audioFormat: 'wav' | 'mp3' | 'aac';
  durationSeconds: number;
}

export interface UploadRecordingResponse {
  uploadUrl: string;
  result: PronunciationResult;
}

export interface GetReferenceAudioResponse {
  word: PronunciationWord;
  audioUrl: string;
  cdnUrl: string;
}

// ============================================================
// Parent Dashboard
// ============================================================

export interface GetLearnersResponse {
  learners: Student[];
}

export interface EditLearnerSubjectsRequest {
  subjectIds: string[];
  customSubjects?: { name: string }[];
}

export interface EditLearnerSubjectsResponse {
  studentId: string;
  subjects: SubjectAssignment[];
  updatedAt: string;
}

// ============================================================
// Re-exports for convenience
// ============================================================

export type {
  Book,
  Chapter,
  ChapterExplanation,
  ChapterPage,
  ChapterSummary,
  Exercise,
  ExerciseType,
  Grade,
  PaginatedResponse,
  Parent,
  PronunciationResult,
  PronunciationWord,
  QuizAnswer,
  QuizSession,
  RevisionQuestion,
  Role,
  Streak,
  Student,
  StudentProgress,
  Subject,
  SubjectAssignment,
};
