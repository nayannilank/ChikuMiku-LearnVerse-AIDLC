/**
 * Sync Service with Conflict Resolution
 *
 * Syncs queued actions in order when connectivity is restored.
 * Resolves conflicts by retaining the most recent version.
 * Provides option to review overwritten changes.
 * Synchronizes within 5 seconds for conflict-free changes.
 *
 * Requirements: 7.3, 7.6, 13.5
 */

import { QueuedAction } from '@learnverse/service-core';
import { getQueuedActions, dequeueAction, clearQueue } from './offlineQueue';

// --- Types ---

export interface Change {
  id: string;
  resourceId: string;
  resourceType: string;
  data: unknown;
  timestamp: Date;
  learnerId: string;
}

export interface Conflict {
  id: string;
  resourceId: string;
  resourceType: string;
  localChange: Change;
  remoteChange: Change;
  resolvedVersion: 'local' | 'remote';
  overwrittenData: unknown;
}

export interface FailedSync {
  actionId: string;
  reason: string;
  retryable: boolean;
}

export interface SyncResult {
  synced: string[];
  conflicts: Conflict[];
  failed: FailedSync[];
}

/**
 * Server adapter interface for pushing/pulling changes.
 * Implementations connect to the actual backend.
 */
export interface SyncServerAdapter {
  /** Push a single action to the server. Returns the server's current version if conflict. */
  pushAction(action: QueuedAction): Promise<PushResult>;
  /** Pull changes from the server since a given timestamp */
  pullChanges(learnerId: string, since: Date): Promise<Change[]>;
}

export interface PushResult {
  success: boolean;
  /** If conflict, the server's current version */
  serverVersion?: Change;
  /** Error reason if failed (not a conflict) */
  errorReason?: string;
  retryable?: boolean;
}

// --- Conflict Resolution ---

/**
 * Resolve a conflict by retaining the most recent version (by timestamp).
 * Returns which version wins and preserves the overwritten data for review.
 */
export function resolveConflict(localChange: Change, remoteChange: Change): Conflict {
  const localTime = localChange.timestamp.getTime();
  const remoteTime = remoteChange.timestamp.getTime();

  // Most recent wins; ties go to remote (server authority)
  const resolvedVersion: 'local' | 'remote' = localTime > remoteTime ? 'local' : 'remote';
  const overwrittenData =
    resolvedVersion === 'local' ? remoteChange.data : localChange.data;

  return {
    id: `conflict-${localChange.resourceId}-${Date.now()}`,
    resourceId: localChange.resourceId,
    resourceType: localChange.resourceType,
    localChange,
    remoteChange,
    resolvedVersion,
    overwrittenData,
  };
}

// --- Conflict Store (for reviewing overwritten changes) ---

const conflictStore = new Map<string, Conflict[]>();

/**
 * Store a resolved conflict so the learner can review overwritten changes.
 */
export function storeConflict(learnerId: string, conflict: Conflict): void {
  const conflicts = conflictStore.get(learnerId) ?? [];
  conflicts.push(conflict);
  conflictStore.set(learnerId, conflicts);
}

/**
 * Get all unreviewed conflicts for a learner.
 */
export function getConflicts(learnerId: string): Conflict[] {
  return conflictStore.get(learnerId) ?? [];
}

/**
 * Dismiss a conflict after the learner has reviewed it.
 */
export function dismissConflict(learnerId: string, conflictId: string): boolean {
  const conflicts = conflictStore.get(learnerId);
  if (!conflicts) return false;

  const index = conflicts.findIndex((c) => c.id === conflictId);
  if (index === -1) return false;

  conflicts.splice(index, 1);
  if (conflicts.length === 0) {
    conflictStore.delete(learnerId);
  }
  return true;
}

/**
 * Clear all conflicts (for testing).
 */
export function clearConflictStore(): void {
  conflictStore.clear();
}

// --- Sync Orchestration ---

/**
 * Synchronize all queued actions for a learner.
 * Actions are synced in the exact order they were performed.
 * Conflicts are resolved by retaining the most recent version.
 */
export async function syncQueuedActions(
  learnerId: string,
  adapter: SyncServerAdapter
): Promise<SyncResult> {
  const actions = getQueuedActions(learnerId);
  const result: SyncResult = {
    synced: [],
    conflicts: [],
    failed: [],
  };

  // Process actions in sequential order
  for (const action of actions) {
    const pushResult = await adapter.pushAction(action);

    if (pushResult.success) {
      result.synced.push(action.id);
      dequeueAction(learnerId, action.id);
    } else if (pushResult.serverVersion) {
      // Conflict: resolve by most recent timestamp
      const localChange: Change = {
        id: action.id,
        resourceId: extractResourceId(action),
        resourceType: action.action,
        data: action.payload,
        timestamp: action.createdAt,
        learnerId: action.learnerId,
      };

      const conflict = resolveConflict(localChange, pushResult.serverVersion);
      result.conflicts.push(conflict);
      storeConflict(learnerId, conflict);
      dequeueAction(learnerId, action.id);
    } else {
      // Failed (not a conflict)
      result.failed.push({
        actionId: action.id,
        reason: pushResult.errorReason ?? 'Unknown error',
        retryable: pushResult.retryable ?? false,
      });
      // Stop processing on non-retryable failure to maintain order
      if (!pushResult.retryable) {
        break;
      }
    }
  }

  // If all actions synced successfully, clear the queue
  if (result.failed.length === 0 && result.conflicts.length === 0) {
    clearQueue(learnerId);
  }

  return result;
}

/**
 * Extract a resource ID from a queued action's payload.
 */
function extractResourceId(action: QueuedAction): string {
  const payload = action.payload as Record<string, unknown> | null;
  if (payload && typeof payload === 'object') {
    if (typeof payload.id === 'string') return payload.id;
    if (typeof payload.chapterId === 'string') return payload.chapterId;
    if (typeof payload.resourceId === 'string') return payload.resourceId;
  }
  return action.id;
}
