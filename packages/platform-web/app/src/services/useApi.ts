/**
 * React hooks for wiring frontend screens to the API client.
 *
 * These hooks provide the data-fetching functions and handlers that screens
 * accept as props, connecting them to the centralized API client with proper
 * loading states, error handling, and retry logic.
 *
 * Validates: Requirements 1.1–1.49, 6.1–6.9, 7.1–7.8, 8.1–8.11, 9.1–9.10,
 * 10.1–10.16, 11.1–11.10, 12.1–12.11, 13.1–13.11, 14.1–14.10, 22.1–22.7
 */

import { useCallback, useRef, useState } from 'react';
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
// Auth Hooks
// ============================================================

/**
 * Hook for login screen.
 * Returns the onLogin handler that the LoginScreen expects.
 */
export function useLoginHandler(options: {
  onSuccess: (response: LoginResponse) => void;
  onError?: (error: string) => void;
}) {
  const { onSuccess, onError } = options;

  const handleLogin = useCallback(
    async (username: string, password: string, role: 'parent' | 'student') => {
      try {
        const response = await authApi.login(username, password, role);
        setTokens(response.accessToken, response.refreshToken);
        onSuccess(response);
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'incorrect username or password';
        onError?.(message);
        throw new Error(message);
      }
    },
    [onSuccess, onError],
  );

  return handleLogin;
}

/**
 * Hook for parent registration.
 */
