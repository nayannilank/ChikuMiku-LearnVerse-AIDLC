/**
 * GradeManagement - Grade promotion workflow and academic year notifications.
 *
 * Implements Tasks 13.1 and 13.3 from the spec.
 *
 * - Task 13.1: Grade promotion workflow (Requirements 9.1-9.5)
 * - Task 13.3: Academic year notification (Requirement 9.6)
 */

import type { Grade, GradeArchive } from '@learnverse/service-core';

// --- Types ---

/** Learner profile with grade information */
export interface LearnerProfile {
  learnerId: string;
  currentGrade: Grade;
  parentAccountId?: string;
  enrolledSubjects: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** Cumulative achievement history preserved across grade promotions */
export interface CumulativeHistory {
  learnerId: string;
  totalChaptersCompleted: number;
  overallScoresPerSubject: Record<string, number>;
  revisionSessionCount: number;
  previousGrades: Grade[];
}

/** Content associated with a grade for archival/deletion */
export interface GradeContent {
  learnerId: string;
  grade: Grade;
  chapterIds: string[];
  progressKeys: string[];
  revisionSessionIds: string[];
  totalChaptersCompleted: number;
  overallScoresPerSubject: Record<string, number>;
  revisionSessionCount: number;
}

/** Decision on what to do with previous grade content */
export type ContentDecision = 'keep' | 'delete';

/** Promotion prompt presented to learner/parent */
export interface PromotionPrompt {
  currentGrade: Grade;
  newGrade: Grade;
  message: string;
  requiresDecision: true;
  options: ['keep', 'delete'];
}

/** Deletion confirmation prompt */
export interface DeletionConfirmation {
  grade: Grade;
  message: string;
  requiresExplicitAcknowledgment: true;
  chapterCount: number;
  subjectCount: number;
}

/** Result of a grade promotion operation */
export type PromotionResult =
  | { success: true; newGrade: Grade; archived: boolean; deleted: boolean }
  | { success: false; error: string };

/** Academic year configuration */
export interface AcademicYearConfig {
  learnerId: string;
  academicYearEndDate: Date;
  expectedPromotionDate?: Date;
  parentNotified: boolean;
  notificationSentAt?: Date;
}

/** Notification for parent about upcoming grade promotion */
export interface AcademicYearNotification {
  learnerId: string;
  parentAccountId: string;
  message: string;
  daysUntilYearEnd: number;
  expectedPromotionDate?: Date;
  sentAt: Date;
}

// --- GradeManagementService ---

/**
 * GradeManagementService handles grade promotion workflows and
 * academic year notifications.
 *
 * Uses in-memory storage for core logic. A real implementation
 * would back this with a database.
 */
export class GradeManagementService {
  private profiles: Map<string, LearnerProfile> = new Map();
  private cumulativeHistories: Map<string, CumulativeHistory> = new Map();
  private gradeArchives: Map<string, GradeArchive[]> = new Map();
  private gradeContents: Map<string, GradeContent> = new Map();
  private academicYearConfigs: Map<string, AcademicYearConfig> = new Map();
  private notifications: AcademicYearNotification[] = [];

  // --- Task 13.1: Grade Promotion Workflow ---

  /**
   * Store a learner profile with grade 1-12.
   * Requirement 9.1: Store grade as part of profile.
   */
  setLearnerProfile(profile: LearnerProfile): void {
    this.profiles.set(profile.learnerId, { ...profile });
  }

  /**
   * Get a learner's profile.
   */
  getLearnerProfile(learnerId: string): LearnerProfile | null {
    const profile = this.profiles.get(learnerId);
    return profile ? { ...profile } : null;
  }

  /**
   * Get the current grade for a learner.
   * Requirement 9.1: Grade stored as value 1-12.
   */
  getCurrentGrade(learnerId: string): Grade | null {
    const profile = this.profiles.get(learnerId);
    return profile?.currentGrade ?? null;
  }

