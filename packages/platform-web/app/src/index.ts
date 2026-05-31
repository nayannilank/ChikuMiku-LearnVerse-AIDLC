/**
 * Web Platform App Package
 *
 * Provides the web-specific PlatformProvider implementation that wires together
 * all web adapter implementations (camera, filesystem, notifications, audio,
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
} from '@chikumiku/platform-contracts';

/**
 * Stub web camera adapter implementing CameraInterface.
 * Methods throw "Not implemented" until real browser API integration is added.
 */
class WebCameraStub implements CameraInterface {
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
 * Stub web file system adapter implementing FileSystemInterface.
 * Methods throw "Not implemented" until real browser API integration is added.
 */
class WebFileSystemStub implements FileSystemInterface {
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
 * Stub web notification adapter implementing PushNotificationInterface.
 * Methods throw "Not implemented" until real browser API integration is added.
 */
class WebNotificationStub implements PushNotificationInterface {
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
 * Stub web audio adapter implementing AudioInterface.
 * Methods throw "Not implemented" until real browser API integration is added.
 */
class WebAudioStub implements AudioInterface {
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
 * Stub web navigation adapter implementing NavigationInterface.
 * Methods throw "Not implemented" until real routing integration is added.
 */
class WebNavigationStub implements NavigationInterface {
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
 * Stub web device storage adapter implementing DeviceStorageInterface.
 * Methods throw "Not implemented" until real localStorage/IndexedDB integration is added.
 */
class WebStorageStub implements DeviceStorageInterface {
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
 * Creates a web-specific PlatformProvider with all interface properties assigned.
 *
 * This is a stub implementation. Each adapter throws "Not implemented" for methods
 * that require real browser API integration. No permissions are requested during
 * construction — they are deferred until the relevant method is invoked.
 *
 * @returns A PlatformProvider with platform set to 'web' and all capabilities assigned.
 */
export function createWebPlatformProvider(): PlatformProvider {
  return {
    platform: 'web',
    camera: new WebCameraStub(),
    fileSystem: new WebFileSystemStub(),
    notifications: new WebNotificationStub(),
    audio: new WebAudioStub(),
    navigation: new WebNavigationStub(),
    storage: new WebStorageStub(),
  };
}
