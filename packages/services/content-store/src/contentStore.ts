/**
 * ContentStore - Persistent storage of chapters, progress tracking,
 * revision material organization, and error handling.
 *
 * Implements Tasks 5.1, 5.3, 5.5, 5.7 from the spec.
 */

import type {
  Chapter,
  ActivityScore,
  ActivityType,
  ProgressRecord,
} from '@learnverse/service-core';

// --- Types ---

/** Summary of a chapter for listing purposes */
export interface ChapterSummary {
  id: string;
  subjectId: string;
  textbookName: string;
  chapterNumber: number;
  lastAccessedAt: Date;
  completionPercentage: number;
}

/** Progress summary for a learner, optionally filtered by subject */
export interface ProgressSummary {
  learnerId: string;
  subjectId?: string;
  chapters: ChapterProgressEntry[];
  overallCompletionPercentage: number;
}

/** Progress entry for a single chapter */
export interface ChapterProgressEntry {
  chapterId: string;
  subjectId: string;
  completionPercentage: number;
  activityScores: ActivityScore[];
  weakActivities: ActivityType[];
  lastAccessedAt: Date;
}

/** Activity progress update */
export interface ActivityProgress {
  activityType: ActivityType;
  score: number;
  completedAt: Date;
}

/** Revision options available for a subject */
export interface RevisionOptions {
  subjectId: string;
  isLanguageSubject: boolean;
  comprehension: boolean;
  pronunciation: boolean;
  grammar: boolean;
}

/** Revision material presentation for a chapter */
export interface RevisionMaterial {
  chapter: ChapterSummary;
  options: RevisionOptions;
}

/** Dashboard aggregate progress across all enrolled subjects */
export interface DashboardProgress {
  learnerId: string;
  subjectSummaries: SubjectProgressSummary[];
  overallCompletionPercentage: number;
}

/** Per-subject progress summary for the dashboard */
export interface SubjectProgressSummary {
  subjectId: string;
  chapterCount: number;
  completionPercentage: number;
  lastAccessedAt: Date | null;
}

/** Error response for persistence failures */
export interface ContentStoreError {
  code: string;
  message: string;
  retryable: boolean;
  suggestedAction?: string;
}

/** Result of a save operation */
export type SaveResult =
  | { success: true }
  | { success: false; error: ContentStoreError };

/** Guidance message when no chapters are stored */
export interface NoContentGuidance {
  message: string;
  suggestedAction: string;
}

// --- Constants ---

/** Threshold below which an activity is considered weak */
export const WEAK_ACTIVITY_THRESHOLD = 60;

// --- ContentStore Class ---

/**
 * ContentStore manages chapter persistence, progress tracking,
 * revision material presentation, and error handling.
 *
 * Uses in-memory storage for the core logic. A real implementation
 * would back this with a database/object store.
 */
export class ContentStore {
  private chapters: Map<string, Chapter> = new Map();
  private progressRecords: Map<string, ProgressRecord> = new Map();
  private localRetryQueue: Map<string, Chapter> = new Map();
  private subjectLanguageMap: Map<string, boolean> = new Map();

  /**
   * Register whether a subject is a language subject.
   * This determines which revision options are available.
   */
  registerSubjectType(subjectId: string, isLanguage: boolean): void {
    this.subjectLanguageMap.set(subjectId, isLanguage);
  }

  /**
   * Check if a subject is registered as a language subject.
   */
  isLanguageSubject(subjectId: string): boolean {
    return this.subjectLanguageMap.get(subjectId) ?? false;
  }

  // --- Task 5.1: Chapter Persistence ---

  /**
   * Save a chapter associated with a learner and subject.
   * On failure, retains content locally for retry.
   */
  saveChapter(chapter: Chapter, simulateFailure = false): SaveResult {
    if (simulateFailure) {
      // Retain locally for retry (Task 5.7)
      this.localRetryQueue.set(chapter.id, chapter);
      return {
        success: false,
        error: {
          code: 'PERSISTENCE_FAILURE',
          message: 'Failed to save chapter. Your content has been retained locally.',
          retryable: true,
          suggestedAction: 'Please try saving again. Your content is safe.',
        },
      };
    }

    this.chapters.set(chapter.id, { ...chapter });
    // Remove from retry queue if it was there
    this.localRetryQueue.delete(chapter.id);
    return { success: true };
  }

