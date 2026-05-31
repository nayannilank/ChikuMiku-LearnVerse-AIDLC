import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueueAction,
  getQueuedActions,
  getQueueSize,
  dequeueAction,
  clearQueue,
  clearAllQueues,
  QueueFullError,
} from './offlineQueue';
import { MAX_QUEUED_ACTIONS } from '@chikumiku/service-core';

describe('offline action queue', () => {
  beforeEach(() => {
    clearAllQueues();
  });

  describe('enqueueAction', () => {
    it('queues an action with correct fields', () => {
      const now = new Date('2025-01-15T10:00:00Z');
      const result = enqueueAction('learner-1', 'save_answer', { questionId: 'q1', answer: 'hello' }, now);

      expect(result.learnerId).toBe('learner-1');
      expect(result.action).toBe('save_answer');
      expect(result.payload).toEqual({ questionId: 'q1', answer: 'hello' });
      expect(result.createdAt).toEqual(now);
      expect(result.order).toBe(1);
      expect(result.id).toBeTruthy();
    });

    it('assigns sequential order values', () => {
      const a1 = enqueueAction('learner-1', 'save_answer', { q: 1 });
      const a2 = enqueueAction('learner-1', 'mark_progress', { ch: 'c1' });
      const a3 = enqueueAction('learner-1', 'save_chapter', { id: 'ch1' });

      expect(a1.order).toBe(1);
      expect(a2.order).toBe(2);
      expect(a3.order).toBe(3);
    });

    it('maintains independent ordering per learner', () => {
      const a1 = enqueueAction('learner-1', 'save_answer', {});
      const b1 = enqueueAction('learner-2', 'save_answer', {});
      const a2 = enqueueAction('learner-1', 'mark_progress', {});

      expect(a1.order).toBe(1);
      expect(b1.order).toBe(1);
      expect(a2.order).toBe(2);
    });

    it('rejects actions when queue is full (max 50)', () => {
      expect(MAX_QUEUED_ACTIONS).toBe(50);

      // Fill the queue
      for (let i = 0; i < MAX_QUEUED_ACTIONS; i++) {
        enqueueAction('learner-1', 'save_answer', { index: i });
      }

      // 51st action should throw
      expect(() => {
        enqueueAction('learner-1', 'save_answer', { index: 50 });
      }).toThrow(QueueFullError);
    });

    it('allows queueing for other learners when one is full', () => {
      // Fill learner-1's queue
      for (let i = 0; i < MAX_QUEUED_ACTIONS; i++) {
        enqueueAction('learner-1', 'save_answer', { index: i });
      }

      // learner-2 should still be able to queue
      expect(() => {
        enqueueAction('learner-2', 'save_answer', { index: 0 });
      }).not.toThrow();
    });
  });

  describe('getQueuedActions', () => {
    it('returns empty array for unknown learner', () => {
      expect(getQueuedActions('unknown')).toEqual([]);
    });

    it('returns actions in sequential order', () => {
      enqueueAction('learner-1', 'save_answer', { q: 1 });
      enqueueAction('learner-1', 'mark_progress', { ch: 'c1' });
      enqueueAction('learner-1', 'save_chapter', { id: 'ch1' });

      const actions = getQueuedActions('learner-1');
      expect(actions).toHaveLength(3);
      expect(actions[0].action).toBe('save_answer');
      expect(actions[1].action).toBe('mark_progress');
      expect(actions[2].action).toBe('save_chapter');
      expect(actions[0].order).toBeLessThan(actions[1].order);
      expect(actions[1].order).toBeLessThan(actions[2].order);
    });

    it('returns a copy (not a reference to internal state)', () => {
      enqueueAction('learner-1', 'save_answer', { q: 1 });
      const actions1 = getQueuedActions('learner-1');
      const actions2 = getQueuedActions('learner-1');
      expect(actions1).not.toBe(actions2);
    });
  });

  describe('getQueueSize', () => {
    it('returns 0 for unknown learner', () => {
      expect(getQueueSize('unknown')).toBe(0);
    });

    it('returns correct count', () => {
      enqueueAction('learner-1', 'save_answer', {});
      enqueueAction('learner-1', 'mark_progress', {});
      expect(getQueueSize('learner-1')).toBe(2);
    });
  });

  describe('dequeueAction', () => {
    it('removes a specific action by ID', () => {
      const a1 = enqueueAction('learner-1', 'save_answer', { q: 1 });
      enqueueAction('learner-1', 'mark_progress', { ch: 'c1' });

      const removed = dequeueAction('learner-1', a1.id);
      expect(removed).toBe(true);
      expect(getQueueSize('learner-1')).toBe(1);
      expect(getQueuedActions('learner-1')[0].action).toBe('mark_progress');
    });

    it('returns false for unknown action ID', () => {
      enqueueAction('learner-1', 'save_answer', {});
      expect(dequeueAction('learner-1', 'nonexistent')).toBe(false);
    });

    it('returns false for unknown learner', () => {
      expect(dequeueAction('unknown', 'some-id')).toBe(false);
    });
  });

  describe('clearQueue', () => {
    it('removes all actions for a learner', () => {
      enqueueAction('learner-1', 'save_answer', {});
      enqueueAction('learner-1', 'mark_progress', {});
      enqueueAction('learner-2', 'save_answer', {});

      clearQueue('learner-1');

      expect(getQueueSize('learner-1')).toBe(0);
      expect(getQueueSize('learner-2')).toBe(1);
    });

    it('allows re-queueing after clear', () => {
      // Fill the queue
      for (let i = 0; i < MAX_QUEUED_ACTIONS; i++) {
        enqueueAction('learner-1', 'save_answer', { index: i });
      }

      clearQueue('learner-1');

      // Should be able to queue again
      expect(() => {
        enqueueAction('learner-1', 'save_answer', { index: 0 });
      }).not.toThrow();
    });
  });

  describe('QueueFullError', () => {
    it('has descriptive message', () => {
      const error = new QueueFullError('learner-1');
      expect(error.message).toContain('50');
      expect(error.message).toContain('learner-1');
      expect(error.name).toBe('QueueFullError');
    });
  });
});
