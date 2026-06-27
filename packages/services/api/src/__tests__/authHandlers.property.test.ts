/**
 * Property Tests: Registration Handlers & Password Recovery / Token Refresh
 *
 * Feature: backend-stub-implementations
 * - Property 1: Parent registration round-trip
 * - Property 2: Parent registration rejects invalid input
 * - Property 3: Parent registration detects duplicates
 * - Property 4: Student registration persists, links, and auto-authenticates
 * - Property 5: Student registration rejects non-existent parent
 * - Property 6: Student registration detects duplicate username
 * - Property 7: Forgot-password always returns 200
 * - Property 9: Password reset updates hash
 * - Property 12: Reset password validates new password
 * - Property 13: Token refresh issues new pair
 * - Property 14: Invalid refresh tokens return 401
 * - Property 15: Refresh token single-use enforcement
 * - Property 18: Expired JWT tokens are rejected
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 3.5, 4.1, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.1, 7.1, 7.2**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  handleRegisterParent,
  handleRegisterStudent,
  handleForgotPassword,
  handleResetPassword,
  handleRefresh,
  clearRevokedTokens,
} from '../authHandlers';
import {
  clearParentStudentStore,
  findParentByUsername,
  findLearnerByContact,
  clearLearnerStore,
  clearResetTokenStore,
  generateResetToken,
  hashPassword,
  verifyPassword,
  createTokenPair,
  getJwtConfig,
  signToken,
  verifyToken,
} from '@learnverse/service-auth';
import { ApiRouter, createDefaultRoutes } from '../endpoints';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid username: 5-15 chars, alphanumeric + underscores + hyphens */
const validUsernameArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split(''),
  ),
  { minLength: 5, maxLength: 15 },
);

/** Valid password: 8-20 chars, at least one uppercase, one lowercase, one digit, one special */
const validPasswordArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 5,
    }),
    fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), {
      minLength: 1,
      maxLength: 5,
    }),
    fc.stringOf(fc.constantFrom(...'0123456789'.split('')), {
      minLength: 1,
      maxLength: 5,
    }),
    fc.stringOf(fc.constantFrom(...'!@#$%^&*()'.split('')), {
      minLength: 1,
      maxLength: 3,
    }),
  )
  .map(([lower, upper, digits, special]) => lower + upper + digits + special)
  .filter((p) => p.length >= 8 && p.length <= 20);

/** Valid email: local@domain.tld format, max 254 chars */
const validEmailArb = fc
  .tuple(
    fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
      { minLength: 1, maxLength: 20 },
    ),
    fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      { minLength: 1, maxLength: 10 },
    ),
    fc.constantFrom('com', 'org', 'net', 'edu', 'io'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Valid phone: exactly 10 digits */
const validPhoneArb = fc.stringOf(fc.constantFrom(...'0123456789'.split('')), {
  minLength: 10,
  maxLength: 10,
});

/** Valid name: 1-100 chars, non-empty */
const validNameArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '.split(''),
  ),
  { minLength: 1, maxLength: 50 },
).filter((n) => n.trim().length > 0);

/** Valid grade: integer 1-12 */
const validGradeArb = fc.integer({ min: 1, max: 12 });

/** Generate a unique suffix for deduplication in tests */
const uniqueSuffixArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
  { minLength: 3, maxLength: 5 },
);

// ─── Invalid field arbitraries ────────────────────────────────────────────────

/** Invalid username: too short (<5), too long (>15), or contains invalid chars */
const invalidUsernameArb = fc.oneof(
  fc.stringOf(fc.constantFrom(...'abc'.split('')), { minLength: 1, maxLength: 4 }), // too short
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnop'.split('')), { minLength: 16, maxLength: 20 }), // too long
  fc.constant('ab cd'), // contains space
  fc.constant('user@name'), // contains @
);

