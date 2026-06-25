/**
 * Design System Tokens
 *
 * All color, typography, spacing, radius, and shadow tokens for the LearnVerse platform.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

// ============================================================
// Color Tokens (Requirement 3.1)
// ============================================================

export const colors = {
  primary: '#E94F9B',       // pink primary
  secondary: '#9B59B6',     // purple secondary
  skyBlue: '#5DADE2',
  gold: '#F7C948',
  green: '#27AE60',
  dark: '#2C2341',
  red: '#E74C3C',
  indigo: '#4A6CF7',
  background: '#F8F5FF',
  border: '#E0D8EC',
  white: '#FFFFFF',
  textMuted: '#6B7280',
  teal: '#4ECDC4',
} as const;

// ============================================================
// Typography Tokens (Requirement 3.2)
// ============================================================

export const typography = {
  title: { size: '26px', weight: 'bold' },
  heading: { size: '16px', weight: 'bold' },
  headingLg: { size: '18px', weight: 'bold' },
  cardTitle: { size: '14px', weight: '600' },
  cardTitleSm: { size: '13px', weight: '600' },
  body: { size: '13px', weight: 'normal' },
  bodySm: { size: '12px', weight: 'normal' },
  button: { size: '13px', weight: '600' },
  buttonSm: { size: '11px', weight: '600' },
  label: { size: '11px', weight: '600' },
  labelSm: { size: '10px', weight: '600' },
  caption: { size: '10px', weight: 'normal' },
  captionSm: { size: '9px', weight: 'normal' },
  indicScript: { size: '14px', weight: 'bold' },
  indicScriptLg: { size: '52px', weight: 'bold' },
} as const;

// ============================================================
// Spacing & Radius Tokens (Requirement 3.3)
// ============================================================

export const spacing = {
  radiusCardLarge: '16px',
  radiusCardSmall: '10px',
  radiusButton: '22px',
  radiusButtonSm: '20px',
  radiusInput: '8px',
  shadowCard: '0 4px 20px rgba(0, 0, 0, 0.08)',
} as const;

// ============================================================
// Subject Colors (Requirement 3.4)
// ============================================================

export const subjectColors: Record<string, string> = {
  Kannada: '#9B59B6',    // purple
  English: '#5DADE2',    // sky blue
  Hindi: '#F7C948',      // gold
  Maths: '#E94F9B',     // pink
  Computers: '#4A6CF7', // indigo
  EVS: '#27AE60',       // green
  Science: '#4ECDC4',   // teal
};

/**
 * Palette of colors available for custom subjects.
 * These do not conflict with the 7 default subject colors.
 */
export const CUSTOM_SUBJECT_PALETTE: string[] = [
  '#FF6B6B',  // coral red
  '#A29BFE',  // lavender
  '#FD79A8',  // rose
  '#00CEC9',  // cyan
  '#E17055',  // terracotta
  '#6C5CE7',  // violet
  '#FDCB6E',  // amber
  '#00B894',  // mint
  '#D63031',  // crimson
  '#0984E3',  // ocean blue
  '#B2BEC3',  // slate
  '#636E72',  // charcoal
];

/** Set of colors already used by default subjects */
const DEFAULT_SUBJECT_COLORS = new Set(Object.values(subjectColors));

/**
 * Assigns a color from the custom palette that does not conflict
 * with existing subject colors.
 *
 * @param usedColors - Array of color hex strings already in use by other custom subjects
 * @returns A color from CUSTOM_SUBJECT_PALETTE that isn't in use, or the first palette color if all are taken
 */
export function assignCustomSubjectColor(usedColors: string[] = []): string {
  const allUsed = new Set([
    ...DEFAULT_SUBJECT_COLORS,
    ...usedColors.map((c) => c.toUpperCase()),
  ]);

  const available = CUSTOM_SUBJECT_PALETTE.find(
    (color) => !allUsed.has(color.toUpperCase())
  );

  // Fallback: return first palette color if everything is somehow used
  return available ?? CUSTOM_SUBJECT_PALETTE[0];
}

// ============================================================
// Combined Tokens Export
// ============================================================

export const designTokens = {
  colors,
  typography,
  spacing,
  subjectColors,
} as const;
