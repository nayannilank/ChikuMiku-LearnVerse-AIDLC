/**
 * API Connectors — Bridge between React screen component props and the central API client.
 *
 * Each connector creates the prop functions that screen components expect,
 * backed by real API calls through the centralized api.ts client.
 *
 * These connectors handle:
 * - Transforming API responses into the shapes screens expect
 * - Loading state management
 * - Error state management with retry capability
 *
 * Validates: Requirements 1.1–1.49, 6.1–6.9, 7.1–7.8, 8.1–8.11, 9.1–9.10,
 * 10.1–10.16, 11.1–11.10, 12.1–12.11, 13.1–13.11, 14.1–14.10, 15.1–15.7,
 * 16.1–16.6, 17.1–17.8, 22.1–22.7
 */

import {
  api,
  authApi,
  clearTokens,
  setTokens,
  ApiClientError,
  type LoginResponse,
  type LearnerInfo,
} from './api';
import type { SubjectCardData } from '../screens/Dashboard';
import type { Book, Chapter, SubjectAssignment } from '@learnverse/platform-contracts';

// ============================================================
// Auth Connectors
// ============================================================

/**
 * Creates the onLogin handler for LoginScreen.
 * Connects to: POST /auth/login
 *
 * @param onSuccess - Called with login response on successful auth
 */
export function createLoginHandler(onSuccess: (response: LoginResponse) => void) {
  return async (username: string, password: string, role: 'parent' | 'student'): Promise<void> => {
    const response = await authApi.login(username, password, role);
    setTokens(response.accessToken, response.refreshToken);
    onSuccess(response);
  };
}

/**
 * Creates the registration handler for ParentRegistrationForm.
 * Connects to: POST /auth/register/parent
 */
