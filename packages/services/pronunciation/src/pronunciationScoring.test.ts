import { describe, it, expect } from 'vitest';
import {
  scorePronunciation,
  validateRecording,
  splitAudioBySyllables,
  generateFeedback,
  MAX_RECORDING_DURATION_SECONDS,
  MAX_SCORE,
  MIN_SCORE,
} from './pronunciationScoring';
import { SubjectModule, PronunciationAssetConfig } from '@chikumiku/service-core';

// --- Test Helpers ---

function createPronunciationAssets(): PronunciationAssetConfig {
  return {
    languageCode: 'kn',
    audioAssetBasePath: '/assets/audio/kannada',
    alphabetSet: [
      { character: 'ಕ', transliteration: 'ka', audioAvailable: true },
      { character: 'ನ', transliteration: 'na', audioAvailable: true },
      { character: 'ಡ', transliteration: 'da', audioAvailable: true },
    ],
    syllabify(word: string): string[] {
      // Simple syllabification for testing
      const syllables: string[] = [];
      for (let i = 0; i < word.length; i += 2) {
        syllables.push(word.slice(i, Math.min(i + 2, word.length)));
      }
      return syllables.length > 0 ? syllables : [word];
    },
  };
}

function createLanguageModule(): SubjectModule {
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
    pronunciationAssets: createPronunciationAssets(),
    renderingConfig: {
      displayName: 'Kannada',
      isLanguageSubject: true,
    },
  };
}

