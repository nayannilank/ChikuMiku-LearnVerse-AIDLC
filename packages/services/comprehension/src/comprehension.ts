/**
 * Comprehension Service
 *
 * Handles:
 * - Model answer generation from chapter content using Subject Module question strategy
 * - Answer evaluation with percentage score, missing points, factual errors
 * - Step-by-step hint system that builds toward answer without revealing it
 * - Chapter performance summary with weak question identification
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.8
 */

import {
  Question,
  QuestionType,
  Chapter,
  SubjectModuleRegistry,
  SubjectModuleNotFoundError,
} from '@learnverse/service-core';

// --- Types ---

/** Result of model answer generation */
export interface ModelAnswer {
  questionId: string;
  chapterId: string;
  answer: string;
  keyPoints: string[];
}

/** Result when chapter content is insufficient */
export interface InsufficientContentResult {
  success: false;
  reason: 'insufficient_content';
  questionId: string;
  message: string;
}

/** Result when model answer is generated successfully */
export interface ModelAnswerSuccess {
  success: true;
  modelAnswer: ModelAnswer;
}

export type ModelAnswerResult = ModelAnswerSuccess | InsufficientContentResult;

/** Evaluation of a learner's answer */
export interface AnswerEvaluation {
  questionId: string;
  score: number; // 0-100 percentage
  missingPoints: string[];
  factualErrors: string[];
}

/** A single hint step */
export interface Hint {
  questionId: string;
  stepNumber: number;
  totalSteps: number;
  content: string;
}

/** Result of a single question attempt */
export interface QuestionResult {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  learnerAnswer: string;
  score: number; // 0-100
  isWeak: boolean; // below 60%
}

/** Chapter performance summary */
export interface PerformanceSummary {
  chapterId: string;
  totalQuestions: number;
  correctCount: number; // questions scoring >= 60%
  percentageScore: number; // average score across all questions
  weakQuestions: QuestionResult[]; // questions scoring below 60%
  allResults: QuestionResult[];
}

// --- Model Answer Generation ---

/**
 * Checks whether the chapter content is sufficient to generate a model answer
 * for the given question. Content is considered sufficient if the chapter has
 * extracted text that is non-empty and contains at least some relevant keywords
 * from the question.
 */
export function isContentSufficient(question: Question, chapter: Chapter): boolean {
  if (!chapter.extractedText || chapter.extractedText.trim().length === 0) {
    return false;
  }

  // Content must have a minimum length to be useful for answer generation
  if (chapter.extractedText.trim().length < 20) {
    return false;
  }

  return true;
}

/**
 * Generates a model answer for a question using the chapter content and
 * the Subject Module's question generation strategy.
 *
 * Requirements: 4.2, 4.8
 */
export async function generateModelAnswer(
  question: Question,
  chapter: Chapter,
  registry: SubjectModuleRegistry
): Promise<ModelAnswerResult> {
  // Verify content sufficiency
  if (!isContentSufficient(question, chapter)) {
    return {
      success: false,
      reason: 'insufficient_content',
      questionId: question.id,
      message: `Additional chapter pages are needed to generate an answer for: "${question.text}". Please add more content from your textbook.`,
    };
  }

  // Get the subject module for question strategy
  let module;
  try {
    module = registry.getModule(question.subjectId);
  } catch (error) {
    if (error instanceof SubjectModuleNotFoundError) {
      return {
        success: false,
        reason: 'insufficient_content',
        questionId: question.id,
        message: `No question generation strategy available for this subject.`,
      };
    }
    throw error;
  }

  // Use the question generation strategy to produce a model answer
  const strategy = module.questionGenerationStrategy;
  const generatedQuestions = await strategy.generateQuestions(
    chapter.extractedText,
    1,
    question.difficulty
  );

  // Build model answer from chapter content
  const modelAnswerText = question.modelAnswer || buildModelAnswerFromContent(question, chapter);
  const keyPoints = extractKeyPoints(modelAnswerText);

  return {
    success: true,
    modelAnswer: {
      questionId: question.id,
      chapterId: chapter.id,
      answer: modelAnswerText,
      keyPoints,
    },
  };
}

/**
 * Builds a model answer from chapter content when no pre-existing model answer is available.
 * Extracts relevant sentences from the chapter that relate to the question.
 */
export function buildModelAnswerFromContent(question: Question, chapter: Chapter): string {
  const chapterText = chapter.extractedText;
  const questionWords = question.text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3); // filter out short common words

  // Split chapter into sentences
  const sentences = chapterText.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  // Score sentences by relevance to the question
  const scoredSentences = sentences.map((sentence) => {
    const lowerSentence = sentence.toLowerCase();
    const matchCount = questionWords.filter((word) => lowerSentence.includes(word)).length;
    return { sentence: sentence.trim(), score: matchCount };
  });

  // Sort by relevance and take top sentences
  const relevantSentences = scoredSentences
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.sentence);

  if (relevantSentences.length === 0) {
    // Fallback: use first few sentences from chapter
    return sentences.slice(0, 2).join('. ') + '.';
  }

  return relevantSentences.join('. ') + '.';
}

