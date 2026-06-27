/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createErrorView } from '../ErrorView';

describe('ErrorView', () => {
  describe('DOM structure', () => {
    it('returns a div with class "error-view"', () => {
      const el = createErrorView();
      expect(el.tagName).toBe('DIV');
      expect(el.className).toBe('error-view');
    });

    it('contains an error icon element with ⚠️', () => {
      const el = createErrorView();
      const icon = el.children[0] as HTMLElement;
      expect(icon.textContent).toBe('⚠️');
    });

    it('contains a message paragraph with default text', () => {
      const el = createErrorView();
      const msg = el.querySelector('p');
      expect(msg).not.toBeNull();
      expect(msg!.textContent).toBe('Something went wrong. Please try again.');
    });

    it('displays a custom message when provided', () => {
      const el = createErrorView('Network error occurred');
      const msg = el.querySelector('p');
      expect(msg!.textContent).toBe('Network error occurred');
    });

    it('does not render a retry button when onRetry is not provided', () => {
      const el = createErrorView();
      const btn = el.querySelector('button');
      expect(btn).toBeNull();
    });

    it('renders a retry button when onRetry is provided', () => {
      const el = createErrorView('Error', () => {});
      const btn = el.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toBe('Retry');
    });
  });

  describe('accessibility', () => {
    it('has role="alert" on the container', () => {
      const el = createErrorView();
      expect(el.getAttribute('role')).toBe('alert');
    });

    it('retry button has aria-label="Retry loading"', () => {
      const el = createErrorView('Error', () => {});
      const btn = el.querySelector('button');
      expect(btn!.getAttribute('aria-label')).toBe('Retry loading');
    });

    it('retry button has type="button"', () => {
      const el = createErrorView('Error', () => {});
      const btn = el.querySelector('button') as HTMLButtonElement;
      expect(btn.type).toBe('button');
    });
  });

  describe('design-system tokens', () => {
    it('applies background color #F8F5FF', () => {
      const el = createErrorView();
      expect(el.style.backgroundColor).toBe('rgb(248, 245, 255)');
    });

    it('applies border with #E0D8EC', () => {
      const el = createErrorView();
      expect(el.style.border).toBe('1px solid rgb(224, 216, 236)');
    });

    it('applies error red #E74C3C to the message text', () => {
      const el = createErrorView();
      const msg = el.querySelector('p') as HTMLElement;
      expect(msg.style.color).toBe('rgb(231, 76, 60)');
    });

    it('applies border-radius 14px', () => {
      const el = createErrorView();
      expect(el.style.borderRadius).toBe('14px');
    });
  });

  describe('retry button interaction', () => {
    it('calls the onRetry callback when button is clicked', () => {
      const onRetry = vi.fn();
      const el = createErrorView('Error', onRetry);
      const btn = el.querySelector('button')!;

      btn.click();
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry each time the button is clicked', () => {
      const onRetry = vi.fn();
      const el = createErrorView('Error', onRetry);
      const btn = el.querySelector('button')!;

      btn.click();
      btn.click();
      btn.click();
      expect(onRetry).toHaveBeenCalledTimes(3);
    });
  });
});
