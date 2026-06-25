/**
 * Unit tests for ChapterExplanationScreen — helper functions.
 *
 * Validates: Requirements 10.2, 10.10, 10.11, 10.12, 10.13
 */

import { describe, it, expect } from 'vitest';
import { getActionButtonLabel, getModeLabel } from './ChapterExplanationScreen';

describe('ChapterExplanationScreen - getActionButtonLabel', () => {
  describe('revision type', () => {
    it('returns "Generate Revision Questions" when no existing content', () => {
      expect(getActionButtonLabel('revision', false)).toBe('Generate Revision Questions');
    });

    it('returns "View Revision Questions" when content exists', () => {
      expect(getActionButtonLabel('revision', true)).toBe('View Revision Questions');
    });
  });

  describe('summary type', () => {
    it('returns "Generate Summary" when no existing content', () => {
      expect(getActionButtonLabel('summary', false)).toBe('Generate Summary');
    });

    it('returns "View Summary" when content exists', () => {
      expect(getActionButtonLabel('summary', true)).toBe('View Summary');
    });
  });
});

describe('ChapterExplanationScreen - getModeLabel', () => {
  it('returns "Read (Text)" for read mode', () => {
    expect(getModeLabel('read')).toBe('Read (Text)');
  });

  it('returns "Listen (Speech)" for listen mode', () => {
    expect(getModeLabel('listen')).toBe('Listen (Speech)');
  });
});
