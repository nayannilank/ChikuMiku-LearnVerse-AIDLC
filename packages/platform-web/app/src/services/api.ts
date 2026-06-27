/**
 * Central API Client for ChikuMiku LearnVerse.
 *
 * Provides:
 * 1. Base URL configuration (from VITE_API_BASE environment variable)
 * 2. JWT token management (attach to Authorization header, auto-refresh on 401)
 * 3. Error handling (transforms API errors to typed ApiError objects)
 * 4. Retry logic (exponential backoff for 5xx, max 3 retries)
 * 5. Loading state helpers
 *
 * Validates: Requirements 1.1–1.49, 6.1–6.9, 7.1–7.8, 8.1–8.11, 9.1–9.10,
 * 10.1–10.16, 11.1–11.10, 12.1–12.11, 13.1–13.11, 14.1–14.10, 15.1–15.7,
 * 16.1–16.6, 17.1–17.8, 22.1–22.7
 */

import type {
  Book,
  Chapter,
  ChapterPage,
  ChapterExplanation,
  ChapterSummary,
  Exercise,
  PronunciationResult,
  PronunciationWord,
  QuizSession,
  RevisionQuestion,
  StudentProgress,
  Streak,
  SubjectAssignment,
} from '@learnverse/platform-contracts';

// ============================================================
// Configuration
// ============================================================

/**
 * Base URL for the API. Configured via the VITE_API_BASE environment variable.
 * Defaults to empty string (relative URLs) in development.
 */
export const API_BASE_URL: string =
  ((import.meta as unknown as Record<string, Record<string, string>>).env
    ?.VITE_API_BASE as string | undefined) || '';

/**
 * API path prefix. All backend routes are mounted under /api/v1.
 * This ensures requests go through the Vite dev proxy as relative URLs
 * (e.g., /api/v1/auth/register/parent) rather than needing absolute URLs.
 */
const API_PREFIX = '/api/v1';

// ============================================================
// Types
// ============================================================

/** Typed API error returned by the client */
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  field?: string;
  retryable: boolean;
}

/** Generic response wrapper for API calls */
export interface ApiResponse<T> {
  data: T;
  status: number;
}

/** Options for individual requests */
export interface RequestOptions {
  /** Skip JWT token attachment */
  skipAuth?: boolean;
  /** Disable retry logic for this request */
  noRetry?: boolean;
  /** Custom timeout in ms (default: 30000) */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/** Token pair stored in memory */
interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Login response from the server */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  username: string;
  role: 'parent' | 'student';
  userId: string;
}

/** Learner info for parent dashboard */
export interface LearnerInfo {
  id: string;
  name: string;
  grade: string;
  subjects: string[];
  progress: Array<{
    subjectName: string;
    progressPercent: number;
    streak: number;
    recentActivity: string;
  }>;
}

/** Pronunciation scoring response */
export interface PronunciationScoreResponse {
  wordId: string;
  accuracyScore: number;
  syllableResults: Array<{ syllable: string; isCorrect: boolean }>;
}

/** Exercise evaluation response */
export interface EvaluationResponse {
  isCorrect: boolean;
  score: number;
  feedback: string;
  chapterReference?: string;
}

/** Exercise hint response */
export interface HintResponse {
  hint: string;
  chapterReference?: string;
}

/** OTP verification request */
export interface VerifyOtpRequest {
  email: string;
  phone: string;
  emailOtp: string;
  phoneOtp: string;
}

// ============================================================
// Token Management
// ============================================================

const TOKEN_STORAGE_KEY = 'learnverse_tokens';

let tokens: TokenPair | null = null;
let refreshPromise: Promise<string> | null = null;

/** Load tokens from localStorage on init */
function loadTokens(): void {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      tokens = JSON.parse(stored);
    }
  } catch {
    tokens = null;
  }
}

/** Save tokens to localStorage */
function saveTokens(pair: TokenPair): void {
  tokens = pair;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(pair));
  } catch {
    // Storage may be full or disabled
  }
}

