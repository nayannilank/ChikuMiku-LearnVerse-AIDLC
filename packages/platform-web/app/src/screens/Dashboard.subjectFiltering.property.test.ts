/**
 * Property Test: Subject Filtering — Only Assigned Subjects Displayed
 *
 * Property 8: For any student with N assigned subjects, the Dashboard SHALL display
 * exactly N subject entries matching only the assigned subjects, with no unassigned
 * subjects appearing.
 *
 * **Validates: Requirements 6.3, 7.1**
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';
import { Dashboard, SubjectCardData } from './Dashboard';

// ============================================================
// Helpers & Arbitraries
// ============================================================

/**
 * Generates a valid hex color string.
 */
const hexColorArb = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`);

/**
 * Generates a valid SubjectCardData item.
 */
const subjectCardArb: fc.Arbitrary<SubjectCardData> = fc.record({
  subjectId: fc.uuid(),
  subjectName: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  color: hexColorArb,
  iconName: fc.constantFrom('kannada', 'english', 'hindi', 'maths', 'computers', 'evs', 'science'),
  progressPercentage: fc.integer({ min: 0, max: 100 }),
});

/**
 * Generates a unique list of SubjectCardData with distinct subjectIds.
 */
const subjectListArb = (minLength: number, maxLength: number) =>
  fc
    .uniqueArray(subjectCardArb, {
      minLength,
      maxLength,
      selector: (s) => s.subjectId,
    });

// ============================================================
// Test Container Management
// ============================================================

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function setupContainer(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  return container;
}

function cleanupContainer(): void {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
}

afterEach(() => {
  cleanupContainer();
});

/**
 * Renders the Dashboard with given subjects and waits for subjects to load.
 * Returns the container for assertions.
 */
async function renderDashboardWithSubjects(
  subjects: SubjectCardData[],
): Promise<HTMLDivElement> {
  const el = setupContainer();

  await act(async () => {
    root!.render(
      React.createElement(Dashboard, {
        studentName: 'Test Student',
        fetchStreak: () => Promise.resolve(5),
        fetchSubjects: () => Promise.resolve(subjects),
        onSubjectSelect: () => {},
        currentDate: new Date(2024, 0, 15),
      }),
    );
  });

  // Allow async useEffect to resolve
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  return el;
}

/**
 * Gets all rendered subject cards from the container.
 * Subject cards have role="button" and class "dashboard-subject-card".
 */
function getRenderedSubjectCards(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll('.dashboard-subject-card'));
}

/**
 * Extracts subject names from rendered cards.
 */
function getRenderedSubjectNames(el: HTMLElement): string[] {
  const cards = getRenderedSubjectCards(el);
  return cards.map((card) => {
    const nameEl = card.querySelector('p');
    return nameEl?.textContent ?? '';
  });
}

// ============================================================
// Property Tests
// ============================================================

describe('Property 8: Subject Filtering — Only Assigned Subjects Displayed', () => {
  it('renders exactly N subject cards for N assigned subjects (1-7)', async () => {
    await fc.assert(
      fc.asyncProperty(subjectListArb(1, 7), async (subjects) => {
        const el = await renderDashboardWithSubjects(subjects);
        const cards = getRenderedSubjectCards(el);

        expect(cards.length).toBe(subjects.length);

        cleanupContainer();
      }),
      { numRuns: 30 },
    );
  });

  it('rendered subject cards contain only subjects from the assigned set (no extras)', async () => {
    await fc.assert(
      fc.asyncProperty(subjectListArb(1, 7), async (subjects) => {
        const el = await renderDashboardWithSubjects(subjects);
        const renderedNames = getRenderedSubjectNames(el);
        const assignedNames = subjects.map((s) => s.subjectName);

        // Every rendered name must be in the assigned set
        for (const name of renderedNames) {
          expect(assignedNames).toContain(name);
        }

        cleanupContainer();
      }),
      { numRuns: 30 },
    );
  });

  it('every assigned subject appears exactly once in the rendered output', async () => {
    await fc.assert(
      fc.asyncProperty(subjectListArb(1, 7), async (subjects) => {
        const el = await renderDashboardWithSubjects(subjects);
        const renderedNames = getRenderedSubjectNames(el);
        const assignedNames = subjects.map((s) => s.subjectName);

        // Each assigned subject name should appear exactly once
        for (const name of assignedNames) {
          const count = renderedNames.filter((n) => n === name).length;
          expect(count).toBe(1);
        }

        cleanupContainer();
      }),
      { numRuns: 30 },
    );
  });

  it('empty subject list (0 assigned) renders 0 subject cards', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant([]), async (subjects: SubjectCardData[]) => {
        const el = await renderDashboardWithSubjects(subjects);
        const cards = getRenderedSubjectCards(el);

        expect(cards.length).toBe(0);

        cleanupContainer();
      }),
      { numRuns: 5 },
    );
  });
});
