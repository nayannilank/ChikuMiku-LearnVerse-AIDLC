/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createBrandingPanel } from '../BrandingPanel';

describe('BrandingPanel', () => {
  describe('Title and Subtitle', () => {
    it('renders title "ChikuMiku LearnVerse" in an h1 with class "branding-title"', () => {
      const panel = createBrandingPanel();
      const title = panel.querySelector('h1.branding-title');
      expect(title).not.toBeNull();
      expect(title!.textContent).toBe('ChikuMiku LearnVerse');
    });

    it('renders subtitle "Where Curiosity Comes Alive ✨" in a p with class "branding-subtitle"', () => {
      const panel = createBrandingPanel();
      const subtitle = panel.querySelector('p.branding-subtitle');
      expect(subtitle).not.toBeNull();
      expect(subtitle!.textContent).toBe('Where Curiosity Comes Alive ✨');
    });
  });

  describe('Stat Badges', () => {
    it('renders three stat badges with class "branding-badge"', () => {
      const panel = createBrandingPanel();
      const badges = panel.querySelectorAll('span.branding-badge');
      expect(badges.length).toBe(3);
    });

    it('renders badges with correct text: "7+ Subjects", "LKG-12 Grades", "AI Powered"', () => {
      const panel = createBrandingPanel();
      const badges = panel.querySelectorAll('span.branding-badge');
      expect(badges[0].textContent).toBe('7+ Subjects');
      expect(badges[1].textContent).toBe('LKG-12 Grades');
      expect(badges[2].textContent).toBe('AI Powered');
    });
  });

  describe('Watermark', () => {
    it('watermark element has pointer-events: none in inline styles', () => {
      const panel = createBrandingPanel();
      const watermark = panel.querySelector('div.watermark') as HTMLElement;
      expect(watermark).not.toBeNull();
      expect(watermark.style.pointerEvents).toBe('none');
    });

    it('watermark element has opacity 0.05 in inline styles', () => {
      const panel = createBrandingPanel();
      const watermark = panel.querySelector('div.watermark') as HTMLElement;
      expect(watermark).not.toBeNull();
      expect(watermark.style.opacity).toBe('0.05');
    });

    it('watermark hides (display becomes "none") when the img fires an error event', () => {
      const panel = createBrandingPanel();
      const watermark = panel.querySelector('div.watermark') as HTMLElement;
      const img = watermark.querySelector('img') as HTMLImageElement;
      expect(watermark).not.toBeNull();
      expect(img).not.toBeNull();

      // Fire error event on the image
      img.dispatchEvent(new Event('error'));

      expect(watermark.style.display).toBe('none');
    });
  });
});
