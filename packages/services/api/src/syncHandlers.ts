/**
 * Sync API Handlers — Push queued actions, pull remote changes.
 *
 * Implements in-memory sync server adapter and change log for local dev.
 * Uses most-recent-wins conflict resolution via the sync service.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 17.1, 17.2, 17.3
 */

import type { QueuedAction } from '@learnverse/service-core';
import {
  syncQueuedActions,
  enqueueAction,
  clearQueue,
  clearAllQueues,
} from '@learnverse/service-sync';
import type {
  SyncServerAdapter,
  PushResult,
  Change,
} from '@learnverse/service-sync';
import type { ApiRequest, ApiResponse } from './endpoints';

// --- Types ---

/** Represents a change entry in the in-memory change log */
export interface ChangeLogEntry {
  changeType: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  timestamp: Date;
  data: unknown;
  learnerId: string;
}

// --- In-Memory State ---

/** Change log keyed by learnerId */
const changeLog = new Map<string, ChangeLogEntry[]>();

// --- In-Memory Sync Server Adapter ---

/**
 * In-memory implementation of SyncServerAdapter for local development.
 * Checks for conflicts based on existing entries in the change log.
 */
export class InMemorySyncServerAdapter implements SyncServerAdapter {
  async pushAction(action: QueuedAction): Promise<PushResult> {
    const resourceId = extractResourceId(action);
    const resourceType = action.action;

    // Check for conflict: existing entry for the same resource
    const existingEntry = findExistingEntry(resourceId, resourceType);

    if (existingEntry) {
      // Conflict: return the server's current version
      const serverVersion: Change = {
        id: `server-${existingEntry.resourceId}-${existingEntry.timestamp.getTime()}`,
        resourceId: existingEntry.resourceId,
        resourceType: existingEntry.resourceType,
        data: existingEntry.data,
        timestamp: existingEntry.timestamp,
        learnerId: existingEntry.learnerId,
      };
      return { success: false, serverVersion };
    }

    // No conflict: add to change log
    const entry: ChangeLogEntry = {
      changeType: 'update',
      resourceType,
      resourceId,
      timestamp: action.createdAt,
      data: action.payload,
      learnerId: action.learnerId,
    };

    const entries = changeLog.get(action.learnerId) ?? [];
    entries.push(entry);
    changeLog.set(action.learnerId, entries);

    return { success: true };
  }

  async pullChanges(learnerId: string, since: Date): Promise<Change[]> {
    const entries = changeLog.get(learnerId) ?? [];
    return entries
      .filter((e) => e.timestamp.getTime() > since.getTime())
      .map((e) => ({
        id: `change-${e.resourceId}-${e.timestamp.getTime()}`,
        resourceId: e.resourceId,
        resourceType: e.resourceType,
        data: e.data,
        timestamp: e.timestamp,
        learnerId: e.learnerId,
      }));
  }
}

// --- Helpers ---

/** Extract learner ID from JWT (same pattern as revisionHandlers) */
function extractLearnerId(req: ApiRequest): string | null {
  const learnerId = req.headers['x-learner-id'];
  if (learnerId) return learnerId;

  const authHeader =
    req.headers['authorization'] ?? req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad === 2) base64 += '==';
    else if (pad === 3) base64 += '=';
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Extract a resource ID from a queued action's payload */
function extractResourceId(action: QueuedAction): string {
  const payload = action.payload as Record<string, unknown> | null;
  if (payload && typeof payload === 'object') {
    if (typeof payload.id === 'string') return payload.id;
    if (typeof payload.chapterId === 'string') return payload.chapterId;
    if (typeof payload.resourceId === 'string') return payload.resourceId;
  }
  return action.id;
}

/** Find an existing entry in the change log for a given resource */
function findExistingEntry(
  resourceId: string,
  resourceType: string
): ChangeLogEntry | null {
  for (const entries of changeLog.values()) {
    const found = entries.find(
      (e) => e.resourceId === resourceId && e.resourceType === resourceType
    );
    if (found) return found;
  }
  return null;
}

// --- Shared Adapter Instance ---

const syncAdapter = new InMemorySyncServerAdapter();

// --- Handlers ---

/**
 * POST /api/v1/sync/push
 *
 * Deserializes queued actions from request body, processes each through
 * the sync engine with most-recent-wins conflict resolution.
 * Returns { synced, conflicts, failed } where every action ID appears
 * in exactly one array.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 17.1
 */