/** Clear stored tokens (logout) */
export function clearTokens(): void {
  tokens = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/** Get current access token */
export function getAccessToken(): string | null {
  if (!tokens) loadTokens();
  return tokens?.accessToken ?? null;
}

/** Set tokens after login */
export function setTokens(accessToken: string, refreshToken: string): void {
  saveTokens({ accessToken, refreshToken });
}

/**
 * Refresh the access token using the stored refresh token.
 * Deduplicates concurrent refresh calls.
 */
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    if (!tokens?.refreshToken) {
      throw new ApiClientError(401, 'No refresh token available', false);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        throw new ApiClientError(401, 'Session expired. Please log in again.', false);
      }

      const data = await response.json();
      saveTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || tokens.refreshToken,
      });
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================================
// Error Class
// ============================================================

export class ApiClientError extends Error implements ApiError {
  public status: number;
  public code?: string;
  public field?: string;
  public retryable: boolean;

  constructor(
    status: number,
    message: string,
    retryable: boolean,
    code?: string,
    field?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.retryable = retryable;
    this.code = code;
    this.field = field;
  }
}

// ============================================================
// Retry Logic — Exponential Backoff
// ============================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s + jitter
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 200;
  return delay + jitter;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Core Fetch Wrapper
// ============================================================

/**
 * Core request function with retry logic, token management, and error handling.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  if (!tokens) loadTokens();

  const { skipAuth = false, noRetry = false, timeout = 30000, signal } = options;
  const url = `${API_BASE_URL}${API_PREFIX}${path}`;

  let lastError: ApiClientError | null = null;
  const maxAttempts = noRetry ? 1 : MAX_RETRIES + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(getRetryDelay(attempt - 1));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!skipAuth && tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Merge external signal with timeout
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (body !== undefined && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Handle 401 — attempt token refresh (once)
      if (response.status === 401 && !skipAuth && attempt === 0) {
        try {
          const newToken = await refreshAccessToken();
          headers['Authorization'] = `Bearer ${newToken}`;

          // Retry the original request with new token
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers,
          });

          if (retryResponse.ok) {
            const data = retryResponse.status === 204 ? (undefined as T) : await retryResponse.json();
            return data;
          }

          if (retryResponse.status === 401) {
            clearTokens();
            throw new ApiClientError(401, 'Session expired. Please log in again.', false);
          }

          throw await parseErrorResponse(retryResponse);
        } catch (refreshErr) {
          if (refreshErr instanceof ApiClientError) throw refreshErr;
          clearTokens();
          throw new ApiClientError(401, 'Session expired. Please log in again.', false);
        }
      }

      // Success
      if (response.ok) {
        if (response.status === 204) return undefined as T;
        const data = await response.json();
        return data as T;
      }

      // Parse error
      const error = await parseErrorResponse(response);

      // Retry only 5xx and 429 errors
      if (isRetryableStatus(response.status) && attempt < maxAttempts - 1) {
        lastError = error;
        continue;
      }

      throw error;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ApiClientError) {
        if (isRetryableStatus(err.status) && attempt < maxAttempts - 1) {
          lastError = err;
          continue;
        }
        throw err;
      }

      // Network errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiClientError(0, 'Request timed out. Please try again.', true);
      }

      const networkError = new ApiClientError(
        0,
        'Unable to connect. Please check your internet connection.',
        true,
      );

      if (attempt < maxAttempts - 1) {
        lastError = networkError;
        continue;
      }

      throw networkError;
    }
  }

  // All retries exhausted
  throw lastError ?? new ApiClientError(500, 'Request failed after retries.', false);
}

/**
 * Parse an error response into a typed ApiClientError.
 */
async function parseErrorResponse(response: Response): Promise<ApiClientError> {
  const retryable = isRetryableStatus(response.status);

  if (response.status >= 500) {
    return new ApiClientError(
      response.status,
      'Something went wrong. Please try again.',
      true,
    );
  }

  let message = 'Request failed. Please try again.';
  let code: string | undefined;
  let field: string | undefined;

  try {
    const data = await response.json();
    message = data.message || data.error || message;
    code = data.code;
    field = data.field;
  } catch {
    // Response body wasn't valid JSON
  }

  return new ApiClientError(response.status, message, retryable, code, field);
}

