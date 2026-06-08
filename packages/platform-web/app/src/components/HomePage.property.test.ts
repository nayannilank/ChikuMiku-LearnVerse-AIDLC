/**
 * @vitest-environment jsdom
 */
/**
 * Property Tests: Web Home Page
 *
 * Feature: web-home-page, Property 1: Error message extraction preserves API response content
 *
 * For any API error response object containing `message` or `error` field with
 * a non-empty string, the login error handler extracts and displays that exact
 * string value (after HTML escaping).
 *
 * **Validates: Requirements 5.2**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { loginUser } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';

// --- Arbitraries ---

/** Generates a non-empty string for error message content */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Generates an API error response object with either a `message` field,
 * an `error` field, or both. The extraction logic prefers `message` over `error`.
 */
const errorResponseWithMessageArb = nonEmptyStringArb.map((msg) => ({
  body: { message: msg },
  expected: msg,
}));

const errorResponseWithErrorArb = nonEmptyStringArb.map((err) => ({
  body: { error: err },
  expected: err,
}));

const errorResponseWithBothArb = fc
  .tuple(nonEmptyStringArb, nonEmptyStringArb)
  .map(([msg, err]) => ({
    body: { message: msg, error: err },
    expected: msg, // `message` is preferred over `error`
  }));

const errorResponseArb = fc.oneof(
  errorResponseWithMessageArb,
  errorResponseWithErrorArb,
  errorResponseWithBothArb
);

describe('Feature: web-home-page, Property 1: Error message extraction preserves API response content', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('for ANY non-ok API response with message or error field, loginUser extracts the exact string value', async () => {
    await fc.assert(
      fc.asyncProperty(errorResponseArb, async ({ body, expected }) => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: async () => body,
        });
        vi.stubGlobal('fetch', mockFetch);

        const result = await loginUser('anyuser', 'anypass');

        expect(result.success).toBe(false);
        expect(result.error).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('message field takes priority over error field when both are present', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyStringArb,
        nonEmptyStringArb,
        async (messageValue, errorValue) => {
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ message: messageValue, error: errorValue }),
          });
          vi.stubGlobal('fetch', mockFetch);

          const result = await loginUser('user', 'pass');

          expect(result.success).toBe(false);
          expect(result.error).toBe(messageValue);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('Feature: web-home-page, Property 2: HTML escaping round-trip preserves text content', () => {
  /**
   * **Validates: Requirements 5.2, 5.4**
   *
   * For any arbitrary string (including special characters, HTML tags, unicode),
   * escapeHtml(input) inserted as innerHTML and read back as textContent equals
   * the original input.
   */
  it('escapeHtml round-trip preserves text content for arbitrary strings', () => {
    fc.assert(
      fc.property(
        // Exclude null characters as DOM parsing strips them (not valid in HTML text content)
        fc.string().filter((s) => !s.includes('\u0000')),
        (input) => {
          // Escape the input
          const escaped = escapeHtml(input);

          // Insert escaped value as innerHTML and read back as textContent
          const el = document.createElement('div');
          el.innerHTML = escaped;

          // The textContent should equal the original input
          expect(el.textContent).toBe(input);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('escapeHtml round-trip preserves text content for HTML-like and unicode strings', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Exclude null characters as they are stripped by DOM parsing (not valid in HTML text)
          fc.string().filter((s) => !s.includes('\u0000')),
          fc.constantFrom(
            '<script>alert("xss")</script>',
            '<img src=x onerror=alert(1)>',
            '&amp;&lt;&gt;&quot;',
            '<div class="test">content</div>',
            '"><svg onload=alert(1)>',
            "' OR 1=1 --",
            '\u001F\uFFFF',
            '🎉🔥💻',
            ''
          ),
          fc.unicodeString().filter((s) => !s.includes('\u0000'))
        ),
        (input) => {
          const escaped = escapeHtml(input);
          const el = document.createElement('div');
          el.innerHTML = escaped;
          expect(el.textContent).toBe(input);
        }
      ),
      { numRuns: 100 }
    );
  });
});
