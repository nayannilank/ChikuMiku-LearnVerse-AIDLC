/**
 * Unit tests for the reset password Lambda handler.
 *
 * Tests token validation, password complexity rules, Cognito update, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createResetPasswordHandler,
  type ResetTokenStore,
  type CognitoPasswordClient,
  type UserLookupByIdClient,
} from './resetPassword';

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
    path: '/auth/reset-password',
    resource: '/auth/reset-password',
  };
}

function createValidResetToken() {
  return {
    id: 'token-abc',
    userId: 'user-456',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  };
}

function createMockResetTokenStore(): ResetTokenStore {
  return {
    getResetToken: vi.fn().mockResolvedValue(createValidResetToken()),
    deleteResetToken: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockCognitoClient(): CognitoPasswordClient {
  return {
    setPassword: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockUserLookup(): UserLookupByIdClient {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'user-456', username: 'testuser1' }),
  };
}

// ============================================================
// Tests
// ============================================================

describe('resetPassword handler', () => {
  let resetTokenStore: ResetTokenStore;
  let cognitoClient: CognitoPasswordClient;
  let userLookup: UserLookupByIdClient;
  let handler: ReturnType<typeof createResetPasswordHandler>;

  beforeEach(() => {
    resetTokenStore = createMockResetTokenStore();
    cognitoClient = createMockCognitoClient();
    userLookup = createMockUserLookup();
    handler = createResetPasswordHandler(resetTokenStore, cognitoClient, userLookup);
  });

  describe('successful password reset', () => {
    it('should return 200 on valid token and password', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Password reset successful');
    });

    it('should update password in Cognito with correct username', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      await handler(event);

      expect(cognitoClient.setPassword).toHaveBeenCalledWith('testuser1', 'NewPass1!');
    });

    it('should delete reset token after successful reset', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      await handler(event);

      expect(resetTokenStore.deleteResetToken).toHaveBeenCalledWith('token-abc');
    });

    it('should look up user by ID from token', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      await handler(event);

      expect(userLookup.findById).toHaveBeenCalledWith('user-456');
    });
  });

  describe('invalid reset token', () => {
    it('should return 400 when token does not exist', async () => {
      (resetTokenStore.getResetToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const event = createMockEvent({ resetToken: 'nonexistent', newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired reset token');
    });

    it('should return 400 when token is expired', async () => {
      (resetTokenStore.getResetToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createValidResetToken(),
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });

      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired reset token');
    });

    it('should delete expired token on access', async () => {
      (resetTokenStore.getResetToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...createValidResetToken(),
        expiresAt: new Date(Date.now() - 1000),
      });

      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      await handler(event);

      expect(resetTokenStore.deleteResetToken).toHaveBeenCalledWith('token-abc');
    });
  });

  describe('password complexity validation', () => {
    it('should reject password shorter than 8 characters', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'Ab1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PASSWORD');
      expect(body.message).toContain('between 8 and 20');
    });

    it('should reject password longer than 20 characters', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'Abcdefgh1!Abcdefgh1!X' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_PASSWORD');
    });

    it('should reject password without uppercase', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'abcdefg1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('uppercase');
    });

    it('should reject password without lowercase', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'ABCDEFG1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('lowercase');
    });

    it('should reject password without number', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'Abcdefgh!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('number');
    });

    it('should reject password without special character', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'Abcdefg12' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('special');
    });

    it('should accept password meeting all complexity rules', async () => {
      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'ValidP@ss1' });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('user not found', () => {
    it('should return 400 when user ID from token does not resolve', async () => {
      (userLookup.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe('Invalid or expired reset token');
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

    it('should return 400 when resetToken is missing', async () => {
      const event = createMockEvent({ newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when newPassword is missing', async () => {
      const event = createMockEvent({ resetToken: 'token-abc' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('internal error handling', () => {
    it('should return 500 when reset token store throws', async () => {
      (resetTokenStore.getResetToken as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Store unavailable'),
      );

      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should return 500 when Cognito setPassword throws', async () => {
      (cognitoClient.setPassword as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cognito unavailable'),
      );

      const event = createMockEvent({ resetToken: 'token-abc', newPassword: 'NewPass1!' });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });
  });
});
