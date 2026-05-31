/**
 * Subject Module interfaces and registry.
 *
 * Subject Modules encapsulate subject-specific logic (extraction rules,
 * question generation, grammar rules, pronunciation assets, rendering)
 * so that core platform services remain subject-agnostic.
 *
 * New subjects can be added by registering a SubjectModule without
 * modifying core services.
 */

// --- Supporting Interfaces ---

/** Content types that a subject module can handle */
export type ContentType =
  | 'text'
  | 'mathematical-notation'
  | 'code-snippet'
  | 'scientific-diagram'
  | 'language-script';

/**
 * Defines how content is extracted from uploaded images for a subject.
 * Each subject can have its own extraction rules for recognized content formats.
 */
export interface ExtractionPipeline {
  /** Unique identifier for this pipeline */
  pipelineId: string;
  /** Content types this pipeline can extract */
  supportedContentTypes: ContentType[];
  /** Extract text/content from raw image data */
  extract(imageData: ArrayBuffer | Uint8Array): Promise<ExtractionOutput>;
}

export interface ExtractionOutput {
  extractedText: string;
  confidence: number;
  partialRegions?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Defines how questions are generated from chapter content for a subject.
 * Each subject registers its own question generation logic.
 */
export interface QuestionGenerationStrategy {
  /** Unique identifier for this strategy */
  strategyId: string;
  /** Question types this strategy can generate */
  supportedQuestionTypes: string[];
  /** Generate questions from chapter content */
  generateQuestions(
    chapterContent: string,
    count: number,
    difficulty?: 'recall' | 'understanding' | 'application'
  ): Promise<GeneratedQuestion[]>;
}

export interface GeneratedQuestion {
  text: string;
  type: string;
  modelAnswer?: string;
  difficulty: 'recall' | 'understanding' | 'application';
}

/**
 * Grammar rules for a language subject.
 * Only applicable to language subjects (e.g., Kannada, Hindi, English).
 */
export interface GrammarRuleSet {
  /** Language identifier */
  languageCode: string;
  /** List of grammar rule categories */
  ruleCategories: string[];
  /** Analyze a sentence for grammatical correctness */
  analyzeSentence(sentence: string, gradeLevel: number): Promise<GrammarAnalysisResult>;
}

export interface GrammarAnalysisResult {
  isCorrect: boolean;
  errors: Array<{
    rule: string;
    position: { start: number; end: number };
    correction: string;
    explanation: string;
  }>;
}

/**
 * Pronunciation asset configuration for a language subject.
 * Only applicable to language subjects.
 */
export interface PronunciationAssetConfig {
  /** Language identifier */
  languageCode: string;
  /** Base path or URL for audio assets */
  audioAssetBasePath: string;
  /** Available alphabet entries for pronunciation practice */
  alphabetSet: Array<{
    character: string;
    transliteration: string;
    audioAvailable: boolean;
  }>;
  /** Break a word into syllables */
  syllabify(word: string): string[];
}

/**
 * Rendering configuration for how subject content is displayed.
 */
export interface RenderingConfig {
  /** Display name for the subject in the UI */
  displayName: string;
  /** Whether this is a language subject (enables pronunciation/grammar features) */
  isLanguageSubject: boolean;
  /** Icon identifier for the subject */
  iconId?: string;
  /** Primary color theme for the subject */
  themeColor?: string;
}

// --- Subject Module Interface ---

/**
 * A pluggable module that defines subject-specific behavior.
 * Core services invoke modules via the SubjectModuleRegistry.
 */
export interface SubjectModule {
  /** Unique subject identifier */
  subjectId: string;
  /** Human-readable subject name */
  name: string;
  /** Content types this subject handles */
  contentTypes: ContentType[];
  /** Pipeline for extracting content from images */
  extractionPipeline: ExtractionPipeline;
  /** Strategy for generating questions from chapter content */
  questionGenerationStrategy: QuestionGenerationStrategy;
  /** Grammar rules — only for language subjects */
  grammarRules?: GrammarRuleSet;
  /** Pronunciation assets — only for language subjects */
  pronunciationAssets?: PronunciationAssetConfig;
  /** Rendering/display configuration */
  renderingConfig: RenderingConfig;
}

// --- Subject Module Registry ---

/**
 * Error thrown when a subject module is not found in the registry.
 */
export class SubjectModuleNotFoundError extends Error {
  constructor(subjectId: string) {
    super(`Subject module not found: "${subjectId}"`);
    this.name = 'SubjectModuleNotFoundError';
  }
}

/**
 * Error thrown when attempting to register a duplicate subject module.
 */
export class DuplicateSubjectModuleError extends Error {
  constructor(subjectId: string) {
    super(`Subject module already registered: "${subjectId}"`);
    this.name = 'DuplicateSubjectModuleError';
  }
}

/**
 * Registry for subject modules. Provides registration, lookup, and listing.
 *
 * New subjects are added by calling `register()` with a SubjectModule.
 * Core services use `getModule()` to route operations to the correct module.
 */
export class SubjectModuleRegistry {
  private modules: Map<string, SubjectModule> = new Map();

  /**
   * Register a subject module. Throws if a module with the same subjectId
   * is already registered.
   */
  register(module: SubjectModule): void {
    if (this.modules.has(module.subjectId)) {
      throw new DuplicateSubjectModuleError(module.subjectId);
    }
    this.modules.set(module.subjectId, module);
  }

  /**
   * Retrieve a module by subject ID. Throws SubjectModuleNotFoundError
   * if no module is registered for the given ID.
   */
  getModule(subjectId: string): SubjectModule {
    const module = this.modules.get(subjectId);
    if (!module) {
      throw new SubjectModuleNotFoundError(subjectId);
    }
    return module;
  }

  /**
   * List all registered subject modules.
   */
  listModules(): SubjectModule[] {
    return Array.from(this.modules.values());
  }
}
