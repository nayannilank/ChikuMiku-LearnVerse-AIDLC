/**
 * Learning Session Workflow.
 *
 * Enforces the subject-first workflow:
 * 1. Learner starts a learning session
 * 2. Learner selects a subject from their enrolled subjects
 * 3. Learner can then select an existing chapter or create a new one
 *
 * This module provides the session state machine that gates chapter access
 * behind subject selection.
 */

import { Chapter } from './types';
import {
  getEnrollmentState,
  listEnrolledSubjects,
  getChaptersForSubject,
  switchActiveSubject,
  EnrollmentResult,
} from './enrollment';

// --- Session Step ---

/**
 * Represents the current step in the learning workflow.
 * - 'subject_selection': Learner must choose a subject
 * - 'chapter_selection': Learner has chosen a subject, now picks a chapter or creates one
 * - 'learning': Learner is actively working within a chapter
 */
export type LearningStep = 'subject_selection' | 'chapter_selection' | 'learning';

// --- Learning Session ---

/**
 * Represents an active learning session with workflow state.
 */
export interface LearningSession {
  learnerId: string;
  currentStep: LearningStep;
  selectedSubjectId: string | null;
  selectedChapterId: string | null;
  startedAt: Date;
  availableSubjects: Array<{ subjectId: string; enrolledAt: Date }>;
  availableChapters: Chapter[];
}

// --- Error Types ---

export interface LearningSessionError {
  code: string;
  message: string;
}

export interface LearningSessionSuccess<T> {
  success: true;
  value: T;
}

export interface LearningSessionFailure {
  success: false;
  error: LearningSessionError;
}

export type LearningSessionResult<T> = LearningSessionSuccess<T> | LearningSessionFailure;

// --- In-Memory Session Store ---

const sessionStore = new Map<string, LearningSession>();

/**
 * Clears the session store. Useful for test isolation.
 */
export function clearSessionStore(): void {
  sessionStore.clear();
}

// --- Workflow Operations ---

/**
 * Starts a new learning session for a learner.
 *
 * The session begins at the 'subject_selection' step. The learner must
 * select a subject before they can access chapters.
 *
 * If the learner has no enrolled subjects, returns an error prompting enrollment.
 */
export function startLearningSession(
  learnerId: string,
  now?: Date
): LearningSessionResult<LearningSession> {
  const enrolledSubjects = listEnrolledSubjects(learnerId);

  if (enrolledSubjects.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_SUBJECTS_ENROLLED',
        message: 'You need to enroll in at least one subject before you can start learning.',
      },
    };
  }

  const session: LearningSession = {
    learnerId,
    currentStep: 'subject_selection',
    selectedSubjectId: null,
    selectedChapterId: null,
    startedAt: now ?? new Date(),
    availableSubjects: enrolledSubjects,
    availableChapters: [],
  };

  sessionStore.set(learnerId, session);
  return { success: true, value: session };
}

/**
 * Selects a subject within the current learning session.
 *
 * Transitions the session from 'subject_selection' to 'chapter_selection'.
 * Populates the available chapters for the selected subject.
 *
 * Fails if:
 * - No active session exists
 * - Session is not at the 'subject_selection' or 'chapter_selection' step
 *   (re-selection from chapter_selection is allowed)
 * - The subject is not in the learner's enrolled subjects
 */
export function selectSubject(
  learnerId: string,
  subjectId: string
): LearningSessionResult<LearningSession> {
  const session = sessionStore.get(learnerId);

  if (!session) {
    return {
      success: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'No active learning session. Please start a new session first.',
      },
    };
  }

  // Allow subject selection from subject_selection or chapter_selection (re-pick)
  if (session.currentStep === 'learning') {
    return {
      success: false,
      error: {
        code: 'INVALID_STEP',
        message: 'Cannot change subject while actively learning. End the current chapter first.',
      },
    };
  }

  // Verify the subject is enrolled
  const isEnrolled = session.availableSubjects.some((s) => s.subjectId === subjectId);
  if (!isEnrolled) {
    return {
      success: false,
      error: {
        code: 'SUBJECT_NOT_ENROLLED',
        message: `You are not enrolled in subject "${subjectId}". Please enroll first.`,
      },
    };
  }

  // Switch active subject in enrollment state
  const switchResult = switchActiveSubject(learnerId, subjectId);
  if (!switchResult.success) {
    return {
      success: false,
      error: {
        code: switchResult.error.code,
        message: switchResult.error.message,
      },
    };
  }

  // Get chapters for the selected subject
  const chaptersResult = getChaptersForSubject(learnerId, subjectId);
  const chapters = chaptersResult.success ? chaptersResult.value : [];

  // Update session state
  session.selectedSubjectId = subjectId;
  session.selectedChapterId = null;
  session.currentStep = 'chapter_selection';
  session.availableChapters = chapters;

  return { success: true, value: session };
}

