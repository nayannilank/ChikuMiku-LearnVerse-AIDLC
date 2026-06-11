// @vitest-environment happy-dom
/**
 * Unit Tests: RegistrationView and sub-components
 *
 * Feature: registration-and-password-reset
 * Requirements: 2.1–2.3, 3.1–3.6, 5.2–5.4, 6.1–6.5, 7.1–7.7, 9.2–9.4, 13.5, 13.6
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRegistrationView } from './RegistrationView';
import { createRoleChoiceScreen } from '../components/RoleChoiceScreen';
import { createParentRegistrationForm } from '../components/ParentRegistrationForm';
import { createParentLoginGate } from '../components/ParentLoginGate';
import { createStudentRegistrationForm } from '../components/StudentRegistrationForm';

// Mock AuthService to control responses
vi.mock('../services/AuthService', () => ({
  loginWithRole: vi.fn(),
  registerParent: vi.fn(),
  registerStudent: vi.fn(),
}));

import { loginWithRole, registerParent, registerStudent } from '../services/AuthService';

const mockedLoginWithRole = vi.mocked(loginWithRole);
const mockedRegisterParent = vi.mocked(registerParent);
const mockedRegisterStudent = vi.mocked(registerStudent);

describe('RoleChoiceScreen', () => {
  /**
   * Validates: Requirements 2.1, 13.5
   */

  it('renders two radio options with correct IDs and shared name', () => {
    const onChoice = vi.fn();
    const el = createRoleChoiceScreen({ onChoice });

    const radios = el.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(2);

    const parentRadio = el.querySelector('#reg-role-parent') as HTMLInputElement;
    const studentRadio = el.querySelector('#reg-role-student') as HTMLInputElement;
    expect(parentRadio).not.toBeNull();
    expect(studentRadio).not.toBeNull();
    expect(parentRadio.name).toBe('registration-role');
    expect(studentRadio.name).toBe('registration-role');
  });

  it('uses fieldset with legend for screen reader context (Req 13.5)', () => {
    const onChoice = vi.fn();
    const el = createRoleChoiceScreen({ onChoice });

    expect(el.tagName).toBe('FIELDSET');
    const legend = el.querySelector('legend');
    expect(legend).not.toBeNull();
    expect(legend!.textContent).toBe('Register as');
  });

  it('fires onChoice with "parent" when parent radio is selected', () => {
    const onChoice = vi.fn();
    const el = createRoleChoiceScreen({ onChoice });

    const parentRadio = el.querySelector('#reg-role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChoice).toHaveBeenCalledWith('parent');
  });

  it('fires onChoice with "student" when student radio is selected', () => {
    const onChoice = vi.fn();
    const el = createRoleChoiceScreen({ onChoice });

    const studentRadio = el.querySelector('#reg-role-student') as HTMLInputElement;
    studentRadio.checked = true;
    studentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onChoice).toHaveBeenCalledWith('student');
  });
});

