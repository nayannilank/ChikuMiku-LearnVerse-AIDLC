/**
 * Property Test: Account Lockout After Consecutive Failures
 *
 * Feature: infra-migration-to-cdk, Property 2
 *
 * Property 2: Account Lockout After Consecutive Failures
 *
 * For any user account with 3 or more consecutive failed login attempts where
 * `lockUntil` is in the future, the Auth Lambda SHALL reject login attempts
 * and return an appropriate error response regardless of whether the correct
 * password is provided.
 *
 * **Validates: Requirements 2.6**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  clearLockoutStore,
  recordFailedAttempt,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
} from './lockout';
import {
  login,
  addLearnerToStore,
  clearLearnerStore,
  clearSessionStore,
  hashPassword,
} from './session';
import { Learner } from '@chikumiku/service-core';

// --- Arbitraries ---

/** Generates a random email address */
const emailArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 3,
      maxLength: 12,
    }),
    fc.constantFrom('example.com', 'test.org', 'mail.io', 'learn.edu')
  )
  .map(([local, domain]) => `${local}@${domain}`);

/** Generates a random phone number */
const phoneArb = fc
  .stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 10, maxLength: 10 })
  .map((digits) => `+91${digits}`);

/** Generates a random contact value (email or phone) */
const contactArb = fc.oneof(emailArb, phoneArb);

/** Generates a number of failed attempts >= MAX_FAILED_ATTEMPTS */
const failedAttemptsArb = fc.integer({ min: MAX_FAILED_ATTEMPTS, max: 20 });

/** Generates a random password that meets minimum requirements */
const passwordArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
      minLength: 1,
      maxLength: 3,
    }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 3,
    }),
    fc.stringOf(fc.constantFrom(...'0123456789'.split('')), {
      minLength: 1,
      maxLength: 3,
    }),
    fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 4 }
    )
  )
  .map(([upper, lower, digits, rest]) => `${upper}${lower}${digits}${rest}`);

/**
 * Generates a timestamp that is within the lockout window (before lockUntil expiry).
 * lockTime is when the lock was triggered; this generates a time between lockTime
 * and lockTime + LOCKOUT_DURATION_MS - 1 (exclusive of expiry).
 */
const timeWithinLockoutArb = (lockTime: Date) =>
  fc
    .integer({ min: 0, max: LOCKOUT_DURATION_MS - 1 })
    .map((offset) => new Date(lockTime.getTime() + offset));

// --- Helpers ---

function createLearner(contactValue: string, contactType: 'email' | 'phone', password: string): Learner {
  return {
    id: `learner-${contactValue}`,
    displayName: 'Test Learner',
    contactType,
    contactValue,
    passwordHash: hashPassword(password),
    grade: 5,
    enrolledSubjects: ['math'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('Property 2: Account Lockout After Consecutive Failures', () => {
  beforeEach(() => {
    clearLockoutStore();
    clearLearnerStore();
    clearSessionStore();
  });

  it('for ANY number of consecutive failures >= MAX_FAILED_ATTEMPTS, the account SHALL be locked', () => {
    fc.assert(
      fc.property(
        contactArb,
        failedAttemptsArb,
        (contactValue, numAttempts) => {
          clearLockoutStore();
          clearLearnerStore();
          clearSessionStore();

          const contactType: 'email' | 'phone' = contactValue.includes('@') ? 'email' : 'phone';
          const password = 'Correct1pass';
          const learner = createLearner(contactValue, contactType, password);
          addLearnerToStore(learner);

          const now = new Date('2025-01-15T10:00:00Z');

          // Record N consecutive failed attempts
          for (let i = 0; i < numAttempts; i++) {
            recordFailedAttempt(contactValue, contactType, now);
          }

          // Login SHALL be rejected even with correct password
          const result = login({ contactValue, password }, now);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain('temporarily locked');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('for ANY time point BEFORE lockUntil expiry, login SHALL be rejected', () => {
    fc.assert(
      fc.property(
        contactArb,
        passwordArb,
        fc.integer({ min: 0, max: LOCKOUT_DURATION_MS - 1 }),
        (contactValue, password, offsetMs) => {
          clearLockoutStore();
          clearLearnerStore();
          clearSessionStore();

          const contactType: 'email' | 'phone' = contactValue.includes('@') ? 'email' : 'phone';
          const learner = createLearner(contactValue, contactType, password);
          addLearnerToStore(learner);

          const lockTime = new Date('2025-01-15T10:00:00Z');

          // Trigger lockout with exactly MAX_FAILED_ATTEMPTS
          for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
            recordFailedAttempt(contactValue, contactType, lockTime);
          }

          // Try login at some point before the lockout expires
          const attemptTime = new Date(lockTime.getTime() + offsetMs);
          const result = login({ contactValue, password }, attemptTime);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain('temporarily locked');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejection happens REGARDLESS of whether the correct password is provided', () => {
    fc.assert(
      fc.property(
        contactArb,
        passwordArb,
        fc.boolean(),
        (contactValue, correctPassword, useCorrectPassword) => {
          clearLockoutStore();
          clearLearnerStore();
          clearSessionStore();

          const contactType: 'email' | 'phone' = contactValue.includes('@') ? 'email' : 'phone';
          const learner = createLearner(contactValue, contactType, correctPassword);
          addLearnerToStore(learner);

          const now = new Date('2025-01-15T10:00:00Z');

          // Trigger lockout
          for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
            recordFailedAttempt(contactValue, contactType, now);
          }

          // Attempt login with either correct or incorrect password
          const attemptPassword = useCorrectPassword ? correctPassword : `wrong_${correctPassword}`;
          const result = login({ contactValue, password: attemptPassword }, now);

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain('temporarily locked');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('after lockout expires, login with correct password SHALL succeed again', () => {
    fc.assert(
      fc.property(
        contactArb,
        passwordArb,
        fc.integer({ min: 0, max: 60000 }),
        (contactValue, correctPassword, extraMs) => {
          clearLockoutStore();
          clearLearnerStore();
          clearSessionStore();

          const contactType: 'email' | 'phone' = contactValue.includes('@') ? 'email' : 'phone';
          const learner = createLearner(contactValue, contactType, correctPassword);
          addLearnerToStore(learner);

          const lockTime = new Date('2025-01-15T10:00:00Z');

          // Trigger lockout
          for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
            recordFailedAttempt(contactValue, contactType, lockTime);
          }

          // Attempt login AFTER lockout expiry
          const afterExpiry = new Date(lockTime.getTime() + LOCKOUT_DURATION_MS + extraMs);
          const result = login({ contactValue, password: correctPassword }, afterExpiry);

          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
