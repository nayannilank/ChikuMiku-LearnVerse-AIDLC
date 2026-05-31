/**
 * Syllable breakdown for pronunciation practice.
 *
 * Breaks words into syllables per language Subject Module rules,
 * provides pronunciation for each syllable and the complete word,
 * and displays characters with English transliteration.
 *
 * Requirements: 2.4, 2.5
 */

import { PronunciationAssetConfig, SubjectModule } from '@chikumiku/service-core';

// --- Types ---

/** A single syllable with its pronunciation info */
export interface SyllableInfo {
  /** The syllable characters */
  syllable: string;
  /** English transliteration of the syllable */
  transliteration: string;
  /** Whether audio is available for this syllable */
  audioAvailable: boolean;
}

/** Complete syllable breakdown result for a word */
export interface SyllableBreakdownResult {
  /** The original word */
  word: string;
  /** Language code of the subject */
  languageCode: string;
  /** Individual syllable information */
  syllables: SyllableInfo[];
  /** Full word transliteration */
  fullTransliteration: string;
  /** Whether audio is available for the complete word */
  wordAudioAvailable: boolean;
}

/** Error result when syllable breakdown fails */
export interface SyllableBreakdownError {
  success: false;
  error: string;
  code: 'NOT_LANGUAGE_SUBJECT' | 'EMPTY_WORD' | 'NO_PRONUNCIATION_ASSETS';
}

/** Success result for syllable breakdown */
export interface SyllableBreakdownSuccess {
  success: true;
  breakdown: SyllableBreakdownResult;
}

export type SyllableBreakdownResponse = SyllableBreakdownSuccess | SyllableBreakdownError;

// --- Transliteration ---

/**
 * Generates a basic English transliteration for a syllable.
 * Uses the alphabet set from the pronunciation assets if available,
 * otherwise falls back to character-by-character lookup.
 */
export function transliterateSyllable(
  syllable: string,
  pronunciationAssets: PronunciationAssetConfig
): string {
  const transliterations: string[] = [];

  for (const char of syllable) {
    const entry = pronunciationAssets.alphabetSet.find(a => a.character === char);
    if (entry) {
      transliterations.push(entry.transliteration);
    } else {
      // Fallback: use the character itself (e.g., for spaces or punctuation)
      transliterations.push(char);
    }
  }

  return transliterations.join('');
}

/**
 * Checks if audio is available for a syllable by checking each character
 * against the alphabet set.
 */
export function isSyllableAudioAvailable(
  syllable: string,
  pronunciationAssets: PronunciationAssetConfig
): boolean {
  for (const char of syllable) {
    const entry = pronunciationAssets.alphabetSet.find(a => a.character === char);
    if (!entry || !entry.audioAvailable) {
      return false;
    }
  }
  return true;
}

// --- Main Syllable Breakdown ---

/**
 * Breaks a word into syllables using the Subject Module's pronunciation rules.
 *
 * - Uses the Subject Module's `syllabify` method to split the word
 * - Provides transliteration for each syllable and the full word
 * - Indicates audio availability per syllable
 *
 * Requirements: 2.4, 2.5
 */
export function getSyllableBreakdown(
  word: string,
  subjectModule: SubjectModule
): SyllableBreakdownResponse {
  // Validate input
  if (!word || word.trim().length === 0) {
    return {
      success: false,
      error: 'Word cannot be empty. Please provide a word for syllable breakdown.',
      code: 'EMPTY_WORD',
    };
  }

  // Verify this is a language subject
  if (!subjectModule.renderingConfig.isLanguageSubject) {
    return {
      success: false,
      error: `Subject "${subjectModule.name}" is not a language subject. Syllable breakdown is only available for language subjects.`,
      code: 'NOT_LANGUAGE_SUBJECT',
    };
  }

  // Verify pronunciation assets are available
  if (!subjectModule.pronunciationAssets) {
    return {
      success: false,
      error: `No pronunciation assets configured for subject "${subjectModule.name}".`,
      code: 'NO_PRONUNCIATION_ASSETS',
    };
  }

  const pronunciationAssets = subjectModule.pronunciationAssets;

  // Break word into syllables using Subject Module rules
  const syllables = pronunciationAssets.syllabify(word);

  // Build syllable info for each syllable
  const syllableInfos: SyllableInfo[] = syllables.map(syllable => ({
    syllable,
    transliteration: transliterateSyllable(syllable, pronunciationAssets),
    audioAvailable: isSyllableAudioAvailable(syllable, pronunciationAssets),
  }));

  // Build full word transliteration
  const fullTransliteration = syllableInfos.map(s => s.transliteration).join('-');

  // Check if complete word audio is available (all syllables have audio)
  const wordAudioAvailable = syllableInfos.every(s => s.audioAvailable);

  return {
    success: true,
    breakdown: {
      word,
      languageCode: pronunciationAssets.languageCode,
      syllables: syllableInfos,
      fullTransliteration,
      wordAudioAvailable,
    },
  };
}
