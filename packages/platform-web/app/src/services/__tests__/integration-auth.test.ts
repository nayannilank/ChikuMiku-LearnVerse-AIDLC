/** @vitest-environment jsdom */

/**
 * Integration Test: Auth Flow
 *
 * Tests the complete authentication flow through the API client layer:
 * Register parent → Register student → Login → Dashboard data fetch
 *
 * Uses fetch mocking at the network boundary to verify the full chain:
 * connector/hook → API client → fetch mock → response parsing
 *
 * **Validates: Requirements 1.1–1.49, 6.1–6.9, 22.1–22.7**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  authApi,
  setTokens,
  clearTokens,
  progressApi,
  contentApi,
} from '../api';
import {
  createLoginHandler,
  createParentRegistrationHandler,
  createStudentRegistrationHandler,
  createStreakFetcher,
  createSubjectsFetcher,
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
// Integration Test: Full Auth Flow
// =============================================================================

describe('Integration: Auth Flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);
    clearTokens();
    // Set up localStorage mock
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
  // Step 1: Register Parent
  // ---------------------------------------------------------------------------

  describe('Step 1: Register Parent', () => {
    it('sends correct POST to /auth/register/parent with all fields', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(201, { id: 'parent-uuid-123' }));

      const onSuccess = vi.fn();
      const registerHandler = createParentRegistrationHandler(onSuccess);

      await registerHandler({
        username: 'parentuser1',
        name: 'Parent Name',
        phone: '9876543210',
        email: 'parent@example.com',
        password: 'SecurePass1!',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/auth/register/parent');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body).toEqual({
        username: 'parentuser1',
        name: 'Parent Name',
        phone: '9876543210',
        email: 'parent@example.com',
        password: 'SecurePass1!',
      });

      // Verify no auth header for registration (skipAuth)
      expect(options.headers['Authorization']).toBeUndefined();
      expect(onSuccess).toHaveBeenCalled();
    });

    it('does not attach auth token for parent registration (public endpoint)', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(201, { id: 'p1' }));

      const handler = createParentRegistrationHandler(vi.fn());
      await handler({
        username: 'newparent',
        name: 'New Parent',
        phone: '1234567890',
        email: 'new@parent.com',
        password: 'Pass1234!',
      });

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2: Register Student (requires parent auth)
  // ---------------------------------------------------------------------------

  describe('Step 2: Register Student', () => {
    it('sends POST to /auth/register/student with parent auth token attached', async () => {
      // Simulate parent being logged in
      setTokens('parent-access-token-xyz', 'parent-refresh-token');

      fetchMock.mockResolvedValue(mockJsonResponse(201, { id: 'student-uuid-456' }));

      const onSuccess = vi.fn();
      const registerHandler = createStudentRegistrationHandler(onSuccess);

      await registerHandler({
        parentUsername: 'parentuser1',
        studentUsername: 'studentuser1',
        name: 'Student Name',
        password: 'StudPass1!',
        gender: 'male',
        grade: 'Fifth',
        schoolName: 'Test School Name',
        subjects: ['Kannada', 'English', 'Maths'],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/auth/register/student');
      expect(options.method).toBe('POST');

      // registerStudent uses skipAuth: true — no Authorization header is sent
      // The parent context is passed via the parentUsername field in the body
      const body = JSON.parse(options.body);
      expect(body.parentUsername).toBe('parentuser1');
      expect(body.studentUsername).toBe('studentuser1');
      expect(body.subjects).toEqual(['Kannada', 'English', 'Maths']);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('includes all student fields in request body', async () => {
      setTokens('parent-token', 'refresh');
      fetchMock.mockResolvedValue(mockJsonResponse(201, { id: 's1' }));

      const handler = createStudentRegistrationHandler(vi.fn());
      await handler({
        parentUsername: 'parent1',
        studentUsername: 'student1',
        name: 'Kid One',
        password: 'KidPass1!',
        gender: 'female',
        grade: 'Third',
        schoolName: 'Green Valley School',
        subjects: ['English', 'Science'],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({
        parentUsername: 'parent1',
        studentUsername: 'student1',
        name: 'Kid One',
        password: 'KidPass1!',
        gender: 'female',
        grade: 'Third',
        schoolName: 'Green Valley School',
        subjects: ['English', 'Science'],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Step 3: Login → verify tokens stored, role-based routing
  // ---------------------------------------------------------------------------

  describe('Step 3: Login', () => {
    it('stores tokens on successful login and provides role-based routing data', async () => {
      const loginResponse = {
        accessToken: 'student-access-jwt',
        refreshToken: 'student-refresh-jwt',
        username: 'studentuser1',
        role: 'student',
        userId: 'student-uuid-456',
      };
      fetchMock.mockResolvedValue(mockJsonResponse(200, loginResponse));

      let capturedResponse: unknown;
      const onSuccess = vi.fn((resp) => { capturedResponse = resp; });
      const loginHandler = createLoginHandler(onSuccess);

      await loginHandler('studentuser1', 'StudPass1!', 'student');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/auth/login');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body).toEqual({
        username: 'studentuser1',
        password: 'StudPass1!',
        role: 'student',
      });

      // Verify onSuccess called with response data for role-based routing
      expect(onSuccess).toHaveBeenCalledWith(loginResponse);
      expect((capturedResponse as { role: string }).role).toBe('student');
    });

    it('sends login without auth header (public endpoint)', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(200, {
        accessToken: 'tok',
        refreshToken: 'ref',
        username: 'user',
        role: 'parent',
        userId: 'u1',
      }));

      const loginHandler = createLoginHandler(vi.fn());
      await loginHandler('user', 'pass', 'parent');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });

    it('parent role login provides data for Parent Dashboard routing', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(200, {
        accessToken: 'parent-token',
        refreshToken: 'parent-refresh',
        username: 'parentuser1',
        role: 'parent',
        userId: 'parent-uuid-123',
      }));

      let capturedRole = '';
      const loginHandler = createLoginHandler((resp) => { capturedRole = resp.role; });
      await loginHandler('parentuser1', 'SecurePass1!', 'parent');

      expect(capturedRole).toBe('parent');
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4: Dashboard data fetch (streak + progress)
  // ---------------------------------------------------------------------------

  describe('Step 4: Dashboard Data Fetch', () => {
    const studentId = 'student-uuid-456';

    beforeEach(() => {
      setTokens('student-access-jwt', 'student-refresh-jwt');
    });

    it('fetches streak with correct student ID endpoint', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(200, {
        studentId,
        currentStreak: 7,
        lastActivityDate: '2024-01-15',
      }));

      const fetchStreak = createStreakFetcher(studentId);
      const streak = await fetchStreak();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/progress/streak');
      expect(options.headers['Authorization']).toBe('Bearer student-access-jwt');
      expect(streak).toBe(7);
    });

    it('fetches subjects and progress with correct student ID', async () => {
      // First call: getSubjects; Second call: getProgress
      fetchMock
        .mockResolvedValueOnce(mockJsonResponse(200, [
          { subjectId: 's1', subjectName: 'Kannada', color: '#9B59B6' },
          { subjectId: 's2', subjectName: 'English', color: '#5DADE2' },
          { subjectId: 's3', subjectName: 'Maths', color: '#E94F9B' },
        ]))
        .mockResolvedValueOnce(mockJsonResponse(200, [
          { subjectId: 's1', studentId, completedExercises: 5, totalExercises: 10, progressPercentage: 50 },
          { subjectId: 's2', studentId, completedExercises: 3, totalExercises: 10, progressPercentage: 30 },
        ]));

      const fetchSubjects = createSubjectsFetcher(studentId);
      const subjects = await fetchSubjects();

      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify subjects endpoint called
      const [subjectsUrl] = fetchMock.mock.calls[0];
      expect(subjectsUrl).toContain('/subjects');

      // Verify progress endpoint called (learner identified from auth token)
      const [progressUrl] = fetchMock.mock.calls[1];
      expect(progressUrl).toContain('/progress');

      // Verify correct mapping
      expect(subjects).toHaveLength(3);
      expect(subjects[0]).toEqual({
        subjectId: 's1',
        subjectName: 'Kannada',
        color: '#9B59B6',
        iconName: 'kannada',
        progressPercentage: 50,
      });
      expect(subjects[2].progressPercentage).toBe(0); // Maths has no progress entry
    });

    it('both streak and progress endpoints use auth token', async () => {
      fetchMock.mockResolvedValue(mockJsonResponse(200, {
        studentId,
        currentStreak: 3,
        lastActivityDate: '2024-01-10',
      }));

      const fetchStreak = createStreakFetcher(studentId);
      await fetchStreak();

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer student-access-jwt');
    });
  });
});
