import { describe, it, expect } from 'vitest';
import {
  processImageUpload,
  validateImageUpload,
  isValidFormat,
  isValidSize,
  compressImage,
  MAX_COMPRESSED_SIZE_BYTES,
  SUPPORTED_FORMATS,
} from './imageUpload';
import { MAX_IMAGE_SIZE_BYTES } from '@learnverse/service-core';

describe('imageUpload', () => {
  describe('isValidFormat', () => {
    it('accepts jpeg format', () => {
      expect(isValidFormat('jpeg')).toBe(true);
    });

    it('accepts png format', () => {
      expect(isValidFormat('png')).toBe(true);
    });

    it('accepts heic format', () => {
      expect(isValidFormat('heic')).toBe(true);
    });

    it('rejects gif format', () => {
      expect(isValidFormat('gif')).toBe(false);
    });

    it('rejects bmp format', () => {
      expect(isValidFormat('bmp')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidFormat('')).toBe(false);
    });
  });

  describe('isValidSize', () => {
    it('accepts 1 byte', () => {
      expect(isValidSize(1)).toBe(true);
    });

    it('accepts exactly 10 MB', () => {
      expect(isValidSize(MAX_IMAGE_SIZE_BYTES)).toBe(true);
    });

    it('rejects 0 bytes', () => {
      expect(isValidSize(0)).toBe(false);
    });

    it('rejects negative size', () => {
      expect(isValidSize(-1)).toBe(false);
    });

    it('rejects size exceeding 10 MB', () => {
      expect(isValidSize(MAX_IMAGE_SIZE_BYTES + 1)).toBe(false);
    });
  });

  describe('validateImageUpload', () => {
    it('returns null for valid jpeg under 10 MB', () => {
      const result = validateImageUpload({
        data: new Uint8Array(1000),
        format: 'jpeg',
        sizeBytes: 1000,
      });
      expect(result).toBeNull();
    });

    it('returns error for empty data', () => {
      const result = validateImageUpload({
        data: new Uint8Array(0),
        format: 'jpeg',
        sizeBytes: 0,
      });
      expect(result).toContain('empty');
    });

    it('returns error for unsupported format', () => {
      const result = validateImageUpload({
        data: new Uint8Array(100),
        format: 'tiff',
        sizeBytes: 100,
      });
      expect(result).toContain('Unsupported');
      expect(result).toContain('tiff');
    });

    it('returns error for oversized file', () => {
      const result = validateImageUpload({
        data: new Uint8Array(100),
        format: 'png',
        sizeBytes: MAX_IMAGE_SIZE_BYTES + 1,
      });
      expect(result).toContain('exceeds');
      expect(result).toContain('10 MB');
    });
  });

  describe('compressImage', () => {
    it('returns data unchanged if already under target size', () => {
      const data = new Uint8Array(500);
      const result = compressImage(data, MAX_COMPRESSED_SIZE_BYTES);
      expect(result.length).toBe(500);
    });

    it('compresses data to at most the target size', () => {
      const data = new Uint8Array(2 * 1024 * 1024); // 2 MB
      const result = compressImage(data, MAX_COMPRESSED_SIZE_BYTES);
      expect(result.length).toBeLessThanOrEqual(MAX_COMPRESSED_SIZE_BYTES);
    });

    it('compresses large data to at most 1 MB', () => {
      const data = new Uint8Array(5 * 1024 * 1024); // 5 MB
      const result = compressImage(data, MAX_COMPRESSED_SIZE_BYTES);
      expect(result.length).toBeLessThanOrEqual(MAX_COMPRESSED_SIZE_BYTES);
    });
  });

  describe('processImageUpload', () => {
    it('succeeds for valid jpeg image', () => {
      const data = new Uint8Array(500 * 1024); // 500 KB
      const result = processImageUpload({
        data,
        format: 'jpeg',
        sizeBytes: data.length,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.format).toBe('jpeg');
        expect(result.originalSizeBytes).toBe(data.length);
        expect(result.compressedSizeBytes).toBeLessThanOrEqual(MAX_COMPRESSED_SIZE_BYTES);
      }
    });

    it('succeeds for valid png image', () => {
      const data = new Uint8Array(200 * 1024); // 200 KB
      const result = processImageUpload({
        data,
        format: 'png',
        sizeBytes: data.length,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.format).toBe('png');
      }
    });

    it('succeeds for valid heic image', () => {
      const data = new Uint8Array(100 * 1024); // 100 KB
      const result = processImageUpload({
        data,
        format: 'heic',
        sizeBytes: data.length,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.format).toBe('heic');
      }
    });

    it('compresses images larger than 1 MB to at most 1 MB', () => {
      const data = new Uint8Array(5 * 1024 * 1024); // 5 MB
      const result = processImageUpload({
        data,
        format: 'jpeg',
        sizeBytes: data.length,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.compressedSizeBytes).toBeLessThanOrEqual(MAX_COMPRESSED_SIZE_BYTES);
      }
    });

    it('fails for empty file', () => {
      const result = processImageUpload({
        data: new Uint8Array(0),
        format: 'jpeg',
        sizeBytes: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_FILE');
      }
    });

    it('fails for unsupported format', () => {
      const result = processImageUpload({
        data: new Uint8Array(100),
        format: 'gif',
        sizeBytes: 100,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_FORMAT');
        expect(result.error).toContain('gif');
      }
    });

    it('fails for file exceeding 10 MB', () => {
      const result = processImageUpload({
        data: new Uint8Array(100),
        format: 'jpeg',
        sizeBytes: MAX_IMAGE_SIZE_BYTES + 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('FILE_TOO_LARGE');
      }
    });
  });
});
