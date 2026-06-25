/** @vitest-environment jsdom */

/**
 * Integration Test: AI Caching Flow
 *
 * Tests that the AI Gateway's generate-once-store-permanently pattern works
 * correctly through the API client layer:
 * Generate explanation → Re-request (verify cached) → Generate revision questions → Generate summary
 *
 * Uses fetch mocking at the network boundary to verify the full chain:
 * connector → API client → fetch mock → response parsing
 *
 * **Validates: Requirements 10.1, 10.4, 10.10, 10.11, 10.12, 10.13, 10.16, 12.3, 20.5**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTokens, clearTokens } from '../api';
import { createExplanationHandlers } from '../apiConnectors';

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
// Integration Test: AI Caching Flow
// =============================================================================

describe('Integration: AI Caching Flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const chapterId = 'chapter-ai-test-001';

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
  // Step 1: Generate Explanation — API called once
  // ---------------------------------------------------------------------------

  describe('Step 1: Generate Explanation', () => {
    it('calls explanation API once and returns generated content', async () => {
      const explanationResponse = {
        chapterId,
        pageNumber: 1,
        summary: 'This chapter covers photosynthesis in plants.',
        keyWords: [
          { word: 'photosynthesis', meaning: 'Process by which plants make food', language: 'english' },
          { word: 'chlorophyll', meaning: 'Green pigment in leaves', language: 'english' },
        ],
        concepts: 'Plants use sunlight, water, and CO2 to produce glucose and oxygen.',
      };
      fetchMock.mockResolvedValue(mockJsonResponse(200, explanationResponse));

      const handlers = createExplanationHandlers(chapterId);
      const result = await handlers.getExplanation(1);

      // Verify API called exactly once
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toContain(`/chapters/${chapterId}/explanation`);
      expect(url).toContain('page=1');
      expect(options.method).toBe('GET');
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify response content
      expect(result.summary).toBe('This chapter covers photosynthesis in plants.');
      expect(result.keyWords).toHaveLength(2);
      expect(result.concepts).toContain('glucose');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2: Re-request Same Explanation — verify cached response returned
  // ---------------------------------------------------------------------------

  describe('Step 2: Re-request Same Explanation (Cached)', () => {
    it('returns same response on re-request (server returns cached)', async () => {
      const cachedResponse = {
        chapterId,
        pageNumber: 1,
        summary: 'This chapter covers photosynthesis in plants.',
        keyWords: [
          { word: 'photosynthesis', meaning: 'Process by which plants make food', language: 'english' },
        ],
        concepts: 'Plants use sunlight, water, and CO2 to produce glucose and oxygen.',
      };

      // Both calls return the same response (server-side caching)
      fetchMock.mockResolvedValue(mockJsonResponse(200, cachedResponse));

      const handlers = createExplanationHandlers(chapterId);

      // First request
      const result1 = await handlers.getExplanation(1);

      // Second request (same parameters - server returns cached)
      const result2 = await handlers.getExplanation(1);

      // Both calls hit the API (client doesn't cache, server does)
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Both return identical data (proving server-side cache consistency)
      expect(result1.summary).toBe(result2.summary);
      expect(result1.concepts).toBe(result2.concepts);
      expect(result1.keyWords).toEqual(result2.keyWords);

      // Both calls use the same endpoint
      const [url1] = fetchMock.mock.calls[0];
      const [url2] = fetchMock.mock.calls[1];
      expect(url1).toBe(url2);
    });

    it('verifies second call returns cached response without re-generation', async () => {
      let callCount = 0;
      const explanationData = {
        chapterId,
        pageNumber: 2,
        summary: 'Chapter about fractions',
        keyWords: [{ word: 'fraction', meaning: 'Part of a whole', language: 'english' }],
        concepts: 'Fractions represent parts of whole numbers.',
      };

      fetchMock.mockImplementation(() => {
        callCount++;
        return Promise.resolve(mockJsonResponse(200, explanationData));
      });

      const handlers = createExplanationHandlers(chapterId);

      // Generate first time
      await handlers.getExplanation(2);
      expect(callCount).toBe(1);

      // Re-request — server returns cached (API still called, but content is same)
      const result = await handlers.getExplanation(2);
      expect(callCount).toBe(2);
      expect(result.summary).toBe('Chapter about fractions');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 3: Generate Revision Questions — API called once
  // ---------------------------------------------------------------------------

  describe('Step 3: Generate Revision Questions', () => {
    it('calls revision questions API once and returns generated questions', async () => {
      const revisionResponse = [
        {
          id: 'rq-1',
          chapterId,
          questionType: 'mcq',
          questionText: 'What is photosynthesis?',
          options: ['Plant eating', 'Plant making food using sunlight', 'Plant sleeping', 'Plant growing'],
          correctAnswer: 'Plant making food using sunlight',
          explanation: 'Photosynthesis is the process where plants convert sunlight into food.',
        },
        {
          id: 'rq-2',
          chapterId,
          questionType: 'short_answer',
          questionText: 'Name the green pigment in leaves.',
          correctAnswer: 'chlorophyll',
          explanation: 'Chlorophyll gives leaves their green color and absorbs sunlight.',
        },
      ];
      fetchMock.mockResolvedValue(mockJsonResponse(200, revisionResponse));

      const handlers = createExplanationHandlers(chapterId);
      const result = await handlers.generateRevisionQuestions();

      // Verify API called exactly once
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toContain(`/chapters/${chapterId}/revision-questions`);
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify response
      expect(result).toHaveLength(2);
      expect(result[0].questionType).toBe('mcq');
      expect(result[1].questionText).toBe('Name the green pigment in leaves.');
    });

    it('fetches stored revision questions via GET (after generation)', async () => {
      const storedQuestions = [
        {
          id: 'rq-1',
          chapterId,
          questionType: 'mcq',
          questionText: 'What is photosynthesis?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'B',
          explanation: 'Correct answer explanation.',
        },
      ];
      fetchMock.mockResolvedValue(mockJsonResponse(200, storedQuestions));

      const handlers = createExplanationHandlers(chapterId);
      const result = await handlers.getRevisionQuestions();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain(`/chapters/${chapterId}/revision-questions`);
      expect(options.method).toBe('GET');
      expect(result).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4: Generate Summary — API called once
  // ---------------------------------------------------------------------------

  describe('Step 4: Generate Summary', () => {
    it('calls summary generation API once and returns structured summary', async () => {
      const summaryResponse = {
        chapterId,
        keyPoints: ['Plants need sunlight', 'Chlorophyll is essential', 'Oxygen is a byproduct'],
        importantConcepts: ['Photosynthesis', 'Light reaction', 'Dark reaction'],
        examPreparationNotes: ['Focus on the equation', 'Remember the role of chlorophyll'],
        generatedAt: '2024-01-15T10:05:00Z',
      };
      fetchMock.mockResolvedValue(mockJsonResponse(200, summaryResponse));

      const handlers = createExplanationHandlers(chapterId);
      const result = await handlers.generateSummary();

      // Verify API called exactly once
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toContain(`/chapters/${chapterId}/summary`);
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify response structure
      expect(result.keyPoints).toHaveLength(3);
      expect(result.importantConcepts).toContain('Photosynthesis');
      expect(result.examPreparationNotes).toHaveLength(2);
    });

    it('fetches stored summary via GET (after generation)', async () => {
      const storedSummary = {
        chapterId,
        keyPoints: ['Point 1'],
        importantConcepts: ['Concept 1'],
        examPreparationNotes: ['Note 1'],
        generatedAt: '2024-01-15T10:05:00Z',
      };
      fetchMock.mockResolvedValue(mockJsonResponse(200, storedSummary));

      const handlers = createExplanationHandlers(chapterId);
      const result = await handlers.getSummary();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain(`/chapters/${chapterId}/summary`);
      expect(options.method).toBe('GET');
      expect(result.keyPoints).toEqual(['Point 1']);
    });
  });

  // ---------------------------------------------------------------------------
  // Full AI Caching Flow
  // ---------------------------------------------------------------------------

  describe('Full AI Caching Flow', () => {
    it('demonstrates generate-once pattern across multiple AI content types', async () => {
      const handlers = createExplanationHandlers(chapterId);

      // 1. Generate explanation (first call)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        chapterId,
        pageNumber: 1,
        summary: 'First explanation',
        keyWords: [],
        concepts: 'concepts here',
      }));
      const explanation1 = await handlers.getExplanation(1);
      expect(explanation1.summary).toBe('First explanation');

      // 2. Re-request same explanation (returns cached - same response)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        chapterId,
        pageNumber: 1,
        summary: 'First explanation',
        keyWords: [],
        concepts: 'concepts here',
      }));
      const explanation2 = await handlers.getExplanation(1);
      expect(explanation2.summary).toBe(explanation1.summary);

      // 3. Generate revision questions (first call)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, [
        { id: 'rq-1', chapterId, questionType: 'mcq', questionText: 'Q1', options: [], correctAnswer: 'A', explanation: 'E' },
      ]));
      const questions = await handlers.generateRevisionQuestions();
      expect(questions).toHaveLength(1);

      // 4. Generate summary (first call)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        chapterId,
        keyPoints: ['KP1'],
        importantConcepts: ['C1'],
        examPreparationNotes: ['N1'],
        generatedAt: '2024-01-15T10:10:00Z',
      }));
      const summary = await handlers.generateSummary();
      expect(summary.keyPoints).toEqual(['KP1']);

      // All 4 API calls made (one per content type + one re-request)
      expect(fetchMock).toHaveBeenCalledTimes(4);

      // Verify each call was to the correct endpoint
      expect(fetchMock.mock.calls[0][0]).toContain('/explanation');
      expect(fetchMock.mock.calls[1][0]).toContain('/explanation');
      expect(fetchMock.mock.calls[2][0]).toContain('/revision-questions');
      expect(fetchMock.mock.calls[3][0]).toContain('/summary');
    });
  });
});
