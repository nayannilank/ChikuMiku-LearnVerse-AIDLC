/**
 * Property Test: Transcript Round-Trip
 *
 * **Property 13: Transcript Round-Trip**
 *
 * For any chapter transcript (original or edited), saving and then
 * retrieving the transcript SHALL produce content identical to what was saved.
 *
 * We verify that the text passed to `dbClient.updatePageText` matches exactly
 * what was sent in the request body for each page, and that `countWords(text)`
 * is correctly calculated and passed alongside.
 *
 * **Validates: Requirements 9.5, 9.6**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  createSaveTranscriptHandler,
  type TranscriptDbClient,
} from './saveTranscript';
import { countWords } from './extractText';
import type { APIGatewayProxyEvent } from '@learnverse/service-core';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** ASCII text */
const asciiTextArb = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ,.!?;:\'"()[]{}/-+*=&@#$%^~`|<>\n\t'.split(''),
  ),
  { minLength: 1, maxLength: 500 },
);

/** Kannada script text */
const kannadaTextArb = fc.stringOf(
  fc.constantFrom(
    ...'ಅಆಇಈಉಊಋಎಏಐಒಓಔಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ '.split(''),
  ),
  { minLength: 1, maxLength: 200 },
);

/** Hindi / Devanagari text */
const hindiTextArb = fc.stringOf(
  fc.constantFrom(
    ...'अआइईउऊएऐओऔकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह ँंःािीुूेैोौ्'.split(''),
  ),
  { minLength: 1, maxLength: 200 },
);

/** Mathematical symbols */
const mathTextArb = fc.stringOf(
  fc.constantFrom(
    ...'∑∏∫∂√∞≠≤≥±×÷∈∉⊆⊇∩∪∧∨¬∀∃ℝℤℕℂπθαβγδεζηλμσφψω 0123456789+-=()[]'.split(''),
  ),
  { minLength: 1, maxLength: 200 },
);

/** Emoji text */
const emojiTextArb = fc.stringOf(
  fc.constantFrom(
    ...'😀😁😂🤣😃😄😅😆😉😊😋😎🤗🤩🥳🎉🎊🔥💯✨🌟⭐🌈🦄🐱🐶🌸 '.split(''),
  ),
  { minLength: 1, maxLength: 100 },
);

/** Mixed script text: combines all script types */
const mixedUnicodeTextArb = fc.oneof(
  asciiTextArb,
  kannadaTextArb,
  hindiTextArb,
  mathTextArb,
  emojiTextArb,
  // Mixed: concatenation of different scripts
  fc.tuple(asciiTextArb, kannadaTextArb, hindiTextArb).map(
    ([a, k, h]) => `${a} ${k} ${h}`,
  ),
  fc.tuple(mathTextArb, emojiTextArb, asciiTextArb).map(
    ([m, e, a]) => `${m} ${e} ${a}`,
  ),
  // Full unicode arbitrary from fast-check for extra coverage
  fc.fullUnicodeString({ minLength: 1, maxLength: 300 }),
);

/** Valid UUID */
const uuidArb = fc.uuid();

/** Valid page number (1-based positive integer) */
const pageNumberArb = fc.integer({ min: 1, max: 50 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvent(
  chapterId: string,
  body: unknown,
): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    pathParameters: { id: chapterId },
    queryStringParameters: null,
    requestContext: {},
    httpMethod: 'PUT',
    path: `/chapters/${chapterId}/transcript`,
    resource: '/chapters/{id}/transcript',
  };
}

function createMockDbClient(): TranscriptDbClient & {
  updatePageTextCalls: Array<{ pageId: string; text: string; wordCount: number }>;
} {
  const calls: Array<{ pageId: string; text: string; wordCount: number }> = [];
  return {
    updatePageTextCalls: calls,
    chapterExists: vi.fn().mockResolvedValue(true),
    updatePageText: vi.fn(async (pageId: string, text: string, wordCount: number) => {
      calls.push({ pageId, text, wordCount });
    }),
    updateChapterContent: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 13: Transcript Round-Trip', () => {
  it('for any unicode text content, the text passed to updatePageText matches exactly what was sent in the request body', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        pageNumberArb,
        mixedUnicodeTextArb,
        async (chapterId, pageId, pageNumber, text) => {
          const dbClient = createMockDbClient();
          const handler = createSaveTranscriptHandler(dbClient);

          const requestBody = {
            pages: [{ pageId, pageNumber, text }],
          };

          const event = makeEvent(chapterId, requestBody);
          const result = await handler(event);

          expect(result.statusCode).toBe(200);
          const responseBody = JSON.parse(result.body);
          expect(responseBody.success).toBe(true);

          // Round-trip property: text passed to DB must be identical to request text
          expect(dbClient.updatePageTextCalls.length).toBe(1);
          expect(dbClient.updatePageTextCalls[0].pageId).toBe(pageId);
          expect(dbClient.updatePageTextCalls[0].text).toBe(text);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('for any unicode text, countWords(text) is correctly calculated and passed to updatePageText', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        pageNumberArb,
        mixedUnicodeTextArb,
        async (chapterId, pageId, pageNumber, text) => {
          const dbClient = createMockDbClient();
          const handler = createSaveTranscriptHandler(dbClient);

          const requestBody = {
            pages: [{ pageId, pageNumber, text }],
          };

          const event = makeEvent(chapterId, requestBody);
          const result = await handler(event);

          expect(result.statusCode).toBe(200);

          // Verify word count passed to DB matches countWords(text)
          const expectedWordCount = countWords(text);
          expect(dbClient.updatePageTextCalls[0].wordCount).toBe(expectedWordCount);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('for multiple pages with various unicode content, each page text is preserved exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.array(
          fc.tuple(uuidArb, pageNumberArb, mixedUnicodeTextArb),
          { minLength: 1, maxLength: 10 },
        ),
        async (chapterId, pages) => {
          // Deduplicate page numbers to avoid validation issues
          const uniquePages = pages.reduce<
            Array<{ pageId: string; pageNumber: number; text: string }>
          >((acc, [pageId, pageNumber, text], idx) => {
            acc.push({ pageId, pageNumber: idx + 1, text });
            return acc;
          }, []);

          const dbClient = createMockDbClient();
          const handler = createSaveTranscriptHandler(dbClient);

          const requestBody = { pages: uniquePages };
          const event = makeEvent(chapterId, requestBody);
          const result = await handler(event);

          expect(result.statusCode).toBe(200);

          // Verify all pages were persisted
          expect(dbClient.updatePageTextCalls.length).toBe(uniquePages.length);

          // Verify each page's text is preserved exactly (round-trip)
          for (let i = 0; i < uniquePages.length; i++) {
            const call = dbClient.updatePageTextCalls[i];
            const page = uniquePages[i];

            // Text round-trip: request text === text passed to DB persist
            expect(call.pageId).toBe(page.pageId);
            expect(call.text).toBe(page.text);
            expect(call.wordCount).toBe(countWords(page.text));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
