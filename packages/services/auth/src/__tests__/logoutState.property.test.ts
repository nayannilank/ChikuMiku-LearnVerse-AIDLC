/**
 * Property Test: Logout State Round-Trip
 *
 * **Property 5: Logout State Round-Trip**
 * For any valid user state (progress percentages, streak, last viewed chapter/page,
 * pending exercise results), the state passed to the logout handler SHALL be
 * persisted identically via saveUserState — i.e., the round-trip is lossless.
 *
 * **Validates: Requirements 1.41, 1.42, 1.43**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';
import {
  createLogoutHandler,
  type StatePersistenceClient,
  type CognitoSessionClient,
  type UserState,
} from '../handlers/logout';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generates a random UUID v4 string */
const uuidArb = fc.uuid();

/** Generates a random subject key (e.g., "maths", "science-101", "custom_subject") */
const subjectKeyArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 30 },
);

/** Generates a random progress percentage between 0 and 100 */
const progressPercentageArb = fc.integer({ min: 0, max: 100 });

/** Generates a random progressPercentages record */
const progressPercentagesArb = fc.dictionary(subjectKeyArb, progressPercentageArb, {
  minKeys: 0,
  maxKeys: 10,
});

/** Generates a random non-negative integer for streak */
const currentStreakArb = fc.nat({ max: 1000 });

/** Generates lastViewedChapterId: random UUID or null */
const lastViewedChapterIdArb = fc.oneof(uuidArb, fc.constant(null));

/** Generates lastViewedPageNumber: random positive integer or null */
const lastViewedPageNumberArb = fc.oneof(
  fc.integer({ min: 1, max: 500 }),
  fc.constant(null),
);

/** Generates an ISO date string for answeredAt */
const isoDateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(
  (d) => d.toISOString(),
);

/** Generates a single pending exercise result */
const pendingExerciseResultArb = fc.record({
  exerciseId: uuidArb,
  isCorrect: fc.boolean(),
  score: fc.integer({ min: 0, max: 100 }),
  answeredAt: isoDateArb,
});

/** Generates the pendingExerciseResults array */
const pendingExerciseResultsArb = fc.array(pendingExerciseResultArb, {
  minLength: 0,
  maxLength: 20,
});

/** Generates a complete random UserState */
const userStateArb: fc.Arbitrary<UserState> = fc.record({
  progressPercentages: progressPercentagesArb,
  currentStreak: currentStreakArb,
  lastViewedChapterId: lastViewedChapterIdArb,
  lastViewedPageNumber: lastViewedPageNumberArb,
  pendingExerciseResults: pendingExerciseResultsArb,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock StatePersistenceClient that captures what was saved */
function createCapturingPersistenceClient(): {
  client: StatePersistenceClient;
  getCaptured: () => { userId: string; state: UserState } | null;
} {
  let captured: { userId: string; state: UserState } | null = null;

  const client: StatePersistenceClient = {
    saveUserState: async (userId: string, state: UserState) => {
      captured = { userId, state };
    },
  };

  return { client, getCaptured: () => captured };
}

/** Creates a mock CognitoSessionClient that always succeeds */
function createMockCognitoSessionClient(): CognitoSessionClient {
  return {
    globalSignOut: async () => {},
  };
}

/** Builds a minimal API Gateway event for the logout endpoint */
function buildLogoutEvent(state: UserState, userId: string): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ state }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer mock-access-token-${userId}`,
    },
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: {
          sub: userId,
        },
      },
    },
    httpMethod: 'POST',
    path: '/auth/logout',
    resource: '/auth/logout',
  } as unknown as APIGatewayProxyEvent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 5: Logout State Round-Trip', () => {
  it('state passed to logout handler is persisted identically (round-trip lossless)', async () => {
    await fc.assert(
      fc.asyncProperty(userStateArb, uuidArb, async (state, userId) => {
        const { client, getCaptured } = createCapturingPersistenceClient();
        const cognitoClient = createMockCognitoSessionClient();
        const handler = createLogoutHandler(client, cognitoClient);

        const event = buildLogoutEvent(state, userId);
        const result = await handler(event);

        // Verify handler succeeded
        expect(result.statusCode).toBe(200);

        // Verify state was persisted
        const captured = getCaptured();
        expect(captured).not.toBeNull();

        // Verify userId matches
        expect(captured!.userId).toBe(userId);

        // Verify state round-trip: persisted state is identical to input state
        expect(captured!.state).toEqual(state);
      }),
      { numRuns: 200 },
    );
  });

  it('for any valid state, logout handler returns 200 with statePersisted: true', async () => {
    await fc.assert(
      fc.asyncProperty(userStateArb, uuidArb, async (state, userId) => {
        const { client } = createCapturingPersistenceClient();
        const cognitoClient = createMockCognitoSessionClient();
        const handler = createLogoutHandler(client, cognitoClient);

        const event = buildLogoutEvent(state, userId);
        const result = await handler(event);

        expect(result.statusCode).toBe(200);

        const body = JSON.parse(result.body);
        expect(body.statePersisted).toBe(true);
        expect(body.message).toBe('Logged out successfully');
      }),
      { numRuns: 200 },
    );
  });

  it('progress percentages survive round-trip regardless of number of subjects', async () => {
    await fc.assert(
      fc.asyncProperty(
        progressPercentagesArb,
        currentStreakArb,
        uuidArb,
        async (progressPercentages, streak, userId) => {
          const state: UserState = {
            progressPercentages,
            currentStreak: streak,
            lastViewedChapterId: null,
            lastViewedPageNumber: null,
            pendingExerciseResults: [],
          };

          const { client, getCaptured } = createCapturingPersistenceClient();
          const cognitoClient = createMockCognitoSessionClient();
          const handler = createLogoutHandler(client, cognitoClient);

          const event = buildLogoutEvent(state, userId);
          const result = await handler(event);

          expect(result.statusCode).toBe(200);

          const captured = getCaptured();
          expect(captured).not.toBeNull();
          expect(captured!.state.progressPercentages).toEqual(progressPercentages);
          expect(captured!.state.currentStreak).toBe(streak);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('pending exercise results array is preserved in full with all fields', async () => {
    await fc.assert(
      fc.asyncProperty(pendingExerciseResultsArb, uuidArb, async (exerciseResults, userId) => {
        const state: UserState = {
          progressPercentages: {},
          currentStreak: 0,
          lastViewedChapterId: null,
          lastViewedPageNumber: null,
          pendingExerciseResults: exerciseResults,
        };

        const { client, getCaptured } = createCapturingPersistenceClient();
        const cognitoClient = createMockCognitoSessionClient();
        const handler = createLogoutHandler(client, cognitoClient);

        const event = buildLogoutEvent(state, userId);
        const result = await handler(event);

        expect(result.statusCode).toBe(200);

        const captured = getCaptured();
        expect(captured).not.toBeNull();
        expect(captured!.state.pendingExerciseResults).toEqual(exerciseResults);
        expect(captured!.state.pendingExerciseResults.length).toBe(exerciseResults.length);
      }),
      { numRuns: 200 },
    );
  });
});
