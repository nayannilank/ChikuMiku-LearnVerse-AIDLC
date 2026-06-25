/**
 * Property Test: Streak Calculation
 *
 * Property 7: For any sequence of student activity days, the streak counter SHALL equal
 * the length of the most recent consecutive daily run ending at the current day; if the
 * student has not completed any exercise for two consecutive calendar days, the streak
 * SHALL reset to zero on the second missed day; the streak SHALL always be a non-negative integer.
 *
 * **Validates: Requirements 5.1, 5.2, 5.4, 6.2, 19.3, 19.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeStreakUpdate, daysBetween, StreakRecord } from './updateStreak';

// ============================================================
// Helpers
// ============================================================

/**
 * Formats a Date as YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds N days to a date, returning a new Date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Generates a valid YYYY-MM-DD date string arbitrary.
 */
const dateStringArb = fc
  .date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T00:00:00Z'),
  })
  .map((d) => formatDate(d));

/**
 * Generates a StreakRecord with a given lastActivityDate and currentStreak.
 */
function makeStreakRecord(
  lastActivityDate: string,
  currentStreak: number,
): StreakRecord {
  return {
    studentId: 'student-123',
    currentStreak,
    lastActivityDate,
    streakResetDate: null,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 7: Streak Calculation', () => {
  describe('daysBetween', () => {
    it('always returns a non-negative number', () => {
      fc.assert(
        fc.property(dateStringArb, dateStringArb, (dateA, dateB) => {
          const result = daysBetween(dateA, dateB);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });

    it('is symmetric: daysBetween(a, b) === daysBetween(b, a)', () => {
      fc.assert(
        fc.property(dateStringArb, dateStringArb, (dateA, dateB) => {
          expect(daysBetween(dateA, dateB)).toBe(daysBetween(dateB, dateA));
        }),
        { numRuns: 200 },
      );
    });

    it('returns 0 for the same date', () => {
      fc.assert(
        fc.property(dateStringArb, (date) => {
          expect(daysBetween(date, date)).toBe(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('computeStreakUpdate — single step properties', () => {
    it('streak is always a non-negative integer', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(null as StreakRecord | null), dateStringArb.chain((lastDate) =>
            fc.nat({ max: 365 }).map((streak) => makeStreakRecord(lastDate, streak)),
          )),
          dateStringArb,
          (existing, today) => {
            const result = computeStreakUpdate(existing, today);
            expect(result.currentStreak).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(result.currentStreak)).toBe(true);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('first-ever activity gives streak = 1', () => {
      fc.assert(
        fc.property(dateStringArb, (today) => {
          const result = computeStreakUpdate(null, today);
          expect(result.currentStreak).toBe(1);
          expect(result.wasIncremented).toBe(true);
          expect(result.wasReset).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('same day (gap === 0): streak unchanged, wasIncremented=false', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          fc.nat({ max: 365 }).filter((n) => n >= 0),
          (date, streak) => {
            const existing = makeStreakRecord(date, streak);
            const result = computeStreakUpdate(existing, date);
            expect(result.currentStreak).toBe(streak);
            expect(result.wasIncremented).toBe(false);
            expect(result.wasReset).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('consecutive day (gap === 1): streak incremented by 1', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          fc.nat({ max: 365 }).filter((n) => n >= 1),
          (lastDate, streak) => {
            const lastDateObj = new Date(lastDate + 'T00:00:00Z');
            const today = formatDate(addDays(lastDateObj, 1));
            const existing = makeStreakRecord(lastDate, streak);
            const result = computeStreakUpdate(existing, today);
            expect(result.currentStreak).toBe(streak + 1);
            expect(result.wasIncremented).toBe(true);
            expect(result.wasReset).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('gap >= 2 (missed days): streak resets to 1, wasReset=true', () => {
      fc.assert(
        fc.property(
          dateStringArb,
          fc.integer({ min: 2, max: 100 }),
          fc.nat({ max: 365 }),
          (lastDate, gap, streak) => {
            const lastDateObj = new Date(lastDate + 'T00:00:00Z');
            const today = formatDate(addDays(lastDateObj, gap));
            const existing = makeStreakRecord(lastDate, streak);
            const result = computeStreakUpdate(existing, today);
            expect(result.currentStreak).toBe(1);
            expect(result.wasIncremented).toBe(true);
            expect(result.wasReset).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('computeStreakUpdate — sequence simulation', () => {
    it('streak equals length of most recent consecutive daily run', () => {
      // Generate a sequence of unique activity day offsets (sorted ascending)
      const activitySequenceArb = fc
        .uniqueArray(fc.integer({ min: 0, max: 60 }), { minLength: 1, maxLength: 30 })
        .map((offsets) => [...offsets].sort((a, b) => a - b));

      fc.assert(
        fc.property(activitySequenceArb, (offsets) => {
          const baseDate = new Date('2024-01-01T00:00:00Z');

          // Simulate streak by replaying all activity days through computeStreakUpdate
          let existing: StreakRecord | null = null;

          for (const offset of offsets) {
            const today = formatDate(addDays(baseDate, offset));
            const result = computeStreakUpdate(existing, today);
            existing = makeStreakRecord(today, result.currentStreak);
          }

          // Now calculate the expected streak: length of the most recent
          // consecutive daily run ending at the last activity day
          let expectedStreak = 1;
          for (let i = offsets.length - 2; i >= 0; i--) {
            if (offsets[i] === offsets[i + 1] - 1) {
              expectedStreak++;
            } else {
              break;
            }
          }

          expect(existing!.currentStreak).toBe(expectedStreak);
        }),
        { numRuns: 500 },
      );
    });

    it('streak resets after two or more missed consecutive days in a sequence', () => {
      // Generate sequences that explicitly include a gap of 2+ days
      const sequenceWithGapArb = fc
        .tuple(
          fc.integer({ min: 1, max: 10 }), // consecutive days before gap
          fc.integer({ min: 2, max: 10 }), // gap size (2+ means reset)
          fc.integer({ min: 1, max: 10 }), // consecutive days after gap
        );

      fc.assert(
        fc.property(sequenceWithGapArb, ([before, gap, after]) => {
          const baseDate = new Date('2024-01-01T00:00:00Z');

          // Build offsets: consecutive run, then a gap, then another consecutive run
          const offsets: number[] = [];
          for (let i = 0; i < before; i++) {
            offsets.push(i);
          }
          // Resume after the gap (last day before gap is `before - 1`,
          // so first day after gap is `before - 1 + gap`)
          const resumeDay = before - 1 + gap;
          for (let i = 0; i < after; i++) {
            offsets.push(resumeDay + i);
          }

          // Replay through computeStreakUpdate
          let existing: StreakRecord | null = null;
          for (const offset of offsets) {
            const today = formatDate(addDays(baseDate, offset));
            const result = computeStreakUpdate(existing, today);
            existing = makeStreakRecord(today, result.currentStreak);
          }

          // The final streak should equal the length of the consecutive run after the gap
          expect(existing!.currentStreak).toBe(after);
        }),
        { numRuns: 300 },
      );
    });
  });
});
