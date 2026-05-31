import { describe, it, expect } from 'vitest';
import {
  checkMicrophoneAccess,
  checkAudioLevel,
  handlePlaybackFailure,
  loadPronunciationAssets,
} from './errorHandling';
import { PronunciationAssetConfig } from '@chikumiku/service-core';

// --- Test Helpers ---

function createPronunciationAssets(): PronunciationAssetConfig {
  return {
    languageCode: 'kn',
    audioAssetBasePath: '/assets/audio/kannada',
    alphabetSet: [
      { character: 'ಅ', transliteration: 'a', audioAvailable: true },
      { character: 'ಆ', transliteration: 'aa', audioAvailable: true },
      { character: 'ಇ', transliteration: 'i', audioAvailable: true },
      { character: 'ಕ', transliteration: 'ka', audioAvailable: true },
      { character: 'ನ', transliteration: 'na', audioAvailable: true },
      { character: 'ಮ', transliteration: 'ma', audioAvailable: false }, // no audio configured
    ],
    syllabify(word: string): string[] {
      const syllables: string[] = [];
      for (let i = 0; i < word.length; i += 2) {
        syllables.push(word.slice(i, Math.min(i + 2, word.length)));
      }
      return syllables;
    },
  };
}

// --- Tests ---

describe('errorHandling', () => {
  describe('checkMicrophoneAccess', () => {
    it('returns available when status is granted', () => {
      const result = checkMicrophoneAccess('granted');
      expect(result.available).toBe(true);
      expect(result.status).toBe('granted');
      expect(result.error).toBeUndefined();
    });

    it('returns error when microphone access is denied', () => {
      const result = checkMicrophoneAccess('denied');
      expect(result.available).toBe(false);
      expect(result.status).toBe('denied');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('MICROPHONE_ACCESS_DENIED');
      expect(result.error!.message).toContain('microphone');
      expect(result.error!.suggestedAction).toContain('settings');
      expect(result.error!.retryable).toBe(true);
    });

    it('returns error when microphone is unavailable', () => {
      const result = checkMicrophoneAccess('unavailable');
      expect(result.available).toBe(false);
      expect(result.status).toBe('unavailable');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('MICROPHONE_UNAVAILABLE');
      expect(result.error!.message).toContain('No microphone');
      expect(result.error!.retryable).toBe(true);
    });

    it('returns error when microphone status is unknown', () => {
      const result = checkMicrophoneAccess('unknown');
      expect(result.available).toBe(false);
      expect(result.status).toBe('unknown');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('MICROPHONE_STATUS_UNKNOWN');
      expect(result.error!.retryable).toBe(true);
    });
  });

  describe('checkAudioLevel', () => {
    it('returns null when audio level is above threshold', () => {
      const result = checkAudioLevel(0.5);
      expect(result).toBeNull();
    });

    it('returns null when audio level equals threshold', () => {
      const result = checkAudioLevel(0.01);
      expect(result).toBeNull();
    });

    it('returns error when audio level is below threshold', () => {
      const result = checkAudioLevel(0.005);
      expect(result).not.toBeNull();
      expect(result!.code).toBe('LOW_AUDIO_LEVEL');
      expect(result!.message).toContain('too low');
      expect(result!.suggestedAction).toContain('louder');
      expect(result!.retryable).toBe(true);
    });

    it('returns error when audio level is zero', () => {
      const result = checkAudioLevel(0);
      expect(result).not.toBeNull();
      expect(result!.code).toBe('LOW_AUDIO_LEVEL');
    });

    it('supports custom threshold', () => {
      // Level 0.05 is above default 0.01 but below custom 0.1
      const result = checkAudioLevel(0.05, 0.1);
      expect(result).not.toBeNull();
      expect(result!.code).toBe('LOW_AUDIO_LEVEL');
    });
  });

  describe('handlePlaybackFailure', () => {
    it('returns success for ready status', () => {
      const result = handlePlaybackFailure('ready');
      expect(result.success).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.error).toBeUndefined();
    });

    it('returns success for playing status', () => {
      const result = handlePlaybackFailure('playing');
      expect(result.success).toBe(true);
      expect(result.status).toBe('playing');
      expect(result.error).toBeUndefined();
    });

    it('returns error with retry for no_output status', () => {
      const result = handlePlaybackFailure('no_output');
      expect(result.success).toBe(false);
      expect(result.status).toBe('no_output');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('AUDIO_OUTPUT_UNAVAILABLE');
      expect(result.error!.message).toContain('no audio output');
      expect(result.error!.suggestedAction).toContain('speakers');
      expect(result.error!.retryable).toBe(true);
    });

    it('returns error with retry for missing_data status', () => {
      const result = handlePlaybackFailure('missing_data');
      expect(result.success).toBe(false);
      expect(result.status).toBe('missing_data');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('AUDIO_DATA_MISSING');
      expect(result.error!.message).toContain('could not be loaded');
      expect(result.error!.suggestedAction).toContain('retry');
      expect(result.error!.retryable).toBe(true);
    });

    it('returns error with retry for generic failed status', () => {
      const result = handlePlaybackFailure('failed');
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('PLAYBACK_FAILED');
      expect(result.error!.retryable).toBe(true);
    });
  });

  describe('loadPronunciationAssets', () => {
    it('loads all assets successfully when none fail', () => {
      const assets = createPronunciationAssets();
      const result = loadPronunciationAssets(assets);

      expect(result.totalEntries).toBe(6);
      // 'ಮ' has audioAvailable: false, so it won't be loaded
      expect(result.loadedEntries).toBe(5);
      expect(result.failedEntries).toBe(1);
      expect(result.canPractice).toBe(true);
    });

    it('marks failed characters as unavailable', () => {
      const assets = createPronunciationAssets();
      const result = loadPronunciationAssets(assets, ['ಅ', 'ಕ']);

      // 5 had audio, 2 of those failed, plus 1 without audio = 3 failed
      expect(result.loadedEntries).toBe(3);
      expect(result.failedEntries).toBe(3);
      expect(result.canPractice).toBe(true);

      // Check that failed characters are in unavailable list
      const unavailableChars = result.unavailableEntries.map(e => e.character);
      expect(unavailableChars).toContain('ಅ');
      expect(unavailableChars).toContain('ಕ');
    });

    it('provides warning when some assets fail', () => {
      const assets = createPronunciationAssets();
      const result = loadPronunciationAssets(assets, ['ಅ']);

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('temporarily unavailable');
    });

    it('allows practice with remaining available assets', () => {
      const assets = createPronunciationAssets();
      const result = loadPronunciationAssets(assets, ['ಅ', 'ಆ', 'ಇ']);

      // Still has ಕ and ನ available
      expect(result.canPractice).toBe(true);
      expect(result.loadedEntries).toBe(2);
      const availableChars = result.availableForPractice.map(e => e.character);
      expect(availableChars).toContain('ಕ');
      expect(availableChars).toContain('ನ');
    });

    it('reports cannot practice when all assets fail', () => {
      const assets = createPronunciationAssets();
      // Fail all characters that have audio available
      const result = loadPronunciationAssets(assets, ['ಅ', 'ಆ', 'ಇ', 'ಕ', 'ನ']);

      expect(result.canPractice).toBe(false);
      expect(result.loadedEntries).toBe(0);
      expect(result.warning).toContain('No pronunciation assets are currently available');
    });

    it('includes load error messages for failed entries', () => {
      const assets = createPronunciationAssets();
      const result = loadPronunciationAssets(assets, ['ಅ']);

      const failedEntry = result.unavailableEntries.find(e => e.character === 'ಅ');
      expect(failedEntry).toBeDefined();
      expect(failedEntry!.loadError).toContain('Failed to load');
      expect(failedEntry!.loaded).toBe(false);
    });

    it('handles empty alphabet set', () => {
      const assets: PronunciationAssetConfig = {
        ...createPronunciationAssets(),
        alphabetSet: [],
      };
      const result = loadPronunciationAssets(assets);

      expect(result.totalEntries).toBe(0);
      expect(result.loadedEntries).toBe(0);
      expect(result.canPractice).toBe(false);
    });
  });
});
