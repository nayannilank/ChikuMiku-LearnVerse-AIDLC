/**
 * Property Tests: Custom Subject Color Non-Conflict
 *
 * Property 6: Custom Subject Color Non-Conflict
 *
 * For any custom subject created by a parent, the assigned color SHALL NOT equal
 * any of the 7 default subject colors (purple #9B59B6, sky blue #5DADE2, gold #F7C948,
 * pink #E94F9B, indigo #4A6CF7, green #27AE60, teal #4ECDC4) nor any other custom
 * subject color already assigned to that parent's students.
 *
 * **Validates: Requirements 3.4**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  subjectColors,
  CUSTOM_SUBJECT_PALETTE,
  assignCustomSubjectColor,
} from './tokens';

// --- Constants ---

/** The 7 default subject colors (upper-cased for case-insensitive comparison) */
const DEFAULT_COLORS = Object.values(subjectColors).map((c) => c.toUpperCase());

describe('Property 6: Custom Subject Color Non-Conflict', () => {
  it('for any random subset of CUSTOM_SUBJECT_PALETTE used as "already assigned" colors, assignCustomSubjectColor returns a color NOT in that subset', () => {
    fc.assert(
      fc.property(
        fc.subarray(CUSTOM_SUBJECT_PALETTE, { minLength: 0, maxLength: CUSTOM_SUBJECT_PALETTE.length - 1 }),
        (usedColors) => {
          const assigned = assignCustomSubjectColor(usedColors);
          expect(usedColors.map((c) => c.toUpperCase())).not.toContain(assigned.toUpperCase());
        }
      ),
      { numRuns: 200 }
    );
  });

  it('the returned color should never be one of the 7 default subject colors', () => {
    fc.assert(
      fc.property(
        fc.subarray(CUSTOM_SUBJECT_PALETTE, { minLength: 0, maxLength: CUSTOM_SUBJECT_PALETTE.length - 1 }),
        (usedColors) => {
          const assigned = assignCustomSubjectColor(usedColors);
          expect(DEFAULT_COLORS).not.toContain(assigned.toUpperCase());
        }
      ),
      { numRuns: 200 }
    );
  });

  it('when called repeatedly with accumulating used colors, all returned colors should be unique until palette exhaustion', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: CUSTOM_SUBJECT_PALETTE.length }),
        (numAssignments) => {
          const assigned: string[] = [];
          for (let i = 0; i < numAssignments; i++) {
            const color = assignCustomSubjectColor(assigned);
            // Each newly assigned color must not already be in the assigned list
            expect(assigned.map((c) => c.toUpperCase())).not.toContain(color.toUpperCase());
            assigned.push(color);
          }
          // All assigned colors must be unique
          const uniqueUpper = new Set(assigned.map((c) => c.toUpperCase()));
          expect(uniqueUpper.size).toBe(assigned.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all colors in CUSTOM_SUBJECT_PALETTE are distinct from each other and from all default subject colors', () => {
    // This is a static property — verified once but expressed as a property test
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: CUSTOM_SUBJECT_PALETTE.length - 1 }),
        (index) => {
          const color = CUSTOM_SUBJECT_PALETTE[index].toUpperCase();

          // Must not be a default subject color
          expect(DEFAULT_COLORS).not.toContain(color);

          // Must be unique within the palette (no duplicates at other indices)
          const otherColors = CUSTOM_SUBJECT_PALETTE
            .filter((_, i) => i !== index)
            .map((c) => c.toUpperCase());
          expect(otherColors).not.toContain(color);
        }
      ),
      { numRuns: 100 }
    );
  });
});
