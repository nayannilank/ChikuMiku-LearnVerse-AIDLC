/**
 * Platform Contracts Package
 *
 * Defines the interface boundary between service logic and platform-specific code.
 * Extracted from @learnverse/api platformInterface.ts with additional navigation
 * and device storage abstractions.
 *
 * This package exports ONLY TypeScript interfaces, type aliases, and the
 * PlatformRegistry class. It contains NO platform-specific implementation code.
 */

// --- Data Models ---
export * from './models.js';

// --- API Request/Response Types ---
export * from './api-types.js';

// --- Validation Rules ---
export * from './validation-rules.js';

// --- Error Types ---
export * from './errors.js';

// --- Camera Interface ---

/** Camera capture options (platform-independent) */
export interface CameraCaptureOptions {
  /** Maximum resolution width in pixels */
  maxWidth?: number;
  /** Maximum resolution height in pixels */
  maxHeight?: number;
  /** Image quality (0-100) */
  quality?: number;
  /** Preferred image format */
  format: 'jpeg' | 'png';
}

/** Camera capture result (platform-independent) */
export interface CameraCaptureResult {
  /** Raw image data */
  data: ArrayBuffer;
  /** Image format */
  format: 'jpeg' | 'png' | 'heic';
  /** File size in bytes */
  sizeBytes: number;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/** Camera access errors */
export type CameraError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'CAMERA_UNAVAILABLE'; message: string }
  | { code: 'CAPTURE_FAILED'; message: string }
  | { code: 'CANCELLED'; message: string };

/**
 * Platform-independent camera interface.
 * Implementations provided per platform (Android, Web, future iOS).
 */
export interface CameraInterface {
  /** Check if camera is available on this device */
  isAvailable(): Promise<boolean>;
  /** Request camera permission */
  requestPermission(): Promise<boolean>;
  /** Capture a photo */
  capture(options: CameraCaptureOptions): Promise<CameraCaptureResult>;
  /** Get the last error that occurred */
  getLastError(): CameraError | null;
}

// --- File System Interface ---

/** File metadata (platform-independent) */
export interface FileMetadata {
  name: string;
  path: string;
  sizeBytes: number;
  mimeType: string;
  lastModified: Date;
}

/** File read result */
export interface FileReadResult {
  data: ArrayBuffer;
  metadata: FileMetadata;
}

/** File picker options */
export interface FilePickerOptions {
  /** Accepted MIME types */
  acceptedTypes: string[];
  /** Allow multiple file selection */
  multiple: boolean;
  /** Maximum file size in bytes */
  maxSizeBytes?: number;
}

/** File system errors */
export type FileSystemError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'FILE_NOT_FOUND'; message: string }
  | { code: 'FILE_TOO_LARGE'; message: string }
  | { code: 'INVALID_FORMAT'; message: string }
  | { code: 'STORAGE_FULL'; message: string }
  | { code: 'READ_FAILED'; message: string }
  | { code: 'WRITE_FAILED'; message: string };

/**
 * Platform-independent file system interface.
 * Abstracts file picking, reading, and writing across platforms.
 */
export interface FileSystemInterface {
  /** Pick files using the platform's file picker */
  pickFiles(options: FilePickerOptions): Promise<FileMetadata[]>;
  /** Read a file by path */
  readFile(path: string): Promise<FileReadResult>;
  /** Write data to a file */
  writeFile(path: string, data: ArrayBuffer, mimeType: string): Promise<FileMetadata>;
  /** Delete a file */
  deleteFile(path: string): Promise<boolean>;
  /** Check available storage space in bytes */
  getAvailableSpace(): Promise<number>;
  /** Get the last error that occurred */
  getLastError(): FileSystemError | null;
}

// --- Push Notifications Interface ---

/** Notification payload (platform-independent) */
export interface NotificationPayload {
  /** Unique notification ID */
  id: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Optional data payload */
  data?: Record<string, string>;
  /** Optional action to perform when tapped */
  action?: string;
  /** Optional channel/category for grouping */
  channel?: string;
}

/** Notification permission status */
export type NotificationPermission = 'granted' | 'denied' | 'not_determined';

/** Push notification errors */
export type NotificationError =
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'TOKEN_FAILED'; message: string }
  | { code: 'SEND_FAILED'; message: string }
  | { code: 'NOT_SUPPORTED'; message: string };

/**
 * Platform-independent push notification interface.
 * Abstracts notification registration, display, and handling.
 */
export interface PushNotificationInterface {
  /** Check current notification permission status */
  getPermissionStatus(): Promise<NotificationPermission>;
  /** Request notification permission */
  requestPermission(): Promise<boolean>;
  /** Register for push notifications and get device token */
  registerForPush(): Promise<string>;
  /** Display a local notification */
  showLocalNotification(payload: NotificationPayload): Promise<boolean>;
  /** Cancel a scheduled notification */
  cancelNotification(id: string): Promise<boolean>;
  /** Set a handler for when a notification is tapped */
  onNotificationTapped(handler: (payload: NotificationPayload) => void): void;
  /** Get the last error that occurred */
  getLastError(): NotificationError | null;
}

