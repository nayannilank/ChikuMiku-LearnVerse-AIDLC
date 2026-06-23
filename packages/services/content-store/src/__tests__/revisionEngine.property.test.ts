/**
 * Property Tests: Revision Engine — Session lifecycle, scoring, and summaries
 *
 * Feature: backend-stub-implementations
 * - Property 27: Revision session question count bounds
 * - Property 28: Revision question category distribution
 * - Property 29: Answer submission produces score
 * - Property 30: Answer to non-existent session returns null
 * - Property 31: Completed session rejects new answers
 * - Property 32: Session summary computation
 *
 * **Validates: Requirements 13.1, 13.2, 13.4, 14.1, 14.2, 14.3, 14.4, 15.1, 15.3**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  startRevisionSession,
  submitAnswer,
  getSessionSummary,
  clearRevisionStore,
  setContentStore,
} from '../revisionEngine';
import type { SessionCompletedError } from '../revisionEngine';
import { ContentStore } from '../contentStore';

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Generate a UUID-like string */
const uuidArb = fc.uuid();

/** Generate rich text content with multiple concepts for question generation */
const richTextArb = fc.array(
  fc.lorem({ maxCount: 5, mode: 'sentences' }),
  { minLength: 5, maxLength: 15 },
).map((sentences) => sentences.join(' '));

/** Generate non-empty answer text */
const answerTextArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let contentStore: ContentStore;

function setupChapter(
  chapterId: string,
  learnerId: string,
  extractedText: string,
): void {
  contentStore.saveChapter({
    id: chapterId,
    learnerId,
    subjectId: 'subject-1',
    textbookName: 'Test Textbook',
    chapterNumber: 1,
    pages: [],
    extractedText,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Feature: backend-stub-implementations, Property 27: Revision session question count bounds
describe('Property 27: Revision session question count bounds', () => {
  beforeEach(() => {
    clearRevisionStore();
    contentStore = new ContentStore();
    setContentStore(contentStore);
  });

  it('for any chapter with sufficient content, starting a revision session produces between 5 and 20 questions inclusive', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        richTextArb,
        (chapterId, learnerId, text) => {
          setupChapter(chapterId, learnerId, text);

          const session = startRevisionSession(learnerId, chapterId);

          // If session is created (sufficient content), question count must be 5-20
          if (session !== null) {
            expect(session.questions.length).toBeGreaterThanOrEqual(5);
            expect(session.questions.length).toBeLessThanOrEqual(20);
          }
          // If null, it means insufficient content — that's acceptable
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 28: Revision question category distribution
describe('Property 28: Revision question category distribution', () => {
  beforeEach(() => {
    clearRevisionStore();
    contentStore = new ContentStore();
    setContentStore(contentStore);
  });

  it('for any revision session, the generated questions include at least one from each category: recall, understanding, application', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        richTextArb,
        (chapterId, learnerId, text) => {
          setupChapter(chapterId, learnerId, text);

          const session = startRevisionSession(learnerId, chapterId);

          if (session !== null) {
            const categories = session.questions.map((q) => q.category);
            expect(categories).toContain('recall');
            expect(categories).toContain('understanding');
            expect(categories).toContain('application');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 29: Answer submission produces score
describe('Property 29: Answer submission produces score', () => {
  beforeEach(() => {
    clearRevisionStore();
    contentStore = new ContentStore();
    setContentStore(contentStore);
  });

  it('for any active revision session and any answer text, submitting an answer returns a score (0-100) and non-empty feedback', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        richTextArb,
        answerTextArb,
        (chapterId, learnerId, text, answerText) => {
          setupChapter(chapterId, learnerId, text);

          const session = startRevisionSession(learnerId, chapterId);

          if (session !== null && session.questions.length > 0) {
            const firstQuestion = session.questions[0];
            const result = submitAnswer(session.id, firstQuestion.id, answerText);

            // Should not be null (session exists) and should not be SessionCompletedError (session is active)
            expect(result).not.toBeNull();
            expect(result).not.toHaveProperty('error');

            // It should be a RevisionAnswer
            const answer = result as { score: number; feedback: string; questionId: string; answerText: string };
            expect(answer.score).toBeGreaterThanOrEqual(0);
            expect(answer.score).toBeLessThanOrEqual(100);
            expect(answer.feedback).toBeTruthy();
            expect(answer.feedback.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 30: Answer to non-existent session returns null
describe('Property 30: Answer to non-existent session returns null', () => {
  beforeEach(() => {
    clearRevisionStore();
    contentStore = new ContentStore();
    setContentStore(contentStore);
  });

  it('for any session ID that does not exist in the revision session store, submitting an answer returns null', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        answerTextArb,
        (nonExistentSessionId, questionId, answerText) => {
          const result = submitAnswer(nonExistentSessionId, questionId, answerText);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 31: Completed session rejects new answers
describe('Property 31: Completed session rejects new answers', () => {
  beforeEach(() => {
    clearRevisionStore();
    contentStore = new ContentStore();
    setContentStore(contentStore);
  });

  it('for any revision session in completed status, attempting to submit a new answer returns a SessionCompletedError', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        richTextArb,
        answerTextArb,
        (chapterId, learnerId, text, answerText) => {
          setupChapter(chapterId, learnerId, text);

          const session = startRevisionSession(learnerId, chapterId);

          if (session !== null) {
            // Answer all questions to complete the session
            for (const question of session.questions) {
              submitAnswer(session.id, question.id, 'some answer text');
            }

            // Session should now be completed — try submitting another answer
            // Use the first question ID again (already answered, but session is completed)
            const result = submitAnswer(session.id, session.questions[0].id, answerText);

            // Should return SessionCompletedError
            expect(result).not.toBeNull();
            const errorResult = result as SessionCompletedError;
            expect(errorResult.error).toBe('SESSION_COMPLETED');
            expect(errorResult.message).toBeTruthy();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: backend-stub-implementations, Property 32: Session summary computation
describe('Property 32: Session summary computation', () => {
  beforeEach(() => {
    clearRevisionStore();
    contentStore = new ContentStore();
    setContentStore(contentStore);
  });

  it('for any revision session with at least one submitted answer, percentageScore equals round(totalScore / totalQuestions) and timeTakenMs is non-negative', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        richTextArb,
        // How many questions to answer (at least 1)
        fc.integer({ min: 1, max: 20 }),
        answerTextArb,
        (chapterId, learnerId, text, answersToSubmit, answerText) => {
          setupChapter(chapterId, learnerId, text);

          const session = startRevisionSession(learnerId, chapterId);

          if (session !== null) {
            // Answer some questions (limited by actual question count)
            const numToAnswer = Math.min(answersToSubmit, session.questions.length);
            const answers: Array<{ score: number }> = [];

            for (let i = 0; i < numToAnswer; i++) {
              const result = submitAnswer(session.id, session.questions[i].id, answerText);
              if (result && !('error' in result)) {
                answers.push({ score: result.score });
              }
            }

            if (answers.length > 0) {
              const summary = getSessionSummary(session.id);
              expect(summary).not.toBeNull();

              if (summary) {
                // percentageScore = round(totalScore / totalQuestions)
                const totalScore = answers.reduce((sum, a) => sum + a.score, 0);
                const expectedPercentage = Math.round(totalScore / session.questions.length);
                expect(summary.percentageScore).toBe(expectedPercentage);

                // timeTakenMs must be non-negative
                expect(summary.timeTakenMs).toBeGreaterThanOrEqual(0);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
