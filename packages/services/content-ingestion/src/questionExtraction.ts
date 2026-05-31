/**
 * Question extraction from images.
 *
 * Handles:
 * - Extracting questions from uploaded photos
 * - Associating extracted questions with selected chapter
 * - Handling extraction failure with corrective action suggestions
 *
 * Requirements: 4.1, 4.7
 */

import {
  Question,
  QuestionType,
  DifficultyLevel,
  SubjectModuleRegistry,
  SubjectModuleNotFoundError,
} from '@chikumiku/service-core';

// --- Types ---

export interface QuestionExtractionRequest {
  imageData: Uint8Array;
  chapterId: string;
  subjectId: string;
}

export interface ExtractedQuestion {
  text: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
}

export interface QuestionExtractionSuccess {
  success: true;
  questions: ExtractedQuestion[];
  chapterId: string;
  subjectId: string;
}

export interface QuestionExtractionFailure {
  success: false;
  error: string;
  suggestedActions: string[];
}

export type QuestionExtractionResult = QuestionExtractionSuccess | QuestionExtractionFailure;

// --- Question Extraction ---

/**
 * Parses extracted text into individual questions.
 * Identifies question boundaries by common patterns (numbering, question marks, etc.)
 */
export function parseQuestionsFromText(text: string): ExtractedQuestion[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by common question numbering patterns
  const questionPatterns = /(?:^|\n)\s*(?:\d+[\.\)]\s*|[a-z][\.\)]\s*|[ivxIVX]+[\.\)]\s*|Q\d*[\.\:]\s*|-\s*)/;
  const segments = text.split(questionPatterns).filter((s) => s.trim().length > 0);

  if (segments.length === 0) {
    // If no numbered patterns found, treat the whole text as one question
    return [
      {
        text: text.trim(),
        type: inferQuestionType(text),
        difficulty: 'recall',
      },
    ];
  }

  return segments.map((segment) => ({
    text: segment.trim(),
    type: inferQuestionType(segment),
    difficulty: inferDifficulty(segment),
  }));
}

/**
 * Infers the question type from the question text.
 */
export function inferQuestionType(text: string): QuestionType {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('fill in the blank') || lowerText.includes('___') || lowerText.includes('____')) {
    return 'fill-in-the-blank';
  }

  if (lowerText.includes('match the following') || lowerText.includes('match the') || lowerText.includes('column a') || lowerText.includes('column b')) {
    return 'match-the-following';
  }

  if (
    lowerText.includes('explain') ||
    lowerText.includes('describe') ||
    lowerText.includes('discuss') ||
    lowerText.includes('elaborate') ||
    lowerText.includes('write an essay')
  ) {
    return 'descriptive';
  }

  return 'short-answer';
}

/**
 * Infers the difficulty level from the question text.
 */
export function inferDifficulty(text: string): DifficultyLevel {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes('define') ||
    lowerText.includes('name') ||
    lowerText.includes('list') ||
    lowerText.includes('what is') ||
    lowerText.includes('who is') ||
    lowerText.includes('when')
  ) {
    return 'recall';
  }

  if (
    lowerText.includes('explain') ||
    lowerText.includes('describe') ||
    lowerText.includes('why') ||
    lowerText.includes('how') ||
    lowerText.includes('compare') ||
    lowerText.includes('differentiate')
  ) {
    return 'understanding';
  }

  if (
    lowerText.includes('apply') ||
    lowerText.includes('solve') ||
    lowerText.includes('calculate') ||
    lowerText.includes('design') ||
    lowerText.includes('create') ||
    lowerText.includes('construct')
  ) {
    return 'application';
  }

  return 'recall';
}

/**
 * Extracts questions from an uploaded image using the subject module's extraction pipeline.
 * Associates extracted questions with the specified chapter.
 */
export async function extractQuestions(
  request: QuestionExtractionRequest,
  registry: SubjectModuleRegistry
): Promise<QuestionExtractionResult> {
  // Look up the subject module
  let module;
  try {
    module = registry.getModule(request.subjectId);
  } catch (error) {
    if (error instanceof SubjectModuleNotFoundError) {
      return {
        success: false,
        error: `No extraction pipeline available for subject "${request.subjectId}".`,
        suggestedActions: ['Select a different subject', 'Ensure the subject module is installed'],
      };
    }
    throw error;
  }

  // Use the extraction pipeline to get text from the image
  let extractionOutput;
  try {
    extractionOutput = await module.extractionPipeline.extract(request.imageData);
  } catch (error) {
    return {
      success: false,
      error: 'Failed to extract questions from the image. The image may be unreadable or unclear.',
      suggestedActions: [
        'Retake the photo with better lighting',
        'Ensure questions are clearly visible and not blurry',
        'Try capturing fewer questions at a time',
        'Make sure the page is flat and not curved',
      ],
    };
  }

  // Check if extraction produced any text
  if (!extractionOutput.extractedText || extractionOutput.extractedText.trim().length === 0) {
    return {
      success: false,
      error: 'Could not extract any questions from the image. No readable text was found.',
      suggestedActions: [
        'Retake the photo with better lighting',
        'Ensure questions are clearly visible and not blurry',
        'Try capturing fewer questions at a time',
        'Make sure the page is flat and not curved',
      ],
    };
  }

  // Parse the extracted text into individual questions
  const questions = parseQuestionsFromText(extractionOutput.extractedText);

  if (questions.length === 0) {
    return {
      success: false,
      error: 'Text was extracted but no questions could be identified. Please ensure the image contains clearly formatted questions.',
      suggestedActions: [
        'Ensure questions are numbered or clearly separated',
        'Try capturing a section with more clearly formatted questions',
      ],
    };
  }

  return {
    success: true,
    questions,
    chapterId: request.chapterId,
    subjectId: request.subjectId,
  };
}

/**
 * Associates extracted questions with a chapter by creating Question objects.
 */
export function associateQuestionsWithChapter(
  extractedQuestions: ExtractedQuestion[],
  chapterId: string,
  subjectId: string
): Question[] {
  return extractedQuestions.map((eq, index) => ({
    id: `q_${chapterId}_${Date.now()}_${index}`,
    chapterId,
    subjectId,
    text: eq.text,
    type: eq.type,
    difficulty: eq.difficulty,
  }));
}
