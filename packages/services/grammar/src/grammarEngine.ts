/**
 * Grammar Engine - Sentence analysis, exercise generation, and scoring.
 *
 * Implements Tasks 9.1, 9.2, 9.4 from the spec.
 *
 * - Task 9.1: Analyze sentences using Subject Module grammar rules,
 *   identify errors with corrections and grade-appropriate explanations,
 *   confirm correct sentences.
 * - Task 9.2: Generate 5-10 exercises from stored chapter vocabulary,
 *   handle empty chapter state with guidance message.
 * - Task 9.4: Score 0-100 percentage, identify weak grammar rules (below 60%).
 */

import type { Grade } from '@learnverse/service-core';
import { GrammarRuleSet, GrammarAnalysisResult } from '@learnverse/service-core';

// --- Types ---

/** Text range within a sentence */
export interface TextRange {
  start: number;
  end: number;
}

/** A grammar error identified during sentence analysis */
export interface GrammarError {
  position: TextRange;
  rule: string;
  correction: string;
  explanation: string;
}

/** Result of analyzing a sentence for grammatical correctness */
export interface GrammarAnalysis {
  isCorrect: boolean;
  errors: GrammarError[];
}

/** Types of grammar exercises */
export type ExerciseType =
  | 'fill-in-the-blank'
  | 'sentence-correction'
  | 'word-order'
  | 'sentence-construction';

/** A single grammar exercise */
export interface GrammarExercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  correctAnswer: string;
  rule: string;
  vocabulary: string[];
}

/** An answer submitted for a grammar exercise */
export interface ExerciseAnswer {
  exerciseId: string;
  answer: string;
}

/** Score for a single exercise */
export interface ExerciseItemScore {
  exerciseId: string;
  rule: string;
  isCorrect: boolean;
}

/** Overall exercise score result */
export interface ExerciseScore {
  percentage: number;
  weakAreas: string[];
  itemScores: ExerciseItemScore[];
}

/** Guidance message when no chapters are available */
export interface NoChapterGuidance {
  message: string;
  suggestedAction: string;
}

/** Result of exercise generation */
export type ExerciseGenerationResult =
  | { success: true; exercises: GrammarExercise[] }
  | { success: false; guidance: NoChapterGuidance };

// --- Constants ---

/** Minimum number of exercises to generate */
export const MIN_EXERCISES = 5;

/** Maximum number of exercises to generate */
export const MAX_EXERCISES = 10;

/** Threshold below which a grammar rule is considered weak */
export const WEAK_RULE_THRESHOLD = 60;

// --- Grammar Engine ---

/**
 * GrammarEngine provides sentence analysis, exercise generation, and scoring.
 *
 * It delegates sentence analysis to the Subject Module's GrammarRuleSet,
 * generates exercises from stored chapter vocabulary, and scores completed exercises.
 */
export class GrammarEngine {
  /**
   * Analyze a sentence for grammatical correctness using the Subject Module's grammar rules.
   *
   * Requirements: 3.1, 3.2, 3.4
   *
   * - Identifies grammatical errors with corrections and grade-appropriate explanations
   * - Confirms correct sentences with isCorrect: true
   * - Uses the grammar rules defined by the Subject Module for the language
   */
  async analyzeSentence(
    sentence: string,
    grammarRules: GrammarRuleSet,
    grade: Grade
  ): Promise<GrammarAnalysis> {
    if (!sentence || sentence.trim().length === 0) {
      return { isCorrect: true, errors: [] };
    }

    const result: GrammarAnalysisResult = await grammarRules.analyzeSentence(
      sentence,
      grade
    );

    if (result.isCorrect) {
      return { isCorrect: true, errors: [] };
    }

    const errors: GrammarError[] = result.errors.map((err) => ({
      position: { start: err.position.start, end: err.position.end },
      rule: err.rule,
      correction: err.correction,
      explanation: err.explanation,
    }));

    return { isCorrect: false, errors };
  }

  /**
   * Generate grammar exercises from stored chapter vocabulary.
   *
   * Requirements: 3.3, 3.6
   *
   * - Generates between 5 and 10 exercises
   * - All exercise vocabulary is drawn from stored chapter content
   * - Returns guidance message if no chapters are stored
   *
   * @param chapterTexts - Array of extracted text from stored chapters
   * @param grammarRules - The Subject Module's grammar rules
   * @param count - Desired number of exercises (clamped to 5-10)
   */
  generateExercises(
    chapterTexts: string[],
    grammarRules: GrammarRuleSet,
    count?: number
  ): ExerciseGenerationResult {
    // Handle empty chapter state (Requirement 3.6)
    if (!chapterTexts || chapterTexts.length === 0 || chapterTexts.every((t) => !t.trim())) {
      return {
        success: false,
        guidance: {
          message:
            'No chapter content is available for generating grammar exercises.',
          suggestedAction:
            'Add chapters by uploading or capturing photos of your textbook pages before requesting grammar exercises.',
        },
      };
    }

    // Clamp count to valid range
    const exerciseCount = Math.max(
      MIN_EXERCISES,
      Math.min(MAX_EXERCISES, count ?? MIN_EXERCISES)
    );

    // Extract vocabulary from chapter texts
    const vocabulary = this.extractVocabulary(chapterTexts);

    if (vocabulary.length === 0) {
      return {
        success: false,
        guidance: {
          message:
            'The stored chapter content does not contain enough vocabulary for grammar exercises.',
          suggestedAction:
            'Add more chapter content with text to enable grammar exercise generation.',
        },
      };
    }

    // Generate exercises using chapter vocabulary and grammar rules
    const exercises = this.buildExercises(
      vocabulary,
      grammarRules.ruleCategories,
      exerciseCount
    );

    return { success: true, exercises };
  }

