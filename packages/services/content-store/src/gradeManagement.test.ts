import { describe, it, expect, beforeEach } from 'vitest';
import {
  GradeManagementService,
  type LearnerProfile,
  type GradeContent,
} from './gradeManagement';
import type { Grade } from '@learnverse/service-core';

function createProfile(overrides: Partial<LearnerProfile> = {}): LearnerProfile {
  return {
    learnerId: 'learner-1',
    currentGrade: 5 as Grade,
    parentAccountId: 'parent-1',
    enrolledSubjects: ['kannada', 'maths'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function createGradeContent(overrides: Partial<GradeContent> = {}): GradeContent {
  return {
    learnerId: 'learner-1',
    grade: 5 as Grade,
    chapterIds: ['ch-1', 'ch-2', 'ch-3'],
    progressKeys: ['learner-1:ch-1', 'learner-1:ch-2', 'learner-1:ch-3'],
    revisionSessionIds: ['rev-1', 'rev-2'],
    totalChaptersCompleted: 3,
    overallScoresPerSubject: { kannada: 75, maths: 82 },
    revisionSessionCount: 2,
    ...overrides,
  };
}

describe('GradeManagementService', () => {
  let service: GradeManagementService;

  beforeEach(() => {
    service = new GradeManagementService();
  });

  // --- Task 13.1: Grade Promotion Workflow ---

  describe('Grade Promotion Workflow (Task 13.1)', () => {
    describe('Learner Profile and Grade Storage (Req 9.1)', () => {
      it('should store grade 1-12 in learner profile', () => {
        const profile = createProfile({ currentGrade: 1 as Grade });
        service.setLearnerProfile(profile);

        expect(service.getCurrentGrade('learner-1')).toBe(1);
      });

      it('should store any valid grade from 1 to 12', () => {
        for (let g = 1; g <= 12; g++) {
          const profile = createProfile({
            learnerId: `learner-${g}`,
            currentGrade: g as Grade,
          });
          service.setLearnerProfile(profile);
          expect(service.getCurrentGrade(`learner-${g}`)).toBe(g);
        }
      });

      it('should return null for non-existent learner', () => {
        expect(service.getCurrentGrade('non-existent')).toBeNull();
      });

      it('should return full learner profile', () => {
        const profile = createProfile();
        service.setLearnerProfile(profile);

        const retrieved = service.getLearnerProfile('learner-1');
        expect(retrieved).not.toBeNull();
        expect(retrieved!.currentGrade).toBe(5);
        expect(retrieved!.parentAccountId).toBe('parent-1');
        expect(retrieved!.enrolledSubjects).toEqual(['kannada', 'maths']);
      });
    });

    describe('Promotion Prompt (Req 9.2)', () => {
      it('should generate promotion prompt with keep/delete options', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));

        const prompt = service.generatePromotionPrompt('learner-1', 6 as Grade);
        expect(prompt).not.toBeNull();
        expect(prompt!.currentGrade).toBe(5);
        expect(prompt!.newGrade).toBe(6);
        expect(prompt!.requiresDecision).toBe(true);
        expect(prompt!.options).toEqual(['keep', 'delete']);
      });

      it('should return null if new grade is not sequential', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));

        const prompt = service.generatePromotionPrompt('learner-1', 8 as Grade);
        expect(prompt).toBeNull();
      });

      it('should return null for non-existent learner', () => {
        const prompt = service.generatePromotionPrompt('non-existent', 6 as Grade);
        expect(prompt).toBeNull();
      });

      it('should include informative message in prompt', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 3 as Grade }));

        const prompt = service.generatePromotionPrompt('learner-1', 4 as Grade);
        expect(prompt!.message).toContain('Grade 3');
        expect(prompt!.message).toContain('Grade 4');
      });
    });

    describe('Deletion Confirmation (Req 9.3)', () => {
      it('should require explicit confirmation before permanent deletion', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        const result = service.promoteGrade('learner-1', 6 as Grade, 'delete', false);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('confirmation');
        }
      });

      it('should generate deletion confirmation with content details', () => {
        service.setLearnerProfile(createProfile());
        service.registerGradeContent(createGradeContent());

        const confirmation = service.generateDeletionConfirmation('learner-1', 5 as Grade);
        expect(confirmation).not.toBeNull();
        expect(confirmation!.requiresExplicitAcknowledgment).toBe(true);
        expect(confirmation!.chapterCount).toBe(3);
        expect(confirmation!.subjectCount).toBe(2);
        expect(confirmation!.message).toContain('permanently delete');
      });

      it('should allow deletion after explicit confirmation', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        const result = service.promoteGrade('learner-1', 6 as Grade, 'delete', true);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.deleted).toBe(true);
          expect(result.archived).toBe(false);
        }
      });

      it('should permanently remove grade content after confirmed deletion', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        service.promoteGrade('learner-1', 6 as Grade, 'delete', true);

        const content = service.getGradeContent('learner-1', 5 as Grade);
        expect(content).toBeNull();
      });
    });

    describe('Archive Content in Read-Only State (Req 9.4)', () => {
      it('should archive kept content in read-only state', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        const result = service.promoteGrade('learner-1', 6 as Grade, 'keep');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.archived).toBe(true);
          expect(result.deleted).toBe(false);
        }
      });

      it('should mark archived content as read-only', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        service.promoteGrade('learner-1', 6 as Grade, 'keep');

        const archives = service.getArchivedGrades('learner-1');
        expect(archives).toHaveLength(1);
        expect(archives[0].isReadOnly).toBe(true);
        expect(archives[0].grade).toBe(5);
      });

      it('should reject modifications to archived content', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        service.promoteGrade('learner-1', 6 as Grade, 'keep');

        const modResult = service.modifyArchivedContent('learner-1', 5 as Grade);
        expect(modResult.allowed).toBe(false);
        if (!modResult.allowed) {
          expect(modResult.reason).toContain('read-only');
        }
      });

      it('should allow modifications to non-archived grades', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));

        const modResult = service.modifyArchivedContent('learner-1', 5 as Grade);
        expect(modResult.allowed).toBe(true);
      });

      it('should preserve archive data including scores and chapter count', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        service.promoteGrade('learner-1', 6 as Grade, 'keep');

        const archives = service.getArchivedGrades('learner-1');
        expect(archives[0].totalChaptersCompleted).toBe(3);
        expect(archives[0].overallScoresPerSubject).toEqual({ kannada: 75, maths: 82 });
        expect(archives[0].revisionSessionCount).toBe(2);
      });
    });

    describe('Reset Progress and Preserve History (Req 9.5)', () => {
      it('should update grade to new value after promotion', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));

        service.promoteGrade('learner-1', 6 as Grade, 'keep');

        expect(service.getCurrentGrade('learner-1')).toBe(6);
      });

      it('should preserve cumulative history after promotion', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        service.promoteGrade('learner-1', 6 as Grade, 'keep');

        const history = service.getCumulativeHistory('learner-1');
        expect(history).not.toBeNull();
        expect(history!.totalChaptersCompleted).toBe(3);
        expect(history!.overallScoresPerSubject).toEqual({ kannada: 75, maths: 82 });
        expect(history!.revisionSessionCount).toBe(2);
        expect(history!.previousGrades).toContain(5);
      });

      it('should accumulate history across multiple promotions', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(
          createGradeContent({
            grade: 5 as Grade,
            totalChaptersCompleted: 3,
            revisionSessionCount: 2,
            overallScoresPerSubject: { kannada: 70 },
          })
        );

        service.promoteGrade('learner-1', 6 as Grade, 'keep');

        // Register grade 6 content and promote again
        service.registerGradeContent(
          createGradeContent({
            grade: 6 as Grade,
            totalChaptersCompleted: 5,
            revisionSessionCount: 4,
            overallScoresPerSubject: { kannada: 80 },
          })
        );

        service.promoteGrade('learner-1', 7 as Grade, 'delete', true);

        const history = service.getCumulativeHistory('learner-1');
        expect(history!.totalChaptersCompleted).toBe(8); // 3 + 5
        expect(history!.revisionSessionCount).toBe(6); // 2 + 4
        expect(history!.previousGrades).toContain(5);
        expect(history!.previousGrades).toContain(6);
      });

      it('should preserve history even when content is deleted', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));
        service.registerGradeContent(createGradeContent());

        service.promoteGrade('learner-1', 6 as Grade, 'delete', true);

        const history = service.getCumulativeHistory('learner-1');
        expect(history).not.toBeNull();
        expect(history!.totalChaptersCompleted).toBe(3);
        expect(history!.revisionSessionCount).toBe(2);
      });
    });

    describe('Promotion Validation', () => {
      it('should fail promotion for non-existent learner', () => {
        const result = service.promoteGrade('non-existent', 6 as Grade, 'keep');
        expect(result.success).toBe(false);
      });

      it('should fail promotion if grade is not sequential', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));

        const result = service.promoteGrade('learner-1', 8 as Grade, 'keep');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('sequential');
        }
      });

      it('should fail promotion beyond grade 12', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 12 as Grade }));

        const result = service.promoteGrade('learner-1', 13 as unknown as Grade, 'keep');
        expect(result.success).toBe(false);
      });

      it('should handle promotion with no registered grade content', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 5 as Grade }));

        const result = service.promoteGrade('learner-1', 6 as Grade, 'keep');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.newGrade).toBe(6);
        }
      });
    });
  });

  // --- Task 13.3: Academic Year Notification ---

  describe('Academic Year Notification (Task 13.3)', () => {
    describe('Academic Year Configuration', () => {
      it('should allow parent to set academic year end date', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig(
          'learner-1',
          new Date('2025-03-31')
        );

        const config = service.getAcademicYearConfig('learner-1');
        expect(config).not.toBeNull();
        expect(config!.academicYearEndDate).toEqual(new Date('2025-03-31'));
      });

      it('should allow parent to set expected promotion date', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig(
          'learner-1',
          new Date('2025-03-31'),
          new Date('2025-04-15')
        );

        const config = service.getAcademicYearConfig('learner-1');
        expect(config!.expectedPromotionDate).toEqual(new Date('2025-04-15'));
      });

      it('should allow parent to adjust expected promotion date', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        const updated = service.setExpectedPromotionDate(
          'learner-1',
          new Date('2025-04-20')
        );
        expect(updated).toBe(true);

        const config = service.getAcademicYearConfig('learner-1');
        expect(config!.expectedPromotionDate).toEqual(new Date('2025-04-20'));
      });

      it('should return false when adjusting date for non-existent config', () => {
        const updated = service.setExpectedPromotionDate(
          'non-existent',
          new Date('2025-04-20')
        );
        expect(updated).toBe(false);
      });
    });

    describe('30-Day Notification (Req 9.6)', () => {
      it('should notify parent exactly 30 days before academic year end', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        // 30 days before March 31 = March 1
        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );

        expect(notification).not.toBeNull();
        expect(notification!.parentAccountId).toBe('parent-1');
        expect(notification!.daysUntilYearEnd).toBe(30);
        expect(notification!.message).toContain('30 days');
      });

      it('should not notify if more than 30 days remain', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        // 60 days before = Jan 30
        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-01-30')
        );

        expect(notification).toBeNull();
      });

      it('should not notify if fewer than 30 days remain', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        // 15 days before = March 16
        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-16')
        );

        expect(notification).toBeNull();
      });

      it('should not notify if academic year end has passed', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-04-15')
        );

        expect(notification).toBeNull();
      });

      it('should not send duplicate notifications', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        // First check - should notify
        const first = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );
        expect(first).not.toBeNull();

        // Second check - should not notify again
        const second = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );
        expect(second).toBeNull();
      });

      it('should not notify if no parent account is linked', () => {
        service.setLearnerProfile(createProfile({ parentAccountId: undefined }));
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );

        expect(notification).toBeNull();
      });

      it('should not notify if no academic year config exists', () => {
        service.setLearnerProfile(createProfile());

        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );

        expect(notification).toBeNull();
      });

      it('should include expected promotion date in notification if set', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig(
          'learner-1',
          new Date('2025-03-31'),
          new Date('2025-04-15')
        );

        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );

        expect(notification!.expectedPromotionDate).toEqual(new Date('2025-04-15'));
      });

      it('should store sent notifications', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        service.checkAcademicYearNotification('learner-1', new Date('2025-03-01'));

        const notifications = service.getNotifications('learner-1');
        expect(notifications).toHaveLength(1);
        expect(notifications[0].daysUntilYearEnd).toBe(30);
      });

      it('should allow resetting notification status for new academic year', () => {
        service.setLearnerProfile(createProfile());
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        // Send notification
        service.checkAcademicYearNotification('learner-1', new Date('2025-03-01'));

        // Reset
        const reset = service.resetNotificationStatus('learner-1');
        expect(reset).toBe(true);

        // Update config for new year
        service.setAcademicYearConfig('learner-1', new Date('2026-03-31'));

        // Should be able to notify again
        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2026-03-01')
        );
        expect(notification).not.toBeNull();
      });

      it('should include grade promotion info in notification message', () => {
        service.setLearnerProfile(createProfile({ currentGrade: 7 as Grade }));
        service.setAcademicYearConfig('learner-1', new Date('2025-03-31'));

        const notification = service.checkAcademicYearNotification(
          'learner-1',
          new Date('2025-03-01')
        );

        expect(notification!.message).toContain('Grade 7');
        expect(notification!.message).toContain('Grade 8');
      });
    });
  });
});