  /**
   * Register content associated with a specific grade for a learner.
   * This is used to track what content exists for archival/deletion.
   */
  registerGradeContent(content: GradeContent): void {
    const key = `${content.learnerId}:${content.grade}`;
    this.gradeContents.set(key, { ...content });
  }

  /**
   * Get content associated with a specific grade.
   */
  getGradeContent(learnerId: string, grade: Grade): GradeContent | null {
    const key = `${learnerId}:${grade}`;
    const content = this.gradeContents.get(key);
    return content ? { ...content } : null;
  }

  /**
   * Generate a promotion prompt when grade is being updated.
   * Requirement 9.2: Prompt to keep or delete previous grade content.
   */
  generatePromotionPrompt(learnerId: string, newGrade: Grade): PromotionPrompt | null {
    const profile = this.profiles.get(learnerId);
    if (!profile) return null;

    // Validate new grade is sequential (next grade)
    if (newGrade !== ((profile.currentGrade + 1) as Grade)) return null;
    if (newGrade > 12) return null;

    return {
      currentGrade: profile.currentGrade,
      newGrade,
      message: `You are being promoted from Grade ${profile.currentGrade} to Grade ${newGrade}. Would you like to keep or delete your previous grade's content?`,
      requiresDecision: true,
      options: ['keep', 'delete'],
    };
  }

  /**
   * Generate a deletion confirmation prompt.
   * Requirement 9.3: Require explicit confirmation before permanent deletion.
   */
  generateDeletionConfirmation(learnerId: string, grade: Grade): DeletionConfirmation | null {
    const content = this.getGradeContent(learnerId, grade);
    if (!content) {
      return {
        grade,
        message: `Are you sure you want to permanently delete all content from Grade ${grade}? This action cannot be undone.`,
        requiresExplicitAcknowledgment: true,
        chapterCount: 0,
        subjectCount: 0,
      };
    }

    const subjectCount = Object.keys(content.overallScoresPerSubject).length;

    return {
      grade,
      message: `Are you sure you want to permanently delete all content from Grade ${grade}? This includes ${content.chapterIds.length} chapters across ${subjectCount} subjects. This action cannot be undone.`,
      requiresExplicitAcknowledgment: true,
      chapterCount: content.chapterIds.length,
      subjectCount,
    };
  }

  /**
   * Execute grade promotion with the learner/parent's decision.
   *
   * Requirements:
   * - 9.2: Prompt to keep or delete
   * - 9.3: Require confirmation before deletion
   * - 9.4: Archive kept content in read-only state
   * - 9.5: Reset progress for new grade, preserve cumulative history
   */
  promoteGrade(
    learnerId: string,
    newGrade: Grade,
    decision: ContentDecision,
    deletionConfirmed: boolean = false
  ): PromotionResult {
    const profile = this.profiles.get(learnerId);
    if (!profile) {
      return { success: false, error: 'Learner profile not found.' };
    }

    const currentGrade = profile.currentGrade;

    // Validate new grade is the next sequential grade
    if (newGrade !== ((currentGrade + 1) as Grade)) {
      return { success: false, error: 'New grade must be the next sequential grade.' };
    }

    if (newGrade > 12) {
      return { success: false, error: 'Cannot promote beyond Grade 12.' };
    }

    // If decision is delete, require explicit confirmation
    if (decision === 'delete' && !deletionConfirmed) {
      return {
        success: false,
        error: 'Deletion requires explicit confirmation. Please confirm before proceeding.',
      };
    }

    // Get content for the current grade
    const gradeContent = this.getGradeContent(learnerId, currentGrade);

    // Preserve cumulative history before promotion (Requirement 9.5)
    this.preserveCumulativeHistory(learnerId, currentGrade, gradeContent);

    let archived = false;
    let deleted = false;

    if (decision === 'keep') {
      // Archive content in read-only state (Requirement 9.4)
      this.archiveGradeContent(learnerId, currentGrade, gradeContent);
      archived = true;
    } else {
      // Delete content permanently (Requirement 9.3 - already confirmed)
      this.deleteGradeContent(learnerId, currentGrade);
      deleted = true;
    }

    // Update profile to new grade
    profile.currentGrade = newGrade;
    profile.updatedAt = new Date();
    this.profiles.set(learnerId, profile);

    return { success: true, newGrade, archived, deleted };
  }

