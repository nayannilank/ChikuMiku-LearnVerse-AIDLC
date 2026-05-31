import type {
  AudioInterface,
  AudioRecordingOptions,
  AudioRecordingResult,
  AudioPlaybackOptions,
  AudioError,
} from '@chikumiku/platform-contracts';

/**
 * Web platform implementation of AudioInterface.
 * Uses the Web Audio API and MediaRecorder for browser-based audio.
 */
export class WebAudioAdapter implements AudioInterface {
  private lastError: AudioError | null = null;

  async isMicrophoneAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async requestMicrophonePermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async startRecording(options: AudioRecordingOptions): Promise<void> {
    void options;
    throw new Error('Not implemented');
  }

  async stopRecording(): Promise<AudioRecordingResult> {
    throw new Error('Not implemented');
  }

  async playAudio(data: ArrayBuffer, options?: AudioPlaybackOptions): Promise<void> {
    void data;
    void options;
    throw new Error('Not implemented');
  }

  async stopPlayback(): Promise<void> {
    throw new Error('Not implemented');
  }

  getLastError(): AudioError | null {
    return this.lastError;
  }
}
