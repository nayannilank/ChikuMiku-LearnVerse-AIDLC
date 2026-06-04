/**
 * API client for the ChikuMiku LearnVerse learning session workflow.
 *
 * Points to localhost:3000 by default (use 10.0.2.2 for Android emulator).
 */

// For Android emulator, use 10.0.2.2 to reach host's localhost
const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

const LEARNER_ID = 'mobile-learner-1'; // In production, from auth token

interface ApiOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
}

async function apiCall<T>(options: ApiOptions): Promise<T> {
  const { method, path, body } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-token',
      'x-learner-id': LEARNER_ID,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data as T;
}

// --- Subject APIs ---

export interface EnrolledSubject {
  subjectId: string;
  enrolledAt: string;
}

export async function enrollInSubject(subjectId: string) {
  return apiCall<{ message: string; enrolledSubjects: EnrolledSubject[] }>({
    method: 'POST',
    path: `/api/v1/subjects/${subjectId}/enroll`,
  });
}

export async function listSubjects() {
  return apiCall<{ data: EnrolledSubject[] }>({
    method: 'GET',
    path: '/api/v1/subjects',
  });
}

// --- Learning Session APIs ---

export interface ChapterSummary {
  id: string;
  textbookName: string;
  chapterNumber: number;
  createdAt?: string;
}

export interface StartSessionResponse {
  step: string;
  availableSubjects: EnrolledSubject[];
  message: string;
}

export interface SelectSubjectResponse {
  step: string;
  selectedSubjectId: string;
  availableChapters: ChapterSummary[];
  message: string;
}

export interface SelectChapterResponse {
  step: string;
  selectedSubjectId: string;
  selectedChapterId: string;
}

export interface NewChapterResponse {
  step: string;
  selectedSubjectId: string;
  message: string;
}

export interface SessionStateResponse {
  session: {
    currentStep: string;
    selectedSubjectId: string | null;
    selectedChapterId: string | null;
    availableSubjects: EnrolledSubject[];
    availableChapters: ChapterSummary[];
  } | null;
}

export async function startLearningSession() {
  return apiCall<StartSessionResponse>({
    method: 'POST',
    path: '/api/v1/learning/start',
  });
}

export async function selectSubject(subjectId: string) {
  return apiCall<SelectSubjectResponse>({
    method: 'POST',
    path: '/api/v1/learning/select-subject',
    body: { subjectId },
  });
}

export async function selectChapter(chapterId: string) {
  return apiCall<SelectChapterResponse>({
    method: 'POST',
    path: '/api/v1/learning/select-chapter',
    body: { chapterId },
  });
}

export async function startNewChapter() {
  return apiCall<NewChapterResponse>({
    method: 'POST',
    path: '/api/v1/learning/new-chapter',
  });
}

export async function endChapter() {
  return apiCall({ method: 'POST', path: '/api/v1/learning/end-chapter' });
}

export async function endSession() {
  return apiCall({ method: 'POST', path: '/api/v1/learning/end' });
}

export async function getSessionState() {
  return apiCall<SessionStateResponse>({
    method: 'GET',
    path: '/api/v1/learning/session',
  });
}
