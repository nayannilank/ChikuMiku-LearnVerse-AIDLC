/**
 * @chikumiku/service-sync
 *
 * Cross-platform data synchronization, conflict resolution, offline queue management.
 */

export {
  enqueueAction,
  getQueuedActions,
  getQueueSize,
  dequeueAction,
  clearQueue,
  clearAllQueues,
  QueueFullError,
} from './offlineQueue';

export {
  resolveConflict,
  syncQueuedActions,
  storeConflict,
  getConflicts,
  dismissConflict,
  clearConflictStore,
} from './syncService';

export type {
  Change,
  Conflict,
  FailedSync,
  SyncResult,
  SyncServerAdapter,
  PushResult,
} from './syncService';

export {
  getLocalState,
  setLocalState,
  applyOptimisticUpdate,
  confirmUpdate,
  rollbackUpdate,
  getPendingUpdates,
  addRollbackListener,
  removeRollbackListener,
  getNotificationHistory,
  clearOptimisticState,
} from './optimisticUpdates';

export type {
  OptimisticUpdate,
  RollbackNotification,
  RollbackListener,
} from './optimisticUpdates';

export {
  savePlatformState,
  restorePlatformState,
  hasSavedState,
  clearPlatformState,
  updatePlatformState,
  areStatesEquivalent,
  clearAllPlatformStates,
} from './platformState';

export type {
  PlatformState,
  ExercisePosition,
  UnsavedInput,
} from './platformState';

export {
  ClientCache,
  DEFAULT_MAX_CACHE_SIZE_BYTES,
  DEFAULT_EXPIRATION_DAYS,
} from './clientCache';

export type {
  CacheEntry,
  CacheConfig,
  CacheStats,
} from './clientCache';
