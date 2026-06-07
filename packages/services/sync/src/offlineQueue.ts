/**
 * Offline Action Queue
 *
 * Queues actions while offline (max 50 per learner), rejects actions beyond the limit,
 * and maintains sequential ordering for replay when connectivity is restored.
 *
 * Requirements: 13.4
 */

import { QueuedAction, QueuedActionType, MAX_QUEUED_ACTIONS } from '@learnverse/service-core';

/** Error thrown when the offline queue is full */
export class QueueFullError extends Error {
  constructor(learnerId: string) {
    super(
      `Offline action queue is full (max ${MAX_QUEUED_ACTIONS} actions). ` +
        `Cannot queue more actions for learner "${learnerId}" until connectivity is restored.`
    );
    this.name = 'QueueFullError';
  }
}

/** In-memory store for queued actions, keyed by learnerId */
const queueStore = new Map<string, QueuedAction[]>();

/** Counter for generating sequential order values per learner */
const orderCounters = new Map<string, number>();

/** Generate a simple unique ID */
function generateId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Enqueue an action for a learner while offline.
 * Actions are stored in sequential order for replay.
 *
 * @throws QueueFullError if the queue already has MAX_QUEUED_ACTIONS items
 */
export function enqueueAction(
  learnerId: string,
  action: QueuedActionType,
  payload: unknown,
  now?: Date
): QueuedAction {
  const queue = queueStore.get(learnerId) ?? [];

  if (queue.length >= MAX_QUEUED_ACTIONS) {
    throw new QueueFullError(learnerId);
  }

  const currentOrder = orderCounters.get(learnerId) ?? 0;
  const nextOrder = currentOrder + 1;
  orderCounters.set(learnerId, nextOrder);

  const queuedAction: QueuedAction = {
    id: generateId(),
    learnerId,
    action,
    payload,
    createdAt: now ?? new Date(),
    order: nextOrder,
  };

  queue.push(queuedAction);
  queueStore.set(learnerId, queue);

  return queuedAction;
}

/**
 * Get all queued actions for a learner, in sequential order.
 */
export function getQueuedActions(learnerId: string): QueuedAction[] {
  const queue = queueStore.get(learnerId) ?? [];
  return [...queue].sort((a, b) => a.order - b.order);
}

/**
 * Get the number of queued actions for a learner.
 */
export function getQueueSize(learnerId: string): number {
  return (queueStore.get(learnerId) ?? []).length;
}

/**
 * Remove a specific action from the queue (after successful sync).
 */
export function dequeueAction(learnerId: string, actionId: string): boolean {
  const queue = queueStore.get(learnerId);
  if (!queue) return false;

  const index = queue.findIndex((a) => a.id === actionId);
  if (index === -1) return false;

  queue.splice(index, 1);
  if (queue.length === 0) {
    queueStore.delete(learnerId);
  }
  return true;
}

/**
 * Remove all queued actions for a learner (after full sync).
 */
export function clearQueue(learnerId: string): void {
  queueStore.delete(learnerId);
  orderCounters.delete(learnerId);
}

/**
 * Clear all queues (for testing).
 */
export function clearAllQueues(): void {
  queueStore.clear();
  orderCounters.clear();
}
