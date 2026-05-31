import type {
  AudioInterface,
  AudioRecordingOptions,
  AudioRecordingResult,
  AudioPlaybackOptions,
  AudioError,
} from '@chikumiku/platform-contracts';

/**
 * Mobile platform implementation of AudioInterface.
 * Uses native audio APIs (expo-av, react-native-audio) for mobile audio
 * recording and playback on Android and iOS.
 */
export class MobileAudioAdapter implements AudioInterface {
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
