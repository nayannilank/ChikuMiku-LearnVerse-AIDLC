import { describe, it, expect, beforeEach } from 'vitest';
import {
  SubjectModuleRegistry,
  SubjectModule,
  SubjectModuleNotFoundError,
  DuplicateSubjectModuleError,
  ExtractionPipeline,
  QuestionGenerationStrategy,
  RenderingConfig,
  GrammarRuleSet,
  PronunciationAssetConfig,
} from './subjectModule';

/**
 * Creates a minimal SubjectModule for testing purposes.
 */
function createTestModule(overrides: Partial<SubjectModule> = {}): SubjectModule {
  const defaultPipeline: ExtractionPipeline = {
    pipelineId: 'test-pipeline',
    supportedContentTypes: ['text'],
    extract: async () => ({
      extractedText: 'test content',
      confidence: 0.95,
    }),
  };

  const defaultStrategy: QuestionGenerationStrategy = {
    strategyId: 'test-strategy',
    supportedQuestionTypes: ['short-answer'],
    generateQuestions: async () => [],
  };

  const defaultRenderingConfig: RenderingConfig = {
    displayName: 'Test Subject',
    isLanguageSubject: false,
  };

  return {
    subjectId: 'test-subject',
    name: 'Test Subject',
    contentTypes: ['text'],
    extractionPipeline: defaultPipeline,
    questionGenerationStrategy: defaultStrategy,
    renderingConfig: defaultRenderingConfig,
    ...overrides,
  };
}

