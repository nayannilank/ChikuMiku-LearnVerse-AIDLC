/**
 * @vitest-environment jsdom
 */
/**
 * Property Tests: Subject Landing View
 *
 * Feature: end-to-end-ui-integration, Property 6: Language-Subject Conditional Exercise Links
 * Feature: end-to-end-ui-integration, Property 7: Subject Landing Page Content Rendering
 *
 * **Validates: Requirements 5.4, 6.3, 13.2, 13.3, 13.4, 7.3, 8.3, 9.3, 10.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getExerciseLinksForSubject,
  createSubjectLandingView,
} from './SubjectLandingView';

// --- Constants ---

const LANGUAGE_SUBJECTS = ['kannada', 'hindi', 'english'];

// --- Arbitraries ---

/** Generates a language subject name in any casing */
const languageSubjectArb = fc
  .constantFrom(...LANGUAGE_SUBJECTS)
  .chain((name) =>
    fc.constantFrom(
      name,
      name.toUpperCase(),
      name.charAt(0).toUpperCase() + name.slice(1),
      name.split('').map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c)).join('')
    )
  );

/** Generates a non-language subject name — random strings that aren't language/maths/computers/evs */
const nonLanguageSubjectArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => {
    const lower = s.toLowerCase();
    return (
      !LANGUAGE_SUBJECTS.includes(lower) &&
      lower !== 'maths' &&
      lower !== 'computers' &&
      lower !== 'evs'
    );
  });

/** Generates any arbitrary subject name (including known categories and random strings) */
const anySubjectNameArb = fc.oneof(
  languageSubjectArb,
  fc.constant('maths'),
  fc.constant('Maths'),
  fc.constant('MATHS'),
  fc.constant('computers'),
  fc.constant('Computers'),
  fc.constant('COMPUTERS'),
  fc.constant('evs'),
  fc.constant('EVS'),
  fc.constant('Evs'),
  nonLanguageSubjectArb
);

/** Generates a valid hex color string */
const colorArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);

/** Generates a subject icon (emoji or single character) */
const iconArb = fc.constantFrom('📚', '🎨', '🔬', '📐', '🖥️', '🌿', '🎙️', '📝', '⏱️', '🎉', 'A', '★');

/** Generates a progress percentage (0-100) */
const progressArb = fc.double({ min: 0, max: 100, noNaN: true });

/** Generates a subject ID */
const subjectIdArb = fc.string({ minLength: 1, maxLength: 36 }).filter((s) => s.trim().length > 0);

// --- Property 6: Language-Subject Conditional Exercise Links ---