  /**
   * Archive grade content in read-only state.
   * Requirement 9.4: Retained content is read-only.
   */
  private archiveGradeContent(
    learnerId: string,
    grade: Grade,
    content: GradeContent | null
  ): void {
    const archive: GradeArchive = {
      learnerId,
      grade,
      archivedAt: new Date(),
      totalChaptersCompleted: content?.totalChaptersCompleted ?? 0,
      overallScoresPerSubject: content?.overallScoresPerSubject ?? {},
      revisionSessionCount: content?.revisionSessionCount ?? 0,
      isReadOnly: true,
    };

    const archives = this.gradeArchives.get(learnerId) ?? [];
    archives.push(archive);
    this.gradeArchives.set(learnerId, archives);
  }

  /**
   * Delete grade content permanently.
   * Only called after explicit confirmation (Requirement 9.3).
   */
  private deleteGradeContent(learnerId: string, grade: Grade): void {
    const key = `${learnerId}:${grade}`;
    this.gradeContents.delete(key);
  }

  /**
   * Preserve cumulative achievement history across grade promotions.
   * Requirement 9.5: Preserve total chapters completed, overall scores, revision count.
   */
  private preserveCumulativeHistory(
    learnerId: string,
    grade: Grade,
    content: GradeContent | null
  ): void {
    let history = this.cumulativeHistories.get(learnerId);

    if (!history) {
      history = {
        learnerId,
        totalChaptersCompleted: 0,
        overallScoresPerSubject: {},
        revisionSessionCount: 0,
        previousGrades: [],
      };
    }

    // Add current grade's achievements to cumulative history
    if (content) {
      history.totalChaptersCompleted += content.totalChaptersCompleted;
      history.revisionSessionCount += content.revisionSessionCount;

      // Merge per-subject scores (average across grades)
      for (const [subject, score] of Object.entries(content.overallScoresPerSubject)) {
        if (history.overallScoresPerSubject[subject] !== undefined) {
          // Average with existing score
          history.overallScoresPerSubject[subject] = Math.round(
            (history.overallScoresPerSubject[subject] + score) / 2
          );
        } else {
          history.overallScoresPerSubject[subject] = score;
        }
      }
    }

    // Record this grade in history
    if (!history.previousGrades.includes(grade)) {
      history.previousGrades.push(grade);
    }

    this.cumulativeHistories.set(learnerId, history);
  }

  /**
   * Get cumulative achievement history for a learner.
   * Requirement 9.5: Cumulative history preserved across all previous grades.
   */
  getCumulativeHistory(learnerId: string): CumulativeHistory | null {
    const history = this.cumulativeHistories.get(learnerId);
    return history ? { ...history, previousGrades: [...history.previousGrades] } : null;
  }

  /**
   * Get archived content for a learner.
   * Requirement 9.4: Archived content is read-only.
   */
  getArchivedGrades(learnerId: string): GradeArchive[] {
    const archives = this.gradeArchives.get(learnerId) ?? [];
    return archives.map((a) => ({ ...a }));
  }

  /**
   * Check if content for a grade is archived (read-only).
   * Requirement 9.4: All modification operations on archived content are rejected.
   */
  isGradeArchived(learnerId: string, grade: Grade): boolean {
    const archives = this.gradeArchives.get(learnerId) ?? [];
    return archives.some((a) => a.grade === grade);
  }