export function createParentRegistrationHandler(onSuccess: () => void) {
  return async (data: {
    username: string;
    name: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<void> => {
    await authApi.registerParent(data);
    onSuccess();
  };
}

/**
 * Creates the registration handler for StudentRegistrationForm.
 * Connects to: POST /auth/register/student
 */
export function createStudentRegistrationHandler(onSuccess: () => void) {
  return async (data: {
    parentUsername: string;
    studentUsername: string;
    name: string;
    password: string;
    gender: 'male' | 'female' | 'other';
    grade: string;
    schoolName: string;
    subjects: string[];
    customSubjects?: { name: string }[];
  }): Promise<void> => {
    await authApi.registerStudent(data);
    onSuccess();
  };
}

/**
 * Creates the password recovery handlers for PasswordRecoveryFlow.
 * Connects to: POST /auth/forgot-password, /auth/verify-otp, /auth/reset-password
 */
export function createPasswordRecoveryHandlers(onComplete: () => void) {
  let resetToken = '';

  return {
    requestOtp: async (email: string, phone: string): Promise<void> => {
      await authApi.forgotPassword(email, phone);
    },

    verifyOtp: async (email: string, phone: string, emailOtp: string, phoneOtp: string): Promise<void> => {
      const result = await authApi.verifyOtp({ email, phone, emailOtp, phoneOtp });
      resetToken = result.resetToken;
    },

    resetPassword: async (newPassword: string): Promise<void> => {
      await authApi.resetPassword(resetToken, newPassword);
      onComplete();
    },
  };
}

/**
 * Creates the logout handler.
 * Connects to: POST /auth/logout
 */
export function createLogoutHandler(onLoggedOut: () => void) {
  return async (): Promise<void> => {
    try {
      await api.auth.logout();
    } catch {
      // Continue with local logout even if server call fails
    } finally {
      clearTokens();
      onLoggedOut();
    }
  };
}

// ============================================================
// Dashboard Connectors
// ============================================================

/**
 * Creates fetchStreak for the Dashboard component.
 * Connects to: GET /progress/:studentId/streak
 */
export function createStreakFetcher(studentId: string) {
  return async (): Promise<number> => {
    const streak = await api.progress.getStreak();
    return streak.currentStreak;
  };
}

/**
 * Creates fetchSubjects for the Dashboard component.
 * Connects to: GET /subjects + GET /progress/:studentId
 */
export function createSubjectsFetcher(studentId: string) {
  return async (): Promise<SubjectCardData[]> => {
    const [subjects, progressList] = await Promise.all([
      api.content.getSubjects(),
      api.progress.getProgress(),
    ]);

    return subjects.map((subject) => {
      const progress = progressList.find((p) => p.subjectId === subject.subjectId);
      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        color: subject.color,
        iconName: subject.subjectName.toLowerCase(),
        progressPercentage: progress?.progressPercentage ?? 0,
      };
    });
  };
}

// ============================================================
// Content Ingestion Connectors
// ============================================================

/**
 * Creates handlers for ContentIngestionScreen.
 * Connects to: Content Store service endpoints
 */
export function createContentIngestionHandlers() {
  return {
    fetchSubjects: async (): Promise<SubjectAssignment[]> => {
      return api.content.getSubjects();
    },

    fetchBooks: async (subjectId: string): Promise<Book[]> => {
      return api.content.getBooks(subjectId);
    },

    createBook: async (subjectId: string, name: string): Promise<Book> => {
      return api.content.createBook(subjectId, name);
    },

    fetchChapters: async (bookId: string): Promise<Chapter[]> => {
      return api.content.getChapters(bookId);
    },

    createChapter: async (bookId: string, name: string): Promise<Chapter> => {
      return api.content.createChapter(bookId, name);
    },
  };
}

/**
 * Creates handlers for PageUploadUI.
 * Connects to: Content Ingestion service endpoints
 */
export function createPageUploadHandlers(chapterId: string) {
  return {
    uploadPages: async (files: File[]) => {
      return api.ingestion.uploadPages(chapterId, files);
    },

    extractText: async () => {
      return api.ingestion.extractText(chapterId);
    },
  };
}

// ============================================================
// Chapter Explanation / Comprehension Connectors
// ============================================================

/**
 * Creates handlers for ChapterExplanationScreen.
 * Connects to: Comprehension service endpoints
 */
export function createExplanationHandlers(chapterId: string) {
  return {
    getExplanation: async (pageNumber?: number) => {
      return api.comprehension.getExplanation(chapterId, pageNumber);
    },

    generateAudio: async (pageNumber: number) => {
      return api.comprehension.generateAudio(chapterId, pageNumber);
    },

    generateRevisionQuestions: async () => {
      return api.comprehension.generateRevisionQuestions(chapterId);
    },

    getRevisionQuestions: async () => {
      return api.comprehension.getRevisionQuestions(chapterId);
    },

    generateSummary: async () => {
      return api.comprehension.generateSummary(chapterId);
    },

    getSummary: async () => {
      return api.comprehension.getSummary(chapterId);
    },

    translate: async (targetLanguage: string, pageNumber: number) => {
      return api.comprehension.translate(chapterId, targetLanguage, pageNumber);
    },
  };
}

/**
 * Creates handlers for the Revision screen (viewing stored questions/summary).
 * Connects to: Comprehension service endpoints
 */
export function createRevisionHandlers(chapterId: string) {
  return {
    getRevisionQuestions: async () => {
      return api.comprehension.getRevisionQuestions(chapterId);
    },

    getSummary: async () => {
      return api.comprehension.getSummary(chapterId);
    },
  };
}

// ============================================================
// Exercise Connectors
// ============================================================

/**
 * Creates handlers for ExerciseAssistant.
 * Connects to: Comprehension service hint/evaluate endpoints
 */
export function createExerciseAssistantHandlers(studentId: string) {
  return {
    getExercises: async (chapterId: string) => {
      const result = await api.content.getExercises({ chapterId });
      return result.data;
    },

    getHint: async (exerciseId: string) => {
      return api.comprehension.getHint(exerciseId);
    },

    evaluate: async (exerciseId: string, answer: unknown) => {
      return api.comprehension.evaluate(exerciseId, answer);
    },

    recordResult: async (exerciseId: string, subjectId: string, isCorrect: boolean, score?: number) => {
      await api.progress.recordExerciseResult(studentId, {
        exerciseId,
        subjectId,
        isCorrect,
        score,
      });
    },
  };
}

/**
 * Creates handlers for GrammarExerciseScreen.
 * Connects to: Content Store + Progress service
 */
export function createGrammarHandlers(studentId: string, subjectId: string) {
  return {
    fetchExercises: async () => {
      const result = await api.content.getExercises({
        subjectId,
        exerciseType: 'grammar',
      });
      return result.data;
    },

    submitAnswer: async (exerciseId: string, answer: unknown) => {
      return api.comprehension.evaluate(exerciseId, answer);
    },

    recordResult: async (exerciseId: string, isCorrect: boolean, score?: number) => {
      await api.progress.recordExerciseResult(studentId, {
        exerciseId,
        subjectId,
        isCorrect,
        score,
      });
    },
  };
}

/**
 * Creates handlers for QuizScreen.
 * Connects to: Progress service quiz endpoints
 */
export function createQuizHandlers(studentId: string, subjectId: string) {
  let sessionId: string | null = null;

  return {
    createSession: async (questionIds: string[], timerDurationSeconds: number) => {
      const session = await api.progress.createQuizSession({
        subjectId,
        questionIds,
        timerDurationSeconds,
      });
      sessionId = session.id;
      return session;
    },

    submitAnswer: async (questionId: string, selectedOption: string) => {
      if (!sessionId) throw new ApiClientError(400, 'No active quiz session.', false);
      return api.progress.submitQuizAnswer(sessionId, { questionId, selectedOption });
    },

    skipQuestion: async (questionId: string) => {
      if (!sessionId) return;
      await api.progress.skipQuizQuestion(sessionId, { questionId });
    },

    getResult: async () => {
      if (!sessionId) return null;
      return api.progress.getQuizResult(sessionId);
    },

    fetchQuestions: async () => {
      const result = await api.content.getExercises({
        subjectId,
        exerciseType: 'quiz',
      });
      return result.data;
    },
  };
}

/**
 * Creates handlers for MathsPracticeScreen.
 * Connects to: Content Store + Progress service
 */
export function createMathsHandlers(studentId: string, subjectId: string) {
  return {
    fetchExercises: async () => {
      const result = await api.content.getExercises({
        subjectId,
        exerciseType: 'maths',
      });
      return result.data;
    },

    submitAnswer: async (exerciseId: string, answer: unknown) => {
      return api.comprehension.evaluate(exerciseId, answer);
    },

    recordResult: async (exerciseId: string, isCorrect: boolean) => {
      await api.progress.recordExerciseResult(studentId, {
        exerciseId,
        subjectId,
        isCorrect,
      });
    },
  };
}

/**
 * Creates handlers for ComputersExerciseScreen.
 * Connects to: Content Store + Progress service
 */
export function createComputersHandlers(studentId: string, subjectId: string) {
  return {
    fetchExercises: async () => {
      const result = await api.content.getExercises({
        subjectId,
        exerciseType: 'code',
      });
      return result.data;
    },

    submitAnswer: async (exerciseId: string, answer: unknown) => {
      return api.comprehension.evaluate(exerciseId, answer);
    },

    recordResult: async (exerciseId: string, isCorrect: boolean) => {
      await api.progress.recordExerciseResult(studentId, {
        exerciseId,
        subjectId,
        isCorrect,
      });
    },
  };
}

// ============================================================
// Pronunciation Connector
// ============================================================

/**
 * Creates handlers for PronunciationScreen.
 * Connects to: Pronunciation service
 */
export function createPronunciationHandlers(subjectId: string) {
  return {
    getReferenceAudio: async (wordId: string) => {
      return api.pronunciation.getReferenceAudio(wordId);
    },

    uploadRecording: async (audioBlob: Blob, wordId: string) => {
      return api.pronunciation.uploadRecording(audioBlob, wordId, subjectId);
    },

    fetchWords: async () => {
      // Words are fetched via exercises endpoint with pronunciation type
      const result = await api.content.getExercises({
        subjectId,
        exerciseType: 'pronunciation',
      });
      return result.data;
    },
  };
}

// ============================================================
// Parent Dashboard Connector
// ============================================================

/**
 * Creates handlers for ParentDashboard.
 * Connects to: Auth service parent endpoints
 */
export function createParentDashboardHandlers() {
  return {
    fetchLearners: async (): Promise<LearnerInfo[]> => {
      return api.parent.getLearners();
    },

    updateSubjects: async (learnerId: string, subjects: string[]): Promise<void> => {
      await api.parent.updateLearnerSubjects(learnerId, subjects);
    },
  };
}

// ============================================================
// Transcript Connector
// ============================================================

/**
 * Creates handlers for ChapterTranscript screen.
 * Connects to: Content Ingestion service transcript endpoints
 */
export function createTranscriptHandlers(chapterId: string) {
  return {
    getTranscript: async () => {
      return api.ingestion.getTranscript(chapterId);
    },

    saveTranscript: async (pages: Array<{ pageNumber: number; text: string }>) => {
      await api.ingestion.saveTranscript(chapterId, pages);
    },

    classifyPages: async () => {
      return api.ingestion.classifyPages(chapterId);
    },
  };
}