describe('Feature: end-to-end-ui-integration, Property 6: Language-Subject Conditional Exercise Links', () => {
  it('Pronunciation Practice and Grammar Exercises links appear if and only if subject is a language subject', () => {
    fc.assert(
      fc.property(anySubjectNameArb, (subjectName) => {
        const links = getExerciseLinksForSubject(subjectName);
        const labels = links.map((l) => l.label);

        const hasPronunciation = labels.includes('Pronunciation Practice');
        const hasGrammar = labels.includes('Grammar Exercises');
        const isLanguage = LANGUAGE_SUBJECTS.includes(subjectName.toLowerCase());

        // "if and only if" — both directions
        expect(hasPronunciation).toBe(isLanguage);
        expect(hasGrammar).toBe(isLanguage);
      }),
      { numRuns: 200 }
    );
  });

  it('language subjects always produce exactly Pronunciation, Grammar, Quiz, and Content Ingestion links', () => {
    fc.assert(
      fc.property(languageSubjectArb, (subjectName) => {
        const links = getExerciseLinksForSubject(subjectName);
        const labels = links.map((l) => l.label);

        expect(labels).toEqual([
          'Pronunciation Practice',
          'Grammar Exercises',
          'Take Quiz',
          'Content Ingestion',
        ]);
      }),
      { numRuns: 100 }
    );
  });

  it('non-language subjects never include Pronunciation or Grammar links', () => {
    fc.assert(
      fc.property(nonLanguageSubjectArb, (subjectName) => {
        const links = getExerciseLinksForSubject(subjectName);
        const labels = links.map((l) => l.label);

        expect(labels).not.toContain('Pronunciation Practice');
        expect(labels).not.toContain('Grammar Exercises');
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 7: Subject Landing Page Content Rendering ---

describe('Feature: end-to-end-ui-integration, Property 7: Subject Landing Page Content Rendering', () => {
  it('exercise links match subject category for any subject name', () => {
    fc.assert(
      fc.property(anySubjectNameArb, (subjectName) => {
        const links = getExerciseLinksForSubject(subjectName);
        const labels = links.map((l) => l.label);
        const lower = subjectName.toLowerCase();

        if (LANGUAGE_SUBJECTS.includes(lower)) {
          expect(labels).toEqual([
            'Pronunciation Practice',
            'Grammar Exercises',
            'Take Quiz',
            'Content Ingestion',
          ]);
        } else if (lower === 'maths') {
          expect(labels).toEqual(['Maths Practice', 'Take Quiz', 'Content Ingestion']);
        } else if (lower === 'computers') {
          expect(labels).toEqual(['Computers Exercises', 'Take Quiz', 'Content Ingestion']);
        } else if (lower === 'evs') {
          expect(labels).toEqual(['EVS Visualizations', 'Take Quiz', 'Content Ingestion']);
        } else {
          expect(labels).toEqual(['Take Quiz', 'Content Ingestion']);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('subject name, icon, color indicator, and progress percentage are all rendered in the view', () => {
    fc.assert(
      fc.property(
        anySubjectNameArb,
        subjectIdArb,
        colorArb,
        iconArb,
        progressArb,
        (subjectName, subjectId, color, icon, progressPercent) => {
          const view = createSubjectLandingView(subjectName, subjectId, color, icon, progressPercent);

          // Subject name is rendered
          const nameEl = view.querySelector('.subject-landing-view__name');
          expect(nameEl).not.toBeNull();
          expect(nameEl!.textContent).toBe(subjectName);

          // Icon is rendered
          const iconEl = view.querySelector('.subject-landing-view__icon');
          expect(iconEl).not.toBeNull();
          expect(iconEl!.textContent).toBe(icon);

          // Color indicator: icon element uses the subject color in its border style
          // jsdom normalizes hex colors to rgb(); verify the border style is set
          const iconStyle = (iconEl as HTMLElement).style;
          expect(iconStyle.border).toContain('solid');
          expect(iconStyle.borderColor).toBeTruthy();

          // Progress percentage is rendered
          const progressLabel = view.querySelector('.subject-landing-view__progress-label');
          expect(progressLabel).not.toBeNull();
          expect(progressLabel!.textContent).toBe(`${Math.round(progressPercent)}%`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the rendered view contains exactly the correct exercise link cards for the subject category', () => {
    fc.assert(
      fc.property(
        anySubjectNameArb,
        subjectIdArb,
        colorArb,
        iconArb,
        progressArb,
        (subjectName, subjectId, color, icon, progressPercent) => {
          const view = createSubjectLandingView(subjectName, subjectId, color, icon, progressPercent);

          // Get expected links
          const expectedLinks = getExerciseLinksForSubject(subjectName);
          const expectedLabels = expectedLinks.map((l) => l.label);

          // Get rendered exercise cards
          const cards = view.querySelectorAll('.subject-landing-view__exercise-card');
          const renderedLabels = Array.from(cards).map((card) => {
            // The label is the second span child (after icon span)
            const spans = card.querySelectorAll('span');
            return spans[spans.length - 1]?.textContent ?? '';
          });

          expect(renderedLabels).toEqual(expectedLabels);
          expect(cards.length).toBe(expectedLinks.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