function createNonLanguageModule(): SubjectModule {
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

function createRecording(overrides: Partial<{
  data: Uint8Array;
  durationSeconds: number;
  sampleRate: number;
  audioLevel: number;
}> = {}) {
  return {
    data: overrides.data ?? new Uint8Array(Array.from({ length: 1000 }, () => Math.floor(Math.random() * 200) + 50)),
    durationSeconds: overrides.durationSeconds ?? 3,
    sampleRate: overrides.sampleRate ?? 44100,
    audioLevel: overrides.audioLevel ?? 0.5,
  };
}

// --- Tests ---

describe('pronunciationScoring', () => {
  describe('validateRecording', () => {
    it('returns null for valid recording', () => {
      const result = validateRecording(createRecording());
      expect(result).toBeNull();
    });

    it('returns error for empty recording data', () => {
      const result = validateRecording(createRecording({ data: new Uint8Array(0) }));
      expect(result).toContain('empty');
    });

    it('returns error for zero duration', () => {
      const result = validateRecording(createRecording({ durationSeconds: 0 }));
      expect(result).toContain('greater than 0');
    });

    it('returns error for recording exceeding 10 seconds', () => {
      const result = validateRecording(createRecording({ durationSeconds: 11 }));
      expect(result).toContain('exceeds');
      expect(result).toContain(`${MAX_RECORDING_DURATION_SECONDS}`);
    });

    it('accepts recording at exactly 10 seconds', () => {
      const result = validateRecording(createRecording({ durationSeconds: 10 }));
      expect(result).toBeNull();
    });
  });

  describe('splitAudioBySyllables', () => {
    it('returns single segment for one syllable', () => {
      const data = new Uint8Array(100);
      const segments = splitAudioBySyllables(data, 1);
      expect(segments.length).toBe(1);
      expect(segments[0].length).toBe(100);
    });

    it('splits evenly for multiple syllables', () => {
      const data = new Uint8Array(100);
      const segments = splitAudioBySyllables(data, 2);
      expect(segments.length).toBe(2);
      expect(segments[0].length).toBe(50);
      expect(segments[1].length).toBe(50);
    });

    it('handles uneven splits by giving remainder to last segment', () => {
      const data = new Uint8Array(101);
      const segments = splitAudioBySyllables(data, 2);
      expect(segments.length).toBe(2);
      expect(segments[0].length).toBe(50);
      expect(segments[1].length).toBe(51);
    });

    it('returns empty array for zero syllables', () => {
      const data = new Uint8Array(100);
      const segments = splitAudioBySyllables(data, 0);
      expect(segments.length).toBe(0);
    });
  });

  describe('generateFeedback', () => {
    it('returns excellent feedback for score >= 90', () => {
      const feedback = generateFeedback(95, []);
      expect(feedback).toContain('Excellent');
    });

    it('returns good feedback for score >= 70', () => {
      const feedback = generateFeedback(75, ['ಕ']);
      expect(feedback).toContain('Good');
      expect(feedback).toContain('ಕ');
    });

    it('returns practice feedback for score >= 50', () => {
      const feedback = generateFeedback(55, ['ಕ', 'ನ']);
      expect(feedback).toContain('practicing');
    });

    it('returns try again feedback for score < 50', () => {
      const feedback = generateFeedback(30, ['ಕ']);
      expect(feedback).toContain('listening');
    });
  });

  describe('scorePronunciation', () => {
    it('produces a score between 0 and 100', () => {
      const module = createLanguageModule();
      const recording = createRecording();
      const result = scorePronunciation(recording, 'ಕನ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result.overallScore).toBeGreaterThanOrEqual(MIN_SCORE);
        expect(result.result.overallScore).toBeLessThanOrEqual(MAX_SCORE);
      }
    });

    it('provides syllable-level feedback', () => {
      const module = createLanguageModule();
      const recording = createRecording();
      const result = scorePronunciation(recording, 'ಕನಡ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result.syllableScores.length).toBeGreaterThan(0);
        for (const syllableScore of result.result.syllableScores) {
          expect(syllableScore.score).toBeGreaterThanOrEqual(MIN_SCORE);
          expect(syllableScore.score).toBeLessThanOrEqual(MAX_SCORE);
          expect(syllableScore.syllable.length).toBeGreaterThan(0);
          expect(syllableScore.feedback.length).toBeGreaterThan(0);
        }
      }
    });

    it('syllable scores reference only syllables from the target word', () => {
      const module = createLanguageModule();
      const recording = createRecording();
      const target = 'ಕನಡ';
      const result = scorePronunciation(recording, target, module);

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify all scored syllables are from the target word breakdown
        const expectedSyllables = module.pronunciationAssets!.syllabify(target);
        const scoredSyllables = result.result.syllableScores.map(s => s.syllable);
        expect(scoredSyllables).toEqual(expectedSyllables);
      }
    });

    it('returns the target and language code in result', () => {
      const module = createLanguageModule();
      const recording = createRecording();
      const result = scorePronunciation(recording, 'ಕ', module);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result.target).toBe('ಕ');
        expect(result.result.languageCode).toBe('kn');
      }
    });

    it('returns error for empty target', () => {
      const module = createLanguageModule();
      const recording = createRecording();
      const result = scorePronunciation(recording, '', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_TARGET');
      }
    });

    it('returns error for non-language subject', () => {
      const module = createNonLanguageModule();
      const recording = createRecording();
      const result = scorePronunciation(recording, 'hello', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NOT_LANGUAGE_SUBJECT');
      }
    });

    it('returns error when pronunciation assets are missing', () => {
      const module = createLanguageModule();
      module.pronunciationAssets = undefined;
      const recording = createRecording();
      const result = scorePronunciation(recording, 'ಕ', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NO_PRONUNCIATION_ASSETS');
      }
    });

    it('returns error for empty recording', () => {
      const module = createLanguageModule();
      const recording = createRecording({ data: new Uint8Array(0) });
      const result = scorePronunciation(recording, 'ಕ', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('EMPTY_RECORDING');
      }
    });

    it('returns error for recording exceeding 10 seconds', () => {
      const module = createLanguageModule();
      const recording = createRecording({ durationSeconds: 15 });
      const result = scorePronunciation(recording, 'ಕ', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('RECORDING_TOO_LONG');
      }
    });

    it('returns error for zero audio level', () => {
      const module = createLanguageModule();
      const recording = createRecording({ audioLevel: 0 });
      const result = scorePronunciation(recording, 'ಕ', module);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('LOW_AUDIO_LEVEL');
      }
    });

    it('accepts recording at exactly 10 seconds', () => {
      const module = createLanguageModule();
      const recording = createRecording({ durationSeconds: 10 });
      const result = scorePronunciation(recording, 'ಕ', module);

      expect(result.success).toBe(true);
    });
  });
});
