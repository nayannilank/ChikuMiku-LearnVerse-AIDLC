/**
 * Multi-subject enrollment and isolation service.
 *
 * Manages subject enrollment for learners with:
 * - Maximum 10 subjects per learner
 * - Isolated content/progress space per subject
 * - Operations on one subject don't affect others
 * - Subject selection interface (switch between enrolled subjects)
 *
 * Requirements: 10.1, 10.2, 10.6
 */

import { Learner, ProgressRecord, Chapter, ActivityScore } from './types';

// --- Constants ---

/** Maximum number of subjects a learner can enroll in */
export const MAX_ENROLLED_SUBJECTS = 10;

// --- Error Types ---

export interface EnrollmentError {
  code: string;
  message: string;
}

export interface EnrollmentSuccess<T> {
  success: true;
  value: T;
}

export interface EnrollmentFailure {
  success: false;
  error: EnrollmentError;
}

export type EnrollmentResult<T> = EnrollmentSuccess<T> | EnrollmentFailure;

// --- Subject Space ---

/**
 * Represents an isolated content and progress space for a single subject.
 * Each enrolled subject has its own partition of data that is independent
 * of all other subjects (Requirement 10.2).
 */
export interface SubjectSpace {
  subjectId: string;
  enrolledAt: Date;
  chapters: Chapter[];
  progressRecords: ProgressRecord[];
  activeChapterId: string | null;
}

// --- Enrollment State ---

/**
 * Represents the complete enrollment state for a learner.
 * Tracks all enrolled subjects and the currently active subject.
 */
export interface EnrollmentState {
  learnerId: string;
  subjects: Map<string, SubjectSpace>;
  activeSubjectId: string | null;
}

// --- In-Memory Store ---

const enrollmentStore = new Map<string, EnrollmentState>();

/**
 * Clears the enrollment store. Useful for test isolation.
 */
export function clearEnrollmentStore(): void {
  enrollmentStore.clear();
}

// --- Enrollment State Management ---

/**
 * Gets or creates the enrollment state for a learner.
 */
export function getEnrollmentState(learnerId: string): EnrollmentState {
  let state = enrollmentStore.get(learnerId);
  if (!state) {
    state = {
      learnerId,
      subjects: new Map(),
      activeSubjectId: null,
    };
    enrollmentStore.set(learnerId, state);
  }
  return state;
}

/**
 * Initializes enrollment state from an existing Learner object.
 * Useful for hydrating state from a persisted learner record.
 */
export function initializeFromLearner(learner: Learner): EnrollmentState {
  const state = getEnrollmentState(learner.id);

  // Hydrate any subjects from the learner's enrolledSubjects that aren't already tracked
  for (const subjectId of learner.enrolledSubjects) {
    if (!state.subjects.has(subjectId)) {
      state.subjects.set(subjectId, {
        subjectId,
        enrolledAt: new Date(),
        chapters: [],
        progressRecords: [],
        activeChapterId: null,
      });
    }
  }

  // Set active subject to first enrolled if none is active
  if (state.activeSubjectId === null && state.subjects.size > 0) {
    state.activeSubjectId = state.subjects.keys().next().value ?? null;
  }

  return state;
}

// --- Enrollment Operations ---

/**
 * Enrolls a learner in a new subject.
 *
 * - Enforces the 10-subject maximum (Requirement 10.1)
 * - Creates an isolated content/progress space (Requirement 10.2)
 * - Does not affect any other enrolled subject's data
 *
 * Returns the updated enrollment state on success.
 */
