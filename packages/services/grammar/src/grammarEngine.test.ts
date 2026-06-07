import { describe, it, expect, beforeEach } from 'vitest';
import {
  GrammarEngine,
  GrammarAnalysis,
  GrammarExercise,
  ExerciseAnswer,
  ExerciseScore,
  MIN_EXERCISES,
  MAX_EXERCISES,
  WEAK_RULE_THRESHOLD,
} from './grammarEngine';
import type { GrammarRuleSet, GrammarAnalysisResult } from '@learnverse/service-core';

// --- Test Helpers ---

/**
 * Create a mock GrammarRuleSet that simulates language-specific grammar analysis.
 */
function createMockGrammarRules(overrides?: {
  analysisResult?: GrammarAnalysisResult;
  ruleCategories?: string[];
}): GrammarRuleSet {
  const defaultResult: GrammarAnalysisResult = {
    isCorrect: true,
    errors: [],
  };

  return {
    languageCode: 'kn',
    ruleCategories: overrides?.ruleCategories ?? [
      'noun-declension',
      'verb-conjugation',
      'word-order',
      'postposition-usage',
    ],
    analyzeSentence: async (
      _sentence: string,
      _gradeLevel: number
    ): Promise<GrammarAnalysisResult> => {
      return overrides?.analysisResult ?? defaultResult;
    },
  };
}

/**
 * Create a mock GrammarRuleSet that returns errors for specific patterns.
 */
function createErrorDetectingRules(): GrammarRuleSet {
  return {
    languageCode: 'kn',
    ruleCategories: ['noun-declension', 'verb-conjugation', 'word-order'],
    analyzeSentence: async (
      sentence: string,
      gradeLevel: number
    ): Promise<GrammarAnalysisResult> => {
      const errors: GrammarAnalysisResult['errors'] = [];

      // Simulate detecting a word-order error if sentence starts with a verb-like word
      if (sentence.startsWith('went') || sentence.startsWith('ran')) {
        const explanation =
          gradeLevel <= 5
            ? 'The action word should come after who is doing it.'
            : 'The verb should follow the subject in standard sentence structure.';

        errors.push({
          rule: 'word-order',
          position: { start: 0, end: sentence.indexOf(' ') > 0 ? sentence.indexOf(' ') : sentence.length },
          correction: 'Ravi ' + sentence,
          explanation,
        });
      }

      // Simulate detecting a verb-conjugation error
      if (sentence.includes('he go')) {
        const idx = sentence.indexOf('he go');
        const explanation =
          gradeLevel <= 5
            ? 'When talking about one person, we change the action word.'
            : 'Third person singular requires verb conjugation (go → goes).';

        errors.push({
          rule: 'verb-conjugation',
          position: { start: idx + 3, end: idx + 5 },
          correction: 'goes',
          explanation,
        });
      }

      return {
        isCorrect: errors.length === 0,
        errors,
      };
    },
  };
}

