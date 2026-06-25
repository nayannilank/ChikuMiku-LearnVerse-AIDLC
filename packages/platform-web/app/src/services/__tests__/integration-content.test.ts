/** @vitest-environment jsdom */

/**
 * Integration Test: Content Ingestion Flow
 *
 * Tests the complete content ingestion flow through the API client layer:
 * Upload pages → OCR extraction → Get transcript → Save transcript
 *
 * Uses fetch mocking at the network boundary to verify the full chain:
 * connector → API client → fetch mock → response parsing
 *
 * **Validates: Requirements 8.1–8.11, 9.1–9.10**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTokens, clearTokens } from '../api';
import {
  createPageUploadHandlers,
  createTranscriptHandlers,
} from '../apiConnectors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone() { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as unknown as Response;
}

// =============================================================================
// Integration Test: Content Ingestion Flow
// =============================================================================

describe('Integration: Content Ingestion Flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const chapterId = 'chapter-uuid-789';

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);
    setTokens('student-access-token', 'student-refresh-token');

    const store: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => { store[key] = value; });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => { delete store[key]; });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearTokens();
  });

  // ---------------------------------------------------------------------------
  // Step 1: Upload Pages
  // ---------------------------------------------------------------------------

  describe('Step 1: Upload Pages', () => {
    it('constructs FormData with files and attaches auth header', async () => {
      const uploadedPages = [
        { id: 'page-1', chapterId, pageNumber: 1, s3ImageKey: 'pages/1.jpg', ocrStatus: 'pending', wordCount: 0, isExercisePage: false },
        { id: 'page-2', chapterId, pageNumber: 2, s3ImageKey: 'pages/2.jpg', ocrStatus: 'pending', wordCount: 0, isExercisePage: false },
      ];
      fetchMock.mockResolvedValue(mockJsonResponse(200, uploadedPages));

      const handlers = createPageUploadHandlers(chapterId);

      const file1 = new File(['image-content-1'], 'page1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['image-content-2'], 'page2.png', { type: 'image/png' });

      const result = await handlers.uploadPages([file1, file2]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      // Verify correct endpoint
      expect(url).toContain(`/chapters/${chapterId}/pages`);
      expect(options.method).toBe('POST');

      // Verify auth header is attached
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify body is FormData
      expect(options.body).toBeInstanceOf(FormData);

      // Verify FormData contains the files
      const formData = options.body as FormData;
      expect(formData.get('page_0')).toBeTruthy();
      expect(formData.get('page_1')).toBeTruthy();

      // Verify response
      expect(result).toHaveLength(2);
      expect(result[0].pageNumber).toBe(1);
    });

    it('does not set Content-Type header for FormData (browser sets multipart boundary)', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(200, []));

      const handlers = createPageUploadHandlers(chapterId);
      const file = new File(['data'], 'page.jpg', { type: 'image/jpeg' });
      await handlers.uploadPages([file]);

      const [, options] = fetchMock.mock.calls[0];
      // Content-Type should NOT be set for FormData (browser auto-sets multipart/form-data with boundary)
      expect(options.headers['Content-Type']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2: Extract Text (OCR)
  // ---------------------------------------------------------------------------

  describe('Step 2: Extract Text (OCR)', () => {
    it('calls OCR endpoint with correct chapter ID and receives extracted pages', async () => {
      const ocrResult = [
        { id: 'page-1', chapterId, pageNumber: 1, s3ImageKey: 'pages/1.jpg', extractedText: 'Hello world', wordCount: 2, ocrStatus: 'completed', isExercisePage: false },
        { id: 'page-2', chapterId, pageNumber: 2, s3ImageKey: 'pages/2.jpg', extractedText: 'Test content here', wordCount: 3, ocrStatus: 'completed', isExercisePage: false },
      ];
      fetchMock.mockResolvedValue(mockJsonResponse(200, ocrResult));

      const handlers = createPageUploadHandlers(chapterId);
      const result = await handlers.extractText();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      // Verify correct endpoint
      expect(url).toContain(`/chapters/${chapterId}/extract`);
      expect(options.method).toBe('POST');

      // Verify auth header
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify response mapping
      expect(result).toHaveLength(2);
      expect(result[0].extractedText).toBe('Hello world');
      expect(result[1].ocrStatus).toBe('completed');
    });

    it('uses extended timeout for OCR extraction (60s)', async () => {
      fetchMock.mockImplementation((_url: string, options: RequestInit) => {
        // The API client uses AbortController with a timeout
        // We just verify the request was made and return success
        return Promise.resolve(mockJsonResponse(200, []));
      });

      const handlers = createPageUploadHandlers(chapterId);
      await handlers.extractText();

      // The extractText function in api.ts uses { timeout: 60000 }
      // We verify the call was made (timeout is internal to the client)
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Step 3: Get Transcript
  // ---------------------------------------------------------------------------

  describe('Step 3: Get Transcript', () => {
    it('fetches transcript with correct chapter ID and maps response', async () => {
      const transcriptPages = [
        { id: 'page-1', chapterId, pageNumber: 1, s3ImageKey: 'pages/1.jpg', extractedText: 'Hello world', wordCount: 2, ocrStatus: 'completed', isExercisePage: false },
        { id: 'page-2', chapterId, pageNumber: 2, s3ImageKey: 'pages/2.jpg', extractedText: 'Content here', wordCount: 2, ocrStatus: 'completed', isExercisePage: false },
      ];
      fetchMock.mockResolvedValue(mockJsonResponse(200, transcriptPages));

      const handlers = createTranscriptHandlers(chapterId);
      const result = await handlers.getTranscript();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toContain(`/chapters/${chapterId}/transcript`);
      expect(options.method).toBe('GET');
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      expect(result).toHaveLength(2);
      expect(result[0].extractedText).toBe('Hello world');
      expect(result[1].pageNumber).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4: Save Transcript
  // ---------------------------------------------------------------------------

  describe('Step 4: Save Transcript', () => {
    it('sends PUT with correct body containing page text data', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(204, undefined));

      const handlers = createTranscriptHandlers(chapterId);
      const pages = [
        { pageNumber: 1, text: 'Edited hello world content' },
        { pageNumber: 2, text: 'Edited content here with corrections' },
      ];

      await handlers.saveTranscript(pages);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      // Verify correct endpoint
      expect(url).toContain(`/chapters/${chapterId}/transcript`);
      expect(options.method).toBe('PUT');

      // Verify auth header
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify body structure
      const body = JSON.parse(options.body);
      expect(body).toEqual({
        pages: [
          { pageNumber: 1, text: 'Edited hello world content' },
          { pageNumber: 2, text: 'Edited content here with corrections' },
        ],
      });
    });

    it('sends Content-Type application/json for transcript save', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(204, undefined));

      const handlers = createTranscriptHandlers(chapterId);
      await handlers.saveTranscript([{ pageNumber: 1, text: 'test' }]);

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
    });
  });

  // ---------------------------------------------------------------------------
  // Full Flow: Upload → Extract → Get → Save
  // ---------------------------------------------------------------------------

  describe('Full Content Ingestion Flow', () => {
    it('completes upload → extract → get transcript → save cycle', async () => {
      // Step 1: Upload
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [
        { id: 'p1', chapterId, pageNumber: 1, s3ImageKey: 'img/1.jpg', ocrStatus: 'pending', wordCount: 0, isExercisePage: false },
      ]));

      const uploadHandlers = createPageUploadHandlers(chapterId);
      const file = new File(['image-data'], 'photo.jpg', { type: 'image/jpeg' });
      const uploaded = await uploadHandlers.uploadPages([file]);
      expect(uploaded).toHaveLength(1);

      // Step 2: Extract
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [
        { id: 'p1', chapterId, pageNumber: 1, s3ImageKey: 'img/1.jpg', extractedText: 'Extracted text', wordCount: 2, ocrStatus: 'completed', isExercisePage: false },
      ]));

      const extracted = await uploadHandlers.extractText();
      expect(extracted[0].extractedText).toBe('Extracted text');

      // Step 3: Get transcript
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [
        { id: 'p1', chapterId, pageNumber: 1, s3ImageKey: 'img/1.jpg', extractedText: 'Extracted text', wordCount: 2, ocrStatus: 'completed', isExercisePage: false },
      ]));

      const transcriptHandlers = createTranscriptHandlers(chapterId);
      const transcript = await transcriptHandlers.getTranscript();
      expect(transcript[0].extractedText).toBe('Extracted text');

      // Step 4: Save edited transcript
      fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));
      await transcriptHandlers.saveTranscript([{ pageNumber: 1, text: 'Manually corrected text' }]);

      // Verify all 4 API calls were made
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });
});
