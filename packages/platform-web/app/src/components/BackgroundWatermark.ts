/**
 * BackgroundWatermark — Decorative background component for the web platform.
 *
 * Creates an HTMLElement displaying the ChikuMiku LearnVerse logo as a subtle
 * watermark behind all page content. The watermark is fixed-position, centered,
 * covers at least 50% of viewport width, and is non-interactive.
 *
 * On image load failure the element is hidden silently since it is purely decorative.
 *
 * Usage:
 *   import { createBackgroundWatermark } from './components/BackgroundWatermark';
 *   document.body.appendChild(createBackgroundWatermark());
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */

/**
 * Creates a background watermark DOM element.
 *
 * The returned container is a fixed-position element centered in the viewport
 * with the logo rendered at low opacity (0.05) and spanning at least 50% of
 * the viewport width. The element has z-index -1 and pointer-events none so
 * it sits behind all content and does not intercept user interactions.
 *
 * If the logo image fails to load, the entire element is hidden silently
 * since the watermark is purely decorative.
 *
 * @returns An HTMLElement suitable for insertion as a page-level background watermark.
 */
export function createBackgroundWatermark(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'background-watermark';

  const img = document.createElement('img');
  img.src = '/ChikuMiku-LearnVerse-Logo.png';
  img.alt = '';

  img.addEventListener('error', () => {
    container.style.display = 'none';
  });

  container.appendChild(img);
  return container;
}
