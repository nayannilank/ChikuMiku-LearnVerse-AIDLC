// @vitest-environment happy-dom
/**
 * Unit Tests: HomeView, RoleSelector, and LoginForm components
 *
 * Feature: registration-and-password-reset
 * Requirements: 1.1–1.8, 13.1–13.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoleSelector } from '../components/RoleSelector';
import { createLoginForm } from '../components/LoginForm';
import { createHomeView } from './HomeView';

// Mock AuthService to control login responses
vi.mock('../services/AuthService', () => ({
  loginWithRole: vi.fn(),
}));

// Mock Header and BackgroundWatermark to simplify DOM
vi.mock('../components/Header', () => ({
  createHeader: vi.fn((opts: { onRegisterClick: () => void }) => {
    const el = document.createElement('header');
    el.className = 'home-header';
    const btn = document.createElement('button');
    btn.textContent = 'Register';
    btn.addEventListener('click', opts.onRegisterClick);
    el.appendChild(btn);
    return el;
  }),
}));

vi.mock('../components/BackgroundWatermark', () => ({
  createBackgroundWatermark: vi.fn(() => {
    const el = document.createElement('div');
    el.className = 'background-watermark';
    return el;
  }),
}));

import { loginWithRole } from '../services/AuthService';

const mockedLoginWithRole = vi.mocked(loginWithRole);

describe('RoleSelector', () => {
  /**
   * Validates: Requirements 1.1, 13.4
   */

  it('renders a fieldset with a legend "Select Your Role"', () => {
    const onRoleSelected = vi.fn();
    const el = createRoleSelector({ onRoleSelected });

    expect(el.tagName).toBe('FIELDSET');
    const legend = el.querySelector('legend');
    expect(legend).not.toBeNull();
    expect(legend!.textContent).toBe('Select Your Role');
  });

  it('renders two radio buttons with correct labels', () => {
    const onRoleSelected = vi.fn();
    const el = createRoleSelector({ onRoleSelected });

    const radios = el.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(2);

    const parentRadio = el.querySelector('#role-parent') as HTMLInputElement;
    const studentRadio = el.querySelector('#role-student') as HTMLInputElement;
    expect(parentRadio).not.toBeNull();
    expect(studentRadio).not.toBeNull();
    expect(parentRadio.value).toBe('parent');
    expect(studentRadio.value).toBe('student');

    // Labels with matching for/id (Req 13.2)
    const parentLabel = el.querySelector('label[for="role-parent"]');
    const studentLabel = el.querySelector('label[for="role-student"]');
    expect(parentLabel).not.toBeNull();
    expect(parentLabel!.textContent).toBe('Parent');
    expect(studentLabel).not.toBeNull();
    expect(studentLabel!.textContent).toBe('Student');
  });

  it('radio buttons share the same name for mutual exclusivity', () => {
    const onRoleSelected = vi.fn();
    const el = createRoleSelector({ onRoleSelected });

    const radios = el.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
    const names = Array.from(radios).map((r) => r.name);
    expect(names.every((n) => n === 'role')).toBe(true);
  });

  it('fires onRoleSelected callback when a radio is selected', () => {
    const onRoleSelected = vi.fn();
    const el = createRoleSelector({ onRoleSelected });

    const parentRadio = el.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onRoleSelected).toHaveBeenCalledWith('parent');
  });
});

