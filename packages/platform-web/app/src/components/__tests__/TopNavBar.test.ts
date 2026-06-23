/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createTopNavBar } from '../TopNavBar';

describe('TopNavBar', () => {
  describe('DOM structure', () => {
    it('renders a <nav> element with the correct class', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      expect(nav.tagName).toBe('NAV');
      expect(nav.className).toBe('top-nav-bar');
    });

    it('contains a logo image with correct alt text', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const img = nav.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.alt).toBe('ChikuMiku LearnVerse');
    });

    it('contains four navigation links in order: Dashboard, Subjects, Revision, Progress', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const links = nav.querySelectorAll('.top-nav-link');
      expect(links.length).toBe(4);
      expect(links[0].textContent).toBe('Dashboard');
      expect(links[1].textContent).toBe('Subjects');
      expect(links[2].textContent).toBe('Revision');
      expect(links[3].textContent).toBe('Progress');
    });

    it('contains an avatar element with text "A"', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const avatar = nav.querySelector('.top-nav-avatar');
      expect(avatar).not.toBeNull();
      expect(avatar!.textContent).toBe('A');
    });
  });

  describe('CSS classes', () => {
    it('nav has class "top-nav-bar"', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      expect(nav.classList.contains('top-nav-bar')).toBe(true);
    });

    it('each link has class "top-nav-link"', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const links = nav.querySelectorAll('a');
      links.forEach((link) => {
        expect(link.classList.contains('top-nav-link')).toBe(true);
      });
    });

    it('avatar has class "top-nav-avatar"', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const avatar = nav.querySelector('.top-nav-avatar');
      expect(avatar).not.toBeNull();
      expect(avatar!.classList.contains('top-nav-avatar')).toBe(true);
    });
  });

  describe('ARIA attributes', () => {
    it('nav has aria-label "Main navigation"', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      expect(nav.getAttribute('aria-label')).toBe('Main navigation');
    });

    it('avatar has aria-label "User avatar"', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const avatar = nav.querySelector('.top-nav-avatar');
      expect(avatar!.getAttribute('aria-label')).toBe('User avatar');
    });
  });

  describe('onNavigate callback', () => {
    it('calls onNavigate with "#dashboard" when Dashboard link is clicked', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('#dashboard');
    });

    it('calls onNavigate with "#subjects" when Subjects link is clicked', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('#subjects');
    });

    it('calls onNavigate with "#revision" when Revision link is clicked', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('#revision');
    });

    it('calls onNavigate with "#progress" when Progress link is clicked', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('#progress');
    });
  });

  describe('keyboard activation', () => {
    it('calls onNavigate with "#dashboard" when Enter is pressed on Dashboard link', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('#dashboard');
    });

    it('calls onNavigate with "#subjects" when Enter is pressed on Subjects link', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onNavigate).toHaveBeenCalledWith('#subjects');
    });

    it('does not call onNavigate for non-Enter keys', () => {
      const onNavigate = vi.fn();
      const nav = createTopNavBar({ onNavigate });
      const links = nav.querySelectorAll('.top-nav-link');

      links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Space', bubbles: true }));
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('focus order', () => {
    it('all four nav links have tabIndex=0', () => {
      const nav = createTopNavBar({ onNavigate: vi.fn() });
      const links = nav.querySelectorAll('.top-nav-link');
      expect(links.length).toBe(4);
      links.forEach((link) => {
        expect((link as HTMLElement).tabIndex).toBe(0);
      });
    });
  });
});
