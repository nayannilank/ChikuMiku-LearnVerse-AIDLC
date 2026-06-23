/**
 * Property Tests: Progress Handlers — Get and Update learner progress
 *
 * Feature: backend-stub-implementations
 * - Property 23: Progress update round-trip
 * - Property 24: Completion percentage recalculation
 * - Property 25: Progress rejects invalid input
 * - Property 26: Weak activity identification
 *
 * **Validates: Requirements 11.1, 11.2, 12.1, 12.2, 12.3, 12.4**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  handleGetProgress,
  handleUpdateProgress,
  getProgressContentStore,
} from '../progressHandlers';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid activity types */
const VALID_ACTIVITY_TYPES = [
  'comprehension',
  'pronunciation',
  'grammar',
  'revision',
] as const;

const validActivityTypeArb = fc.constantFrom(...VALID_ACTIVITY_TYPES);

/** Valid score: integer 0-100 */
const validScoreArb = fc.integer({ min: 0, max: 100 });

/** Valid chapter ID */
const validChapterIdArb = fc.uuid();

/** Valid learner ID */
const validLearnerIdArb = fc.uuid();

/** Valid subject ID */
const validSubjectIdArb = fc.uuid();

// ─── Helper: Build ApiRequest objects ─────────────────────────────────────────

function makeUpdateProgressRequest(
  learnerId: string,
  body: unknown,
) {
  return {
    method: 'POST' as const,
    path: '/api/v1/progress',
    headers: {
      'Content-Type': 'application/json',
      'x-learner-id': learnerId,
    },
    body,
  };
}