describe('LoginForm', () => {
  /**
   * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 13.1, 13.2
   */

  it('renders username and password inputs with associated labels', () => {
    const el = createLoginForm({
      role: 'parent',
      onSubmit: vi.fn(),
      onForgotPassword: vi.fn(),
      onRegister: vi.fn(),
    });

    const usernameInput = el.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = el.querySelector('#login-password') as HTMLInputElement;
    expect(usernameInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
    expect(usernameInput.type).toBe('text');
    expect(passwordInput.type).toBe('password');

    // Labels with matching for/id (Req 13.2)
    const usernameLabel = el.querySelector('label[for="login-username"]');
    const passwordLabel = el.querySelector('label[for="login-password"]');
    expect(usernameLabel).not.toBeNull();
    expect(usernameLabel!.textContent).toBe('Username');
    expect(passwordLabel).not.toBeNull();
    expect(passwordLabel!.textContent).toBe('Password');
  });

  it('submit button starts with "Log In" text', () => {
    const el = createLoginForm({
      role: 'student',
      onSubmit: vi.fn(),
      onForgotPassword: vi.fn(),
      onRegister: vi.fn(),
    });

    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Log In');
    expect(button.disabled).toBe(false);
  });

  it('disables submit button and shows loading text during submission', async () => {
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });

    const el = createLoginForm({
      role: 'parent',
      onSubmit: () => submitPromise,
      onForgotPassword: vi.fn(),
      onRegister: vi.fn(),
    });

    const form = el.querySelector('form') as HTMLFormElement;
    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;

    // Fill in inputs
    const usernameInput = el.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = el.querySelector('#login-password') as HTMLInputElement;
    usernameInput.value = 'testuser';
    passwordInput.value = 'testpass';

    // Submit
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // While in progress: button disabled + loading text (Req 1.4)
    await vi.waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Signing in...');
    });

    // Resolve to complete
    resolveSubmit!();
  });

  it('shows error message and failure actions on submit failure', async () => {
    const el = createLoginForm({
      role: 'parent',
      onSubmit: async () => {
        throw new Error('Invalid credentials');
      },
      onForgotPassword: vi.fn(),
      onRegister: vi.fn(),
    });

    const form = el.querySelector('form') as HTMLFormElement;
    const usernameInput = el.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = el.querySelector('#login-password') as HTMLInputElement;
    usernameInput.value = 'baduser';
    passwordInput.value = 'badpass';

    // Submit the form
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for async error handling
    await vi.waitFor(() => {
      const errorArea = el.querySelector('.login-form__error') as HTMLElement;
      expect(errorArea.style.display).not.toBe('none');
      expect(errorArea.textContent).toContain('Invalid credentials');
    });

    // Failure actions visible (Req 1.5, 1.6)
    const failureActions = el.querySelector('.login-form__failure-actions') as HTMLElement;
    expect(failureActions.style.display).not.toBe('none');

    // Register and Reset Password links (Req 1.7, 1.8)
    const registerLink = failureActions.querySelector('a[href="#register"]');
    const resetLink = failureActions.querySelector('a[href="#forgot-password"]');
    expect(registerLink).not.toBeNull();
    expect(registerLink!.textContent).toBe('Register');
    expect(resetLink).not.toBeNull();
    expect(resetLink!.textContent).toBe('Reset Password');
  });

  it('failure actions are hidden before first failure (Req 1.6)', () => {
    const el = createLoginForm({
      role: 'parent',
      onSubmit: vi.fn(),
      onForgotPassword: vi.fn(),
      onRegister: vi.fn(),
    });

    const failureActions = el.querySelector('.login-form__failure-actions') as HTMLElement;
    expect(failureActions.style.display).toBe('none');
  });

  it('Register link triggers onRegister callback', async () => {
    const onRegister = vi.fn();
    const el = createLoginForm({
      role: 'parent',
      onSubmit: async () => {
        throw new Error('fail');
      },
      onForgotPassword: vi.fn(),
      onRegister,
    });

    // Trigger failure to show actions
    const form = el.querySelector('form') as HTMLFormElement;
    (el.querySelector('#login-username') as HTMLInputElement).value = 'u';
    (el.querySelector('#login-password') as HTMLInputElement).value = 'p';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const failureActions = el.querySelector('.login-form__failure-actions') as HTMLElement;
      expect(failureActions.style.display).not.toBe('none');
    });

    const registerLink = el.querySelector('a[href="#register"]') as HTMLAnchorElement;
    registerLink.click();
    expect(onRegister).toHaveBeenCalled();
  });

  it('Reset Password link triggers onForgotPassword callback', async () => {
    const onForgotPassword = vi.fn();
    const el = createLoginForm({
      role: 'parent',
      onSubmit: async () => {
        throw new Error('fail');
      },
      onForgotPassword,
      onRegister: vi.fn(),
    });

    // Trigger failure to show actions
    const form = el.querySelector('form') as HTMLFormElement;
    (el.querySelector('#login-username') as HTMLInputElement).value = 'u';
    (el.querySelector('#login-password') as HTMLInputElement).value = 'p';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const failureActions = el.querySelector('.login-form__failure-actions') as HTMLElement;
      expect(failureActions.style.display).not.toBe('none');
    });

    const resetLink = el.querySelector('a[href="#forgot-password"]') as HTMLAnchorElement;
    resetLink.click();
    expect(onForgotPassword).toHaveBeenCalled();
  });
});

