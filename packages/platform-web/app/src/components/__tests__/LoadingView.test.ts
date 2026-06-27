/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createLoadingView } from '../LoadingView';

describe('LoadingView', () => {
  describe('DOM structure', () => {
    it('returns a div element with class "loading-view"', () => {
      const el = createLoadingView();
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('loading-view');
    });

    it('contains a spinner element with class "loading-spinner"', () => {
      const el = createLoadingView();
      const spinner = el.querySelector('.loading-spinner');
      expect(spinner).not.toBeNull();
      expect(spinner!.tagName).toBe('DIV');
    });

    it('contains a message paragraph with default text "Loading..."', () => {
      const el = createLoadingView();
      const msg = el.querySelector('p');
      expect(msg).not.toBeNull();
      expect(msg!.textContent).toBe('Loading...');
    });

    it('renders a custom message when provided', () => {
      const el = createLoadingView('Fetching data...');
      const msg = el.querySelector('p');
      expect(msg!.textContent).toBe('Fetching data...');
    });

    it('spinner appears before the message in DOM order', () => {
      const el = createLoadingView();
      const children = Array.from(el.children);
      expect(children[0].className).toBe('loading-spinner');
      expect(children[1].tagName).toBe('P');
    });
  });

  describe('accessibility', () => {
    it('has role="status" for screen reader announcements', () => {
      const el = createLoadingView();
      expect(el.getAttribute('role')).toBe('status');
    });

    it('has aria-live="polite" for non-intrusive updates', () => {
      const el = createLoadingView();
      expect(el.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('design-system tokens', () => {
    it('applies background color #F8F5FF', () => {
      const el = createLoadingView();
      expect(el.style.backgroundColor).toBe('rgb(248, 245, 255)');
    });

    it('applies border with color #E0D8EC', () => {
      const el = createLoadingView();
      expect(el.style.border).toBe('1px solid rgb(224, 216, 236)');
    });

    it('applies spinner accent color #E94F9B via border-top', () => {
      const el = createLoadingView();
      const spinner = el.querySelector('.loading-spinner') as HTMLElement;
      expect(spinner.style.borderTopColor).toBe('rgb(233, 79, 155)');
    });

    it('applies border-radius of 14px', () => {
      const el = createLoadingView();
      expect(el.style.borderRadius).toBe('14px');
    });
  });

  describe('layout styles', () => {
    it('uses flexbox column layout centered', () => {
      const el = createLoadingView();
      expect(el.style.display).toBe('flex');
      expect(el.style.flexDirection).toBe('column');
      expect(el.style.alignItems).toBe('center');
      expect(el.style.justifyContent).toBe('center');
    });

    it('has minimum height of 200px', () => {
      const el = createLoadingView();
      expect(el.style.minHeight).toBe('200px');
    });
  });
});