function makeGetProgressRequest(learnerId: string) {
  return {
    method: 'GET' as const,
    path: '/api/v1/progress',
    headers: {
      'Content-Type': 'application/json',
      'x-learner-id': learnerId,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Feature: backend-stub-implementations, Property 23: Progress update round-trip
describe('Property 23: Progress update round-trip', () => {
  beforeEach(() => {
    // Clear the content store's progress records for test isolation
    const store = getProgressContentStore();
    // Reset by accessing internal state — the ContentStore uses an in-memory Map
    // We re-instantiate tracking by creating fresh progress data each test
    (store as unknown as { progressRecords: Map<string, unknown> }).progressRecords =
      new Map();
  });

  it('for any valid progress update, posting and then retrieving includes the updated activity score', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validChapterIdArb,
        validActivityTypeArb,
        validScoreArb,
        async (learnerId, chapterId, activityType, score) => {
          // Post a progress update
          const updateRes = await handleUpdateProgress(
            makeUpdateProgressRequest(learnerId, {
              chapterId,
              activityType,
              score,
            }),
          );

          expect(updateRes.status).toBe(200);

          // Retrieve progress
          const getRes = await handleGetProgress(makeGetProgressRequest(learnerId));

          expect(getRes.status).toBe(200);
          const body = getRes.body as {
            learnerId: string;
            chapters: Array<{
              chapterId: string;
              activityScores: Array<{
                activityType: string;
                score: number;
              }>;
            }>;
          };

          // Find the chapter entry
          const chapterEntry = body.chapters.find(
            (c) => c.chapterId === chapterId,
          );
          expect(chapterEntry).toBeDefined();

          // Find the activity score
          const activityScore = chapterEntry!.activityScores.find(
            (a) => a.activityType === activityType,
          );
          expect(activityScore).toBeDefined();
          expect(activityScore!.score).toBe(score);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 24: Completion percentage recalculation
describe('Property 24: Completion percentage recalculation', () => {
  beforeEach(() => {
    const store = getProgressContentStore();
    (store as unknown as { progressRecords: Map<string, unknown> }).progressRecords =
      new Map();
    // Reset subject language map too
    (store as unknown as { subjectLanguageMap: Map<string, boolean> }).subjectLanguageMap =
      new Map();
  });

  it('completion percentage equals round(M / N * 100) where M is recorded activities and N is applicable types', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validChapterIdArb,
        validSubjectIdArb,
        // Whether the subject is a language subject (determines N)
        fc.boolean(),
        // Which activities to record (subset of valid types)
        fc.subarray(
          ['comprehension', 'pronunciation', 'grammar', 'revision'] as const,
          { minLength: 1, maxLength: 4 },
        ),
        async (learnerId, chapterId, subjectId, isLanguage, activitiesToRecord) => {
          const store = getProgressContentStore();

          // Register subject type so applicable activities are determined
          store.registerSubjectType(subjectId, isLanguage);

          // Determine applicable activities for this subject
          const applicableActivities = isLanguage
            ? ['comprehension', 'pronunciation', 'grammar', 'revision']
            : ['comprehension', 'revision'];

          // Filter activities to record to only applicable ones
          const applicableRecorded = activitiesToRecord.filter((a) =>
            applicableActivities.includes(a),
          );

          // Post progress updates for each activity
          for (const activityType of activitiesToRecord) {
            await handleUpdateProgress(
              makeUpdateProgressRequest(learnerId, {
                chapterId,
                activityType,
                score: 75, // Any valid score
                subjectId,
              }),
            );
          }

          // Retrieve progress
          const getRes = await handleGetProgress(makeGetProgressRequest(learnerId));
          expect(getRes.status).toBe(200);

          const body = getRes.body as {
            chapters: Array<{
              chapterId: string;
              completionPercentage: number;
            }>;
          };

          const chapterEntry = body.chapters.find(
            (c) => c.chapterId === chapterId,
          );
          expect(chapterEntry).toBeDefined();

          // Expected completion: round(M / N * 100)
          const M = applicableRecorded.length;
          const N = applicableActivities.length;
          const expectedCompletion = Math.round((M / N) * 100);

          expect(chapterEntry!.completionPercentage).toBe(expectedCompletion);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 25: Progress rejects invalid input
describe('Property 25: Progress rejects invalid input', () => {
  beforeEach(() => {
    const store = getProgressContentStore();
    (store as unknown as { progressRecords: Map<string, unknown> }).progressRecords =
      new Map();
  });

  it('missing chapterId returns 400 with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validActivityTypeArb,
        validScoreArb,
        async (learnerId, activityType, score) => {
          const res = await handleUpdateProgress(
            makeUpdateProgressRequest(learnerId, {
              activityType,
              score,
            }),
          );

          expect(res.status).toBe(400);
          const body = res.body as {
            code: string;
            errors: Array<{ field: string; message: string }>;
          };
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.errors.some((e) => e.field === 'chapterId')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('missing activityType returns 400 with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validChapterIdArb,
        validScoreArb,
        async (learnerId, chapterId, score) => {
          const res = await handleUpdateProgress(
            makeUpdateProgressRequest(learnerId, {
              chapterId,
              score,
            }),
          );

          expect(res.status).toBe(400);
          const body = res.body as {
            code: string;
            errors: Array<{ field: string; message: string }>;
          };
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.errors.some((e) => e.field === 'activityType')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('missing score returns 400 with validation errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validChapterIdArb,
        validActivityTypeArb,
        async (learnerId, chapterId, activityType) => {
          const res = await handleUpdateProgress(
            makeUpdateProgressRequest(learnerId, {
              chapterId,
              activityType,
            }),
          );

          expect(res.status).toBe(400);
          const body = res.body as {
            code: string;
            errors: Array<{ field: string; message: string }>;
          };
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.errors.some((e) => e.field === 'score')).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all fields missing returns 400 with validation errors for each field', async () => {
    await fc.assert(
      fc.asyncProperty(validLearnerIdArb, async (learnerId) => {
        const res = await handleUpdateProgress(
          makeUpdateProgressRequest(learnerId, {}),
        );

        expect(res.status).toBe(400);
        const body = res.body as {
          code: string;
          errors: Array<{ field: string; message: string }>;
        };
        expect(body.code).toBe('VALIDATION_ERROR');
        expect(body.errors.some((e) => e.field === 'chapterId')).toBe(true);
        expect(body.errors.some((e) => e.field === 'activityType')).toBe(true);
        expect(body.errors.some((e) => e.field === 'score')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 26: Weak activity identification
describe('Property 26: Weak activity identification', () => {
  beforeEach(() => {
    const store = getProgressContentStore();
    (store as unknown as { progressRecords: Map<string, unknown> }).progressRecords =
      new Map();
  });

  it('activities with scores below 60 appear in weakActivities, scores >= 60 do not', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validChapterIdArb,
        // Generate a set of activity scores — at least one activity
        fc.array(
          fc.record({
            activityType: validActivityTypeArb,
            score: validScoreArb,
          }),
          { minLength: 1, maxLength: 4 },
        ),
        async (learnerId, chapterId, activities) => {
          // Deduplicate by activityType (keep last occurrence)
          const activityMap = new Map<string, number>();
          for (const act of activities) {
            activityMap.set(act.activityType, act.score);
          }

          // Post all progress updates
          for (const [activityType, score] of activityMap) {
            await handleUpdateProgress(
              makeUpdateProgressRequest(learnerId, {
                chapterId,
                activityType,
                score,
              }),
            );
          }

          // Retrieve progress
          const getRes = await handleGetProgress(makeGetProgressRequest(learnerId));
          expect(getRes.status).toBe(200);

          const body = getRes.body as {
            chapters: Array<{
              chapterId: string;
              weakActivities: string[];
              activityScores: Array<{
                activityType: string;
                score: number;
              }>;
            }>;
          };

          const chapterEntry = body.chapters.find(
            (c) => c.chapterId === chapterId,
          );
          expect(chapterEntry).toBeDefined();

          // Verify weak activity identification
          for (const [activityType, score] of activityMap) {
            if (score < 60) {
              expect(chapterEntry!.weakActivities).toContain(activityType);
            } else {
              expect(chapterEntry!.weakActivities).not.toContain(activityType);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
