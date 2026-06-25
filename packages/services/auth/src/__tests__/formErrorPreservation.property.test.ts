/**
 * Property Tests: Form Error State Preservation
 *
 * **Property 3: Form Error State Preservation**
 *
 * For any mix of valid/invalid registration form fields, the handler SHALL return
 * fieldErrors ONLY for invalid fields, never for valid ones. Valid field values
 * are preserved client-side and are not repeated in the error response.
 *
 * **Validates: Requirements 1.44, 1.45, 1.46, 1.47, 1.48, 1.49**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRegisterParentHandler } from '../handlers/registerParent';
import type { CognitoClient, DbClient, CognitoDuplicateError } from '../handlers/registerParent';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ─── Validation Rules (mirroring handler logic) ───────────────────────────────

const USERNAME_MIN = 8;
const USERNAME_MAX = 15;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const NAME_MIN = 5;
const NAME_MAX = 20;
const NAME_PATTERN = /^[a-zA-Z\s]+$/;

const PHONE_PATTERN = /^\d{10}$/;

const EMAIL_MAX = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;

function isValidUsername(v: string): boolean {
  return typeof v === 'string' && v.length >= USERNAME_MIN && v.length <= USERNAME_MAX && USERNAME_PATTERN.test(v);
}

function isValidName(v: string): boolean {
  return typeof v === 'string' && v.length >= NAME_MIN && v.length <= NAME_MAX && NAME_PATTERN.test(v);
}

function isValidPhone(v: string): boolean {
  return typeof v === 'string' && PHONE_PATTERN.test(v);
}

function isValidEmail(v: string): boolean {
  return typeof v === 'string' && v.length <= EMAIL_MAX && EMAIL_PATTERN.test(v);
}

function isValidPassword(v: string): boolean {
  if (typeof v !== 'string') return false;
  if (v.length < PASSWORD_MIN || v.length > PASSWORD_MAX) return false;
  if (!/[A-Z]/.test(v)) return false;
  if (!/[a-z]/.test(v)) return false;
  if (!/[0-9]/.test(v)) return false;
  if (!/[^a-zA-Z0-9\s]/.test(v)) return false;
  return true;
}

// ─── Mock Dependencies ────────────────────────────────────────────────────────

function createMockCognito(): CognitoClient {
  return {
    createUser: async () => ({ cognitoSub: 'cognito-sub-test-123' }),
    addUserToGroup: async () => {},
  };
}

function createMockDb(): DbClient {
  return {
    insertParent: async () => {},
  };
}

function createDuplicateCognito(field: 'username' | 'email' | 'phone'): CognitoClient {
  return {
    createUser: async () => {
      const error = new Error('Duplicate') as CognitoDuplicateError;
      error.code = 'UsernameExistsException';
      error.duplicateField = field;
      throw error;
    },
    addUserToGroup: async () => {},
  };
}

// ─── Event Factory ────────────────────────────────────────────────────────────

function makeEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    httpMethod: 'POST',
    path: '/auth/register/parent',
    requestContext: { authorizer: { claims: {} } },
  } as APIGatewayProxyEvent;
}

// ─── Character Sets ───────────────────────────────────────────────────────────

const USERNAME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';

// ─── Arbitraries: Valid Field Generators ──────────────────────────────────────

const validUsernameArb = fc.stringOf(
  fc.constantFrom(...USERNAME_CHARS.split('')),
  { minLength: 8, maxLength: 15 },
);

const validNameArb = fc.tuple(
  fc.constantFrom(...'ABCDEFGHIJKLM'.split('')),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnop '.split('')), { minLength: 4, maxLength: 18 }),
).map(([first, rest]) => {
  const name = (first + rest).replace(/\s{2,}/g, ' ').trim();
  return name.length < 5 ? name + 'abcde'.slice(0, 5 - name.length) : name.slice(0, 20);
}).filter((n) => n.length >= 5 && n.length <= 20 && /^[a-zA-Z\s]+$/.test(n) && n.trim().length > 0);

const validPhoneArb = fc.stringOf(
  fc.constantFrom(...'0123456789'.split('')),
  { minLength: 10, maxLength: 10 },
);

const validEmailArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijk'.split('')), { minLength: 2, maxLength: 6 }),
  fc.stringOf(fc.constantFrom(...'abcdef'.split('')), { minLength: 2, maxLength: 4 }),
  fc.constantFrom('com', 'org', 'net'),
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const validPasswordArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'ABCD'.split('')), { minLength: 2, maxLength: 4 }),
  fc.stringOf(fc.constantFrom(...'abcd'.split('')), { minLength: 3, maxLength: 6 }),
  fc.stringOf(fc.constantFrom(...'123'.split('')), { minLength: 1, maxLength: 3 }),
  fc.constantFrom('!', '@', '#', '$'),
).map(([upper, lower, num, special]) => `${upper}${lower}${num}${special}`)
  .filter((p) => p.length >= 8 && p.length <= 20);

// ─── Arbitraries: Invalid Field Generators ────────────────────────────────────

const invalidUsernameArb = fc.oneof(
  // Too short
  fc.stringOf(fc.constantFrom(...USERNAME_CHARS.split('')), { minLength: 1, maxLength: 7 }),
  // Too long
  fc.stringOf(fc.constantFrom(...USERNAME_CHARS.split('')), { minLength: 16, maxLength: 25 }),
  // Invalid chars
  fc.stringOf(fc.constantFrom(...USERNAME_CHARS.split('')), { minLength: 6, maxLength: 12 }).map((s) => s + '!@'),
);

const invalidNameArb = fc.oneof(
  // Too short
  fc.stringOf(fc.constantFrom(...'abcdefghijk'.split('')), { minLength: 1, maxLength: 4 }),
  // Too long
  fc.stringOf(fc.constantFrom(...'abcdefghijk'.split('')), { minLength: 21, maxLength: 35 }),
  // Invalid chars (numbers in name, ensure length 5+)
  fc.stringOf(fc.constantFrom(...'abcdefgh'.split('')), { minLength: 3, maxLength: 16 }).map((s) => s + '123'),
);

const invalidPhoneArb = fc.oneof(
  // Wrong length (too short)
  fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 9 }),
  // Wrong length (too long)
  fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 11, maxLength: 15 }),
);

const invalidEmailArb = fc.oneof(
  // Too long
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnop'.split('')), { minLength: 14, maxLength: 18 })
    .map((s) => `${s}${s}@ex.com`),
  // No @ sign
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnop'.split('')), { minLength: 5, maxLength: 20 }),
);

const invalidPasswordArb = fc.oneof(
  // Too short
  fc.stringOf(fc.constantFrom(...'abcABC123!@#'.split('')), { minLength: 1, maxLength: 7 }),
  // Too long
  fc.stringOf(fc.constantFrom(...'abcABC123!@#'.split('')), { minLength: 21, maxLength: 35 }),
  // Missing uppercase
  fc.tuple(
    fc.stringOf(fc.constantFrom(...'abcdefgh'.split('')), { minLength: 4, maxLength: 12 }),
    fc.stringOf(fc.constantFrom(...'12345'.split('')), { minLength: 1, maxLength: 3 }),
    fc.constantFrom('!', '@', '#'),
  ).map(([lower, num, special]) => `${lower}${num}${special}`)
    .filter((p) => p.length >= 8 && p.length <= 20 && !/[A-Z]/.test(p)),
);

// ─── Mixed Form Input Generator ──────────────────────────────────────────────

/**
 * Generates a form where each field is randomly valid or invalid.
 * Returns the form body along with which fields are expected to be invalid.
 */