  /**
   * Retrieve a chapter by ID.
   * Returns null if not found.
   */
  getChapter(chapterId: string): Chapter | null {
    const chapter = this.chapters.get(chapterId);
    if (!chapter) return null;
    // Update last accessed date
    chapter.lastAccessedAt = new Date();
    return { ...chapter };
  }

  /**
   * List chapters for a learner, optionally filtered by subject.
   * Organized by subject, textbook, and chapter number.
   * Retrieval within 3 navigation steps: learner -> subject -> chapter list.
   */
  listChapters(learnerId: string, subjectId?: string): ChapterSummary[] {
    const chapters = Array.from(this.chapters.values()).filter((ch) => {
      if (ch.learnerId !== learnerId) return false;
      if (subjectId && ch.subjectId !== subjectId) return false;
      return true;
    });

    // Organize by subject, textbook, chapter number
    chapters.sort((a, b) => {
      if (a.subjectId !== b.subjectId) return a.subjectId.localeCompare(b.subjectId);
      if (a.textbookName !== b.textbookName) return a.textbookName.localeCompare(b.textbookName);
      return a.chapterNumber - b.chapterNumber;
    });

    return chapters.map((ch) => ({
      id: ch.id,
      subjectId: ch.subjectId,
      textbookName: ch.textbookName,
      chapterNumber: ch.chapterNumber,
      lastAccessedAt: ch.lastAccessedAt,
      completionPercentage: this.getChapterCompletion(learnerId, ch.id),
    }));
  }

  // --- Task 5.3: Progress Tracking ---

  /**
   * Track progress for a learner on a specific chapter activity.
   * Updates completion percentage and individual activity scores.
   */
  trackProgress(
    learnerId: string,
    chapterId: string,
    subjectId: string,
    activity: ActivityProgress
  ): void {
    const key = `${learnerId}:${chapterId}`;
    let record = this.progressRecords.get(key);

    if (!record) {
      record = {
        learnerId,
        chapterId,
        subjectId,
        completionPercentage: 0,
        activityScores: [],
        lastAccessedAt: new Date(),
      };
    }

    // Update or add activity score
    const existingIdx = record.activityScores.findIndex(
      (s) => s.activityType === activity.activityType
    );
    const newScore: ActivityScore = {
      activityType: activity.activityType,
      score: activity.score,
      completedAt: activity.completedAt,
    };

    if (existingIdx >= 0) {
      record.activityScores[existingIdx] = newScore;
    } else {
      record.activityScores.push(newScore);
    }

    // Update last accessed date
    record.lastAccessedAt = activity.completedAt;

    // Recalculate completion percentage
    record.completionPercentage = this.calculateCompletion(
      record.activityScores,
      subjectId
    );

    this.progressRecords.set(key, record);
  }

  /**
   * Get progress for a learner, optionally filtered by subject.
   */
  getProgress(learnerId: string, subjectId?: string): ProgressSummary {
    const entries: ChapterProgressEntry[] = [];

    for (const record of this.progressRecords.values()) {
      if (record.learnerId !== learnerId) continue;
      if (subjectId && record.subjectId !== subjectId) continue;

      entries.push({
        chapterId: record.chapterId,
        subjectId: record.subjectId,
        completionPercentage: record.completionPercentage,
        activityScores: [...record.activityScores],
        weakActivities: this.identifyWeakActivities(record.activityScores),
        lastAccessedAt: record.lastAccessedAt,
      });
    }

    const overallCompletionPercentage =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.completionPercentage, 0) / entries.length
        : 0;