describe('ParentRegistrationForm', () => {
  /**
   * Validates: Requirements 3.1–3.6, 5.2–5.4
   */

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  it('has all required fields with visible labels (Req 3.1–3.5)', () => {
    const el = createParentRegistrationForm({ onSuccess: vi.fn() });

    // Username field (Req 3.1)
    const usernameInput = el.querySelector('#parent-reg-username') as HTMLInputElement;
    expect(usernameInput).not.toBeNull();
    const usernameLabel = el.querySelector('label[for="parent-reg-username"]');
    expect(usernameLabel).not.toBeNull();
    expect(usernameLabel!.textContent).toBe('Username');

    // Name field (Req 3.2)
    const nameInput = el.querySelector('#parent-reg-name') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    const nameLabel = el.querySelector('label[for="parent-reg-name"]');
    expect(nameLabel).not.toBeNull();
    expect(nameLabel!.textContent).toBe('Name');

    // Phone field (Req 3.3)
    const phoneInput = el.querySelector('#parent-reg-phone') as HTMLInputElement;
    expect(phoneInput).not.toBeNull();
    const phoneLabel = el.querySelector('label[for="parent-reg-phone"]');
    expect(phoneLabel).not.toBeNull();
    expect(phoneLabel!.textContent).toBe('Phone');

    // Email field (Req 3.4)
    const emailInput = el.querySelector('#parent-reg-email') as HTMLInputElement;
    expect(emailInput).not.toBeNull();
    const emailLabel = el.querySelector('label[for="parent-reg-email"]');
    expect(emailLabel).not.toBeNull();
    expect(emailLabel!.textContent).toBe('Email');

    // Password field (Req 3.5)
    const passwordInput = el.querySelector('#parent-reg-password') as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    expect(passwordInput.type).toBe('password');
    const passwordLabel = el.querySelector('label[for="parent-reg-password"]');
    expect(passwordLabel).not.toBeNull();
    expect(passwordLabel!.textContent).toBe('Password');
  });

  it('has a submit button labeled "Register Parent" (Req 3.6)', () => {
    const el = createParentRegistrationForm({ onSuccess: vi.fn() });
    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Register Parent');
  });

  it('shows success message and navigates after 3s on successful registration (Req 5.2)', async () => {
    mockedRegisterParent.mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const el = createParentRegistrationForm({ onSuccess });

    // Fill all fields with valid data
    (el.querySelector('#parent-reg-username') as HTMLInputElement).value = 'validuser1';
    (el.querySelector('#parent-reg-name') as HTMLInputElement).value = 'Valid Name';
    (el.querySelector('#parent-reg-phone') as HTMLInputElement).value = '1234567890';
    (el.querySelector('#parent-reg-email') as HTMLInputElement).value = 'test@example.com';
    (el.querySelector('#parent-reg-password') as HTMLInputElement).value = 'Password1!';

    // Submit
    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for async registerParent to resolve
    await vi.waitFor(() => {
      const successArea = el.querySelector('.parent-registration-form__success') as HTMLElement;
      expect(successArea.style.display).not.toBe('none');
    });

    // Verify success message content
    const successArea = el.querySelector('.parent-registration-form__success') as HTMLElement;
    expect(successArea.textContent).toContain('Registration successful');

    // Verify fallback link is present
    const loginLink = el.querySelector('.parent-registration-form__login-link') as HTMLAnchorElement;
    expect(loginLink).not.toBeNull();
    expect(loginLink.href).toContain('#');
    expect(loginLink.textContent).toBe('Go to Login');

    // Advance time to trigger navigation (hash '#' normalizes to '' in happy-dom)
    vi.advanceTimersByTime(3000);
    expect(window.location.hash).toBe('');
  });

  it('disables submit button and shows loading during submission (Req 5.3)', async () => {
    let resolveRegister: (value: { success: boolean }) => void;
    mockedRegisterParent.mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve; })
    );

    const el = createParentRegistrationForm({ onSuccess: vi.fn() });

    // Fill all fields
    (el.querySelector('#parent-reg-username') as HTMLInputElement).value = 'validuser1';
    (el.querySelector('#parent-reg-name') as HTMLInputElement).value = 'Valid Name';
    (el.querySelector('#parent-reg-phone') as HTMLInputElement).value = '1234567890';
    (el.querySelector('#parent-reg-email') as HTMLInputElement).value = 'test@example.com';
    (el.querySelector('#parent-reg-password') as HTMLInputElement).value = 'Password1!';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;

    await vi.waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Registering...');
    });

    resolveRegister!({ success: true });
  });

  it('displays error below form on API error (Req 5.4)', async () => {
    mockedRegisterParent.mockResolvedValue({ success: false, error: 'Username already taken' });

    const el = createParentRegistrationForm({ onSuccess: vi.fn() });

    // Fill all fields with valid data
    (el.querySelector('#parent-reg-username') as HTMLInputElement).value = 'validuser1';
    (el.querySelector('#parent-reg-name') as HTMLInputElement).value = 'Valid Name';
    (el.querySelector('#parent-reg-phone') as HTMLInputElement).value = '1234567890';
    (el.querySelector('#parent-reg-email') as HTMLInputElement).value = 'test@example.com';
    (el.querySelector('#parent-reg-password') as HTMLInputElement).value = 'Password1!';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const errorArea = el.querySelector('.parent-registration-form__error') as HTMLElement;
      expect(errorArea.style.display).not.toBe('none');
      expect(errorArea.textContent).toContain('Username already taken');
    });
  });
});

