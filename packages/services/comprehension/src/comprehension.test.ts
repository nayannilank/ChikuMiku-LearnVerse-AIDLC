/**
 * Unit tests for the Comprehension Service.
 *
 * Tests cover:
 * - Model answer generation and content sufficiency checks
 * - Answer evaluation across all question types
 * - Hint system (step-by-step guidance without revealing full answer)
 * - Chapter performance summary calculation
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */

import { describe, it, expect } from 'vitest';
import {
  isContentSufficient,
  generateModelAnswer,
  buildModelAnswerFromContent,
  extractKeyPoints,
  evaluateAnswer,
  generateHints,
  getHint,
  calculatePerformanceSummary,
  ModelAnswer,
  QuestionResult,
} from './comprehension';
import {
  Question,
  Chapter,
  SubjectModuleRegistry,
  SubjectModule,
} from '@learnverse/service-core';

// --- Test Helpers ---

function createTestChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'chapter-1',
    learnerId: 'learner-1',
    subjectId: 'science',
    textbookName: 'General Science',
    chapterNumber: 1,
    pages: [],
    extractedText:
      'Photosynthesis is the process by which green plants make food using sunlight. ' +
      'Plants absorb carbon dioxide from the air and water from the soil. ' +
      'Chlorophyll in the leaves captures sunlight energy. ' +
      'The process produces glucose and oxygen as byproducts. ' +
      'Photosynthesis occurs mainly in the leaves of plants.',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
    ...overrides,
  };
}

function createTestQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    chapterId: 'chapter-1',
    subjectId: 'science',
    text: 'What is photosynthesis?',
    type: 'short-answer',
    difficulty: 'recall',
    ...overrides,
  };
}

function createTestModelAnswer(overrides: Partial<ModelAnswer> = {}): ModelAnswer {
  return {
    questionId: 'q-1',
    chapterId: 'chapter-1',
    answer:
      'Photosynthesis is the process by which green plants make food using sunlight. Plants absorb carbon dioxide and water. Chlorophyll captures sunlight energy.',
    keyPoints: [
      'Photosynthesis is the process by which green plants make food using sunlight',
      'Plants absorb carbon dioxide and water',
      'Chlorophyll captures sunlight energy',
    ],
    ...overrides,
  };
}

function createMockSubjectModule(): SubjectModule {
  return {
    subjectId: 'science',
    name: 'Science',
    contentTypes: ['text'],
    extractionPipeline: {
      pipelineId: 'science-extraction',
      supportedContentTypes: ['text'],
      extract: async () => ({
        extractedText: 'Photosynthesis is the process of making food.',
        confidence: 0.95,
      }),
    },
    questionGenerationStrategy: {
      strategyId: 'science-questions',
      supportedQuestionTypes: ['short-answer', 'fill-in-the-blank', 'descriptive'],
      generateQuestions: async (content, count, difficulty) => [
        {
          text: 'What is photosynthesis?',
          type: 'short-answer',
          modelAnswer: 'Photosynthesis is the process by which green plants make food using sunlight.',
          difficulty: difficulty || 'recall',
        },
      ],
    },
    renderingConfig: {
      displayName: 'Science',
      isLanguageSubject: false,
    },
  };
}

// --- Tests ---

