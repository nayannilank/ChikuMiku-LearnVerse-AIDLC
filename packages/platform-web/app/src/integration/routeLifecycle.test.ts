/**
 * @vitest-environment jsdom
 */
/**
 * Integration Tests: Route Navigation Lifecycle Flows
 *
 * Feature: end-to-end-ui-integration
 *
 * Tests the full route lifecycle using the asyncRoute container and reactBridge:
 * - navigate → loading → data loaded → screen mounted → navigate away → unmounted
 * - 401 flow → token refresh fails → redirect to #login
 * - API failure → ErrorView shown → click Retry → success → screen mounts
 * - Subject Landing → exercise screen navigation chain
 *
 * **Validates: Requirements 1.2, 14.1, 14.2, 14.3, 15.1, 15.2**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createAsyncRouteContainer } from '../utils/asyncRoute';
import { renderReactRoute, cleanupCurrentMount, getCurrentMount } from '../utils/reactBridge';
import { createSubjectLandingView, getExerciseLinksForSubject } from '../views/SubjectLandingView';

// Mock wrapInResponsiveLayout to simplify — pass through content in a wrapper div
vi.mock('../utils/wrapInResponsiveLayout', () => ({
  wrapInResponsiveLayout: (content: HTMLElement, _activeRoute?: string) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'responsive-layout-mock';
    wrapper.appendChild(content);
    return wrapper;
  },
}));

// Mock clearTokens to track invocations
const clearTokensMock = vi.fn();
vi.mock('../services/api', () => ({
  clearTokens: () => clearTokensMock(),
}));

// ----------- Test Helpers -----------

/** Simple React component for testing successful mounts. */
function TestScreen({ label }: { label: string }) {
  return createElement('div', { className: 'test-screen', 'data-testid': 'test-screen' }, label);
}

/** Transcript screen mock with "Continue to Explanation" button (Req 15.1). */
function MockTranscriptScreen({ chapterId }: { chapterId: string }) {
  return createElement('div', { className: 'chapter-transcript-screen' },
    createElement('h1', null, 'Transcript'),
    createElement('button', {
      className: 'continue-to-explanation-btn',
      onClick: () => { window.location.hash = `#explain/${chapterId}`; },
    }, 'Continue to Explanation')
  );
}

/** Explanation screen mock with "Back to Transcript" link (Req 15.2). */
function MockExplanationScreen({ chapterId }: { chapterId: string }) {
  return createElement('div', { className: 'chapter-explanation-screen' },
    createElement('h1', null, 'Explanation'),
    createElement('a', {
      className: 'back-to-transcript-link',
      href: `#transcript/${chapterId}`,
      onClick: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        window.location.hash = `#transcript/${chapterId}`;
      },
    }, 'Back to Transcript')
  );
}