/**
 * Selects a chapter within the current learning session.
 *
 * Transitions the session from 'chapter_selection' to 'learning'.
 *
 * Fails if:
 * - No active session exists
 * - Session is not at the 'chapter_selection' step
 * - The chapter doesn't belong to the selected subject
 */
export function selectChapter(
  learnerId: string,
  chapterId: string
): LearningSessionResult<LearningSession> {
  const session = sessionStore.get(learnerId);

  if (!session) {
    return {
      success: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'No active learning session. Please start a new session first.',
      },
    };
  }

  if (session.currentStep !== 'chapter_selection') {
    return {
      success: false,
      error: {
        code: 'INVALID_STEP',
        message:
          session.currentStep === 'subject_selection'
            ? 'Please select a subject first before choosing a chapter.'
            : 'You are already in a learning session. End the current chapter first.',
      },
    };
  }

  // Verify the chapter belongs to the selected subject
  const chapter = session.availableChapters.find((c) => c.id === chapterId);
  if (!chapter) {
    return {
      success: false,
      error: {
        code: 'CHAPTER_NOT_FOUND',
        message: `Chapter "${chapterId}" not found in the selected subject. Choose from available chapters or create a new one.`,
      },
    };
  }

  // Transition to learning
  session.selectedChapterId = chapterId;
  session.currentStep = 'learning';

  return { success: true, value: session };
}

/**
 * Signals intent to create a new chapter in the selected subject.
 *
 * Transitions the session from 'chapter_selection' to 'learning'.
 * The actual chapter creation is handled by the content-store service;
 * this just advances the workflow state.
 *
 * Fails if:
 * - No active session exists
 * - Session is not at the 'chapter_selection' step
 */
export function startNewChapter(
  learnerId: string
): LearningSessionResult<LearningSession> {
  const session = sessionStore.get(learnerId);

  if (!session) {
    return {
      success: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'No active learning session. Please start a new session first.',
      },
    };
  }

  if (session.currentStep !== 'chapter_selection') {
    return {
      success: false,
      error: {
        code: 'INVALID_STEP',
        message:
          session.currentStep === 'subject_selection'
            ? 'Please select a subject first before creating a chapter.'
            : 'You are already in a learning session. End the current chapter first.',
      },
    };
  }

  // Transition to learning with no specific chapter (new chapter flow)
  session.selectedChapterId = null;
  session.currentStep = 'learning';

  return { success: true, value: session };
}

/**
 * Ends the current learning activity and returns to chapter selection.
 *
 * Allows the learner to pick another chapter or create a new one
 * within the same subject.
 */
export function endCurrentChapter(
  learnerId: string
): LearningSessionResult<LearningSession> {
  const session = sessionStore.get(learnerId);

  if (!session) {
    return {
      success: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'No active learning session.',
      },
    };
  }

  if (session.currentStep !== 'learning') {
    return {
      success: false,
      error: {
        code: 'INVALID_STEP',
        message: 'No active chapter to end.',
      },
    };
  }

  session.selectedChapterId = null;
  session.currentStep = 'chapter_selection';

  // Refresh available chapters (in case a new one was created)
  if (session.selectedSubjectId) {
    const chaptersResult = getChaptersForSubject(learnerId, session.selectedSubjectId);
    session.availableChapters = chaptersResult.success ? chaptersResult.value : [];
  }

  return { success: true, value: session };
}

/**
 * Ends the entire learning session.
 */
export function endLearningSession(learnerId: string): LearningSessionResult<void> {
  if (!sessionStore.has(learnerId)) {
    return {
      success: false,
      error: {
        code: 'NO_ACTIVE_SESSION',
        message: 'No active learning session to end.',
      },
    };
  }

  sessionStore.delete(learnerId);
  return { success: true, value: undefined };
}

/**
 * Gets the current learning session for a learner, if one exists.
 */
export function getCurrentSession(learnerId: string): LearningSession | null {
  return sessionStore.get(learnerId) ?? null;
}

/**
 * Checks whether a learner can access chapter content.
 *
 * Returns true only if the learner has an active session that has
 * progressed past subject selection (i.e., a subject has been chosen).
 * This is the guard that enforces the subject-first workflow.
 */
export function canAccessChapters(learnerId: string): boolean {
  const session = sessionStore.get(learnerId);
  if (!session) return false;
  return session.currentStep === 'chapter_selection' || session.currentStep === 'learning';
}
