/**
 * Property Tests: Sync Handlers — Push queued actions, pull remote changes.
 *
 * Feature: backend-stub-implementations
 * - Property 33: Sync push categorizes all items exclusively
 * - Property 34: Sync conflict resolution — most-recent-wins
 * - Property 35: Sync pull filters by timestamp
 * - Property 36: Sync pull change objects have required fields
 *
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4, 17.1, 17.3**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  handleSyncPush,
  handleSyncPull,
  addChangeLogEntry,
  clearSyncState,
} from '../syncHandlers';
import type { ChangeLogEntry } from '../syncHandlers';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Valid action ID (UUID-like) */
const validActionIdArb = fc.uuid();

/** Valid action type */
const validActionTypeArb = fc.constantFrom(
  'save_answer' as const,
  'mark_progress' as const,
  'save_chapter' as const,
  'update_score' as const,
);

/** Valid learner ID */
const validLearnerIdArb = fc.uuid();

/** Valid resource ID */
const validResourceIdArb = fc.uuid();

/** Valid timestamp within the past 30 days */
const validTimestampArb = fc.date({
  min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  max: new Date(),
});

/** Valid payload containing an id field so extractResourceId works correctly */
function validPayloadArb(resourceId: string) {
  return fc.constant({ id: resourceId });
}

/** Valid change type for pull entries */
const validChangeTypeArb = fc.constantFrom(
  'create' as const,
  'update' as const,
  'delete' as const,
);

/** Valid resource type (non-empty string) */
const validResourceTypeArb = fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 });

// ─── Helper: Build ApiRequest objects ─────────────────────────────────────────

function makeSyncPushRequest(
  learnerId: string,
  actions: Array<{
    id: string;
    action: string;
    payload: unknown;
    createdAt: string;
    order: number;
  }>,
) {
  return {
    method: 'POST' as const,
    path: '/api/v1/sync/push',
    headers: {
      'Content-Type': 'application/json',
      'x-learner-id': learnerId,
    },
    body: { actions },
  };
}

