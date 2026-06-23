/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWebPlatformProvider } from '../index';
import type { CameraInterface } from '@learnverse/platform-contracts';

/**
 * Unit tests for WebCamera adapter.
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4
 */

// --- Helpers to mock browser APIs ---

function mockMediaDevices(overrides: Partial<MediaDevices> = {}) {
  const mediaDevices = {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn(),
    ...overrides,
  } as unknown as MediaDevices;

  Object.defineProperty(navigator, 'mediaDevices', {
    value: mediaDevices,
    writable: true,
    configurable: true,
  });

  return mediaDevices;
}

function removeMediaDevices() {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

function createMockStream() {
  const stopFn = vi.fn();
  const track = { stop: stopFn, kind: 'video' };
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    stopFn,
  };
}

function createMockVideoElement(width = 640, height = 480) {
  const videoEl = {
    srcObject: null as unknown,
    videoWidth: width,
    videoHeight: height,
    onloadedmetadata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    setAttribute: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
  };
  return videoEl;
}

function createMockCanvasElement(blobData = new ArrayBuffer(100)) {
  const ctx = {
    drawImage: vi.fn(),
  };
  const canvasEl = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(ctx),
    toBlob: vi.fn((callback: (blob: Blob | null) => void, _mimeType: string, _quality: number) => {
      const blob = new Blob([blobData], { type: 'image/jpeg' });
      callback(blob);
    }),
  };
  return { canvasEl, ctx };
}