describe('ParentLoginGate', () => {
  /**
   * Validates: Requirements 6.1–6.5
   */

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays login form with username, password, and submit button (Req 6.1)', () => {
    const el = createParentLoginGate({ onAuthenticated: vi.fn() });

    const usernameInput = el.querySelector('#parent-gate-username') as HTMLInputElement;
    const passwordInput = el.querySelector('#parent-gate-password') as HTMLInputElement;
    const submitButton = el.querySelector('.parent-login-gate__submit') as HTMLButtonElement;

    expect(usernameInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    expect(submitButton.textContent).toBe('Login as Parent');
  });

  it('calls loginWithRole with role "parent" on submit (Req 6.2)', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: true,
      data: { token: 'mock-token', username: 'parentuser' },
    });

    const onAuthenticated = vi.fn();
    const el = createParentLoginGate({ onAuthenticated });

    (el.querySelector('#parent-gate-username') as HTMLInputElement).value = 'parentuser';
    (el.querySelector('#parent-gate-password') as HTMLInputElement).value = 'parentpass';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(mockedLoginWithRole).toHaveBeenCalledWith('parentuser', 'parentpass', 'parent');
    });
  });

  it('stores token and transitions on success (Req 6.3)', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: true,
      data: { token: 'parent-auth-token', username: 'parentuser' },
    });

    const onAuthenticated = vi.fn();
    const el = createParentLoginGate({ onAuthenticated });

    (el.querySelector('#parent-gate-username') as HTMLInputElement).value = 'parentuser';
    (el.querySelector('#parent-gate-password') as HTMLInputElement).value = 'parentpass';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledWith('parentuser', 'parent-auth-token');
    });
  });

  it('disables submit and shows loading during submission (Req 6.4)', async () => {
    let resolveLogin: (value: { success: boolean; data?: { token: string; username: string } }) => void;
    mockedLoginWithRole.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );

    const el = createParentLoginGate({ onAuthenticated: vi.fn() });

    (el.querySelector('#parent-gate-username') as HTMLInputElement).value = 'user';
    (el.querySelector('#parent-gate-password') as HTMLInputElement).value = 'pass';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const button = el.querySelector('.parent-login-gate__submit') as HTMLButtonElement;

    await vi.waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Signing in...');
    });

    resolveLogin!({ success: true, data: { token: 'tok', username: 'user' } });
  });

  it('displays error below form on API failure (Req 6.5)', async () => {
    mockedLoginWithRole.mockResolvedValue({ success: false, error: 'Invalid credentials' });

    const el = createParentLoginGate({ onAuthenticated: vi.fn() });

    (el.querySelector('#parent-gate-username') as HTMLInputElement).value = 'baduser';
    (el.querySelector('#parent-gate-password') as HTMLInputElement).value = 'badpass';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const errorArea = el.querySelector('.parent-login-gate__error') as HTMLElement;
      expect(errorArea.style.display).not.toBe('none');
      expect(errorArea.textContent).toContain('Invalid credentials');
    });
  });
});