// ============================================================
// HTTP Method Helpers
// ============================================================

function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, body, options);
}

function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('PUT', path, body, options);
}

function del<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('DELETE', path, undefined, options);
}

// ============================================================
// Loading State Helper
// ============================================================

export interface LoadingState<T> {
  data: T | null;
  loading: boolean;
  error: ApiClientError | null;
}

/**
 * Creates a loading state wrapper for async operations.
 * Returns a tuple of [execute, state] for use in components.
 */
export function createLoadingState<T>(): LoadingState<T> {
  return { data: null, loading: false, error: null };
}

/**
 * Wraps an async function to handle loading/error states.
 * Useful for calling from React components.
 */
export async function withLoadingState<T>(
  fn: () => Promise<T>,
  setState: (state: Partial<LoadingState<T>>) => void,
): Promise<T | null> {
  setState({ loading: true, error: null });
  try {
    const data = await fn();
    setState({ data, loading: false, error: null });
    return data;
  } catch (err) {
    const apiError =
      err instanceof ApiClientError
        ? err
        : new ApiClientError(0, 'An unexpected error occurred.', false);
    setState({ loading: false, error: apiError });
    return null;
  }
}

// ============================================================
// API Endpoints — Auth Service
// ============================================================

export const authApi = {
  /** POST /auth/login — Authenticate with role */
  login(username: string, password: string, role: 'parent' | 'student'): Promise<LoginResponse> {
    return post<LoginResponse>('/auth/login', { username, password, role }, { skipAuth: true });
  },

  /** POST /auth/register/parent — Register parent account */
  registerParent(data: {
    username: string;
    name: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<{ id: string }> {
    return post('/auth/register/parent', data, { skipAuth: true });
  },

  /** POST /auth/register/student — Register student under parent */
  registerStudent(data: {
    parentUsername: string;
    studentUsername: string;
    name: string;
    password: string;
    gender: 'male' | 'female' | 'other';
    grade: string;
    schoolName: string;
    subjects: string[];
    customSubjects?: { name: string }[];
  }): Promise<{ id: string }> {
    return post('/auth/register/student', data, { skipAuth: true });
  },

  /** POST /auth/forgot-password — Initiate password recovery */
  forgotPassword(email: string, phone: string): Promise<void> {
    return post('/auth/forgot-password', { email, phone }, { skipAuth: true });
  },

  /** POST /auth/verify-otp — Verify dual OTP */
  verifyOtp(data: VerifyOtpRequest): Promise<{ resetToken: string }> {
    return post('/auth/verify-otp', data, { skipAuth: true });
  },

  /** POST /auth/reset-password — Set new password */
  resetPassword(token: string, newPassword: string): Promise<void> {
    return post('/auth/reset-password', { token, newPassword }, { skipAuth: true });
  },

  /** POST /auth/refresh — Refresh JWT token */
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return post('/auth/refresh', { refreshToken }, { skipAuth: true });
  },

  /** POST /auth/logout — Persist state and logout */
  logout(): Promise<void> {
    return post('/auth/logout');
  },
};

// ============================================================
// API Endpoints — Content Store Service
// ============================================================

export const contentApi = {
  /** GET /subjects — List subjects for authenticated user */
  getSubjects(): Promise<SubjectAssignment[]> {
    return get('/subjects');
  },

  /** GET /subjects/:id/books — List books for subject */
  getBooks(subjectId: string): Promise<Book[]> {
    return get(`/subjects/${subjectId}/books`);
  },

  /** POST /subjects/:id/books — Create new book */
  createBook(subjectId: string, name: string): Promise<Book> {
    return post(`/subjects/${subjectId}/books`, { name });
  },

  /** GET /books/:id/chapters — List chapters for book */
  getChapters(bookId: string): Promise<Chapter[]> {
    return get(`/books/${bookId}/chapters`);
  },

  /** POST /books/:id/chapters — Create new chapter */
  createChapter(bookId: string, name: string): Promise<Chapter> {
    return post(`/books/${bookId}/chapters`, { name });
  },

  /** GET /exercises — List exercises (paginated, filtered) */
  getExercises(params: {
    subjectId?: string;
    chapterId?: string;
    exerciseType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Exercise[]; total: number; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params.subjectId) query.set('subjectId', params.subjectId);
    if (params.chapterId) query.set('chapterId', params.chapterId);
    if (params.exerciseType) query.set('exerciseType', params.exerciseType);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    return get(`/exercises?${query.toString()}`);
  },

  /** POST /exercises — Create exercise */
  createExercise(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    return post('/exercises', exercise);
  },

  /** PUT /exercises/:id — Update exercise */
  updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise> {
    return put(`/exercises/${id}`, updates);
  },

  /** DELETE /exercises/:id — Delete exercise */
  deleteExercise(id: string): Promise<void> {
    return del(`/exercises/${id}`);
  },
};

// ============================================================
// API Endpoints — Content Ingestion Service
// ============================================================

export const ingestionApi = {
  /** POST /chapters/:id/pages — Upload page images */
  async uploadPages(chapterId: string, files: File[]): Promise<ChapterPage[]> {
    // File uploads use FormData instead of JSON
    if (!tokens) loadTokens();

    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`page_${index}`, file);
    });

    const headers: Record<string, string> = {};
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/chapters/${chapterId}/pages`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return response.json();
  },

  /** POST /chapters/:id/extract — Trigger OCR extraction */
  extractText(chapterId: string): Promise<ChapterPage[]> {
    return post(`/chapters/${chapterId}/extract`, undefined, { timeout: 60000 });
  },

  /** PUT /chapters/:id/transcript — Save/edit transcript */
  saveTranscript(chapterId: string, pages: Array<{ pageNumber: number; text: string }>): Promise<void> {
    return put(`/chapters/${chapterId}/transcript`, { pages });
  },

  /** GET /chapters/:id/transcript — Get transcript */
  getTranscript(chapterId: string): Promise<ChapterPage[]> {
    return get(`/chapters/${chapterId}/transcript`);
  },

  /** POST /chapters/:id/classify-pages — Classify exercise pages */
  classifyPages(chapterId: string): Promise<{ exercisePages: number[] }> {
    return post(`/chapters/${chapterId}/classify-pages`);
  },
};

// ============================================================
// API Endpoints — Comprehension Service
// ============================================================

export const comprehensionApi = {
  /** GET /chapters/:id/explanation — Get/generate explanation */
  getExplanation(chapterId: string, pageNumber?: number): Promise<ChapterExplanation> {
    const query = pageNumber != null ? `?page=${pageNumber}` : '';
    return get(`/chapters/${chapterId}/explanation${query}`);
  },

  /** POST /chapters/:id/explanation/audio — Generate TTS audio */
  generateAudio(chapterId: string, pageNumber: number): Promise<{ audioCdnUrl: string }> {
    return post(`/chapters/${chapterId}/explanation/audio`, { pageNumber }, { timeout: 60000 });
  },

  /** POST /chapters/:id/revision-questions — Generate revision questions */
  generateRevisionQuestions(chapterId: string): Promise<RevisionQuestion[]> {
    return post(`/chapters/${chapterId}/revision-questions`, undefined, { timeout: 30000 });
  },

  /** GET /chapters/:id/revision-questions — Get stored revision questions */
  getRevisionQuestions(chapterId: string): Promise<RevisionQuestion[]> {
    return get(`/chapters/${chapterId}/revision-questions`);
  },

  /** POST /chapters/:id/summary — Generate chapter summary */
  generateSummary(chapterId: string): Promise<ChapterSummary> {
    return post(`/chapters/${chapterId}/summary`, undefined, { timeout: 30000 });
  },

  /** GET /chapters/:id/summary — Get stored summary */
  getSummary(chapterId: string): Promise<ChapterSummary> {
    return get(`/chapters/${chapterId}/summary`);
  },

  /** POST /chapters/:id/translate — Translate explanation */
  translate(chapterId: string, targetLanguage: string, pageNumber: number): Promise<{ translatedText: string }> {
    return post(`/chapters/${chapterId}/translate`, { targetLanguage, pageNumber });
  },

  /** POST /exercises/:id/hint — Get RAG-based hint */
  getHint(exerciseId: string): Promise<HintResponse> {
    return post(`/exercises/${exerciseId}/hint`);
  },

  /** POST /exercises/:id/evaluate — Evaluate student answer */
  evaluate(exerciseId: string, answer: unknown): Promise<EvaluationResponse> {
    return post(`/exercises/${exerciseId}/evaluate`, { answer });
  },
};

// ============================================================
// API Endpoints — Progress Service
// ============================================================

export const progressApi = {
  /** GET /progress — Get progress summary (learner identified from auth token) */
  getProgress(): Promise<StudentProgress[]> {
    return get('/progress');
  },

  /** GET /progress/streak — Get streak data (no backend endpoint yet; returns default) */
  getStreak(): Promise<Streak> {
    return get('/progress/streak');
  },

  /** POST /progress/:studentId/exercise-result — Record exercise result */
  recordExerciseResult(
    studentId: string,
    data: { exerciseId: string; subjectId: string; isCorrect: boolean; score?: number; answerGiven?: unknown },
  ): Promise<void> {
    return post(`/progress/${studentId}/exercise-result`, data);
  },

  /** POST /quiz/sessions — Create quiz session */
  createQuizSession(data: {
    subjectId: string;
    questionIds: string[];
    timerDurationSeconds: number;
  }): Promise<QuizSession> {
    return post('/quiz/sessions', data);
  },

  /** POST /quiz/sessions/:id/answer — Submit quiz answer */
  submitQuizAnswer(sessionId: string, data: { questionId: string; selectedOption: string }): Promise<{
    isCorrect: boolean;
    correctAnswer: string;
  }> {
    return post(`/quiz/sessions/${sessionId}/answer`, data);
  },

  /** POST /quiz/sessions/:id/skip — Skip quiz question */
  skipQuizQuestion(sessionId: string, data: { questionId: string }): Promise<void> {
    return post(`/quiz/sessions/${sessionId}/skip`, data);
  },

  /** GET /quiz/sessions/:id/result — Get session result */
  getQuizResult(sessionId: string): Promise<QuizSession> {
    return get(`/quiz/sessions/${sessionId}/result`);
  },
};

// ============================================================
// API Endpoints — Pronunciation Service
// ============================================================

export const pronunciationApi = {
  /** POST /pronunciation/record — Upload recording + get score */
  async uploadRecording(audioBlob: Blob, wordId: string, subjectId: string): Promise<PronunciationScoreResponse> {
    if (!tokens) loadTokens();

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('wordId', wordId);
    formData.append('subjectId', subjectId);

    const headers: Record<string, string> = {};
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${API_PREFIX}/pronunciation/record`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return response.json();
  },

  /** GET /pronunciation/reference/:wordId — Get reference audio URL */
  getReferenceAudio(wordId: string): Promise<PronunciationWord> {
    return get(`/pronunciation/reference/${wordId}`);
  },
};

// ============================================================
// API Endpoints — Parent Service
// ============================================================

export const parentApi = {
  /** GET /parent/learners — List parent's registered learners */
  getLearners(): Promise<LearnerInfo[]> {
    return get('/parent/learners');
  },

  /** PUT /parent/learners/:id/subjects — Edit learner's subjects */
  updateLearnerSubjects(learnerId: string, subjects: string[]): Promise<void> {
    return put(`/parent/learners/${learnerId}/subjects`, { subjects });
  },
};

// ============================================================
// Convenience: Combined API object
// ============================================================

export const api = {
  auth: authApi,
  content: contentApi,
  ingestion: ingestionApi,
  comprehension: comprehensionApi,
  progress: progressApi,
  pronunciation: pronunciationApi,
  parent: parentApi,
} as const;

export default api;
