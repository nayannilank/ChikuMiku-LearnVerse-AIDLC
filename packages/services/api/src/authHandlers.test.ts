import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter, createDefaultRoutes, ApiRequest } from './endpoints';
import {
  clearLearnerStore,
  clearSessionStore,
  addLearnerToStore,
  hashPassword,
  registerParent,
  clearParentStudentStore,
} from '@learnverse/service-auth';
import { clearLockoutStore } from '@learnverse/service-auth';
import type { Learner } from '@learnverse/service-core';

describe('Auth API Handlers (Integration)', () => {
  let router: ApiRouter;

  function makeRequest(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): ApiRequest {
    return {
      method,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
    };
  }

  function createTestLearner(): Learner {
    return {
      id: 'learner-test-1',
      displayName: 'Test Learner',
      contactType: 'email',
      contactValue: 'test@example.com',
      passwordHash: hashPassword('ValidPass1!'),
      grade: 5,
      enrolledSubjects: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeEach(() => {
    clearLearnerStore();
    clearSessionStore();
    clearLockoutStore();
    clearParentStudentStore();
    router = new ApiRouter();
    for (const route of createDefaultRoutes()) {
      router.register(route);
    }
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return 400 when username is missing', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/login', { password: 'pass' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('MISSING_FIELDS');
    });

    it('should return 400 when password is missing', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/login', { username: 'user1' })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('MISSING_FIELDS');
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/login', {
          username: 'nonexistent',
          password: 'wrongpass',
        })
      );
      expect(res.status).toBe(401);
      expect((res.body as any).code).toBe('INVALID_USERNAME');
    });

    it('should return 200 with tokens on successful login', async () => {
      // Register a parent account via the registration flow
      registerParent({
        name: 'Test Parent',
        username: 'testparent',
        password: 'ValidPass1!',
        email: 'test@example.com',
        phoneNumber: '9876543210',
      });

      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/login', {
          username: 'testparent',
          password: 'ValidPass1!',
        })
      );
      expect(res.status).toBe(200);
      expect((res.body as any).token).toBeDefined();
      expect((res.body as any).token.length).toBeGreaterThan(0);
      expect((res.body as any).refreshToken).toBeDefined();
      expect((res.body as any).tokenType).toBe('Bearer');
      expect((res.body as any).expiresAt).toBeGreaterThan(Date.now());
      expect((res.body as any).username).toBe('testparent');
    });

    it('should return 429 when account is locked after 3 failed attempts', async () => {
      // Register a parent account
      registerParent({
        name: 'Test Parent',
        username: 'testparent',
        password: 'ValidPass1!',
        email: 'test@example.com',
        phoneNumber: '9876543210',
      });

      // 3 failed attempts to trigger lockout
      for (let i = 0; i < 3; i++) {
        await router.dispatch(
          makeRequest('POST', '/api/v1/auth/login', {
            username: 'testparent',
            password: 'WrongPass1!',
          })
        );
      }

      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/login', {
          username: 'testparent',
          password: 'ValidPass1!',
        })
      );
      expect(res.status).toBe(429);
      expect((res.body as any).code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('POST /api/v1/auth/register/parent', () => {
    it('should return 400 when body is missing', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/register/parent')
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('MISSING_BODY');
    });

    it('should return 400 with field-specific errors for invalid input', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/register/parent', {
          name: '',
          username: 'ab',
          phone: '123',
          email: 'not-an-email',
          password: 'short',
        })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      const errors = (res.body as any).errors;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e: any) => e.field === 'name')).toBe(true);
      expect(errors.some((e: any) => e.field === 'username')).toBe(true);
      expect(errors.some((e: any) => e.field === 'phone')).toBe(true);
    });

    it('should return 201 for valid parent registration', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/register/parent', {
          name: 'Parent Name',
          username: 'parent_01',
          phone: '9876543210',
          email: 'parent@example.com',
          password: 'StrongPass1!',
        })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).message).toContain('Parent account created');
      expect((res.body as any).username).toBe('parent_01');
    });
  });

  describe('POST /api/v1/auth/register/student', () => {
    it('should return 400 when body is missing', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/register/student')
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('MISSING_BODY');
    });

    it('should return 400 with field-specific errors for invalid input', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/register/student', {
          name: '',
          username: 'x',
          password: 'pw',
          grade: 0,
          parentUsername: 'ab',
        })
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('VALIDATION_ERROR');
      const errors = (res.body as any).errors;
      expect(errors.some((e: any) => e.field === 'name')).toBe(true);
      expect(errors.some((e: any) => e.field === 'username')).toBe(true);
      expect(errors.some((e: any) => e.field === 'password')).toBe(true);
      expect(errors.some((e: any) => e.field === 'grade')).toBe(true);
      expect(errors.some((e: any) => e.field === 'parentUsername')).toBe(true);
    });

    it('should return 201 for valid student registration', async () => {
      // Register the parent that the student will be linked to
      registerParent({
        name: 'Parent One',
        username: 'parent_01',
        password: 'ParentPass1!',
        email: 'parent01@example.com',
        phoneNumber: '9876543211',
      });

      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/register/student', {
          name: 'Student Name',
          username: 'student_01',
          password: 'StrongPass1!',
          grade: 5,
          parentUsername: 'parent_01',
        })
      );
      expect(res.status).toBe(201);
      expect((res.body as any).message).toContain('Student account created');
      expect((res.body as any).username).toBe('student_01');
      expect((res.body as any).tokenType).toBe('Bearer');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should return 400 when username is missing', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/forgot-password', {})
      );
      expect(res.status).toBe(400);
      expect((res.body as any).code).toBe('MISSING_FIELD');
    });

    it('should return 200 regardless of whether account exists', async () => {
      const res = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/forgot-password', {
          username: 'nonexistent_user',
        })
      );
      expect(res.status).toBe(200);
      expect((res.body as any).message).toContain('password reset');
    });
  });

  describe('GET /api/v1/auth/validate', () => {
    it('should return 401 when no authorization header', async () => {
      const res = await router.dispatch(
        makeRequest('GET', '/api/v1/auth/validate')
      );
      // The router-level auth check will catch this first since requiresAuth: true
      expect(res.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const res = await router.dispatch(
        makeRequest('GET', '/api/v1/auth/validate', undefined, {
          Authorization: 'Bearer invalid-token-that-does-not-exist',
        })
      );
      expect(res.status).toBe(401);
    });

    it('should return 200 with session info for valid token', async () => {
      // Register a parent account
      registerParent({
        name: 'Test Parent',
        username: 'testparent',
        password: 'ValidPass1!',
        email: 'test@example.com',
        phoneNumber: '9876543210',
      });

      // Login to get a valid token
      const loginRes = await router.dispatch(
        makeRequest('POST', '/api/v1/auth/login', {
          username: 'testparent',
          password: 'ValidPass1!',
        })
      );
      const token = (loginRes.body as any).token;

      const res = await router.dispatch(
        makeRequest('GET', '/api/v1/auth/validate', undefined, {
          Authorization: `Bearer ${token}`,
        })
      );
      expect(res.status).toBe(200);
      expect((res.body as any).valid).toBe(true);
      expect((res.body as any).learnerId).toBeDefined();
      expect((res.body as any).expiresAt).toBeGreaterThan(Date.now());
    });
  });
});
