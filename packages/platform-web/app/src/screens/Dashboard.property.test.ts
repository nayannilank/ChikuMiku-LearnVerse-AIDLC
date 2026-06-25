/**
 * Property Test: Dashboard Name Truncation and Date Formatting
 *
 * Property 9: For any student name (1-100 chars), truncateName returns at most 30 characters.
 * For any valid Date, formatDate returns a string in "Day, DD Month" format.
 *
 * **Validates: Requirements 6.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { truncateName, formatDate } from './Dashboard';

const VALID_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
];

const VALID_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

describe('Property 9: Dashboard Name Truncation and Date Formatting', () => {
  describe('truncateName', () => {
    it('output is at most 30 characters for any name (1-100 chars)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (name) => {
            const result = truncateName(name);
            expect(result.length).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('names with 30 or fewer characters are returned unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          (name) => {
            const result = truncateName(name);
            expect(result).toBe(name);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('names longer than 30 characters produce output of exactly 30 characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 31, maxLength: 100 }),
          (name) => {
            const result = truncateName(name);
            expect(result.length).toBe(30);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('formatDate', () => {
    it('returns a string matching "DayName, D MonthName" pattern for any valid date', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          (date) => {
            const result = formatDate(date);
            // Pattern: DayName, DayNumber MonthName
            const pattern = /^[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+$/;
            expect(result).toMatch(pattern);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('formatted date contains exactly one comma', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          (date) => {
            const result = formatDate(date);
            const commaCount = (result.match(/,/g) || []).length;
            expect(commaCount).toBe(1);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('day number is between 1 and 31', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          (date) => {
            const result = formatDate(date);
            // Extract day number from "DayName, DD MonthName"
            const dayNumber = parseInt(result.split(', ')[1].split(' ')[0], 10);
            expect(dayNumber).toBeGreaterThanOrEqual(1);
            expect(dayNumber).toBeLessThanOrEqual(31);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('month name is one of the 12 English month names', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          (date) => {
            const result = formatDate(date);
            // Extract month name from "DayName, DD MonthName"
            const parts = result.split(', ')[1].split(' ');
            const monthName = parts.slice(1).join(' ');
            expect(VALID_MONTH_NAMES).toContain(monthName);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('day name is one of the 7 English day names', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('1970-01-01'), max: new Date('2099-12-31') }),
          (date) => {
            const result = formatDate(date);
            // Extract day name from "DayName, DD MonthName"
            const dayName = result.split(',')[0];
            expect(VALID_DAY_NAMES).toContain(dayName);
          }
        ),
        { numRuns: 500 }
      );
    });
  });
});
