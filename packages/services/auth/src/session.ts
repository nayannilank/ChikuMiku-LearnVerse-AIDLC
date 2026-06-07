/**
 * Login and session management.
 *
 * Handles authentication with valid credentials, session creation with
 * minimum 30-day validity, session expiry detection, and session state tracking.
 *
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.9
 */

import { Learner } from '@learnverse/service-core';
import { isAccountLocked, recordFailedAttempt, resetFailureCounter } from './lockout';

// --- Session Types ---

/** Minimum session duration in milliseconds (30 days) */
export const MIN_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Minimum session duration in days */
export const MIN_SESSION_DURATION_DAYS = 30;

/**
 * Represents an authenticated session.
 * Sessions are valid for a minimum of 30 days from creation.
 */
export interface Session {
  token: string;
  refreshToken: string;
  expiresAt: Date;
  learnerId: string;
}

/**
 * Tracks the learner's current navigation and progress state within a session.
 * This state is maintained while the session is active (Requirement 8.3).
 */
export interface SessionState {
  learnerId: string;
  currentSubjectId: string | null;
  currentChapterId: string | null;
  exerciseProgress: ExerciseProgress | null;
  navigationPosition: NavigationPosition;
}

export interface ExerciseProgress {
  exerciseId: string;
  questionsAnswered: number;
  totalQuestions: number;
  lastAnsweredAt: Date;
}

export interface NavigationPosition {
  screen: string;
  params?: Record<string, unknown>;
}

// --- Login Types ---

export interface LoginCredentials {
  contactValue: string;
  password: string;
}

export interface LoginSuccess {
  success: true;
  session: Session;
}

export interface LoginFailure {
  success: false;
  error: string;
}

export type LoginResult = LoginSuccess | LoginFailure;

// --- In-Memory Learner Store (business logic layer) ---

/**
 * Simple in-memory store for registered learners.
 * This is the business logic layer; persistence is handled separately.
 */
const learnerStore = new Map<string, Learner>();

/**
 * Registers a learner in the in-memory store.
 * Used internally for testing and by the registration flow.
 */
export function addLearnerToStore(learner: Learner): void {
  learnerStore.set(learner.id, learner);
}

/**
 * Retrieves a learner by contact value (email or phone).
 */
export function findLearnerByContact(contactValue: string): Learner | undefined {
  for (const learner of learnerStore.values()) {
    if (learner.contactValue === contactValue) {
      return learner;
    }
  }
  return undefined;
}

/**
 * Clears the in-memory store. Useful for test isolation.
 */
export function clearLearnerStore(): void {
  learnerStore.clear();
}

// --- Session Store ---

const sessionStore = new Map<string, Session>();
const sessionStateStore = new Map<string, SessionState>();

/**
 * Clears all session data. Useful for test isolation.
 */
export function clearSessionStore(): void {
  sessionStore.clear();
  sessionStateStore.clear();
}

// --- Token Generation ---

/**
 * Generates a simple random token string.
 * In production, this would use a cryptographically secure method (e.g., JWT).
 */
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// --- Password Hashing (simplified for business logic layer) ---

/**
 * Simple hash comparison. In production, use bcrypt or argon2.
 * For the business logic layer, we compare the stored hash with a
 * deterministic hash of the provided password.
 */
export function hashPassword(password: string): string {
  // Simple deterministic hash for business logic layer testing.
  // Production would use bcrypt/argon2.
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Verifies a password against a stored hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  return hashPassword(password) === storedHash;
}

// --- Login ---

/**
 * Authenticates a learner with valid credentials and establishes a session.
 *
 * - Checks if the account is locked (3 consecutive failures → 15 min lockout)
 * - Validates that the learner exists by contact value
 * - Verifies the password against the stored hash
 * - Resets failure counter on success
 * - Records failed attempt on failure (may trigger lockout + notification)
 * - Creates a session valid for at least 30 days
 *
 * Requirements: 8.2, 8.5
 */
export function login(credentials: LoginCredentials, now?: Date): LoginResult {
  const { contactValue, password } = credentials;

  // Check if account is locked (Requirement 8.5)
  if (isAccountLocked(contactValue, now)) {
    return {
      success: false,
      error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
    };
  }

  // Find learner by contact value
  const learner = findLearnerByContact(contactValue);
  if (!learner) {
    // Still record the attempt to prevent enumeration timing attacks,
    // but we don't have a contactType — use 'email' as default for unknown contacts
    recordFailedAttempt(contactValue, 'email', now);
    return {
      success: false,
      error: 'Invalid credentials. Please check your email/phone and password.',
    };
  }

  // Verify password
  if (!verifyPassword(password, learner.passwordHash)) {
    recordFailedAttempt(contactValue, learner.contactType, now);
    return {
      success: false,
      error: 'Invalid credentials. Please check your email/phone and password.',
    };
  }

  // Successful authentication — reset failure counter (Requirement 8.5)
  resetFailureCounter(contactValue);

  // Create session with minimum 30-day validity (Requirement 8.4)
  const currentTime = now ?? new Date();
  const expiresAt = new Date(currentTime.getTime() + MIN_SESSION_DURATION_MS);

  const session: Session = {
    token: generateToken(),
    refreshToken: generateToken(),
    expiresAt,
    learnerId: learner.id,
  };

  // Store the session
  sessionStore.set(session.token, session);

  // Initialize session state (Requirement 8.3)
  const initialState: SessionState = {
    learnerId: learner.id,
    currentSubjectId: null,
    currentChapterId: null,
    exerciseProgress: null,
    navigationPosition: { screen: 'home' },
  };
  sessionStateStore.set(session.token, initialState);

  return { success: true, session };
}

// --- Session Expiry Detection ---

/**
 * Checks whether a session has expired.
 *
 * A session is expired if the current time is past the session's expiresAt date.
 * Used to trigger redirect to login screen (Requirement 8.9).
 */
export function isSessionExpired(session: Session, now?: Date): boolean {
  const currentTime = now ?? new Date();
  return currentTime.getTime() >= session.expiresAt.getTime();
}

/**
 * Checks whether a session is valid (exists in store and not expired).
 * Returns the session if valid, or null if expired/invalid.
 *
 * When expired, the session is removed from the store to trigger
 * redirect to login (Requirement 8.9).
 */
export function validateSession(token: string, now?: Date): Session | null {
  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }

  if (isSessionExpired(session, now)) {
    // Remove expired session - triggers redirect to login (Requirement 8.9)
    sessionStore.delete(token);
    sessionStateStore.delete(token);
    return null;
  }

  return session;
}

// --- Session State Management ---

/**
 * Retrieves the current session state for a given session token.
 */
export function getSessionState(token: string): SessionState | null {
  return sessionStateStore.get(token) ?? null;
}

/**
 * Updates the session state (current subject, chapter, exercise progress, navigation).
 * Requirement 8.3: maintain learner's state while session is active.
 */
export function updateSessionState(
  token: string,
  update: Partial<Omit<SessionState, 'learnerId'>>
): SessionState | null {
  const existing = sessionStateStore.get(token);
  if (!existing) {
    return null;
  }

  // Verify session is still valid
  const session = sessionStore.get(token);
  if (!session || isSessionExpired(session)) {
    return null;
  }

  const updated: SessionState = {
    ...existing,
    ...update,
  };
  sessionStateStore.set(token, updated);
  return updated;
}

/**
 * Destroys a session (logout).
 */
export function destroySession(token: string): boolean {
  const existed = sessionStore.has(token);
  sessionStore.delete(token);
  sessionStateStore.delete(token);
  return existed;
}
