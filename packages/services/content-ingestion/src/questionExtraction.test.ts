import { describe, it, expect } from 'vitest';
import {
  parseQuestionsFromText,
  inferQuestionType,
  inferDifficulty,
  extractQuestions,
  associateQuestionsWithChapter,
} from './questionExtraction';
import {
  SubjectModuleRegistry,
  SubjectModule,
  ExtractionOutput,
} from '@chikumiku/service-core';

function createMockModule(extractResult: ExtractionOutput | Error): SubjectModule {
  return {
    subjectId: 'maths',
    name: 'Mathematics',
    contentTypes: ['mathematical-notation', 'text'],
    extractionPipeline: {
      pipelineId: 'maths-ocr',
      supportedContentTypes: ['mathematical-notation', 'text'],
      extract: async () => {
        if (extractResult instanceof Error) {
          throw extractResult;
        }
        return extractResult;
      },
    },
    questionGenerationStrategy: {
      strategyId: 'maths-questions',
      supportedQuestionTypes: ['short-answer', 'fill-in-the-blank'],
      generateQuestions: async () => [],
    },
    renderingConfig: {
      displayName: 'Mathematics',
      isLanguageSubject: false,
    },
  };
}

describe('questionExtraction', () => {
  describe('inferQuestionType', () => {
    it('identifies fill-in-the-blank questions', () => {
      expect(inferQuestionType('Fill in the blank: The capital of India is ___')).toBe('fill-in-the-blank');
    });

    it('identifies match-the-following questions', () => {
      expect(inferQuestionType('Match the following items in Column A with Column B')).toBe('match-the-following');
    });

    it('identifies descriptive questions', () => {
      expect(inferQuestionType('Explain the process of photosynthesis')).toBe('descriptive');
    });

    it('defaults to short-answer for simple questions', () => {
      expect(inferQuestionType('What is 2 + 2?')).toBe('short-answer');
    });
  });

  describe('inferDifficulty', () => {
    it('identifies recall questions', () => {
      expect(inferDifficulty('Define photosynthesis')).toBe('recall');
      expect(inferDifficulty('Name the capital of Karnataka')).toBe('recall');
      expect(inferDifficulty('List the planets in the solar system')).toBe('recall');
    });

    it('identifies understanding questions', () => {
      expect(inferDifficulty('Explain why plants need sunlight')).toBe('understanding');
      expect(inferDifficulty('Describe the water cycle')).toBe('understanding');
      expect(inferDifficulty('Compare mitosis and meiosis')).toBe('understanding');
    });

    it('identifies application questions', () => {
      expect(inferDifficulty('Solve the equation: 2x + 3 = 7')).toBe('application');
      expect(inferDifficulty('Calculate the area of a circle with radius 5')).toBe('application');
      expect(inferDifficulty('Design a circuit for the given requirements')).toBe('application');
    });

    it('defaults to recall for ambiguous questions', () => {
      expect(inferDifficulty('What is the answer?')).toBe('recall');
    });
  });

  describe('parseQuestionsFromText', () => {
    it('parses numbered questions', () => {
      const text = '1. What is gravity?\n2. Explain Newton\'s laws\n3. Calculate the force';
      const questions = parseQuestionsFromText(text);
      expect(questions.length).toBe(3);
      expect(questions[0].text).toContain('gravity');
      expect(questions[1].text).toContain('Newton');
      expect(questions[2].text).toContain('force');
    });

    it('returns empty array for empty text', () => {
      expect(parseQuestionsFromText('')).toHaveLength(0);
      expect(parseQuestionsFromText('   ')).toHaveLength(0);
    });

    it('treats single block of text as one question', () => {
      const text = 'What is the meaning of life?';
      const questions = parseQuestionsFromText(text);
      expect(questions.length).toBe(1);
      expect(questions[0].text).toBe('What is the meaning of life?');
    });

    it('assigns inferred types to parsed questions', () => {
      const text = '1. Fill in the blank: 2 + ___ = 5\n2. Explain photosynthesis';
      const questions = parseQuestionsFromText(text);
      expect(questions[0].type).toBe('fill-in-the-blank');
      expect(questions[1].type).toBe('descriptive');
    });
  });

  describe('extractQuestions', () => {
    it('succeeds when questions are extracted', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(
        createMockModule({
          extractedText: '1. What is 2+2?\n2. Solve for x: 3x = 9',
          confidence: 0.9,
        })
      );

      const result = await extractQuestions(
        { imageData: new Uint8Array(100), chapterId: 'ch-1', subjectId: 'maths' },
        registry
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.questions.length).toBeGreaterThan(0);
        expect(result.chapterId).toBe('ch-1');
        expect(result.subjectId).toBe('maths');
      }
    });

    it('fails when no text is extracted', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(
        createMockModule({
          extractedText: '',
          confidence: 0,
        })
      );

      const result = await extractQuestions(
        { imageData: new Uint8Array(100), chapterId: 'ch-1', subjectId: 'maths' },
        registry
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.suggestedActions.length).toBeGreaterThan(0);
      }
    });

    it('fails when extraction pipeline throws', async () => {
      const registry = new SubjectModuleRegistry();
      registry.register(createMockModule(new Error('Service down')));

      const result = await extractQuestions(
        { imageData: new Uint8Array(100), chapterId: 'ch-1', subjectId: 'maths' },
        registry
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Failed to extract');
        expect(result.suggestedActions.length).toBeGreaterThan(0);
      }
    });

    it('fails when subject module is not found', async () => {
      const registry = new SubjectModuleRegistry();

      const result = await extractQuestions(
        { imageData: new Uint8Array(100), chapterId: 'ch-1', subjectId: 'unknown' },
        registry
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('unknown');
      }
    });
  });

  describe('associateQuestionsWithChapter', () => {
    it('creates Question objects with correct chapter and subject', () => {
      const extracted = [
        { text: 'What is 2+2?', type: 'short-answer' as const, difficulty: 'recall' as const },
        { text: 'Explain gravity', type: 'descriptive' as const, difficulty: 'understanding' as const },
      ];

      const questions = associateQuestionsWithChapter(extracted, 'ch-5', 'science');

      expect(questions).toHaveLength(2);
      expect(questions[0].chapterId).toBe('ch-5');
      expect(questions[0].subjectId).toBe('science');
      expect(questions[0].text).toBe('What is 2+2?');
      expect(questions[0].type).toBe('short-answer');
      expect(questions[0].difficulty).toBe('recall');
      expect(questions[1].chapterId).toBe('ch-5');
      expect(questions[1].subjectId).toBe('science');
    });

    it('generates unique IDs for each question', () => {
      const extracted = [
        { text: 'Q1', type: 'short-answer' as const, difficulty: 'recall' as const },
        { text: 'Q2', type: 'short-answer' as const, difficulty: 'recall' as const },
      ];

      const questions = associateQuestionsWithChapter(extracted, 'ch-1', 'maths');
      const ids = questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
