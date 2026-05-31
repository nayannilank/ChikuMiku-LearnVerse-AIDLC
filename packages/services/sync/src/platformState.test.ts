import { describe, it, expect, beforeEach } from 'vitest';
import {
  savePlatformState,
  restorePlatformState,
  hasSavedState,
  clearPlatformState,
  updatePlatformState,
  areStatesEquivalent,
  clearAllPlatformStates,
} from './platformState';
import type { PlatformState, ExercisePosition, UnsavedInput } from './platformState';

describe('platform state restoration', () => {
  beforeEach(() => {
    clearAllPlatformStates();
  });

  describe('savePlatformState', () => {
    it('saves state with all fields', () => {
      const now = new Date('2025-06-01T12:00:00Z');
      const state = savePlatformState(
        'learner-1',
        {
          activeSubjectId: 'kannada',
          activeChapterId: 'ch-1',
          exercisePosition: {
            sessionId: 'session-1',
            questionIndex: 3,
            totalQuestions: 10,
            sessionType: 'comprehension',
          },
          unsavedInput: {
            context: 'answer-form',
            value: 'My partial answer...',
            fieldId: 'q3-answer',
          },
        },
        now
      );

      expect(state.learnerId).toBe('learner-1');
      expect(state.activeSubjectId).toBe('kannada');
      expect(state.activeChapterId).toBe('ch-1');
      expect(state.exercisePosition?.sessionId).toBe('session-1');
      expect(state.exercisePosition?.questionIndex).toBe(3);
      expect(state.exercisePosition?.totalQuestions).toBe(10);
      expect(state.exercisePosition?.sessionType).toBe('comprehension');
      expect(state.unsavedInput?.context).toBe('answer-form');
      expect(state.unsavedInput?.value).toBe('My partial answer...');
      expect(state.unsavedInput?.fieldId).toBe('q3-answer');
      expect(state.savedAt).toEqual(now);
    });

    it('saves state with null optional fields', () => {
      const state = savePlatformState('learner-1', {
        activeSubjectId: 'maths',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
      });

      expect(state.activeSubjectId).toBe('maths');
      expect(state.activeChapterId).toBeNull();
      expect(state.exercisePosition).toBeNull();
      expect(state.unsavedInput).toBeNull();
    });

    it('overwrites previous state for same learner', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-1',
        exercisePosition: null,
        unsavedInput: null,
      });

      savePlatformState('learner-1', {
        activeSubjectId: 'maths',
        activeChapterId: 'ch-5',
        exercisePosition: null,
        unsavedInput: null,
      });

      const restored = restorePlatformState('learner-1');
      expect(restored?.activeSubjectId).toBe('maths');
      expect(restored?.activeChapterId).toBe('ch-5');
    });
  });

  describe('restorePlatformState', () => {
    it('restores saved state correctly', () => {
      const exercisePosition: ExercisePosition = {
        sessionId: 'rev-session-1',
        questionIndex: 7,
        totalQuestions: 15,
        sessionType: 'revision',
      };

      const unsavedInput: UnsavedInput = {
        context: 'grammar-exercise',
        value: 'ನಾನು ಶಾಲೆಗೆ',
        fieldId: 'sentence-builder',
      };

      savePlatformState('learner-1', {
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-3',
        exercisePosition,
        unsavedInput,
      });

      const restored = restorePlatformState('learner-1');
      expect(restored).not.toBeNull();
      expect(restored!.activeSubjectId).toBe('kannada');
      expect(restored!.activeChapterId).toBe('ch-3');
      expect(restored!.exercisePosition).toEqual(exercisePosition);
      expect(restored!.unsavedInput).toEqual(unsavedInput);
    });

    it('returns null for unknown learner', () => {
      expect(restorePlatformState('unknown')).toBeNull();
    });

    it('preserves state across multiple restore calls (non-destructive read)', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'science',
        activeChapterId: 'ch-2',
        exercisePosition: null,
        unsavedInput: null,
      });

      const first = restorePlatformState('learner-1');
      const second = restorePlatformState('learner-1');
      expect(first).toEqual(second);
    });
  });

  describe('hasSavedState', () => {
    it('returns false for unknown learner', () => {
      expect(hasSavedState('unknown')).toBe(false);
    });

    it('returns true after saving state', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'english',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
      });
      expect(hasSavedState('learner-1')).toBe(true);
    });

    it('returns false after clearing state', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'english',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
      });
      clearPlatformState('learner-1');
      expect(hasSavedState('learner-1')).toBe(false);
    });
  });

  describe('clearPlatformState', () => {
    it('removes state for a specific learner', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
      });
      savePlatformState('learner-2', {
        activeSubjectId: 'maths',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
      });

      clearPlatformState('learner-1');

      expect(restorePlatformState('learner-1')).toBeNull();
      expect(restorePlatformState('learner-2')).not.toBeNull();
    });
  });

  describe('updatePlatformState', () => {
    it('updates specific fields without replacing entire state', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-1',
        exercisePosition: null,
        unsavedInput: null,
      });

      const updated = updatePlatformState('learner-1', {
        activeChapterId: 'ch-2',
      });

      expect(updated).not.toBeNull();
      expect(updated!.activeSubjectId).toBe('kannada'); // unchanged
      expect(updated!.activeChapterId).toBe('ch-2'); // updated
    });

    it('returns null for unknown learner', () => {
      expect(updatePlatformState('unknown', { activeSubjectId: 'maths' })).toBeNull();
    });

    it('updates the savedAt timestamp', () => {
      const t1 = new Date('2025-01-01T10:00:00Z');
      const t2 = new Date('2025-01-01T10:05:00Z');

      savePlatformState(
        'learner-1',
        {
          activeSubjectId: 'kannada',
          activeChapterId: null,
          exercisePosition: null,
          unsavedInput: null,
        },
        t1
      );

      const updated = updatePlatformState('learner-1', { activeChapterId: 'ch-1' }, t2);
      expect(updated!.savedAt).toEqual(t2);
    });

    it('can update exercise position', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-1',
        exercisePosition: {
          sessionId: 's1',
          questionIndex: 0,
          totalQuestions: 10,
          sessionType: 'comprehension',
        },
        unsavedInput: null,
      });

      updatePlatformState('learner-1', {
        exercisePosition: {
          sessionId: 's1',
          questionIndex: 5,
          totalQuestions: 10,
          sessionType: 'comprehension',
        },
      });

      const restored = restorePlatformState('learner-1');
      expect(restored!.exercisePosition!.questionIndex).toBe(5);
    });

    it('can update unsaved input', () => {
      savePlatformState('learner-1', {
        activeSubjectId: 'english',
        activeChapterId: 'ch-1',
        exercisePosition: null,
        unsavedInput: null,
      });

      updatePlatformState('learner-1', {
        unsavedInput: {
          context: 'answer-field',
          value: 'The answer is...',
        },
      });

      const restored = restorePlatformState('learner-1');
      expect(restored!.unsavedInput!.value).toBe('The answer is...');
    });
  });

  describe('areStatesEquivalent', () => {
    it('returns true for equivalent states (ignoring savedAt)', () => {
      const state1: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-1',
        exercisePosition: {
          sessionId: 's1',
          questionIndex: 3,
          totalQuestions: 10,
          sessionType: 'revision',
        },
        unsavedInput: {
          context: 'form',
          value: 'text',
          fieldId: 'f1',
        },
        savedAt: new Date('2025-01-01T10:00:00Z'),
      };

      const state2: PlatformState = {
        ...state1,
        savedAt: new Date('2025-01-01T12:00:00Z'), // different timestamp
      };

      expect(areStatesEquivalent(state1, state2)).toBe(true);
    });

    it('returns false for different learner IDs', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
        savedAt: new Date(),
      };

      expect(areStatesEquivalent(base, { ...base, learnerId: 'learner-2' })).toBe(false);
    });

    it('returns false for different active subjects', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
        savedAt: new Date(),
      };

      expect(areStatesEquivalent(base, { ...base, activeSubjectId: 'maths' })).toBe(false);
    });

    it('returns false for different active chapters', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-1',
        exercisePosition: null,
        unsavedInput: null,
        savedAt: new Date(),
      };

      expect(areStatesEquivalent(base, { ...base, activeChapterId: 'ch-2' })).toBe(false);
    });

    it('returns false when one has exercise position and other does not', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
        savedAt: new Date(),
      };

      const withPosition: PlatformState = {
        ...base,
        exercisePosition: {
          sessionId: 's1',
          questionIndex: 0,
          totalQuestions: 5,
          sessionType: 'grammar',
        },
      };

      expect(areStatesEquivalent(base, withPosition)).toBe(false);
    });

    it('returns false for different exercise positions', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: {
          sessionId: 's1',
          questionIndex: 3,
          totalQuestions: 10,
          sessionType: 'comprehension',
        },
        unsavedInput: null,
        savedAt: new Date(),
      };

      const different: PlatformState = {
        ...base,
        exercisePosition: {
          sessionId: 's1',
          questionIndex: 5, // different
          totalQuestions: 10,
          sessionType: 'comprehension',
        },
      };

      expect(areStatesEquivalent(base, different)).toBe(false);
    });

    it('returns false when one has unsaved input and other does not', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
        savedAt: new Date(),
      };

      const withInput: PlatformState = {
        ...base,
        unsavedInput: { context: 'form', value: 'text' },
      };

      expect(areStatesEquivalent(base, withInput)).toBe(false);
    });

    it('returns false for different unsaved input values', () => {
      const base: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: { context: 'form', value: 'text1' },
        savedAt: new Date(),
      };

      const different: PlatformState = {
        ...base,
        unsavedInput: { context: 'form', value: 'text2' },
      };

      expect(areStatesEquivalent(base, different)).toBe(false);
    });

    it('handles both null exercise positions as equivalent', () => {
      const state1: PlatformState = {
        learnerId: 'learner-1',
        activeSubjectId: 'kannada',
        activeChapterId: null,
        exercisePosition: null,
        unsavedInput: null,
        savedAt: new Date('2025-01-01'),
      };

      const state2: PlatformState = {
        ...state1,
        savedAt: new Date('2025-06-01'),
      };

      expect(areStatesEquivalent(state1, state2)).toBe(true);
    });
  });

  describe('save and restore round-trip', () => {
    it('restores equivalent state after save', () => {
      const original = savePlatformState('learner-1', {
        activeSubjectId: 'kannada',
        activeChapterId: 'ch-3',
        exercisePosition: {
          sessionId: 'rev-1',
          questionIndex: 4,
          totalQuestions: 20,
          sessionType: 'revision',
        },
        unsavedInput: {
          context: 'answer-box',
          value: 'ನಾನು ಓದುತ್ತಿದ್ದೇನೆ',
          fieldId: 'q4',
        },
      });

      const restored = restorePlatformState('learner-1');
      expect(restored).not.toBeNull();
      expect(areStatesEquivalent(original, restored!)).toBe(true);
    });

    it('preserves all session types in exercise position', () => {
      const sessionTypes = ['comprehension', 'revision', 'grammar', 'pronunciation'] as const;

      for (const sessionType of sessionTypes) {
        clearAllPlatformStates();

        const saved = savePlatformState('learner-1', {
          activeSubjectId: 'english',
          activeChapterId: 'ch-1',
          exercisePosition: {
            sessionId: `session-${sessionType}`,
            questionIndex: 2,
            totalQuestions: 8,
            sessionType,
          },
          unsavedInput: null,
        });

        const restored = restorePlatformState('learner-1');
        expect(areStatesEquivalent(saved, restored!)).toBe(true);
      }
    });
  });
});