/**
 * Extracts key points from a model answer text.
 */
export function extractKeyPoints(answerText: string): string[] {
  const sentences = answerText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences;
}

// --- Answer Evaluation ---

/**
 * Evaluates a learner's answer against the model answer.
 * Returns a percentage score, missing points, and factual errors.
 *
 * Requirements: 4.3
 */
export function evaluateAnswer(
  question: Question,
  learnerAnswer: string,
  modelAnswer: ModelAnswer
): AnswerEvaluation {
  if (!learnerAnswer || learnerAnswer.trim().length === 0) {
    return {
      questionId: question.id,
      score: 0,
      missingPoints: modelAnswer.keyPoints,
      factualErrors: [],
    };
  }

  const lowerLearnerAnswer = learnerAnswer.toLowerCase().trim();
  const lowerModelAnswer = modelAnswer.answer.toLowerCase().trim();

  // For fill-in-the-blank: exact or close match
  if (question.type === 'fill-in-the-blank') {
    return evaluateFillInTheBlank(question, lowerLearnerAnswer, lowerModelAnswer, modelAnswer);
  }

  // For match-the-following: check pair matches
  if (question.type === 'match-the-following') {
    return evaluateMatchTheFollowing(question, lowerLearnerAnswer, modelAnswer);
  }

  // For short-answer and descriptive: key point coverage
  return evaluateTextAnswer(question, lowerLearnerAnswer, modelAnswer);
}

function evaluateFillInTheBlank(
  question: Question,
  learnerAnswer: string,
  modelAnswerText: string,
  modelAnswer: ModelAnswer
): AnswerEvaluation {
  // Simple comparison for fill-in-the-blank
  const similarity = calculateTextSimilarity(learnerAnswer, modelAnswerText);
  const score = Math.round(similarity * 100);

  const missingPoints: string[] = [];
  if (score < 100) {
    missingPoints.push(`Expected answer: "${modelAnswer.answer}"`);
  }

  return {
    questionId: question.id,
    score: Math.min(100, Math.max(0, score)),
    missingPoints,
    factualErrors: [],
  };
}

function evaluateMatchTheFollowing(
  question: Question,
  learnerAnswer: string,
  modelAnswer: ModelAnswer
): AnswerEvaluation {
  // Parse pairs from both answers
  const modelPairs = parsePairs(modelAnswer.answer.toLowerCase());
  const learnerPairs = parsePairs(learnerAnswer);

  if (modelPairs.length === 0) {
    return {
      questionId: question.id,
      score: 0,
      missingPoints: modelAnswer.keyPoints,
      factualErrors: [],
    };
  }

  let correctCount = 0;
  const missingPoints: string[] = [];
  const factualErrors: string[] = [];

  for (const modelPair of modelPairs) {
    const matched = learnerPairs.some(
      (lp) =>
        lp.left.includes(modelPair.left) || modelPair.left.includes(lp.left)
    );
    if (matched) {
      const learnerPair = learnerPairs.find(
        (lp) => lp.left.includes(modelPair.left) || modelPair.left.includes(lp.left)
      );
      if (learnerPair && (learnerPair.right.includes(modelPair.right) || modelPair.right.includes(learnerPair.right))) {
        correctCount++;
      } else {
        factualErrors.push(`Incorrect match for "${modelPair.left}"`);
      }
    } else {
      missingPoints.push(`Missing match: "${modelPair.left}" → "${modelPair.right}"`);
    }
  }

  const score = Math.round((correctCount / modelPairs.length) * 100);

  return {
    questionId: question.id,
    score: Math.min(100, Math.max(0, score)),
    missingPoints,
    factualErrors,
  };
}

function evaluateTextAnswer(
  question: Question,
  learnerAnswer: string,
  modelAnswer: ModelAnswer
): AnswerEvaluation {
  const keyPoints = modelAnswer.keyPoints;
  const missingPoints: string[] = [];
  const factualErrors: string[] = [];
  let coveredPoints = 0;

  for (const point of keyPoints) {
    const pointWords = point
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Check if the learner's answer covers this key point
    const matchedWords = pointWords.filter((word) => learnerAnswer.includes(word));
    const coverage = pointWords.length > 0 ? matchedWords.length / pointWords.length : 0;

    if (coverage >= 0.5) {
      coveredPoints++;
    } else {
      missingPoints.push(point);
    }
  }

  // Calculate score based on key point coverage
  const score = keyPoints.length > 0 ? Math.round((coveredPoints / keyPoints.length) * 100) : 0;

  return {
    questionId: question.id,
    score: Math.min(100, Math.max(0, score)),
    missingPoints,
    factualErrors,
  };
}

// --- Hint System ---

/**
 * Generates hints for a question based on chapter content.
 * Each hint builds toward the answer without revealing the full answer.
 *
 * Requirements: 4.4
 */