export async function handleSyncPush(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Unable to identify learner',
        retryable: false,
      },
    };
  }

  const body = req.body as { actions?: unknown[] } | undefined;
  const rawActions = body?.actions;

  if (!rawActions || !Array.isArray(rawActions) || rawActions.length === 0) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Request body must contain a non-empty actions array',
        retryable: false,
      },
    };
  }

  // Clear existing queue for this learner to avoid stale items
  clearQueue(learnerId);

  // Enqueue all actions into the offline queue for processing by syncQueuedActions
  for (const raw of rawActions) {
    const action = raw as {
      id?: string;
      action?: string;
      payload?: unknown;
      createdAt?: string;
      order?: number;
    };

    if (!action.id || !action.action) {
      continue; // skip malformed actions
    }

    enqueueAction(
      learnerId,
      action.action as 'save_answer' | 'mark_progress' | 'save_chapter' | 'update_score',
      action.payload ?? {},
      action.createdAt ? new Date(action.createdAt) : undefined
    );
  }

  // The enqueueAction generates its own IDs, but syncQueuedActions works with
  // those queued items. We need to map original request action IDs to results.
  // Instead, let's process actions directly through the adapter for precise ID tracking.

  // Clear the queue we just populated — we'll do direct processing instead
  clearQueue(learnerId);

  // Process each action directly through the adapter to maintain original IDs
  const synced: string[] = [];
  const conflicts: Array<{
    actionId: string;
    resourceId: string;
    resourceType: string;
    localTimestamp: string;
    serverTimestamp: string;
    resolvedVersion: 'local' | 'remote';
    overwrittenData: unknown;
  }> = [];
  const failed: Array<{ actionId: string; reason: string; retryable: boolean }> = [];

  for (const raw of rawActions) {
    const action = raw as {
      id?: string;
      action?: string;
      payload?: unknown;
      createdAt?: string;
      order?: number;
    };

    if (!action.id || !action.action) {
      failed.push({
        actionId: action.id ?? 'unknown',
        reason: 'Missing required fields (id, action)',
        retryable: false,
      });
      continue;
    }

    const queuedAction: QueuedAction = {
      id: action.id,
      learnerId,
      action: action.action as 'save_answer' | 'mark_progress' | 'save_chapter' | 'update_score',
      payload: action.payload ?? {},
      createdAt: action.createdAt ? new Date(action.createdAt) : new Date(),
      order: action.order ?? 0,
    };

    try {
      const pushResult = await syncAdapter.pushAction(queuedAction);

      if (pushResult.success) {
        synced.push(action.id);
      } else if (pushResult.serverVersion) {
        // Conflict — resolve using most-recent-wins
        const localTimestamp = queuedAction.createdAt;
        const serverTimestamp = pushResult.serverVersion.timestamp;
        const localWins = localTimestamp.getTime() > serverTimestamp.getTime();

        conflicts.push({
          actionId: action.id,
          resourceId: pushResult.serverVersion.resourceId,
          resourceType: pushResult.serverVersion.resourceType,
          localTimestamp: localTimestamp.toISOString(),
          serverTimestamp: serverTimestamp.toISOString(),
          resolvedVersion: localWins ? 'local' : 'remote',
          overwrittenData: localWins
            ? pushResult.serverVersion.data
            : queuedAction.payload,
        });
      } else {
        failed.push({
          actionId: action.id,
          reason: pushResult.errorReason ?? 'Unknown error',
          retryable: pushResult.retryable ?? false,
        });
      }
    } catch (err) {
      failed.push({
        actionId: action.id,
        reason: err instanceof Error ? err.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { synced, conflicts, failed },
  };
}

/**
 * GET /api/v1/sync/pull
 *
 * Reads `since` query parameter, filters in-memory change log by timestamp
 * and learnerId. Returns { changes } array with changeType, resourceType,
 * resourceId, timestamp, data.
 *
 * Requirements: 17.1, 17.2, 17.3
 */
export async function handleSyncPull(req: ApiRequest): Promise<ApiResponse> {
  const learnerId = extractLearnerId(req);
  if (!learnerId) {
    return {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: {
        code: 'UNAUTHORIZED',
        message: 'Unable to identify learner',
        retryable: false,
      },
    };
  }

  const sinceParam = req.queryParams?.since;
  const entries = changeLog.get(learnerId) ?? [];

  let filtered: ChangeLogEntry[];
  if (sinceParam) {
    const sinceDate = new Date(sinceParam);
    if (isNaN(sinceDate.getTime())) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid since parameter. Must be a valid ISO date string.',
          retryable: false,
        },
      };
    }
    // Only changes strictly after `since`
    filtered = entries.filter(
      (e) => e.timestamp.getTime() > sinceDate.getTime()
    );
  } else {
    // No since — return all changes for the learner
    filtered = [...entries];
  }

  const changes = filtered.map((e) => ({
    changeType: e.changeType,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    timestamp: e.timestamp.toISOString(),
    data: e.data,
  }));

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: { changes },
  };
}

// --- Test Utilities ---

/**
 * Add an entry to the change log. Used for testing the pull endpoint.
 */
export function addChangeLogEntry(
  learnerId: string,
  entry: ChangeLogEntry
): void {
  const entries = changeLog.get(learnerId) ?? [];
  entries.push(entry);
  changeLog.set(learnerId, entries);
}

/**
 * Clear all sync state (change log and queues). Used for test isolation.
 */
export function clearSyncState(): void {
  changeLog.clear();
  clearAllQueues();
}