const mixedFormArb = fc.record({
  usernameValid: fc.boolean(),
  nameValid: fc.boolean(),
  phoneValid: fc.boolean(),
  emailValid: fc.boolean(),
  passwordValid: fc.boolean(),
}).chain((flags) => {
  return fc.tuple(
    flags.usernameValid ? validUsernameArb : invalidUsernameArb,
    flags.nameValid ? validNameArb : invalidNameArb,
    flags.phoneValid ? validPhoneArb : invalidPhoneArb,
    flags.emailValid ? validEmailArb : invalidEmailArb,
    flags.passwordValid ? validPasswordArb : invalidPasswordArb,
  ).map(([username, name, phone, email, password]) => ({
    body: { username, name, phone, email, password },
    expectedInvalid: {
      username: !flags.usernameValid,
      name: !flags.nameValid,
      phone: !flags.phoneValid,
      email: !flags.emailValid,
      password: !flags.passwordValid,
    },
  }));
});

/**
 * Generator that ensures at least one field is invalid (guarantees 400 response).
 */
const atLeastOneInvalidArb = mixedFormArb.filter(({ expectedInvalid }) =>
  Object.values(expectedInvalid).some((v) => v),
);

/**
 * Generator that ensures all fields are valid (guarantees 201 response).
 */
