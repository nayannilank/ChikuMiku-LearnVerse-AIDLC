import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
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
import type { RollbackNotification } from './optimisticUpdates';

describe('optimistic UI updates with rollback', () => {
  beforeEach(() => {
    clearOptimisticState();
  });

  describe('local state management', () => {
    it('returns undefined for unknown keys', () => {
      expect(getLocalState('nonexistent')).toBeUndefined();
    });

    it('sets and gets local state', () => {
      setLocalState('answer-1', { text: 'hello' });
      expect(getLocalState('answer-1')).toEqual({ text: 'hello' });
    });

    it('overwrites existing state', () => {
      setLocalState('key', 'first');
      setLocalState('key', 'second');
      expect(getLocalState('key')).toBe('second');
    });
  });

  describe('applyOptimisticUpdate', () => {
    it('immediately updates local state with new value', () => {
      setLocalState('progress', 50);
      applyOptimisticUpdate('progress', 75);
      expect(getLocalState('progress')).toBe(75);
    });

    it('records the previous value for rollback', () => {
      setLocalState('answer', 'old answer');
      const update = applyOptimisticUpdate('answer', 'new answer');
      expect(update.previousValue).toBe('old answer');
      expect(update.optimisticValue).toBe('new answer');
    });

    it('handles undefined previous value (new key)', () => {
      const update = applyOptimisticUpdate('new-key', 'value');
      expect(update.previousValue).toBeUndefined();
      expect(getLocalState('new-key')).toBe('value');
    });

    it('creates a pending update record', () => {
      applyOptimisticUpdate('key', 'value');
      const pending = getPendingUpdates();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('pending');
      expect(pending[0].key).toBe('key');
    });

    it('assigns a unique ID to each update', () => {
      const u1 = applyOptimisticUpdate('key1', 'v1');
      const u2 = applyOptimisticUpdate('key2', 'v2');
      expect(u1.id).not.toBe(u2.id);
    });

    it('uses provided timestamp', () => {
      const now = new Date('2025-06-01T12:00:00Z');
      const update = applyOptimisticUpdate('key', 'value', now);
      expect(update.timestamp).toEqual(now);
    });
  });

  describe('confirmUpdate', () => {
    it('confirms a pending update (server accepted)', () => {
      const update = applyOptimisticUpdate('key', 'value');
      const confirmed = confirmUpdate(update.id);
      expect(confirmed).toBe(true);
    });

    it('removes the update from pending list after confirmation', () => {
      const update = applyOptimisticUpdate('key', 'value');
      confirmUpdate(update.id);
      expect(getPendingUpdates()).toHaveLength(0);
    });

    it('keeps the optimistic value in local state after confirmation', () => {
      setLocalState('key', 'old');
      const update = applyOptimisticUpdate('key', 'new');
      confirmUpdate(update.id);
      expect(getLocalState('key')).toBe('new');
    });

    it('returns false for unknown update ID', () => {
      expect(confirmUpdate('nonexistent')).toBe(false);
    });

    it('returns false for already confirmed update', () => {
      const update = applyOptimisticUpdate('key', 'value');
      confirmUpdate(update.id);
      expect(confirmUpdate(update.id)).toBe(false);
    });
  });

  describe('rollbackUpdate', () => {
    it('reverts local state to previous value on server rejection', () => {
      setLocalState('answer', 'original');
      const update = applyOptimisticUpdate('answer', 'optimistic');
      expect(getLocalState('answer')).toBe('optimistic');

      rollbackUpdate(update.id);
      expect(getLocalState('answer')).toBe('original');
    });

    it('deletes key from state if previous value was undefined', () => {
      const update = applyOptimisticUpdate('new-key', 'value');
      rollbackUpdate(update.id);
      expect(getLocalState('new-key')).toBeUndefined();
    });

    it('removes the update from pending list', () => {
      const update = applyOptimisticUpdate('key', 'value');
      rollbackUpdate(update.id);
      expect(getPendingUpdates()).toHaveLength(0);
    });

    it('returns false for unknown update ID', () => {
      expect(rollbackUpdate('nonexistent')).toBe(false);
    });

    it('returns false for already rolled back update', () => {
      const update = applyOptimisticUpdate('key', 'value');
      rollbackUpdate(update.id);
      expect(rollbackUpdate(update.id)).toBe(false);
    });

    it('returns false for already confirmed update', () => {
      const update = applyOptimisticUpdate('key', 'value');
      confirmUpdate(update.id);
      expect(rollbackUpdate(update.id)).toBe(false);
    });
  });

  describe('rollback notifications', () => {
    it('notifies listeners on rollback', () => {
      const listener = vi.fn();
      addRollbackListener(listener);

      const update = applyOptimisticUpdate('key', 'value');
      rollbackUpdate(update.id);

      expect(listener).toHaveBeenCalledTimes(1);
      const notification: RollbackNotification = listener.mock.calls[0][0];
      expect(notification.updateId).toBe(update.id);
      expect(notification.key).toBe('key');
      expect(notification.message).toContain('key');
    });

    it('includes custom reason in notification message', () => {
      const listener = vi.fn();
      addRollbackListener(listener);

      const update = applyOptimisticUpdate('answer', 'my answer');
      rollbackUpdate(update.id, 'Server rejected: duplicate submission');

      const notification: RollbackNotification = listener.mock.calls[0][0];
      expect(notification.message).toBe('Server rejected: duplicate submission');
    });

    it('records notifications in history', () => {
      const update = applyOptimisticUpdate('key', 'value');
      rollbackUpdate(update.id);

      const history = getNotificationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].updateId).toBe(update.id);
    });

    it('notifies multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      addRollbackListener(listener1);
      addRollbackListener(listener2);

      const update = applyOptimisticUpdate('key', 'value');
      rollbackUpdate(update.id);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('does not notify removed listeners', () => {
      const listener = vi.fn();
      addRollbackListener(listener);
      removeRollbackListener(listener);

      const update = applyOptimisticUpdate('key', 'value');
      rollbackUpdate(update.id);

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not notify on confirmation (only on rollback)', () => {
      const listener = vi.fn();
      addRollbackListener(listener);

      const update = applyOptimisticUpdate('key', 'value');
      confirmUpdate(update.id);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getPendingUpdates', () => {
    it('returns empty array when no pending updates', () => {
      expect(getPendingUpdates()).toEqual([]);
    });

    it('returns only pending updates (not confirmed or rolled back)', () => {
      const u1 = applyOptimisticUpdate('key1', 'v1');
      const u2 = applyOptimisticUpdate('key2', 'v2');
      const u3 = applyOptimisticUpdate('key3', 'v3');

      confirmUpdate(u1.id);
      rollbackUpdate(u3.id);

      const pending = getPendingUpdates();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(u2.id);
    });
  });

  describe('multiple optimistic updates on same key', () => {
    it('handles sequential updates on the same key', () => {
      setLocalState('score', 50);

      const u1 = applyOptimisticUpdate('score', 60);
      const u2 = applyOptimisticUpdate('score', 70);

      expect(getLocalState('score')).toBe(70);

      // Rolling back u2 should revert to u1's optimistic value (60)
      rollbackUpdate(u2.id);
      expect(getLocalState('score')).toBe(60);

      // Confirming u1 keeps 60
      confirmUpdate(u1.id);
      expect(getLocalState('score')).toBe(60);
    });
  });
});