function makeSyncPullRequest(learnerId: string, since?: string) {
  return {
    method: 'GET' as const,
    path: '/api/v1/sync/pull',
    headers: {
      'Content-Type': 'application/json',
      'x-learner-id': learnerId,
    },
    queryParams: since ? { since } : undefined,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Feature: backend-stub-implementations, Property 33: Sync push categorizes all items exclusively
describe('Property 33: Sync push categorizes all items exclusively', () => {
  beforeEach(() => {
    clearSyncState();
  });

  it('for any set of queued actions pushed, every action ID appears in exactly one of synced, conflicts, or failed', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        fc
          .array(
            fc.record({
              id: validActionIdArb,
              action: validActionTypeArb,
              resourceId: validResourceIdArb,
              timestamp: validTimestampArb,
              order: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 1, maxLength: 10 },
          )
          // Ensure unique action IDs
          .map((actions) => {
            const seen = new Set<string>();
            return actions.filter((a) => {
              if (seen.has(a.id)) return false;
              seen.add(a.id);
              return true;
            });
          })
          .filter((actions) => actions.length > 0),
        async (learnerId, actions) => {
          const requestActions = actions.map((a, index) => ({
            id: a.id,
            action: a.action,
            payload: { id: a.resourceId },
            createdAt: a.timestamp.toISOString(),
            order: index,
          }));

          const res = await handleSyncPush(
            makeSyncPushRequest(learnerId, requestActions),
          );

          expect(res.status).toBe(200);

          const body = res.body as {
            synced: string[];
            conflicts: Array<{ actionId: string }>;
            failed: Array<{ actionId: string }>;
          };

          const inputIds = new Set(actions.map((a) => a.id));
          const syncedSet = new Set(body.synced);
          const conflictIds = new Set(body.conflicts.map((c) => c.actionId));
          const failedIds = new Set(body.failed.map((f) => f.actionId));

          // Every action ID appears in exactly one category
          for (const id of inputIds) {
            const appearances =
              (syncedSet.has(id) ? 1 : 0) +
              (conflictIds.has(id) ? 1 : 0) +
              (failedIds.has(id) ? 1 : 0);
            expect(appearances).toBe(1);
          }

          // Union of all result IDs equals the input set
          const allResultIds = new Set([
            ...body.synced,
            ...body.conflicts.map((c) => c.actionId),
            ...body.failed.map((f) => f.actionId),
          ]);
          expect(allResultIds).toEqual(inputIds);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 34: Sync conflict resolution — most-recent-wins
describe('Property 34: Sync conflict resolution — most-recent-wins', () => {
  beforeEach(() => {
    clearSyncState();
  });

  it('for any two changes to the same resource with different timestamps, the most recent wins and overwritten data is preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        validResourceIdArb,
        validActionTypeArb,
        // Two distinct timestamps for server and local
        validTimestampArb,
        validTimestampArb,
        fc.integer({ min: 0, max: 100 }),
        async (learnerId, resourceId, actionType, ts1, ts2, order) => {
          // Ensure timestamps are different
          if (ts1.getTime() === ts2.getTime()) return;

          const serverTimestamp = ts1;
          const localTimestamp = ts2;

          // First push: establishes the server entry
          const firstAction = {
            id: fc.sample(validActionIdArb, 1)[0],
            action: actionType,
            payload: { id: resourceId, data: 'server-data' },
            createdAt: serverTimestamp.toISOString(),
            order: 0,
          };

          const firstRes = await handleSyncPush(
            makeSyncPushRequest(learnerId, [firstAction]),
          );
          expect(firstRes.status).toBe(200);

          const firstBody = firstRes.body as { synced: string[] };
          expect(firstBody.synced).toContain(firstAction.id);

          // Second push: same resource, different timestamp → conflict
          const secondAction = {
            id: fc.sample(validActionIdArb, 1)[0],
            action: actionType,
            payload: { id: resourceId, data: 'local-data' },
            createdAt: localTimestamp.toISOString(),
            order: 1,
          };

          const secondRes = await handleSyncPush(
            makeSyncPushRequest(learnerId, [secondAction]),
          );
          expect(secondRes.status).toBe(200);

          const secondBody = secondRes.body as {
            synced: string[];
            conflicts: Array<{
              actionId: string;
              resolvedVersion: 'local' | 'remote';
              overwrittenData: unknown;
              localTimestamp: string;
              serverTimestamp: string;
            }>;
          };

          // Should have a conflict for the second action
          expect(secondBody.conflicts.length).toBe(1);
          const conflict = secondBody.conflicts[0];
          expect(conflict.actionId).toBe(secondAction.id);

          // Most-recent-wins: compare local and server timestamps
          const localWins = localTimestamp.getTime() > serverTimestamp.getTime();

          if (localWins) {
            expect(conflict.resolvedVersion).toBe('local');
            // Overwritten data is the server's data
            expect(conflict.overwrittenData).toEqual(firstAction.payload);
          } else {
            expect(conflict.resolvedVersion).toBe('remote');
            // Overwritten data is the local's data
            expect(conflict.overwrittenData).toEqual(secondAction.payload);
          }

          // Overwritten data is always preserved (non-null)
          expect(conflict.overwrittenData).not.toBeNull();
          expect(conflict.overwrittenData).not.toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 35: Sync pull filters by timestamp
describe('Property 35: Sync pull filters by timestamp', () => {
  beforeEach(() => {
    clearSyncState();
  });

  it('pulling changes with a since parameter returns only changes strictly after that timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        // Generate a list of entries with different timestamps
        fc.array(
          fc.record({
            changeType: validChangeTypeArb,
            resourceType: fc.constantFrom('chapter', 'answer', 'progress', 'score'),
            resourceId: validResourceIdArb,
            timestamp: validTimestampArb,
            data: fc.constant({ value: 'test' }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        // The `since` cutoff point
        validTimestampArb,
        async (learnerId, entries, sinceDate) => {
          // Seed the change log with entries
          for (const entry of entries) {
            addChangeLogEntry(learnerId, {
              changeType: entry.changeType,
              resourceType: entry.resourceType,
              resourceId: entry.resourceId,
              timestamp: entry.timestamp,
              data: entry.data,
              learnerId,
            });
          }

          // Pull changes with `since`
          const res = await handleSyncPull(
            makeSyncPullRequest(learnerId, sinceDate.toISOString()),
          );

          expect(res.status).toBe(200);

          const body = res.body as {
            changes: Array<{
              changeType: string;
              resourceType: string;
              resourceId: string;
              timestamp: string;
              data: unknown;
            }>;
          };

          // ALL returned changes have timestamp strictly after `since`
          for (const change of body.changes) {
            const changeTime = new Date(change.timestamp).getTime();
            expect(changeTime).toBeGreaterThan(sinceDate.getTime());
          }

          // Verify NO changes with timestamp <= since are included
          const expectedCount = entries.filter(
            (e) => e.timestamp.getTime() > sinceDate.getTime(),
          ).length;
          expect(body.changes.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 36: Sync pull change objects have required fields
describe('Property 36: Sync pull change objects have required fields', () => {
  beforeEach(() => {
    clearSyncState();
  });

  it('every change returned by sync pull contains non-null changeType, resourceType, resourceId, and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        validLearnerIdArb,
        fc.array(
          fc.record({
            changeType: validChangeTypeArb,
            resourceType: fc.constantFrom('chapter', 'answer', 'progress', 'score'),
            resourceId: validResourceIdArb,
            timestamp: validTimestampArb,
            data: fc.constant({ value: 'test-data' }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (learnerId, entries) => {
          // Seed the change log
          for (const entry of entries) {
            addChangeLogEntry(learnerId, {
              changeType: entry.changeType,
              resourceType: entry.resourceType,
              resourceId: entry.resourceId,
              timestamp: entry.timestamp,
              data: entry.data,
              learnerId,
            });
          }

          // Pull all changes (no since parameter)
          const res = await handleSyncPull(makeSyncPullRequest(learnerId));

          expect(res.status).toBe(200);

          const body = res.body as {
            changes: Array<{
              changeType: string;
              resourceType: string;
              resourceId: string;
              timestamp: string;
              data: unknown;
            }>;
          };

          // Every change has the required fields as non-null and non-undefined
          for (const change of body.changes) {
            expect(change.changeType).not.toBeNull();
            expect(change.changeType).not.toBeUndefined();
            expect(change.changeType).toBeTruthy();

            expect(change.resourceType).not.toBeNull();
            expect(change.resourceType).not.toBeUndefined();
            expect(change.resourceType).toBeTruthy();

            expect(change.resourceId).not.toBeNull();
            expect(change.resourceId).not.toBeUndefined();
            expect(change.resourceId).toBeTruthy();

            expect(change.timestamp).not.toBeNull();
            expect(change.timestamp).not.toBeUndefined();
            expect(change.timestamp).toBeTruthy();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
