/**
 * Property Test: Parent-Learner Association
 *
 * **Property 27: Parent-Learner Association**
 * For any parent with N registered students, the parent dashboard learner list
 * SHALL display exactly N entries; editing subjects for a learner SHALL enforce
 * a minimum of 1 subject remaining selected.
 *
 * **Validates: Requirements 22.2, 22.6, 22.7**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createGetParentLearnersHandler,
  type ParentLearnersDbClient,
  type LearnerWithSubjects,
  type GetParentLearnersSuccessResponse,
} from '../handlers/getParentLearners';
import {
  createEditLearnerSubjectsHandler,
  type EditLearnerSubjectsDbClient,
  type LearnerRecord,
  type SubjectRecord,
  type EditLearnerSubjectsSuccessResponse,
  type EditLearnerSubjectsErrorResponse,
} from '../handlers/editLearnerSubjects';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a random UUID-like parent ID */
const parentIdArb = fc.uuid();

/** Generates a random learner count (1-10) */
const learnerCountArb = fc.integer({ min: 1, max: 10 });

/** Generates a random UUID-like subject ID */
const subjectIdArb = fc.uuid();

/** Generates a random subject name (1-50 chars) */
const subjectNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('')),
  { minLength: 1, maxLength: 50 },
);

/** Generates a random hex color */
const colorArb = fc.hexaString({ minLength: 6, maxLength: 6 }).map((hex) => `#${hex}`);

/** Generates a random learner with subjects */
const learnerWithSubjectsArb = fc.record({
  id: fc.uuid(),
  name: fc.stringOf(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')),
    { minLength: 5, maxLength: 20 },
  ),
  grade: fc.constantFrom('LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth', 'Fifth',
    'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'),
  subjects: fc.array(
    fc.record({
      id: fc.uuid(),
      name: subjectNameArb,
      color: colorArb,
    }),
    { minLength: 1, maxLength: 7 },
  ),
});

/** Generates a non-empty array of subject IDs (valid for edit) */
const nonEmptySubjectIdsArb = fc.array(subjectIdArb, { minLength: 1, maxLength: 10 });

/** Generates an empty subject IDs array (invalid - should be rejected) */
const emptySubjectIdsArb = fc.constant([] as string[]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a GET /parent/learners API Gateway event */
function buildGetLearnersEvent(parentId: string): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: parentId },
      },
    },
    httpMethod: 'GET',
    path: '/parent/learners',
    resource: '/parent/learners',
  };
}

/** Builds a PUT /parent/learners/:id/subjects API Gateway event */
function buildEditSubjectsEvent(
  parentId: string,
  learnerId: string,
  subjectIds: string[],
): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ subjectIds }),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: { id: learnerId },
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: { sub: parentId },
      },
    },
    httpMethod: 'PUT',
    path: `/parent/learners/${learnerId}/subjects`,
    resource: '/parent/learners/{id}/subjects',
  };
}

/** Creates a mock DB client that returns exactly the given learners for a parent */
function createMockGetLearnersDbClient(learners: LearnerWithSubjects[]): ParentLearnersDbClient {
  return {
    getLearnersByParentId: async () => learners,
  };
}

