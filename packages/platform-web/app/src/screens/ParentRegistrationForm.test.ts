/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createParentRegistrationScreen, type ParentRegistrationFormProps } from './ParentRegistrationForm';

function createForm(overrides: Partial<ParentRegistrationFormProps> = {}) {
  const defaultProps: ParentRegistrationFormProps = {
    onSubmit: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
  return { element: createParentRegistrationScreen(defaultProps), props: defaultProps };
}

function getInput(el: HTMLElement, name: string): HTMLInputElement {
  return el.querySelector(`input[name="${name}"]`) as HTMLInputElement;
}

function getErrorEl(el: HTMLElement, name: string): HTMLElement {
  return el.querySelector(`#preg-${name}-error`) as HTMLElement;
}

function getSubmitButton(el: HTMLElement): HTMLButtonElement {
  return el.querySelector('button[type="submit"]') as HTMLButtonElement;
}

function getForm(el: HTMLElement): HTMLFormElement {
  return el.querySelector('form') as HTMLFormElement;
}

function fillValidData(el: HTMLElement) {
  getInput(el, 'username').value = 'testuser1';
  getInput(el, 'name').value = 'Test Parent';
  getInput(el, 'phone').value = '9876543210';
  getInput(el, 'email').value = 'test@example.com';
  getInput(el, 'password').value = 'Pass1234!';
}

async function tick() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('ParentRegistrationForm Screen', () => {
  describe('structure', () => {
    it('renders all five fields with labels', () => {
      const { element } = createForm();
      const fields = ['username', 'name', 'phone', 'email', 'password'];

      for (const field of fields) {
        const input = getInput(element, field);
        expect(input).not.toBeNull();

        const label = element.querySelector(`label[for="preg-${field}"]`);
        expect(label).not.toBeNull();
      }
    });

    it('renders submit button labeled "Register Parent"', () => {
      const { element } = createForm();
      const btn = getSubmitButton(element);
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Register Parent');
    });

    it('renders form with aria-label', () => {
      const { element } = createForm();
      const form = getForm(element);
      expect(form.getAttribute('aria-label')).toBe('Parent Registration Form');
    });

    it('renders back button when onBack is provided', () => {
      const onBack = vi.fn();
      const { element } = createForm({ onBack });
      const backBtn = element.querySelector('button[type="button"]') as HTMLButtonElement;
      expect(backBtn).not.toBeNull();
      expect(backBtn.textContent).toContain('Back');
      backBtn.click();
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('does not render back button when onBack is not provided', () => {
      const { element } = createForm();
      const buttons = element.querySelectorAll('button[type="button"]');
      expect(buttons.length).toBe(0);
    });
  });

  describe('inline validation on blur', () => {
    it('shows error for username that is too short on blur', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      input.value = 'abc';
      input.dispatchEvent(new Event('blur'));

      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('8 and 15 characters');
    });

    it('shows error for invalid characters in username on blur', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      input.value = 'user@name!';
      input.dispatchEvent(new Event('blur'));

      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('letters, numbers, hyphens, and underscores');
    });

    it('clears error when valid value is entered after touch', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      // First blur to mark as touched
      input.value = 'ab';
      input.dispatchEvent(new Event('blur'));

      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.style.display).toBe('block');

      // Now type valid input
      input.value = 'validuser';
      input.dispatchEvent(new Event('input'));

      expect(errorEl.style.display).toBe('none');
    });

    it('validates name must be 5-20 chars with only letters and spaces', () => {
      const { element } = createForm();
      const input = getInput(element, 'name');

      input.value = 'AB';
      input.dispatchEvent(new Event('blur'));
      expect(getErrorEl(element, 'name').textContent).toContain('5 and 20 characters');

      input.value = 'Name123';
      input.dispatchEvent(new Event('input'));
      expect(getErrorEl(element, 'name').textContent).toContain('letters and spaces');
    });

    it('validates phone must be exactly 10 digits', () => {
      const { element } = createForm();
      const input = getInput(element, 'phone');

      input.value = '12345';
      input.dispatchEvent(new Event('blur'));
      expect(getErrorEl(element, 'phone').textContent).toContain('10 digits');
    });

    it('validates email format and length', () => {
      const { element } = createForm();
      const input = getInput(element, 'email');

      input.value = 'notanemail';
      input.dispatchEvent(new Event('blur'));
      expect(getErrorEl(element, 'email').textContent).toContain('valid email');
    });

    it('validates password complexity requirements', () => {
      const { element } = createForm();
      const input = getInput(element, 'password');

      input.value = 'short';
      input.dispatchEvent(new Event('blur'));
      expect(getErrorEl(element, 'password').textContent).toContain('8 and 20 characters');

      input.value = 'alllowercase1!';
      input.dispatchEvent(new Event('input'));
      expect(getErrorEl(element, 'password').textContent).toContain('uppercase');
    });
  });

  describe('validation as user types', () => {
    it('does not validate on input until field is touched', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      input.value = 'ab';
      input.dispatchEvent(new Event('input'));

      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.style.display).toBe('none');
    });

    it('validates on input after field was touched via blur', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      // Touch by blurring
      input.value = '';
      input.dispatchEvent(new Event('blur'));

      // Now type
      input.value = 'ab';
      input.dispatchEvent(new Event('input'));

      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.style.display).toBe('block');
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with form data when all fields valid', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ success: true });
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      expect(onSubmit).toHaveBeenCalledWith({
        username: 'testuser1',
        name: 'Test Parent',
        phone: '9876543210',
        email: 'test@example.com',
        password: 'Pass1234!',
      });
    });

    it('does not call onSubmit when validation fails', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ success: true });
      const { element } = createForm({ onSubmit });

      // Leave all fields empty
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('shows loading state during submission', async () => {
      let resolveSubmit: (v: { success: boolean }) => void;
      const onSubmit = vi.fn().mockImplementation(() => new Promise((r) => { resolveSubmit = r; }));
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      const btn = getSubmitButton(element);
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Registering...');

      resolveSubmit!({ success: true });
      await tick();
    });

    it('restores button after submission completes', async () => {
      const onSubmit = vi.fn().mockResolvedValue({ success: false });
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      const btn = getSubmitButton(element);
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe('Register Parent');
    });
  });

  describe('server error handling', () => {
    it('shows duplicate username message adjacent to username field', async () => {
      const onSubmit = vi.fn().mockResolvedValue({
        success: false,
        fieldErrors: [{ field: 'username', message: 'duplicate' }],
      });
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('Username already taken');
      expect(errorEl.textContent).toContain('please choose a different username');
    });

    it('shows duplicate email message adjacent to email field', async () => {
      const onSubmit = vi.fn().mockResolvedValue({
        success: false,
        fieldErrors: [{ field: 'email', message: 'duplicate' }],
      });
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      const errorEl = getErrorEl(element, 'email');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('Email already registered');
      expect(errorEl.textContent).toContain('try logging in or use a different email');
    });

    it('shows duplicate phone message adjacent to phone field', async () => {
      const onSubmit = vi.fn().mockResolvedValue({
        success: false,
        fieldErrors: [{ field: 'phone', message: 'duplicate' }],
      });
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      const errorEl = getErrorEl(element, 'phone');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('Phone number already registered');
      expect(errorEl.textContent).toContain('try logging in or use a different number');
    });

    it('shows generic error and preserves fields on 5xx (no fieldErrors)', async () => {
      const onSubmit = vi.fn().mockResolvedValue({
        success: false,
      });
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      // General error is shown
      const generalError = element.querySelector('[role="alert"]:not([id])') as HTMLElement;
      // Find the general error area (last role="alert" element that is visible)
      const alerts = element.querySelectorAll('[role="alert"]');
      let generalErrorVisible = false;
      alerts.forEach((alert) => {
        const el = alert as HTMLElement;
        if (el.style.display !== 'none' && el.textContent?.includes('Something went wrong')) {
          generalErrorVisible = true;
        }
      });
      expect(generalErrorVisible).toBe(true);

      // All field values should be preserved
      expect(getInput(element, 'username').value).toBe('testuser1');
      expect(getInput(element, 'name').value).toBe('Test Parent');
      expect(getInput(element, 'phone').value).toBe('9876543210');
      expect(getInput(element, 'email').value).toBe('test@example.com');
      expect(getInput(element, 'password').value).toBe('Pass1234!');
    });

    it('preserves all field values on network error (exception)', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
      const { element } = createForm({ onSubmit });

      fillValidData(element);
      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      // Fields preserved
      expect(getInput(element, 'username').value).toBe('testuser1');
      expect(getInput(element, 'name').value).toBe('Test Parent');
      expect(getInput(element, 'phone').value).toBe('9876543210');
      expect(getInput(element, 'email').value).toBe('test@example.com');
      expect(getInput(element, 'password').value).toBe('Pass1234!');

      // General error shown
      const alerts = element.querySelectorAll('[role="alert"]');
      let generalErrorVisible = false;
      alerts.forEach((alert) => {
        const el = alert as HTMLElement;
        if (el.style.display !== 'none' && el.textContent?.includes('Something went wrong')) {
          generalErrorVisible = true;
        }
      });
      expect(generalErrorVisible).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('sets aria-invalid="true" on invalid fields', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      input.value = '';
      input.dispatchEvent(new Event('blur'));

      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('sets aria-invalid="false" on valid fields', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      input.value = 'validuser';
      input.dispatchEvent(new Event('blur'));

      expect(input.getAttribute('aria-invalid')).toBe('false');
    });

    it('sets aria-describedby linking input to error element', () => {
      const { element } = createForm();
      const input = getInput(element, 'username');

      expect(input.getAttribute('aria-describedby')).toBe('preg-username-error');
    });

    it('error elements have role="alert"', () => {
      const { element } = createForm();
      const errorEl = getErrorEl(element, 'username');
      expect(errorEl.getAttribute('role')).toBe('alert');
    });
  });

  describe('form state preservation (Req 1.49)', () => {
    it('preserves valid field values when only some fields are invalid', async () => {
      const { element } = createForm();

      getInput(element, 'username').value = 'validuser';
      getInput(element, 'name').value = 'Valid Name';
      getInput(element, 'phone').value = '123'; // Invalid
      getInput(element, 'email').value = 'valid@test.com';
      getInput(element, 'password').value = 'Pass1234!';

      getForm(element).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await tick();

      // Valid fields still have their values
      expect(getInput(element, 'username').value).toBe('validuser');
      expect(getInput(element, 'name').value).toBe('Valid Name');
      expect(getInput(element, 'email').value).toBe('valid@test.com');
      expect(getInput(element, 'password').value).toBe('Pass1234!');

      // Only phone field has error
      expect(getErrorEl(element, 'phone').style.display).toBe('block');
      expect(getErrorEl(element, 'username').style.display).toBe('none');
      expect(getErrorEl(element, 'name').style.display).toBe('none');
      expect(getErrorEl(element, 'email').style.display).toBe('none');
    });
  });
});
