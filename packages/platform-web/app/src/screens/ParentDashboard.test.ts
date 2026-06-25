/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ParentDashboard, type ParentDashboardProps, type Learner } from './ParentDashboard';

// ============================================================
// Test Helpers
// ============================================================

let activeRoot: Root | null = null;

function render(props: Partial<ParentDashboardProps> = {}): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const defaultProps: ParentDashboardProps = {
    learners: [],
    availableSubjects: ['Maths', 'Science', 'English', 'Hindi', 'Kannada', 'Computers', 'EVS'],
    onRegisterStudent: vi.fn(),
    onUpdateSubjects: vi.fn().mockResolvedValue(undefined),
    ...props,
  };

  activeRoot = createRoot(container);
  const element = React.createElement(ParentDashboard, defaultProps);

  flushSync(() => {
    activeRoot!.render(element);
  });

  return container;
}

/** Wraps a user interaction to ensure React processes the state update synchronously */
function act(fn: () => void) {
  flushSync(fn);
}

function cleanup(container: HTMLElement) {
  if (activeRoot) {
    flushSync(() => { activeRoot!.unmount(); });
    activeRoot = null;
  }
  document.body.removeChild(container);
}

function createMockLearners(): Learner[] {
  return [
    {
      id: 'learner-1',
      name: 'Aarav',
      grade: 'Fifth',
      subjects: ['Maths', 'Science', 'English'],
      progress: [
        { subjectName: 'Maths', progressPercent: 72, streak: 5, recentActivity: 'Completed Chapter 3 quiz' },
        { subjectName: 'Science', progressPercent: 45, streak: 2, recentActivity: 'Watched video on plants' },
        { subjectName: 'English', progressPercent: 88, streak: 10, recentActivity: 'Grammar exercise done' },
      ],
    },
    {
      id: 'learner-2',
      name: 'Priya',
      grade: 'Third',
      subjects: ['Maths', 'Hindi', 'EVS'],
      progress: [
        { subjectName: 'Maths', progressPercent: 60, streak: 3, recentActivity: 'Addition practice' },
        { subjectName: 'Hindi', progressPercent: 30, streak: 1, recentActivity: 'Letter tracing' },
        { subjectName: 'EVS', progressPercent: 50, streak: 4, recentActivity: 'Weather chapter' },
      ],
    },
  ];
}

async function tick() {
  await new Promise((r) => setTimeout(r, 0));
}

// ============================================================
// Tests
// ============================================================

