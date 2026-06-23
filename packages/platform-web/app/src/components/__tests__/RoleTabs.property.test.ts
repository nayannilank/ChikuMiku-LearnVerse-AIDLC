/**
 * @vitest-environment happy-dom
 */
/**
 * Property Tests: Role Tab Mutual Exclusivity
 *
 * Feature: auth-screens-redesign, Property 1: Role Tab Mutual Exclusivity
 *
 * For any sequence of role tab selections (Parent or Learner, in any order
 * and any count), exactly one tab SHALL have the active visual state at any
 * point in time, and the other tab SHALL be in the inactive state.
 *
 * **Validates: Requirements 3.4, 3.5**
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { createRoleTabs } from '../RoleTabs';

describe('Property 1: Role Tab Mutual Exclusivity', () => {
  /**
   * **Validates: Requirements 3.4, 3.5**
   *
   * For any sequence of role selections from ['parent', 'student'],
   * after each selection exactly one tab has the active CSS class
   * `role-tab--active` and the other tab does not.
   */
  it('exactly one tab has active CSS class after each selection in any sequence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('parent', 'student'), { minLength: 1, maxLength: 50 }),
        (selections) => {
          const container = createRoleTabs({
            onRoleSelected: vi.fn(),
          });

          // Verify initial state: exactly one tab is active (default "parent")
          const allTabs = container.querySelectorAll('.role-tab');
          expect(allTabs.length).toBe(2);

          const initialActive = container.querySelectorAll('.role-tab--active');
          expect(initialActive.length).toBe(1);

          // Apply each selection in sequence and verify mutual exclusivity
          for (const role of selections) {
            const targetTab = container.querySelector(
              `.role-tab[data-role="${role}"]`
            ) as HTMLButtonElement;
            expect(targetTab).not.toBeNull();

            // Simulate click
            targetTab.dispatchEvent(new Event('click', { bubbles: true }));

            // Assert: exactly one tab has the active class
            const activeTabs = container.querySelectorAll('.role-tab--active');
            expect(activeTabs.length).toBe(1);

            // Assert: the active tab is the one we just clicked
            const activeTab = activeTabs[0] as HTMLElement;
            expect(activeTab.getAttribute('data-role')).toBe(role);

            // Assert: the other tab does NOT have the active class
            const otherRole = role === 'parent' ? 'student' : 'parent';
            const otherTab = container.querySelector(
              `.role-tab[data-role="${otherRole}"]`
            ) as HTMLElement;
            expect(otherTab.classList.contains('role-tab--active')).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
