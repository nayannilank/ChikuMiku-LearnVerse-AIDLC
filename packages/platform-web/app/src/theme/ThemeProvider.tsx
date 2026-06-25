/**
 * ThemeProvider
 *
 * Applies all design token CSS variables to the document root.
 * This uses vanilla DOM manipulation to match the existing codebase pattern.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { colors, typography, spacing } from './tokens';

/**
 * Applies all design system tokens as CSS custom properties on :root.
 * Call this once during app initialization.
 */
export function applyTheme(): void {
  const root = document.documentElement;

  // Color tokens (Requirement 3.1)
  root.style.setProperty('--cm-color-primary', colors.primary);
  root.style.setProperty('--cm-color-secondary', colors.secondary);
  root.style.setProperty('--cm-color-sky-blue', colors.skyBlue);
  root.style.setProperty('--cm-color-gold', colors.gold);
  root.style.setProperty('--cm-color-green', colors.green);
  root.style.setProperty('--cm-color-dark', colors.dark);
  root.style.setProperty('--cm-color-red', colors.red);
  root.style.setProperty('--cm-color-indigo', colors.indigo);
  root.style.setProperty('--cm-color-background', colors.background);
  root.style.setProperty('--cm-color-border', colors.border);
  root.style.setProperty('--cm-color-white', colors.white);
  root.style.setProperty('--cm-color-text-muted', colors.textMuted);
  root.style.setProperty('--cm-color-teal', colors.teal);

  // Typography tokens (Requirement 3.2)
  root.style.setProperty('--cm-font-title', typography.title.size);
  root.style.setProperty('--cm-font-heading', typography.heading.size);
  root.style.setProperty('--cm-font-heading-lg', typography.headingLg.size);
  root.style.setProperty('--cm-font-card-title', typography.cardTitle.size);
  root.style.setProperty('--cm-font-card-title-sm', typography.cardTitleSm.size);
  root.style.setProperty('--cm-font-body', typography.body.size);
  root.style.setProperty('--cm-font-body-sm', typography.bodySm.size);
  root.style.setProperty('--cm-font-button', typography.button.size);
  root.style.setProperty('--cm-font-button-sm', typography.buttonSm.size);
  root.style.setProperty('--cm-font-label', typography.label.size);
  root.style.setProperty('--cm-font-label-sm', typography.labelSm.size);
  root.style.setProperty('--cm-font-caption', typography.caption.size);
  root.style.setProperty('--cm-font-caption-sm', typography.captionSm.size);
  root.style.setProperty('--cm-font-indic', typography.indicScript.size);
  root.style.setProperty('--cm-font-indic-lg', typography.indicScriptLg.size);

  // Spacing & radius tokens (Requirement 3.3)
  root.style.setProperty('--cm-radius-card', spacing.radiusCardLarge);
  root.style.setProperty('--cm-radius-card-sm', spacing.radiusCardSmall);
  root.style.setProperty('--cm-radius-button', spacing.radiusButton);
  root.style.setProperty('--cm-radius-button-sm', spacing.radiusButtonSm);
  root.style.setProperty('--cm-radius-input', spacing.radiusInput);
  root.style.setProperty('--cm-shadow-card', spacing.shadowCard);
}