const allValidArb = fc.tuple(
  validUsernameArb,
  validNameArb,
  validPhoneArb,
  validEmailArb,
  validPasswordArb,
).map(([username, name, phone, email, password]) => ({
  body: { username, name, phone, email, password },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 3: Form Error State Preservation', () => {
  const handler = createRegisterParentHandler(createMockCognito(), createMockDb());

  it('invalid fields appear in fieldErrors; valid fields do NOT appear', async () => {
    await fc.assert(
      fc.asyncProperty(atLeastOneInvalidArb, async ({ body, expectedInvalid }) => {
        const event = makeEvent(body);
        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const parsed = JSON.parse(result.body);
        const fieldErrors: Array<{ field: string; message: string }> = parsed.fieldErrors;
        const errorFieldNames = fieldErrors.map((e) => e.field);

        // Valid fields must NOT appear in fieldErrors
        if (!expectedInvalid.username) {
          expect(errorFieldNames).not.toContain('username');
        }
        if (!expectedInvalid.name) {
          expect(errorFieldNames).not.toContain('name');
        }
        if (!expectedInvalid.phone) {
          expect(errorFieldNames).not.toContain('phone');
        }
        if (!expectedInvalid.email) {
          expect(errorFieldNames).not.toContain('email');
        }
        if (!expectedInvalid.password) {
          expect(errorFieldNames).not.toContain('password');
        }

        // Invalid fields MUST appear in fieldErrors
        if (expectedInvalid.username) {
          expect(errorFieldNames).toContain('username');
        }
        if (expectedInvalid.name) {
          expect(errorFieldNames).toContain('name');
        }
        if (expectedInvalid.phone) {
          expect(errorFieldNames).toContain('phone');
        }
        if (expectedInvalid.email) {
          expect(errorFieldNames).toContain('email');
        }
        if (expectedInvalid.password) {
          expect(errorFieldNames).toContain('password');
        }
      }),
      { numRuns: 150 },
    );
  });

  it('every field in fieldErrors has a non-empty message', async () => {
    await fc.assert(
      fc.asyncProperty(atLeastOneInvalidArb, async ({ body }) => {
        const event = makeEvent(body);
        const result = await handler(event);

        expect(result.statusCode).toBe(400);
        const parsed = JSON.parse(result.body);
        const fieldErrors: Array<{ field: string; message: string }> = parsed.fieldErrors;

        for (const err of fieldErrors) {
          expect(err.message).toBeDefined();
          expect(typeof err.message).toBe('string');
          expect(err.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('handler NEVER returns both fieldErrors and a 201 success response', async () => {
    await fc.assert(
      fc.asyncProperty(mixedFormArb, async ({ body }) => {
        const event = makeEvent(body);
        const result = await handler(event);
        const parsed = JSON.parse(result.body);

        if (result.statusCode === 201) {
          // Success response must not contain fieldErrors
          expect(parsed.fieldErrors).toBeUndefined();
        }
        if (parsed.fieldErrors && parsed.fieldErrors.length > 0) {
          // If there are field errors, must not be 201
          expect(result.statusCode).not.toBe(201);
        }
      }),
      { numRuns: 150 },
    );
  });

  it('duplicate username (409) returns fieldErrors with username field and correct message', async () => {
    const duplicateHandler = createRegisterParentHandler(
      createDuplicateCognito('username'),
      createMockDb(),
    );

    await fc.assert(
      fc.asyncProperty(allValidArb, async ({ body }) => {
        const event = makeEvent(body);
        const result = await duplicateHandler(event);

        expect(result.statusCode).toBe(409);
        const parsed = JSON.parse(result.body);
        const fieldErrors: Array<{ field: string; message: string }> = parsed.fieldErrors;

        expect(fieldErrors).toBeDefined();
        expect(fieldErrors.length).toBe(1);
        expect(fieldErrors[0].field).toBe('username');
        expect(fieldErrors[0].message).toBe(
          'Username already taken — please choose a different username',
        );
      }),
      { numRuns: 50 },
    );
  });

  it('duplicate email (409) returns fieldErrors with email field and correct message', async () => {
    const duplicateHandler = createRegisterParentHandler(
      createDuplicateCognito('email'),
      createMockDb(),
    );

    await fc.assert(
      fc.asyncProperty(allValidArb, async ({ body }) => {
        const event = makeEvent(body);
        const result = await duplicateHandler(event);

        expect(result.statusCode).toBe(409);
        const parsed = JSON.parse(result.body);
        const fieldErrors: Array<{ field: string; message: string }> = parsed.fieldErrors;

        expect(fieldErrors).toBeDefined();
        expect(fieldErrors.length).toBe(1);
        expect(fieldErrors[0].field).toBe('email');
        expect(fieldErrors[0].message).toBe(
          'Email already registered — try logging in or use a different email',
        );
      }),
      { numRuns: 50 },
    );
  });

  it('duplicate phone (409) returns fieldErrors with phone field and correct message', async () => {
    const duplicateHandler = createRegisterParentHandler(
      createDuplicateCognito('phone'),
      createMockDb(),
    );

    await fc.assert(
      fc.asyncProperty(allValidArb, async ({ body }) => {
        const event = makeEvent(body);
        const result = await duplicateHandler(event);

        expect(result.statusCode).toBe(409);
        const parsed = JSON.parse(result.body);
        const fieldErrors: Array<{ field: string; message: string }> = parsed.fieldErrors;

        expect(fieldErrors).toBeDefined();
        expect(fieldErrors.length).toBe(1);
        expect(fieldErrors[0].field).toBe('phone');
        expect(fieldErrors[0].message).toBe(
          'Phone number already registered — try logging in or use a different number',
        );
      }),
      { numRuns: 50 },
    );
  });

  it('valid form values are preserved: server confirms validity by returning 201 (no field errors)', async () => {
    await fc.assert(
      fc.asyncProperty(allValidArb, async ({ body }) => {
        const event = makeEvent(body);
        const result = await handler(event);

        // All valid fields should result in success, no fieldErrors
        expect(result.statusCode).toBe(201);
        const parsed = JSON.parse(result.body);
        expect(parsed.fieldErrors).toBeUndefined();
        expect(parsed.parentId).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });
});