// --- Audio Interface ---

/** Audio recording options */
export interface AudioRecordingOptions {
  /** Maximum recording duration in seconds */
  maxDurationSeconds: number;
  /** Audio format */
  format: 'wav' | 'mp3' | 'aac';
  /** Sample rate in Hz */
  sampleRate?: number;
}

/** Audio recording result */
export interface AudioRecordingResult {
  data: ArrayBuffer;
  durationSeconds: number;
  format: 'wav' | 'mp3' | 'aac';
  sizeBytes: number;
}

/** Audio playback options */
export interface AudioPlaybackOptions {
  /** Playback speed (1.0 = normal) */
  speed?: number;
  /** Volume (0.0 - 1.0) */
  volume?: number;
}

/** Audio errors */
export type AudioError =
  | { code: 'MICROPHONE_DENIED'; message: string }
  | { code: 'MICROPHONE_UNAVAILABLE'; message: string }
  | { code: 'PLAYBACK_FAILED'; message: string }
  | { code: 'RECORDING_FAILED'; message: string }
  | { code: 'FORMAT_UNSUPPORTED'; message: string };

/**
 * Platform-independent audio interface.
 * Abstracts microphone recording and audio playback.
 */
export interface AudioInterface {
  /** Check if microphone is available */
  isMicrophoneAvailable(): Promise<boolean>;
  /** Request microphone permission */
  requestMicrophonePermission(): Promise<boolean>;
  /** Start recording audio */
  startRecording(options: AudioRecordingOptions): Promise<void>;
  /** Stop recording and get result */
  stopRecording(): Promise<AudioRecordingResult>;
  /** Play audio data */
  playAudio(data: ArrayBuffer, options?: AudioPlaybackOptions): Promise<void>;
  /** Stop audio playback */
  stopPlayback(): Promise<void>;
  /** Get the last error that occurred */
  getLastError(): AudioError | null;
}

// --- Navigation Interface ---

/**
 * Platform-independent navigation interface.
 * Abstracts routing across platforms (React Router for web, React Navigation for mobile).
 */
export interface NavigationInterface {
  navigate(route: string, params?: Record<string, string>): void;
  goBack(): void;
  getCurrentRoute(): string;
  canGoBack(): boolean;
}

// --- Device Storage Interface ---

/**
 * Platform-independent device storage interface.
 * Abstracts key-value storage across platforms (localStorage for web, AsyncStorage for mobile).
 */
export interface DeviceStorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

// --- Platform Provider ---

/**
 * PlatformProvider aggregates all platform-specific interfaces.
 * Each platform (Android, Web, iOS) provides its own implementation.
 *
 * Business logic depends only on this interface, never on platform-specific code.
 */
export interface PlatformProvider {
  /** Platform identifier */
  platform: 'android' | 'web' | 'ios';
  /** Camera access */
  camera: CameraInterface;
  /** File system access */
  fileSystem: FileSystemInterface;
  /** Push notifications */
  notifications: PushNotificationInterface;
  /** Audio recording and playback */
  audio: AudioInterface;
  /** Navigation */
  navigation: NavigationInterface;
  /** Device storage */
  storage: DeviceStorageInterface;
}

// --- Platform Registry ---

/**
 * PlatformRegistry manages platform provider registration and lookup.
 * Ensures business logic can access platform features without direct coupling.
 */
export class PlatformRegistry {
  private providers: Map<string, PlatformProvider> = new Map();
  private activeProvider: PlatformProvider | null = null;

  /**
   * Register a platform provider.
   */
  register(provider: PlatformProvider): void {
    this.providers.set(provider.platform, provider);
  }

  /**
   * Set the active platform provider.
   */
  setActive(platform: 'android' | 'web' | 'ios'): boolean {
    const provider = this.providers.get(platform);
    if (!provider) return false;
    this.activeProvider = provider;
    return true;
  }

  /**
   * Get the active platform provider.
   * Throws if no provider is active.
   */
  getActive(): PlatformProvider {
    if (!this.activeProvider) {
      throw new Error('No active platform provider. Call setActive() first.');
    }
    return this.activeProvider;
  }

  /**
   * Get a specific platform provider by name.
   */
  getProvider(platform: string): PlatformProvider | null {
    return this.providers.get(platform) ?? null;
  }

  /**
   * List all registered platforms.
   */
  listPlatforms(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a platform is registered.
   */
  hasProvider(platform: string): boolean {
    return this.providers.has(platform);
  }
}
