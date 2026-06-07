import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveLocalBackup,
  getLocalBackup,
  purgeExpiredBackups,
  restoreProgressOnReauth,
  clearBackupStore,
  getAllBackups,
  BACKUP_RETENTION_DAYS,
  BACKUP_RETENTION_MS,
  LocalBackup,
} from './localBackup';
import { ProgressRecord } from '@learnverse/service-core';

// --- Test Helpers ---

function createProgressRecord(overrides?: Partial<ProgressRecord>): ProgressRecord {
  return {
    learnerId: 'learner-1',
    chapterId: 'chapter-1',
    subjectId: 'kannada',
    completionPercentage: 75,
    activityScores: [
      { activityType: 'comprehension', score: 80, completedAt: new Date() },
    ],
    lastAccessedAt: new Date(),
    ...overrides,
  };
}

describe('local progress backup', () => {
  beforeEach(() => {
    clearBackupStore();
  });

  describe('constants', () => {
    it('BACKUP_RETENTION_DAYS equals 7', () => {
      expect(BACKUP_RETENTION_DAYS).toBe(7);
    });

    it('BACKUP_RETENTION_MS equals 7 days in milliseconds', () => {
      expect(BACKUP_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('saveLocalBackup', () => {
    it('creates a new backup for a learner', () => {
      const now = new Date('2025-06-01T10:00:00Z');
      const records = [createProgressRecord()];

      const backup = saveLocalBackup('learner-1', records, now);

      expect(backup.learnerId).toBe('learner-1');
      expect(backup.progressRecords).toEqual(records);
      expect(backup.createdAt).toEqual(now);
      expect(backup.updatedAt).toEqual(now);
    });

    it('updates an existing backup with new progress records', () => {
      const createTime = new Date('2025-06-01T10:00:00Z');
      const updateTime = new Date('2025-06-02T10:00:00Z');
      const initialRecords = [createProgressRecord({ completionPercentage: 50 })];
      const updatedRecords = [createProgressRecord({ completionPercentage: 80 })];

      saveLocalBackup('learner-1', initialRecords, createTime);
      const updated = saveLocalBackup('learner-1', updatedRecords, updateTime);

      expect(updated.learnerId).toBe('learner-1');
      expect(updated.progressRecords).toEqual(updatedRecords);
      expect(updated.createdAt).toEqual(createTime);
      expect(updated.updatedAt).toEqual(updateTime);
    });

    it('preserves original createdAt when updating', () => {
      const createTime = new Date('2025-06-01T10:00:00Z');
      const updateTime = new Date('2025-06-03T10:00:00Z');

      saveLocalBackup('learner-1', [createProgressRecord()], createTime);
      const updated = saveLocalBackup('learner-1', [createProgressRecord()], updateTime);

      expect(updated.createdAt).toEqual(createTime);
      expect(updated.updatedAt).toEqual(updateTime);
    });

    it('stores backups independently per learner', () => {
      const now = new Date('2025-06-01T10:00:00Z');
      const records1 = [createProgressRecord({ learnerId: 'learner-1' })];
      const records2 = [createProgressRecord({ learnerId: 'learner-2', subjectId: 'maths' })];

      saveLocalBackup('learner-1', records1, now);
      saveLocalBackup('learner-2', records2, now);

      const allBackups = getAllBackups();
      expect(allBackups).toHaveLength(2);
    });

    it('handles empty progress records', () => {
      const now = new Date('2025-06-01T10:00:00Z');
      const backup = saveLocalBackup('learner-1', [], now);

      expect(backup.progressRecords).toEqual([]);
    });
  });

  describe('getLocalBackup', () => {
    it('retrieves an existing backup within retention period', () => {
      const createTime = new Date('2025-06-01T10:00:00Z');
      const checkTime = new Date('2025-06-05T10:00:00Z'); // 4 days later
      const records = [createProgressRecord()];

      saveLocalBackup('learner-1', records, createTime);
      const backup = getLocalBackup('learner-1', checkTime);

      expect(backup).not.toBeNull();
      expect(backup!.learnerId).toBe('learner-1');
      expect(backup!.progressRecords).toEqual(records);
    });

    it('returns null for non-existent learner', () => {
      const backup = getLocalBackup('nonexistent');
      expect(backup).toBeNull();
    });

    it('returns null and removes backup older than 7 days', () => {
      const createTime = new Date('2025-06-01T10:00:00Z');
      // 7 days + 1 ms later
      const checkTime = new Date(createTime.getTime() + BACKUP_RETENTION_MS + 1);
      const records = [createProgressRecord()];

      saveLocalBackup('learner-1', records, createTime);
      const backup = getLocalBackup('learner-1', checkTime);

      expect(backup).toBeNull();

      // Verify it was removed from the store
      const allBackups = getAllBackups();
      expect(allBackups).toHaveLength(0);
    });

    it('returns backup at exactly 7 days (boundary - still expired)', () => {
      const createTime = new Date('2025-06-01T00:00:00Z');
      // Exactly 7 days + 1ms (just over the boundary)
      const checkTime = new Date(createTime.getTime() + BACKUP_RETENTION_MS + 1);

      saveLocalBackup('learner-1', [createProgressRecord()], createTime);
      const backup = getLocalBackup('learner-1', checkTime);

      expect(backup).toBeNull();
    });

    it('returns backup at exactly 7 days boundary (not expired)', () => {
      const createTime = new Date('2025-06-01T00:00:00Z');
      // Exactly at the boundary (ageMs === BACKUP_RETENTION_MS is NOT > BACKUP_RETENTION_MS)
      const checkTime = new Date(createTime.getTime() + BACKUP_RETENTION_MS);

      saveLocalBackup('learner-1', [createProgressRecord()], createTime);
      const backup = getLocalBackup('learner-1', checkTime);

      expect(backup).not.toBeNull();
    });

    it('uses updatedAt for retention calculation, not createdAt', () => {
      const createTime = new Date('2025-06-01T00:00:00Z');
      const updateTime = new Date('2025-06-05T00:00:00Z'); // 4 days later
      // 6 days after update (within 7 days of update, but 10 days after creation)
      const checkTime = new Date(updateTime.getTime() + 6 * 24 * 60 * 60 * 1000);

      saveLocalBackup('learner-1', [createProgressRecord()], createTime);
      saveLocalBackup('learner-1', [createProgressRecord()], updateTime);

      const backup = getLocalBackup('learner-1', checkTime);
      expect(backup).not.toBeNull();
    });
  });

  describe('purgeExpiredBackups', () => {
    it('removes backups older than 7 days', () => {
      const oldTime = new Date('2025-05-01T00:00:00Z');
      const recentTime = new Date('2025-06-08T00:00:00Z');
      const now = new Date('2025-06-10T00:00:00Z');

      saveLocalBackup('learner-old', [createProgressRecord()], oldTime);
      saveLocalBackup('learner-recent', [createProgressRecord()], recentTime);

      const purged = purgeExpiredBackups(now);

      expect(purged).toBe(1);
      expect(getLocalBackup('learner-old', now)).toBeNull();
      expect(getLocalBackup('learner-recent', now)).not.toBeNull();
    });

    it('returns 0 when no backups are expired', () => {
      const now = new Date('2025-06-10T00:00:00Z');
      const recentTime = new Date('2025-06-09T00:00:00Z');

      saveLocalBackup('learner-1', [createProgressRecord()], recentTime);
      saveLocalBackup('learner-2', [createProgressRecord()], recentTime);

      const purged = purgeExpiredBackups(now);
      expect(purged).toBe(0);
    });

    it('returns 0 when store is empty', () => {
      const purged = purgeExpiredBackups(new Date());
      expect(purged).toBe(0);
    });

    it('purges all backups when all are expired', () => {
      const oldTime = new Date('2025-01-01T00:00:00Z');
      const now = new Date('2025-06-10T00:00:00Z');

      saveLocalBackup('learner-1', [createProgressRecord()], oldTime);
      saveLocalBackup('learner-2', [createProgressRecord()], oldTime);
      saveLocalBackup('learner-3', [createProgressRecord()], oldTime);

      const purged = purgeExpiredBackups(now);
      expect(purged).toBe(3);
      expect(getAllBackups()).toHaveLength(0);
    });
  });

  describe('restoreProgressOnReauth', () => {
    it('restores backup on re-authentication within retention period', () => {
      const createTime = new Date('2025-06-01T10:00:00Z');
      const reauthTime = new Date('2025-06-05T10:00:00Z'); // 4 days later
      const records = [
        createProgressRecord({ completionPercentage: 85 }),
        createProgressRecord({ chapterId: 'chapter-2', completionPercentage: 60 }),
      ];

      saveLocalBackup('learner-1', records, createTime);
      const result = restoreProgressOnReauth('learner-1', reauthTime);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.backup.learnerId).toBe('learner-1');
        expect(result.backup.progressRecords).toEqual(records);
      }
    });

    it('fails when no backup exists for the learner', () => {
      const result = restoreProgressOnReauth('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('No local backup found');
      }
    });

    it('fails when backup has expired (older than 7 days)', () => {
      const createTime = new Date('2025-06-01T00:00:00Z');
      const reauthTime = new Date(createTime.getTime() + BACKUP_RETENTION_MS + 1);

      saveLocalBackup('learner-1', [createProgressRecord()], createTime);
      const result = restoreProgressOnReauth('learner-1', reauthTime);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toContain('expired');
      }
    });

    it('restores the most recent progress after multiple updates', () => {
      const time1 = new Date('2025-06-01T10:00:00Z');
      const time2 = new Date('2025-06-03T10:00:00Z');
      const reauthTime = new Date('2025-06-05T10:00:00Z');

      const records1 = [createProgressRecord({ completionPercentage: 50 })];
      const records2 = [createProgressRecord({ completionPercentage: 90 })];

      saveLocalBackup('learner-1', records1, time1);
      saveLocalBackup('learner-1', records2, time2);

      const result = restoreProgressOnReauth('learner-1', reauthTime);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.backup.progressRecords[0].completionPercentage).toBe(90);
      }
    });

    it('restores backup updated just before the 7-day boundary', () => {
      const updateTime = new Date('2025-06-01T00:00:00Z');
      // Exactly at the boundary (should still be valid)
      const reauthTime = new Date(updateTime.getTime() + BACKUP_RETENTION_MS);

      saveLocalBackup('learner-1', [createProgressRecord()], updateTime);
      const result = restoreProgressOnReauth('learner-1', reauthTime);

      expect(result.success).toBe(true);
    });
  });
});