describe('HomeView', () => {
  /**
   * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8
   */

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('displays RoleSelector with Parent and Student options on initial render', () => {
    const view = createHomeView();

    const fieldset = view.querySelector('fieldset.role-selector');
    expect(fieldset).not.toBeNull();

    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    const studentRadio = view.querySelector('#role-student') as HTMLInputElement;
    expect(parentRadio).not.toBeNull();
    expect(studentRadio).not.toBeNull();
  });

  it('shows LoginForm after selecting a role', () => {
    const view = createHomeView();

    // Select parent role
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // LoginForm should now be visible
    const usernameInput = view.querySelector('#login-username');
    const passwordInput = view.querySelector('#login-password');
    expect(usernameInput).not.toBeNull();
    expect(passwordInput).not.toBeNull();
  });

  it('submits login with correct username, password, and role to AuthService', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: true,
      data: { token: 'mock-token', username: 'testuser' },
    });

    const view = createHomeView();

    // Select role
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Fill form
    const usernameInput = view.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = view.querySelector('#login-password') as HTMLInputElement;
    usernameInput.value = 'testuser';
    passwordInput.value = 'testpass123';

    // Submit
    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(mockedLoginWithRole).toHaveBeenCalledWith('testuser', 'testpass123', 'parent');
    });
  });

  it('disables submit button while login is in progress', async () => {
    let resolveLogin: (value: { success: true; data: { token: string; username: string } }) => void;
    mockedLoginWithRole.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );

    const view = createHomeView();

    // Select role
    const studentRadio = view.querySelector('#role-student') as HTMLInputElement;
    studentRadio.checked = true;
    studentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Fill and submit
    (view.querySelector('#login-username') as HTMLInputElement).value = 'student1';
    (view.querySelector('#login-password') as HTMLInputElement).value = 'pass123';

    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const button = view.querySelector('button[type="submit"]') as HTMLButtonElement;

    await vi.waitFor(() => {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Signing in...');
    });

    // Resolve login
    resolveLogin!({ success: true, data: { token: 'tok', username: 'student1' } });
  });

  it('shows error and failure actions on failed login', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    const view = createHomeView();

    // Select role
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Fill and submit
    (view.querySelector('#login-username') as HTMLInputElement).value = 'bad';
    (view.querySelector('#login-password') as HTMLInputElement).value = 'bad';

    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for error to appear
    await vi.waitFor(() => {
      const errorArea = view.querySelector('.login-form__error') as HTMLElement;
      expect(errorArea.style.display).not.toBe('none');
      expect(errorArea.textContent).toContain('Invalid credentials');
    });

    // Failure actions visible
    const failureActions = view.querySelector('.login-form__failure-actions') as HTMLElement;
    expect(failureActions.style.display).not.toBe('none');
  });

  it('"Register" failure action navigates to #register', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: false,
      error: 'Login failed',
    });

    const view = createHomeView();

    // Select role and trigger failure
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));
    (view.querySelector('#login-username') as HTMLInputElement).value = 'u';
    (view.querySelector('#login-password') as HTMLInputElement).value = 'p';

    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const failureActions = view.querySelector('.login-form__failure-actions') as HTMLElement;
      expect(failureActions.style.display).not.toBe('none');
    });

    // Click Register link
    const registerLink = view.querySelector('a[href="#register"]') as HTMLAnchorElement;
    registerLink.click();

    expect(window.location.hash).toBe('#register');
  });

  it('"Reset Password" failure action navigates to #forgot-password', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: false,
      error: 'Login failed',
    });

    const view = createHomeView();

    // Select role and trigger failure
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));
    (view.querySelector('#login-username') as HTMLInputElement).value = 'u';
    (view.querySelector('#login-password') as HTMLInputElement).value = 'p';

    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const failureActions = view.querySelector('.login-form__failure-actions') as HTMLElement;
      expect(failureActions.style.display).not.toBe('none');
    });

    // Click Reset Password link
    const resetLink = view.querySelector('a[href="#forgot-password"]') as HTMLAnchorElement;
    resetLink.click();

    expect(window.location.hash).toBe('#forgot-password');
  });

  it('shows welcome card on successful login', async () => {
    mockedLoginWithRole.mockResolvedValue({
      success: true,
      data: { token: 'mock-token-123', username: 'happyuser' },
    });

    const view = createHomeView();

    // Select role
    const parentRadio = view.querySelector('#role-parent') as HTMLInputElement;
    parentRadio.checked = true;
    parentRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // Fill and submit
    (view.querySelector('#login-username') as HTMLInputElement).value = 'happyuser';
    (view.querySelector('#login-password') as HTMLInputElement).value = 'secret';

    const form = view.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // Wait for welcome card
    await vi.waitFor(() => {
      const welcomeCard = view.querySelector('.welcome-card');
      expect(welcomeCard).not.toBeNull();
      expect(welcomeCard!.textContent).toContain('happyuser');
    });
  });
});