describe('ParentDashboard', () => {
  describe('Empty State (Req 22.5)', () => {
    it('displays empty state prompt when no learners are registered', () => {
      const container = render({ learners: [] });

      const text = container.textContent ?? '';
      expect(text).toContain('No learners yet — register your first student!');

      cleanup(container);
    });

    it('displays Register Student button in empty state', () => {
      const onRegisterStudent = vi.fn();
      const container = render({ learners: [], onRegisterStudent });

      const buttons = container.querySelectorAll('button');
      const registerBtns = Array.from(buttons).filter(
        (btn) => btn.textContent === 'Register Student'
      );
      // Should have at least one Register Student button in empty state
      expect(registerBtns.length).toBeGreaterThan(0);

      cleanup(container);
    });
  });

  describe('Learner List (Req 22.2)', () => {
    it('displays learner names and grades', () => {
      const learners = createMockLearners();
      const container = render({ learners });

      const text = container.textContent ?? '';
      expect(text).toContain('Aarav');
      expect(text).toContain('Fifth');
      expect(text).toContain('Priya');
      expect(text).toContain('Third');

      cleanup(container);
    });

    it('displays Register Student button in header (Req 22.4)', () => {
      const learners = createMockLearners();
      const container = render({ learners });

      const buttons = container.querySelectorAll('button');
      const registerBtn = Array.from(buttons).find(
        (btn) => btn.textContent === 'Register Student'
      );
      expect(registerBtn).not.toBeUndefined();

      cleanup(container);
    });

    it('calls onRegisterStudent when Register Student button is clicked', () => {
      const onRegisterStudent = vi.fn();
      const learners = createMockLearners();
      const container = render({ learners, onRegisterStudent });

      const buttons = container.querySelectorAll('button');
      const registerBtn = Array.from(buttons).find(
        (btn) => btn.textContent === 'Register Student'
      );
      registerBtn?.click();

      expect(onRegisterStudent).toHaveBeenCalledTimes(1);

      cleanup(container);
    });
  });

  describe('Learner Progress View (Req 22.3)', () => {
    it('shows student progress when learner is tapped', () => {
      const learners = createMockLearners();
      const container = render({ learners });

      // Click on the first learner card
      const listItems = container.querySelectorAll('[role="listitem"]');
      expect(listItems.length).toBe(2);

      act(() => { (listItems[0] as HTMLElement).click(); });

      // Should show progress view with subject cards
      const text = container.textContent ?? '';
      expect(text).toContain('Aarav');
      expect(text).toContain('Progress');
      expect(text).toContain('Maths');
      expect(text).toContain('72%');
      expect(text).toContain('5 day streak');
      expect(text).toContain('Completed Chapter 3 quiz');

      cleanup(container);
    });

    it('shows Back button in progress view to return to list', () => {
      const learners = createMockLearners();
      const container = render({ learners });

      // Navigate to progress view
      const listItems = container.querySelectorAll('[role="listitem"]');
      act(() => { (listItems[0] as HTMLElement).click(); });

      // Find back button
      const backBtn = container.querySelector('[aria-label="Back to learner list"]') as HTMLElement;
      expect(backBtn).not.toBeNull();

      // Click back
      act(() => { backBtn.click(); });

      // Should be back at list view
      const text = container.textContent ?? '';
      expect(text).toContain('Parent Dashboard');
      expect(text).toContain('Aarav');
      expect(text).toContain('Priya');

      cleanup(container);
    });
  });

  describe('Edit Subjects Dialog (Req 22.6, 22.7)', () => {
    it('opens Edit Subjects dialog when button is clicked', () => {
      const learners = createMockLearners();
      const container = render({ learners });

      // Find Edit Subjects button for first learner
      const editBtns = container.querySelectorAll('[aria-label^="Edit subjects for"]');
      expect(editBtns.length).toBe(2);

      act(() => { (editBtns[0] as HTMLElement).click(); });

      // Dialog should be open
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();

      const dialogText = dialog?.textContent ?? '';
      expect(dialogText).toContain('Edit Subjects');
      expect(dialogText).toContain('Aarav');

      cleanup(container);
    });

    it('shows checkboxes for all available subjects', () => {
      const learners = createMockLearners();
      const availableSubjects = ['Maths', 'Science', 'English', 'Hindi', 'Kannada', 'Computers', 'EVS'];
      const container = render({ learners, availableSubjects });

      // Open dialog
      const editBtns = container.querySelectorAll('[aria-label^="Edit subjects for"]');
      act(() => { (editBtns[0] as HTMLElement).click(); });

      const dialog = container.querySelector('[role="dialog"]');
      const checkboxes = dialog?.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes?.length).toBe(7);

      cleanup(container);
    });

    it('pre-checks currently assigned subjects', () => {
      const learners = createMockLearners();
      const availableSubjects = ['Maths', 'Science', 'English', 'Hindi', 'Kannada', 'Computers', 'EVS'];
      const container = render({ learners, availableSubjects });

      // Open dialog for Aarav (subjects: Maths, Science, English)
      const editBtns = container.querySelectorAll('[aria-label^="Edit subjects for"]');
      act(() => { (editBtns[0] as HTMLElement).click(); });

      const dialog = container.querySelector('[role="dialog"]');
      const checkboxes = dialog?.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;

      const checkedLabels: string[] = [];
      checkboxes.forEach((cb) => {
        if (cb.checked) {
          checkedLabels.push(cb.getAttribute('aria-label') ?? '');
        }
      });

      expect(checkedLabels).toContain('Maths');
      expect(checkedLabels).toContain('Science');
      expect(checkedLabels).toContain('English');
      expect(checkedLabels).not.toContain('Hindi');

      cleanup(container);
    });

    it('shows error when trying to save with 0 subjects selected (Req 22.7)', () => {
      const learners = createMockLearners();
      const availableSubjects = ['Maths', 'Science', 'English'];
      const container = render({ learners, availableSubjects });

      // Open dialog for Aarav
      const editBtns = container.querySelectorAll('[aria-label^="Edit subjects for"]');
      act(() => { (editBtns[0] as HTMLElement).click(); });

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;

      // Uncheck all subjects
      const checkboxes = dialog.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      act(() => {
        checkboxes.forEach((cb) => {
          if (cb.checked) {
            cb.click();
          }
        });
      });

      // Click Save
      const buttons = dialog.querySelectorAll('button');
      const saveBtnEl = Array.from(buttons).find((b) => b.textContent?.includes('Save'));
      act(() => { saveBtnEl?.click(); });

      // Should show error
      const errorText = dialog.textContent ?? '';
      expect(errorText).toContain('At least one subject must be selected');

      cleanup(container);
    });

    it('closes dialog when Cancel is clicked', () => {
      const learners = createMockLearners();
      const container = render({ learners });

      // Open dialog
      const editBtns = container.querySelectorAll('[aria-label^="Edit subjects for"]');
      act(() => { (editBtns[0] as HTMLElement).click(); });

      // Verify dialog is open
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();

      // Click Cancel
      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      const buttons = dialog.querySelectorAll('button');
      const cancelBtn = Array.from(buttons).find((b) => b.textContent === 'Cancel');
      act(() => { cancelBtn?.click(); });

      // Dialog should be closed
      expect(container.querySelector('[role="dialog"]')).toBeNull();

      cleanup(container);
    });

    it('calls onUpdateSubjects with selected subjects on save', async () => {
      const onUpdateSubjects = vi.fn().mockResolvedValue(undefined);
      const learners = createMockLearners();
      const availableSubjects = ['Maths', 'Science', 'English', 'Hindi'];
      const container = render({ learners, availableSubjects, onUpdateSubjects });

      // Open dialog for Aarav
      const editBtns = container.querySelectorAll('[aria-label^="Edit subjects for"]');
      act(() => { (editBtns[0] as HTMLElement).click(); });

      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;

      // Click Save (Aarav has Maths, Science, English pre-selected)
      const buttons = dialog.querySelectorAll('button');
      const saveBtn = Array.from(buttons).find((b) => b.textContent?.includes('Save'));
      act(() => { saveBtn?.click(); });

      await tick();

      expect(onUpdateSubjects).toHaveBeenCalledWith(
        'learner-1',
        ['Maths', 'Science', 'English']
      );

      cleanup(container);
    });
  });

  describe('Loading State', () => {
    it('shows loading text when isLoading is true', () => {
      const container = render({ isLoading: true });

      const text = container.textContent ?? '';
      expect(text).toContain('Loading dashboard...');

      cleanup(container);
    });
  });

  describe('Error State', () => {
    it('displays error message when error prop is provided', () => {
      const learners = createMockLearners();
      const container = render({ learners, error: 'Failed to load data' });

      const text = container.textContent ?? '';
      expect(text).toContain('Failed to load data');

      cleanup(container);
    });
  });
});
