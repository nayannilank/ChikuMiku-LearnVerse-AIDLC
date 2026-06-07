/**
 * Mobile Platform App Package
 *
 * Provides the mobile-specific PlatformProvider implementation that wires together
 * all mobile adapter implementations (camera, filesystem, notifications, audio,
 * navigation, storage).
 */

import type {
  PlatformProvider,
  CameraInterface,
  CameraCaptureOptions,
  CameraCaptureResult,
  CameraError,
  FileSystemInterface,
  FilePickerOptions,
  FileMetadata,
  FileReadResult,
  FileSystemError,
  PushNotificationInterface,
  NotificationPayload,
  NotificationPermission,
  NotificationError,
  AudioInterface,
  AudioRecordingOptions,
  AudioRecordingResult,
  AudioPlaybackOptions,
  AudioError,
  NavigationInterface,
  DeviceStorageInterface,
} from '@learnverse/platform-contracts';

/**
 * Stub mobile camera adapter implementing CameraInterface.
 * Methods throw "Not implemented" until real native camera integration is added.
 */
class MobileCameraStub implements CameraInterface {
  private lastError: CameraError | null = null;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async requestPermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async capture(_options: CameraCaptureOptions): Promise<CameraCaptureResult> {
    throw new Error('Not implemented');
  }

  getLastError(): CameraError | null {
    return this.lastError;
  }
}

/**
 * Stub mobile file system adapter implementing FileSystemInterface.
 * Methods throw "Not implemented" until real native file system integration is added.
 */
class MobileFileSystemStub implements FileSystemInterface {
  private lastError: FileSystemError | null = null;

  async pickFiles(_options: FilePickerOptions): Promise<FileMetadata[]> {
    throw new Error('Not implemented');
  }

  async readFile(_path: string): Promise<FileReadResult> {
    throw new Error('Not implemented');
  }

  async writeFile(_path: string, _data: ArrayBuffer, _mimeType: string): Promise<FileMetadata> {
    throw new Error('Not implemented');
  }

  async deleteFile(_path: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async getAvailableSpace(): Promise<number> {
    throw new Error('Not implemented');
  }

  getLastError(): FileSystemError | null {
    return this.lastError;
  }
}

/**
 * Stub mobile notification adapter implementing PushNotificationInterface.
 * Methods throw "Not implemented" until real native push notification integration is added.
 */
class MobileNotificationStub implements PushNotificationInterface {
  private lastError: NotificationError | null = null;

  async getPermissionStatus(): Promise<NotificationPermission> {
    return 'not_determined';
  }

  async requestPermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async registerForPush(): Promise<string> {
    throw new Error('Not implemented');
  }

  async showLocalNotification(_payload: NotificationPayload): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async cancelNotification(_id: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  onNotificationTapped(_handler: (payload: NotificationPayload) => void): void {
    // No-op stub
  }

  getLastError(): NotificationError | null {
    return this.lastError;
  }
}

/**
 * Stub mobile audio adapter implementing AudioInterface.
 * Methods throw "Not implemented" until real native audio integration is added.
 */
class MobileAudioStub implements AudioInterface {
  private lastError: AudioError | null = null;

  async isMicrophoneAvailable(): Promise<boolean> {
    return false;
  }

  async requestMicrophonePermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async startRecording(_options: AudioRecordingOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  async stopRecording(): Promise<AudioRecordingResult> {
    throw new Error('Not implemented');
  }

  async playAudio(_data: ArrayBuffer, _options?: AudioPlaybackOptions): Promise<void> {
    throw new Error('Not implemented');
  }

  async stopPlayback(): Promise<void> {
    throw new Error('Not implemented');
  }

  getLastError(): AudioError | null {
    return this.lastError;
  }
}

/**
 * Stub mobile navigation adapter implementing NavigationInterface.
 * Methods throw "Not implemented" until real React Navigation integration is added.
 */
class MobileNavigationStub implements NavigationInterface {
  navigate(_route: string, _params?: Record<string, string>): void {
    throw new Error('Not implemented');
  }

  goBack(): void {
    throw new Error('Not implemented');
  }

  getCurrentRoute(): string {
    return '/';
  }

  canGoBack(): boolean {
    return false;
  }
}

/**
 * Stub mobile device storage adapter implementing DeviceStorageInterface.
 * Methods throw "Not implemented" until real AsyncStorage/SQLite integration is added.
 */
class MobileStorageStub implements DeviceStorageInterface {
  async getItem(_key: string): Promise<string | null> {
    throw new Error('Not implemented');
  }

  async setItem(_key: string, _value: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async removeItem(_key: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async clear(): Promise<void> {
    throw new Error('Not implemented');
  }

  async getAllKeys(): Promise<string[]> {
    throw new Error('Not implemented');
  }
}

/**
 * Detects the runtime mobile platform.
 * Returns 'ios' or 'android' based on available runtime indicators.
 * Defaults to 'android' when detection is not possible (e.g., Node.js environment).
 */
function detectMobilePlatform(): 'android' | 'ios' {
  // In a real React Native environment, Platform.OS would be used.
  // This stub uses a simple heuristic for detection.
  if (typeof globalThis !== 'undefined' && 'navigator' in globalThis) {
    const userAgent = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '';
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return 'ios';
    }
  }
  return 'android';
}

/**
 * Creates a mobile-specific PlatformProvider with all interface properties assigned.
 *
 * This is a stub implementation. Each adapter throws "Not implemented" for methods
 * that require real native API integration. No permissions are requested during
 * construction — they are deferred until the relevant method is invoked.
 *
 * The platform is determined by runtime OS detection, defaulting to 'android'.
 *
 * @returns A PlatformProvider with platform set to 'android' or 'ios' and all capabilities assigned.
 */
export function createMobilePlatformProvider(): PlatformProvider {
  return {
    platform: detectMobilePlatform(),
    camera: new MobileCameraStub(),
    fileSystem: new MobileFileSystemStub(),
    notifications: new MobileNotificationStub(),
    audio: new MobileAudioStub(),
    navigation: new MobileNavigationStub(),
    storage: new MobileStorageStub(),
  };
}
