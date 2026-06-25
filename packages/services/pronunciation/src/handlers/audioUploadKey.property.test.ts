/**
 * Property Test: Audio Upload Key Uniqueness
 *
 * Property 26: Audio Upload Key Uniqueness
 * - Generate random student/subject/timestamp combinations
 * - Verify all generated S3 keys are unique (no collisions)
 *
 * **Validates: Requirements 20.1**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildRecordingS3Key } from './uploadRecording';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** UUID-style student and subject IDs */
const uuidArb = fc.uuid();

/** Timestamp as a positive integer (milliseconds since epoch) */
const timestampArb = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });

/** A triple of (studentId, subjectId, timestamp) */
const tripleArb = fc.tuple(uuidArb, uuidArb, timestampArb);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 26: Audio Upload Key Uniqueness', () => {
  it('for any set of distinct (studentId, subjectId, timestamp) triples, all generated S3 keys are unique', () => {
    fc.assert(
      fc.property(
        fc.array(tripleArb, { minLength: 2, maxLength: 50 }),
        (triples) => {
          // Deduplicate triples to ensure we only test distinct inputs
          const uniqueTriples = [
            ...new Map(
              triples.map(([s, sub, ts]) => [`${s}|${sub}|${ts}`, [s, sub, ts] as const]),
            ).values(),
          ];

          // Need at least 2 distinct triples to test uniqueness
          if (uniqueTriples.length < 2) return;

          const keys = uniqueTriples.map(([studentId, subjectId, timestamp]) =>
            buildRecordingS3Key(studentId, subjectId, timestamp),
          );

          const keySet = new Set(keys);
          expect(keySet.size).toBe(keys.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('two different inputs produce two different keys (injectivity)', () => {
    fc.assert(
      fc.property(
        tripleArb,
        tripleArb,
        ([studentA, subjectA, tsA], [studentB, subjectB, tsB]) => {
          // Only test when the triples themselves are different
          if (studentA === studentB && subjectA === subjectB && tsA === tsB) return;

          const keyA = buildRecordingS3Key(studentA, subjectA, tsA);
          const keyB = buildRecordingS3Key(studentB, subjectB, tsB);

          expect(keyA).not.toBe(keyB);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('if any component differs (different studentId OR subjectId OR timestamp), the key is different', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        timestampArb,
        fc.constantFrom('studentId', 'subjectId', 'timestamp') as fc.Arbitrary<
          'studentId' | 'subjectId' | 'timestamp'
        >,
        uuidArb,
        timestampArb,
        (studentId, subjectId, timestamp, componentToChange, altUuid, altTs) => {
          let altStudentId = studentId;
          let altSubjectId = subjectId;
          let altTimestamp = timestamp;

          switch (componentToChange) {
            case 'studentId':
              altStudentId = altUuid;
              break;
            case 'subjectId':
              altSubjectId = altUuid;
              break;
            case 'timestamp':
              altTimestamp = altTs === timestamp ? timestamp + 1 : altTs;
              break;
          }

          // Only test when the altered component is actually different
          if (
            altStudentId === studentId &&
            altSubjectId === subjectId &&
            altTimestamp === timestamp
          ) {
            return;
          }

          const keyOriginal = buildRecordingS3Key(studentId, subjectId, timestamp);
          const keyAltered = buildRecordingS3Key(altStudentId, altSubjectId, altTimestamp);

          expect(keyOriginal).not.toBe(keyAltered);
        },
      ),
      { numRuns: 200 },
    );
  });
});
