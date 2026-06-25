/**
 * Mobile Design Tokens
 *
 * Ported from packages/platform-web/app/src/theme/tokens.ts to React Native StyleSheet format.
 * Applied for mobile viewports (320-420px width).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// ============================================================
// Color Tokens (Requirement 3.1)
// ============================================================

export const colors = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
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
  textPrimary: '#2D2D2D',
  textSecondary: '#666666',
  success: '#27AE60',
  error: '#E74C3C',
  warning: '#F7C948',
} as const;

// ============================================================
// Typography Tokens (Requirement 3.2) — numeric values for RN
// ============================================================

export const typography = {
  title: { fontSize: 26, fontWeight: 'bold' as const },
  heading: { fontSize: 16, fontWeight: 'bold' as const },
  headingLg: { fontSize: 18, fontWeight: 'bold' as const },
  cardTitle: { fontSize: 14, fontWeight: '600' as const },
  cardTitleSm: { fontSize: 13, fontWeight: '600' as const },
  body: { fontSize: 13, fontWeight: 'normal' as const },
  bodySm: { fontSize: 12, fontWeight: 'normal' as const },
  button: { fontSize: 13, fontWeight: '600' as const },
  buttonSm: { fontSize: 11, fontWeight: '600' as const },
  label: { fontSize: 11, fontWeight: '600' as const },
  labelSm: { fontSize: 10, fontWeight: '600' as const },
  caption: { fontSize: 10, fontWeight: 'normal' as const },
  captionSm: { fontSize: 9, fontWeight: 'normal' as const },
  indicScript: { fontSize: 14, fontWeight: 'bold' as const },
  indicScriptLg: { fontSize: 52, fontWeight: 'bold' as const },
} as const;

// ============================================================
// Spacing & Radius Tokens (Requirement 3.3)
// ============================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  cardLarge: 16,
  cardSmall: 10,
  button: 22,
  buttonSm: 20,
  input: 8,
} as const;

// ============================================================
// Mobile-Specific Layout Tokens (Requirement 3.5)
// ============================================================

export const mobileLayout = {
  /** Bottom navigation bar height in pixels */
  bottomNavHeight: 44,
  /** Minimum supported viewport width */
  minViewportWidth: 320,
  /** Maximum supported viewport width */
  maxViewportWidth: 420,
  /** Standard horizontal padding */
  screenPadding: 16,
  /** Standard card elevation */
  cardElevation: 2,
} as const;

// ============================================================
// Subject Colors (Requirement 3.4)
// ============================================================

export const subjectColors: Record<string, string> = {
  Kannada: '#9B59B6',
  English: '#5DADE2',
  Hindi: '#F7C948',
  Maths: '#E94F9B',
  Computers: '#4A6CF7',
  EVS: '#27AE60',
  Science: '#4ECDC4',
};

// ============================================================
// Pronunciation Font Sizes
// ============================================================

export const pronunciationFontSizes = {
  english: 32,
  hindi: 40,
  kannada: 52,
} as const;

// ============================================================
// Combined Export
// ============================================================

export const designTokens = {
  colors,
  typography,
  spacing,
  radius,
  mobileLayout,
  subjectColors,
  pronunciationFontSizes,
} as const;