describe('GrammarEngine', () => {
  let engine: GrammarEngine;

  beforeEach(() => {
    engine = new GrammarEngine();
  });

  // --- Task 9.1: Sentence Analysis ---

  describe('analyzeSentence', () => {
    it('confirms a correct sentence with isCorrect: true', async () => {
      const rules = createMockGrammarRules({
        analysisResult: { isCorrect: true, errors: [] },
      });

      const result = await engine.analyzeSentence('Ravi went to school.', rules, 5);

      expect(result.isCorrect).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('identifies errors with corrections and explanations', async () => {
      const rules = createMockGrammarRules({
        analysisResult: {
          isCorrect: false,
          errors: [
            {
              rule: 'verb-conjugation',
              position: { start: 3, end: 5 },
              correction: 'goes',
              explanation: 'Third person singular requires conjugation.',
            },
          ],
        },
      });

      const result = await engine.analyzeSentence('he go to school', rules, 8);

      expect(result.isCorrect).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rule).toBe('verb-conjugation');
      expect(result.errors[0].correction).toBe('goes');
      expect(result.errors[0].explanation).toBe(
        'Third person singular requires conjugation.'
      );
      expect(result.errors[0].position).toEqual({ start: 3, end: 5 });
    });

    it('provides grade-appropriate explanations for younger learners', async () => {
      const rules = createErrorDetectingRules();

      const result = await engine.analyzeSentence('he go to school', rules, 3);

      expect(result.isCorrect).toBe(false);
      expect(result.errors[0].explanation).toBe(
        'When talking about one person, we change the action word.'
      );
    });

    it('provides grade-appropriate explanations for older learners', async () => {
      const rules = createErrorDetectingRules();

      const result = await engine.analyzeSentence('he go to school', rules, 9);

      expect(result.isCorrect).toBe(false);
      expect(result.errors[0].explanation).toBe(
        'Third person singular requires verb conjugation (go → goes).'
      );
    });

    it('detects multiple errors in a single sentence', async () => {
      const rules = createMockGrammarRules({
        analysisResult: {
          isCorrect: false,
          errors: [
            {
              rule: 'word-order',
              position: { start: 0, end: 4 },
              correction: 'Ravi went',
              explanation: 'Subject should come first.',
            },
            {
              rule: 'postposition-usage',
              position: { start: 10, end: 12 },
              correction: 'to',
              explanation: 'Use correct postposition.',
            },
          ],
        },
      });

      const result = await engine.analyzeSentence('went Ravi at school', rules, 6);

      expect(result.isCorrect).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].rule).toBe('word-order');
      expect(result.errors[1].rule).toBe('postposition-usage');
    });

    it('handles empty sentence gracefully', async () => {
      const rules = createMockGrammarRules();

      const result = await engine.analyzeSentence('', rules, 5);

      expect(result.isCorrect).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles whitespace-only sentence gracefully', async () => {
      const rules = createMockGrammarRules();

      const result = await engine.analyzeSentence('   ', rules, 5);

      expect(result.isCorrect).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('uses Subject Module grammar rules for analysis', async () => {
      const rules = createErrorDetectingRules();

      const result = await engine.analyzeSentence('went to the market', rules, 5);

      expect(result.isCorrect).toBe(false);
      expect(result.errors[0].rule).toBe('word-order');
    });
  });

  // --- Task 9.2: Grammar Exercise Generation ---

  describe('generateExercises', () => {
    it('generates exercises from stored chapter vocabulary', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = [
        'Ravi went to school. He studied Kannada and Maths.',
        'The teacher explained the lesson clearly.',
      ];

      const result = engine.generateExercises(chapterTexts, rules);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.exercises.length).toBeGreaterThanOrEqual(MIN_EXERCISES);
        expect(result.exercises.length).toBeLessThanOrEqual(MAX_EXERCISES);
      }
    });

    it('generates between 5 and 10 exercises', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = ['The quick brown fox jumps over the lazy dog repeatedly.'];

      const result = engine.generateExercises(chapterTexts, rules, 7);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.exercises).toHaveLength(7);
      }
    });

    it('clamps count to minimum of 5', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = ['Ravi studies hard every day.'];

      const result = engine.generateExercises(chapterTexts, rules, 2);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.exercises).toHaveLength(MIN_EXERCISES);
      }
    });

    it('clamps count to maximum of 10', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = ['Ravi studies hard every day at school.'];

      const result = engine.generateExercises(chapterTexts, rules, 15);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.exercises).toHaveLength(MAX_EXERCISES);
      }
    });

    it('returns guidance message when no chapters are stored', () => {
      const rules = createMockGrammarRules();

      const result = engine.generateExercises([], rules);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.guidance.message).toContain('No chapter content');
        expect(result.guidance.suggestedAction).toContain('Add chapters');
      }
    });

    it('returns guidance message when chapter texts are all empty', () => {
      const rules = createMockGrammarRules();

      const result = engine.generateExercises(['', '   ', ''], rules);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.guidance.message).toContain('No chapter content');
      }
    });

    it('draws exercise vocabulary from stored chapter content', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = ['Ravi went to school. He studied Kannada.'];

      const result = engine.generateExercises(chapterTexts, rules);

      expect(result.success).toBe(true);
      if (result.success) {
        // All vocabulary in exercises should come from chapter text
        const chapterWords = new Set(
          chapterTexts
            .join(' ')
            .split(/[\s,.!?;:'"()\[\]{}\-—–]+/)
            .map((w) => w.trim().toLowerCase())
            .filter((w) => w.length >= 2)
        );

        for (const exercise of result.exercises) {
          for (const word of exercise.vocabulary) {
            expect(chapterWords.has(word.toLowerCase())).toBe(true);
          }
        }
      }
    });

    it('generates exercises with different types', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = [
        'The student learned many new words in class today and practiced writing.',
      ];

      const result = engine.generateExercises(chapterTexts, rules, 8);

      expect(result.success).toBe(true);
      if (result.success) {
        const types = new Set(result.exercises.map((e) => e.type));
        expect(types.size).toBeGreaterThan(1);
      }
    });

    it('assigns grammar rules from Subject Module rule categories', () => {
      const rules = createMockGrammarRules({
        ruleCategories: ['noun-declension', 'verb-conjugation'],
      });
      const chapterTexts = ['Ravi went to school and studied hard.'];

      const result = engine.generateExercises(chapterTexts, rules, 6);

      expect(result.success).toBe(true);
      if (result.success) {
        const exerciseRules = result.exercises.map((e) => e.rule);
        for (const rule of exerciseRules) {
          expect(['noun-declension', 'verb-conjugation']).toContain(rule);
        }
      }
    });

    it('each exercise has an id, type, prompt, correctAnswer, rule, and vocabulary', () => {
      const rules = createMockGrammarRules();
      const chapterTexts = ['Ravi went to school and studied Kannada.'];

      const result = engine.generateExercises(chapterTexts, rules);

      expect(result.success).toBe(true);
      if (result.success) {
        for (const exercise of result.exercises) {
          expect(exercise.id).toBeDefined();
          expect(exercise.type).toBeDefined();
          expect(exercise.prompt).toBeDefined();
          expect(exercise.prompt.length).toBeGreaterThan(0);
          expect(exercise.correctAnswer).toBeDefined();
          expect(exercise.rule).toBeDefined();
          expect(exercise.vocabulary).toBeDefined();
          expect(exercise.vocabulary.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // --- Task 9.4: Grammar Exercise Scoring ---

  describe('scoreExercises', () => {
    function createExercises(count: number, rules?: string[]): GrammarExercise[] {
      return Array.from({ length: count }, (_, i) => ({
        id: `ex-${i + 1}`,
        type: 'fill-in-the-blank' as const,
        prompt: `Exercise ${i + 1}`,
        correctAnswer: `answer-${i + 1}`,
        rule: rules ? rules[i % rules.length] : `rule-${(i % 3) + 1}`,
        vocabulary: [`word-${i + 1}`],
      }));
    }

    it('scores 100% when all answers are correct', () => {
      const exercises = createExercises(5);
      const answers: ExerciseAnswer[] = exercises.map((ex) => ({
        exerciseId: ex.id,
        answer: ex.correctAnswer,
      }));

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBe(100);
      expect(score.weakAreas).toHaveLength(0);
    });

    it('scores 0% when all answers are wrong', () => {
      const exercises = createExercises(5);
      const answers: ExerciseAnswer[] = exercises.map((ex) => ({
        exerciseId: ex.id,
        answer: 'wrong-answer',
      }));

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBe(0);
    });

    it('calculates correct percentage for mixed results', () => {
      const exercises = createExercises(4, ['rule-a', 'rule-a', 'rule-b', 'rule-b']);
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'answer-1' }, // correct
        { exerciseId: 'ex-2', answer: 'answer-2' }, // correct
        { exerciseId: 'ex-3', answer: 'wrong' }, // wrong
        { exerciseId: 'ex-4', answer: 'wrong' }, // wrong
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBe(50);
    });

    it('identifies weak grammar rules (below 60%)', () => {
      // 3 exercises for rule-a (2 correct, 1 wrong = 67% - not weak)
      // 3 exercises for rule-b (1 correct, 2 wrong = 33% - weak)
      const exercises = createExercises(6, [
        'rule-a',
        'rule-a',
        'rule-a',
        'rule-b',
        'rule-b',
        'rule-b',
      ]);
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'answer-1' }, // rule-a correct
        { exerciseId: 'ex-2', answer: 'answer-2' }, // rule-a correct
        { exerciseId: 'ex-3', answer: 'wrong' }, // rule-a wrong
        { exerciseId: 'ex-4', answer: 'answer-4' }, // rule-b correct
        { exerciseId: 'ex-5', answer: 'wrong' }, // rule-b wrong
        { exerciseId: 'ex-6', answer: 'wrong' }, // rule-b wrong
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.weakAreas).toContain('rule-b');
      expect(score.weakAreas).not.toContain('rule-a');
    });

    it('does not mark rules at exactly 60% as weak', () => {
      // 5 exercises for rule-a: 3 correct, 2 wrong = 60% (not weak)
      const exercises = createExercises(5, [
        'rule-a',
        'rule-a',
        'rule-a',
        'rule-a',
        'rule-a',
      ]);
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'answer-1' }, // correct
        { exerciseId: 'ex-2', answer: 'answer-2' }, // correct
        { exerciseId: 'ex-3', answer: 'answer-3' }, // correct
        { exerciseId: 'ex-4', answer: 'wrong' }, // wrong
        { exerciseId: 'ex-5', answer: 'wrong' }, // wrong
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.weakAreas).not.toContain('rule-a');
    });

    it('marks rules at 59% or below as weak', () => {
      // Approximate: 5 exercises for rule-a, 2 correct = 40% (weak)
      const exercises = createExercises(5, [
        'rule-a',
        'rule-a',
        'rule-a',
        'rule-a',
        'rule-a',
      ]);
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'answer-1' }, // correct
        { exerciseId: 'ex-2', answer: 'answer-2' }, // correct
        { exerciseId: 'ex-3', answer: 'wrong' }, // wrong
        { exerciseId: 'ex-4', answer: 'wrong' }, // wrong
        { exerciseId: 'ex-5', answer: 'wrong' }, // wrong
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.weakAreas).toContain('rule-a');
    });

    it('handles missing answers as incorrect', () => {
      const exercises = createExercises(3);
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'answer-1' }, // correct
        // ex-2 and ex-3 not answered
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBe(33); // 1/3 rounded
    });

    it('handles empty exercise set', () => {
      const score = engine.scoreExercises([], []);

      expect(score.percentage).toBe(0);
      expect(score.weakAreas).toHaveLength(0);
      expect(score.itemScores).toHaveLength(0);
    });

    it('is case-insensitive when comparing answers', () => {
      const exercises: GrammarExercise[] = [
        {
          id: 'ex-1',
          type: 'fill-in-the-blank',
          prompt: 'Test',
          correctAnswer: 'Ravi',
          rule: 'rule-a',
          vocabulary: ['Ravi'],
        },
      ];
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'ravi' },
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBe(100);
    });

    it('trims whitespace when comparing answers', () => {
      const exercises: GrammarExercise[] = [
        {
          id: 'ex-1',
          type: 'fill-in-the-blank',
          prompt: 'Test',
          correctAnswer: 'school',
          rule: 'rule-a',
          vocabulary: ['school'],
        },
      ];
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: '  school  ' },
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBe(100);
    });

    it('returns item-level scores for each exercise', () => {
      const exercises = createExercises(3);
      const answers: ExerciseAnswer[] = [
        { exerciseId: 'ex-1', answer: 'answer-1' },
        { exerciseId: 'ex-2', answer: 'wrong' },
        { exerciseId: 'ex-3', answer: 'answer-3' },
      ];

      const score = engine.scoreExercises(exercises, answers);

      expect(score.itemScores).toHaveLength(3);
      expect(score.itemScores[0].isCorrect).toBe(true);
      expect(score.itemScores[1].isCorrect).toBe(false);
      expect(score.itemScores[2].isCorrect).toBe(true);
    });

    it('score is between 0 and 100 inclusive', () => {
      const exercises = createExercises(7);
      const answers: ExerciseAnswer[] = exercises.slice(0, 3).map((ex) => ({
        exerciseId: ex.id,
        answer: ex.correctAnswer,
      }));

      const score = engine.scoreExercises(exercises, answers);

      expect(score.percentage).toBeGreaterThanOrEqual(0);
      expect(score.percentage).toBeLessThanOrEqual(100);
    });
  });
});
