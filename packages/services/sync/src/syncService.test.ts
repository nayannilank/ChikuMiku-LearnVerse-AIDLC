import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveConflict,
  syncQueuedActions,
  storeConflict,
  getConflicts,
  dismissConflict,
  clearConflictStore,
} from './syncService';
import type { Change, SyncServerAdapter, PushResult } from './syncService';
import { enqueueAction, clearAllQueues, getQueueSize } from './offlineQueue';

describe('sync service', () => {
  beforeEach(() => {
    clearAllQueues();
    clearConflictStore();
  });

  describe('resolveConflict', () => {
    it('retains local version when local timestamp is more recent', () => {
      const localChange: Change = {
        id: 'local-1',
        resourceId: 'chapter-1',
        resourceType: 'save_chapter',
        data: { text: 'local version' },
        timestamp: new Date('2025-01-15T10:05:00Z'),
        learnerId: 'learner-1',
      };

      const remoteChange: Change = {
        id: 'remote-1',
        resourceId: 'chapter-1',
        resourceType: 'save_chapter',
        data: { text: 'remote version' },
        timestamp: new Date('2025-01-15T10:00:00Z'),
        learnerId: 'learner-1',
      };

      const conflict = resolveConflict(localChange, remoteChange);

      expect(conflict.resolvedVersion).toBe('local');
      expect(conflict.overwrittenData).toEqual({ text: 'remote version' });
      expect(conflict.resourceId).toBe('chapter-1');
    });

    it('retains remote version when remote timestamp is more recent', () => {
      const localChange: Change = {
        id: 'local-1',
        resourceId: 'chapter-1',
        resourceType: 'save_chapter',
        data: { text: 'local version' },
        timestamp: new Date('2025-01-15T10:00:00Z'),
        learnerId: 'learner-1',
      };

      const remoteChange: Change = {
        id: 'remote-1',
        resourceId: 'chapter-1',
        resourceType: 'save_chapter',
        data: { text: 'remote version' },
        timestamp: new Date('2025-01-15T10:05:00Z'),
        learnerId: 'learner-1',
      };

      const conflict = resolveConflict(localChange, remoteChange);

      expect(conflict.resolvedVersion).toBe('remote');
      expect(conflict.overwrittenData).toEqual({ text: 'local version' });
    });

    it('favors remote on equal timestamps (server authority)', () => {
      const sameTime = new Date('2025-01-15T10:00:00Z');

      const localChange: Change = {
        id: 'local-1',
        resourceId: 'chapter-1',
        resourceType: 'save_chapter',
        data: { text: 'local' },
        timestamp: sameTime,
        learnerId: 'learner-1',
      };

      const remoteChange: Change = {
        id: 'remote-1',
        resourceId: 'chapter-1',
        resourceType: 'save_chapter',
        data: { text: 'remote' },
        timestamp: sameTime,
        learnerId: 'learner-1',
      };

      const conflict = resolveConflict(localChange, remoteChange);
      expect(conflict.resolvedVersion).toBe('remote');
    });

    it('preserves overwritten data for review', () => {
      const localChange: Change = {
        id: 'local-1',
        resourceId: 'res-1',
        resourceType: 'save_answer',
        data: { answer: 'my answer' },
        timestamp: new Date('2025-01-15T10:00:00Z'),
        learnerId: 'learner-1',
      };

      const remoteChange: Change = {
        id: 'remote-1',
        resourceId: 'res-1',
        resourceType: 'save_answer',
        data: { answer: 'server answer' },
        timestamp: new Date('2025-01-15T10:05:00Z'),
        learnerId: 'learner-1',
      };

      const conflict = resolveConflict(localChange, remoteChange);
      // Remote wins, so local data is overwritten
      expect(conflict.overwrittenData).toEqual({ answer: 'my answer' });
    });
  });

  describe('conflict store', () => {
    it('stores and retrieves conflicts for a learner', () => {
      const conflict = resolveConflict(
        {
          id: 'l1',
          resourceId: 'r1',
          resourceType: 'save_chapter',
          data: 'local',
          timestamp: new Date('2025-01-15T10:00:00Z'),
          learnerId: 'learner-1',
        },
        {
          id: 'r1',
          resourceId: 'r1',
          resourceType: 'save_chapter',
          data: 'remote',
          timestamp: new Date('2025-01-15T10:05:00Z'),
          learnerId: 'learner-1',
        }
      );

      storeConflict('learner-1', conflict);

      const conflicts = getConflicts('learner-1');
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].resourceId).toBe('r1');
    });

    it('returns empty array for learner with no conflicts', () => {
      expect(getConflicts('learner-1')).toEqual([]);
    });

    it('dismisses a conflict by ID', () => {
      const conflict = resolveConflict(
        {
          id: 'l1',
          resourceId: 'r1',
          resourceType: 'save_chapter',
          data: 'local',
          timestamp: new Date('2025-01-15T10:00:00Z'),
          learnerId: 'learner-1',
        },
        {
          id: 'r1',
          resourceId: 'r1',
          resourceType: 'save_chapter',
          data: 'remote',
          timestamp: new Date('2025-01-15T10:05:00Z'),
          learnerId: 'learner-1',
        }
      );

      storeConflict('learner-1', conflict);
      const dismissed = dismissConflict('learner-1', conflict.id);

      expect(dismissed).toBe(true);
      expect(getConflicts('learner-1')).toEqual([]);
    });

    it('returns false when dismissing non-existent conflict', () => {
      expect(dismissConflict('learner-1', 'nonexistent')).toBe(false);
    });
  });

  describe('syncQueuedActions', () => {
    it('syncs all actions in order on success', async () => {
      enqueueAction('learner-1', 'save_answer', { q: 1 });
      enqueueAction('learner-1', 'mark_progress', { ch: 'c1' });

      const pushOrder: string[] = [];
      const adapter: SyncServerAdapter = {
        pushAction: vi.fn(async (action) => {
          pushOrder.push(action.action);
          return { success: true };
        }),
        pullChanges: vi.fn(async () => []),
      };

      const result = await syncQueuedActions('learner-1', adapter);

      expect(result.synced).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(pushOrder).toEqual(['save_answer', 'mark_progress']);
      expect(getQueueSize('learner-1')).toBe(0);
    });

    it('handles conflicts with most-recent-wins resolution', async () => {
      const actionTime = new Date('2025-01-15T10:00:00Z');
      enqueueAction('learner-1', 'save_chapter', { id: 'ch1', text: 'local' }, actionTime);

      const serverVersion: Change = {
        id: 'server-1',
        resourceId: 'ch1',
        resourceType: 'save_chapter',
        data: { id: 'ch1', text: 'server' },
        timestamp: new Date('2025-01-15T10:05:00Z'),
        learnerId: 'learner-1',
      };

      const adapter: SyncServerAdapter = {
        pushAction: vi.fn(async () => ({
          success: false,
          serverVersion,
        })),
        pullChanges: vi.fn(async () => []),
      };

      const result = await syncQueuedActions('learner-1', adapter);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].resolvedVersion).toBe('remote');
      expect(result.conflicts[0].overwrittenData).toEqual({ id: 'ch1', text: 'local' });

      // Conflict should be stored for review
      const storedConflicts = getConflicts('learner-1');
      expect(storedConflicts).toHaveLength(1);
    });

    it('stops on non-retryable failure to maintain order', async () => {
      enqueueAction('learner-1', 'save_answer', { q: 1 });
      enqueueAction('learner-1', 'mark_progress', { ch: 'c1' });
      enqueueAction('learner-1', 'save_chapter', { id: 'ch1' });

      let callCount = 0;
      const adapter: SyncServerAdapter = {
        pushAction: vi.fn(async () => {
          callCount++;
          if (callCount === 2) {
            return { success: false, errorReason: 'Server error', retryable: false };
          }
          return { success: true };
        }),
        pullChanges: vi.fn(async () => []),
      };

      const result = await syncQueuedActions('learner-1', adapter);

      expect(result.synced).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Server error');
      expect(result.failed[0].retryable).toBe(false);
      // Should not have processed the 3rd action
      expect(adapter.pushAction).toHaveBeenCalledTimes(2);
    });

    it('returns empty result for learner with no queued actions', async () => {
      const adapter: SyncServerAdapter = {
        pushAction: vi.fn(async () => ({ success: true })),
        pullChanges: vi.fn(async () => []),
      };

      const result = await syncQueuedActions('learner-1', adapter);

      expect(result.synced).toEqual([]);
      expect(result.conflicts).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(adapter.pushAction).not.toHaveBeenCalled();
    });
  });
});
