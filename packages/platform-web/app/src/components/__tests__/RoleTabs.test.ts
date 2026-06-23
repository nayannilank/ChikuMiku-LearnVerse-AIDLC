/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createRoleTabs } from '../RoleTabs';

describe('RoleTabs', () => {
  describe('DOM structure', () => {
    it('renders a container with class "role-tabs" and role="tablist"', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      expect(container.classList.contains('role-tabs')).toBe(true);
      expect(container.getAttribute('role')).toBe('tablist');
    });

    it('contains two tab buttons with labels "Parent" and "Learner"', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      expect(tabs.length).toBe(2);
      expect(tabs[0].textContent).toBe('Parent');
      expect(tabs[1].textContent).toBe('Learner');
    });
  });

  describe('default state', () => {
    it('"Parent" tab has class role-tab--active and aria-selected="true"', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      const parentTab = tabs[0];
      expect(parentTab.classList.contains('role-tab--active')).toBe(true);
      expect(parentTab.getAttribute('aria-selected')).toBe('true');
    });

    it('"Learner" tab does NOT have role-tab--active and has aria-selected="false"', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      const learnerTab = tabs[1];
      expect(learnerTab.classList.contains('role-tab--active')).toBe(false);
      expect(learnerTab.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('ARIA attributes', () => {
    it('each button has role="tab"', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      tabs.forEach((tab) => {
        expect(tab.getAttribute('role')).toBe('tab');
      });
    });

    it('each button has a data-role attribute', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      expect(tabs[0].getAttribute('data-role')).toBe('parent');
      expect(tabs[1].getAttribute('data-role')).toBe('student');
    });
  });

  describe('tab switching', () => {
    it('clicking "Learner" tab switches active class and aria-selected', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      const parentTab = tabs[0];
      const learnerTab = tabs[1];

      learnerTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(learnerTab.classList.contains('role-tab--active')).toBe(true);
      expect(learnerTab.getAttribute('aria-selected')).toBe('true');
      expect(parentTab.classList.contains('role-tab--active')).toBe(false);
      expect(parentTab.getAttribute('aria-selected')).toBe('false');
    });

    it('clicking "Parent" tab after "Learner" switches back', () => {
      const container = createRoleTabs({ onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      const parentTab = tabs[0];
      const learnerTab = tabs[1];

      learnerTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      parentTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(parentTab.classList.contains('role-tab--active')).toBe(true);
      expect(parentTab.getAttribute('aria-selected')).toBe('true');
      expect(learnerTab.classList.contains('role-tab--active')).toBe(false);
      expect(learnerTab.getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('onRoleSelected callback', () => {
    it('fires with "parent" when Parent tab is clicked', () => {
      const onRoleSelected = vi.fn();
      const container = createRoleTabs({ onRoleSelected });
      const tabs = container.querySelectorAll('.role-tab');

      tabs[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onRoleSelected).toHaveBeenCalledWith('parent');
    });

    it('fires with "student" when Learner tab is clicked', () => {
      const onRoleSelected = vi.fn();
      const container = createRoleTabs({ onRoleSelected });
      const tabs = container.querySelectorAll('.role-tab');

      tabs[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onRoleSelected).toHaveBeenCalledWith('student');
    });
  });

  describe('custom defaultRole', () => {
    it('defaultRole="student" makes "Learner" tab start active', () => {
      const container = createRoleTabs({ defaultRole: 'student', onRoleSelected: vi.fn() });
      const tabs = container.querySelectorAll('.role-tab');
      const parentTab = tabs[0];
      const learnerTab = tabs[1];

      expect(learnerTab.classList.contains('role-tab--active')).toBe(true);
      expect(learnerTab.getAttribute('aria-selected')).toBe('true');
      expect(parentTab.classList.contains('role-tab--active')).toBe(false);
      expect(parentTab.getAttribute('aria-selected')).toBe('false');
    });
  });
});
