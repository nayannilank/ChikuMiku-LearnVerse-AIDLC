/**
 * Optimistic UI Updates with Rollback
 *
 * Applies optimistic updates for saves and progress marking so the learner
 * perceives the result within 100ms. Reverts local state on server rejection.
 * Notifies learner of failed actions.
 *
 * Requirements: 13.6, 13.7
 */

// --- Types ---

export interface OptimisticUpdate<T = unknown> {
  id: string;
  key: string;
  previousValue: T;
  optimisticValue: T;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'rolled_back';
}

export interface RollbackNotification {
  updateId: string;
  key: string;
  message: string;
  timestamp: Date;
}

/**
 * Listener for rollback notifications.
 */
export type RollbackListener = (notification: RollbackNotification) => void;

// --- State Store ---

/** In-memory local state store */
const localState = new Map<string, unknown>();

/** Pending optimistic updates, keyed by update ID */
const pendingUpdates = new Map<string, OptimisticUpdate>();

/** Rollback notification listeners */
const rollbackListeners: RollbackListener[] = [];

/** History of notifications (for testing/review) */
const notificationHistory: RollbackNotification[] = [];

// --- Public API ---

/**
 * Get the current value for a key from local state.
 */
export function getLocalState<T = unknown>(key: string): T | undefined {
  return localState.get(key) as T | undefined;
}

/**
 * Set a value in local state directly (non-optimistic).
 */
export function setLocalState<T = unknown>(key: string, value: T): void {
  localState.set(key, value);
}

/**
 * Apply an optimistic update: immediately update local state and track
 * the previous value for potential rollback.
 *
 * Returns the update record for tracking.
 */
export function applyOptimisticUpdate<T = unknown>(
  key: string,
  newValue: T,
  now?: Date
): OptimisticUpdate<T> {
  const previousValue = localState.get(key) as T;

  const update: OptimisticUpdate<T> = {
    id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    key,
    previousValue,
    optimisticValue: newValue,
    timestamp: now ?? new Date(),
    status: 'pending',
  };

  // Apply the optimistic value immediately
  localState.set(key, newValue);
  pendingUpdates.set(update.id, update as OptimisticUpdate);

  return update;
}

/**
 * Confirm an optimistic update (server accepted the change).
 * The optimistic value becomes the confirmed state.
 */
export function confirmUpdate(updateId: string): boolean {
  const update = pendingUpdates.get(updateId);
  if (!update || update.status !== 'pending') return false;

  update.status = 'confirmed';
  pendingUpdates.delete(updateId);
  return true;
}

/**
 * Roll back an optimistic update (server rejected the change).
 * Reverts local state to the previous value and notifies the learner.
 */
export function rollbackUpdate(updateId: string, reason?: string): boolean {
  const update = pendingUpdates.get(updateId);
  if (!update || update.status !== 'pending') return false;

  // Revert local state to the value before the optimistic update
  if (update.previousValue === undefined) {
    localState.delete(update.key);
  } else {
    localState.set(update.key, update.previousValue);
  }

  update.status = 'rolled_back';
  pendingUpdates.delete(updateId);

  // Notify learner of the failed action
  const notification: RollbackNotification = {
    updateId,
    key: update.key,
    message:
      reason ?? `The action on "${update.key}" could not be saved. Your change has been reverted.`,
    timestamp: new Date(),
  };

  notificationHistory.push(notification);
  for (const listener of rollbackListeners) {
    listener(notification);
  }

  return true;
}

/**
 * Get all pending (unconfirmed) optimistic updates.
 */
export function getPendingUpdates(): OptimisticUpdate[] {
  return Array.from(pendingUpdates.values());
}

/**
 * Register a listener for rollback notifications.
 */
export function addRollbackListener(listener: RollbackListener): void {
  rollbackListeners.push(listener);
}

/**
 * Remove a rollback listener.
 */
export function removeRollbackListener(listener: RollbackListener): void {
  const index = rollbackListeners.indexOf(listener);
  if (index !== -1) {
    rollbackListeners.splice(index, 1);
  }
}

/**
 * Get the notification history.
 */
export function getNotificationHistory(): RollbackNotification[] {
  return [...notificationHistory];
}

/**
 * Clear all state (for testing).
 */
export function clearOptimisticState(): void {
  localState.clear();
  pendingUpdates.clear();
  rollbackListeners.length = 0;
  notificationHistory.length = 0;
}
