/**
 * Local progress backup with 7-day retention.
 *
 * Continuously preserves learner progress locally regardless of session status.
 * Purges backups older than 7 days.
 * Restores local progress on re-authentication after session expiry.
 *
 * Requirements: 8.7, 8.10
 */

import { ProgressRecord } from '@chikumiku/service-core';

// --- Constants ---

/** Maximum number of days a local backup is retained before purging */
export const BACKUP_RETENTION_DAYS = 7;

/** Retention duration in milliseconds */
export const BACKUP_RETENTION_MS = BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// --- Interfaces ---

/**
 * A snapshot of a learner's progress stored locally as a backup.
 * Created continuously as a background backup regardless of session status.
 */
export interface LocalBackup {
  learnerId: string;
  progressRecords: ProgressRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of a restore operation after re-authentication.
 */
export interface RestoreResult {
  success: true;
  backup: LocalBackup;
}

export interface RestoreFailure {
  success: false;
  reason: string;
}

export type RestoreOutcome = RestoreResult | RestoreFailure;

// --- In-Memory Backup Store ---

/**
 * In-memory store for local backups, keyed by learnerId.
 * In production, this would use device-local storage (IndexedDB, SharedPreferences, etc.).
 */
const backupStore = new Map<string, LocalBackup>();

/**
 * Clears the backup store. Useful for test isolation.
 */
export function clearBackupStore(): void {
  backupStore.clear();
}

/**
 * Returns all backups currently in the store (for testing/inspection).
 */
export function getAllBackups(): LocalBackup[] {
  return Array.from(backupStore.values());
}

// --- Core Functions ---

/**
 * Saves or updates a local backup for a learner.
 *
 * Called continuously as a background backup to preserve progress
 * regardless of session status (Requirement 8.7).
 *
 * If a backup already exists for the learner, it is updated with the
 * new progress records and the updatedAt timestamp is refreshed.
 * If no backup exists, a new one is created.
 *
 * @param learnerId - The learner whose progress is being backed up
 * @param progressRecords - The current progress records to back up
 * @param now - Optional current time (for testing)
 * @returns The saved or updated LocalBackup
 */
export function saveLocalBackup(
  learnerId: string,
  progressRecords: ProgressRecord[],
  now?: Date
): LocalBackup {
  const currentTime = now ?? new Date();
  const existing = backupStore.get(learnerId);

  if (existing) {
    // Update existing backup
    const updated: LocalBackup = {
      ...existing,
      progressRecords,
      updatedAt: currentTime,
    };
    backupStore.set(learnerId, updated);
    return updated;
  }

  // Create new backup
  const backup: LocalBackup = {
    learnerId,
    progressRecords,
    createdAt: currentTime,
    updatedAt: currentTime,
  };
  backupStore.set(learnerId, backup);
  return backup;
}

/**
 * Retrieves the local backup for a learner, if one exists and is within retention.
 *
 * @param learnerId - The learner whose backup to retrieve
 * @param now - Optional current time (for testing)
 * @returns The backup if it exists and is within retention, or null
 */
export function getLocalBackup(learnerId: string, now?: Date): LocalBackup | null {
  const backup = backupStore.get(learnerId);
  if (!backup) {
    return null;
  }

  const currentTime = now ?? new Date();
  const ageMs = currentTime.getTime() - backup.updatedAt.getTime();

  if (ageMs > BACKUP_RETENTION_MS) {
    // Backup has expired — remove it
    backupStore.delete(learnerId);
    return null;
  }

  return backup;
}

/**
 * Purges all backups older than 7 days from the local store.
 *
 * Should be called periodically (e.g., on app startup, on a timer)
 * to enforce the 7-day retention policy (Requirement 8.7).
 *
 * @param now - Optional current time (for testing)
 * @returns The number of backups purged
 */
export function purgeExpiredBackups(now?: Date): number {
  const currentTime = now ?? new Date();
  let purgedCount = 0;

  for (const [learnerId, backup] of backupStore.entries()) {
    const ageMs = currentTime.getTime() - backup.updatedAt.getTime();
    if (ageMs > BACKUP_RETENTION_MS) {
      backupStore.delete(learnerId);
      purgedCount++;
    }
  }

  return purgedCount;
}

/**
 * Restores local progress on re-authentication after session expiry.
 *
 * When a learner re-authenticates after their session has expired,
 * this function retrieves the locally preserved backup and returns it
 * so the application can resume from the last saved state (Requirement 8.10).
 *
 * @param learnerId - The learner who is re-authenticating
 * @param now - Optional current time (for testing)
 * @returns RestoreOutcome indicating success with the backup, or failure with reason
 */
export function restoreProgressOnReauth(learnerId: string, now?: Date): RestoreOutcome {
  const backup = getLocalBackup(learnerId, now);

  if (!backup) {
    return {
      success: false,
      reason: 'No local backup found or backup has expired (older than 7 days).',
    };
  }

  return {
    success: true,
    backup,
  };
}
