/**
 * Unit tests for the parent registration Lambda handler.
 *
 * Tests validation, Cognito integration, DB insertion, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createRegisterParentHandler,
  type CognitoClient,
  type DbClient,
  type CognitoDuplicateError,
} from './registerParent';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: body === null ? null : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { requestId: 'test-request-id' },
    httpMethod: 'POST',
    path: '/auth/register/parent',
    resource: '/auth/register/parent',
  };
}

function createValidBody() {
  return {
    username: 'parentuser1',
    name: 'John Smith',
    phone: '9876543210',
    email: 'john@example.com',
    password: 'Pass1234!',
  };
}

function createMockCognitoClient(): CognitoClient {
  return {
    createUser: vi.fn().mockResolvedValue({ cognitoSub: 'cognito-sub-123' }),
    addUserToGroup: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDbClient(): DbClient {
  return {
    insertParent: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================
// Tests
// ============================================================

describe('registerParent handler', () => {
  let cognitoClient: CognitoClient;
  let dbClient: DbClient;
  let handler: ReturnType<typeof createRegisterParentHandler>;

  beforeEach(() => {
    cognitoClient = createMockCognitoClient();
    dbClient = createMockDbClient();
    handler = createRegisterParentHandler(cognitoClient, dbClient);
  });

  describe('successful registration', () => {
    it('should return 201 with parentId on valid input', async () => {
      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Parent registered successfully');
      expect(body.parentId).toBeDefined();
      expect(typeof body.parentId).toBe('string');
    });

    it('should create Cognito user with correct params', async () => {
      const input = createValidBody();
      const event = createMockEvent(input);
      await handler(event);

      expect(cognitoClient.createUser).toHaveBeenCalledWith({
        username: input.username,
        password: input.password,
        email: input.email,
        phone: input.phone,
        name: input.name,
      });
    });

    it('should add user to "parent" group', async () => {
      const input = createValidBody();
      const event = createMockEvent(input);
      await handler(event);

      expect(cognitoClient.addUserToGroup).toHaveBeenCalledWith({
        username: input.username,
        groupName: 'parent',
      });
    });

    it('should insert parent into DB with all fields', async () => {
      const input = createValidBody();
      const event = createMockEvent(input);
      await handler(event);

      expect(dbClient.insertParent).toHaveBeenCalledWith(
        expect.objectContaining({
          username: input.username,
          name: input.name,
          email: input.email,
          phone: input.phone,
          cognitoSub: 'cognito-sub-123',
        }),
      );
    });
  });

  describe('request body validation', () => {
    it('should return 400 when body is null', async () => {
      const event = createMockEvent(null);
      event.body = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({});
      event.body = 'not json';
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });
  });

  describe('username validation', () => {
    it('should reject username shorter than 8 characters', async () => {
      const input = { ...createValidBody(), username: 'short' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'username' }),
      );
    });

    it('should reject username longer than 15 characters', async () => {
      const input = { ...createValidBody(), username: 'a'.repeat(16) };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'username' }),
      );
    });

    it('should reject username with special characters', async () => {
      const input = { ...createValidBody(), username: 'user@name' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'username' }),
      );
    });

    it('should accept valid username with hyphens and underscores', async () => {
      const input = { ...createValidBody(), username: 'user-name_1' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('name validation', () => {
    it('should reject name shorter than 5 characters', async () => {
      const input = { ...createValidBody(), name: 'Jo' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'name' }),
      );
    });

    it('should reject name longer than 20 characters', async () => {
      const input = { ...createValidBody(), name: 'A'.repeat(21) };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'name' }),
      );
    });

    it('should reject name with numbers', async () => {
      const input = { ...createValidBody(), name: 'John Smith3' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'name' }),
      );
    });

    it('should accept valid name with spaces', async () => {
      const input = { ...createValidBody(), name: 'John Smith' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('phone validation', () => {
    it('should reject phone with fewer than 10 digits', async () => {
      const input = { ...createValidBody(), phone: '12345678' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'phone' }),
      );
    });

    it('should reject phone with more than 10 digits', async () => {
      const input = { ...createValidBody(), phone: '12345678901' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'phone' }),
      );
    });

    it('should reject phone with non-digit characters', async () => {
      const input = { ...createValidBody(), phone: '98765-4321' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'phone' }),
      );
    });
  });

  describe('email validation', () => {
    it('should reject email exceeding 30 characters', async () => {
      const input = { ...createValidBody(), email: 'verylongemailaddress@example.com' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'email' }),
      );
    });

    it('should reject email without @ sign', async () => {
      const input = { ...createValidBody(), email: 'invalidemail.com' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'email' }),
      );
    });

    it('should accept valid email within 30 chars', async () => {
      const input = { ...createValidBody(), email: 'a@b.com' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('password validation', () => {
    it('should reject password shorter than 8 characters', async () => {
      const input = { ...createValidBody(), password: 'Pa1!' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'password' }),
      );
    });

    it('should reject password longer than 20 characters', async () => {
      const input = { ...createValidBody(), password: 'Abcdefgh1!Abcdefgh1!X' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'password' }),
      );
    });

    it('should reject password without uppercase letter', async () => {
      const input = { ...createValidBody(), password: 'abcdefg1!' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'password', message: expect.stringContaining('uppercase') }),
      );
    });

    it('should reject password without lowercase letter', async () => {
      const input = { ...createValidBody(), password: 'ABCDEFG1!' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'password', message: expect.stringContaining('lowercase') }),
      );
    });

    it('should reject password without a number', async () => {
      const input = { ...createValidBody(), password: 'Abcdefgh!' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'password', message: expect.stringContaining('number') }),
      );
    });

    it('should reject password without a special symbol', async () => {
      const input = { ...createValidBody(), password: 'Abcdefg12' };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors).toContainEqual(
        expect.objectContaining({ field: 'password', message: expect.stringContaining('special') }),
      );
    });
  });

  describe('duplicate handling (409)', () => {
    it('should return 409 for duplicate username', async () => {
      const error = new Error('User already exists') as CognitoDuplicateError;
      error.code = 'UsernameExistsException';
      (cognitoClient.createUser as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Username already taken — please choose a different username');
      expect(body.fieldErrors[0].field).toBe('username');
    });

    it('should return 500 (not 409) for duplicate email — email uniqueness not enforced', async () => {
      const error = new Error('Email exists') as CognitoDuplicateError;
      error.code = 'DuplicateAttribute';
      (cognitoClient.createUser as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      // Email/phone duplicates are no longer handled as 409 — they propagate as 500
      expect(result.statusCode).toBe(500);
    });

    it('should return 500 (not 409) for duplicate phone — phone uniqueness not enforced', async () => {
      const error = new Error('Phone exists') as CognitoDuplicateError;
      error.code = 'DuplicateAttribute';
      (cognitoClient.createUser as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      // Email/phone duplicates are no longer handled as 409 — they propagate as 500
      expect(result.statusCode).toBe(500);
    });
  });

  describe('internal error handling (500)', () => {
    it('should return 500 with generic message on unexpected Cognito error', async () => {
      (cognitoClient.createUser as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Service unavailable'),
      );

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Something went wrong — please try again after some time');
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should return 500 when DB insert fails', async () => {
      (dbClient.insertParent as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection refused'),
      );

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });

    it('should return 500 when addUserToGroup fails', async () => {
      (cognitoClient.addUserToGroup as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Group not found'),
      );

      const event = createMockEvent(createValidBody());
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });
  });

  describe('multiple validation errors', () => {
    it('should return all field errors at once', async () => {
      const input = {
        username: 'sh',
        name: 'Jo',
        phone: '123',
        email: 'invalid',
        password: 'weak',
      };
      const event = createMockEvent(input);
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.fieldErrors.length).toBeGreaterThanOrEqual(4);
      const fields = body.fieldErrors.map((e: { field: string }) => e.field);
      expect(fields).toContain('username');
      expect(fields).toContain('name');
      expect(fields).toContain('phone');
      expect(fields).toContain('email');
    });
  });
});
