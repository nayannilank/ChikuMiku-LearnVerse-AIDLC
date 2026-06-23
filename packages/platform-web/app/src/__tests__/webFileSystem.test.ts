import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebPlatformProvider } from '../index';
import type { FileSystemInterface } from '@learnverse/platform-contracts';

/**
 * Unit tests for WebFileSystem adapter.
 * Mocks File System Access API and IndexedDB to verify:
 * - pickFiles() with native API and <input> fallback
 * - readFile() from file handle and IndexedDB fallback
 * - writeFile() with showSaveFilePicker and download link fallback
 * - deleteFile() via IndexedDB
 * - getAvailableSpace() via navigator.storage.estimate()
 * - Error codes are set appropriately
 *
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5
 */

// --- Helpers for creating mock IndexedDB ---

function createMockIDBStore(data: Map<string, unknown> = new Map()) {
  return {
    get(key: string) {
      const result = data.get(key) ?? null;
      const request = { result, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    },
    put(value: unknown, key: string) {
      data.set(key, value);
      const request = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    },
    delete(key: string) {
      data.delete(key);
      const request = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    },
  };
}

function createMockIDB(storeData: Map<string, unknown> = new Map()) {
  const store = createMockIDBStore(storeData);
  const mockDB = {
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(),
    transaction: () => ({
      objectStore: () => store,
    }),
  };

  const openRequest = {
    result: mockDB,
    onupgradeneeded: null as (() => void) | null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };

  return {
    open: vi.fn(() => {
      setTimeout(() => openRequest.onsuccess?.(), 0);
      return openRequest;
    }),
    storeData,
    store,
  };
}

describe('WebFileSystem', () => {
  let fs: FileSystemInterface;
  let mockIndexedDB: ReturnType<typeof createMockIDB>;

  beforeEach(() => {
    // Setup basic DOM mocks
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => {
        if (tag === 'input') {
          return createMockInput();
        }
        if (tag === 'a') {
          return createMockAnchor();
        }
        return {};
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });

    // Setup IndexedDB mock
    mockIndexedDB = createMockIDB();
    vi.stubGlobal('indexedDB', mockIndexedDB);

    // Setup URL mock
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    // Setup Blob mock
    vi.stubGlobal('Blob', class MockBlob {
      constructor(public parts: unknown[], public options?: { type?: string }) {}
    });

    // Default: no File System Access API
    vi.stubGlobal('window', {});

    // Default: no navigator.storage
    vi.stubGlobal('navigator', {});

    fs = createWebPlatformProvider().fileSystem;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // --- pickFiles tests ---

  describe('pickFiles()', () => {
    it('uses showOpenFilePicker when available with correct options', async () => {
      const mockFile = {
        name: 'test.png',
        size: 1024,
        type: 'image/png',
        lastModified: Date.now(),
      };
      const mockHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile),
      };
      const showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle]);

      vi.stubGlobal('window', { showOpenFilePicker });

      // Re-create fs after stubbing window
      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.pickFiles({
        acceptedTypes: ['image/png'],
        multiple: false,
        maxSizeBytes: 5000,
      });

      expect(showOpenFilePicker).toHaveBeenCalledWith({
        multiple: false,
        types: [{ description: 'Accepted files', accept: { 'image/png': [] } }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test.png');
      expect(result[0].sizeBytes).toBe(1024);
      expect(result[0].mimeType).toBe('image/png');
    });

    it('falls back to <input type="file"> when File System Access API not available', async () => {
      // window does not have showOpenFilePicker
      vi.stubGlobal('window', {});

      let changeHandler: (() => void) | null = null;
      const mockInput = {
        type: '',
        multiple: false,
        accept: '',
        style: { display: '' },
        addEventListener: vi.fn((event: string, handler: () => void) => {
          if (event === 'change') changeHandler = handler;
        }),
        click: vi.fn(),
        files: null as FileList | null,
      };

      vi.stubGlobal('document', {
        createElement: vi.fn((tag: string) => {
          if (tag === 'input') return mockInput;
          return {};
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      });

      fs = createWebPlatformProvider().fileSystem;

      const mockFile = {
        name: 'doc.pdf',
        size: 2048,
        type: 'application/pdf',
        lastModified: Date.now(),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(2048)),
      };

      // Simulate the file picker flow
      const pickPromise = fs.pickFiles({
        acceptedTypes: ['application/pdf'],
        multiple: false,
      });

      // Simulate user selecting a file
      mockInput.files = { length: 1, 0: mockFile, item: (i: number) => i === 0 ? mockFile : null } as unknown as FileList;
      changeHandler!();

      const result = await pickPromise;

      expect(mockInput.type).toBe('file');
      expect(mockInput.accept).toBe('application/pdf');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('doc.pdf');
      expect(result[0].sizeBytes).toBe(2048);
    });

    it('returns empty array on user cancel (AbortError)', async () => {
      const showOpenFilePicker = vi.fn().mockRejectedValue(
        new DOMException('User cancelled', 'AbortError')
      );

      vi.stubGlobal('window', { showOpenFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.pickFiles({
        acceptedTypes: ['image/png'],
        multiple: false,
      });

      expect(result).toEqual([]);
      // Should not set an error for user cancellation
      expect(fs.getLastError()).toBeNull();
    });

    it('sets PERMISSION_DENIED when SecurityError is thrown', async () => {
      const showOpenFilePicker = vi.fn().mockRejectedValue(
        new DOMException('Permission denied', 'SecurityError')
      );

      vi.stubGlobal('window', { showOpenFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.pickFiles({
        acceptedTypes: [],
        multiple: false,
      });

      expect(result).toEqual([]);
      expect(fs.getLastError()).not.toBeNull();
      expect(fs.getLastError()!.code).toBe('PERMISSION_DENIED');
    });

    it('sets FILE_TOO_LARGE when a file exceeds maxSizeBytes', async () => {
      const mockFile = {
        name: 'large.bin',
        size: 10000,
        type: 'application/octet-stream',
        lastModified: Date.now(),
      };
      const mockHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile),
      };
      const showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle]);

      vi.stubGlobal('window', { showOpenFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.pickFiles({
        acceptedTypes: [],
        multiple: false,
        maxSizeBytes: 5000,
      });

      // File exceeds max size, so it's excluded from results
      expect(result).toHaveLength(0);
      expect(fs.getLastError()!.code).toBe('FILE_TOO_LARGE');
    });
  });

  // --- readFile tests ---

  describe('readFile()', () => {
    it('reads from file handle when available (via pickFiles caching)', async () => {
      const fileData = new ArrayBuffer(16);
      const mockFile = {
        name: 'cached.txt',
        size: 16,
        type: 'text/plain',
        lastModified: Date.now(),
        arrayBuffer: vi.fn().mockResolvedValue(fileData),
      };
      const mockHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile),
      };
      const showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle]);

      vi.stubGlobal('window', { showOpenFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      // First pick the file to cache the handle
      await fs.pickFiles({ acceptedTypes: [], multiple: false });

      // Now read using the cached handle
      const result = await fs.readFile('cached.txt');

      expect(mockHandle.getFile).toHaveBeenCalledTimes(2); // Once in pick, once in read
      expect(result.data).toBe(fileData);
      expect(result.metadata.name).toBe('cached.txt');
      expect(result.metadata.sizeBytes).toBe(16);
    });

    it('falls back to IndexedDB when no handle is available', async () => {
      const storedData = new ArrayBuffer(32);
      const storeData = new Map<string, unknown>();
      storeData.set('notes/file.txt', { data: storedData, mimeType: 'text/plain', lastModified: 1700000000000 });

      mockIndexedDB = createMockIDB(storeData);
      vi.stubGlobal('indexedDB', mockIndexedDB);
      vi.stubGlobal('window', {}); // No File System Access API

      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.readFile('notes/file.txt');

      expect(result.data).toBe(storedData);
      expect(result.metadata.name).toBe('file.txt');
      expect(result.metadata.mimeType).toBe('text/plain');
      expect(result.metadata.sizeBytes).toBe(32);
    });

    it('sets FILE_NOT_FOUND when file does not exist in IndexedDB', async () => {
      // Empty store — no files
      mockIndexedDB = createMockIDB(new Map());
      vi.stubGlobal('indexedDB', mockIndexedDB);
      vi.stubGlobal('window', {}); // No File System Access API

      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.readFile('nonexistent.txt');

      expect(result.data.byteLength).toBe(0);
      expect(fs.getLastError()).not.toBeNull();
      expect(fs.getLastError()!.code).toBe('FILE_NOT_FOUND');
    });

    it('sets PERMISSION_DENIED on NotAllowedError', async () => {
      // Create a mock handle that throws NotAllowedError
      const mockHandle = {
        getFile: vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError')),
      };
      const showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle]);

      vi.stubGlobal('window', { showOpenFilePicker });

      // We need to craft the scenario where a cached handle throws
      // Create fs, pick a file (which caches the handle), then read it with a rejection
      const mockFileForPick = {
        name: 'secure.txt',
        size: 10,
        type: 'text/plain',
        lastModified: Date.now(),
      };
      const pickHandle = {
        getFile: vi.fn()
          .mockResolvedValueOnce(mockFileForPick) // For the pick call
          .mockRejectedValueOnce(new DOMException('Not allowed', 'NotAllowedError')), // For the read call
      };
      showOpenFilePicker.mockResolvedValue([pickHandle]);

      fs = createWebPlatformProvider().fileSystem;
      await fs.pickFiles({ acceptedTypes: [], multiple: false });

      const result = await fs.readFile('secure.txt');

      expect(result.data.byteLength).toBe(0);
      expect(fs.getLastError()!.code).toBe('PERMISSION_DENIED');
    });
  });

  // --- writeFile tests ---

  describe('writeFile()', () => {
    it('uses showSaveFilePicker when available', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };
      const showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

      vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const data = new ArrayBuffer(64);
      const result = await fs.writeFile('output.pdf', data, 'application/pdf');

      expect(showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'output.pdf',
        types: [{ description: 'File', accept: { 'application/pdf': [] } }],
      });
      expect(mockWritable.write).toHaveBeenCalledWith(data);
      expect(mockWritable.close).toHaveBeenCalled();
      expect(result.name).toBe('output.pdf');
      expect(result.sizeBytes).toBe(64);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('falls back to download link and IndexedDB when File System Access API is unavailable', async () => {
      vi.stubGlobal('window', {}); // No File System Access API

      const mockAnchor = createMockAnchor();
      vi.stubGlobal('document', {
        createElement: vi.fn((tag: string) => {
          if (tag === 'a') return mockAnchor;
          return {};
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      });

      // Use an IndexedDB mock that tracks puts
      const storeData = new Map<string, unknown>();
      mockIndexedDB = createMockIDB(storeData);
      vi.stubGlobal('indexedDB', mockIndexedDB);

      fs = createWebPlatformProvider().fileSystem;

      const data = new ArrayBuffer(128);
      const result = await fs.writeFile('export.txt', data, 'text/plain');

      // Should have stored in IndexedDB
      expect(storeData.has('export.txt')).toBe(true);
      // Should have triggered a download
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toBe('export.txt');
      expect(result.name).toBe('export.txt');
      expect(result.sizeBytes).toBe(128);
      expect(result.mimeType).toBe('text/plain');
    });

    it('sets PERMISSION_DENIED on NotAllowedError during write', async () => {
      const showSaveFilePicker = vi.fn().mockRejectedValue(
        new DOMException('Not allowed', 'NotAllowedError')
      );

      vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const data = new ArrayBuffer(10);
      await fs.writeFile('test.txt', data, 'text/plain');

      expect(fs.getLastError()!.code).toBe('PERMISSION_DENIED');
    });

    it('sets STORAGE_FULL on QuotaExceededError', async () => {
      const showSaveFilePicker = vi.fn().mockRejectedValue(
        new DOMException('Quota exceeded', 'QuotaExceededError')
      );

      vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const data = new ArrayBuffer(10);
      await fs.writeFile('test.txt', data, 'text/plain');

      expect(fs.getLastError()!.code).toBe('STORAGE_FULL');
    });

    it('sets WRITE_FAILED on generic error', async () => {
      const showSaveFilePicker = vi.fn().mockRejectedValue(new Error('Disk error'));

      vi.stubGlobal('window', { showOpenFilePicker: vi.fn(), showSaveFilePicker });
      fs = createWebPlatformProvider().fileSystem;

      const data = new ArrayBuffer(10);
      await fs.writeFile('test.txt', data, 'text/plain');

      expect(fs.getLastError()!.code).toBe('WRITE_FAILED');
    });
  });

  // --- getAvailableSpace tests ---

  describe('getAvailableSpace()', () => {
    it('returns available bytes from navigator.storage.estimate()', async () => {
      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockResolvedValue({ quota: 1_000_000, usage: 250_000 }),
        },
      });

      fs = createWebPlatformProvider().fileSystem;

      const space = await fs.getAvailableSpace();
      expect(space).toBe(750_000);
    });

    it('returns 0 when navigator.storage is not available', async () => {
      vi.stubGlobal('navigator', {});

      fs = createWebPlatformProvider().fileSystem;

      const space = await fs.getAvailableSpace();
      expect(space).toBe(0);
    });

    it('sets READ_FAILED and returns 0 when estimate() throws', async () => {
      vi.stubGlobal('navigator', {
        storage: {
          estimate: vi.fn().mockRejectedValue(new Error('Storage error')),
        },
      });

      fs = createWebPlatformProvider().fileSystem;

      const space = await fs.getAvailableSpace();
      expect(space).toBe(0);
      expect(fs.getLastError()!.code).toBe('READ_FAILED');
    });
  });

  // --- deleteFile tests ---

  describe('deleteFile()', () => {
    it('removes from IndexedDB and returns true', async () => {
      const storeData = new Map<string, unknown>();
      storeData.set('toDelete.txt', { data: new ArrayBuffer(10), mimeType: 'text/plain', lastModified: Date.now() });

      mockIndexedDB = createMockIDB(storeData);
      vi.stubGlobal('indexedDB', mockIndexedDB);
      vi.stubGlobal('window', {});

      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.deleteFile('toDelete.txt');
      expect(result).toBe(true);
    });

    it('returns false for non-existent file', async () => {
      const storeData = new Map<string, unknown>();
      mockIndexedDB = createMockIDB(storeData);
      vi.stubGlobal('indexedDB', mockIndexedDB);
      vi.stubGlobal('window', {});

      fs = createWebPlatformProvider().fileSystem;

      const result = await fs.deleteFile('nonexistent.txt');
      expect(result).toBe(false);
      expect(fs.getLastError()!.code).toBe('FILE_NOT_FOUND');
    });
  });

  // --- getLastError tests ---

  describe('getLastError()', () => {
    it('returns null initially', () => {
      fs = createWebPlatformProvider().fileSystem;
      expect(fs.getLastError()).toBeNull();
    });
  });
});

// --- Mock factory helpers ---

function createMockInput() {
  return {
    type: '',
    multiple: false,
    accept: '',
    style: { display: '' },
    addEventListener: vi.fn(),
    click: vi.fn(),
    files: null,
  };
}

function createMockAnchor() {
  return {
    href: '',
    download: '',
    style: { display: '' },
    click: vi.fn(),
  };
}
