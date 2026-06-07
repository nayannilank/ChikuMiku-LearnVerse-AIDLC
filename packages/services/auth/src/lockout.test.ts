import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAccountLocked,
  recordFailedAttempt,
  resetFailureCounter,
  clearLockoutStore,
  getLockoutRecord,
  setLockoutNotifier,
  getLockoutNotifier,
  LockoutNotifier,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from './lockout';
import {
  login,
  addLearnerToStore,
  clearLearnerStore,
  clearSessionStore,
  hashPassword,
} from './session';
import { Learner } from '@learnverse/service-core';

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

describe('account lockout', () => {
  beforeEach(() => {
    clearLockoutStore();
    clearLearnerStore();
    clearSessionStore();
    setLockoutNotifier(null);
  });

  describe('constants', () => {
    it('MAX_FAILED_ATTEMPTS is 3', () => {
      expect(MAX_FAILED_ATTEMPTS).toBe(3);
    });

    it('LOCKOUT_DURATION_MS is 15 minutes', () => {
      expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
    });
  });

  describe('isAccountLocked', () => {
    it('returns false when no record exists', () => {
      expect(isAccountLocked('unknown@example.com')).toBe(false);
    });

    it('returns false when failures are below threshold', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);
      expect(isAccountLocked('test@example.com', now)).toBe(false);
    });

    it('returns true after 3 consecutive failures', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);
      expect(isAccountLocked('test@example.com', now)).toBe(true);
    });

    it('returns false after lockout duration expires', () => {
      const lockTime = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', lockTime);
      recordFailedAttempt('test@example.com', 'email', lockTime);
      recordFailedAttempt('test@example.com', 'email', lockTime);

      // 15 minutes later
      const afterLockout = new Date(lockTime.getTime() + LOCKOUT_DURATION_MS);
      expect(isAccountLocked('test@example.com', afterLockout)).toBe(false);
    });

    it('returns true 1ms before lockout expires', () => {
      const lockTime = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', lockTime);
      recordFailedAttempt('test@example.com', 'email', lockTime);
      recordFailedAttempt('test@example.com', 'email', lockTime);

      const justBefore = new Date(lockTime.getTime() + LOCKOUT_DURATION_MS - 1);
      expect(isAccountLocked('test@example.com', justBefore)).toBe(true);
    });
  });

  describe('recordFailedAttempt', () => {
    it('increments consecutive failures', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      const record1 = recordFailedAttempt('test@example.com', 'email', now);
      expect(record1.consecutiveFailures).toBe(1);
      expect(record1.lockedUntil).toBeNull();

      const record2 = recordFailedAttempt('test@example.com', 'email', now);
      expect(record2.consecutiveFailures).toBe(2);
      expect(record2.lockedUntil).toBeNull();
    });

    it('locks account on 3rd failure', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);
      const record = recordFailedAttempt('test@example.com', 'email', now);

      expect(record.consecutiveFailures).toBe(3);
      expect(record.lockedUntil).not.toBeNull();
      expect(record.lockedUntil!.getTime()).toBe(now.getTime() + LOCKOUT_DURATION_MS);
    });

    it('tracks failures independently per contact', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('user1@example.com', 'email', now);
      recordFailedAttempt('user1@example.com', 'email', now);
      recordFailedAttempt('user2@example.com', 'email', now);

      const record1 = getLockoutRecord('user1@example.com');
      const record2 = getLockoutRecord('user2@example.com');

      expect(record1!.consecutiveFailures).toBe(2);
      expect(record2!.consecutiveFailures).toBe(1);
    });
  });

  describe('resetFailureCounter', () => {
    it('resets consecutive failures to 0', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);

      resetFailureCounter('test@example.com');

      const record = getLockoutRecord('test@example.com');
      expect(record!.consecutiveFailures).toBe(0);
      expect(record!.lockedUntil).toBeNull();
    });

    it('does nothing for unknown contact', () => {
      // Should not throw
      resetFailureCounter('unknown@example.com');
    });

    it('clears lockout state', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);

      expect(isAccountLocked('test@example.com', now)).toBe(true);

      resetFailureCounter('test@example.com');

      expect(isAccountLocked('test@example.com', now)).toBe(false);
    });
  });

  describe('lockout notification', () => {
    it('calls notifier on lockout', () => {
      const notifier: LockoutNotifier = {
        notifyLockout: vi.fn(),
      };
      setLockoutNotifier(notifier);

      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);

      expect(notifier.notifyLockout).toHaveBeenCalledTimes(1);
      expect(notifier.notifyLockout).toHaveBeenCalledWith(
        'email',
        'test@example.com',
        new Date(now.getTime() + LOCKOUT_DURATION_MS)
      );
    });

    it('does not call notifier before lockout threshold', () => {
      const notifier: LockoutNotifier = {
        notifyLockout: vi.fn(),
      };
      setLockoutNotifier(notifier);

      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('test@example.com', 'email', now);
      recordFailedAttempt('test@example.com', 'email', now);

      expect(notifier.notifyLockout).not.toHaveBeenCalled();
    });

    it('does not throw when no notifier is registered', () => {
      const now = new Date('2025-01-01T10:00:00Z');
      // Should not throw even without a notifier
      expect(() => {
        recordFailedAttempt('test@example.com', 'email', now);
        recordFailedAttempt('test@example.com', 'email', now);
        recordFailedAttempt('test@example.com', 'email', now);
      }).not.toThrow();
    });

    it('notifies with phone contact type', () => {
      const notifier: LockoutNotifier = {
        notifyLockout: vi.fn(),
      };
      setLockoutNotifier(notifier);

      const now = new Date('2025-01-01T10:00:00Z');
      recordFailedAttempt('+919876543210', 'phone', now);
      recordFailedAttempt('+919876543210', 'phone', now);
      recordFailedAttempt('+919876543210', 'phone', now);

      expect(notifier.notifyLockout).toHaveBeenCalledWith(
        'phone',
        '+919876543210',
        expect.any(Date)
      );
    });
  });

  describe('integration with login', () => {
    it('locks account after 3 failed login attempts', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const now = new Date('2025-01-01T10:00:00Z');

      // 3 failed attempts
      login({ contactValue: 'chiku@example.com', password: 'wrong1abc' }, now);
      login({ contactValue: 'chiku@example.com', password: 'wrong2abc' }, now);
      login({ contactValue: 'chiku@example.com', password: 'wrong3abc' }, now);

      // 4th attempt should be blocked even with correct password
      const result = login(
        { contactValue: 'chiku@example.com', password: 'secure1pass' },
        now
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('temporarily locked');
      }
    });

    it('allows login after lockout expires', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const lockTime = new Date('2025-01-01T10:00:00Z');

      // 3 failed attempts
      login({ contactValue: 'chiku@example.com', password: 'wrong1abc' }, lockTime);
      login({ contactValue: 'chiku@example.com', password: 'wrong2abc' }, lockTime);
      login({ contactValue: 'chiku@example.com', password: 'wrong3abc' }, lockTime);

      // After 15 minutes, should be able to login
      const afterLockout = new Date(lockTime.getTime() + LOCKOUT_DURATION_MS);
      const result = login(
        { contactValue: 'chiku@example.com', password: 'secure1pass' },
        afterLockout
      );

      expect(result.success).toBe(true);
    });

    it('resets failure counter on successful login', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const now = new Date('2025-01-01T10:00:00Z');

      // 2 failed attempts (not yet locked)
      login({ contactValue: 'chiku@example.com', password: 'wrong1abc' }, now);
      login({ contactValue: 'chiku@example.com', password: 'wrong2abc' }, now);

      // Successful login resets counter
      const successResult = login(
        { contactValue: 'chiku@example.com', password: 'secure1pass' },
        now
      );
      expect(successResult.success).toBe(true);

      // Now 3 more failures should be needed to lock again
      login({ contactValue: 'chiku@example.com', password: 'wrong1abc' }, now);
      login({ contactValue: 'chiku@example.com', password: 'wrong2abc' }, now);

      // 2 failures after reset — should not be locked
      const result = login(
        { contactValue: 'chiku@example.com', password: 'secure1pass' },
        now
      );
      expect(result.success).toBe(true);
    });

    it('notifies registered contact on lockout via login', () => {
      const learner = createTestLearner();
      addLearnerToStore(learner);

      const notifier: LockoutNotifier = {
        notifyLockout: vi.fn(),
      };
      setLockoutNotifier(notifier);

      const now = new Date('2025-01-01T10:00:00Z');

      login({ contactValue: 'chiku@example.com', password: 'wrong1abc' }, now);
      login({ contactValue: 'chiku@example.com', password: 'wrong2abc' }, now);
      login({ contactValue: 'chiku@example.com', password: 'wrong3abc' }, now);

      expect(notifier.notifyLockout).toHaveBeenCalledTimes(1);
      expect(notifier.notifyLockout).toHaveBeenCalledWith(
        'email',
        'chiku@example.com',
        new Date(now.getTime() + LOCKOUT_DURATION_MS)
      );
    });

    it('does not lock account for non-existent contacts after 3 attempts', () => {
      // Even for unknown contacts, we track attempts to prevent enumeration
      const now = new Date('2025-01-01T10:00:00Z');

      login({ contactValue: 'nobody@example.com', password: 'wrong1abc' }, now);
      login({ contactValue: 'nobody@example.com', password: 'wrong2abc' }, now);
      login({ contactValue: 'nobody@example.com', password: 'wrong3abc' }, now);

      // Account should be locked
      const result = login(
        { contactValue: 'nobody@example.com', password: 'anything1' },
        now
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('temporarily locked');
      }
    });
  });
});
