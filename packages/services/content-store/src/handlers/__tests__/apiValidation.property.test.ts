/**
 * Property-Based Test: API Request Validation and Filtering
 *
 * **Validates: Requirements 18.4, 18.6, 18.7**
 *
 * Property 23: API Request Validation and Filtering
 * - For any API request with missing or invalid required fields, the response SHALL be HTTP 400
 *   with an error identifying the invalid fields.
 * - For any filter combination applied to exercises, all returned results SHALL match every
 *   specified filter criterion.
 * - For any filter matching zero results, the response SHALL be HTTP 200 with an empty list.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { createListExercisesHandler } from '../listExercises';
import { createCreateExerciseHandler } from '../createExercise';
import type { ExerciseDbClient, ExerciseRecord } from '../listExercises';
import type { CreateExerciseDbClient } from '../createExercise';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Constants
// ============================================================

const VALID_EXERCISE_TYPES = [
  'pronunciation',
  'grammar',
  'quiz',
  'maths',
  'code',
  'evs',
  'fill_blank',
  'match',
  'true_false',
  'short_answer',
] as const;

const VALID_DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

type ExerciseType = (typeof VALID_EXERCISE_TYPES)[number];
type DifficultyLevel = (typeof VALID_DIFFICULTY_LEVELS)[number];

// ============================================================
// Generators
// ============================================================

const uuidArb = fc.uuid();

const exerciseTypeArb = fc.constantFrom(...VALID_EXERCISE_TYPES);
const difficultyLevelArb = fc.constantFrom(...VALID_DIFFICULTY_LEVELS);

const invalidExerciseTypeArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !(VALID_EXERCISE_TYPES as readonly string[]).includes(s));

const invalidDifficultyLevelArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => !(VALID_DIFFICULTY_LEVELS as readonly string[]).includes(s));

const nonUuidStringArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter(
    (s) =>
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );

const positiveIntArb = fc.integer({ min: 1, max: 1000 });

const invalidSequenceNumberArb = fc.oneof(
  fc.integer({ min: -1000, max: 0 }),
  fc.double({ min: 0.1, max: 100, noNaN: true }).filter((n) => !Number.isInteger(n))
);

// ============================================================
// Helpers
// ============================================================

function createAuthenticatedEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: body !== null ? JSON.stringify(body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: { claims: { sub: 'test-user-123' } },
    },
    httpMethod: 'POST',
    path: '/exercises',
    resource: '/exercises',
  };
}

function createListEvent(
  queryParams?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: queryParams ?? null,
    requestContext: {
      authorizer: { claims: { sub: 'test-user-123' } },
    },
    httpMethod: 'GET',
    path: '/exercises',
    resource: '/exercises',
  };
}

function makeExerciseRecord(overrides: Partial<ExerciseRecord> = {}): ExerciseRecord {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    subjectId: '660e8400-e29b-41d4-a716-446655440001',
    chapterId: '770e8400-e29b-41d4-a716-446655440002',
    exerciseType: 'grammar',
    difficultyLevel: 'medium',
    sequenceNumber: 1,
    content: { question: 'test' },
    correctAnswer: { answer: 'test' },
    explanation: null,
    ...overrides,
  };
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 23: API Request Validation and Filtering', () => {
  describe('Validation property: missing/invalid fields return 400', () => {
    it('rejects payloads with missing subjectId', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      return fc.assert(
        fc.asyncProperty(
          exerciseTypeArb,
          difficultyLevelArb,
          positiveIntArb,
          async (exerciseType, difficultyLevel, sequenceNumber) => {
            const payload = {
              // subjectId intentionally missing
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content: { q: 'test' },
              correctAnswer: { a: 'test' },
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('subjectId');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('rejects payloads with invalid subjectId (non-UUID)', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      return fc.assert(
        fc.asyncProperty(
          nonUuidStringArb,
          exerciseTypeArb,
          difficultyLevelArb,
          positiveIntArb,
          async (subjectId, exerciseType, difficultyLevel, sequenceNumber) => {
            const payload = {
              subjectId,
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content: { q: 'test' },
              correctAnswer: { a: 'test' },
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('subjectId');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('rejects payloads with invalid exerciseType', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      return fc.assert(
        fc.asyncProperty(
          uuidArb,
          invalidExerciseTypeArb,
          difficultyLevelArb,
          positiveIntArb,
          async (subjectId, exerciseType, difficultyLevel, sequenceNumber) => {
            const payload = {
              subjectId,
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content: { q: 'test' },
              correctAnswer: { a: 'test' },
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('exerciseType');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('rejects payloads with invalid difficultyLevel', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      return fc.assert(
        fc.asyncProperty(
          uuidArb,
          exerciseTypeArb,
          invalidDifficultyLevelArb,
          positiveIntArb,
          async (subjectId, exerciseType, difficultyLevel, sequenceNumber) => {
            const payload = {
              subjectId,
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content: { q: 'test' },
              correctAnswer: { a: 'test' },
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('difficultyLevel');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('rejects payloads with invalid sequenceNumber (non-positive or non-integer)', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      return fc.assert(
        fc.asyncProperty(
          uuidArb,
          exerciseTypeArb,
          difficultyLevelArb,
          invalidSequenceNumberArb,
          async (subjectId, exerciseType, difficultyLevel, sequenceNumber) => {
            const payload = {
              subjectId,
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content: { q: 'test' },
              correctAnswer: { a: 'test' },
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('sequenceNumber');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('rejects payloads with content as non-object', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      const nonObjectArb = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.array(fc.integer())
      );

      return fc.assert(
        fc.asyncProperty(
          uuidArb,
          exerciseTypeArb,
          difficultyLevelArb,
          positiveIntArb,
          nonObjectArb,
          async (subjectId, exerciseType, difficultyLevel, sequenceNumber, content) => {
            const payload = {
              subjectId,
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content,
              correctAnswer: { a: 'test' },
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('content');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('rejects payloads with correctAnswer as non-object', () => {
      const dbClient: CreateExerciseDbClient = {
        createExercise: vi.fn().mockResolvedValue(makeExerciseRecord()),
      };
      const handler = createCreateExerciseHandler(dbClient);

      const nonObjectArb = fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.array(fc.integer())
      );

      return fc.assert(
        fc.asyncProperty(
          uuidArb,
          exerciseTypeArb,
          difficultyLevelArb,
          positiveIntArb,
          nonObjectArb,
          async (subjectId, exerciseType, difficultyLevel, sequenceNumber, correctAnswer) => {
            const payload = {
              subjectId,
              exerciseType,
              difficultyLevel,
              sequenceNumber,
              content: { q: 'test' },
              correctAnswer,
            };

            const result = await handler(createAuthenticatedEvent(payload));
            expect(result.statusCode).toBe(400);

            const body = JSON.parse(result.body);
            expect(body.errorCode).toBe('VALIDATION_ERROR');
            const fields = body.errors.map((e: { field: string }) => e.field);
            expect(fields).toContain('correctAnswer');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Filter consistency property: returned exercises match all filters', () => {
    it('passes all requested filters to the dbClient and returns matching results', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            subjectId: fc.option(uuidArb, { nil: undefined }),
            chapterId: fc.option(uuidArb, { nil: undefined }),
            exerciseType: fc.option(exerciseTypeArb, { nil: undefined }),
            difficultyLevel: fc.option(difficultyLevelArb, { nil: undefined }),
          }),
          async (filters) => {
            // Build query params from the generated filter combination
            const queryParams: Record<string, string> = {};
            if (filters.subjectId) queryParams.subjectId = filters.subjectId;
            if (filters.chapterId) queryParams.chapterId = filters.chapterId;
            if (filters.exerciseType) queryParams.exerciseType = filters.exerciseType;
            if (filters.difficultyLevel) queryParams.difficultyLevel = filters.difficultyLevel;

            // Create exercises that match all the provided filters
            const matchingExercise = makeExerciseRecord({
              subjectId: filters.subjectId ?? '660e8400-e29b-41d4-a716-446655440001',
              chapterId: filters.chapterId ?? '770e8400-e29b-41d4-a716-446655440002',
              exerciseType: filters.exerciseType ?? 'grammar',
              difficultyLevel: filters.difficultyLevel ?? 'medium',
            });

            // Track what filters were received by the dbClient
            let receivedFilters: Record<string, unknown> | null = null;

            const dbClient: ExerciseDbClient = {
              listExercises: vi.fn().mockImplementation((f) => {
                receivedFilters = f;
                return Promise.resolve({
                  exercises: [matchingExercise],
                  total: 1,
                });
              }),
            };

            const handler = createListExercisesHandler(dbClient);
            const result = await handler(createListEvent(queryParams));

            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);

            // Verify that filters were passed to the dbClient
            if (filters.subjectId) {
              expect(receivedFilters).toHaveProperty('subjectId', filters.subjectId);
            }
            if (filters.chapterId) {
              expect(receivedFilters).toHaveProperty('chapterId', filters.chapterId);
            }
            if (filters.exerciseType) {
              expect(receivedFilters).toHaveProperty('exerciseType', filters.exerciseType);
            }
            if (filters.difficultyLevel) {
              expect(receivedFilters).toHaveProperty('difficultyLevel', filters.difficultyLevel);
            }

            // Verify all returned exercises match the requested filters
            for (const exercise of body.exercises) {
              if (filters.subjectId) {
                expect(exercise.subjectId).toBe(filters.subjectId);
              }
              if (filters.chapterId) {
                expect(exercise.chapterId).toBe(filters.chapterId);
              }
              if (filters.exerciseType) {
                expect(exercise.exerciseType).toBe(filters.exerciseType);
              }
              if (filters.difficultyLevel) {
                expect(exercise.difficultyLevel).toBe(filters.difficultyLevel);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Zero-match filter property: empty result returns 200 with empty list', () => {
    it('returns 200 with empty exercises array and total=0 when no exercises match', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            subjectId: fc.option(uuidArb, { nil: undefined }),
            chapterId: fc.option(uuidArb, { nil: undefined }),
            exerciseType: fc.option(exerciseTypeArb, { nil: undefined }),
            difficultyLevel: fc.option(difficultyLevelArb, { nil: undefined }),
          }),
          async (filters) => {
            const queryParams: Record<string, string> = {};
            if (filters.subjectId) queryParams.subjectId = filters.subjectId;
            if (filters.chapterId) queryParams.chapterId = filters.chapterId;
            if (filters.exerciseType) queryParams.exerciseType = filters.exerciseType;
            if (filters.difficultyLevel) queryParams.difficultyLevel = filters.difficultyLevel;

            // Mock returns empty results for any filter combination
            const dbClient: ExerciseDbClient = {
              listExercises: vi.fn().mockResolvedValue({
                exercises: [],
                total: 0,
              }),
            };

            const handler = createListExercisesHandler(dbClient);
            const result = await handler(createListEvent(queryParams));

            expect(result.statusCode).toBe(200);

            const body = JSON.parse(result.body);
            expect(body.exercises).toEqual([]);
            expect(body.total).toBe(0);
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
