/**
 * API client for the ChikuMiku LearnVerse learning session workflow.
 *
 * Points to localhost:3000 by default (use 10.0.2.2 for Android emulator).
 * Auth token is managed externally via setAuthToken() — called by AuthContext
 * when login/registration succeeds.
 */

// For Android emulator, use 10.0.2.2 to reach host's localhost
const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.learnverse.example.com';

// --- Token management ---

let authToken: string | null = null;
let cachedUserId: string | null = null;

/**
 * Store the session token for use by the API client.
 * Also extracts and caches the userId from the JWT payload.
 * Call this when the user logs in or registers successfully.
 */
export function setAuthToken(token: string | null): void {
  authToken = token;
  cachedUserId = token ? extractUserIdFromToken(token) : null;
}

/**
 * Get the currently authenticated user's ID (extracted from JWT).
 * Returns null if no token is set or the token cannot be decoded.
 */
export function getAuthenticatedUserId(): string | null {
  return cachedUserId;
}

/**
 * Decode the JWT payload (base64url) to extract userId.
 * This is a simple decode — it does NOT verify the signature.
 */
function extractUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url decode the payload
    let payload = parts[1];
    // Replace base64url chars with standard base64
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Pad if necessary
    const pad = payload.length % 4;
    if (pad) {
      payload += '='.repeat(4 - pad);
    }

    const decoded = JSON.parse(atob(payload));
    return decoded.userId || decoded.sub || decoded.id || null;
  } catch {
    return null;
  }
}

// --- API call helpers ---

interface ApiOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  /** If true, skip the Authorization header (for public endpoints) */
  skipAuth?: boolean;
}

async function apiCall<T>(options: ApiOptions): Promise<T> {
  const {method, path, body, skipAuth} = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!skipAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (!skipAuth && cachedUserId) {
    headers['x-learner-id'] = cachedUserId;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data as T;
}

// --- Auth endpoints (public, no Bearer token needed) ---

export interface LoginResponse {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
  userId?: string;
  userType?: 'parent' | 'student';
}

export interface RegisterParentResponse {
  message: string;
  userId?: string;
}

export interface RegisterStudentResponse {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  userId?: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId?: string;
  userType?: 'parent' | 'student';
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return apiCall<LoginResponse>({
    method: 'POST',
    path: '/api/v1/auth/login',
    body: {username, password},
    skipAuth: true,
  });
}

export async function registerParent(data: {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
}): Promise<RegisterParentResponse> {
  return apiCall<RegisterParentResponse>({
    method: 'POST',
    path: '/api/v1/auth/register/parent',
    body: data as unknown as Record<string, unknown>,
    skipAuth: true,
  });
}

export async function registerStudent(data: {
  name: string;
  username: string;
  password: string;
  grade: number;
  parentUsername: string;
}): Promise<RegisterStudentResponse> {
  return apiCall<RegisterStudentResponse>({
    method: 'POST',
    path: '/api/v1/auth/register/student',
    body: data as unknown as Record<string, unknown>,
    skipAuth: true,
  });
}

export async function forgotPassword(data: {
  username: string;
  email?: string;
  phone?: string;
}): Promise<ForgotPasswordResponse> {
  return apiCall<ForgotPasswordResponse>({
    method: 'POST',
    path: '/api/v1/auth/forgot-password',
    body: data as unknown as Record<string, unknown>,
    skipAuth: true,
  });
}

export async function validateToken(
  token: string,
): Promise<ValidateTokenResponse> {
  // Temporarily set the token for this specific request
  const previousToken = authToken;
  authToken = token;
  try {
    const result = await apiCall<ValidateTokenResponse>({
      method: 'GET',
      path: '/api/v1/auth/validate',
    });
    authToken = previousToken;
    return result;
  } catch (error) {
    authToken = previousToken;
    throw error;
  }
}

// --- Subject APIs ---

export interface EnrolledSubject {
  subjectId: string;
  enrolledAt: string;
}

export async function enrollInSubject(subjectId: string) {
  return apiCall<{message: string; enrolledSubjects: EnrolledSubject[]}>({
    method: 'POST',
    path: `/api/v1/subjects/${subjectId}/enroll`,
  });
}

export async function listSubjects() {
  return apiCall<{data: EnrolledSubject[]}>({
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
    body: {subjectId},
  });
}

export async function selectChapter(chapterId: string) {
  return apiCall<SelectChapterResponse>({
    method: 'POST',
    path: '/api/v1/learning/select-chapter',
    body: {chapterId},
  });
}

export async function startNewChapter() {
  return apiCall<NewChapterResponse>({
    method: 'POST',
    path: '/api/v1/learning/new-chapter',
  });
}

export async function endChapter() {
  return apiCall({method: 'POST', path: '/api/v1/learning/end-chapter'});
}

export async function endSession() {
  return apiCall({method: 'POST', path: '/api/v1/learning/end'});
}

export async function getSessionState() {
  return apiCall<SessionStateResponse>({
    method: 'GET',
    path: '/api/v1/learning/session',
  });
}

// --- Textbook APIs ---

export interface Textbook {
  id: string;
  subjectId: string;
  learnerId: string;
  name: string;
  chapters: ChapterSummary[];
  createdAt: string;
  updatedAt: string;
}

export async function listTextbooks(subjectId: string) {
  return apiCall<{data: Textbook[]}>({
    method: 'GET',
    path: `/api/v1/subjects/${subjectId}/textbooks`,
  });
}

export async function createTextbook(subjectId: string, name: string) {
  return apiCall<Textbook>({
    method: 'POST',
    path: `/api/v1/subjects/${subjectId}/textbooks`,
    body: {name},
  });
}

export async function listChaptersForTextbook(textbookId: string) {
  return apiCall<{data: ChapterSummary[]}>({
    method: 'GET',
    path: `/api/v1/textbooks/${textbookId}/chapters`,
  });
}

// --- Chapter APIs ---

export interface Chapter {
  id: string;
  textbookId: string;
  name: string;
  chapterNumber: number;
  pages: Page[];
  createdAt: string;
  updatedAt: string;
}

export async function createChapter(textbookId: string, name: string) {
  return apiCall<Chapter>({
    method: 'POST',
    path: `/api/v1/textbooks/${textbookId}/chapters`,
    body: {name},
  });
}

// --- Page APIs ---

export interface Page {
  id: string;
  chapterId: string;
  imageUri: string;
  imageSizeBytes: number;
  imageFormat: 'jpeg' | 'png';
  pageNumber: number;
  createdAt: string;
}

export async function uploadPage(chapterId: string, imageData: string) {
  return apiCall<Page>({
    method: 'POST',
    path: `/api/v1/chapters/${chapterId}/pages`,
    body: {imageData},
  });
}