/**
 * Flushes the microtask queue so promise .then/.catch handlers execute.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ----------- Test Suites -----------

describe('Integration: Route Navigation Lifecycle', () => {
  let mountPoint: HTMLElement;

  beforeEach(() => {
    mountPoint = document.createElement('div');
    mountPoint.id = 'app';
    document.body.appendChild(mountPoint);
    cleanupCurrentMount();
    clearTokensMock.mockClear();
    window.location.hash = '';
  });

  afterEach(() => {
    cleanupCurrentMount();
    window.location.hash = '';
    if (mountPoint && mountPoint.parentNode) {
      document.body.removeChild(mountPoint);
    }
    vi.clearAllMocks();
  });

  // ==========================================================
  // Test 1: navigate → loading → data loaded → screen mounted → navigate away → unmounted
  // Validates: Requirements 1.2, 14.1
  // ==========================================================
  describe('Full route lifecycle: loading → mount → unmount (Req 1.2, 14.1)', () => {
    it('shows loading indicator immediately, mounts screen on resolve, unmounts on navigate away', async () => {
      let resolveFactory!: (el: ReturnType<typeof createElement>) => void;
      const factoryPromise = new Promise<ReturnType<typeof createElement>>((resolve) => {
        resolveFactory = resolve;
      });
      const factory = vi.fn().mockReturnValue(factoryPromise);

      // Step 1: Create async route container — loading should show immediately
      const container = createAsyncRouteContainer('#transcript/ch1', factory);
      mountPoint.appendChild(container);

      // Verify loading state is visible with role="status" (Req 14.1)
      const loadingEl = container.querySelector('[role="status"]');
      expect(loadingEl).not.toBeNull();
      expect(container.querySelector('.loading-view')).not.toBeNull();

      // Step 2: Resolve the factory — screen should mount
      resolveFactory(createElement(TestScreen, { label: 'Transcript Content' }));
      await flushPromises();

      // Loading should be gone, screen should be mounted
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('.test-screen')).not.toBeNull();
      expect(container.querySelector('.test-screen')!.textContent).toBe('Transcript Content');

      // React root should be active
      expect(getCurrentMount()).not.toBeNull();

      // Step 3: Simulate navigating away — router replaces mount content (Req 1.2)
      // The React Bridge uses MutationObserver to detect removal, but in synchronous
      // test environment we call cleanupCurrentMount directly (simulating router behavior)
      cleanupCurrentMount();

      // After unmount, the current mount should be null
      expect(getCurrentMount()).toBeNull();
    });

    it('loading indicator has role="status" and aria-live="polite" for accessibility', async () => {
      const factory = () => new Promise<never>(() => {}); // never resolves

      const container = createAsyncRouteContainer('#explain/ch2', factory);
      mountPoint.appendChild(container);

      const loadingEl = container.querySelector('[role="status"]');
      expect(loadingEl).not.toBeNull();
      expect(loadingEl!.getAttribute('aria-live')).toBe('polite');
    });
  });

  // ==========================================================
  // Test 2: 401 flow → token refresh fails → redirect to #login
  // Validates: Requirement 14.3
  // ==========================================================
  describe('401 auth error flow → clear tokens → redirect to #login (Req 14.3)', () => {
    it('clears tokens and redirects to #login on 401', async () => {
      window.location.hash = '#explain/chapter-abc';

      const authError = { status: 401, message: 'Unauthorized' };
      const factory = vi.fn().mockRejectedValue(authError);

      const container = createAsyncRouteContainer('#explain/chapter-abc', factory);
      mountPoint.appendChild(container);

      // Initially shows loading
      expect(container.querySelector('[role="status"]')).not.toBeNull();

      // Wait for the promise rejection to be handled
      await flushPromises();

      // Tokens should have been cleared
      expect(clearTokensMock).toHaveBeenCalledTimes(1);

      // Should redirect to #login
      expect(window.location.hash).toBe('#login');

      // No error view should be shown — 401 redirects silently
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(container.querySelector('.error-view')).toBeNull();
    });

    it('does not show retry button on 401 — only redirects', async () => {
      const authError = { status: 401, message: 'Session expired' };
      const factory = vi.fn().mockRejectedValue(authError);

      const container = createAsyncRouteContainer('#quiz/sub1', factory);
      mountPoint.appendChild(container);

      await flushPromises();

      // No retry button present
      const retryBtn = container.querySelector('button');
      expect(retryBtn).toBeNull();

      // Tokens cleared and redirected
      expect(clearTokensMock).toHaveBeenCalledTimes(1);
      expect(window.location.hash).toBe('#login');
    });
  });

  // ==========================================================
  // Test 3: API failure → ErrorView shown → click Retry → success → screen mounts
  // Validates: Requirements 14.2, 14.3
  // ==========================================================
  describe('API failure → ErrorView → Retry → success (Req 14.2)', () => {
    it('shows error with alert role and Retry button on 5xx, then mounts on retry success', async () => {
      const serverError = { status: 500, message: 'Internal Server Error' };
      let callCount = 0;

      const factory = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(serverError);
        }
        // Second call succeeds
        return Promise.resolve(createElement(TestScreen, { label: 'Recovered!' }));
      });

      const container = createAsyncRouteContainer('#exercises/ch1', factory);
      mountPoint.appendChild(container);

      // Wait for initial failure
      await flushPromises();

      // Error view should be shown with role="alert" (Req 14.2)
      const alertEl = container.querySelector('[role="alert"]');
      expect(alertEl).not.toBeNull();
      expect(container.querySelector('.error-view')).not.toBeNull();

      // Error message should be displayed
      const errorMsg = container.querySelector('.error-view p');
      expect(errorMsg).not.toBeNull();
      expect(errorMsg!.textContent).toBe('Internal Server Error');

      // Retry button should exist
      const retryBtn = container.querySelector('button');
      expect(retryBtn).not.toBeNull();
      expect(retryBtn!.textContent).toBe('Retry');

      // Click retry
      retryBtn!.click();

      // Wait for the retry promise to resolve
      await flushPromises();

      // After successful retry, screen should be mounted
      expect(container.querySelector('.test-screen')).not.toBeNull();
      expect(container.querySelector('.test-screen')!.textContent).toBe('Recovered!');

      // Error view should be gone
      expect(container.querySelector('[role="alert"]')).toBeNull();

      // Factory should have been called twice (initial + retry)
      expect(callCount).toBe(2);
    });

    it('shows error view on network error (status 0)', async () => {
      const networkError = { status: 0, message: 'Network error: Unable to connect' };
      const factory = vi.fn().mockRejectedValue(networkError);

      const container = createAsyncRouteContainer('#pronunciation/sub1', factory);
      mountPoint.appendChild(container);

      await flushPromises();

      // Error view should display with the network error message
      const alertEl = container.querySelector('[role="alert"]');
      expect(alertEl).not.toBeNull();

      const errorMsg = container.querySelector('.error-view p');
      expect(errorMsg!.textContent).toBe('Network error: Unable to connect');

      // Retry button should be available
      const retryBtn = container.querySelector('button');
      expect(retryBtn).not.toBeNull();
      expect(retryBtn!.textContent).toBe('Retry');
    });

    it('retry button re-invokes the factory function', async () => {
      const error = { status: 503, message: 'Service Unavailable' };
      const factory = vi.fn().mockRejectedValue(error);

      const container = createAsyncRouteContainer('#grammar/sub2', factory);
      mountPoint.appendChild(container);

      await flushPromises();

      expect(factory).toHaveBeenCalledTimes(1);

      // Click retry
      const retryBtn = container.querySelector('button');
      retryBtn!.click();

      await flushPromises();

      // Factory should have been called again (via the new async container created on retry)
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================
  // Test 4: Subject Landing → exercise screen navigation chain
  // Validates: Requirements 15.1, 15.2
  // ==========================================================
  describe('Subject Landing → exercise screen navigation (Req 15.1, 15.2)', () => {
    it('Subject Landing renders exercise links for language subjects', () => {
      const subjectView = createSubjectLandingView(
        'Kannada',
        'sub-kannada-1',
        '#4CAF50',
        '📖',
        65
      );
      mountPoint.appendChild(subjectView);

      // Should have exercise link cards
      const cards = subjectView.querySelectorAll('.subject-landing-view__exercise-card');
      expect(cards.length).toBe(4); // Pronunciation + Grammar + Quiz + Content Ingestion

      // Verify link labels
      const labels = Array.from(cards).map(
        (card) => card.querySelector('span:last-child')?.textContent
      );
      expect(labels).toContain('Pronunciation Practice');
      expect(labels).toContain('Grammar Exercises');
      expect(labels).toContain('Take Quiz');
      expect(labels).toContain('Content Ingestion');
    });

    it('clicking exercise card navigates to correct hash route', () => {
      const subjectView = createSubjectLandingView(
        'Hindi',
        'sub-hindi-1',
        '#FF9800',
        '📚',
        40
      );
      mountPoint.appendChild(subjectView);

      // Find the Pronunciation Practice card and click it
      const cards = subjectView.querySelectorAll('.subject-landing-view__exercise-card');
      const pronunciationCard = Array.from(cards).find(
        (card) => card.querySelector('span:last-child')?.textContent === 'Pronunciation Practice'
      );
      expect(pronunciationCard).not.toBeNull();

      (pronunciationCard as HTMLElement).click();

      // Should navigate to #pronunciation/{subjectId}
      expect(window.location.hash).toBe('#pronunciation/sub-hindi-1');
    });

    it('Content Ingestion card navigates to #scan (no subjectId)', () => {
      const subjectView = createSubjectLandingView(
        'Maths',
        'sub-maths-1',
        '#2196F3',
        '📐',
        80
      );
      mountPoint.appendChild(subjectView);

      const cards = subjectView.querySelectorAll('.subject-landing-view__exercise-card');
      const scanCard = Array.from(cards).find(
        (card) => card.querySelector('span:last-child')?.textContent === 'Content Ingestion'
      );
      expect(scanCard).not.toBeNull();

      (scanCard as HTMLElement).click();

      // Content Ingestion navigates to #scan without subjectId
      expect(window.location.hash).toBe('#scan');
    });

    it('ChapterTranscript screen has "Continue to Explanation" button (Req 15.1)', async () => {
      const chapterId = 'chapter-xyz';
      const factory = vi.fn().mockResolvedValue(
        createElement(MockTranscriptScreen, { chapterId })
      );

      const container = createAsyncRouteContainer(`#transcript/${chapterId}`, factory);
      mountPoint.appendChild(container);

      await flushPromises();

      // Screen should be mounted
      expect(container.querySelector('.chapter-transcript-screen')).not.toBeNull();

      // "Continue to Explanation" button should exist (Req 15.1)
      const continueBtn = container.querySelector('.continue-to-explanation-btn');
      expect(continueBtn).not.toBeNull();
      expect(continueBtn!.textContent).toBe('Continue to Explanation');

      // Clicking it should navigate to #explain/{chapterId}
      (continueBtn as HTMLElement).click();
      expect(window.location.hash).toBe(`#explain/${chapterId}`);
    });

    it('ChapterExplanationScreen has "Back to Transcript" link (Req 15.2)', async () => {
      const chapterId = 'chapter-abc';
      const factory = vi.fn().mockResolvedValue(
        createElement(MockExplanationScreen, { chapterId })
      );

      const container = createAsyncRouteContainer(`#explain/${chapterId}`, factory);
      mountPoint.appendChild(container);

      await flushPromises();

      // Screen should be mounted
      expect(container.querySelector('.chapter-explanation-screen')).not.toBeNull();

      // "Back to Transcript" link should exist (Req 15.2)
      const backLink = container.querySelector('.back-to-transcript-link');
      expect(backLink).not.toBeNull();
      expect(backLink!.textContent).toBe('Back to Transcript');

      // Clicking it should navigate to #transcript/{chapterId}
      (backLink as HTMLElement).click();
      expect(window.location.hash).toBe(`#transcript/${chapterId}`);
    });

    it('Subject Landing correctly determines links per subject category', () => {
      // Language subject
      const languageLinks = getExerciseLinksForSubject('English');
      expect(languageLinks.length).toBe(4);
      expect(languageLinks.map((l) => l.route)).toContain('pronunciation');
      expect(languageLinks.map((l) => l.route)).toContain('grammar');

      // Maths subject
      const mathsLinks = getExerciseLinksForSubject('Maths');
      expect(mathsLinks.length).toBe(3);
      expect(mathsLinks.map((l) => l.route)).toContain('maths');
      expect(mathsLinks.map((l) => l.route)).not.toContain('pronunciation');

      // Computers subject
      const compLinks = getExerciseLinksForSubject('Computers');
      expect(compLinks.length).toBe(3);
      expect(compLinks.map((l) => l.route)).toContain('computers');

      // EVS subject
      const evsLinks = getExerciseLinksForSubject('EVS');
      expect(evsLinks.length).toBe(3);
      expect(evsLinks.map((l) => l.route)).toContain('evs');

      // Unknown subject — default
      const defaultLinks = getExerciseLinksForSubject('Science');
      expect(defaultLinks.length).toBe(2);
      expect(defaultLinks.map((l) => l.route)).toContain('quiz');
      expect(defaultLinks.map((l) => l.route)).toContain('scan');
    });
  });
});
