/**
 * Property Tests: Registration Input Validation
 *
 * **Property 2: Registration Input Validation**
 *
 * For any registration input (parent or student), the validation logic SHALL accept
 * inputs matching the defined rules and SHALL reject all inputs violating any rule,
 * returning field-specific error messages.
 *
 * **Validates: Requirements 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21, 1.22,
 * 1.23, 1.24, 1.25, 1.26, 1.27, 1.28, 1.29, 1.30**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createRegisterParentHandler } from '../handlers/registerParent';
import { createRegisterStudentHandler } from '../handlers/registerStudent';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ─── Valid Grades ─────────────────────────────────────────────────────────────

const VALID_GRADES = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
  'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth',
] as const;

// ─── Mock Dependencies ────────────────────────────────────────────────────────

function createMockParentCognito() {
  return {
    createUser: async () => ({ cognitoSub: 'cognito-sub-123' }),
    addUserToGroup: async () => {},
  };
}

function createMockParentDb() {
  return {
    insertParent: async () => {},
  };
}

function createMockStudentCognito() {
  return {
    createUser: async () => ({ cognitoSub: 'cognito-sub-456' }),
    addUserToGroup: async () => {},
  };
}

function createMockStudentDb() {
  return {
    findParentByUsername: async () => ({ id: 'parent-id-123' }),
    findStudentByUsername: async () => null,
    insertStudent: async () => {},
    insertStudentSubjects: async () => {},
    insertCustomSubject: async () => ({ id: 'custom-subject-id' }),
    getExistingCustomSubjectCount: async () => 0,
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
const ALPHA_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ─── Arbitraries: Valid Generators ────────────────────────────────────────────

/** Valid username: 8-15 chars, alphanumeric/hyphens/underscores */
const validUsernameArb = fc.stringOf(
  fc.constantFrom(...USERNAME_CHARS.split('')),
  { minLength: 8, maxLength: 15 },
);

/** Valid name: 5-20 chars, alphabets and spaces (ensure non-empty trim) */
const validNameArb = fc.tuple(
  fc.constantFrom(...'ABCDEFGHIJKLM'.split('')),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnop '.split('')), { minLength: 4, maxLength: 18 }),
).map(([first, rest]) => {
  // Ensure we stay within 5-20 chars and the string has alphabets only
  const name = (first + rest).replace(/\s{2,}/g, ' ').trim();
  // Pad to at least 5 if needed
  return name.length < 5 ? name + 'abcde'.slice(0, 5 - name.length) : name.slice(0, 20);
}).filter((n) => n.length >= 5 && n.length <= 20 && /^[a-zA-Z\s]+$/.test(n) && n.trim().length > 0);

/** Valid phone: exactly 10 digits */
const validPhoneArb = fc.stringOf(
  fc.constantFrom(...'0123456789'.split('')),
  { minLength: 10, maxLength: 10 },
);

/** Valid email: ≤30 chars, proper format */
const validEmailArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijk'.split('')), { minLength: 2, maxLength: 6 }),
  fc.stringOf(fc.constantFrom(...'abcdef'.split('')), { minLength: 2, maxLength: 4 }),
  fc.constantFrom('com', 'org', 'net'),
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/**
 * Valid password: 8-20 chars with uppercase+lowercase+number+special.
 * We construct it deterministically to guarantee all requirements.
 */
const validPasswordArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'ABCD'.split('')), { minLength: 2, maxLength: 4 }),
  fc.stringOf(fc.constantFrom(...'abcd'.split('')), { minLength: 3, maxLength: 6 }),
  fc.stringOf(fc.constantFrom(...'123'.split('')), { minLength: 1, maxLength: 3 }),
  fc.constantFrom('!', '@', '#', '$'),
).map(([upper, lower, num, special]) => `${upper}${lower}${num}${special}`)
  .filter((p) => p.length >= 8 && p.length <= 20);

/** Valid grade */
const validGradeArb = fc.constantFrom(...VALID_GRADES);

/** Valid school name: 5-30 chars, alphabets/numbers/commas/hyphens */
const validSchoolNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEF0123456789'.split('')),
  { minLength: 5, maxLength: 30 },
);

/** Valid subject IDs: array with at least 1 UUID-like string */
const validSubjectsArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 5 });

/** Valid custom subject name: 1-50 chars */
const validCustomSubjectNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
  { minLength: 1, maxLength: 50 },
).filter((s) => s.trim().length > 0);

// ─── Arbitraries: Invalid Generators ──────────────────────────────────────────

/** Username too short (1-7 chars) */
const tooShortUsernameArb = fc.stringOf(
  fc.constantFrom(...USERNAME_CHARS.split('')),
  { minLength: 1, maxLength: 7 },
);