describe('SubjectModuleRegistry', () => {
  let registry: SubjectModuleRegistry;

  beforeEach(() => {
    registry = new SubjectModuleRegistry();
  });

  describe('register', () => {
    it('should register a subject module successfully', () => {
      const module = createTestModule({ subjectId: 'kannada' });
      registry.register(module);

      const retrieved = registry.getModule('kannada');
      expect(retrieved).toBe(module);
    });

    it('should register multiple distinct modules', () => {
      const kannada = createTestModule({ subjectId: 'kannada', name: 'Kannada' });
      const maths = createTestModule({ subjectId: 'maths', name: 'Maths' });
      const science = createTestModule({ subjectId: 'science', name: 'Science' });

      registry.register(kannada);
      registry.register(maths);
      registry.register(science);

      expect(registry.listModules()).toHaveLength(3);
    });

    it('should throw DuplicateSubjectModuleError when registering a duplicate subjectId', () => {
      const module1 = createTestModule({ subjectId: 'kannada' });
      const module2 = createTestModule({ subjectId: 'kannada', name: 'Kannada v2' });

      registry.register(module1);

      expect(() => registry.register(module2)).toThrow(DuplicateSubjectModuleError);
      expect(() => registry.register(module2)).toThrow(
        'Subject module already registered: "kannada"'
      );
    });
  });

  describe('getModule', () => {
    it('should return the correct module for a registered subjectId', () => {
      const kannada = createTestModule({ subjectId: 'kannada', name: 'Kannada' });
      const maths = createTestModule({ subjectId: 'maths', name: 'Maths' });

      registry.register(kannada);
      registry.register(maths);

      expect(registry.getModule('kannada')).toBe(kannada);
      expect(registry.getModule('maths')).toBe(maths);
    });

    it('should throw SubjectModuleNotFoundError for an unregistered subjectId', () => {
      expect(() => registry.getModule('nonexistent')).toThrow(SubjectModuleNotFoundError);
      expect(() => registry.getModule('nonexistent')).toThrow(
        'Subject module not found: "nonexistent"'
      );
    });

    it('should throw SubjectModuleNotFoundError for an empty string', () => {
      expect(() => registry.getModule('')).toThrow(SubjectModuleNotFoundError);
    });
  });

  describe('listModules', () => {
    it('should return an empty array when no modules are registered', () => {
      expect(registry.listModules()).toEqual([]);
    });

    it('should return all registered modules', () => {
      const kannada = createTestModule({ subjectId: 'kannada', name: 'Kannada' });
      const maths = createTestModule({ subjectId: 'maths', name: 'Maths' });

      registry.register(kannada);
      registry.register(maths);

      const modules = registry.listModules();
      expect(modules).toHaveLength(2);
      expect(modules).toContain(kannada);
      expect(modules).toContain(maths);
    });

    it('should return a new array each time (not a reference to internal state)', () => {
      const module = createTestModule({ subjectId: 'kannada' });
      registry.register(module);

      const list1 = registry.listModules();
      const list2 = registry.listModules();

      expect(list1).toEqual(list2);
      expect(list1).not.toBe(list2);
    });
  });

  describe('SubjectModule interface - language subject', () => {
    it('should support a language subject with grammarRules and pronunciationAssets', () => {
      const grammarRules: GrammarRuleSet = {
        languageCode: 'kn',
        ruleCategories: ['noun-declension', 'verb-conjugation', 'postpositions'],
        analyzeSentence: async () => ({ isCorrect: true, errors: [] }),
      };

      const pronunciationAssets: PronunciationAssetConfig = {
        languageCode: 'kn',
        audioAssetBasePath: '/assets/audio/kannada',
        alphabetSet: [
          { character: 'ಅ', transliteration: 'a', audioAvailable: true },
          { character: 'ಆ', transliteration: 'aa', audioAvailable: true },
        ],
        syllabify: (word: string) => [word],
      };

      const kannadaModule = createTestModule({
        subjectId: 'kannada',
        name: 'Kannada',
        contentTypes: ['text', 'language-script'],
        grammarRules,
        pronunciationAssets,
        renderingConfig: {
          displayName: 'ಕನ್ನಡ',
          isLanguageSubject: true,
          iconId: 'kannada-icon',
          themeColor: '#FF5722',
        },
      });

      registry.register(kannadaModule);
      const retrieved = registry.getModule('kannada');

      expect(retrieved.grammarRules).toBeDefined();
      expect(retrieved.pronunciationAssets).toBeDefined();
      expect(retrieved.renderingConfig.isLanguageSubject).toBe(true);
      expect(retrieved.pronunciationAssets!.alphabetSet).toHaveLength(2);
      expect(retrieved.grammarRules!.ruleCategories).toContain('noun-declension');
    });
  });

  describe('SubjectModule interface - non-language subject', () => {
    it('should support a non-language subject without grammarRules or pronunciationAssets', () => {
      const mathsModule = createTestModule({
        subjectId: 'maths',
        name: 'Mathematics',
        contentTypes: ['text', 'mathematical-notation'],
        renderingConfig: {
          displayName: 'Mathematics',
          isLanguageSubject: false,
          iconId: 'maths-icon',
          themeColor: '#2196F3',
        },
      });

      registry.register(mathsModule);
      const retrieved = registry.getModule('maths');

      expect(retrieved.grammarRules).toBeUndefined();
      expect(retrieved.pronunciationAssets).toBeUndefined();
      expect(retrieved.renderingConfig.isLanguageSubject).toBe(false);
    });
  });

  describe('module lookup routes to correct module', () => {
    it('should route to the correct extraction pipeline per subject', () => {
      const kannadaPipeline: ExtractionPipeline = {
        pipelineId: 'kannada-ocr',
        supportedContentTypes: ['text', 'language-script'],
        extract: async () => ({ extractedText: 'ಕನ್ನಡ ಪಠ್ಯ', confidence: 0.9 }),
      };

      const mathsPipeline: ExtractionPipeline = {
        pipelineId: 'maths-ocr',
        supportedContentTypes: ['text', 'mathematical-notation'],
        extract: async () => ({ extractedText: 'x² + 2x + 1 = 0', confidence: 0.85 }),
      };

      registry.register(
        createTestModule({ subjectId: 'kannada', extractionPipeline: kannadaPipeline })
      );
      registry.register(
        createTestModule({ subjectId: 'maths', extractionPipeline: mathsPipeline })
      );

      expect(registry.getModule('kannada').extractionPipeline.pipelineId).toBe('kannada-ocr');
      expect(registry.getModule('maths').extractionPipeline.pipelineId).toBe('maths-ocr');
    });

    it('should route to the correct question generation strategy per subject', () => {
      const kannadaStrategy: QuestionGenerationStrategy = {
        strategyId: 'kannada-comprehension',
        supportedQuestionTypes: ['fill-in-the-blank', 'short-answer', 'descriptive'],
        generateQuestions: async () => [],
      };

      const mathsStrategy: QuestionGenerationStrategy = {
        strategyId: 'maths-problem-solving',
        supportedQuestionTypes: ['short-answer', 'descriptive'],
        generateQuestions: async () => [],
      };

      registry.register(
        createTestModule({ subjectId: 'kannada', questionGenerationStrategy: kannadaStrategy })
      );
      registry.register(
        createTestModule({ subjectId: 'maths', questionGenerationStrategy: mathsStrategy })
      );

      expect(registry.getModule('kannada').questionGenerationStrategy.strategyId).toBe(
        'kannada-comprehension'
      );
      expect(registry.getModule('maths').questionGenerationStrategy.strategyId).toBe(
        'maths-problem-solving'
      );
    });
  });
});
