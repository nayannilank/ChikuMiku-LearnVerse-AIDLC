import { describe, it, expect, beforeEach } from 'vitest';
import { Learner, Grade, ProgressRecord } from '@learnverse/service-core';
import {
  ParentalAccount,
  clearParentalStore,
  createParentalAccount,
  getParentalAccount,
  registerLearnerForParental,
  getLearnerById,
  linkParentToLearner,
  viewLearnerProgress,
  resetLearnerPassword,
  updateLearnerProfile,
  addProgressRecords,
} from './parental';
import { clearLearnerStore, hashPassword, verifyPassword } from './session';

function makeLearner(overrides: Partial<Learner> = {}): Learner {
  return {
    id: 'learner-1',
    displayName: 'Test Learner',
    contactType: 'email',
    contactValue: 'learner@example.com',
    passwordHash: hashPassword('Password1'),
    grade: 5 as Grade,
    enrolledSubjects: ['kannada', 'maths'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeParent(overrides: Partial<ParentalAccount> = {}): ParentalAccount {
  return {
    id: 'parent-1',
    displayName: 'Test Parent',
    contactType: 'email',
    contactValue: 'parent@example.com',
    linkedLearnerIds: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Parental Account Linking', () => {
  beforeEach(() => {
    clearParentalStore();
    clearLearnerStore();
  });

  describe('createParentalAccount / getParentalAccount', () => {
    it('should create and retrieve a parental account', () => {
      const parent = makeParent();
      createParentalAccount(parent);

      const retrieved = getParentalAccount('parent-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('parent-1');
      expect(retrieved!.displayName).toBe('Test Parent');
    });

    it('should return undefined for non-existent parent', () => {
      expect(getParentalAccount('non-existent')).toBeUndefined();
    });
  });

  describe('registerLearnerForParental / getLearnerById', () => {
    it('should register and retrieve a learner by ID', () => {
      const learner = makeLearner();
      registerLearnerForParental(learner);

      const retrieved = getLearnerById('learner-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.displayName).toBe('Test Learner');
    });

    it('should return undefined for non-existent learner', () => {
      expect(getLearnerById('non-existent')).toBeUndefined();
    });
  });

  describe('linkParentToLearner', () => {
    it('should link a parent to a learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);

      const result = linkParentToLearner('parent-1', 'learner-1');
      expect(result).toBe(true);

      const updatedParent = getParentalAccount('parent-1');
      expect(updatedParent!.linkedLearnerIds).toContain('learner-1');

      const updatedLearner = getLearnerById('learner-1');
      expect(updatedLearner!.parentAccountId).toBe('parent-1');
    });

    it('should not duplicate linking', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);

      linkParentToLearner('parent-1', 'learner-1');
      linkParentToLearner('parent-1', 'learner-1');

      const updatedParent = getParentalAccount('parent-1');
      const count = updatedParent!.linkedLearnerIds.filter((id) => id === 'learner-1').length;
      expect(count).toBe(1);
    });

    it('should return false if parent does not exist', () => {
      const learner = makeLearner();
      registerLearnerForParental(learner);

      const result = linkParentToLearner('non-existent', 'learner-1');
      expect(result).toBe(false);
    });

    it('should return false if learner does not exist', () => {
      const parent = makeParent();
      createParentalAccount(parent);

      const result = linkParentToLearner('parent-1', 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('viewLearnerProgress', () => {
    it('should return progress summary for a linked learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const records: ProgressRecord[] = [
        {
          learnerId: 'learner-1',
          chapterId: 'ch-1',
          subjectId: 'kannada',
          completionPercentage: 75,
          activityScores: [
            { activityType: 'comprehension', score: 80, completedAt: new Date() },
          ],
          lastAccessedAt: new Date(),
        },
      ];
      addProgressRecords('learner-1', records);

      const summary = viewLearnerProgress('parent-1', 'learner-1');
      expect(summary).not.toBeNull();
      expect(summary!.learnerId).toBe('learner-1');
      expect(summary!.enrolledSubjects).toEqual(['kannada', 'maths']);
      expect(summary!.progressRecords).toHaveLength(1);
      expect(summary!.progressRecords[0].completionPercentage).toBe(75);
    });

    it('should return null if parent is not linked to learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);

      const summary = viewLearnerProgress('parent-1', 'learner-1');
      expect(summary).toBeNull();
    });

    it('should return null if parent does not exist', () => {
      const learner = makeLearner();
      registerLearnerForParental(learner);

      const summary = viewLearnerProgress('non-existent', 'learner-1');
      expect(summary).toBeNull();
    });

    it('should return empty progress records when no progress exists', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const summary = viewLearnerProgress('parent-1', 'learner-1');
      expect(summary).not.toBeNull();
      expect(summary!.progressRecords).toHaveLength(0);
    });
  });

  describe('resetLearnerPassword', () => {
    it('should reset password for a linked learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = resetLearnerPassword('parent-1', 'learner-1', 'NewPass123');
      expect(result.success).toBe(true);
      expect(result.updatedLearner).toBeDefined();

      // Verify new password works
      const updated = getLearnerById('learner-1');
      expect(verifyPassword('NewPass123', updated!.passwordHash)).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = resetLearnerPassword('parent-1', 'learner-1', 'Ab1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('8 and 128');
    });

    it('should reject password longer than 128 characters', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const longPassword = 'A1' + 'a'.repeat(128);
      const result = resetLearnerPassword('parent-1', 'learner-1', longPassword);
      expect(result.success).toBe(false);
      expect(result.error).toContain('8 and 128');
    });

    it('should reject password without a letter', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = resetLearnerPassword('parent-1', 'learner-1', '12345678');
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one letter');
    });

    it('should reject password without a digit', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = resetLearnerPassword('parent-1', 'learner-1', 'abcdefgh');
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one letter and one digit');
    });

    it('should fail if parent is not linked to learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);

      const result = resetLearnerPassword('parent-1', 'learner-1', 'NewPass123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not linked');
    });

    it('should fail if parent does not exist', () => {
      const learner = makeLearner();
      registerLearnerForParental(learner);

      const result = resetLearnerPassword('non-existent', 'learner-1', 'NewPass123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Parent account not found');
    });
  });

  describe('updateLearnerProfile', () => {
    it('should update grade for a linked learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', { grade: 6 as Grade });
      expect(result.success).toBe(true);
      expect(result.updatedLearner!.grade).toBe(6);
    });

    it('should update contact information', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', {
        contactType: 'phone',
        contactValue: '+1234567890',
      });
      expect(result.success).toBe(true);
      expect(result.updatedLearner!.contactType).toBe('phone');
      expect(result.updatedLearner!.contactValue).toBe('+1234567890');
    });

    it('should update display name', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', {
        displayName: 'Updated Name',
      });
      expect(result.success).toBe(true);
      expect(result.updatedLearner!.displayName).toBe('Updated Name');
    });

    it('should reject invalid grade (0)', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', { grade: 0 as Grade });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Grade must be between 1 and 12');
    });

    it('should reject invalid grade (13)', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', { grade: 13 as Grade });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Grade must be between 1 and 12');
    });

    it('should reject invalid email format', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', {
        contactType: 'email',
        contactValue: 'not-an-email',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });

    it('should reject invalid phone format', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      const result = updateLearnerProfile('parent-1', 'learner-1', {
        contactType: 'phone',
        contactValue: 'abc',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number format');
    });

    it('should fail if parent is not linked to learner', () => {
      const parent = makeParent();
      const learner = makeLearner();
      createParentalAccount(parent);
      registerLearnerForParental(learner);

      const result = updateLearnerProfile('parent-1', 'learner-1', { grade: 6 as Grade });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not linked');
    });

    it('should fail if parent does not exist', () => {
      const learner = makeLearner();
      registerLearnerForParental(learner);

      const result = updateLearnerProfile('non-existent', 'learner-1', { grade: 6 as Grade });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Parent account not found');
    });

    it('should validate contact value against existing contactType when only contactValue is provided', () => {
      const parent = makeParent();
      const learner = makeLearner({ contactType: 'email' });
      createParentalAccount(parent);
      registerLearnerForParental(learner);
      linkParentToLearner('parent-1', 'learner-1');

      // Learner has contactType 'email', so providing a phone number as contactValue should fail
      const result = updateLearnerProfile('parent-1', 'learner-1', {
        contactValue: 'not-an-email',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email format');
    });
  });
});
