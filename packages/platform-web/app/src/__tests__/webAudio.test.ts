/**
 * @vitest-environment jsdom
 */
/**
 * Unit Tests: WebAudio
 *
 * Tests for the WebAudio adapter's recording and playback functionality,
 * mocking MediaRecorder, AudioContext, and navigator.mediaDevices.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebPlatformProvider } from '../index';
import type { AudioInterface } from '@learnverse/platform-contracts';

// --- Mock Helpers ---

function createMockMediaStream(tracks: { stop: ReturnType<typeof vi.fn> }[] = [{ stop: vi.fn() }]) {
  return {
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

function createMockMediaRecorder() {
  const recorder = {
    state: 'inactive' as string,
    ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null,
    start: vi.fn(function (this: typeof recorder) {
      this.state = 'recording';
    }),
    stop: vi.fn(function (this: typeof recorder) {
      this.state = 'inactive';
      // Simulate async stop - call onstop in next microtask
      setTimeout(() => {
        if (this.onstop) this.onstop();
      }, 0);
    }),
  };
  return recorder;
}

function setupMediaDevices(options: {
  hasGetUserMedia?: boolean;
  devices?: MediaDeviceInfo[];
  getUserMediaResult?: MediaStream;
  getUserMediaError?: Error;
}) {
  const {
    hasGetUserMedia = true,
    devices = [{ kind: 'audioinput', deviceId: 'default', label: 'Mic', groupId: 'g1' } as MediaDeviceInfo],
    getUserMediaResult,
    getUserMediaError,
  } = options;

  if (!hasGetUserMedia) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    return;
  }

  const mediaDevices = {
    getUserMedia: getUserMediaError
      ? vi.fn().mockRejectedValue(getUserMediaError)
      : vi.fn().mockResolvedValue(getUserMediaResult ?? createMockMediaStream()),
    enumerateDevices: vi.fn().mockResolvedValue(devices),
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    value: mediaDevices,
    writable: true,
    configurable: true,
  });
}

// --- Test Suite ---

describe('WebAudio', () => {
  let audio: AudioInterface;

  beforeEach(() => {
    audio = createWebPlatformProvider().audio;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- isMicrophoneAvailable ---

  describe('isMicrophoneAvailable()', () => {
    it('returns true when audio input device is present', async () => {
      setupMediaDevices({
        devices: [{ kind: 'audioinput', deviceId: 'mic1', label: 'Mic', groupId: 'g1' } as MediaDeviceInfo],
      });

      const result = await audio.isMicrophoneAvailable();
      expect(result).toBe(true);
    });

    it('returns false with MICROPHONE_UNAVAILABLE when MediaDevices API is missing', async () => {
      setupMediaDevices({ hasGetUserMedia: false });

      const result = await audio.isMicrophoneAvailable();
      expect(result).toBe(false);
      expect(audio.getLastError()).toEqual({
        code: 'MICROPHONE_UNAVAILABLE',
        message: expect.any(String),
      });
    });

    it('returns false when no audio input devices are found', async () => {
      setupMediaDevices({
        devices: [{ kind: 'videoinput', deviceId: 'cam1', label: 'Cam', groupId: 'g1' } as MediaDeviceInfo],
      });

      const result = await audio.isMicrophoneAvailable();
      expect(result).toBe(false);
      expect(audio.getLastError()).toEqual({
        code: 'MICROPHONE_UNAVAILABLE',
        message: 'No audio input devices found',
      });
    });
  });

  // --- requestMicrophonePermission ---

  describe('requestMicrophonePermission()', () => {
    it('returns true on success and stops tracks', async () => {
      const stopFn = vi.fn();
      const mockStream = createMockMediaStream([{ stop: stopFn }]);
      setupMediaDevices({ getUserMediaResult: mockStream });

      const result = await audio.requestMicrophonePermission();
      expect(result).toBe(true);
      expect(stopFn).toHaveBeenCalled();
    });

    it('returns false with MICROPHONE_DENIED on NotAllowedError', async () => {
      const error = new DOMException('Permission denied', 'NotAllowedError');
      setupMediaDevices({ getUserMediaError: error });

      const result = await audio.requestMicrophonePermission();
      expect(result).toBe(false);
      expect(audio.getLastError()).toEqual({
        code: 'MICROPHONE_DENIED',
        message: expect.any(String),
      });
    });

    it('returns false with MICROPHONE_UNAVAILABLE when API is not supported', async () => {
      setupMediaDevices({ hasGetUserMedia: false });

      const result = await audio.requestMicrophonePermission();
      expect(result).toBe(false);
      expect(audio.getLastError()).toEqual({
        code: 'MICROPHONE_UNAVAILABLE',
        message: expect.any(String),
      });
    });
  });

  // --- startRecording ---

  describe('startRecording()', () => {
    it('creates MediaRecorder with correct options', async () => {
      const mockStream = createMockMediaStream();
      setupMediaDevices({ getUserMediaResult: mockStream });

      let capturedStream: unknown;
      let capturedOptions: unknown;
      const mockRecorder = createMockMediaRecorder();

      function MockMediaRecorderCtor(stream: unknown, options: unknown) {
        capturedStream = stream;
        capturedOptions = options;
        return mockRecorder;
      }
      MockMediaRecorderCtor.isTypeSupported = vi.fn().mockReturnValue(true);
      vi.stubGlobal('MediaRecorder', MockMediaRecorderCtor);

      await audio.startRecording({ maxDurationSeconds: 30, format: 'wav', sampleRate: 44100 });

      expect(capturedStream).toBe(mockStream);
      expect(capturedOptions).toEqual({ mimeType: 'audio/wav' });
      expect(mockRecorder.start).toHaveBeenCalledWith(100);
    });

    it('sets MICROPHONE_DENIED on permission denial', async () => {
      const error = new DOMException('Permission denied', 'NotAllowedError');
      setupMediaDevices({ getUserMediaError: error });

      await audio.startRecording({ maxDurationSeconds: 30, format: 'wav' });

      expect(audio.getLastError()).toEqual({
        code: 'MICROPHONE_DENIED',
        message: expect.any(String),
      });
    });
  });

  // --- stopRecording ---

  describe('stopRecording()', () => {
    it('assembles chunks and returns AudioRecordingResult', async () => {
      const mockStream = createMockMediaStream();
      setupMediaDevices({ getUserMediaResult: mockStream });

      // Set up a more realistic mock recorder that simulates data events
      let ondataavailable: ((event: { data: Blob }) => void) | null = null;
      let onstop: (() => void) | null = null;
      const mockRecorderInstance = {
        state: 'inactive' as string,
        ondataavailable: null as ((event: { data: Blob }) => void) | null,
        onstop: null as (() => void) | null,
        start: vi.fn(function (this: typeof mockRecorderInstance) {
          this.state = 'recording';
        }),
        stop: vi.fn(function (this: typeof mockRecorderInstance) {
          this.state = 'inactive';
          // Simulate receiving data before stop completes
          if (ondataavailable) {
            ondataavailable({ data: new Blob(['hello audio'], { type: 'audio/wav' }) });
          }
          // Call onstop async
          setTimeout(() => {
            if (onstop) onstop();
          }, 0);
        }),
      };

      const MockMediaRecorder = vi.fn(function () {
        return mockRecorderInstance;
      }) as unknown as typeof MediaRecorder;
      (MockMediaRecorder as unknown as { isTypeSupported: (type: string) => boolean }).isTypeSupported = vi.fn().mockReturnValue(true);

      vi.stubGlobal('MediaRecorder', MockMediaRecorder);

      await audio.startRecording({ maxDurationSeconds: 30, format: 'wav' });

      // Capture the event handlers that were assigned
      ondataavailable = mockRecorderInstance.ondataavailable;
      onstop = mockRecorderInstance.onstop;

      // Simulate a data chunk arriving during recording
      if (ondataavailable) {
        ondataavailable({ data: new Blob(['chunk1'], { type: 'audio/wav' }) });
      }

      // Override stop to trigger onstop synchronously for test determinism
      mockRecorderInstance.stop = vi.fn(function (this: typeof mockRecorderInstance) {
        this.state = 'inactive';
        // Trigger onstop callback in microtask
        Promise.resolve().then(() => {
          if (this.onstop) this.onstop();
        });
      });

      const result = await audio.stopRecording();

      expect(result.format).toBe('wav');
      expect(result.durationSeconds).toBeGreaterThanOrEqual(0);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(result.sizeBytes).toBeGreaterThanOrEqual(0);
    });

    it('returns empty result with error when no active recording', async () => {
      // Do not start any recording
      const result = await audio.stopRecording();

      expect(result.data.byteLength).toBe(0);
      expect(result.durationSeconds).toBe(0);
      expect(result.sizeBytes).toBe(0);
      expect(audio.getLastError()).toEqual({
        code: 'RECORDING_FAILED',
        message: 'No active recording to stop',
      });
    });
  });

  // --- playAudio ---

  describe('playAudio()', () => {
    it('decodes audio buffer and starts playback', async () => {
      const mockBuffer = { length: 100, duration: 2.5 };
      const mockSource = {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGainNode = {
        gain: { value: 1 },
        connect: vi.fn(),
      };
      const mockDestination = {};
      const mockContext = {
        decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
        createBufferSource: vi.fn().mockReturnValue(mockSource),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        destination: mockDestination,
        close: vi.fn().mockResolvedValue(undefined),
      };

      function MockAudioContext() { return mockContext; }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const audioData = new ArrayBuffer(16);
      await audio.playAudio(audioData);

      expect(mockContext.decodeAudioData).toHaveBeenCalled();
      expect(mockContext.createBufferSource).toHaveBeenCalled();
      expect(mockSource.buffer).toBe(mockBuffer);
      expect(mockSource.connect).toHaveBeenCalledWith(mockDestination);
      expect(mockSource.start).toHaveBeenCalledWith(0);
    });

    it('applies speed and volume options', async () => {
      const mockBuffer = { length: 100, duration: 2.5 };
      const mockSource = {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockGainNode = {
        gain: { value: 1 },
        connect: vi.fn(),
      };
      const mockDestination = {};
      const mockContext = {
        decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
        createBufferSource: vi.fn().mockReturnValue(mockSource),
        createGain: vi.fn().mockReturnValue(mockGainNode),
        destination: mockDestination,
        close: vi.fn().mockResolvedValue(undefined),
      };

      function MockAudioContext() { return mockContext; }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const audioData = new ArrayBuffer(16);
      await audio.playAudio(audioData, { speed: 1.5, volume: 0.7 });

      expect(mockSource.playbackRate.value).toBe(1.5);
      expect(mockGainNode.gain.value).toBe(0.7);
      // When volume is specified, source connects to gain node (not directly to destination)
      expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockDestination);
      expect(mockSource.start).toHaveBeenCalledWith(0);
    });
  });

  // --- stopPlayback ---

  describe('stopPlayback()', () => {
    it('stops the current source', async () => {
      const mockBuffer = { length: 100, duration: 2.5 };
      const mockSource = {
        buffer: null as unknown,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      const mockDestination = {};
      const mockContext = {
        decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
        createBufferSource: vi.fn().mockReturnValue(mockSource),
        createGain: vi.fn(),
        destination: mockDestination,
        close: vi.fn().mockResolvedValue(undefined),
      };

      function MockAudioContext() { return mockContext; }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const audioData = new ArrayBuffer(16);
      await audio.playAudio(audioData);
      await audio.stopPlayback();

      expect(mockSource.stop).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
    });

    it('does not throw when no playback is active', async () => {
      await expect(audio.stopPlayback()).resolves.not.toThrow();
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('getLastError() returns null initially', () => {
      expect(audio.getLastError()).toBeNull();
    });

    it('playAudio() sets PLAYBACK_FAILED on decoding failure', async () => {
      const mockContext = {
        decodeAudioData: vi.fn().mockRejectedValue(new Error('Invalid audio data')),
        createBufferSource: vi.fn(),
        createGain: vi.fn(),
        destination: {},
        close: vi.fn().mockResolvedValue(undefined),
      };

      function MockAudioContext() { return mockContext; }
      vi.stubGlobal('AudioContext', MockAudioContext);

      const audioData = new ArrayBuffer(16);
      await audio.playAudio(audioData);

      expect(audio.getLastError()).toEqual({
        code: 'PLAYBACK_FAILED',
        message: 'Invalid audio data',
      });
    });

    it('startRecording() sets RECORDING_FAILED on generic error', async () => {
      const error = new Error('Device busy');
      setupMediaDevices({ getUserMediaError: error });

      await audio.startRecording({ maxDurationSeconds: 30, format: 'wav' });

      expect(audio.getLastError()).toEqual({
        code: 'RECORDING_FAILED',
        message: 'Device busy',
      });
    });
  });
});