/** Username too long (16-30 chars) */
const tooLongUsernameArb = fc.stringOf(
  fc.constantFrom(...USERNAME_CHARS.split('')),
  { minLength: 16, maxLength: 30 },
);

/** Username with invalid characters (add special chars to valid-length string) */
const invalidCharsUsernameArb = fc.stringOf(
  fc.constantFrom(...USERNAME_CHARS.split('')),
  { minLength: 6, maxLength: 12 },
).map((s) => s + '!@');

/** Name too short (1-4 chars) */
const tooShortNameArb = fc.stringOf(
  fc.constantFrom(...ALPHA_CHARS.split('')),
  { minLength: 1, maxLength: 4 },
);

/** Name too long (21-40 chars) */
const tooLongNameArb = fc.stringOf(
  fc.constantFrom(...ALPHA_CHARS.split('')),
  { minLength: 21, maxLength: 40 },
);

/** Name with numbers (invalid) — ensure 5-20 length so only character rule fails */
const invalidCharsNameArb = fc.stringOf(
  fc.constantFrom(...ALPHA_CHARS.split('')),
  { minLength: 3, maxLength: 16 },
).map((s) => s + '123');

/** Phone wrong length */
const invalidPhoneArb = fc.oneof(
  fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 9 }),
  fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 11, maxLength: 15 }),
);

/** Email too long (>30 chars) */
const tooLongEmailArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnop'.split('')),
  { minLength: 14, maxLength: 18 },
).map((s) => `${s}${s}@ex.com`);

/** Email invalid format (no @) */
const invalidFormatEmailArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnop'.split('')),
  { minLength: 5, maxLength: 20 },
);

/** Password too short (1-7 chars) */
const tooShortPasswordArb = fc.stringOf(
  fc.constantFrom(...'abcABC123!@#'.split('')),
  { minLength: 1, maxLength: 7 },
);

/** Password too long (21-40 chars) */
const tooLongPasswordArb = fc.stringOf(
  fc.constantFrom(...'abcABC123!@#'.split('')),
  { minLength: 21, maxLength: 40 },
);

/** Password missing uppercase (8-20 chars, has lower + number + special) */
const passwordNoUpperArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefgh'.split('')), { minLength: 4, maxLength: 12 }),
  fc.stringOf(fc.constantFrom(...'12345'.split('')), { minLength: 1, maxLength: 3 }),
  fc.constantFrom('!', '@', '#'),
).map(([lower, num, special]) => `${lower}${num}${special}`)
  .filter((p) => p.length >= 8 && p.length <= 20 && !/[A-Z]/.test(p));

/** Password missing lowercase (8-20 chars, has upper + number + special) */
const passwordNoLowerArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'ABCDEFGH'.split('')), { minLength: 4, maxLength: 12 }),
  fc.stringOf(fc.constantFrom(...'12345'.split('')), { minLength: 1, maxLength: 3 }),
  fc.constantFrom('!', '@', '#'),
).map(([upper, num, special]) => `${upper}${num}${special}`)
  .filter((p) => p.length >= 8 && p.length <= 20 && !/[a-z]/.test(p));

/** Password missing number (8-20 chars, has upper + lower + special) */
const passwordNoNumberArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefgh'.split('')), { minLength: 3, maxLength: 10 }),
  fc.stringOf(fc.constantFrom(...'ABCDEFGH'.split('')), { minLength: 2, maxLength: 6 }),
  fc.constantFrom('!', '@', '#', '$$'),
).map(([lower, upper, special]) => `${lower}${upper}${special}`)
  .filter((p) => p.length >= 8 && p.length <= 20 && !/[0-9]/.test(p));

/** Password missing special character (8-20 chars, has upper + lower + number) */
const passwordNoSpecialArb = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefgh'.split('')), { minLength: 3, maxLength: 8 }),
  fc.stringOf(fc.constantFrom(...'ABCDEFGH'.split('')), { minLength: 2, maxLength: 5 }),
  fc.stringOf(fc.constantFrom(...'12345'.split('')), { minLength: 1, maxLength: 4 }),
).map(([lower, upper, num]) => `${lower}${upper}${num}`)
  .filter((p) => p.length >= 8 && p.length <= 20 && !/[^a-zA-Z0-9\s]/.test(p));

/** Invalid grade */
const invalidGradeArb = fc.constantFrom(
  'Kindergarten', 'Grade1', 'thirteen', 'invalid', '', 'FIRST', 'lkg',
);

/** School name too short (1-4 chars) */
const tooShortSchoolNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijk'.split('')),
  { minLength: 1, maxLength: 4 },
);

/** School name too long (31-60 chars) */
const tooLongSchoolNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijk'.split('')),
  { minLength: 31, maxLength: 60 },
);