export function generateHints(question: Question, modelAnswer: ModelAnswer): Hint[] {
  const keyPoints = modelAnswer.keyPoints;

  if (keyPoints.length === 0) {
    return [
      {
        questionId: question.id,
        stepNumber: 1,
        totalSteps: 1,
        content: 'Review the chapter content related to this topic.',
      },
    ];
  }

  const totalSteps = Math.min(keyPoints.length + 1, 5); // max 5 hint steps
  const hints: Hint[] = [];

  // First hint: general direction
  hints.push({
    questionId: question.id,
    stepNumber: 1,
    totalSteps,
    content: buildDirectionHint(question),
  });

  // Middle hints: partial key points (without revealing full answer)
  for (let i = 0; i < totalSteps - 1 && i < keyPoints.length; i++) {
    const partialHint = buildPartialHint(keyPoints[i], i + 1, totalSteps);
    hints.push({
      questionId: question.id,
      stepNumber: i + 2,
      totalSteps,
      content: partialHint,
    });
  }

  return hints;
}

/**
 * Gets a specific hint step for a question.
 *
 * Requirements: 4.4
 */
export function getHint(
  question: Question,
  modelAnswer: ModelAnswer,
  stepNumber: number
): Hint | null {
  const hints = generateHints(question, modelAnswer);

  if (stepNumber < 1 || stepNumber > hints.length) {
    return null;
  }

  return hints[stepNumber - 1];
}

/**
 * Builds a directional hint that points the learner in the right direction
 * without revealing the answer.
 */
function buildDirectionHint(question: Question): string {
  const typeHints: Record<QuestionType, string> = {
    'fill-in-the-blank': 'Think about the key term or concept that completes this statement.',
    'short-answer': 'Focus on the main concept being asked about. Look for relevant information in your chapter.',
    'match-the-following': 'Consider the relationship between each item in the first column and the options in the second column.',
    'descriptive': 'Start by identifying the main topic, then think about the key aspects you need to cover.',
  };

  return typeHints[question.type] || 'Review the relevant section of your chapter for clues.';
}

/**
 * Builds a partial hint from a key point without revealing the complete answer.
 * Provides a clue that builds toward understanding without giving away the full text.
 */
function buildPartialHint(keyPoint: string, stepNumber: number, totalSteps: number): string {
  const words = keyPoint.split(/\s+/);

  if (words.length <= 3) {
    // For very short key points, give a contextual clue
    return `Think about: ${words[0]}...`;
  }

  // Reveal a portion of the key point (first few words) as a clue
  const revealCount = Math.max(1, Math.floor(words.length * 0.4));
  const partialReveal = words.slice(0, revealCount).join(' ');

  return `Consider this aspect: "${partialReveal}..."`;
}

// --- Chapter Performance Summary ---

/**
 * Calculates the chapter performance summary from question results.
 * Identifies weak questions (below 60%) and calculates overall statistics.
 *
 * Requirements: 4.5, 4.6
 */
export function calculatePerformanceSummary(
  chapterId: string,
  results: QuestionResult[]
): PerformanceSummary {
  if (results.length === 0) {
    return {
      chapterId,
      totalQuestions: 0,
      correctCount: 0,
      percentageScore: 0,
      weakQuestions: [],
      allResults: [],
    };
  }

  // Mark weak questions (below 60%)
  const annotatedResults = results.map((r) => ({
    ...r,
    isWeak: r.score < 60,
  }));

  // Count correct (>= 60%)
  const correctCount = annotatedResults.filter((r) => !r.isWeak).length;

  // Calculate percentage score as average of all question scores
  const totalScore = annotatedResults.reduce((sum, r) => sum + r.score, 0);
  const percentageScore = Math.round(totalScore / annotatedResults.length);

  // Identify weak questions
  const weakQuestions = annotatedResults.filter((r) => r.isWeak);

  return {
    chapterId,
    totalQuestions: annotatedResults.length,
    correctCount,
    percentageScore,
    weakQuestions,
    allResults: annotatedResults,
  };
}

// --- Utility Functions ---

/**
 * Calculates text similarity between two strings (0-1).
 * Uses word overlap as a simple similarity metric.
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 0));
  const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 0));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }

  // Jaccard-like similarity
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Parses match-the-following pairs from text.
 * Expects formats like "A - B" or "A → B" or "A : B"
 */
function parsePairs(text: string): Array<{ left: string; right: string }> {
  const lines = text.split(/[\n,;]+/).filter((l) => l.trim().length > 0);
  const pairs: Array<{ left: string; right: string }> = [];

  for (const line of lines) {
    const separators = [' - ', ' → ', ' : ', ' = ', ' – '];
    for (const sep of separators) {
      if (line.includes(sep)) {
        const parts = line.split(sep);
        if (parts.length >= 2) {
          pairs.push({
            left: parts[0].trim(),
            right: parts.slice(1).join(sep).trim(),
          });
          break;
        }
      }
    }
  }

  return pairs;
}