  /**
   * Score a completed grammar exercise set.
   *
   * Requirements: 3.5
   *
   * - Produces a score between 0 and 100 (percentage)
   * - Identifies weak areas: grammar rules where the learner scored below 60%
   */
  scoreExercises(
    exercises: GrammarExercise[],
    answers: ExerciseAnswer[]
  ): ExerciseScore {
    if (exercises.length === 0) {
      return { percentage: 0, weakAreas: [], itemScores: [] };
    }

    // Build a map of exercise ID to exercise for quick lookup
    const exerciseMap = new Map<string, GrammarExercise>();
    for (const ex of exercises) {
      exerciseMap.set(ex.id, ex);
    }

    // Score each answer
    const itemScores: ExerciseItemScore[] = exercises.map((ex) => {
      const answer = answers.find((a) => a.exerciseId === ex.id);
      const isCorrect = answer
        ? this.normalizeAnswer(answer.answer) === this.normalizeAnswer(ex.correctAnswer)
        : false;

      return {
        exerciseId: ex.id,
        rule: ex.rule,
        isCorrect,
      };
    });

    // Calculate overall percentage
    const correctCount = itemScores.filter((s) => s.isCorrect).length;
    const percentage = Math.round((correctCount / exercises.length) * 100);

    // Identify weak areas: rules scoring below 60%
    const weakAreas = this.identifyWeakRules(itemScores);

    return { percentage, weakAreas, itemScores };
  }

  // --- Private Helpers ---

  /**
   * Extract vocabulary words from chapter texts.
   * Splits text into words, removes duplicates and very short words.
   */
  private extractVocabulary(chapterTexts: string[]): string[] {
    const allText = chapterTexts.join(' ');
    const words = allText
      .split(/[\s,.!?;:'"()\[\]{}\-—–]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const word of words) {
      const lower = word.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(word);
      }
    }

    return unique;
  }

  /**
   * Build grammar exercises from vocabulary and rule categories.
   */
  private buildExercises(
    vocabulary: string[],
    ruleCategories: string[],
    count: number
  ): GrammarExercise[] {
    const exercises: GrammarExercise[] = [];
    const exerciseTypes: ExerciseType[] = [
      'fill-in-the-blank',
      'sentence-correction',
      'word-order',
      'sentence-construction',
    ];

    for (let i = 0; i < count; i++) {
      const type = exerciseTypes[i % exerciseTypes.length];
      const rule =
        ruleCategories.length > 0
          ? ruleCategories[i % ruleCategories.length]
          : 'general';

      // Select vocabulary for this exercise (cycle through available words)
      const vocabStart = (i * 3) % vocabulary.length;
      const exerciseVocab: string[] = [];
      for (let j = 0; j < Math.min(3, vocabulary.length); j++) {
        exerciseVocab.push(vocabulary[(vocabStart + j) % vocabulary.length]);
      }

      const exercise = this.createExercise(
        `exercise-${i + 1}`,
        type,
        rule,
        exerciseVocab
      );
      exercises.push(exercise);
    }

    return exercises;
  }

  /**
   * Create a single grammar exercise based on type and vocabulary.
   */
  private createExercise(
    id: string,
    type: ExerciseType,
    rule: string,
    vocabulary: string[]
  ): GrammarExercise {
    const word = vocabulary[0] || 'word';

    switch (type) {
      case 'fill-in-the-blank':
        return {
          id,
          type,
          prompt: `Fill in the blank: The ___ is important. (${rule})`,
          correctAnswer: word,
          rule,
          vocabulary,
        };
      case 'sentence-correction':
        return {
          id,
          type,
          prompt: `Correct the sentence: "${vocabulary.join(' ')}" (${rule})`,
          correctAnswer: vocabulary.join(' '),
          rule,
          vocabulary,
        };
      case 'word-order':
        return {
          id,
          type,
          prompt: `Arrange in correct order: ${[...vocabulary].reverse().join(', ')} (${rule})`,
          correctAnswer: vocabulary.join(' '),
          rule,
          vocabulary,
        };
      case 'sentence-construction':
        return {
          id,
          type,
          prompt: `Construct a sentence using: ${vocabulary.join(', ')} (${rule})`,
          correctAnswer: vocabulary.join(' '),
          rule,
          vocabulary,
        };
    }
  }

  /**
   * Normalize an answer for comparison (trim, lowercase, collapse whitespace).
   */
  private normalizeAnswer(answer: string): string {
    return answer.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Identify grammar rules where the learner scored below 60%.
   * Groups scores by rule and calculates per-rule percentage.
   */
  private identifyWeakRules(itemScores: ExerciseItemScore[]): string[] {
    // Group by rule
    const ruleScores = new Map<string, { correct: number; total: number }>();

    for (const score of itemScores) {
      const existing = ruleScores.get(score.rule) || { correct: 0, total: 0 };
      existing.total += 1;
      if (score.isCorrect) existing.correct += 1;
      ruleScores.set(score.rule, existing);
    }

    // Find rules below threshold
    const weakRules: string[] = [];
    for (const [rule, counts] of ruleScores) {
      const rulePercentage = (counts.correct / counts.total) * 100;
      if (rulePercentage < WEAK_RULE_THRESHOLD) {
        weakRules.push(rule);
      }
    }

    return weakRules;
  }
}
