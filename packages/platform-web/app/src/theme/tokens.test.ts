import { describe, it, expect } from 'vitest';
import {
  colors,
  typography,
  spacing,
  subjectColors,
  CUSTOM_SUBJECT_PALETTE,
  assignCustomSubjectColor,
  designTokens,
} from './tokens';

describe('Design Tokens', () => {
  describe('colors (Requirement 3.1)', () => {
    it('defines pink primary', () => {
      expect(colors.primary).toBe('#E94F9B');
    });

    it('defines purple secondary', () => {
      expect(colors.secondary).toBe('#9B59B6');
    });

    it('defines sky blue', () => {
      expect(colors.skyBlue).toBe('#5DADE2');
    });

    it('defines gold', () => {
      expect(colors.gold).toBe('#F7C948');
    });

    it('defines green', () => {
      expect(colors.green).toBe('#27AE60');
    });

    it('defines dark', () => {
      expect(colors.dark).toBe('#2C2341');
    });

    it('defines red', () => {
      expect(colors.red).toBe('#E74C3C');
    });

    it('defines indigo', () => {
      expect(colors.indigo).toBe('#4A6CF7');
    });

    it('defines background', () => {
      expect(colors.background).toBe('#F8F5FF');
    });

    it('defines border', () => {
      expect(colors.border).toBe('#E0D8EC');
    });
  });

  describe('typography (Requirement 3.2)', () => {
    it('defines title at 26px bold', () => {
      expect(typography.title).toEqual({ size: '26px', weight: 'bold' });
    });

    it('defines heading at 16px bold', () => {
      expect(typography.heading).toEqual({ size: '16px', weight: 'bold' });
    });

    it('defines headingLg at 18px bold', () => {
      expect(typography.headingLg).toEqual({ size: '18px', weight: 'bold' });
    });

    it('defines body at 13px regular', () => {
      expect(typography.body).toEqual({ size: '13px', weight: 'normal' });
    });

    it('defines button at 13px semibold', () => {
      expect(typography.button).toEqual({ size: '13px', weight: '600' });
    });

    it('defines label at 11px semibold', () => {
      expect(typography.label).toEqual({ size: '11px', weight: '600' });
    });

    it('defines caption at 10px regular', () => {
      expect(typography.caption).toEqual({ size: '10px', weight: 'normal' });
    });

    it('defines Indic script at 14px bold', () => {
      expect(typography.indicScript).toEqual({ size: '14px', weight: 'bold' });
    });
  });

  describe('spacing (Requirement 3.3)', () => {
    it('defines card radius large at 16px', () => {
      expect(spacing.radiusCardLarge).toBe('16px');
    });

    it('defines card radius small at 10px', () => {
      expect(spacing.radiusCardSmall).toBe('10px');
    });

    it('defines button radius at 22px', () => {
      expect(spacing.radiusButton).toBe('22px');
    });

    it('defines input radius at 8px', () => {
      expect(spacing.radiusInput).toBe('8px');
    });

    it('defines card shadow', () => {
      expect(spacing.shadowCard).toBe('0 4px 20px rgba(0, 0, 0, 0.08)');
    });
  });

  describe('subjectColors (Requirement 3.4)', () => {
    it('maps Kannada to purple', () => {
      expect(subjectColors['Kannada']).toBe('#9B59B6');
    });

    it('maps English to sky blue', () => {
      expect(subjectColors['English']).toBe('#5DADE2');
    });

    it('maps Hindi to gold', () => {
      expect(subjectColors['Hindi']).toBe('#F7C948');
    });

    it('maps Maths to pink', () => {
      expect(subjectColors['Maths']).toBe('#E94F9B');
    });

    it('maps Computers to indigo', () => {
      expect(subjectColors['Computers']).toBe('#4A6CF7');
    });

    it('maps EVS to green', () => {
      expect(subjectColors['EVS']).toBe('#27AE60');
    });

    it('maps Science to teal', () => {
      expect(subjectColors['Science']).toBe('#4ECDC4');
    });
  });

  describe('CUSTOM_SUBJECT_PALETTE', () => {
    it('contains at least 10 colors', () => {
      expect(CUSTOM_SUBJECT_PALETTE.length).toBeGreaterThanOrEqual(10);
    });

    it('does not include any default subject colors', () => {
      const defaultColors = new Set(Object.values(subjectColors).map((c) => c.toUpperCase()));
      for (const paletteColor of CUSTOM_SUBJECT_PALETTE) {
        expect(defaultColors.has(paletteColor.toUpperCase())).toBe(false);
      }
    });
  });

  describe('assignCustomSubjectColor', () => {
    it('returns a color from the palette when no colors are used', () => {
      const color = assignCustomSubjectColor();
      expect(CUSTOM_SUBJECT_PALETTE).toContain(color);
    });

    it('avoids already-used colors', () => {
      const used = [CUSTOM_SUBJECT_PALETTE[0], CUSTOM_SUBJECT_PALETTE[1]];
      const color = assignCustomSubjectColor(used);
      expect(used).not.toContain(color);
    });

    it('handles case-insensitive comparison', () => {
      const used = [CUSTOM_SUBJECT_PALETTE[0].toLowerCase()];
      const color = assignCustomSubjectColor(used);
      expect(color.toUpperCase()).not.toBe(CUSTOM_SUBJECT_PALETTE[0].toUpperCase());
    });

    it('returns first palette color as fallback when all are used', () => {
      const allUsed = [...CUSTOM_SUBJECT_PALETTE];
      const color = assignCustomSubjectColor(allUsed);
      expect(color).toBe(CUSTOM_SUBJECT_PALETTE[0]);
    });
  });

  describe('designTokens combined export', () => {
    it('includes colors, typography, spacing, and subjectColors', () => {
      expect(designTokens.colors).toBe(colors);
      expect(designTokens.typography).toBe(typography);
      expect(designTokens.spacing).toBe(spacing);
      expect(designTokens.subjectColors).toBe(subjectColors);
    });
  });
});
