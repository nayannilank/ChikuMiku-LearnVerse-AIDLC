import type {
  FileSystemInterface,
  FilePickerOptions,
  FileMetadata,
  FileReadResult,
  FileSystemError,
} from '@learnverse/platform-contracts';

/**
 * Mobile platform implementation of FileSystemInterface.
 *
 * Uses native file system APIs for file operations on mobile devices.
 * Intended to be backed by libraries such as react-native-fs or expo-file-system
 * for actual native file access on Android/iOS.
 */
export class MobileFileSystemAdapter implements FileSystemInterface {
  private lastError: FileSystemError | null = null;

  /**
   * Pick files using the native file picker (e.g., expo-document-picker).
   */
  async pickFiles(_options: FilePickerOptions): Promise<FileMetadata[]> {
    throw new Error('Not implemented');
  }

  /**
   * Read a file from the device file system (e.g., react-native-fs readFile).
   */
  async readFile(_path: string): Promise<FileReadResult> {
    throw new Error('Not implemented');
  }

  /**
   * Write data to the device file system (e.g., react-native-fs writeFile).
   */
  async writeFile(_path: string, _data: ArrayBuffer, _mimeType: string): Promise<FileMetadata> {
    throw new Error('Not implemented');
  }

  /**
   * Delete a file from the device file system (e.g., react-native-fs unlink).
   */
  async deleteFile(_path: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  /**
   * Check available storage space on the device (e.g., expo-file-system getFreeDiskStorageAsync).
   */
  async getAvailableSpace(): Promise<number> {
    throw new Error('Not implemented');
  }

  getLastError(): FileSystemError | null {
    return this.lastError;
  }
}