    return {
      learnerId,
      subjectId,
      chapters: entries,
      overallCompletionPercentage,
    };
  }

  /**
   * Identify weak activities (below 60% threshold).
   */
  identifyWeakActivities(scores: ActivityScore[]): ActivityType[] {
    return scores
      .filter((s) => s.score < WEAK_ACTIVITY_THRESHOLD)
      .map((s) => s.activityType);
  }

  /**
   * Calculate completion percentage as proportion of completed activities
   * to total applicable activities for the subject.
   */
  calculateCompletion(scores: ActivityScore[], subjectId: string): number {
    const applicableActivities = this.getApplicableActivities(subjectId);
    if (applicableActivities.length === 0) return 0;

    const completedCount = scores.filter((s) =>
      applicableActivities.includes(s.activityType)
    ).length;

    return Math.round((completedCount / applicableActivities.length) * 100);
  }

  /**
   * Get applicable activity types for a subject.
   * Language subjects have all 4 activity types.
   * Non-language subjects have comprehension and revision only.
   */
  getApplicableActivities(subjectId: string): ActivityType[] {
    if (this.isLanguageSubject(subjectId)) {
      return ['comprehension', 'pronunciation', 'grammar', 'revision'];
    }
    return ['comprehension', 'revision'];
  }

  // --- Task 5.5: Revision Material Presentation ---

  /**
   * Get revision options for a subject.
   * All subjects get comprehension. Language subjects also get pronunciation and grammar.
   */
  getRevisionOptions(subjectId: string): RevisionOptions {
    const isLanguage = this.isLanguageSubject(subjectId);
    return {
      subjectId,
      isLanguageSubject: isLanguage,
      comprehension: true,
      pronunciation: isLanguage,
      grammar: isLanguage,
    };
  }

  /**
   * Present revision materials for a learner's subject.
   * Returns chapters with their available revision options.
   */
  getRevisionMaterials(learnerId: string, subjectId: string): RevisionMaterial[] {
    const chapters = this.listChapters(learnerId, subjectId);
    const options = this.getRevisionOptions(subjectId);

    return chapters.map((chapter) => ({
      chapter,
      options,
    }));
  }

  /**
   * Get aggregate dashboard progress across all enrolled subjects.
   */
  getDashboardProgress(learnerId: string, enrolledSubjects: string[]): DashboardProgress {
    const subjectSummaries: SubjectProgressSummary[] = enrolledSubjects.map((subjectId) => {
      const chapters = this.listChapters(learnerId, subjectId);
      const progress = this.getProgress(learnerId, subjectId);

      const lastAccessed = chapters.length > 0
        ? chapters.reduce((latest, ch) =>
            ch.lastAccessedAt > latest ? ch.lastAccessedAt : latest,
            chapters[0].lastAccessedAt
          )
        : null;

      return {
        subjectId,
        chapterCount: chapters.length,
        completionPercentage: progress.overallCompletionPercentage,
        lastAccessedAt: lastAccessed,
      };
    });

    const overallCompletionPercentage =
      subjectSummaries.length > 0
        ? subjectSummaries.reduce((sum, s) => sum + s.completionPercentage, 0) /
          subjectSummaries.length
        : 0;

    return {
      learnerId,
      subjectSummaries,
      overallCompletionPercentage,
    };
  }

  // --- Task 5.7: Error Handling ---

  /**
   * Retry saving a chapter that previously failed.
   * Retrieves from local retry queue.
   */
  retrySave(chapterId: string, simulateFailure = false): SaveResult {
    const chapter = this.localRetryQueue.get(chapterId);
    if (!chapter) {
      return {
        success: false,
        error: {
          code: 'NOT_IN_RETRY_QUEUE',
          message: 'No locally retained chapter found for retry.',
          retryable: false,
        },
      };
    }
    return this.saveChapter(chapter, simulateFailure);
  }

  /**
   * Get chapters retained locally for retry after save failures.
   */
  getLocalRetryQueue(): Chapter[] {
    return Array.from(this.localRetryQueue.values());
  }

  /**
   * Check if there are chapters stored for a subject.
   * Returns guidance if no chapters exist.
   */
  getNoContentGuidance(learnerId: string, subjectId: string): NoContentGuidance | null {
    const chapters = this.listChapters(learnerId, subjectId);
    if (chapters.length > 0) return null;

    return {
      message: 'No chapters are stored for this subject yet.',
      suggestedAction:
        'Add chapters by uploading or capturing photos of your textbook pages through content ingestion.',
    };
  }

  // --- Private Helpers ---

  private getChapterCompletion(learnerId: string, chapterId: string): number {
    const key = `${learnerId}:${chapterId}`;
    const record = this.progressRecords.get(key);
    return record?.completionPercentage ?? 0;
  }
}
