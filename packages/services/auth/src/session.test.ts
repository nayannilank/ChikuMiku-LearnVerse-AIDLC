import { describe, it, expect, beforeEach } from 'vitest';
import {
  login,
  isSessionExpired,
  validateSession,
  getSessionState,
  updateSessionState,
  destroySession,
  addLearnerToStore,
  clearLearnerStore,
  clearSessionStore,
  hashPassword,
  verifyPassword,
  findLearnerByContact,
  Session,
  SessionState,
  LoginCredentials,
  MIN_SESSION_DURATION_MS,
  MIN_SESSION_DURATION_DAYS,
} from './session';
import { clearLockoutStore } from './lockout';
import { Learner } from '@chikumiku/service-core';

// --- Test Helpers ---

function createTestLearner(overrides?: Partial<Learner>): Learner {
  const password = 'secure1pass';
  return {
    id: 'learner-1',
    displayName: 'Chiku',
    contactType: 'email',
    contactValue: 'chiku@example.com',
    passwordHash: hashPassword(password),
    grade: 5,
    enrolledSubjects: ['kannada'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('session management', () => {
  beforeEach(() => {
    clearLearnerStore();
    clearSessionStore();
    clearLockoutStore();
  });

  describe('hashPassword and verifyPassword', () => {
    it('produces a deterministic hash', () => {
      const hash1 = hashPassword('mypassword1');
      const hash2 = hashPassword('mypassword1');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different passwords', () => {
      const hash1 = hashPassword('password1a');
      const hash2 = hashPassword('password2b');
      expect(hash1).not.toBe(hash2);
    });

    it('verifyPassword returns true for matching password', () => {
      const hash = hashPassword('hello123');
      expect(verifyPassword('hello123', hash)).toBe(true);
    });

    it('verifyPassword returns false for non-matching password', () => {
      const hash = hashPassword('hello123');
      expect(verifyPassword('wrong456', hash)).toBe(false);
    });
  });

  describe('findLearnerByContact', () => {
    it('finds a learner by email', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);
      const found = findLearnerByContact('chiku@example.com');
      expect(found).toBeDefined();
      expect(found!.id).toBe('learner-1');
    });

    it('finds a learner by phone', () => {
      const learner = createTestLearner({
        id: 'learner-2',
        contactType: 'phone',
        contactValue: '+919876543210',
      });
      addLearnerToStore(learner);
      const found = findLearnerByContact('+919876543210');
      expect(found).toBeDefined();
      expect(found!.id).toBe('learner-2');
    });

    it('returns undefined for non-existent contact', () => {
      const found = findLearnerByContact('nobody@example.com');
      expect(found).toBeUndefined();
    });
  });

  describe('login', () => {
    it('authenticates with valid credentials and returns a session', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const result = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.session.learnerId).toBe('learner-1');
        expect(result.session.token).toBeTruthy();
        expect(result.session.refreshToken).toBeTruthy();
        expect(result.session.expiresAt).toBeInstanceOf(Date);
      }
    });

    it('creates a session valid for at least 30 days', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const beforeLogin = new Date();
      const result = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const minExpiry = new Date(beforeLogin.getTime() + MIN_SESSION_DURATION_MS);
        expect(result.session.expiresAt.getTime()).toBeGreaterThanOrEqual(
          minExpiry.getTime() - 1000 // allow 1s tolerance for test execution time
        );
      }
    });

    it('fails with non-existent contact', () => {
      const result = login({
        contactValue: 'nobody@example.com',
        password: 'secure1pass',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid credentials');
      }
    });

    it('fails with wrong password', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const result = login({
        contactValue: 'chiku@example.com',
        password: 'wrongpassword1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid credentials');
      }
    });

    it('does not reveal whether contact or password is wrong', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const noContact = login({
        contactValue: 'nobody@example.com',
        password: 'secure1pass',
      });
      const wrongPass = login({
        contactValue: 'chiku@example.com',
        password: 'wrongpassword1',
      });

      // Both should give the same generic error message
      expect(noContact.success).toBe(false);
      expect(wrongPass.success).toBe(false);
      if (!noContact.success && !wrongPass.success) {
        expect(noContact.error).toBe(wrongPass.error);
      }
    });

    it('generates unique tokens for each login', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const result1 = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      const result2 = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.session.token).not.toBe(result2.session.token);
        expect(result1.session.refreshToken).not.toBe(result2.session.refreshToken);
      }
    });

    it('initializes session state on successful login', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const result = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const state = getSessionState(result.session.token);
        expect(state).not.toBeNull();
        expect(state!.learnerId).toBe('learner-1');
        expect(state!.currentSubjectId).toBeNull();
        expect(state!.currentChapterId).toBeNull();
        expect(state!.exerciseProgress).toBeNull();
        expect(state!.navigationPosition.screen).toBe('home');
      }
    });
  });

  describe('isSessionExpired', () => {
    it('returns false for a session that has not expired', () => {
      const session: Session = {
        token: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + MIN_SESSION_DURATION_MS),
        learnerId: 'learner-1',
      };

      expect(isSessionExpired(session)).toBe(false);
    });

    it('returns true for a session past its expiry', () => {
      const session: Session = {
        token: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
        learnerId: 'learner-1',
      };

      expect(isSessionExpired(session)).toBe(true);
    });

    it('returns true when current time equals expiry time', () => {
      const expiresAt = new Date('2025-07-01T00:00:00Z');
      const session: Session = {
        token: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt,
        learnerId: 'learner-1',
      };

      expect(isSessionExpired(session, expiresAt)).toBe(true);
    });

    it('returns false one millisecond before expiry', () => {
      const expiresAt = new Date('2025-07-01T00:00:00Z');
      const session: Session = {
        token: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt,
        learnerId: 'learner-1',
      };

      const justBefore = new Date(expiresAt.getTime() - 1);
      expect(isSessionExpired(session, justBefore)).toBe(false);
    });

    it('correctly handles 30-day boundary', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const expiresAt = new Date(createdAt.getTime() + MIN_SESSION_DURATION_MS);
      const session: Session = {
        token: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt,
        learnerId: 'learner-1',
      };

      // At day 29, session should still be valid
      const day29 = new Date(createdAt.getTime() + 29 * 24 * 60 * 60 * 1000);
      expect(isSessionExpired(session, day29)).toBe(false);

      // At day 30 exactly, session expires
      const day30 = new Date(createdAt.getTime() + MIN_SESSION_DURATION_MS);
      expect(isSessionExpired(session, day30)).toBe(true);
    });
  });

  describe('validateSession', () => {
    it('returns the session when valid and not expired', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const session = validateSession(loginResult.session.token);
      expect(session).not.toBeNull();
      expect(session!.learnerId).toBe('learner-1');
    });

    it('returns null for an unknown token', () => {
      const session = validateSession('nonexistent-token');
      expect(session).toBeNull();
    });

    it('returns null and removes expired session', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      // Simulate time passing beyond expiry
      const futureDate = new Date(
        loginResult.session.expiresAt.getTime() + 1000
      );
      const session = validateSession(loginResult.session.token, futureDate);
      expect(session).toBeNull();

      // Session state should also be cleaned up
      const state = getSessionState(loginResult.session.token);
      expect(state).toBeNull();
    });
  });

  describe('session state management', () => {
    it('updates current subject', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const updated = updateSessionState(loginResult.session.token, {
        currentSubjectId: 'kannada',
      });

      expect(updated).not.toBeNull();
      expect(updated!.currentSubjectId).toBe('kannada');
      expect(updated!.learnerId).toBe('learner-1');
    });

    it('updates current chapter', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const updated = updateSessionState(loginResult.session.token, {
        currentSubjectId: 'kannada',
        currentChapterId: 'chapter-1',
      });

      expect(updated).not.toBeNull();
      expect(updated!.currentSubjectId).toBe('kannada');
      expect(updated!.currentChapterId).toBe('chapter-1');
    });

    it('updates exercise progress', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const progress = {
        exerciseId: 'ex-1',
        questionsAnswered: 3,
        totalQuestions: 10,
        lastAnsweredAt: new Date(),
      };

      const updated = updateSessionState(loginResult.session.token, {
        exerciseProgress: progress,
      });

      expect(updated).not.toBeNull();
      expect(updated!.exerciseProgress).toEqual(progress);
    });

    it('updates navigation position', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const updated = updateSessionState(loginResult.session.token, {
        navigationPosition: { screen: 'chapter-view', params: { id: 'ch-1' } },
      });

      expect(updated).not.toBeNull();
      expect(updated!.navigationPosition.screen).toBe('chapter-view');
      expect(updated!.navigationPosition.params).toEqual({ id: 'ch-1' });
    });

    it('returns null when updating state for non-existent session', () => {
      const updated = updateSessionState('fake-token', {
        currentSubjectId: 'kannada',
      });
      expect(updated).toBeNull();
    });

    it('returns null when updating state for expired session', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      // Manually expire the session by manipulating the store
      // We'll use validateSession to trigger cleanup first
      const futureDate = new Date(
        loginResult.session.expiresAt.getTime() + 1000
      );
      validateSession(loginResult.session.token, futureDate);

      const updated = updateSessionState(loginResult.session.token, {
        currentSubjectId: 'kannada',
      });
      expect(updated).toBeNull();
    });

    it('preserves learnerId when updating other fields', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const updated = updateSessionState(loginResult.session.token, {
        currentSubjectId: 'maths',
        currentChapterId: 'ch-2',
        navigationPosition: { screen: 'exercise' },
      });

      expect(updated).not.toBeNull();
      expect(updated!.learnerId).toBe('learner-1');
    });
  });

  describe('destroySession', () => {
    it('removes an active session', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const loginResult = login({
        contactValue: 'chiku@example.com',
        password: 'secure1pass',
      });
      expect(loginResult.success).toBe(true);
      if (!loginResult.success) return;

      const destroyed = destroySession(loginResult.session.token);
      expect(destroyed).toBe(true);

      // Session should no longer be valid
      const session = validateSession(loginResult.session.token);
      expect(session).toBeNull();

      // State should also be gone
      const state = getSessionState(loginResult.session.token);
      expect(state).toBeNull();
    });

    it('returns false for non-existent session', () => {
      const destroyed = destroySession('nonexistent-token');
      expect(destroyed).toBe(false);
    });
  });

  describe('MIN_SESSION_DURATION constants', () => {
    it('MIN_SESSION_DURATION_MS equals 30 days in milliseconds', () => {
      expect(MIN_SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('MIN_SESSION_DURATION_DAYS equals 30', () => {
      expect(MIN_SESSION_DURATION_DAYS).toBe(30);
    });
  });
});