/** Creates a mock DB client for editLearnerSubjects */
function createMockEditSubjectsDbClient(
  parentId: string,
  learnerId: string,
): EditLearnerSubjectsDbClient {
  return {
    getLearnerById: async (id: string): Promise<LearnerRecord | null> => {
      if (id === learnerId) {
        return { id: learnerId, parentId, name: 'Test Learner', grade: 'Fifth' };
      }
      return null;
    },
    updateLearnerSubjects: async (_id: string, subjectIds: string[]): Promise<SubjectRecord[]> => {
      return subjectIds.map((sid) => ({
        id: sid,
        name: `Subject-${sid.slice(0, 4)}`,
        color: '#5DADE2',
      }));
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 27: Parent-Learner Association', () => {
  it('learner list count ALWAYS matches number of registered students for a parent', async () => {
    await fc.assert(
      fc.asyncProperty(
        parentIdArb,
        learnerCountArb,
        async (parentId, count) => {
          // Generate exactly `count` learners
          const learners: LearnerWithSubjects[] = Array.from({ length: count }, (_, i) => ({
            id: `learner-${i}-${parentId.slice(0, 8)}`,
            name: `Learner ${i + 1}`,
            grade: 'Fifth',
            subjects: [{ id: `subject-${i}`, name: 'Maths', color: '#E94F9B' }],
          }));

          const dbClient = createMockGetLearnersDbClient(learners);
          const handler = createGetParentLearnersHandler(dbClient);
          const event = buildGetLearnersEvent(parentId);

          const result = await handler(event);
          expect(result.statusCode).toBe(200);

          const body: GetParentLearnersSuccessResponse = JSON.parse(result.body);
          expect(body.success).toBe(true);
          expect(body.learners).toHaveLength(count);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('learner list returns exact learner data from DB without modification', async () => {
    await fc.assert(
      fc.asyncProperty(
        parentIdArb,
        fc.array(learnerWithSubjectsArb, { minLength: 1, maxLength: 10 }),
        async (parentId, learners) => {
          const dbClient = createMockGetLearnersDbClient(learners);
          const handler = createGetParentLearnersHandler(dbClient);
          const event = buildGetLearnersEvent(parentId);

          const result = await handler(event);
          expect(result.statusCode).toBe(200);

          const body: GetParentLearnersSuccessResponse = JSON.parse(result.body);
          expect(body.success).toBe(true);
          expect(body.learners).toEqual(learners);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('editLearnerSubjects with empty subjectIds ALWAYS returns 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        parentIdArb,
        fc.uuid(),
        emptySubjectIdsArb,
        async (parentId, learnerId, subjectIds) => {
          const dbClient = createMockEditSubjectsDbClient(parentId, learnerId);
          const handler = createEditLearnerSubjectsHandler(dbClient);
          const event = buildEditSubjectsEvent(parentId, learnerId, subjectIds);

          const result = await handler(event);
          expect(result.statusCode).toBe(400);

          const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
          expect(body.success).toBe(false);
          expect(body.errorCode).toBe('MIN_SUBJECTS_REQUIRED');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('editLearnerSubjects with non-empty subjectIds (1+) ALWAYS returns 200', async () => {
    await fc.assert(
      fc.asyncProperty(
        parentIdArb,
        fc.uuid(),
        nonEmptySubjectIdsArb,
        async (parentId, learnerId, subjectIds) => {
          const dbClient = createMockEditSubjectsDbClient(parentId, learnerId);
          const handler = createEditLearnerSubjectsHandler(dbClient);
          const event = buildEditSubjectsEvent(parentId, learnerId, subjectIds);

          const result = await handler(event);
          expect(result.statusCode).toBe(200);

          const body: EditLearnerSubjectsSuccessResponse = JSON.parse(result.body);
          expect(body.success).toBe(true);
          expect(body.subjects).toHaveLength(subjectIds.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('min-1-subject enforcement: any randomly generated subject count of 0 is rejected, any count ≥1 is accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        parentIdArb,
        fc.uuid(),
        fc.array(subjectIdArb, { minLength: 0, maxLength: 10 }),
        async (parentId, learnerId, subjectIds) => {
          const dbClient = createMockEditSubjectsDbClient(parentId, learnerId);
          const handler = createEditLearnerSubjectsHandler(dbClient);
          const event = buildEditSubjectsEvent(parentId, learnerId, subjectIds);

          const result = await handler(event);

          if (subjectIds.length === 0) {
            // Must reject with 400 when empty
            expect(result.statusCode).toBe(400);
            const body: EditLearnerSubjectsErrorResponse = JSON.parse(result.body);
            expect(body.success).toBe(false);
            expect(body.errorCode).toBe('MIN_SUBJECTS_REQUIRED');
          } else {
            // Must accept with 200 when at least 1 subject
            expect(result.statusCode).toBe(200);
            const body: EditLearnerSubjectsSuccessResponse = JSON.parse(result.body);
            expect(body.success).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
