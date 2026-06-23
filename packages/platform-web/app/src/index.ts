/**
 * Web Platform App Package
 *
 * Provides the web-specific PlatformProvider implementation that wires together
 * all web adapter implementations (camera, filesystem, notifications, audio,
 * navigation, storage).
 */

export { createHeaderLogo } from './components/HeaderLogo';
export type { HeaderLogoOptions } from './components/HeaderLogo';

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
 * Web camera adapter implementing CameraInterface.
 * Uses navigator.mediaDevices.getUserMedia for camera access and
 * a canvas element for frame capture.
 */
class WebCamera implements CameraInterface {
  private lastError: CameraError | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.lastError = { code: 'CAMERA_UNAVAILABLE', message: 'MediaDevices API is not supported in this browser' };
        return false;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some(device => device.kind === 'videoinput');

      if (!hasVideoInput) {
        this.lastError = { code: 'CAMERA_UNAVAILABLE', message: 'No video input devices found' };
        return false;
      }

      return true;
    } catch {
      this.lastError = { code: 'CAMERA_UNAVAILABLE', message: 'Unable to enumerate media devices' };
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.lastError = { code: 'CAMERA_UNAVAILABLE', message: 'MediaDevices API is not supported in this browser' };
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop all tracks immediately — we only needed to trigger the permission prompt
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: unknown) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.lastError = { code: 'PERMISSION_DENIED', message: 'Camera permission was denied by the user' };
      } else {
        this.lastError = { code: 'CAMERA_UNAVAILABLE', message: 'Failed to access camera' };
      }
      return false;
    }
  }

  async capture(options: CameraCaptureOptions): Promise<CameraCaptureResult> {
    let stream: MediaStream | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.lastError = { code: 'CAMERA_UNAVAILABLE', message: 'MediaDevices API is not supported in this browser' };
        throw this.lastError;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: options.maxWidth ? { ideal: options.maxWidth } : undefined,
          height: options.maxHeight ? { ideal: options.maxHeight } : undefined,
        },
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create a video element to receive the stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(reject);
        };
        video.onerror = () => reject(new Error('Video element failed to load'));
      });

      // Draw the current frame onto a canvas
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.lastError = { code: 'CAPTURE_FAILED', message: 'Unable to get canvas 2D context' };
        throw this.lastError;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Export the canvas as a blob
      const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
      const quality = options.quality != null ? options.quality / 100 : 0.92;

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob returned null'));
          },
          mimeType,
          quality,
        );
      });

      const data = await blob.arrayBuffer();

      return {
        data,
        format: options.format,
        sizeBytes: data.byteLength,
        width: canvas.width,
        height: canvas.height,
      };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        // Already a CameraError we set above
        throw err;
      }

      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.lastError = { code: 'PERMISSION_DENIED', message: 'Camera permission was denied by the user' };
      } else {
        this.lastError = { code: 'CAPTURE_FAILED', message: err instanceof Error ? err.message : 'Unknown capture error' };
      }
      throw this.lastError;
    } finally {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
  }

  getLastError(): CameraError | null {
    return this.lastError;
  }
}

/**
 * IndexedDB-based file storage for when File System Access API is unsupported.
 * Stores file blobs keyed by path in a 'learnverse-files' database.
 */
