import { describe, it, expect } from 'vitest';
import {
  getSyllableBreakdown,
  transliterateSyllable,
  isSyllableAudioAvailable,
} from './syllableBreakdown';
import { SubjectModule, PronunciationAssetConfig } from '@learnverse/service-core';

// --- Test Helpers ---

function createKannadaPronunciationAssets(): PronunciationAssetConfig {
  return {
    languageCode: 'kn',
    audioAssetBasePath: '/assets/audio/kannada',
    alphabetSet: [
      { character: 'ಅ', transliteration: 'a', audioAvailable: true },
      { character: 'ಆ', transliteration: 'aa', audioAvailable: true },
      { character: 'ಇ', transliteration: 'i', audioAvailable: true },
      { character: 'ಕ', transliteration: 'ka', audioAvailable: true },
      { character: 'ನ', transliteration: 'na', audioAvailable: true },
      { character: 'ಡ', transliteration: 'da', audioAvailable: true },
      { character: 'ಮ', transliteration: 'ma', audioAvailable: false }, // no audio
    ],
    syllabify(word: string): string[] {
      // Simple syllabification: split every 2 characters for Kannada
      const syllables: string[] = [];
      for (let i = 0; i < word.length; i += 2) {
        syllables.push(word.slice(i, Math.min(i + 2, word.length)));
      }
      return syllables;
    },
  };
}

function createLanguageSubjectModule(
  pronunciationAssets?: PronunciationAssetConfig
): SubjectModule {
  return {
    subjectId: 'kannada',
    name: 'Kannada',
    contentTypes: ['language-script'],
    extractionPipeline: {
      pipelineId: 'kannada-extraction',
      supportedContentTypes: ['language-script'],
      extract: async () => ({ extractedText: '', confidence: 0 }),
    },
    questionGenerationStrategy: {
      strategyId: 'kannada-questions',
      supportedQuestionTypes: ['fill-in-the-blank'],
      generateQuestions: async () => [],
    },
    grammarRules: {
      languageCode: 'kn',
      ruleCategories: ['noun-declension'],
      analyzeSentence: async () => ({ isCorrect: true, errors: [] }),
    },
    pronunciationAssets: pronunciationAssets ?? createKannadaPronunciationAssets(),
    renderingConfig: {
      displayName: 'Kannada',
      isLanguageSubject: true,
      iconId: 'kannada-icon',
      themeColor: '#FF5722',
    },
  };
}

function createNonLanguageSubjectModule(): SubjectModule {
  return {
    subjectId: 'maths',
    name: 'Mathematics',
    contentTypes: ['mathematical-notation'],
    extractionPipeline: {
      pipelineId: 'maths-extraction',
      supportedContentTypes: ['mathematical-notation'],
      extract: async () => ({ extractedText: '', confidence: 0 }),
    },
    questionGenerationStrategy: {
      strategyId: 'maths-questions',
      supportedQuestionTypes: ['short-answer'],
      generateQuestions: async () => [],
    },
    renderingConfig: {
      displayName: 'Mathematics',
      isLanguageSubject: false,
    },
  };
}

// --- Tests ---

describe('syllableBreakdown', () => {
  describe('transliterateSyllable', () => {
    const assets = createKannadaPronunciationAssets();

    it('transliterates known characters', () => {
      expect(transliterateSyllable('ಅ', assets)).toBe('a');
      expect(transliterateSyllable('ಕ', assets)).toBe('ka');
    });

    it('transliterates multi-character syllables', () => {
      expect(transliterateSyllable('ಕನ', assets)).toBe('kana');
    });

    it('falls back to character itself for unknown characters', () => {
      expect(transliterateSyllable('x', assets)).toBe('x');
    });

    it('handles empty string', () => {
      expect(transliterateSyllable('', assets)).toBe('');
    });
  });

  describe('isSyllableAudioAvailable', () => {
    const assets = createKannadaPronunciationAssets();

    it('returns true when all characters have audio', () => {
      expect(isSyllableAudioAvailable('ಅ', assets)).toBe(true);
      expect(isSyllableAudioAvailable('ಕನ', assets)).toBe(true);
    });

    it('returns false when any character lacks audio', () => {
      // 'ಮ' has audioAvailable: false
      expect(isSyllableAudioAvailable('ಮ', assets)).toBe(false);
      expect(isSyllableAudioAvailable('ಕಮ', assets)).toBe(false);
    });

    it('returns false for unknown characters', () => {
      expect(isSyllableAudioAvailable('z', assets)).toBe(false);
    });

    it('returns true for empty string (vacuously true)', () => {
      expect(isSyllableAudioAvailable('', assets)).toBe(true);
    });
  });

  describe('getSyllableBreakdown', () => {
    it('breaks a word into syllables with transliteration', () => {
      const module = createLanguageSubjectModule();
      const result = getSyllableBreakdown('ಕನಡ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.breakdown.word).toBe('ಕನಡ');
        expect(result.breakdown.languageCode).toBe('kn');
        expect(result.breakdown.syllables.length).toBeGreaterThan(0);
        // Each syllable should have transliteration
        for (const s of result.breakdown.syllables) {
          expect(s.transliteration.length).toBeGreaterThan(0);
        }
      }
    });

    it('provides full word transliteration joined by hyphens', () => {
      const module = createLanguageSubjectModule();
      const result = getSyllableBreakdown('ಕನ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.breakdown.fullTransliteration).toBe('kana');
        // Single syllable, no hyphen
        expect(result.breakdown.syllables.length).toBe(1);
      }
    });

    it('indicates word audio availability based on syllable audio', () => {
      const module = createLanguageSubjectModule();
      // 'ಕನ' - both characters have audio
      const result = getSyllableBreakdown('ಕನ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.breakdown.wordAudioAvailable).toBe(true);
      }
    });

    it('marks word audio as unavailable when any syllable lacks audio', () => {
      const module = createLanguageSubjectModule();
      // 'ಕಮ' - 'ಮ' has audioAvailable: false
      const result = getSyllableBreakdown('ಕಮ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.breakdown.wordAudioAvailable).toBe(false);
      }
    });

    it('returns error for empty word', () => {
      const module = createLanguageSubjectModule();
      const result = getSyllableBreakdown('', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_WORD');
      }
    });

    it('returns error for whitespace-only word', () => {
      const module = createLanguageSubjectModule();
      const result = getSyllableBreakdown('   ', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_WORD');
      }
    });

    it('returns error for non-language subject', () => {
      const module = createNonLanguageSubjectModule();
      const result = getSyllableBreakdown('hello', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NOT_LANGUAGE_SUBJECT');
        expect(result.error).toContain('Mathematics');
      }
    });

    it('returns error when pronunciation assets are missing', () => {
      const module = createLanguageSubjectModule();
      module.pronunciationAssets = undefined;
      const result = getSyllableBreakdown('ಕನ', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NO_PRONUNCIATION_ASSETS');
      }
    });

    it('concatenating syllables produces the original word', () => {
      const module = createLanguageSubjectModule();
      const result = getSyllableBreakdown('ಕನಡ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        const reconstructed = result.breakdown.syllables.map(s => s.syllable).join('');
        expect(reconstructed).toBe('ಕನಡ');
      }
    });
  });
});