export function enrollSubject(
  learnerId: string,
  subjectId: string,
  now?: Date
): EnrollmentResult<EnrollmentState> {
  const state = getEnrollmentState(learnerId);

  // Check if already enrolled
  if (state.subjects.has(subjectId)) {
    return {
      success: false,
      error: {
        code: 'ALREADY_ENROLLED',
        message: `Learner is already enrolled in subject: ${subjectId}`,
      },
    };
  }

  // Enforce 10-subject limit (Requirement 10.1)
  if (state.subjects.size >= MAX_ENROLLED_SUBJECTS) {
    return {
      success: false,
      error: {
        code: 'MAX_SUBJECTS_REACHED',
        message: `Cannot enroll in more than ${MAX_ENROLLED_SUBJECTS} subjects`,
      },
    };
  }

  // Create isolated subject space (Requirement 10.2)
  const subjectSpace: SubjectSpace = {
    subjectId,
    enrolledAt: now ?? new Date(),
    chapters: [],
    progressRecords: [],
    activeChapterId: null,
  };

  state.subjects.set(subjectId, subjectSpace);

  // If this is the first subject, make it active
  if (state.activeSubjectId === null) {
    state.activeSubjectId = subjectId;
  }

  return { success: true, value: state };
}

/**
 * Removes a subject enrollment from a learner.
 *
 * - Removes the subject's isolated space (content and progress)
 * - Does not affect any other enrolled subject's data (Requirement 10.1)
 * - Updates active subject if the removed subject was active
 */
export function unenrollSubject(
  learnerId: string,
  subjectId: string
): EnrollmentResult<EnrollmentState> {
  const state = getEnrollmentState(learnerId);

  if (!state.subjects.has(subjectId)) {
    return {
      success: false,
      error: {
        code: 'NOT_ENROLLED',
        message: `Learner is not enrolled in subject: ${subjectId}`,
      },
    };
  }

  // Remove the subject space entirely
  state.subjects.delete(subjectId);

  // If the removed subject was active, switch to another or null
  if (state.activeSubjectId === subjectId) {
    const remaining = state.subjects.keys().next().value;
    state.activeSubjectId = remaining ?? null;
  }

  return { success: true, value: state };
}

// --- Subject Selection Interface (Requirement 10.6) ---

/**
 * Switches the active subject for a learner.
 * The active subject determines which content/progress is displayed.
 *
 * Requirement 10.6: Subject selection interface allowing switch
 * between enrolled subjects within a single tap or click.
 */
export function switchActiveSubject(
  learnerId: string,
  subjectId: string
): EnrollmentResult<EnrollmentState> {
  const state = getEnrollmentState(learnerId);

  if (!state.subjects.has(subjectId)) {
    return {
      success: false,
      error: {
        code: 'NOT_ENROLLED',
        message: `Cannot switch to subject "${subjectId}": not enrolled`,
      },
    };
  }

  state.activeSubjectId = subjectId;
  return { success: true, value: state };
}

/**
 * Gets the currently active subject space for a learner.
 * Returns null if no subject is active.
 */
export function getActiveSubjectSpace(learnerId: string): SubjectSpace | null {
  const state = getEnrollmentState(learnerId);
  if (state.activeSubjectId === null) {
    return null;
  }
  return state.subjects.get(state.activeSubjectId) ?? null;
}

/**
 * Lists all enrolled subjects for a learner.
 * Returns subject IDs and their enrollment dates.
 */
export function listEnrolledSubjects(
  learnerId: string
): Array<{ subjectId: string; enrolledAt: Date }> {
  const state = getEnrollmentState(learnerId);
  const result: Array<{ subjectId: string; enrolledAt: Date }> = [];
  for (const space of state.subjects.values()) {
    result.push({ subjectId: space.subjectId, enrolledAt: space.enrolledAt });
  }
  return result;
}

// --- Isolated Content Operations ---

/**
 * Adds a chapter to a specific subject's isolated space.
 * Does not affect any other subject's chapters (Requirement 10.1).
 */