describe('WebCamera', () => {
  let camera: CameraInterface;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset navigator.mediaDevices
    removeMediaDevices();
    camera = createWebPlatformProvider().camera;
  });

  describe('isAvailable()', () => {
    it('returns true when mediaDevices is supported and video input exists', async () => {
      const mediaDevices = mockMediaDevices();
      (mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam1', label: 'Camera' },
      ]);

      // Create camera after mocking
      camera = createWebPlatformProvider().camera;

      const result = await camera.isAvailable();
      expect(result).toBe(true);
      expect(camera.getLastError()).toBeNull();
    });

    it('returns false and sets CAMERA_UNAVAILABLE when mediaDevices API is not supported', async () => {
      removeMediaDevices();
      camera = createWebPlatformProvider().camera;

      const result = await camera.isAvailable();
      expect(result).toBe(false);

      const error = camera.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('CAMERA_UNAVAILABLE');
      expect(error!.message).toContain('not supported');
    });

    it('returns false when no video input devices exist', async () => {
      const mediaDevices = mockMediaDevices();
      (mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([
        { kind: 'audioinput', deviceId: 'mic1', label: 'Microphone' },
      ]);

      camera = createWebPlatformProvider().camera;

      const result = await camera.isAvailable();
      expect(result).toBe(false);

      const error = camera.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('CAMERA_UNAVAILABLE');
      expect(error!.message).toContain('No video input');
    });

    it('returns false when enumerateDevices throws', async () => {
      const mediaDevices = mockMediaDevices();
      (mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Permission error')
      );

      camera = createWebPlatformProvider().camera;

      const result = await camera.isAvailable();
      expect(result).toBe(false);

      const error = camera.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('CAMERA_UNAVAILABLE');
    });
  });

  describe('requestPermission()', () => {
    it('returns true on success and stops tracks', async () => {
      const { stream, stopFn } = createMockStream();
      const mediaDevices = mockMediaDevices();
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(stream);

      camera = createWebPlatformProvider().camera;

      const result = await camera.requestPermission();
      expect(result).toBe(true);
      expect(stopFn).toHaveBeenCalled();
      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true });
    });

    it('returns false with PERMISSION_DENIED on NotAllowedError', async () => {
      const mediaDevices = mockMediaDevices();
      const error = new DOMException('User denied', 'NotAllowedError');
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      camera = createWebPlatformProvider().camera;

      const result = await camera.requestPermission();
      expect(result).toBe(false);

      const lastError = camera.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError!.code).toBe('PERMISSION_DENIED');
      expect(lastError!.message).toContain('denied');
    });

    it('returns false with PERMISSION_DENIED on PermissionDeniedError', async () => {
      const mediaDevices = mockMediaDevices();
      const error = new DOMException('Permission denied', 'PermissionDeniedError');
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      camera = createWebPlatformProvider().camera;

      const result = await camera.requestPermission();
      expect(result).toBe(false);

      const lastError = camera.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError!.code).toBe('PERMISSION_DENIED');
    });

    it('returns false with CAMERA_UNAVAILABLE when mediaDevices API is missing', async () => {
      removeMediaDevices();
      camera = createWebPlatformProvider().camera;

      const result = await camera.requestPermission();
      expect(result).toBe(false);

      const lastError = camera.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError!.code).toBe('CAMERA_UNAVAILABLE');
    });

    it('returns false with CAMERA_UNAVAILABLE on generic error', async () => {
      const mediaDevices = mockMediaDevices();
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Hardware failure')
      );

      camera = createWebPlatformProvider().camera;

      const result = await camera.requestPermission();
      expect(result).toBe(false);

      const lastError = camera.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError!.code).toBe('CAMERA_UNAVAILABLE');
    });
  });

  describe('capture()', () => {
    it('produces a valid CameraCaptureResult', async () => {
      const imageData = new ArrayBuffer(200);
      const { stream, stopFn } = createMockStream();
      const mediaDevices = mockMediaDevices();
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(stream);

      const videoEl = createMockVideoElement(800, 600);
      const { canvasEl } = createMockCanvasElement(imageData);

      // Mock document.createElement to return our mocked elements
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'video') return videoEl as unknown as HTMLElement;
        if (tag === 'canvas') return canvasEl as unknown as HTMLElement;
        return originalCreateElement(tag);
      });

      camera = createWebPlatformProvider().camera;

      // Trigger the video loadedmetadata callback asynchronously
      const capturePromise = camera.capture({ format: 'jpeg', quality: 80 });

      // Wait a tick for the promise chain to set up the onloadedmetadata handler
      await new Promise(resolve => setTimeout(resolve, 0));
      if (videoEl.onloadedmetadata) {
        videoEl.onloadedmetadata();
      }

      const result = await capturePromise;

      expect(result).toBeDefined();
      expect(result.format).toBe('jpeg');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      // Stream tracks should be stopped in the finally block
      expect(stopFn).toHaveBeenCalled();
    });

    it('rejects when getUserMedia throws NotAllowedError during capture', async () => {
      const mediaDevices = mockMediaDevices();
      const error = new DOMException('Permission denied', 'NotAllowedError');
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      camera = createWebPlatformProvider().camera;

      // DOMException has a numeric 'code' property, so the implementation's
      // catch block takes the early re-throw path. The capture rejects with the DOMException.
      await expect(camera.capture({ format: 'jpeg', quality: 80 })).rejects.toThrow();
    });

    it('sets CAPTURE_FAILED and rejects when getUserMedia throws a generic error', async () => {
      const mediaDevices = mockMediaDevices();
      const error = new Error('Hardware failure');
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      camera = createWebPlatformProvider().camera;

      await expect(camera.capture({ format: 'jpeg', quality: 80 })).rejects.toMatchObject({
        code: 'CAPTURE_FAILED',
      });

      const lastError = camera.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError!.code).toBe('CAPTURE_FAILED');
    });

    it('sets CAMERA_UNAVAILABLE when mediaDevices API is missing', async () => {
      removeMediaDevices();
      camera = createWebPlatformProvider().camera;

      await expect(camera.capture({ format: 'png', quality: 100 })).rejects.toMatchObject({
        code: 'CAMERA_UNAVAILABLE',
      });

      const lastError = camera.getLastError();
      expect(lastError).not.toBeNull();
      expect(lastError!.code).toBe('CAMERA_UNAVAILABLE');
    });

    it('passes capture options as video constraints', async () => {
      const { stream } = createMockStream();
      const mediaDevices = mockMediaDevices();
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(stream);

      const videoEl = createMockVideoElement(1920, 1080);
      const { canvasEl } = createMockCanvasElement();

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'video') return videoEl as unknown as HTMLElement;
        if (tag === 'canvas') return canvasEl as unknown as HTMLElement;
        return originalCreateElement(tag);
      });

      camera = createWebPlatformProvider().camera;

      const capturePromise = camera.capture({ format: 'png', quality: 90, maxWidth: 1920, maxHeight: 1080 });

      await new Promise(resolve => setTimeout(resolve, 0));
      if (videoEl.onloadedmetadata) {
        videoEl.onloadedmetadata();
      }

      await capturePromise;

      expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    });
  });

  describe('getLastError()', () => {
    it('returns null initially', () => {
      camera = createWebPlatformProvider().camera;
      expect(camera.getLastError()).toBeNull();
    });

    it('returns the appropriate error after isAvailable fails', async () => {
      removeMediaDevices();
      camera = createWebPlatformProvider().camera;

      await camera.isAvailable();
      const error = camera.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('CAMERA_UNAVAILABLE');
    });

    it('returns PERMISSION_DENIED after requestPermission denial', async () => {
      const mediaDevices = mockMediaDevices();
      const domError = new DOMException('Denied', 'NotAllowedError');
      (mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(domError);

      camera = createWebPlatformProvider().camera;

      await camera.requestPermission();
      const error = camera.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('PERMISSION_DENIED');
    });

    it('returns CAMERA_UNAVAILABLE after capture fails due to missing API', async () => {
      removeMediaDevices();
      camera = createWebPlatformProvider().camera;

      try {
        await camera.capture({ format: 'jpeg', quality: 80 });
      } catch {
        // expected
      }

      const error = camera.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('CAMERA_UNAVAILABLE');
    });
  });
});