  /**
   * Attempt to modify archived content - should always be rejected.
   * Requirement 9.4: Archived content is read-only.
   */
  modifyArchivedContent(
    learnerId: string,
    grade: Grade
  ): { allowed: false; reason: string } | { allowed: true } {
    if (this.isGradeArchived(learnerId, grade)) {
      return {
        allowed: false,
        reason: `Content for Grade ${grade} is archived and read-only. Modifications are not permitted.`,
      };
    }
    return { allowed: true };
  }

  // --- Task 13.3: Academic Year Notification ---

  /**
   * Set or adjust the academic year end date for a learner.
   * Requirement 9.6: Allow parent to set/adjust expected promotion date.
   */
  setAcademicYearConfig(
    learnerId: string,
    academicYearEndDate: Date,
    expectedPromotionDate?: Date
  ): void {
    this.academicYearConfigs.set(learnerId, {
      learnerId,
      academicYearEndDate,
      expectedPromotionDate,
      parentNotified: false,
    });
  }

  /**
   * Get the academic year configuration for a learner.
   */
  getAcademicYearConfig(learnerId: string): AcademicYearConfig | null {
    const config = this.academicYearConfigs.get(learnerId);
    return config ? { ...config } : null;
  }

  /**
   * Update the expected promotion date.
   * Requirement 9.6: Allow parent to adjust expected promotion date.
   */
  setExpectedPromotionDate(learnerId: string, date: Date): boolean {
    const config = this.academicYearConfigs.get(learnerId);
    if (!config) return false;

    config.expectedPromotionDate = date;
    this.academicYearConfigs.set(learnerId, config);
    return true;
  }

  /**
   * Check if a notification should be sent for a learner based on current date.
   * Requirement 9.6: Notify parent 30 days before academic year end.
   *
   * @param currentDate - The current date to check against (allows testing)
   * @returns Notification if one should be sent, null otherwise
   */
  checkAcademicYearNotification(
    learnerId: string,
    currentDate: Date
  ): AcademicYearNotification | null {
    const config = this.academicYearConfigs.get(learnerId);
    if (!config) return null;

    const profile = this.profiles.get(learnerId);
    if (!profile || !profile.parentAccountId) return null;

    // Already notified
    if (config.parentNotified) return null;

    // Calculate days until academic year end
    const yearEndTime = new Date(config.academicYearEndDate);
    yearEndTime.setHours(0, 0, 0, 0);

    const currentTime = new Date(currentDate);
    currentTime.setHours(0, 0, 0, 0);

    const diffMs = yearEndTime.getTime() - currentTime.getTime();
    const daysUntilEnd = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Notify exactly when 30 days remain
    if (daysUntilEnd !== 30) return null;

    const notification: AcademicYearNotification = {
      learnerId,
      parentAccountId: profile.parentAccountId,
      message: `The academic year for your child ends in 30 days. Please confirm the upcoming grade promotion from Grade ${profile.currentGrade} to Grade ${(profile.currentGrade + 1) as Grade}.`,
      daysUntilYearEnd: 30,
      expectedPromotionDate: config.expectedPromotionDate,
      sentAt: currentDate,
    };

    // Mark as notified
    config.parentNotified = true;
    config.notificationSentAt = currentDate;
    this.academicYearConfigs.set(learnerId, config);

    // Store notification
    this.notifications.push(notification);

    return notification;
  }

  /**
   * Get all notifications sent for a learner.
   */
  getNotifications(learnerId: string): AcademicYearNotification[] {
    return this.notifications.filter((n) => n.learnerId === learnerId);
  }

  /**
   * Reset notification status (e.g., for a new academic year).
   */
  resetNotificationStatus(learnerId: string): boolean {
    const config = this.academicYearConfigs.get(learnerId);
    if (!config) return false;

    config.parentNotified = false;
    config.notificationSentAt = undefined;
    this.academicYearConfigs.set(learnerId, config);
    return true;
  }
}