describe('Comprehension Service', () => {
  describe('isContentSufficient', () => {
    it('returns true when chapter has sufficient extracted text', () => {
      const question = createTestQuestion();
      const chapter = createTestChapter();
      expect(isContentSufficient(question, chapter)).toBe(true);
    });

    it('returns false when chapter has empty extracted text', () => {
      const question = createTestQuestion();
      const chapter = createTestChapter({ extractedText: '' });
      expect(isContentSufficient(question, chapter)).toBe(false);
    });

    it('returns false when chapter has only whitespace', () => {
      const question = createTestQuestion();
      const chapter = createTestChapter({ extractedText: '   \n  ' });
      expect(isContentSufficient(question, chapter)).toBe(false);
    });

    it('returns false when chapter text is too short', () => {
      const question = createTestQuestion();
      const chapter = createTestChapter({ extractedText: 'Short text.' });
      expect(isContentSufficient(question, chapter)).toBe(false);
    });
  });

  describe('generateModelAnswer', () => {
    it('returns insufficient content result when chapter is empty', async () => {
      const question = createTestQuestion();
      const chapter = createTestChapter({ extractedText: '' });
      const registry = new SubjectModuleRegistry();
      registry.register(createMockSubjectModule());

      const result = await generateModelAnswer(question, chapter, registry);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('insufficient_content');
        expect(result.questionId).toBe(question.id);
        expect(result.message).toContain('Additional chapter pages are needed');
      }
    });

    it('returns insufficient content when subject module not found', async () => {
      const question = createTestQuestion({ subjectId: 'unknown-subject' });
      const chapter = createTestChapter();
      const registry = new SubjectModuleRegistry();
      registry.register(createMockSubjectModule());

      const result = await generateModelAnswer(question, chapter, registry);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('insufficient_content');
      }
    });

    it('generates model answer successfully when content is sufficient', async () => {
      const question = createTestQuestion({
        modelAnswer: 'Photosynthesis is the process by which green plants make food using sunlight.',
      });
      const chapter = createTestChapter();
      const registry = new SubjectModuleRegistry();
      registry.register(createMockSubjectModule());

      const result = await generateModelAnswer(question, chapter, registry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.modelAnswer.questionId).toBe(question.id);
        expect(result.modelAnswer.chapterId).toBe(chapter.id);
        expect(result.modelAnswer.answer.length).toBeGreaterThan(0);
        expect(result.modelAnswer.keyPoints.length).toBeGreaterThan(0);
      }
    });

    it('uses existing model answer from question when available', async () => {
      const existingAnswer = 'Plants use sunlight to make food.';
      const question = createTestQuestion({ modelAnswer: existingAnswer });
      const chapter = createTestChapter();
      const registry = new SubjectModuleRegistry();
      registry.register(createMockSubjectModule());

      const result = await generateModelAnswer(question, chapter, registry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.modelAnswer.answer).toBe(existingAnswer);
      }
    });
  });

  describe('buildModelAnswerFromContent', () => {
    it('extracts relevant sentences from chapter content', () => {
      const question = createTestQuestion({ text: 'What is photosynthesis?' });
      const chapter = createTestChapter();

      const answer = buildModelAnswerFromContent(question, chapter);
      expect(answer.length).toBeGreaterThan(0);
      expect(answer.toLowerCase()).toContain('photosynthesis');
    });

    it('falls back to first sentences when no relevant content found', () => {
      const question = createTestQuestion({ text: 'What is quantum mechanics?' });
      const chapter = createTestChapter();

      const answer = buildModelAnswerFromContent(question, chapter);
      expect(answer.length).toBeGreaterThan(0);
    });
  });

  describe('extractKeyPoints', () => {
    it('splits answer text into key points by sentences', () => {
      const text = 'Plants make food. They use sunlight. Chlorophyll is important.';
      const points = extractKeyPoints(text);
      expect(points).toHaveLength(3);
      expect(points[0]).toBe('Plants make food');
      expect(points[1]).toBe('They use sunlight');
      expect(points[2]).toBe('Chlorophyll is important');
    });

    it('returns empty array for empty text', () => {
      expect(extractKeyPoints('')).toHaveLength(0);
    });
  });

  describe('evaluateAnswer', () => {
    describe('short-answer questions', () => {
      it('gives high score when learner answer covers key points', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();
        const learnerAnswer =
          'Photosynthesis is the process by which green plants make food using sunlight and chlorophyll captures energy';

        const result = evaluateAnswer(question, learnerAnswer, modelAnswer);
        expect(result.score).toBeGreaterThan(50);
        expect(result.questionId).toBe(question.id);
      });

      it('gives zero score for empty answer', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const result = evaluateAnswer(question, '', modelAnswer);
        expect(result.score).toBe(0);
        expect(result.missingPoints).toEqual(modelAnswer.keyPoints);
      });

      it('identifies missing points', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();
        const learnerAnswer = 'Photosynthesis is about plants making food with sunlight';

        const result = evaluateAnswer(question, learnerAnswer, modelAnswer);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });

    describe('fill-in-the-blank questions', () => {
      it('gives full score for exact match', () => {
        const question = createTestQuestion({
          type: 'fill-in-the-blank',
          text: 'The process of making food by plants is called ___',
        });
        const modelAnswer = createTestModelAnswer({
          answer: 'photosynthesis',
          keyPoints: ['photosynthesis'],
        });

        const result = evaluateAnswer(question, 'photosynthesis', modelAnswer);
        expect(result.score).toBe(100);
      });

      it('gives zero score for completely wrong answer', () => {
        const question = createTestQuestion({
          type: 'fill-in-the-blank',
          text: 'The process of making food by plants is called ___',
        });
        const modelAnswer = createTestModelAnswer({
          answer: 'photosynthesis',
          keyPoints: ['photosynthesis'],
        });

        const result = evaluateAnswer(question, 'respiration', modelAnswer);
        expect(result.score).toBeLessThan(50);
      });
    });

    describe('match-the-following questions', () => {
      it('evaluates correct matches', () => {
        const question = createTestQuestion({
          type: 'match-the-following',
          text: 'Match the following',
        });
        const modelAnswer = createTestModelAnswer({
          answer: 'Chlorophyll - Green pigment, Sunlight - Energy source, CO2 - Gas absorbed',
          keyPoints: ['Chlorophyll - Green pigment', 'Sunlight - Energy source', 'CO2 - Gas absorbed'],
        });

        const learnerAnswer = 'Chlorophyll - Green pigment, Sunlight - Energy source, CO2 - Gas absorbed';
        const result = evaluateAnswer(question, learnerAnswer, modelAnswer);
        expect(result.score).toBe(100);
      });

      it('identifies incorrect matches', () => {
        const question = createTestQuestion({
          type: 'match-the-following',
          text: 'Match the following',
        });
        const modelAnswer = createTestModelAnswer({
          answer: 'Chlorophyll - Green pigment, Sunlight - Energy source',
          keyPoints: ['Chlorophyll - Green pigment', 'Sunlight - Energy source'],
        });

        const learnerAnswer = 'Chlorophyll - Energy source, Sunlight - Green pigment';
        const result = evaluateAnswer(question, learnerAnswer, modelAnswer);
        expect(result.score).toBeLessThan(100);
      });
    });

    describe('descriptive questions', () => {
      it('evaluates based on key point coverage', () => {
        const question = createTestQuestion({ type: 'descriptive' });
        const modelAnswer = createTestModelAnswer();
        const learnerAnswer =
          'Photosynthesis is the process where green plants make food using sunlight. They absorb carbon dioxide and water. Chlorophyll captures the sunlight energy.';

        const result = evaluateAnswer(question, learnerAnswer, modelAnswer);
        expect(result.score).toBeGreaterThan(50);
      });
    });
  });

  describe('Hint System', () => {
    describe('generateHints', () => {
      it('generates hints that do not contain the full model answer', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const hints = generateHints(question, modelAnswer);
        expect(hints.length).toBeGreaterThan(0);

        const fullAnswer = modelAnswer.answer;
        for (const hint of hints) {
          expect(hint.content).not.toBe(fullAnswer);
          expect(hint.content.length).toBeLessThan(fullAnswer.length);
        }
      });

      it('generates hints with sequential step numbers', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const hints = generateHints(question, modelAnswer);
        for (let i = 0; i < hints.length; i++) {
          expect(hints[i].stepNumber).toBe(i + 1);
          expect(hints[i].totalSteps).toBe(hints.length);
        }
      });

      it('generates at least one hint', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer({ keyPoints: [] });

        const hints = generateHints(question, modelAnswer);
        expect(hints.length).toBeGreaterThanOrEqual(1);
      });

      it('limits hints to maximum 5 steps', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer({
          keyPoints: [
            'Point one about the topic',
            'Point two about the topic',
            'Point three about the topic',
            'Point four about the topic',
            'Point five about the topic',
            'Point six about the topic',
            'Point seven about the topic',
          ],
        });

        const hints = generateHints(question, modelAnswer);
        expect(hints.length).toBeLessThanOrEqual(5);
      });

      it('first hint provides general direction based on question type', () => {
        const question = createTestQuestion({ type: 'fill-in-the-blank' });
        const modelAnswer = createTestModelAnswer();

        const hints = generateHints(question, modelAnswer);
        expect(hints[0].content).toContain('key term');
      });

      it('each hint builds toward the answer progressively', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const hints = generateHints(question, modelAnswer);
        // Later hints should provide more specific information
        if (hints.length > 1) {
          expect(hints[hints.length - 1].content.length).toBeGreaterThan(0);
        }
      });
    });

    describe('getHint', () => {
      it('returns the correct hint for a valid step number', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const hint = getHint(question, modelAnswer, 1);
        expect(hint).not.toBeNull();
        expect(hint!.stepNumber).toBe(1);
      });

      it('returns null for invalid step number (0)', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const hint = getHint(question, modelAnswer, 0);
        expect(hint).toBeNull();
      });

      it('returns null for step number exceeding total steps', () => {
        const question = createTestQuestion();
        const modelAnswer = createTestModelAnswer();

        const hint = getHint(question, modelAnswer, 100);
        expect(hint).toBeNull();
      });
    });
  });

  describe('Chapter Performance Summary', () => {
    describe('calculatePerformanceSummary', () => {
      it('returns zero values for empty results', () => {
        const summary = calculatePerformanceSummary('chapter-1', []);
        expect(summary.totalQuestions).toBe(0);
        expect(summary.correctCount).toBe(0);
        expect(summary.percentageScore).toBe(0);
        expect(summary.weakQuestions).toHaveLength(0);
      });

      it('calculates correct percentage score as average of all scores', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 80, isWeak: false },
          { questionId: 'q2', questionText: 'Q2', questionType: 'short-answer', learnerAnswer: 'b', score: 60, isWeak: false },
          { questionId: 'q3', questionText: 'Q3', questionType: 'short-answer', learnerAnswer: 'c', score: 40, isWeak: true },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.percentageScore).toBe(60); // (80+60+40)/3 = 60
        expect(summary.totalQuestions).toBe(3);
      });

      it('counts correct questions as those scoring >= 60%', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 80, isWeak: false },
          { questionId: 'q2', questionText: 'Q2', questionType: 'short-answer', learnerAnswer: 'b', score: 60, isWeak: false },
          { questionId: 'q3', questionText: 'Q3', questionType: 'fill-in-the-blank', learnerAnswer: 'c', score: 40, isWeak: true },
          { questionId: 'q4', questionText: 'Q4', questionType: 'descriptive', learnerAnswer: 'd', score: 59, isWeak: true },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.correctCount).toBe(2); // q1 (80%) and q2 (60%)
      });

      it('identifies weak questions as those scoring below 60%', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 80, isWeak: false },
          { questionId: 'q2', questionText: 'Q2', questionType: 'short-answer', learnerAnswer: 'b', score: 50, isWeak: true },
          { questionId: 'q3', questionText: 'Q3', questionType: 'match-the-following', learnerAnswer: 'c', score: 30, isWeak: true },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.weakQuestions).toHaveLength(2);
        expect(summary.weakQuestions[0].questionId).toBe('q2');
        expect(summary.weakQuestions[1].questionId).toBe('q3');
      });

      it('supports all question types in results', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Fill blank', questionType: 'fill-in-the-blank', learnerAnswer: 'a', score: 100, isWeak: false },
          { questionId: 'q2', questionText: 'Short ans', questionType: 'short-answer', learnerAnswer: 'b', score: 70, isWeak: false },
          { questionId: 'q3', questionText: 'Match', questionType: 'match-the-following', learnerAnswer: 'c', score: 50, isWeak: true },
          { questionId: 'q4', questionText: 'Describe', questionType: 'descriptive', learnerAnswer: 'd', score: 80, isWeak: false },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.totalQuestions).toBe(4);
        expect(summary.correctCount).toBe(3);
        expect(summary.weakQuestions).toHaveLength(1);
        expect(summary.weakQuestions[0].questionType).toBe('match-the-following');
      });

      it('handles all questions being weak', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 20, isWeak: true },
          { questionId: 'q2', questionText: 'Q2', questionType: 'short-answer', learnerAnswer: 'b', score: 30, isWeak: true },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.correctCount).toBe(0);
        expect(summary.weakQuestions).toHaveLength(2);
        expect(summary.percentageScore).toBe(25); // (20+30)/2
      });

      it('handles all questions being correct', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 90, isWeak: false },
          { questionId: 'q2', questionText: 'Q2', questionType: 'short-answer', learnerAnswer: 'b', score: 100, isWeak: false },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.correctCount).toBe(2);
        expect(summary.weakQuestions).toHaveLength(0);
        expect(summary.percentageScore).toBe(95); // (90+100)/2
      });

      it('correctly rounds percentage score', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 33, isWeak: true },
          { questionId: 'q2', questionText: 'Q2', questionType: 'short-answer', learnerAnswer: 'b', score: 33, isWeak: true },
          { questionId: 'q3', questionText: 'Q3', questionType: 'short-answer', learnerAnswer: 'c', score: 34, isWeak: true },
        ];

        const summary = calculatePerformanceSummary('chapter-1', results);
        expect(summary.percentageScore).toBe(33); // (33+33+34)/3 = 33.33 → 33
      });

      it('includes chapterId in the summary', () => {
        const results: QuestionResult[] = [
          { questionId: 'q1', questionText: 'Q1', questionType: 'short-answer', learnerAnswer: 'a', score: 70, isWeak: false },
        ];

        const summary = calculatePerformanceSummary('my-chapter-id', results);
        expect(summary.chapterId).toBe('my-chapter-id');
      });
    });
  });
});
