/**
 * Validation functions for core data models.
 *
 * All validators return a typed Result: either success with the validated value,
 * or an error with a descriptive message.
 */

import { Grade, ImageFormat, ImageInput, MAX_IMAGE_SIZE_BYTES } from './types';

// --- Result Type ---

export interface ValidationSuccess<T> {
  success: true;
  value: T;
}

export interface ValidationError {
  success: false;
  error: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// --- Grade Validation ---

const VALID_GRADES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Validates that a value is a valid Grade (integer 1-12).
 */
export function validateGrade(value: unknown): ValidationResult<Grade> {
  if (typeof value !== 'number') {
    return { success: false, error: 'Grade must be a number' };
  }

  if (!Number.isInteger(value)) {
    return { success: false, error: 'Grade must be an integer' };
  }

  if (!VALID_GRADES.includes(value)) {
    return { success: false, error: 'Grade must be between 1 and 12' };
  }

  return { success: true, value: value as Grade };
}

// --- Image Input Validation ---

const VALID_IMAGE_FORMATS: readonly ImageFormat[] = ['jpeg', 'png', 'heic'];

/**
 * Validates an image input for format and size constraints.
 *
 * - Format must be jpeg, png, or heic
 * - Size must be at most 10 MB (10,485,760 bytes)
 */
export function validateImageInput(input: {
  format: string;
  sizeBytes: number;
}): ValidationResult<{ format: ImageFormat; sizeBytes: number }> {
  if (!VALID_IMAGE_FORMATS.includes(input.format as ImageFormat)) {
    return {
      success: false,
      error: `Image format must be one of: ${VALID_IMAGE_FORMATS.join(', ')}. Received: ${input.format}`,
    };
  }

  if (typeof input.sizeBytes !== 'number' || !Number.isFinite(input.sizeBytes)) {
    return { success: false, error: 'Image size must be a valid number' };
  }

  if (input.sizeBytes <= 0) {
    return { success: false, error: 'Image size must be greater than 0' };
  }

  if (input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      success: false,
      error: `Image size must not exceed 10 MB (${MAX_IMAGE_SIZE_BYTES} bytes). Received: ${input.sizeBytes} bytes`,
    };
  }

  return {
    success: true,
    value: { format: input.format as ImageFormat, sizeBytes: input.sizeBytes },
  };
}