describe('StudentRegistrationForm', () => {
  /**
   * Validates: Requirements 7.1–7.7, 9.2–9.4, 13.6
   */

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '';
  });

  it('has read-only parent username with aria-readonly (Req 7.2, 13.6)', () => {
    const el = createStudentRegistrationForm({
      parentUsername: 'parentuser',
      parentToken: 'token123',
      onSuccess: vi.fn(),
    });

    const parentInput = el.querySelector('#student-reg-parent-username') as HTMLInputElement;
    expect(parentInput).not.toBeNull();
    expect(parentInput.value).toBe('parentuser');
    expect(parentInput.readOnly).toBe(true);
    expect(parentInput.getAttribute('aria-readonly')).toBe('true');
  });

  it('has all required fields with labels (Req 7.3–7.6)', () => {
    const el = createStudentRegistrationForm({
      parentUsername: 'parentuser',
      parentToken: 'token123',
      onSuccess: vi.fn(),
    });

    // Parent Username label
    const parentLabel = el.querySelector('label[for="student-reg-parent-username"]');
    expect(parentLabel).not.toBeNull();
    expect(parentLabel!.textContent).toBe('Parent Username');

    // Student Username (Req 7.3)
    const studentInput = el.querySelector('#student-reg-username') as HTMLInputElement;
    expect(studentInput).not.toBeNull();
    const studentLabel = el.querySelector('label[for="student-reg-username"]');
    expect(studentLabel).not.toBeNull();
    expect(studentLabel!.textContent).toBe('Student Username');

    // Name (Req 7.4)
    const nameInput = el.querySelector('#student-reg-name') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    const nameLabel = el.querySelector('label[for="student-reg-name"]');
    expect(nameLabel).not.toBeNull();
    expect(nameLabel!.textContent).toBe('Name');

    // Grade dropdown (Req 7.5)
    const gradeSelect = el.querySelector('#student-reg-grade') as HTMLSelectElement;
    expect(gradeSelect).not.toBeNull();
    const gradeLabel = el.querySelector('label[for="student-reg-grade"]');
    expect(gradeLabel).not.toBeNull();
    expect(gradeLabel!.textContent).toBe('Grade');

    // School Name (Req 7.6)
    const schoolInput = el.querySelector('#student-reg-school-name') as HTMLInputElement;
    expect(schoolInput).not.toBeNull();
    const schoolLabel = el.querySelector('label[for="student-reg-school-name"]');
    expect(schoolLabel).not.toBeNull();
    expect(schoolLabel!.textContent).toBe('School Name');
  });

  it('has a submit button labeled "Register Student" (Req 7.7)', () => {
    const el = createStudentRegistrationForm({
      parentUsername: 'parentuser',
      parentToken: 'token123',
      onSuccess: vi.fn(),
    });

    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Register Student');
  });

  it('shows success message and navigates after 3s (Req 9.2)', async () => {
    mockedRegisterStudent.mockResolvedValue({ success: true });
    const onSuccess = vi.fn();

    const el = createStudentRegistrationForm({
      parentUsername: 'parentuser',
      parentToken: 'token123',
      onSuccess,
    });

    // Fill valid data
    (el.querySelector('#student-reg-username') as HTMLInputElement).value = 'student01';
    (el.querySelector('#student-reg-name') as HTMLInputElement).value = 'Student Name';
    const gradeSelect = el.querySelector('#student-reg-grade') as HTMLSelectElement;
    gradeSelect.value = 'Fifth';
    (el.querySelector('#student-reg-school-name') as HTMLInputElement).value = 'Good School';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const successArea = el.querySelector('.student-registration-form__success') as HTMLElement;
      expect(successArea.style.display).not.toBe('none');
      expect(successArea.textContent).toContain('Student registered successfully');
    });

    // Verify fallback link
    const loginLink = el.querySelector('.student-registration-form__login-link') as HTMLAnchorElement;
    expect(loginLink).not.toBeNull();
    expect(loginLink.textContent).toBe('Go to Login');

    // Advance time to trigger navigation (hash '#' normalizes to '' in happy-dom)
    vi.advanceTimersByTime(3000);
    expect(window.location.hash).toBe('');
  });

  it('disables submit button during submission (Req 9.3)', async () => {
    let resolveRegister: (value: { success: boolean }) => void;
    mockedRegisterStudent.mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve; })
    );

    const el = createStudentRegistrationForm({
      parentUsername: 'parentuser',
      parentToken: 'token123',
      onSuccess: vi.fn(),
    });

    (el.querySelector('#student-reg-username') as HTMLInputElement).value = 'student01';
    (el.querySelector('#student-reg-name') as HTMLInputElement).value = 'Student Name';
    (el.querySelector('#student-reg-grade') as HTMLSelectElement).value = 'Fifth';
    (el.querySelector('#student-reg-school-name') as HTMLInputElement).value = 'Good School';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;

    await vi.waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Registering...');
    });

    resolveRegister!({ success: true });
  });

  it('displays error below form on API error (Req 9.4)', async () => {
    mockedRegisterStudent.mockResolvedValue({ success: false, error: 'Student username taken' });

    const el = createStudentRegistrationForm({
      parentUsername: 'parentuser',
      parentToken: 'token123',
      onSuccess: vi.fn(),
    });

    (el.querySelector('#student-reg-username') as HTMLInputElement).value = 'student01';
    (el.querySelector('#student-reg-name') as HTMLInputElement).value = 'Student Name';
    (el.querySelector('#student-reg-grade') as HTMLSelectElement).value = 'Fifth';
    (el.querySelector('#student-reg-school-name') as HTMLInputElement).value = 'Good School';

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const errorArea = el.querySelector('.student-registration-form__error') as HTMLElement;
      expect(errorArea.style.display).not.toBe('none');
      expect(errorArea.textContent).toContain('Student username taken');
    });
  });
});

