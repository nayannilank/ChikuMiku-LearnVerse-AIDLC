/**
 * Platform State Restoration
 *
 * Saves and restores application state when switching between platforms:
 * - Active subject
 * - Active chapter
 * - Exercise position
 * - Unsaved input
 *
 * Requirements: 7.4
 */

// --- Types ---

export interface PlatformState {
  learnerId: string;
  activeSubjectId: string | null;
  activeChapterId: string | null;
  exercisePosition: ExercisePosition | null;
  unsavedInput: UnsavedInput | null;
  savedAt: Date;
}

export interface ExercisePosition {
  sessionId: string;
  questionIndex: number;
  totalQuestions: number;
  sessionType: 'comprehension' | 'revision' | 'grammar' | 'pronunciation';
}

export interface UnsavedInput {
  /** The context where the input was being entered */
  context: string;
  /** The actual unsaved text/data */
  value: string;
  /** Optional field identifier */
  fieldId?: string;
}

// --- State Store ---

/** In-memory store for platform state, keyed by learnerId */
const stateStore = new Map<string, PlatformState>();

// --- Public API ---

/**
 * Save the current platform state for a learner.
 * This is called when the learner leaves the app or before syncing.
 */
export function savePlatformState(
  learnerId: string,
  state: Omit<PlatformState, 'learnerId' | 'savedAt'>,
  now?: Date
): PlatformState {
  const platformState: PlatformState = {
    learnerId,
    activeSubjectId: state.activeSubjectId,
    activeChapterId: state.activeChapterId,
    exercisePosition: state.exercisePosition,
    unsavedInput: state.unsavedInput,
    savedAt: now ?? new Date(),
  };

  stateStore.set(learnerId, platformState);
  return platformState;
}

/**
 * Restore the platform state for a learner.
 * This is called when the learner opens the app on a different platform.
 * Returns null if no saved state exists.
 */
export function restorePlatformState(learnerId: string): PlatformState | null {
  return stateStore.get(learnerId) ?? null;
}

/**
 * Check if a saved platform state exists for a learner.
 */
export function hasSavedState(learnerId: string): boolean {
  return stateStore.has(learnerId);
}

/**
 * Clear the saved platform state for a learner (after successful restoration).
 */
export function clearPlatformState(learnerId: string): void {
  stateStore.delete(learnerId);
}

/**
 * Update a specific field of the platform state without replacing the entire state.
 * Useful for incrementally saving state as the learner navigates.
 */
export function updatePlatformState(
  learnerId: string,
  updates: Partial<Omit<PlatformState, 'learnerId' | 'savedAt'>>,
  now?: Date
): PlatformState | null {
  const existing = stateStore.get(learnerId);
  if (!existing) return null;

  const updated: PlatformState = {
    ...existing,
    ...updates,
    savedAt: now ?? new Date(),
  };

  stateStore.set(learnerId, updated);
  return updated;
}

/**
 * Compare two platform states for equivalence (ignoring savedAt timestamp).
 * Used to verify state restoration correctness.
 */
export function areStatesEquivalent(a: PlatformState, b: PlatformState): boolean {
  if (a.learnerId !== b.learnerId) return false;
  if (a.activeSubjectId !== b.activeSubjectId) return false;
  if (a.activeChapterId !== b.activeChapterId) return false;

  // Compare exercise position
  if (a.exercisePosition === null && b.exercisePosition === null) {
    // both null, ok
  } else if (a.exercisePosition === null || b.exercisePosition === null) {
    return false;
  } else {
    if (a.exercisePosition.sessionId !== b.exercisePosition.sessionId) return false;
    if (a.exercisePosition.questionIndex !== b.exercisePosition.questionIndex) return false;
    if (a.exercisePosition.totalQuestions !== b.exercisePosition.totalQuestions) return false;
    if (a.exercisePosition.sessionType !== b.exercisePosition.sessionType) return false;
  }

  // Compare unsaved input
  if (a.unsavedInput === null && b.unsavedInput === null) {
    // both null, ok
  } else if (a.unsavedInput === null || b.unsavedInput === null) {
    return false;
  } else {
    if (a.unsavedInput.context !== b.unsavedInput.context) return false;
    if (a.unsavedInput.value !== b.unsavedInput.value) return false;
    if (a.unsavedInput.fieldId !== b.unsavedInput.fieldId) return false;
  }

  return true;
}

/**
 * Clear all stored states (for testing).
 */
export function clearAllPlatformStates(): void {
  stateStore.clear();
}
