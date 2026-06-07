import type {
  FileSystemInterface,
  FilePickerOptions,
  FileMetadata,
  FileReadResult,
  FileSystemError,
} from '@learnverse/platform-contracts';

/**
 * Web platform implementation of FileSystemInterface.
 * Uses browser File API and related web APIs for file operations.
 */
export class WebFileSystemAdapter implements FileSystemInterface {
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
