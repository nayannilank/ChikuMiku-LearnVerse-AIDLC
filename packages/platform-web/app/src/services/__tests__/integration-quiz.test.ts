/** @vitest-environment jsdom */

/**
 * Integration Test: Exercise/Quiz Flow
 *
 * Tests the complete quiz flow through the API client layer:
 * Create quiz session → Submit answers → Skip question → Get result
 *
 * Uses fetch mocking at the network boundary to verify the full chain:
 * connector → API client → fetch mock → response parsing
 *
 * **Validates: Requirements 14.1–14.10, 21.1–21.5**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTokens, clearTokens } from '../api';
import { createQuizHandlers } from '../apiConnectors';

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
// Integration Test: Quiz Flow
// =============================================================================

describe('Integration: Quiz Flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const studentId = 'student-uuid-456';
  const subjectId = 'subject-maths-id';

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
  // Step 1: Create Quiz Session
  // ---------------------------------------------------------------------------

  describe('Step 1: Create Quiz Session', () => {
    it('creates session and stores session ID for subsequent calls', async () => {
      const sessionResponse = {
        id: 'quiz-session-001',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
        timerDurationSeconds: 300,
        startedAt: '2024-01-15T10:00:00Z',
        totalQuestions: 5,
        correctAnswers: 0,
        status: 'active',
      };
      fetchMock.mockResolvedValue(mockJsonResponse(200, sessionResponse));

      const handlers = createQuizHandlers(studentId, subjectId);
      const session = await handlers.createSession(['q1', 'q2', 'q3', 'q4', 'q5'], 300);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      // Verify correct endpoint
      expect(url).toContain('/quiz/sessions');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer student-access-token');

      // Verify request body
      const body = JSON.parse(options.body);
      expect(body).toEqual({
        subjectId,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
        timerDurationSeconds: 300,
      });

      // Verify session data returned
      expect(session.id).toBe('quiz-session-001');
      expect(session.totalQuestions).toBe(5);
      expect(session.status).toBe('active');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2: Submit Answers
  // ---------------------------------------------------------------------------

  describe('Step 2: Submit Answers', () => {
    it('submits answer with session ID from create call', async () => {
      // First: create session
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'quiz-session-001',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2'],
        timerDurationSeconds: 120,
        startedAt: '2024-01-15T10:00:00Z',
        totalQuestions: 2,
        correctAnswers: 0,
        status: 'active',
      }));

      const handlers = createQuizHandlers(studentId, subjectId);
      await handlers.createSession(['q1', 'q2'], 120);

      // Then: submit answer
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        isCorrect: true,
        correctAnswer: 'B',
      }));

      const answerResult = await handlers.submitAnswer('q1', 'B');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, options] = fetchMock.mock.calls[1];

      // Verify session ID is included in the endpoint
      expect(url).toContain('/quiz/sessions/quiz-session-001/answer');
      expect(options.method).toBe('POST');

      // Verify answer body includes question ID and selected option
      const body = JSON.parse(options.body);
      expect(body).toEqual({
        questionId: 'q1',
        selectedOption: 'B',
      });

      expect(answerResult.isCorrect).toBe(true);
    });

    it('throws error if no active session when submitting', async () => {
      const handlers = createQuizHandlers(studentId, subjectId);

      // Try to submit without creating session
      await expect(handlers.submitAnswer('q1', 'A')).rejects.toThrow('No active quiz session');
    });

    it('submits multiple answers sequentially with same session ID', async () => {
      // Create session
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'session-xyz',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3'],
        timerDurationSeconds: 180,
        startedAt: '2024-01-15T10:00:00Z',
        totalQuestions: 3,
        correctAnswers: 0,
        status: 'active',
      }));

      const handlers = createQuizHandlers(studentId, subjectId);
      await handlers.createSession(['q1', 'q2', 'q3'], 180);

      // Submit first answer
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { isCorrect: true, correctAnswer: 'A' }));
      await handlers.submitAnswer('q1', 'A');

      // Submit second answer
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { isCorrect: false, correctAnswer: 'C' }));
      const result2 = await handlers.submitAnswer('q2', 'B');

      // Both answers use the same session ID
      const [url1] = fetchMock.mock.calls[1];
      const [url2] = fetchMock.mock.calls[2];
      expect(url1).toContain('/quiz/sessions/session-xyz/answer');
      expect(url2).toContain('/quiz/sessions/session-xyz/answer');
      expect(result2.isCorrect).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Step 3: Skip Question
  // ---------------------------------------------------------------------------

  describe('Step 3: Skip Question', () => {
    it('calls skip API with session ID and question ID', async () => {
      // Create session
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'quiz-session-002',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3'],
        timerDurationSeconds: 300,
        startedAt: '2024-01-15T10:00:00Z',
        totalQuestions: 3,
        correctAnswers: 0,
        status: 'active',
      }));

      const handlers = createQuizHandlers(studentId, subjectId);
      await handlers.createSession(['q1', 'q2', 'q3'], 300);

      // Skip a question
      fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));
      await handlers.skipQuestion('q2');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, options] = fetchMock.mock.calls[1];

      expect(url).toContain('/quiz/sessions/quiz-session-002/skip');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body).toEqual({ questionId: 'q2' });
    });

    it('does not throw if skip called without active session (graceful no-op)', async () => {
      const handlers = createQuizHandlers(studentId, subjectId);

      // Skip without session should not throw (returns early)
      await expect(handlers.skipQuestion('q1')).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4: Get Result — Final Score Calculation
  // ---------------------------------------------------------------------------

  describe('Step 4: Get Result', () => {
    it('fetches final result with score calculation (correct/total × 100)', async () => {
      // Create session
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'quiz-session-003',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
        timerDurationSeconds: 300,
        startedAt: '2024-01-15T10:00:00Z',
        totalQuestions: 5,
        correctAnswers: 0,
        status: 'active',
      }));

      const handlers = createQuizHandlers(studentId, subjectId);
      await handlers.createSession(['q1', 'q2', 'q3', 'q4', 'q5'], 300);

      // Get result
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'quiz-session-003',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
        timerDurationSeconds: 300,
        startedAt: '2024-01-15T10:00:00Z',
        endedAt: '2024-01-15T10:04:30Z',
        totalQuestions: 5,
        correctAnswers: 3,
        scorePercentage: 60.00, // 3/5 × 100
        status: 'completed',
      }));

      const result = await handlers.getResult();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, options] = fetchMock.mock.calls[1];

      expect(url).toContain('/quiz/sessions/quiz-session-003/result');
      expect(options.method).toBe('GET');

      // Verify score calculation: correct/total × 100
      expect(result).not.toBeNull();
      expect(result!.correctAnswers).toBe(3);
      expect(result!.totalQuestions).toBe(5);
      expect(result!.scorePercentage).toBe(60.00);
      expect(result!.status).toBe('completed');
    });

    it('returns null if no active session', async () => {
      const handlers = createQuizHandlers(studentId, subjectId);
      const result = await handlers.getResult();
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Full Flow: Create → Answer → Skip → Result
  // ---------------------------------------------------------------------------

  describe('Full Quiz Flow', () => {
    it('completes create → answer → skip → get result cycle', async () => {
      const handlers = createQuizHandlers(studentId, subjectId);

      // 1. Create session
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'full-flow-session',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3'],
        timerDurationSeconds: 180,
        startedAt: '2024-01-15T10:00:00Z',
        totalQuestions: 3,
        correctAnswers: 0,
        status: 'active',
      }));
      const session = await handlers.createSession(['q1', 'q2', 'q3'], 180);
      expect(session.id).toBe('full-flow-session');

      // 2. Answer first question (correct)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { isCorrect: true, correctAnswer: 'A' }));
      const answer1 = await handlers.submitAnswer('q1', 'A');
      expect(answer1.isCorrect).toBe(true);

      // 3. Skip second question
      fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));
      await handlers.skipQuestion('q2');

      // 4. Answer third question (incorrect)
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { isCorrect: false, correctAnswer: 'D' }));
      const answer3 = await handlers.submitAnswer('q3', 'B');
      expect(answer3.isCorrect).toBe(false);

      // 5. Get result
      fetchMock.mockResolvedValueOnce(mockJsonResponse(200, {
        id: 'full-flow-session',
        studentId,
        subjectId,
        questionIds: ['q1', 'q2', 'q3'],
        timerDurationSeconds: 180,
        startedAt: '2024-01-15T10:00:00Z',
        endedAt: '2024-01-15T10:02:45Z',
        totalQuestions: 3,
        correctAnswers: 1,
        scorePercentage: 33.33, // 1/3 × 100
        status: 'completed',
      }));
      const result = await handlers.getResult();

      expect(result).not.toBeNull();
      expect(result!.correctAnswers).toBe(1);
      expect(result!.totalQuestions).toBe(3);
      expect(result!.scorePercentage).toBe(33.33);

      // All 5 calls made
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });
  });
});
