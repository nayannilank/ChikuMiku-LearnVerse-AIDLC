/**
 * Unit tests for the editLearnerSubjects Lambda handler.
 *
 * Tests authentication enforcement, ownership validation, minimum subject
 * constraint, successful update, and error handling scenarios.
 *
 * Requirements: 22.4, 22.6, 22.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createEditLearnerSubjectsHandler,
  type EditLearnerSubjectsDbClient,
  type EditLearnerSubjectsSuccessResponse,
  type EditLearnerSubjectsErrorResponse,
} from './editLearnerSubjects';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(
  parentId: string | undefined,
  learnerId: string | undefined,
  body: unknown,
): APIGatewayProxyEvent {
  return {
    body: body === null ? null : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' },
    pathParameters: learnerId ? { id: learnerId } : null,
    queryStringParameters: null,
    requestContext: {
      authorizer: parentId
        ? { claims: { sub: parentId } }
        : undefined,
      requestId: 'test-request-id',
    },
    httpMethod: 'PUT',
    path: `/parent/learners/${learnerId}/subjects`,
    resource: '/parent/learners/{id}/subjects',
  };
}

function createMockDbClient(): EditLearnerSubjectsDbClient {
  return {
    getLearnerById: vi.fn().mockResolvedValue({
      id: 'learner-1',
      parentId: 'parent-123',
      name: 'Alice',
      grade: 'Third',
    }),
    updateLearnerSubjects: vi.fn().mockResolvedValue([
      { id: 'sub-1', name: 'Maths', color: '#FF5733' },
      { id: 'sub-2', name: 'English', color: '#33FF57' },
    ]),
  };
}

// ============================================================
// Tests
// ============================================================

describe('editLearnerSubjects handler', () => {
  let dbClient: EditLearnerSubjectsDbClient;
  let handler: ReturnType<typeof createEditLearnerSubjectsHandler>;

  beforeEach(() => {
    dbClient = createMockDbClient();
    handler = createEditLearnerSubjectsHandler(dbClient);
  });

  describe('successful update', () => {
    it('should return 200 with updated subjects for valid request', async () => {
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: ['sub-1', 'sub-2'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body: EditLearnerSubjectsSuccessResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.subjects).toHaveLength(2);
      expect(body.subjects[0]).toEqual({ id: 'sub-1', name: 'Maths', color: '#FF5733' });
    });

    it('should call updateLearnerSubjects with correct parameters', async () => {
      const subjectIds = ['sub-1', 'sub-3', 'sub-5'];
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds });
      await handler(event);

      expect(dbClient.updateLearnerSubjects).toHaveBeenCalledWith('learner-1', subjectIds);
    });

    it('should allow updating with a single subject', async () => {
      (dbClient.updateLearnerSubjects as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sub-1', name: 'Maths', color: '#FF5733' },
      ]);

      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body: EditLearnerSubjectsSuccessResponse = JSON.parse(result.body);
      expect(body.subjects).toHaveLength(1);
    });
  });

  describe('authentication (401)', () => {
    it('should return 401 when no authorizer claims are present', async () => {
      const event = createMockEvent(undefined, 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
      expect(body.message).toBe('Authentication required');
    });

    it('should return 401 when claims.sub is missing', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({ subjectIds: ['sub-1'] }),
        headers: {},
        pathParameters: { id: 'learner-1' },
        queryStringParameters: null,
        requestContext: {
          authorizer: { claims: {} },
          requestId: 'test-request-id',
        },
        httpMethod: 'PUT',
        path: '/parent/learners/learner-1/subjects',
        resource: '/parent/learners/{id}/subjects',
      };
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('ownership validation (403)', () => {
    it('should return 403 when parent does not own the learner', async () => {
      const event = createMockEvent('parent-other', 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(403);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('FORBIDDEN');
      expect(body.message).toBe('You do not have permission to modify this learner');
    });
  });

  describe('learner not found (404)', () => {
    it('should return 404 when learner does not exist', async () => {
      (dbClient.getLearnerById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const event = createMockEvent('parent-123', 'nonexistent-learner', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('LEARNER_NOT_FOUND');
      expect(body.message).toBe('Learner not found');
    });
  });

  describe('minimum subject constraint (400)', () => {
    it('should return 400 when subjectIds is empty array', async () => {
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: [] });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('MIN_SUBJECTS_REQUIRED');
      expect(body.message).toBe('At least one subject must be assigned');
    });
  });

  describe('request body validation (400)', () => {
    it('should return 400 when body is null', async () => {
      const event = createMockEvent('parent-123', 'learner-1', null);
      event.body = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_REQUEST');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent('parent-123', 'learner-1', {});
      event.body = 'not json';
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_JSON');
    });

    it('should return 400 when subjectIds is not an array', async () => {
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: 'sub-1' });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_SUBJECT_IDS');
    });

    it('should return 400 when subjectIds contains empty strings', async () => {
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: ['sub-1', ''] });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_SUBJECT_IDS');
    });

    it('should return 400 when subjectIds contains non-string values', async () => {
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: [123, 'sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INVALID_SUBJECT_IDS');
    });

    it('should return 400 when learner ID is missing from path', async () => {
      const event = createMockEvent('parent-123', undefined, { subjectIds: ['sub-1'] });
      event.pathParameters = null;
      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('MISSING_LEARNER_ID');
    });
  });

  describe('internal error handling (500)', () => {
    it('should return 500 when getLearnerById throws an error', async () => {
      (dbClient.getLearnerById as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
    });

    it('should return 500 when updateLearnerSubjects throws an error', async () => {
      (dbClient.updateLearnerSubjects as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Update failed'),
      );

      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers on success', async () => {
      const event = createMockEvent('parent-123', 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('should include CORS headers on error', async () => {
      const event = createMockEvent(undefined, 'learner-1', { subjectIds: ['sub-1'] });
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
