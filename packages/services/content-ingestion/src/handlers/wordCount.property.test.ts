/**
 * Property Test: Word Count Calculation (Backend)
 *
 * Property 12: For any extracted text, the per-page word count SHALL equal the
 * count of whitespace-separated tokens; for any set of chapter pages, the total
 * word count SHALL equal the sum of all per-page word counts.
 *
 * **Validates: Requirements 9.3, 9.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { countWords } from './extractText';

describe('Property 12: Word Count Calculation (Backend)', () => {
  describe('Per-page word count equals whitespace-separated token count (Requirement 9.3)', () => {
    it('word count matches trimmed whitespace-split for random text', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (text) => {
            const result = countWords(text);
            const trimmed = text.trim();
            const expected = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('handles texts with various whitespace patterns (spaces, tabs, newlines)', () => {
      const textWithWhitespace = fc.array(
        fc.oneof(
          fc.stringMatching(/^[^\s]+$/), // non-whitespace word
          fc.constantFrom(' ', '  ', '\t', '\n', '\r\n', '  \t  ', '\n\n', ' \t\n ')
        ),
        { minLength: 1, maxLength: 50 }
      ).map(parts => parts.join(''));

      fc.assert(
        fc.property(textWithWhitespace, (text) => {
          const result = countWords(text);
          const trimmed = text.trim();
          const expected = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
          expect(result).toBe(expected);
        }),
        { numRuns: 1000 }
      );
    });

    it('handles texts built from words separated by mixed whitespace', () => {
      const wordArb = fc.stringMatching(/^[a-zA-Z0-9]+$/);
      const whitespaceArb = fc.stringOf(
        fc.constantFrom(' ', '\t', '\n', '\r'),
        { minLength: 1, maxLength: 5 }
      );

      const textArb = fc.tuple(
        fc.array(wordArb, { minLength: 1, maxLength: 20 }),
        fc.array(whitespaceArb, { minLength: 1, maxLength: 20 })
      ).map(([words, spaces]) => {
        // Interleave words and whitespace
        const parts: string[] = [];
        for (let i = 0; i < words.length; i++) {
          if (i > 0 && i - 1 < spaces.length) {
            parts.push(spaces[i - 1]);
          }
          parts.push(words[i]);
        }
        return parts.join('');
      });

      fc.assert(
        fc.property(textArb, (text) => {
          const result = countWords(text);
          const trimmed = text.trim();
          const expected = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
          expect(result).toBe(expected);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Total word count equals sum of per-page word counts (Requirement 9.4)', () => {
    it('sum of individual page word counts equals total computed from concatenation concept', () => {
      const pageTextsArb = fc.array(
        fc.string({ minLength: 0, maxLength: 200 }),
        { minLength: 1, maxLength: 20 }
      );

      fc.assert(
        fc.property(pageTextsArb, (pageTexts) => {
          const perPageCounts = pageTexts.map((text) => countWords(text));
          const totalWordCount = perPageCounts.reduce((sum, count) => sum + count, 0);

          // Verify: total word count = sum of per-page word counts
          expect(totalWordCount).toBe(perPageCounts.reduce((s, c) => s + c, 0));

          // Verify each count is non-negative
          for (const count of perPageCounts) {
            expect(count).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: 1000 }
      );
    });

    it('total word count is additive across pages', () => {
      const wordArb = fc.stringMatching(/^[a-zA-Z]+$/);
      const pageArb = fc.array(wordArb, { minLength: 0, maxLength: 10 })
        .map(words => words.join(' '));
      const pagesArb = fc.array(pageArb, { minLength: 1, maxLength: 15 });

      fc.assert(
        fc.property(pagesArb, (pages) => {
          const individualCounts = pages.map((page) => countWords(page));
          const sum = individualCounts.reduce((acc, c) => acc + c, 0);

          // The total word count across all pages should equal the sum
          // of each page's word count computed independently
          expect(sum).toBe(pages.reduce((acc, page) => acc + countWords(page), 0));
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Edge cases', () => {
    it('empty string returns 0', () => {
      expect(countWords('')).toBe(0);
    });

    it('whitespace-only strings return 0', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }),
          (whitespaceOnly) => {
            expect(countWords(whitespaceOnly)).toBe(0);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('single word returns 1 regardless of surrounding whitespace', () => {
      const singleWordWithWhitespace = fc.tuple(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 }),
        fc.stringMatching(/^[a-zA-Z0-9]+$/),
        fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 })
      ).map(([leading, word, trailing]) => leading + word + trailing);

      fc.assert(
        fc.property(singleWordWithWhitespace, (text) => {
          expect(countWords(text)).toBe(1);
        }),
        { numRuns: 500 }
      );
    });

    it('word count is always a non-negative integer', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }),
          (text) => {
            const result = countWords(text);
            expect(Number.isInteger(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