// ─── Tests: Parent Registration ───────────────────────────────────────────────

describe('Property 2: Registration Input Validation — Parent', () => {
  const handler = createRegisterParentHandler(
    createMockParentCognito(),
    createMockParentDb(),
  );

  it('valid parent inputs always return 201', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('username too short returns 400 with username field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        tooShortUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'username',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('username too long returns 400 with username field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        tooLongUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'username',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('username with invalid characters returns 400 with username field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidCharsUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'username',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('name too short returns 400 with name field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        tooShortNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'name',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('name too long returns 400 with name field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        tooLongNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'name',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('name with invalid characters returns 400 with name field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        invalidCharsNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'name',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('invalid phone number returns 400 with phone field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        invalidPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'phone',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('email too long returns 400 with email field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        tooLongEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'email',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('invalid email format returns 400 with email field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        invalidFormatEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'email',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('password too short returns 400 with password field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        tooShortPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('password too long returns 400 with password field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        tooLongPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('password missing uppercase returns 400 with password field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        passwordNoUpperArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
          expect(fieldError.message).toContain('uppercase');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('password missing lowercase returns 400 with password field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        passwordNoLowerArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
          expect(fieldError.message).toContain('lowercase');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('password missing number returns 400 with password field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        passwordNoNumberArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
          expect(fieldError.message).toContain('number');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('password missing special character returns 400 with password field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPhoneArb,
        validEmailArb,
        passwordNoSpecialArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.fieldErrors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
          expect(fieldError.message).toContain('special');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('boundary: username at exactly min length (8) is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(fc.constantFrom(...USERNAME_CHARS.split('')), { minLength: 8, maxLength: 8 }),
        validNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('boundary: username at exactly max length (15) is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(fc.constantFrom(...USERNAME_CHARS.split('')), { minLength: 15, maxLength: 15 }),
        validNameArb,
        validPhoneArb,
        validEmailArb,
        validPasswordArb,
        async (username, name, phone, email, password) => {
          const event = makeEvent({ username, name, phone, email, password });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ─── Tests: Student Registration ──────────────────────────────────────────────

describe('Property 2: Registration Input Validation — Student', () => {
  const handler = createRegisterStudentHandler(
    createMockStudentCognito(),
    createMockStudentDb(),
  );

  it('valid student inputs always return 201', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        validSchoolNameArb,
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('student username too short returns 400 with username field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        tooShortUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        validSchoolNameArb,
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field === 'username',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('invalid grade returns 400 with grade field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        invalidGradeArb,
        validSchoolNameArb,
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field === 'grade',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('school name too short returns 400 with schoolName field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        tooShortSchoolNameArb,
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field === 'schoolName',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('school name too long returns 400 with schoolName field error', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        tooLongSchoolNameArb,
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field === 'schoolName',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('empty subjects with no custom subjects returns 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        validSchoolNameArb,
        async (username, name, password, grade, schoolName) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects: [],
            customSubjects: [],
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field === 'subjects',
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 30 },
    );
  });

  it('valid custom subjects (1-50 chars) with empty subjects returns 201', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        validSchoolNameArb,
        validCustomSubjectNameArb,
        async (username, name, password, grade, schoolName, customName) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects: [],
            customSubjects: [{ name: customName }],
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('custom subject name exceeding 50 chars returns 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        validSchoolNameArb,
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnop'.split('')), { minLength: 51, maxLength: 70 }),
        async (username, name, password, grade, schoolName, longName) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects: [],
            customSubjects: [{ name: longName }],
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field.includes('customSubjects'),
          );
          expect(fieldError).toBeDefined();
        },
      ),
      { numRuns: 50 },
    );
  });

  it('boundary: school name at exactly min length (5) is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        fc.stringOf(fc.constantFrom(...'abcdefghijk'.split('')), { minLength: 5, maxLength: 5 }),
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('boundary: school name at exactly max length (30) is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        validPasswordArb,
        validGradeArb,
        fc.stringOf(fc.constantFrom(...'abcdefghijk'.split('')), { minLength: 30, maxLength: 30 }),
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(201);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('student password validation errors have field-specific messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUsernameArb,
        validNameArb,
        passwordNoUpperArb,
        validGradeArb,
        validSchoolNameArb,
        validSubjectsArb,
        async (username, name, password, grade, schoolName, subjects) => {
          const event = makeEvent({
            parentUsername: 'validparent1',
            username,
            name,
            password,
            grade,
            schoolName,
            subjects,
          });
          const result = await handler(event);
          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          const fieldError = body.errors.find(
            (e: { field: string }) => e.field === 'password',
          );
          expect(fieldError).toBeDefined();
          expect(fieldError.message).toContain('uppercase');
        },
      ),
      { numRuns: 50 },
    );
  });
});