describe('RegistrationView', () => {
  /**
   * Validates: Requirements 2.1–2.3
   */

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('initially displays the role choice screen with two options (Req 2.1)', () => {
    const view = createRegistrationView();

    const parentRadio = view.querySelector('#reg-role-parent') as HTMLInputElement;
    const studentRadio = view.querySelector('#reg-role-student') as HTMLInputElement;
    expect(parentRadio).not.toBeNull();
    expect(studentRadio).not.toBeNull();
  });

  it('shows parent registration form when "Parent" is selected (Req 2.2)', () => {
    const view = createRegistrationView();

    const parentRadio = view.querySelector('#reg-role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // ParentRegistrationForm should now be visible
    const usernameInput = view.querySelector('#parent-reg-username');
    const nameInput = view.querySelector('#parent-reg-name');
    expect(usernameInput).not.toBeNull();
    expect(nameInput).not.toBeNull();
  });

  it('shows parent login gate when "Student" is selected (Req 2.3)', () => {
    const view = createRegistrationView();

    const studentRadio = view.querySelector('#reg-role-student') as HTMLInputElement;
    studentRadio.checked = true;
    studentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // ParentLoginGate should now be visible
    const gateUsername = view.querySelector('#parent-gate-username');
    const gatePassword = view.querySelector('#parent-gate-password');
    const gateSubmit = view.querySelector('.parent-login-gate__submit');
    expect(gateUsername).not.toBeNull();
    expect(gatePassword).not.toBeNull();
    expect(gateSubmit).not.toBeNull();
  });

  it('transitions from parent login gate to student form on authentication (Req 6.3, 7.1)', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: true,
      data: { token: 'parent-token-123', username: 'parentuser' },
    });

    const view = createRegistrationView();

    // Select student path
    const studentRadio = view.querySelector('#reg-role-student') as HTMLInputElement;
    studentRadio.checked = true;
    studentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Fill parent login gate
    (view.querySelector('#parent-gate-username') as HTMLInputElement).value = 'parentuser';
    (view.querySelector('#parent-gate-password') as HTMLInputElement).value = 'parentpass';

    // Submit parent login gate
    const gateForm = view.querySelector('form.parent-login-gate') as HTMLFormElement;
    gateForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for transition to student form
    await vi.waitFor(() => {
      const studentUsernameInput = view.querySelector('#student-reg-parent-username') as HTMLInputElement;
      expect(studentUsernameInput).not.toBeNull();
      expect(studentUsernameInput.value).toBe('parentuser');
      expect(studentUsernameInput.readOnly).toBe(true);
    });
  });

  it('includes a "Back to Login" link navigating to hash # (Req 12.1)', () => {
    const view = createRegistrationView();

    const backLink = view.querySelector('.registration-view__back-link') as HTMLAnchorElement;
    expect(backLink).not.toBeNull();
    expect(backLink.textContent).toBe('Back to Login');
    expect(backLink.getAttribute('href')).toBe('#');
  });
});
