/**
 * Unit tests for the getParentLearners Lambda handler.
 *
 * Tests authentication enforcement, successful learner retrieval,
 * and error handling scenarios.
 *
 * Requirements: 22.2, 22.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createGetParentLearnersHandler,
  type ParentLearnersDbClient,
  type GetParentLearnersSuccessResponse,
  type GetParentLearnersErrorResponse,
} from './getParentLearners';

// ============================================================
// Test Helpers
// ============================================================

function createMockEvent(parentId?: string): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer mock-token' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: parentId
        ? { claims: { sub: parentId } }
        : undefined,
      requestId: 'test-request-id',
    },
    httpMethod: 'GET',
    path: '/parent/learners',
    resource: '/parent/learners',
  };
}

function createMockDbClient(): ParentLearnersDbClient {
  return {
    getLearnersByParentId: vi.fn().mockResolvedValue([
      {
        id: 'learner-1',
        name: 'Alice',
        grade: 'Third',
        subjects: [
          { id: 'sub-1', name: 'Maths', color: '#FF5733' },
          { id: 'sub-2', name: 'English', color: '#33FF57' },
        ],
      },
      {
        id: 'learner-2',
        name: 'Bob',
        grade: 'Fifth',
        subjects: [
          { id: 'sub-3', name: 'Science', color: '#3357FF' },
        ],
      },
    ]),
  };
}

// ============================================================
// Tests
// ============================================================

describe('getParentLearners handler', () => {
  let dbClient: ParentLearnersDbClient;
  let handler: ReturnType<typeof createGetParentLearnersHandler>;

  beforeEach(() => {
    dbClient = createMockDbClient();
    handler = createGetParentLearnersHandler(dbClient);
  });

  describe('successful retrieval', () => {
    it('should return 200 with list of learners for authenticated parent', async () => {
      const event = createMockEvent('parent-123');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body: GetParentLearnersSuccessResponse = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.learners).toHaveLength(2);
    });

    it('should return learners with id, name, grade, and subjects', async () => {
      const event = createMockEvent('parent-123');
      const result = await handler(event);

      const body: GetParentLearnersSuccessResponse = JSON.parse(result.body);
      const learner = body.learners[0];
      expect(learner.id).toBe('learner-1');
      expect(learner.name).toBe('Alice');
      expect(learner.grade).toBe('Third');
      expect(learner.subjects).toHaveLength(2);
      expect(learner.subjects[0]).toEqual({ id: 'sub-1', name: 'Maths', color: '#FF5733' });
    });

    it('should return empty array when parent has no learners', async () => {
      (dbClient.getLearnersByParentId as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const event = createMockEvent('parent-no-kids');
      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body: GetParentLearnersSuccessResponse = JSON.parse(result.body);
      expect(body.learners).toEqual([]);
    });

    it('should call getLearnersByParentId with the authenticated parentId', async () => {
      const event = createMockEvent('parent-456');
      await handler(event);

      expect(dbClient.getLearnersByParentId).toHaveBeenCalledWith('parent-456');
    });
  });

  describe('authentication (401)', () => {
    it('should return 401 when no authorizer claims are present', async () => {
      const event = createMockEvent(undefined);
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      const body: GetParentLearnersErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('UNAUTHORIZED');
      expect(body.message).toBe('Authentication required');
    });

    it('should return 401 when claims.sub is missing', async () => {
      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        pathParameters: null,
        queryStringParameters: null,
        requestContext: {
          authorizer: { claims: {} },
          requestId: 'test-request-id',
        },
        httpMethod: 'GET',
        path: '/parent/learners',
        resource: '/parent/learners',
      };
      const result = await handler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('internal error handling (500)', () => {
    it('should return 500 when DB client throws an error', async () => {
      (dbClient.getLearnersByParentId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed'),
      );

      const event = createMockEvent('parent-123');
      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body: GetParentLearnersErrorResponse = JSON.parse(result.body);
      expect(body.errorCode).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Something went wrong — please try again after some time');
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers on success', async () => {
      const event = createMockEvent('parent-123');
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('should include CORS headers on error', async () => {
      const event = createMockEvent(undefined);
      const result = await handler(event);

      expect(result.headers).toBeDefined();
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