class IndexedDBFileStorage {
  private dbName = 'learnverse-files';
  private storeName = 'files';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(path: string): Promise<{ data: ArrayBuffer; mimeType: string; lastModified: number } | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(path);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(path: string, data: ArrayBuffer, mimeType: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put({ data, mimeType, lastModified: Date.now() }, path);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async remove(path: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const getReq = store.get(path);
      getReq.onsuccess = () => {
        if (getReq.result == null) {
          resolve(false);
          return;
        }
        const delReq = store.delete(path);
        delReq.onsuccess = () => resolve(true);
        delReq.onerror = () => reject(delReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }
}

/**
 * Web file system adapter implementing FileSystemInterface.
 * Uses the File System Access API where available, with fallbacks:
 * - pickFiles: showOpenFilePicker → hidden <input type="file">
 * - readFile: file handle / IndexedDB fallback
 * - writeFile: showSaveFilePicker → download link / IndexedDB fallback
 * - getAvailableSpace: navigator.storage.estimate()
 *
 * Sets lastError with appropriate codes on failure rather than throwing.
 */
class WebFileSystem implements FileSystemInterface {
  private lastError: FileSystemError | null = null;
  private fileStorage = new IndexedDBFileStorage();
  /** Cache of file handles obtained from the file picker (keyed by path/name). */
  private fileHandles = new Map<string, FileSystemFileHandle>();

  /**
   * Returns true if the File System Access API (showOpenFilePicker) is available.
   */
  private hasFileSystemAccess(): boolean {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
  }

  /**
   * Convert accepted MIME types into the accept filter format for the File System Access API.
   */
  private buildAcceptFilter(acceptedTypes: string[]): { description: string; accept: Record<string, string[]> } {
    const accept: Record<string, string[]> = {};
    for (const mimeType of acceptedTypes) {
      accept[mimeType] = [];
    }
    return { description: 'Accepted files', accept };
  }

  async pickFiles(options: FilePickerOptions): Promise<FileMetadata[]> {
    try {
      if (this.hasFileSystemAccess()) {
        return await this.pickFilesNative(options);
      }
      return await this.pickFilesFallback(options);
    } catch (err: unknown) {
      // User cancelled the picker — not an error, return empty
      if (err instanceof DOMException && err.name === 'AbortError') {
        return [];
      }
      if (err instanceof DOMException && (err.name === 'SecurityError' || err.name === 'NotAllowedError')) {
        this.lastError = { code: 'PERMISSION_DENIED', message: 'File picker permission denied' };
      } else {
        this.lastError = { code: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to pick files' };
      }
      return [];
    }
  }

  /**
   * Uses showOpenFilePicker (File System Access API).
   */
  private async pickFilesNative(options: FilePickerOptions): Promise<FileMetadata[]> {
    const pickerOptions: { multiple: boolean; types?: { description: string; accept: Record<string, string[]> }[] } = {
      multiple: options.multiple,
      types: options.acceptedTypes.length > 0 ? [this.buildAcceptFilter(options.acceptedTypes)] : undefined,
    };

    const handles: FileSystemFileHandle[] = await (window as unknown as { showOpenFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker(pickerOptions);
    const results: FileMetadata[] = [];

    for (const handle of handles) {
      const file = await handle.getFile();
      if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
        this.lastError = { code: 'FILE_TOO_LARGE', message: `File "${file.name}" exceeds maximum size of ${options.maxSizeBytes} bytes` };
        continue;
      }
      const metadata: FileMetadata = {
        name: file.name,
        path: file.name,
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        lastModified: new Date(file.lastModified),
      };
      this.fileHandles.set(file.name, handle);
      results.push(metadata);
    }

    return results;
  }

  /**
   * Fallback using a hidden <input type="file"> element.
   */
  private pickFilesFallback(options: FilePickerOptions): Promise<FileMetadata[]> {
    return new Promise<FileMetadata[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options.multiple;
      if (options.acceptedTypes.length > 0) {
        input.accept = options.acceptedTypes.join(',');
      }
      input.style.display = 'none';

      input.addEventListener('change', () => {
        const files = input.files;
        if (!files || files.length === 0) {
          resolve([]);
          document.body.removeChild(input);
          return;
        }

        const results: FileMetadata[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
            this.lastError = { code: 'FILE_TOO_LARGE', message: `File "${file.name}" exceeds maximum size of ${options.maxSizeBytes} bytes` };
            continue;
          }
          results.push({
            name: file.name,
            path: file.name,
            sizeBytes: file.size,
            mimeType: file.type || 'application/octet-stream',
            lastModified: new Date(file.lastModified),
          });
        }

        // Store the files in IndexedDB for later readFile access
        const storePromises: Promise<void>[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!options.maxSizeBytes || file.size <= options.maxSizeBytes) {
            storePromises.push(
              file.arrayBuffer().then(buffer =>
                this.fileStorage.put(file.name, buffer, file.type || 'application/octet-stream')
              )
            );
          }
        }

        Promise.all(storePromises).then(() => {
          resolve(results);
          document.body.removeChild(input);
        }).catch(() => {
          // Still return metadata even if IndexedDB storage fails
          resolve(results);
          document.body.removeChild(input);
        });
      });

      // Handle user cancellation (no change event fires)
      input.addEventListener('cancel', () => {
        resolve([]);
        document.body.removeChild(input);
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  async readFile(path: string): Promise<FileReadResult> {
    try {
      // Try reading from a cached file handle first (File System Access API)
      const handle = this.fileHandles.get(path);
      if (handle) {
        const file = await handle.getFile();
        const data = await file.arrayBuffer();
        return {
          data,
          metadata: {
            name: file.name,
            path: file.name,
            sizeBytes: file.size,
            mimeType: file.type || 'application/octet-stream',
            lastModified: new Date(file.lastModified),
          },
        };
      }

      // Fall back to IndexedDB
      const stored = await this.fileStorage.get(path);
      if (!stored) {
        this.lastError = { code: 'FILE_NOT_FOUND', message: `File not found: ${path}` };
        return {
          data: new ArrayBuffer(0),
          metadata: { name: '', path, sizeBytes: 0, mimeType: '', lastModified: new Date(0) },
        };
      }

      const name = path.split('/').pop() || path;
      return {
        data: stored.data,
        metadata: {
          name,
          path,
          sizeBytes: stored.data.byteLength,
          mimeType: stored.mimeType,
          lastModified: new Date(stored.lastModified),
        },
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        this.lastError = { code: 'PERMISSION_DENIED', message: 'File read permission denied' };
      } else {
        this.lastError = { code: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read file' };
      }
      return {
        data: new ArrayBuffer(0),
        metadata: { name: '', path, sizeBytes: 0, mimeType: '', lastModified: new Date(0) },
      };
    }
  }

  async writeFile(path: string, data: ArrayBuffer, mimeType: string): Promise<FileMetadata> {
    const name = path.split('/').pop() || path;
    const now = new Date();

    try {
      if (this.hasFileSystemAccess()) {
        return await this.writeFileNative(path, data, mimeType, name, now);
      }
      return await this.writeFileFallback(path, data, mimeType, name, now);
    } catch (err: unknown) {
      // User cancelled the save picker — not a real failure, store in IndexedDB
      if (err instanceof DOMException && err.name === 'AbortError') {
        await this.fileStorage.put(path, data, mimeType);
        return { name, path, sizeBytes: data.byteLength, mimeType, lastModified: now };
      }
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        this.lastError = { code: 'PERMISSION_DENIED', message: 'File write permission denied' };
      } else if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        this.lastError = { code: 'STORAGE_FULL', message: 'Storage quota exceeded' };
      } else {
        this.lastError = { code: 'WRITE_FAILED', message: err instanceof Error ? err.message : 'Failed to write file' };
      }
      return { name, path, sizeBytes: data.byteLength, mimeType, lastModified: now };
    }
  }

  /**
   * Uses showSaveFilePicker (File System Access API).
   */
  private async writeFileNative(path: string, data: ArrayBuffer, mimeType: string, name: string, now: Date): Promise<FileMetadata> {
    const saveOptions: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] } = {
      suggestedName: name,
      types: [{
        description: 'File',
        accept: { [mimeType]: [] },
      }],
    };

    const handle: FileSystemFileHandle = await (window as unknown as { showSaveFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker(saveOptions);
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();

    this.fileHandles.set(path, handle);
    return { name, path, sizeBytes: data.byteLength, mimeType, lastModified: now };
  }

  /**
   * Fallback: triggers a download link for saving, and stores in IndexedDB for later reading.
   */
  private async writeFileFallback(path: string, data: ArrayBuffer, mimeType: string, name: string, now: Date): Promise<FileMetadata> {
    // Store in IndexedDB for future readFile access
    await this.fileStorage.put(path, data, mimeType);

    // Trigger a browser download
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { name, path, sizeBytes: data.byteLength, mimeType, lastModified: now };
  }

  async deleteFile(path: string): Promise<boolean> {
    try {
      // Remove from handle cache
      this.fileHandles.delete(path);
      // Remove from IndexedDB
      const removed = await this.fileStorage.remove(path);
      if (!removed) {
        this.lastError = { code: 'FILE_NOT_FOUND', message: `File not found: ${path}` };
        return false;
      }
      return true;
    } catch (err: unknown) {
      this.lastError = { code: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to delete file' };
      return false;
    }
  }

  async getAvailableSpace(): Promise<number> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota ?? 0;
        const usage = estimate.usage ?? 0;
        return quota - usage;
      }
      // If Storage API is not available, return 0 (unknown)
      return 0;
    } catch (err: unknown) {
      this.lastError = { code: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to estimate storage' };
      return 0;
    }
  }

  getLastError(): FileSystemError | null {
    return this.lastError;
  }
}

/**
 * Web notification adapter implementing PushNotificationInterface.
 * Uses the browser Notification API for local notifications.
 * Sets lastError with appropriate codes on failure rather than throwing.
 */
class WebNotifications implements PushNotificationInterface {
  private lastError: NotificationError | null = null;
  private tapHandler: ((payload: NotificationPayload) => void) | null = null;

  /**
   * Returns true if the browser supports the Notification API.
   */
  private isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  async getPermissionStatus(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      this.lastError = { code: 'NOT_SUPPORTED', message: 'Notification API is not supported in this browser' };
      return 'not_determined';
    }

    const permission = Notification.permission;
    switch (permission) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'default':
      default:
        return 'not_determined';
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      this.lastError = { code: 'NOT_SUPPORTED', message: 'Notification API is not supported in this browser' };
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        return true;
      }
      if (result === 'denied') {
        this.lastError = { code: 'PERMISSION_DENIED', message: 'Notification permission was denied by the user' };
      }
      return false;
    } catch {
      this.lastError = { code: 'PERMISSION_DENIED', message: 'Failed to request notification permission' };
      return false;
    }
  }

  async registerForPush(): Promise<string> {
    if (!this.isSupported()) {
      this.lastError = { code: 'NOT_SUPPORTED', message: 'Notification API is not supported in this browser' };
      return '';
    }

    // Push registration requires a service worker with PushManager.
    // For now, return empty string and set error since web push setup is not yet configured.
    this.lastError = { code: 'TOKEN_FAILED', message: 'Push registration requires a service worker with PushManager' };
    return '';
  }

  async showLocalNotification(payload: NotificationPayload): Promise<boolean> {
    if (!this.isSupported()) {
      this.lastError = { code: 'NOT_SUPPORTED', message: 'Notification API is not supported in this browser' };
      return false;
    }

    if (Notification.permission !== 'granted') {
      this.lastError = { code: 'PERMISSION_DENIED', message: 'Notification permission not granted' };
      return false;
    }

    try {
      const notification = new Notification(payload.title, {
        body: payload.body,
        data: payload.data,
        tag: payload.id,
      });

      notification.onclick = () => {
        if (this.tapHandler) {
          this.tapHandler(payload);
        }
      };

      return true;
    } catch {
      this.lastError = { code: 'SEND_FAILED', message: 'Failed to create notification' };
      return false;
    }
  }

  async cancelNotification(_id: string): Promise<boolean> {
    // The web Notification API does not provide a built-in mechanism to cancel
    // displayed notifications by ID without maintaining a reference map.
    // Notifications auto-dismiss or can be closed by the user.
    return false;
  }

  onNotificationTapped(handler: (payload: NotificationPayload) => void): void {
    this.tapHandler = handler;
  }

  getLastError(): NotificationError | null {
    return this.lastError;
  }
}

/**
 * Web audio adapter implementing AudioInterface.
 * Uses navigator.mediaDevices for microphone access, MediaRecorder for recording,
 * and AudioContext for playback via Web Audio API.
 */
class WebAudio implements AudioInterface {
  private lastError: AudioError | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStream: MediaStream | null = null;
  private recordingStartTime: number = 0;
  private recordingFormat: 'wav' | 'mp3' | 'aac' = 'wav';
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  async isMicrophoneAvailable(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.lastError = { code: 'MICROPHONE_UNAVAILABLE', message: 'MediaDevices API is not supported in this browser' };
        return false;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');

      if (!hasAudioInput) {
        this.lastError = { code: 'MICROPHONE_UNAVAILABLE', message: 'No audio input devices found' };
        return false;
      }

      return true;
    } catch {
      this.lastError = { code: 'MICROPHONE_UNAVAILABLE', message: 'Unable to enumerate media devices' };
      return false;
    }
  }

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.lastError = { code: 'MICROPHONE_UNAVAILABLE', message: 'MediaDevices API is not supported in this browser' };
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately — we only needed to trigger the permission prompt
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err: unknown) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.lastError = { code: 'MICROPHONE_DENIED', message: 'Microphone permission was denied by the user' };
      } else {
        this.lastError = { code: 'MICROPHONE_UNAVAILABLE', message: 'Failed to access microphone' };
      }
      return false;
    }
  }

  async startRecording(options: AudioRecordingOptions): Promise<void> {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.lastError = { code: 'MICROPHONE_UNAVAILABLE', message: 'MediaDevices API is not supported in this browser' };
        return;
      }

      const audioConstraints: MediaTrackConstraints = {
        sampleRate: options.sampleRate,
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      this.recordingStream = stream;
      this.recordedChunks = [];
      this.recordingFormat = options.format;
      this.recordingStartTime = Date.now();

      // Determine the best MIME type for the requested format
      const mimeType = this.getMimeTypeForFormat(options.format);
      const recorderOptions: MediaRecorderOptions = {};
      if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
        recorderOptions.mimeType = mimeType;
      }

      this.mediaRecorder = new MediaRecorder(stream, recorderOptions);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms

      // Auto-stop after maxDurationSeconds
      if (options.maxDurationSeconds > 0) {
        this.maxDurationTimer = setTimeout(() => {
          this.stopRecordingInternal();
        }, options.maxDurationSeconds * 1000);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        this.lastError = { code: 'MICROPHONE_DENIED', message: 'Microphone permission was denied by the user' };
      } else {
        this.lastError = { code: 'RECORDING_FAILED', message: err instanceof Error ? err.message : 'Failed to start recording' };
      }
    }
  }

  async stopRecording(): Promise<AudioRecordingResult> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.lastError = { code: 'RECORDING_FAILED', message: 'No active recording to stop' };
      return { data: new ArrayBuffer(0), durationSeconds: 0, format: this.recordingFormat, sizeBytes: 0 };
    }

    return this.stopRecordingInternal();
  }

  private stopRecordingInternal(): Promise<AudioRecordingResult> {
    return new Promise<AudioRecordingResult>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({ data: new ArrayBuffer(0), durationSeconds: 0, format: this.recordingFormat, sizeBytes: 0 });
        return;
      }

      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
        this.maxDurationTimer = null;
      }

      this.mediaRecorder.onstop = async () => {
        const durationSeconds = (Date.now() - this.recordingStartTime) / 1000;
        const mimeType = this.getMimeTypeForFormat(this.recordingFormat) || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const data = await blob.arrayBuffer();

        // Clean up the stream
        if (this.recordingStream) {
          this.recordingStream.getTracks().forEach(track => track.stop());
          this.recordingStream = null;
        }

        this.recordedChunks = [];
        this.mediaRecorder = null;

        resolve({
          data,
          durationSeconds,
          format: this.recordingFormat,
          sizeBytes: data.byteLength,
        });
      };

      this.mediaRecorder.stop();
    });
  }

  async playAudio(data: ArrayBuffer, options?: AudioPlaybackOptions): Promise<void> {
    try {
      // Stop any currently playing audio
      this.stopCurrentPlayback();

      this.audioContext = new AudioContext();
      const audioBuffer = await this.audioContext.decodeAudioData(data.slice(0));

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Apply playback speed
      if (options?.speed) {
        source.playbackRate.value = options.speed;
      }

      // Apply volume via a gain node
      if (options?.volume !== undefined) {
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = options.volume;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
      } else {
        source.connect(this.audioContext.destination);
      }

      this.currentSource = source;

      source.onended = () => {
        this.currentSource = null;
      };

      source.start(0);
    } catch (err: unknown) {
      this.lastError = { code: 'PLAYBACK_FAILED', message: err instanceof Error ? err.message : 'Failed to play audio' };
    }
  }

  async stopPlayback(): Promise<void> {
    this.stopCurrentPlayback();
  }

  private stopCurrentPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  getLastError(): AudioError | null {
    return this.lastError;
  }

  /**
   * Maps the requested format to a MIME type for MediaRecorder.
   * Browsers may not support all formats; falls back to webm if unsupported.
   */
  private getMimeTypeForFormat(format: 'wav' | 'mp3' | 'aac'): string | null {
    switch (format) {
      case 'wav':
        return 'audio/wav';
      case 'mp3':
        return 'audio/mpeg';
      case 'aac':
        return 'audio/aac';
      default:
        return null;
    }
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
 * IndexedDB-based fallback storage for when localStorage is unavailable or full.
 * Uses a single object store ('keyval') within a 'learnverse-storage' database.
 */
class IndexedDBStorage {
  private dbName = 'learnverse-storage';
  private storeName = 'keyval';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getItem(key: string): Promise<string | null> {
    const db = await this.getDB();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<string[]> {
    const db = await this.getDB();
    return new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(k => String(k)));
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Web device storage adapter implementing DeviceStorageInterface.
 * Uses localStorage with a 'learnverse:' key prefix for namespace isolation.
 * Falls back to IndexedDB if localStorage is unavailable or throws QuotaExceededError.
 */
class WebStorage implements DeviceStorageInterface {
  private static readonly PREFIX = 'learnverse:';
  private fallback: IndexedDBStorage | null = null;
  private usingFallback = false;

  /**
   * Checks if localStorage is available and usable.
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const testKey = '__learnverse_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the IndexedDB fallback, creating it if needed.
   */
  private getFallback(): IndexedDBStorage {
    if (!this.fallback) {
      this.fallback = new IndexedDBStorage();
    }
    this.usingFallback = true;
    return this.fallback;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.usingFallback || !this.isLocalStorageAvailable()) {
      return this.getFallback().setItem(key, value);
    }

    try {
      localStorage.setItem(WebStorage.PREFIX + key, value);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        return this.getFallback().setItem(key, value);
      }
      throw e;
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (this.usingFallback || !this.isLocalStorageAvailable()) {
      return this.getFallback().getItem(key);
    }

    return localStorage.getItem(WebStorage.PREFIX + key);
  }

  async removeItem(key: string): Promise<void> {
    if (this.usingFallback || !this.isLocalStorageAvailable()) {
      return this.getFallback().removeItem(key);
    }

    localStorage.removeItem(WebStorage.PREFIX + key);
  }

  async clear(): Promise<void> {
    if (this.usingFallback || !this.isLocalStorageAvailable()) {
      return this.getFallback().clear();
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(WebStorage.PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (this.usingFallback || !this.isLocalStorageAvailable()) {
      return this.getFallback().getAllKeys();
    }

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(WebStorage.PREFIX)) {
        keys.push(key.slice(WebStorage.PREFIX.length));
      }
    }
    return keys;
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
    camera: new WebCamera(),
    fileSystem: new WebFileSystem(),
    notifications: new WebNotifications(),
    audio: new WebAudio(),
    navigation: new WebNavigationStub(),
    storage: new WebStorage(),
  };
}
