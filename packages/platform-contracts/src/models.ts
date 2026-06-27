/**
 * Data Models — Shared TypeScript interfaces for the LearnVerse platform.
 *
 * These models define the shape of data exchanged between clients and services.
 * They correspond to the PostgreSQL schema defined in the design document.
 */

// ============================================================
// Authentication
// ============================================================

export interface Parent {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export type Gender = 'male' | 'female' | 'other';

export interface Student {
  id: string;
  parentId: string;
  username: string;
  name: string;
  gender: Gender;
  grade: Grade;
  schoolName: string;
  subjects: SubjectAssignment[];
  createdAt: string;
}

export type Grade =
  | 'LKG'
  | 'UKG'
  | 'First'
  | 'Second'
  | 'Third'
  | 'Fourth'
  | 'Fifth'
  | 'Sixth'
  | 'Seventh'
  | 'Eighth'
  | 'Ninth'
  | 'Tenth'
  | 'Eleventh'
  | 'Twelfth';

export type Role = 'parent' | 'student';

// ============================================================
// Subjects
// ============================================================

export interface Subject {
  id: string;
  name: string;
  isDefault: boolean;
  color: string;
  iconName: string;
  createdBy?: string;
}

export interface SubjectAssignment {
  subjectId: string;
  subjectName: string;
  color: string;
  assignedAt: string;
}

export const DEFAULT_SUBJECTS: Omit<Subject, 'id'>[] = [
  { name: 'Kannada', isDefault: true, color: '#9B59B6', iconName: 'kannada' },
  { name: 'English', isDefault: true, color: '#5DADE2', iconName: 'english' },
  { name: 'Hindi', isDefault: true, color: '#F7C948', iconName: 'hindi' },
  { name: 'Maths', isDefault: true, color: '#E94F9B', iconName: 'maths' },
  { name: 'Computers', isDefault: true, color: '#4A6CF7', iconName: 'computers' },
  { name: 'EVS', isDefault: true, color: '#27AE60', iconName: 'evs' },
  { name: 'Science', isDefault: true, color: '#4ECDC4', iconName: 'science' },
];

// ============================================================
// Content — Books, Chapters, Pages
// ============================================================

export interface Book {
  id: string;
  subjectId: string;
  studentId: string;
  name: string;
  sequenceNumber: number;
  chapterCount: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  name: string;
  sequenceNumber: number;
  hasContent: boolean;
  pageCount: number;
  totalWordCount: number;
}

export interface ChapterPage {
  id: string;
  chapterId: string;
  pageNumber: number;
  s3ImageKey: string;
  extractedText?: string;
  wordCount: number;
  isExercisePage: boolean;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

// ============================================================
// AI Content (generate-once-store-permanently)
// ============================================================

export interface ChapterExplanation {
  chapterId: string;
  pageNumber: number;
  summary: string;
  keyWords: KeyWord[];
  concepts: string;
  audioS3Key?: string;
  audioCdnUrl?: string;
}

export interface KeyWord {
  word: string;
  romanization?: string;
  meaning: string;
  language: string;
}

export interface RevisionQuestion {
  id: string;
  chapterId: string;
  questionType: 'mcq' | 'short_answer' | 'fill_blank';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface ChapterSummary {
  chapterId: string;
  keyPoints: string[];
  importantConcepts: string[];
  examPreparationNotes: string[];
  generatedAt: string;
}

// ============================================================
// Exercises
// ============================================================

export type ExerciseType =
  | 'pronunciation'
  | 'grammar'
  | 'quiz'
  | 'maths'
  | 'code'
  | 'evs'
  | 'fill_blank'
  | 'match'
  | 'true_false'
  | 'short_answer';

export interface Exercise {
  id: string;
  subjectId: string;
  chapterId?: string;
  exerciseType: ExerciseType;
  difficultyLevel: 'easy' | 'medium' | 'hard';
  sequenceNumber: number;
  content: Record<string, unknown>;
  correctAnswer: Record<string, unknown>;
  explanation?: string;
}

// ============================================================
// Progress
// ============================================================

export interface StudentProgress {
  studentId: string;
  subjectId: string;
  completedExercises: number;
  totalExercises: number;
  progressPercentage: number;
}

export interface Streak {
  studentId: string;
  currentStreak: number;
  lastActivityDate: string | null;
}

// ============================================================
// Quiz
// ============================================================

export interface QuizSession {
  id: string;
  studentId: string;
  subjectId: string;
  questionIds: string[];
  timerDurationSeconds: number;
  startedAt: string;
  endedAt?: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage?: number;
  status: 'active' | 'completed' | 'abandoned';
}

export interface QuizAnswer {
  sessionId: string;
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D' | null;
  isCorrect: boolean;
  answeredAt: string;
}

// ============================================================
// Pronunciation
// ============================================================

export interface PronunciationWord {
  id: string;
  subjectId: string;
  word: string;
  phoneticTranscription?: string;
  syllables: string[];
  referenceAudioUrl: string;
  language: 'kannada' | 'english' | 'hindi';
}

export interface PronunciationResult {
  wordId: string;
  accuracyScore: number;
  syllableResults: SyllableResult[];
}

export interface SyllableResult {
  syllable: string;
  isCorrect: boolean;
}

// ============================================================
// Pagination
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================
// Subject Module Framework
// ============================================================

export interface OcrRuleSet {
  supportedLanguages: string[];
  preprocessingSteps: string[];
}

export interface PromptTemplateSet {
  explanation: string;
  summary: string;
  revision: string;
  translation: string;
}

export interface QuestionTemplate {
  exerciseType: ExerciseType;
  promptTemplate: string;
  difficultyModifiers: Record<string, string>;
}

export interface AnswerTemplate {
  exerciseType: ExerciseType;
  evaluationPrompt: string;
}

export interface RevisionTemplate {
  questionType: 'mcq' | 'short_answer' | 'fill_blank';
  promptTemplate: string;
  count: number;
}

export interface SubjectModuleConfig {
  subjectId: string;
  ocrRules: OcrRuleSet;
  promptTemplates: PromptTemplateSet;
  questionTemplates: QuestionTemplate[];
  answerTemplates: AnswerTemplate[];
  revisionTemplates: RevisionTemplate[];
}
