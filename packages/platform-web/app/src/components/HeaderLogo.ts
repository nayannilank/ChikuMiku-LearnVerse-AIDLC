/**
 * HeaderLogo — Framework-agnostic branding component for the web platform.
 *
 * Creates an HTMLElement displaying the ChikuMiku LearnVerse logo in the
 * header/navigation area. The logo is scaled proportionally (object-fit: contain)
 * without cropping. On image load failure, a text fallback "ChikuMiku LearnVerse"
 * is displayed in place of the image.
 *
 * Usage:
 *   import { createHeaderLogo } from './components/HeaderLogo';
 *   document.querySelector('.nav-header')?.appendChild(createHeaderLogo());
 *
 * Validates: Requirements 7.1, 7.3, 7.4
 */

/**
 * Configuration options for the header logo element.
 */
export interface HeaderLogoOptions {
  /** Path to the logo image asset. Defaults to '/ChikuMiku-LearnVerse-Logo.png'. */
  logoSrc?: string;
  /** Maximum height in pixels for the logo image. Defaults to 40. */
  maxHeight?: number;
  /** Alt text for the logo image. Defaults to 'ChikuMiku LearnVerse'. */
  altText?: string;
}

const DEFAULT_LOGO_SRC = '/ChikuMiku-LearnVerse-Logo.png';
const DEFAULT_MAX_HEIGHT = 40;
const DEFAULT_ALT_TEXT = 'ChikuMiku LearnVerse';
const FALLBACK_TEXT = 'ChikuMiku LearnVerse';

/**
 * Creates a header logo DOM element.
 *
 * The returned container holds an `<img>` element pointing to the logo asset,
 * styled to scale proportionally without cropping (object-fit: contain).
 * If the image fails to load, the img is replaced with a `<span>` containing
 * the text fallback "ChikuMiku LearnVerse".
 *
 * @param options - Optional configuration for logo src, max height, and alt text.
 * @returns An HTMLElement suitable for insertion into a navigation/header area.
 */
export function createHeaderLogo(options?: HeaderLogoOptions): HTMLElement {
  const logoSrc = options?.logoSrc ?? DEFAULT_LOGO_SRC;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const altText = options?.altText ?? DEFAULT_ALT_TEXT;

  const container = document.createElement('div');
  container.className = 'header-logo';
  container.style.display = 'inline-flex';
  container.style.alignItems = 'center';
  container.style.height = `${maxHeight}px`;

  const img = document.createElement('img');
  img.src = logoSrc;
  img.alt = altText;
  img.style.maxHeight = `${maxHeight}px`;
  img.style.width = 'auto';
  img.style.objectFit = 'contain';
  img.style.display = 'block';

  img.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = 'header-logo-fallback';
    fallback.textContent = FALLBACK_TEXT;
    fallback.style.fontSize = '16px';
    fallback.style.fontWeight = '600';
    fallback.style.color = '#333';
    fallback.style.whiteSpace = 'nowrap';
    container.replaceChild(fallback, img);
  });

  container.appendChild(img);
  return container;
}
