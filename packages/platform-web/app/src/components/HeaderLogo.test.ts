/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createHeaderLogo } from './HeaderLogo';

describe('HeaderLogo', () => {
  it('creates a container with an img element', () => {
    const el = createHeaderLogo();
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('header-logo');

    const img = el.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.src).toContain('/ChikuMiku-LearnVerse-Logo.png');
    expect(img!.alt).toBe('ChikuMiku LearnVerse');
  });

  it('styles the image with object-fit contain and max-height', () => {
    const el = createHeaderLogo({ maxHeight: 48 });
    const img = el.querySelector('img')!;
    expect(img.style.objectFit).toBe('contain');
    expect(img.style.maxHeight).toBe('48px');
    expect(img.style.width).toBe('auto');
  });

  it('uses default max-height of 40px', () => {
    const el = createHeaderLogo();
    const img = el.querySelector('img')!;
    expect(img.style.maxHeight).toBe('40px');
    expect(el.style.height).toBe('40px');
  });

  it('accepts custom logo src', () => {
    const el = createHeaderLogo({ logoSrc: '/custom-logo.png' });
    const img = el.querySelector('img')!;
    expect(img.src).toContain('/custom-logo.png');
  });

  it('displays text fallback on image load error', () => {
    const el = createHeaderLogo();
    const img = el.querySelector('img')!;

    // Simulate image load error
    const errorEvent = new Event('error');
    img.dispatchEvent(errorEvent);

    // img should be replaced by a span
    expect(el.querySelector('img')).toBeNull();
    const span = el.querySelector('span');
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('ChikuMiku LearnVerse');
    expect(span!.className).toBe('header-logo-fallback');
  });

  it('fallback span has proper styling', () => {
    const el = createHeaderLogo();
    const img = el.querySelector('img')!;

    img.dispatchEvent(new Event('error'));

    const span = el.querySelector('span')!;
    expect(span.style.fontSize).toBe('16px');
    expect(span.style.fontWeight).toBe('600');
    expect(span.style.whiteSpace).toBe('nowrap');
  });
});