export function addChapterToSubject(
  learnerId: string,
  subjectId: string,
  chapter: Chapter
): EnrollmentResult<SubjectSpace> {
  const state = getEnrollmentState(learnerId);
  const space = state.subjects.get(subjectId);

  if (!space) {
    return {
      success: false,
      error: {
        code: 'NOT_ENROLLED',
        message: `Learner is not enrolled in subject: ${subjectId}`,
      },
    };
  }

  // Validate chapter belongs to this subject
  if (chapter.subjectId !== subjectId) {
    return {
      success: false,
      error: {
        code: 'SUBJECT_MISMATCH',
        message: `Chapter subject "${chapter.subjectId}" does not match target subject "${subjectId}"`,
      },
    };
  }

  space.chapters.push(chapter);
  return { success: true, value: space };
}

/**
 * Gets chapters for a specific subject only.
 * Returns only the chapters in that subject's isolated space (Requirement 10.2).
 */
export function getChaptersForSubject(
  learnerId: string,
  subjectId: string
): EnrollmentResult<Chapter[]> {
  const state = getEnrollmentState(learnerId);
  const space = state.subjects.get(subjectId);

  if (!space) {
    return {
      success: false,
      error: {
        code: 'NOT_ENROLLED',
        message: `Learner is not enrolled in subject: ${subjectId}`,
      },
    };
  }

  return { success: true, value: [...space.chapters] };
}

// --- Isolated Progress Operations ---

/**
 * Records progress for a specific subject's chapter.
 * Does not affect any other subject's progress (Requirement 10.1).
 */
export function recordProgressForSubject(
  learnerId: string,
  subjectId: string,
  progress: ProgressRecord
): EnrollmentResult<SubjectSpace> {
  const state = getEnrollmentState(learnerId);
  const space = state.subjects.get(subjectId);

  if (!space) {
    return {
      success: false,
      error: {
        code: 'NOT_ENROLLED',
        message: `Learner is not enrolled in subject: ${subjectId}`,
      },
    };
  }

  // Validate progress belongs to this subject
  if (progress.subjectId !== subjectId) {
    return {
      success: false,
      error: {
        code: 'SUBJECT_MISMATCH',
        message: `Progress subject "${progress.subjectId}" does not match target subject "${subjectId}"`,
      },
    };
  }

  // Update existing progress record or add new one
  const existingIndex = space.progressRecords.findIndex(
    (p) => p.chapterId === progress.chapterId
  );

  if (existingIndex >= 0) {
    space.progressRecords[existingIndex] = progress;
  } else {
    space.progressRecords.push(progress);
  }

  return { success: true, value: space };
}

/**
 * Gets progress records for a specific subject only.
 * Returns only the progress in that subject's isolated space (Requirement 10.2).
 */
export function getProgressForSubject(
  learnerId: string,
  subjectId: string
): EnrollmentResult<ProgressRecord[]> {
  const state = getEnrollmentState(learnerId);
  const space = state.subjects.get(subjectId);

  if (!space) {
    return {
      success: false,
      error: {
        code: 'NOT_ENROLLED',
        message: `Learner is not enrolled in subject: ${subjectId}`,
      },
    };
  }

  return { success: true, value: [...space.progressRecords] };
}

/**
 * Gets aggregate progress summaries across all enrolled subjects.
 * Used for the learner's dashboard (Requirement 10.7).
 */
export function getAggregateProgress(
  learnerId: string
): Map<string, { totalChapters: number; averageScore: number; completionPercentage: number }> {
  const state = getEnrollmentState(learnerId);
  const aggregate = new Map<
    string,
    { totalChapters: number; averageScore: number; completionPercentage: number }
  >();

  for (const [subjectId, space] of state.subjects) {
    const totalChapters = space.chapters.length;
    const progressRecords = space.progressRecords;

    let totalScore = 0;
    let scoreCount = 0;
    let totalCompletion = 0;

    for (const record of progressRecords) {
      totalCompletion += record.completionPercentage;
      for (const activity of record.activityScores) {
        totalScore += activity.score;
        scoreCount++;
      }
    }

    const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;
    const completionPercentage =
      progressRecords.length > 0 ? totalCompletion / progressRecords.length : 0;

    aggregate.set(subjectId, {
      totalChapters,
      averageScore,
      completionPercentage,
    });
  }

  return aggregate;
}
