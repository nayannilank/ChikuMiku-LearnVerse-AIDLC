/**
 * Mobile API Client
 *
 * Provides API interaction for the React Native mobile app.
 * Mirrors the endpoint patterns from packages/platform-web/app/src/services/api.ts
 * with mobile-specific concerns (token storage, network resilience).
 *
 * Requirements: 3.5, 4.1, 4.2, 8.2
 */

declare const __DEV__: boolean;

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

async function request<T>(options: RequestOptions): Promise<T> {
  const { method, path, body, headers: extraHeaders, skipAuth } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (!skipAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data as T;
}

// --- Auth Endpoints ---

export async function loginApi(username: string, password: string, role: string) {
  return request<{ accessToken: string; refreshToken: string }>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: { username, password, role },
    skipAuth: true,
  });
}

// --- Dashboard / Progress ---

export async function getStreak(studentId: string) {
  return request<{ currentStreak: number; lastActivityDate: string | null }>({
    method: 'GET',
    path: `/api/v1/progress/${studentId}/streak`,
  });
}

export async function getProgress(studentId: string) {
  return request<{
    data: Array<{
      subjectId: string;
      subjectName: string;
      progressPercentage: number;
      color: string;
    }>;
  }>({
    method: 'GET',
    path: `/api/v1/progress/${studentId}`,
  });
}

// --- Content / Subjects ---

export async function getSubjects() {
  return request<{ data: Array<{ id: string; name: string; color: string }> }>({
    method: 'GET',
    path: '/api/v1/subjects',
  });
}

export async function getBooks(subjectId: string) {
  return request<{
    data: Array<{ id: string; name: string; chapterCount: number }>;
  }>({
    method: 'GET',
    path: `/api/v1/subjects/${subjectId}/books`,
  });
}

export async function getChapters(bookId: string) {
  return request<{
    data: Array<{ id: string; name: string; hasContent: boolean; pageCount: number }>;
  }>({
    method: 'GET',
    path: `/api/v1/books/${bookId}/chapters`,
  });
}

export async function uploadPages(chapterId: string, imageUris: string[]) {
  return request<{ message: string; pageCount: number }>({
    method: 'POST',
    path: `/api/v1/chapters/${chapterId}/pages`,
    body: { images: imageUris },
  });
}

export async function extractText(chapterId: string) {
  return request<{ message: string }>({
    method: 'POST',
    path: `/api/v1/chapters/${chapterId}/extract`,
  });
}

// --- Pronunciation ---

export async function getPronunciationWord(wordId: string) {
  return request<{
    word: string;
    phonetic: string;
    syllables: string[];
    referenceAudioUrl: string;
    language: 'kannada' | 'english' | 'hindi';
  }>({
    method: 'GET',
    path: `/api/v1/pronunciation/reference/${wordId}`,
  });
}

export async function submitPronunciationRecording(audioUri: string, wordId: string) {
  return request<{
    accuracyScore: number;
    syllableResults: Array<{ syllable: string; isCorrect: boolean }>;
  }>({
    method: 'POST',
    path: '/api/v1/pronunciation/record',
    body: { audioUri, wordId },
  });
}

// --- Grammar ---

export async function getGrammarExercises(subjectId: string, chapterId?: string) {
  return request<{
    data: Array<{
      id: string;
      questionText: string;
      options: string[];
      correctAnswer: string;
      explanation?: string;
    }>;
  }>({
    method: 'GET',
    path: `/api/v1/exercises?type=grammar&subjectId=${subjectId}${chapterId ? `&chapterId=${chapterId}` : ''}`,
  });
}

export async function submitGrammarAnswer(exerciseId: string, answer: string) {
  return request<{
    isCorrect: boolean;
    explanation: string;
  }>({
    method: 'POST',
    path: `/api/v1/exercises/${exerciseId}/evaluate`,
    body: { answer },
  });
}

// --- Quiz ---

export async function createQuizSession(subjectId: string, timerDuration: number) {
  return request<{
    sessionId: string;
    questions: Array<{
      id: string;
      questionText: string;
      options: string[];
    }>;
    timerDurationSeconds: number;
    totalQuestions: number;
  }>({
    method: 'POST',
    path: '/api/v1/quiz/sessions',
    body: { subjectId, timerDurationSeconds: timerDuration },
  });
}

export async function submitQuizAnswer(sessionId: string, questionId: string, option: string) {
  return request<{
    isCorrect: boolean;
    correctAnswers: number;
    totalAnswered: number;
  }>({
    method: 'POST',
    path: `/api/v1/quiz/sessions/${sessionId}/answer`,
    body: { questionId, selectedOption: option },
  });
}

export async function skipQuizQuestion(sessionId: string, questionId: string) {
  return request<{ message: string }>({
    method: 'POST',
    path: `/api/v1/quiz/sessions/${sessionId}/skip`,
    body: { questionId },
  });
}

export async function getQuizResult(sessionId: string) {
  return request<{
    totalQuestions: number;
    correctAnswers: number;
    scorePercentage: number;
    status: string;
  }>({
    method: 'GET',
    path: `/api/v1/quiz/sessions/${sessionId}/result`,
  });
}

export const mobileApi = {
  loginApi,
  getStreak,
  getProgress,
  getSubjects,
  getBooks,
  getChapters,
  uploadPages,
  extractText,
  getPronunciationWord,
  submitPronunciationRecording,
  getGrammarExercises,
  submitGrammarAnswer,
  createQuizSession,
  submitQuizAnswer,
  skipQuizQuestion,
  getQuizResult,
};