export function useParentRegistration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (data: {
      username: string;
      name: string;
      phone: string;
      email: string;
      password: string;
    }): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await authApi.registerParent(data);
        return true;
      } catch (err) {
        const apiErr = err instanceof ApiClientError ? err : null;
        setError(apiErr?.message ?? 'Registration failed. Please try again.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { register, isLoading, error, clearError: () => setError(null) };
}

/**
 * Hook for student registration.
 */
export function useStudentRegistration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (data: {
      parentUsername: string;
      studentUsername: string;
      name: string;
      password: string;
      grade: string;
      schoolName: string;
      subjects: string[];
    }): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await authApi.registerStudent(data);
        return true;
      } catch (err) {
        const apiErr = err instanceof ApiClientError ? err : null;
        setError(apiErr?.message ?? 'Registration failed. Please try again.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { register, isLoading, error, clearError: () => setError(null) };
}

/**
 * Hook for password recovery flow.
 */
export function usePasswordRecovery() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'request' | 'verify' | 'reset' | 'done'>('request');
  const resetTokenRef = useRef<string>('');

  const requestOtp = useCallback(async (email: string, phone: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.forgotPassword(email, phone);
      setStep('verify');
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to send OTP.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (email: string, phone: string, emailOtp: string, phoneOtp: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await authApi.verifyOtp({ email, phone, emailOtp, phoneOtp });
        resetTokenRef.current = result.resetToken;
        setStep('reset');
        return true;
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Invalid OTP.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const resetPassword = useCallback(async (newPassword: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(resetTokenRef.current, newPassword);
      setStep('done');
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to reset password.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { step, isLoading, error, requestOtp, verifyOtp, resetPassword, clearError: () => setError(null) };
}

/**
 * Hook for logout.
 */
export function useLogout(onLoggedOut: () => void) {
  return useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Continue with local logout even if server call fails
    } finally {
      clearTokens();
      onLoggedOut();
    }
  }, [onLoggedOut]);
}

// ============================================================
// Dashboard Hooks
// ============================================================

/**
 * Hook providing fetchStreak for the Dashboard component.
 */
export function useDashboardStreak(studentId: string) {
  const fetchStreak = useCallback(async (): Promise<number> => {
    const streak = await api.progress.getStreak(studentId);
    return streak.currentStreak;
  }, [studentId]);

  return fetchStreak;
}

/**
 * Hook providing fetchSubjects for the Dashboard component.
 */
export function useDashboardSubjects(studentId: string) {
  const fetchSubjects = useCallback(async (): Promise<SubjectCardData[]> => {
    const [subjects, progressList] = await Promise.all([
      api.content.getSubjects(),
      api.progress.getProgress(studentId),
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
  }, [studentId]);

  return fetchSubjects;
}

// ============================================================
// Content Ingestion Hooks
// ============================================================

/**
 * Hook providing content ingestion handlers.
 */
export function useContentIngestion() {
  const fetchBooks = useCallback(async (subjectId: string): Promise<Book[]> => {
    return api.content.getBooks(subjectId);
  }, []);

  const createBook = useCallback(async (subjectId: string, name: string): Promise<Book> => {
    return api.content.createBook(subjectId, name);
  }, []);

  const fetchChapters = useCallback(async (bookId: string): Promise<Chapter[]> => {
    return api.content.getChapters(bookId);
  }, []);

  const createChapter = useCallback(async (bookId: string, name: string): Promise<Chapter> => {
    return api.content.createChapter(bookId, name);
  }, []);

  const fetchSubjects = useCallback(async (): Promise<SubjectAssignment[]> => {
    return api.content.getSubjects();
  }, []);

  return { fetchSubjects, fetchBooks, createBook, fetchChapters, createChapter };
}

/**
 * Hook for page uploads.
 */
export function usePageUpload(chapterId: string) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPages = useCallback(
    async (files: File[]): Promise<boolean> => {
      setIsUploading(true);
      setError(null);
      try {
        await api.ingestion.uploadPages(chapterId, files);
        return true;
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Upload failed.');
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [chapterId],
  );

  const extractText = useCallback(async (): Promise<boolean> => {
    setIsUploading(true);
    setError(null);
    try {
      await api.ingestion.extractText(chapterId);
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Text extraction failed.');
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [chapterId]);

  return { uploadPages, extractText, isUploading, error };
}

// ============================================================
// Comprehension Hooks
// ============================================================

/**
 * Hook for Chapter Explanation screen data.
 */
export function useChapterExplanation(chapterId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getExplanation = useCallback(
    async (pageNumber?: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.comprehension.getExplanation(chapterId, pageNumber);
        return result;
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load explanation.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chapterId],
  );

  const generateAudio = useCallback(
    async (pageNumber: number) => {
      try {
        return await api.comprehension.generateAudio(chapterId, pageNumber);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to generate audio.');
        return null;
      }
    },
    [chapterId],
  );

  const generateRevisionQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      return await api.comprehension.generateRevisionQuestions(chapterId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to generate questions.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  const getRevisionQuestions = useCallback(async () => {
    try {
      return await api.comprehension.getRevisionQuestions(chapterId);
    } catch {
      return null;
    }
  }, [chapterId]);

  const generateSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      return await api.comprehension.generateSummary(chapterId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to generate summary.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  const getSummary = useCallback(async () => {
    try {
      return await api.comprehension.getSummary(chapterId);
    } catch {
      return null;
    }
  }, [chapterId]);

  const translate = useCallback(
    async (targetLanguage: string, pageNumber: number) => {
      try {
        return await api.comprehension.translate(chapterId, targetLanguage, pageNumber);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Translation failed.');
        return null;
      }
    },
    [chapterId],
  );

  return {
    getExplanation,
    generateAudio,
    generateRevisionQuestions,
    getRevisionQuestions,
    generateSummary,
    getSummary,
    translate,
    isLoading,
    error,
  };
}

/**
 * Hook for Exercise Assistant.
 */
export function useExerciseAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHint = useCallback(async (exerciseId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      return await api.comprehension.getHint(exerciseId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to get hint.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const evaluate = useCallback(async (exerciseId: string, answer: unknown) => {
    setIsLoading(true);
    setError(null);
    try {
      return await api.comprehension.evaluate(exerciseId, answer);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Evaluation failed.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getHint, evaluate, isLoading, error };
}

// ============================================================
// Quiz Hooks
// ============================================================

/**
 * Hook for Quiz screen.
 */
export function useQuizSession(studentId: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(
    async (subjectId: string, questionIds: string[], timerDurationSeconds: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const session = await api.progress.createQuizSession({
          subjectId,
          questionIds,
          timerDurationSeconds,
        });
        setSessionId(session.id);
        return session;
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to start quiz.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const submitAnswer = useCallback(
    async (questionId: string, selectedOption: string) => {
      if (!sessionId) return null;
      try {
        return await api.progress.submitQuizAnswer(sessionId, { questionId, selectedOption });
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to submit answer.');
        return null;
      }
    },
    [sessionId],
  );

  const skipQuestion = useCallback(
    async (questionId: string) => {
      if (!sessionId) return;
      try {
        await api.progress.skipQuizQuestion(sessionId, { questionId });
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to skip question.');
      }
    },
    [sessionId],
  );

  const getResult = useCallback(async () => {
    if (!sessionId) return null;
    setIsLoading(true);
    try {
      return await api.progress.getQuizResult(sessionId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load results.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const recordResult = useCallback(
    async (exerciseId: string, subjectId: string, isCorrect: boolean, score?: number) => {
      try {
        await api.progress.recordExerciseResult(studentId, {
          exerciseId,
          subjectId,
          isCorrect,
          score,
        });
      } catch {
        // Silently fail — progress recording is non-blocking
      }
    },
    [studentId],
  );

  return { createSession, submitAnswer, skipQuestion, getResult, recordResult, sessionId, isLoading, error };
}

// ============================================================
// Pronunciation Hook
// ============================================================

/**
 * Hook for Pronunciation screen.
 */
export function usePronunciation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReferenceAudio = useCallback(async (wordId: string) => {
    try {
      return await api.pronunciation.getReferenceAudio(wordId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load reference audio.');
      return null;
    }
  }, []);

  const uploadRecording = useCallback(async (audioBlob: Blob, wordId: string, subjectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.pronunciation.uploadRecording(audioBlob, wordId, subjectId);
      return result;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to score recording.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getReferenceAudio, uploadRecording, isLoading, error };
}

// ============================================================
// Parent Dashboard Hook
// ============================================================

/**
 * Hook for Parent Dashboard data.
 */
export function useParentDashboard() {
  const [learners, setLearners] = useState<LearnerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLearners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.parent.getLearners();
      setLearners(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load learners.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSubjects = useCallback(async (learnerId: string, subjects: string[]) => {
    await api.parent.updateLearnerSubjects(learnerId, subjects);
    // Refresh learner list after update
    await fetchLearners();
  }, [fetchLearners]);

  return { learners, isLoading, error, fetchLearners, updateSubjects };
}
