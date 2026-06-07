import type {DeviceStorageInterface} from '@learnverse/platform-contracts';

/**
 * Key used to store unsaved learner input in device storage.
 */
const UNSAVED_INPUT_KEY = 'unsaved_learner_input';

/**
 * Represents the shape of unsaved input that can be preserved.
 */
export interface UnsavedInput {
  /** The screen where the learner was working */
  screen: string;
  /** Timestamp when the input was saved */
  savedAt: number;
  /** Form field values or other learner input */
  data: Record<string, unknown>;
}

/**
 * Result of attempting to preserve unsaved input.
 */
export interface PreserveResult {
  success: boolean;
  error?: string;
}

/**
 * Attempts to save any current unsaved learner input to device storage.
 * If storage fails (due to device storage limits or permissions), returns
 * a failure result with an error message.
 *
 * Requirements: 1.6
 *
 * @param storage - DeviceStorageInterface implementation
 * @param input - The unsaved input to preserve
 * @returns PreserveResult indicating success or failure with error message
 */
export async function preserveUnsavedInput(
  storage: DeviceStorageInterface,
  input: UnsavedInput,
): Promise<PreserveResult> {
  try {
    const serialized = JSON.stringify(input);
    await storage.setItem(UNSAVED_INPUT_KEY, serialized);
    return {success: true};
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to save your work. Storage may be full or unavailable.';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Retrieves previously preserved unsaved input from device storage.
 * Returns null if no saved input exists or if retrieval fails.
 *
 * @param storage - DeviceStorageInterface implementation
 * @returns The previously saved UnsavedInput or null
 */
export async function retrieveUnsavedInput(
  storage: DeviceStorageInterface,
): Promise<UnsavedInput | null> {
  try {
    const raw = await storage.getItem(UNSAVED_INPUT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UnsavedInput;
  } catch {
    return null;
  }
}

/**
 * Clears any preserved unsaved input from device storage.
 *
 * @param storage - DeviceStorageInterface implementation
 */
export async function clearUnsavedInput(
  storage: DeviceStorageInterface,
): Promise<void> {
  try {
    await storage.removeItem(UNSAVED_INPUT_KEY);
  } catch {
    // Best-effort removal; ignore errors
  }
}
