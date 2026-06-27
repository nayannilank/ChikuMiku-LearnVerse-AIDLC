import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerParent,
  registerStudent,
  clearParentStudentStore,
  findParentByUsername,
  ParentRegistrationInput,
  StudentRegistrationInput,
} from './registration';

describe('registerParent', () => {
  beforeEach(() => {
    clearParentStudentStore();
  });

  const validParentInput: ParentRegistrationInput = {
    name: 'Rahul Kumar',
    username: 'rahul_kumar',
    password: 'Passw0rd!',
    phoneNumber: '9876543210',
    email: 'rahul@example.com',
  };

  it('registers a parent with valid input', () => {
    const result = registerParent(validParentInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.account.name).toBe('Rahul Kumar');
      expect(result.account.username).toBe('rahul_kumar');
      expect(result.account.phoneNumber).toBe('9876543210');
      expect(result.account.email).toBe('rahul@example.com');
      expect(result.account.linkedStudentIds).toEqual([]);
      expect(result.account.id).toBeDefined();
      expect(result.account.createdAt).toBeInstanceOf(Date);
      expect(result.account.updatedAt).toBeInstanceOf(Date);
      expect(result.account.passwordHash).toBeDefined();
    }
  });

  it('rejects name exceeding 100 characters', () => {
    const result = registerParent({
      ...validParentInput,
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    }
  });

  it('rejects empty name', () => {
    const result = registerParent({
      ...validParentInput,
      name: '   ',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    }
  });

  it('rejects username shorter than 5 characters', () => {
    const result = registerParent({
      ...validParentInput,
      username: 'abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username')).toBe(true);
    }
  });

  it('rejects username longer than 15 characters', () => {
    const result = registerParent({
      ...validParentInput,
      username: 'a'.repeat(16),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username')).toBe(true);
    }
  });

  it('rejects username with invalid characters', () => {
    const result = registerParent({
      ...validParentInput,
      username: 'rahul@kumar',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username')).toBe(true);
    }
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'Pa1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects password longer than 20 characters', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'Abcdefghijk1!!!!!!!!!!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects password without uppercase letter', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'passw0rd!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects password without lowercase letter', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'PASSW0RD!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects password without digit', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'Password!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects password without special character', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'Passw0rdd',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects phone number that is not exactly 10 digits', () => {
    const result = registerParent({
      ...validParentInput,
      phoneNumber: '123456789',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
    }
  });

  it('rejects phone number with non-digit characters', () => {
    const result = registerParent({
      ...validParentInput,
      phoneNumber: '+919876543',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'phoneNumber')).toBe(true);
    }
  });

  it('rejects invalid email without @', () => {
    const result = registerParent({
      ...validParentInput,
      email: 'rahulexample.com',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    }
  });

  it('rejects email exceeding 254 characters', () => {
    const result = registerParent({
      ...validParentInput,
      email: 'a'.repeat(250) + '@b.co',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    }
  });

  it('rejects duplicate username', () => {
    registerParent(validParentInput);
    const result = registerParent({
      ...validParentInput,
      email: 'other@example.com',
      phoneNumber: '1234567890',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username' && e.message.includes('taken'))).toBe(true);
    }
  });

  it('allows duplicate email — email uniqueness not enforced', () => {
    registerParent(validParentInput);
    const result = registerParent({
      ...validParentInput,
      username: 'other_user',
      phoneNumber: '1234567890',
    });
    // Email can be shared between multiple parents
    expect(result.success).toBe(true);
  });

  it('allows duplicate phone number — phone uniqueness not enforced', () => {
    registerParent(validParentInput);
    const result = registerParent({
      ...validParentInput,
      username: 'other_user',
      email: 'other@example.com',
    });
    // Phone number can be shared between multiple parents
    expect(result.success).toBe(true);
  });

  it('preserves valid fields on validation failure', () => {
    const result = registerParent({
      ...validParentInput,
      password: 'bad', // invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.preservedData.name).toBe('Rahul Kumar');
      expect(result.preservedData.username).toBe('rahul_kumar');
      expect(result.preservedData.phoneNumber).toBe('9876543210');
      expect(result.preservedData.email).toBe('rahul@example.com');
    }
  });

  it('does not preserve invalid fields', () => {
    const result = registerParent({
      ...validParentInput,
      username: 'ab', // invalid
      email: 'bad', // invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.preservedData.username).toBeUndefined();
      expect(result.preservedData.email).toBeUndefined();
      expect(result.preservedData.name).toBe('Rahul Kumar');
      expect(result.preservedData.phoneNumber).toBe('9876543210');
    }
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const result = registerParent({
      name: '',
      username: 'ab',
      password: 'bad',
      phoneNumber: '123',
      email: 'bad',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain('name');
      expect(fields).toContain('username');
      expect(fields).toContain('password');
      expect(fields).toContain('phoneNumber');
      expect(fields).toContain('email');
    }
  });
});

describe('registerStudent', () => {
  beforeEach(() => {
    clearParentStudentStore();
  });

  const validParentInput: ParentRegistrationInput = {
    name: 'Rahul Kumar',
    username: 'rahul_kumar',
    password: 'Passw0rd!',
    phoneNumber: '9876543210',
    email: 'rahul@example.com',
  };

  const validStudentInput: StudentRegistrationInput = {
    name: 'Arjun Kumar',
    username: 'arjun_kumar',
    password: 'Stud3nt!P',
    grade: 5,
    parentUsername: 'rahul_kumar',
  };

  it('registers a student with valid input and existing parent', () => {
    registerParent(validParentInput);
    const result = registerStudent(validStudentInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.account.name).toBe('Arjun Kumar');
      expect(result.account.username).toBe('arjun_kumar');
      expect(result.account.grade).toBe(5);
      expect(result.account.parentUsername).toBe('rahul_kumar');
      expect(result.account.parentAccountId).toBeDefined();
      expect(result.account.id).toBeDefined();
      expect(result.account.createdAt).toBeInstanceOf(Date);
      expect(result.account.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('links student to parent account', () => {
    registerParent(validParentInput);
    const result = registerStudent(validStudentInput);
    expect(result.success).toBe(true);
    if (result.success) {
      const parent = findParentByUsername('rahul_kumar');
      expect(parent).toBeDefined();
      expect(parent!.linkedStudentIds).toContain(result.account.id);
    }
  });

  it('rejects name exceeding 100 characters', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'name')).toBe(true);
    }
  });

  it('rejects username shorter than 5 characters', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      username: 'abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username')).toBe(true);
    }
  });

  it('rejects username longer than 15 characters', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      username: 'a'.repeat(16),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username')).toBe(true);
    }
  });

  it('rejects password shorter than 8 characters', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      password: 'Pa1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects password without required character types', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      password: 'alllowercase1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'password')).toBe(true);
    }
  });

  it('rejects grade less than 1', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      grade: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'grade')).toBe(true);
    }
  });

  it('rejects grade greater than 12', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      grade: 13,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'grade')).toBe(true);
    }
  });

  it('rejects parentUsername shorter than 5 characters', () => {
    const result = registerStudent({
      ...validStudentInput,
      parentUsername: 'abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'parentUsername')).toBe(true);
    }
  });

  it('rejects non-existent parent username', () => {
    // Do not register the parent
    const result = registerStudent(validStudentInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'parentUsername' && e.message.includes('does not exist'))).toBe(true);
    }
  });

  it('rejects duplicate student username', () => {
    registerParent(validParentInput);
    registerStudent(validStudentInput);
    const result = registerStudent({
      ...validStudentInput,
      name: 'Another Student',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username' && e.message.includes('taken'))).toBe(true);
    }
  });

  it('rejects student with same username as parent', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      username: 'rahul_kumar',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.field === 'username' && e.message.includes('taken'))).toBe(true);
    }
  });

  it('preserves valid fields on validation failure', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      password: 'bad', // invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.preservedData.name).toBe('Arjun Kumar');
      expect(result.preservedData.username).toBe('arjun_kumar');
      expect(result.preservedData.grade).toBe(5);
      expect(result.preservedData.parentUsername).toBe('rahul_kumar');
    }
  });

  it('does not preserve invalid fields', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      username: 'ab', // invalid
      grade: 0, // invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.preservedData.username).toBeUndefined();
      expect(result.preservedData.grade).toBeUndefined();
      expect(result.preservedData.name).toBe('Arjun Kumar');
      expect(result.preservedData.parentUsername).toBe('rahul_kumar');
    }
  });

  it('accepts grade at boundary (1)', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      grade: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts grade at boundary (12)', () => {
    registerParent(validParentInput);
    const result = registerStudent({
      ...validStudentInput,
      grade: 12,
    });
    expect(result.success).toBe(true);
  });
});
