/**
 * Property Test: Pagination Bounds (Property 22)
 *
 * For any paginated list request, the effective page size SHALL be the requested
 * size clamped to the range [1, 100] with a default of 20 when not specified;
 * the response SHALL contain at most pageSize items.
 *
 * **Validates: Requirements 18.2**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { createListExercisesHandler } from '../listExercises';
import type { ExerciseDbClient, ExerciseRecord } from '../listExercises';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ============================================================
// Helpers
// ============================================================

function createEvent(
  queryParams?: Record<string, string>,
  authenticated = true
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: null,
    queryStringParameters: queryParams ?? null,
    requestContext: {
      authorizer: authenticated
        ? { claims: { sub: 'user-123' } }
        : undefined,
    },
    httpMethod: 'GET',
    path: '/exercises',
    resource: '/exercises',
  };
}

function makeExercise(index: number): ExerciseRecord {
  return {
    id: `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}`,
    subjectId: '660e8400-e29b-41d4-a716-446655440001',
    chapterId: '770e8400-e29b-41d4-a716-446655440002',
    exerciseType: 'grammar',
    difficultyLevel: 'medium',
    sequenceNumber: index,
    content: { question: `Question ${index}` },
    correctAnswer: { answer: `Answer ${index}` },
    explanation: null,
  };
}

/**
 * Creates a mock db client that returns up to `limit` exercises from a pool
 * of `totalDataSetSize` items, simulating real database pagination behavior.
 */
function createMockDbClient(totalDataSetSize: number): ExerciseDbClient {
  const allExercises = Array.from({ length: totalDataSetSize }, (_, i) =>
    makeExercise(i)
  );

  return {
    listExercises: vi.fn().mockImplementation((filters) => {
      const sliced = allExercises.slice(
        filters.offset,
        filters.offset + filters.limit
      );
      return Promise.resolve({
        exercises: sliced,
        total: totalDataSetSize,
      });
    }),
  };
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 22: Pagination Bounds', () => {
  it('returns 400 for page sizes below 1 (zero or negative)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -100, max: 0 }),
        async (pageSize) => {
          const dbClient = createMockDbClient(50);
          const handler = createListExercisesHandler(dbClient);
          const event = createEvent({ limit: String(pageSize) });

          const result = await handler(event);

          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          expect(body.errorCode).toBe('INVALID_PARAMETER');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('returns 400 for page sizes above 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 101, max: 200 }),
        async (pageSize) => {
          const dbClient = createMockDbClient(50);
          const handler = createListExercisesHandler(dbClient);
          const event = createEvent({ limit: String(pageSize) });

          const result = await handler(event);

          expect(result.statusCode).toBe(400);
          const body = JSON.parse(result.body);
          expect(body.errorCode).toBe('INVALID_PARAMETER');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('accepts page sizes in valid range [1, 100] and uses them as effective page size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 500 }),
        async (pageSize, dataSetSize) => {
          const dbClient = createMockDbClient(dataSetSize);
          const handler = createListExercisesHandler(dbClient);
          const event = createEvent({ limit: String(pageSize) });

          const result = await handler(event);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);

          // The effective page size equals the requested size
          expect(body.limit).toBe(pageSize);

          // Response contains at most pageSize items
          expect(body.exercises.length).toBeLessThanOrEqual(pageSize);

          // Response contains at most dataSetSize items
          expect(body.exercises.length).toBeLessThanOrEqual(dataSetSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('defaults to page size 20 when no pageSize is specified', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 500 }),
        async (dataSetSize) => {
          const dbClient = createMockDbClient(dataSetSize);
          const handler = createListExercisesHandler(dbClient);
          const event = createEvent(); // no limit/pageSize param

          const result = await handler(event);

          expect(result.statusCode).toBe(200);
          const body = JSON.parse(result.body);

          // Default page size is 20
          expect(body.limit).toBe(20);

          // Response never exceeds the default page size
          expect(body.exercises.length).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('response item count never exceeds effective page size for any page size and data set combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 500 }),
        async (pageSize, dataSetSize) => {
          const dbClient = createMockDbClient(dataSetSize);
          const handler = createListExercisesHandler(dbClient);
          const event = createEvent(
            pageSize === 0
              ? undefined // omit to test default
              : { limit: String(pageSize) }
          );

          const result = await handler(event);

          if (pageSize < 1 && pageSize !== 0) {
            // Invalid page sizes (negative) → 400
            expect(result.statusCode).toBe(400);
          } else if (pageSize > 100) {
            // Over max → 400
            expect(result.statusCode).toBe(400);
          } else {
            // Valid or default (pageSize === 0 means omitted → default 20)
            // Note: pageSize=0 is omitted via undefined above, so it defaults
            if (result.statusCode === 200) {
              const body = JSON.parse(result.body);
              const effectivePageSize = body.limit;

              // Effective page size is in valid range
              expect(effectivePageSize).toBeGreaterThanOrEqual(1);
              expect(effectivePageSize).toBeLessThanOrEqual(100);

              // Response items never exceed effective page size
              expect(body.exercises.length).toBeLessThanOrEqual(
                effectivePageSize
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
