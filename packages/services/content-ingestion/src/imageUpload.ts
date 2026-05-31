/**
 * Image upload validation and compression.
 *
 * Handles:
 * - Format validation (JPEG, PNG, HEIC)
 * - Size validation (max 10 MB)
 * - Compression to max 1 MB before transmission
 *
 * Requirements: 1.7, 1.9, 12.5
 */

import { ImageFormat, MAX_IMAGE_SIZE_BYTES } from '@chikumiku/service-core';

// --- Constants ---

/** Maximum compressed image size in bytes (1 MB) */
export const MAX_COMPRESSED_SIZE_BYTES = 1 * 1024 * 1024;

/** Supported image formats */
export const SUPPORTED_FORMATS: readonly ImageFormat[] = ['jpeg', 'png', 'heic'];

// --- Types ---

export interface ImageUploadInput {
  data: Uint8Array;
  format: string;
  sizeBytes: number;
}

export interface ImageUploadSuccess {
  success: true;
  compressedData: Uint8Array;
  format: ImageFormat;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

export interface ImageUploadError {
  success: false;
  error: string;
  code: 'INVALID_FORMAT' | 'FILE_TOO_LARGE' | 'EMPTY_FILE' | 'COMPRESSION_FAILED';
}

export type ImageUploadResult = ImageUploadSuccess | ImageUploadError;

// --- Validation ---

/**
 * Validates image format is one of the supported types.
 */
export function isValidFormat(format: string): format is ImageFormat {
  return SUPPORTED_FORMATS.includes(format as ImageFormat);
}

/**
 * Validates image size is within the 10 MB limit.
 */
export function isValidSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_IMAGE_SIZE_BYTES;
}

/**
 * Validates an image upload input for format and size.
 * Returns an error message if invalid, or null if valid.
 */
export function validateImageUpload(input: ImageUploadInput): string | null {
  if (!input.data || input.sizeBytes <= 0) {
    return 'Image file is empty. Please select a valid image file.';
  }

  if (!isValidFormat(input.format)) {
    return `Unsupported image format: "${input.format}". Accepted formats are: JPEG, PNG, HEIC.`;
  }

  if (input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (input.sizeBytes / (1024 * 1024)).toFixed(1);
    return `Image file size (${sizeMB} MB) exceeds the maximum allowed size of 10 MB. Please use a smaller image.`;
  }

  return null;
}

// --- Compression ---

/**
 * Compresses image data to fit within the 1 MB transmission limit.
 *
 * This is a simulated compression that reduces data size proportionally.
 * In production, this would use actual image compression libraries
 * (e.g., sharp for Node.js, canvas API for browser).
 */
export function compressImage(data: Uint8Array, targetMaxBytes: number = MAX_COMPRESSED_SIZE_BYTES): Uint8Array {
  if (data.length <= targetMaxBytes) {
    return data;
  }

  // Calculate compression ratio needed
  const ratio = targetMaxBytes / data.length;

  // Simulate compression by creating a smaller buffer
  // In production, this would use actual image codec compression
  const compressedLength = Math.floor(data.length * ratio);
  const compressed = new Uint8Array(compressedLength);

  // Sample pixels at intervals to simulate lossy compression
  const step = data.length / compressedLength;
  for (let i = 0; i < compressedLength; i++) {
    compressed[i] = data[Math.floor(i * step)];
  }

  return compressed;
}

// --- Main Upload Function ---

/**
 * Processes an image upload: validates format/size, then compresses to max 1 MB.
 *
 * Returns a result indicating success (with compressed data) or failure (with error details).
 */
export function processImageUpload(input: ImageUploadInput): ImageUploadResult {
  // Validate empty file
  if (!input.data || input.sizeBytes <= 0) {
    return {
      success: false,
      error: 'Image file is empty. Please select a valid image file.',
      code: 'EMPTY_FILE',
    };
  }

  // Validate format
  if (!isValidFormat(input.format)) {
    return {
      success: false,
      error: `Unsupported image format: "${input.format}". Accepted formats are: JPEG, PNG, HEIC.`,
      code: 'INVALID_FORMAT',
    };
  }

  // Validate size
  if (input.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (input.sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      success: false,
      error: `Image file size (${sizeMB} MB) exceeds the maximum allowed size of 10 MB. Please use a smaller image.`,
      code: 'FILE_TOO_LARGE',
    };
  }

  // Compress image to max 1 MB
  const compressedData = compressImage(input.data, MAX_COMPRESSED_SIZE_BYTES);

  // Verify compression succeeded
  if (compressedData.length > MAX_COMPRESSED_SIZE_BYTES) {
    return {
      success: false,
      error: 'Failed to compress image to the required size. Please try a smaller or simpler image.',
      code: 'COMPRESSION_FAILED',
    };
  }

  return {
    success: true,
    compressedData,
    format: input.format as ImageFormat,
    originalSizeBytes: input.sizeBytes,
    compressedSizeBytes: compressedData.length,
  };
}