/** Invalid password: missing one of the required character classes or wrong length */
const invalidPasswordArb = fc.oneof(
  fc.constant('short1!'), // too short
  fc.constant('alllowercase1!'), // no uppercase but >= 8 (actually has it - let's fix)
  fc.constant('nouppercase1!noup'), // no uppercase
  fc.constant('NOLOWERCASE1!NOLOWER'), // no lowercase
  fc.constant('NoDigitsHere!!'), // no digit
  fc.constant('NoSpecial123abc'), // no special char
);

/** Invalid email: missing @, missing domain dot, or empty */
const invalidEmailArb = fc.oneof(
  fc.constant(''), // empty
  fc.constant('nodomain'), // no @
  fc.constant('user@nodot'), // no dot in domain
  fc.constant('@nodomain.com'), // empty local part
);

/** Invalid phone: not exactly 10 digits */
const invalidPhoneArb = fc.oneof(
  fc.constant('12345'), // too short
  fc.constant('12345678901'), // too long (11 digits)
  fc.constant('123-456-789'), // contains non-digit chars
  fc.constant('abcdefghij'), // letters
);

// ─── Helper: Build ApiRequest ─────────────────────────────────────────────────

function makeParentRequest(body: unknown) {
  return {
    method: 'POST' as const,
    path: '/api/v1/auth/register/parent',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

function makeStudentRequest(body: unknown) {
  return {
    method: 'POST' as const,
    path: '/api/v1/auth/register/student',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 1: Parent registration round-trip', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
  });

  it('for any valid parent registration input, handleRegisterParent returns 201 with the username, and the account is retrievable from the store', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        validNameArb,
        validUsernameArb,
        validPasswordArb,
        validPhoneArb,
        validEmailArb,
        async (name, usernameBase, password, phoneBase, emailBase) => {
          // Ensure uniqueness across iterations by appending counter
          counter++;
          const suffix = String(counter).padStart(4, '0');
          // Make username unique while still valid (5-15 chars)
          const username = (usernameBase.slice(0, 10) + suffix).slice(0, 15);
          if (username.length < 5) return; // skip if too short

          // Make phone unique: replace last 4 digits with counter
          const phone = phoneBase.slice(0, 6) + suffix;

          // Make email unique
          const email = `u${suffix}@test.com`;

          const req = makeParentRequest({ name, username, phone, email, password });
          const res = await handleRegisterParent(req);

          expect(res.status).toBe(201);
          const body = res.body as { message: string; username: string };
          expect(body.username).toBe(username);

          // Account should be retrievable from the store
          const account = findParentByUsername(username);
          expect(account).toBeDefined();
          expect(account!.username).toBe(username);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 2: Parent registration rejects invalid input', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
  });

  it('for any parent registration payload where at least one field violates its validation rule, returns HTTP 400 with field-specific errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          invalidField: fc.constantFrom('username', 'password', 'email', 'phone', 'name') as fc.Arbitrary<'username' | 'password' | 'email' | 'phone' | 'name'>,
        }),
        async ({ invalidField }) => {
          // Build a payload with one invalid field
          const validBody = {
            name: 'Valid Name',
            username: 'validuser',
            password: 'Valid1Pass!',
            phone: '1234567890',
            email: 'valid@test.com',
          };

          switch (invalidField) {
            case 'username':
              validBody.username = 'ab'; // too short
              break;
            case 'password':
              validBody.password = 'short'; // too short, missing classes
              break;
            case 'email':
              validBody.email = 'invalid-email'; // no @
              break;
            case 'phone':
              validBody.phone = '123'; // too short
              break;
            case 'name':
              validBody.name = '   '; // empty after trim
              break;
          }

          const req = makeParentRequest(validBody);
          const res = await handleRegisterParent(req);

          expect(res.status).toBe(400);
          const body = res.body as { code: string; errors: Array<{ field: string; message: string }> };
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.errors).toBeDefined();
          expect(body.errors.length).toBeGreaterThan(0);

          // Should contain an error for the invalid field
          const fieldError = body.errors.find((e) => e.field === invalidField);
          expect(fieldError).toBeDefined();
          expect(fieldError!.message).toBeTruthy();
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 3: Parent registration detects duplicates', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
  });

  it('for any successfully registered parent, re-registering with the same username returns 409', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueSuffixArb,
        async (suffix) => {
          const base = {
            name: 'Test Parent',
            username: `user_${suffix}`,
            password: 'Valid1Pass!',
            phone: `12345${suffix.padEnd(5, '0').slice(0, 5)}`,
            email: `test_${suffix}@example.com`,
          };

          // Ensure username is valid length
          if (base.username.length < 5 || base.username.length > 15) return;
          // Ensure phone is exactly 10 digits
          base.phone = base.phone.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0');

          // First registration should succeed
          const req1 = makeParentRequest(base);
          const res1 = await handleRegisterParent(req1);
          if (res1.status !== 201) return; // skip if first registration failed (e.g., collisions in fast-check)

          // Second registration with same username should get 409
          // (email and phone uniqueness is NOT enforced per product requirements)
          const duplicate = {
            name: 'Another Parent',
            username: base.username,
            password: 'Other1Pass!',
            phone: `98765${suffix.padEnd(5, '0').slice(0, 5)}`.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0'),
            email: `other_${suffix}@example.com`,
          };

          // Ensure duplicate username is valid length
          if (duplicate.username.length < 5 || duplicate.username.length > 15) return;

          const req2 = makeParentRequest(duplicate);
          const res2 = await handleRegisterParent(req2);

          expect(res2.status).toBe(409);
          const body = res2.body as { code: string; errors: Array<{ field: string; message: string }> };
          expect(body.code).toBe('CONFLICT');
          expect(body.errors).toBeDefined();
          expect(body.errors.length).toBeGreaterThan(0);
          expect(body.errors[0].field).toBe('username');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('re-registering with the same email or phone but different username succeeds (201)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('email', 'phone') as fc.Arbitrary<'email' | 'phone'>,
        uniqueSuffixArb,
        async (duplicateField, suffix) => {
          const base = {
            name: 'Test Parent',
            username: `user_${suffix}`,
            password: 'Valid1Pass!',
            phone: `12345${suffix.padEnd(5, '0').slice(0, 5)}`,
            email: `test_${suffix}@example.com`,
          };

          // Ensure username is valid length
          if (base.username.length < 5 || base.username.length > 15) return;
          // Ensure phone is exactly 10 digits
          base.phone = base.phone.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0');

          // First registration should succeed
          const req1 = makeParentRequest(base);
          const res1 = await handleRegisterParent(req1);
          if (res1.status !== 201) return;

          // Second registration with same email or phone but DIFFERENT username should succeed
          const otherUsername = `oth_${suffix}`.slice(0, 15);
          if (otherUsername.length < 5) return;

          const duplicate = {
            name: 'Another Parent',
            username: otherUsername,
            password: 'Other1Pass!',
            phone: duplicateField === 'phone' ? base.phone : `98765${suffix.padEnd(5, '0').slice(0, 5)}`.replace(/[^0-9]/g, '').slice(0, 10).padEnd(10, '0'),
            email: duplicateField === 'email' ? base.email : `other_${suffix}@example.com`,
          };

          const req2 = makeParentRequest(duplicate);
          const res2 = await handleRegisterParent(req2);

          // Email/phone are NOT unique constraints — should succeed with 201
          expect(res2.status).toBe(201);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 4: Student registration persists, links, and auto-authenticates', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
  });

  it('for any valid student registration with an existing parent, returns 201 with session tokens, links to parent, and creates learner record', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        validNameArb,
        validPasswordArb,
        validGradeArb,
        async (studentName, password, grade) => {
          counter++;
          const suffix = String(counter).padStart(4, '0');

          // Register a parent first
          const parentUsername = `par_${suffix}`.slice(0, 15);
          if (parentUsername.length < 5) return;

          const parentReq = makeParentRequest({
            name: 'Parent User',
            username: parentUsername,
            password: 'Parent1Pass!',
            phone: `1${suffix.padEnd(9, '0').slice(0, 9)}`,
            email: `parent${suffix}@test.com`,
          });
          const parentRes = await handleRegisterParent(parentReq);
          if (parentRes.status !== 201) return;

          // Register a student linked to this parent
          const studentUsername = `stu_${suffix}`.slice(0, 15);
          if (studentUsername.length < 5) return;

          const studentReq = makeStudentRequest({
            name: studentName,
            username: studentUsername,
            password,
            grade,
            parentUsername,
          });
          const studentRes = await handleRegisterStudent(studentReq);

          expect(studentRes.status).toBe(201);
          const body = studentRes.body as {
            message: string;
            username: string;
            accessToken: string;
            refreshToken: string;
            expiresAt: number;
            tokenType: string;
          };

          // Should have session tokens (auto-authentication)
          expect(body.accessToken).toBeTruthy();
          expect(body.refreshToken).toBeTruthy();
          expect(body.expiresAt).toBeGreaterThan(Date.now());
          expect(body.username).toBe(studentUsername);

          // Student should be linked to parent's linkedStudentIds
          const parentAccount = findParentByUsername(parentUsername);
          expect(parentAccount).toBeDefined();
          expect(parentAccount!.linkedStudentIds.length).toBeGreaterThan(0);

          // findLearnerByContact(studentUsername) should return a valid learner record
          const learner = findLearnerByContact(studentUsername);
          expect(learner).toBeDefined();
          expect(learner!.displayName).toBe(studentName.trim());
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 5: Student registration rejects non-existent parent', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
  });

  it('for any student registration payload where parentUsername does not exist, returns HTTP 400 with a parentUsername field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validNameArb,
        validUsernameArb,
        validPasswordArb,
        validGradeArb,
        validUsernameArb,
        async (name, studentUsername, password, grade, fakeParentUsername) => {
          // Ensure the fake parent doesn't accidentally collide with student username
          fc.pre(fakeParentUsername !== studentUsername);

          // Do NOT register any parent — the store is clean from beforeEach
          const req = makeStudentRequest({
            name,
            username: studentUsername,
            password,
            grade,
            parentUsername: fakeParentUsername,
          });
          const res = await handleRegisterStudent(req);

          expect(res.status).toBe(400);
          const body = res.body as { code: string; errors: Array<{ field: string; message: string }> };
          expect(body.errors).toBeDefined();

          // Should have an error for parentUsername field
          const parentError = body.errors.find((e) => e.field === 'parentUsername');
          expect(parentError).toBeDefined();
          expect(parentError!.message).toBeTruthy();
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 6: Student registration detects duplicate username', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
  });

  it('for any already-registered student username, attempting to register another student with the same username returns 409', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        validNameArb,
        validPasswordArb,
        validGradeArb,
        async (name, password, grade) => {
          counter++;
          const suffix = String(counter).padStart(4, '0');

          // Register a parent
          const parentUsername = `par_${suffix}`.slice(0, 15);
          if (parentUsername.length < 5) return;

          const parentReq = makeParentRequest({
            name: 'Parent',
            username: parentUsername,
            password: 'Parent1Pass!',
            phone: `2${suffix.padEnd(9, '0').slice(0, 9)}`,
            email: `dup${suffix}@test.com`,
          });
          const parentRes = await handleRegisterParent(parentReq);
          if (parentRes.status !== 201) return;

          // Register first student
          const studentUsername = `stu_${suffix}`.slice(0, 15);
          if (studentUsername.length < 5) return;

          const req1 = makeStudentRequest({
            name,
            username: studentUsername,
            password,
            grade,
            parentUsername,
          });
          const res1 = await handleRegisterStudent(req1);
          if (res1.status !== 201) return;

          // Attempt to register another student with the same username
          const req2 = makeStudentRequest({
            name: 'Another Student',
            username: studentUsername,
            password: 'Other1Pass!',
            grade: 5,
            parentUsername,
          });
          const res2 = await handleRegisterStudent(req2);

          expect(res2.status).toBe(409);
          const body = res2.body as { code: string; errors: Array<{ field: string; message: string }> };
          expect(body.code).toBe('CONFLICT');
          expect(body.errors).toBeDefined();
          expect(body.errors.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});


// ─── Helper: Build Forgot/Reset/Refresh Requests ──────────────────────────────

function makeForgotPasswordRequest(body: unknown) {
  return {
    method: 'POST' as const,
    path: '/api/v1/auth/forgot-password',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

function makeResetPasswordRequest(body: unknown) {
  return {
    method: 'POST' as const,
    path: '/api/v1/auth/reset-password',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

function makeRefreshRequest(body: unknown) {
  return {
    method: 'POST' as const,
    path: '/api/v1/auth/refresh',
    headers: { 'Content-Type': 'application/json' },
    body,
  };
}

// ─── Property 7: Forgot-password always returns 200 ──────────────────────────

/**
 * **Validates: Requirements 3.4, 3.5**
 *
 * For any string provided as the username in a forgot-password request
 * (whether it matches a registered account or not, and whether the notification
 * service succeeds or fails), the handler SHALL return HTTP 200.
 */
describe('Property 7: Forgot-password always returns 200', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('for any string provided as the username, handleForgotPassword returns 200', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          validUsernameArb,
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.constant('nonexistent_user'),
        ),
        async (username) => {
          counter++;

          // Optionally register a parent for some iterations so that
          // the path with an existing account is also exercised
          if (counter % 3 === 0) {
            const suffix = String(counter).padStart(4, '0');
            const parentReq = makeParentRequest({
              name: 'Test Parent',
              username: username.slice(0, 15).padEnd(5, 'x'),
              password: 'Valid1Pass!',
              phone: `1${suffix.padEnd(9, '0').slice(0, 9)}`,
              email: `p${suffix}@test.com`,
            });
            await handleRegisterParent(parentReq);
          }

          const req = makeForgotPasswordRequest({ username });
          const res = await handleForgotPassword(req);

          expect(res.status).toBe(200);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 9: Password reset updates hash ─────────────────────────────────

/**
 * **Validates: Requirements 4.1, 4.3, 4.4**
 *
 * For any valid, non-expired reset token and a new password satisfying the
 * password rules, calling the reset-password handler SHALL update the associated
 * account's password hash such that login succeeds with the new password and
 * fails with the old password.
 */
describe('Property 9: Password reset updates hash', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('for any valid reset token and new valid password, the password hash is updated', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        validPasswordArb,
        validPasswordArb,
        async (oldPassword, newPassword) => {
          // Ensure old and new passwords are different
          fc.pre(oldPassword !== newPassword);

          counter++;
          const suffix = String(counter).padStart(4, '0');
          const username = `user_${suffix}`.slice(0, 15);
          if (username.length < 5) return;

          // Register a parent with the old password
          const parentReq = makeParentRequest({
            name: 'Reset User',
            username,
            password: oldPassword,
            phone: `3${suffix.padEnd(9, '0').slice(0, 9)}`,
            email: `reset${suffix}@test.com`,
          });
          const regRes = await handleRegisterParent(parentReq);
          if (regRes.status !== 201) return;

          // Generate a reset token for this user
          const token = generateResetToken(username, 'parent');

          // Call handleResetPassword with the token and new password
          const resetReq = makeResetPasswordRequest({ token, newPassword });
          const resetRes = await handleResetPassword(resetReq);

          expect(resetRes.status).toBe(200);

          // Verify the password hash was updated
          const account = findParentByUsername(username);
          expect(account).toBeDefined();
          expect(verifyPassword(newPassword, account!.passwordHash)).toBe(true);
          expect(verifyPassword(oldPassword, account!.passwordHash)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 12: Reset password validates new password ───────────────────────

/**
 * **Validates: Requirements 4.5**
 *
 * For any new password that violates the registration password rules (too short,
 * too long, missing uppercase, missing lowercase, missing digit, missing special char),
 * calling the reset-password handler with a valid token SHALL return HTTP 400
 * with a password validation error.
 */
describe('Property 12: Reset password validates new password', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('for any invalid password, handleResetPassword returns 400 with validation error', async () => {
    // Register a parent and generate a token once
    const parentReq = makeParentRequest({
      name: 'Validation User',
      username: 'valuser12345',
      password: 'Valid1Pass!',
      phone: '9876543210',
      email: 'val@test.com',
    });
    await handleRegisterParent(parentReq);

    /** Passwords that violate the rules in various ways */
    const invalidNewPasswordArb = fc.oneof(
      // Too short (< 8 chars)
      fc.constant('Ab1!xyz'),
      // Too long (> 20 chars)
      fc.constant('Abcdefgh1!Abcdefgh1!X'),
      // Missing uppercase
      fc.constant('abcdef1!abcd'),
      // Missing lowercase
      fc.constant('ABCDEF1!ABCD'),
      // Missing digit
      fc.constant('Abcdefgh!xyz'),
      // Missing special char
      fc.constant('Abcdefgh1xyz'),
    );

    await fc.assert(
      fc.asyncProperty(invalidNewPasswordArb, async (badPassword) => {
        // Generate a fresh reset token each time
        const token = generateResetToken('valuser12345', 'parent');

        const req = makeResetPasswordRequest({ token, newPassword: badPassword });
        const res = await handleResetPassword(req);

        expect(res.status).toBe(400);
        const body = res.body as { code: string; message: string };
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.message).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 13: Token refresh issues new pair ───────────────────────────────

/**
 * **Validates: Requirements 5.1, 5.2, 5.4**
 *
 * For any valid, non-revoked refresh token, calling the refresh handler SHALL
 * return HTTP 200 with new accessToken and refreshToken that are both non-empty
 * and different from the old tokens.
 */
describe('Property 13: Token refresh issues new pair', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('for any valid refresh token, handleRefresh returns 200 with new valid tokens', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('student', 'parent'),
        async (role) => {
          counter++;
          // Use a unique userId per iteration to avoid token collisions
          const userId = `user-refresh-${counter}`;
          const jwtConfig = getJwtConfig();
          const tokenPair = createTokenPair(userId, [role], jwtConfig);

          const req = makeRefreshRequest({ refreshToken: tokenPair.refreshToken });
          const res = await handleRefresh(req);

          expect(res.status).toBe(200);
          const body = res.body as {
            accessToken: string;
            refreshToken: string;
            expiresAt: number;
            tokenType: string;
          };

          // New tokens should be non-empty
          expect(body.accessToken).toBeTruthy();
          expect(body.refreshToken).toBeTruthy();
          expect(body.tokenType).toBe('Bearer');

          // Expiry should be in the future
          expect(body.expiresAt).toBeGreaterThan(Date.now());

          // New access token should be a verifiable JWT
          const decodedAccess = verifyToken(body.accessToken, jwtConfig);
          expect(decodedAccess).not.toBeNull();
          expect(decodedAccess!.sub).toBe(userId);
          expect(decodedAccess!.type).toBe('access');

          // New refresh token should be a verifiable JWT
          const decodedRefresh = verifyToken(body.refreshToken, jwtConfig);
          expect(decodedRefresh).not.toBeNull();
          expect(decodedRefresh!.sub).toBe(userId);
          expect(decodedRefresh!.type).toBe('refresh');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 14: Invalid refresh tokens return 401 ──────────────────────────

/**
 * **Validates: Requirements 5.2, 5.3**
 *
 * For any string that is not a valid, non-revoked refresh token (random strings,
 * expired tokens, previously-used tokens), calling the refresh handler SHALL
 * return HTTP 401.
 */
describe('Property 14: Invalid refresh tokens return 401', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('for any invalid refresh token, handleRefresh returns 401', async () => {
    const jwtConfig = getJwtConfig();

    // Generate an expired refresh token
    const expiredRefreshToken = signToken(
      {
        sub: 'test-user',
        exp: Date.now() - 60000, // expired 1 minute ago
        iss: jwtConfig.issuer,
        aud: jwtConfig.audience,
        roles: ['student'],
        type: 'refresh',
      },
      jwtConfig,
    );

    const invalidTokenArb = fc.oneof(
      // Random strings
      fc.string({ minLength: 1, maxLength: 50 }),
      // Expired token
      fc.constant(expiredRefreshToken),
      // Malformed JWT-like strings
      fc.constant('not.a.validtoken'),
      fc.constant('abc.def.ghi'),
    );

    await fc.assert(
      fc.asyncProperty(invalidTokenArb, async (badToken) => {
        const req = makeRefreshRequest({ refreshToken: badToken });
        const res = await handleRefresh(req);

        expect(res.status).toBe(401);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 15: Refresh token single-use enforcement ────────────────────────

/**
 * **Validates: Requirements 5.3**
 *
 * For any refresh token that has been successfully exchanged for a new pair,
 * attempting to use the old refresh token again SHALL return HTTP 401.
 */
describe('Property 15: Refresh token single-use enforcement', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('after a successful refresh, the old refresh token returns 401 on reuse', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('student', 'parent'),
        async (role) => {
          counter++;
          // Use a unique userId to ensure each iteration gets a fresh token
          const userId = `user-single-use-${counter}`;
          const jwtConfig = getJwtConfig();
          const tokenPair = createTokenPair(userId, [role], jwtConfig);

          // First refresh should succeed
          const req1 = makeRefreshRequest({ refreshToken: tokenPair.refreshToken });
          const res1 = await handleRefresh(req1);
          expect(res1.status).toBe(200);

          // Second refresh with the same token should fail with 401
          const req2 = makeRefreshRequest({ refreshToken: tokenPair.refreshToken });
          const res2 = await handleRefresh(req2);
          expect(res2.status).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 18: Expired JWT tokens are rejected ─────────────────────────────

/**
 * **Validates: Requirements 6.1, 7.1, 7.2**
 *
 * For any JWT token whose `exp` claim is in the past, presenting it to any
 * protected route SHALL result in HTTP 401 with a "Token expired" error.
 */
describe('Property 18: Expired JWT tokens are rejected', () => {
  beforeEach(() => {
    clearParentStudentStore();
    clearLearnerStore();
    clearResetTokenStore();
    clearRevokedTokens();
  });

  it('for any expired JWT token, a protected route returns 401 with Token expired', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        fc.integer({ min: 1000, max: 3600000 }), // offset in past (1s to 1h)
        async (userId, pastOffset) => {
          const jwtConfig = getJwtConfig();

          // Create an expired access token
          const expiredToken = signToken(
            {
              sub: userId,
              exp: Date.now() - pastOffset,
              iss: jwtConfig.issuer,
              aud: jwtConfig.audience,
              roles: ['student'],
              type: 'access',
            },
            jwtConfig,
          );

          // Create a router with default routes
          const router = new ApiRouter();
          const routes = createDefaultRoutes();
          for (const route of routes) {
            router.register(route);
          }

          // Make a request to a protected route (GET /api/v1/auth/validate)
          const req = {
            method: 'GET' as const,
            path: '/api/v1/auth/validate',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${expiredToken}`,
            },
          };

          const res = await router.dispatch(req);

          expect(res.status).toBe(401);
          const body = res.body as { code?: string; message?: string };
          expect(body.message).toContain('Token expired');
        },
      ),
      { numRuns: 100 },
    );
  });
});
