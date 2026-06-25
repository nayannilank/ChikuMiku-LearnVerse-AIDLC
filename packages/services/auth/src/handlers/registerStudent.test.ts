/**
 * Unit tests for Student Registration Lambda Handler
 *
 * Tests validation, Cognito integration, DB operations, and error handling.
 *
 * Requirements: 1.20, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28, 1.29, 1.30
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createRegisterStudentHandler,
  CognitoClient,
  DBClient,
} from './registerStudent';

// --- Mock Factories ---

function createMockCognitoClient(): CognitoClient {
  return {
    createUser: vi.fn().mockResolvedValue({ cognitoSub: 'cognito-sub-123' }),
    addUserToGroup: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDBClient(): DBClient {
  return {
    findParentByUsername: vi.fn().mockResolvedValue({ id: 'parent-id-123' }),
    findStudentByUsername: vi.fn().mockResolvedValue(null),
    insertStudent: vi.fn().mockResolvedValue(undefined),
    insertStudentSubjects: vi.fn().mockResolvedValue(undefined),
    insertCustomSubject: vi.fn().mockImplementation(async (subject) => ({ id: subject.id })),
    getExistingCustomSubjectCount: vi.fn().mockResolvedValue(0),
  };
}

function createEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {},
    httpMethod: 'POST',
    path: '/auth/register/student',
    resource: '/auth/register/student',
  } as APIGatewayProxyEvent;
}

const validBody = {
  parentUsername: 'rahul_kumar',
  username: 'arjun_student',
  name: 'Arjun Kumar',
  password: 'Stud3nt!Pass',
  grade: 'Fifth',
  schoolName: 'Delhi Public School',
  subjects: ['subject-id-1', 'subject-id-2'],
};

describe('registerStudent handler', () => {
  let cognitoClient: CognitoClient;
  let dbClient: DBClient;
  let handler: ReturnType<typeof createRegisterStudentHandler>;

  beforeEach(() => {
    cognitoClient = createMockCognitoClient();
    dbClient = createMockDBClient();
    handler = createRegisterStudentHandler(cognitoClient, dbClient);
  });

  describe('successful registration', () => {
    it('returns 201 with student ID on valid input', async () => {
      const result = await handler(createEvent(validBody));
      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.studentId).toBeDefined();
      expect(body.message).toBe('Student registered successfully');
    });

    it('creates Cognito user with correct credentials', async () => {
      await handler(createEvent(validBody));
      expect(cognitoClient.createUser).toHaveBeenCalledWith('arjun_student', 'Stud3nt!Pass');
    });

    it('adds user to student group', async () => {
      await handler(createEvent(validBody));
      expect(cognitoClient.addUserToGroup).toHaveBeenCalledWith('arjun_student', 'student');
    });

    it('inserts student into students table', async () => {
      await handler(createEvent(validBody));
      expect(dbClient.insertStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'parent-id-123',
          username: 'arjun_student',
          name: 'Arjun Kumar',
          grade: 'Fifth',
          schoolName: 'Delhi Public School',
          cognitoSub: 'cognito-sub-123',
        }),
      );
    });

    it('seeds student_subjects table with assigned subjects', async () => {
      await handler(createEvent(validBody));
      expect(dbClient.insertStudentSubjects).toHaveBeenCalledWith(
        expect.any(String),
        ['subject-id-1', 'subject-id-2'],
      );
    });

    it('handles custom subjects by creating entries and assigning', async () => {
      const bodyWithCustom = {
        ...validBody,
        customSubjects: [{ name: 'French' }, { name: 'Art' }],
      };
      await handler(createEvent(bodyWithCustom));

      expect(dbClient.insertCustomSubject).toHaveBeenCalledTimes(2);
      expect(dbClient.insertCustomSubject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'French',
          isDefault: false,
          createdBy: 'parent-id-123',
        }),
      );
      expect(dbClient.insertCustomSubject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Art',
          isDefault: false,
          createdBy: 'parent-id-123',
        }),
      );
    });

    it('assigns colors from palette to custom subjects', async () => {
      const bodyWithCustom = {
        ...validBody,
        customSubjects: [{ name: 'French' }],
      };
      await handler(createEvent(bodyWithCustom));

      expect(dbClient.insertCustomSubject).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#FF6B6B', // first color in palette (existingCount = 0)
        }),
      );
    });
  });

  describe('body validation', () => {
    it('returns 400 when body is null', async () => {
      const result = await handler(createEvent(null));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors[0].field).toBe('body');
    });

    it('returns 400 for invalid JSON', async () => {
      const event = {
        ...createEvent(null),
        body: 'not valid json{',
      };
      const result = await handler(event);
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors[0].field).toBe('body');
    });
  });

  describe('parentUsername validation', () => {
    it('returns 400 when parentUsername is missing', async () => {
      const { parentUsername, ...noParent } = validBody;
      const result = await handler(createEvent(noParent));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'parentUsername')).toBe(true);
    });

    it('returns 400 when parent does not exist in DB', async () => {
      (dbClient.findParentByUsername as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await handler(createEvent(validBody));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string; message: string }) =>
        e.field === 'parentUsername' && e.message.includes('does not exist'),
      )).toBe(true);
    });
  });

  describe('username validation', () => {
    it('returns 400 when username is shorter than 8 chars', async () => {
      const result = await handler(createEvent({ ...validBody, username: 'short' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'username')).toBe(true);
    });

    it('returns 400 when username is longer than 15 chars', async () => {
      const result = await handler(createEvent({ ...validBody, username: 'a'.repeat(16) }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'username')).toBe(true);
    });

    it('returns 400 when username contains invalid characters', async () => {
      const result = await handler(createEvent({ ...validBody, username: 'arjun@student' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'username')).toBe(true);
    });

    it('accepts username with exactly 8 characters', async () => {
      const result = await handler(createEvent({ ...validBody, username: 'arjun_ab' }));
      expect(result.statusCode).toBe(201);
    });

    it('accepts username with exactly 15 characters', async () => {
      const result = await handler(createEvent({ ...validBody, username: 'arjun_abcdefgh1' }));
      expect(result.statusCode).toBe(201);
    });

    it('accepts username with hyphens and underscores', async () => {
      const result = await handler(createEvent({ ...validBody, username: 'arjun-k_1' }));
      expect(result.statusCode).toBe(201);
    });
  });

  describe('name validation', () => {
    it('returns 400 when name is shorter than 5 chars', async () => {
      const result = await handler(createEvent({ ...validBody, name: 'Arj' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'name')).toBe(true);
    });

    it('returns 400 when name is longer than 20 chars', async () => {
      const result = await handler(createEvent({ ...validBody, name: 'A'.repeat(21) }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'name')).toBe(true);
    });

    it('returns 400 when name contains numbers', async () => {
      const result = await handler(createEvent({ ...validBody, name: 'Arjun123Kumar' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'name')).toBe(true);
    });

    it('accepts name with spaces', async () => {
      const result = await handler(createEvent({ ...validBody, name: 'Arjun Kumar' }));
      expect(result.statusCode).toBe(201);
    });
  });

  describe('password validation', () => {
    it('returns 400 when password is shorter than 8 chars', async () => {
      const result = await handler(createEvent({ ...validBody, password: 'Pa1!' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('returns 400 when password is longer than 20 chars', async () => {
      const result = await handler(createEvent({ ...validBody, password: 'Abcdefghijk1!!!!!!!!x' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('returns 400 when password has no uppercase', async () => {
      const result = await handler(createEvent({ ...validBody, password: 'passw0rd!' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('returns 400 when password has no lowercase', async () => {
      const result = await handler(createEvent({ ...validBody, password: 'PASSW0RD!' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('returns 400 when password has no number', async () => {
      const result = await handler(createEvent({ ...validBody, password: 'Password!' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('returns 400 when password has no special symbol', async () => {
      const result = await handler(createEvent({ ...validBody, password: 'Passw0rdd' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });
  });

  describe('grade validation', () => {
    it('returns 400 when grade is invalid', async () => {
      const result = await handler(createEvent({ ...validBody, grade: 'InvalidGrade' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'grade')).toBe(true);
    });

    it('accepts all valid grades', async () => {
      const grades = ['LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
        'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
      for (const grade of grades) {
        const result = await handler(createEvent({ ...validBody, grade }));
        expect(result.statusCode).toBe(201);
      }
    });
  });

  describe('schoolName validation', () => {
    it('returns 400 when schoolName is shorter than 5 chars', async () => {
      const result = await handler(createEvent({ ...validBody, schoolName: 'ABC' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'schoolName')).toBe(true);
    });

    it('returns 400 when schoolName is longer than 30 chars', async () => {
      const result = await handler(createEvent({ ...validBody, schoolName: 'A'.repeat(31) }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'schoolName')).toBe(true);
    });

    it('returns 400 when schoolName contains special chars', async () => {
      const result = await handler(createEvent({ ...validBody, schoolName: 'School@Name!' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'schoolName')).toBe(true);
    });

    it('accepts schoolName with commas and hyphens', async () => {
      const result = await handler(createEvent({ ...validBody, schoolName: 'DPS, Delhi-NCR' }));
      expect(result.statusCode).toBe(201);
    });
  });

  describe('subjects validation', () => {
    it('returns 400 when subjects is not an array', async () => {
      const result = await handler(createEvent({ ...validBody, subjects: 'not-array' }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'subjects')).toBe(true);
    });

    it('returns 400 when no subjects selected and no custom subjects', async () => {
      const result = await handler(createEvent({ ...validBody, subjects: [] }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field === 'subjects')).toBe(true);
    });

    it('accepts when subjects is empty but custom subjects provided', async () => {
      const result = await handler(createEvent({
        ...validBody,
        subjects: [],
        customSubjects: [{ name: 'French' }],
      }));
      expect(result.statusCode).toBe(201);
    });

    it('returns 400 for custom subject with empty name', async () => {
      const result = await handler(createEvent({
        ...validBody,
        customSubjects: [{ name: '' }],
      }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field.includes('customSubjects'))).toBe(true);
    });

    it('returns 400 for custom subject name longer than 50 chars', async () => {
      const result = await handler(createEvent({
        ...validBody,
        customSubjects: [{ name: 'A'.repeat(51) }],
      }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.some((e: { field: string }) => e.field.includes('customSubjects'))).toBe(true);
    });
  });

  describe('duplicate username handling', () => {
    it('returns 409 when username already exists in students table', async () => {
      (dbClient.findStudentByUsername as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing-id' });
      const result = await handler(createEvent(validBody));
      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.errors[0].field).toBe('username');
      expect(body.errors[0].message).toContain('already taken');
    });

    it('returns 409 when Cognito throws UsernameExistsException', async () => {
      (cognitoClient.createUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('UsernameExistsException: User already exists'),
      );
      const result = await handler(createEvent(validBody));
      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.errors[0].field).toBe('username');
    });
  });

  describe('internal error handling', () => {
    it('returns 500 with generic message for unexpected errors', async () => {
      (dbClient.insertStudent as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed'),
      );
      const result = await handler(createEvent(validBody));
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });
  });

  describe('multiple validation errors', () => {
    it('returns all field errors at once', async () => {
      const result = await handler(createEvent({
        parentUsername: '',
        username: 'ab',
        name: 'A',
        password: 'bad',
        grade: 'Invalid',
        schoolName: 'X',
        subjects: [],
      }));
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errors.length).toBeGreaterThanOrEqual(6);
      const fields = body.errors.map((e: { field: string }) => e.field);
      expect(fields).toContain('parentUsername');
      expect(fields).toContain('username');
      expect(fields).toContain('name');
      expect(fields).toContain('password');
      expect(fields).toContain('grade');
      expect(fields).toContain('schoolName');
    });
  });
});
