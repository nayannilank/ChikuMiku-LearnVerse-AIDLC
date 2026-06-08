/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { createHeader } from './Header';
import { createBackgroundWatermark } from './BackgroundWatermark';
import { createLoginCard } from './LoginCard';

describe('Header', () => {
  it('renders logo with correct src, alt, and maxHeight', () => {
    const header = createHeader({ onRegisterClick: () => {} });
    const img = header.querySelector('img');

    expect(img).not.toBeNull();
    expect(img!.src).toContain('/ChikuMiku-LearnVerse-Logo.png');
    expect(img!.alt).toBe('ChikuMiku LearnVerse');
    expect(img!.style.maxHeight).toBe('40px');
  });

  it('register button is clickable and fires callback', () => {
    const onRegisterClick = vi.fn();
    const header = createHeader({ onRegisterClick });
    const button = header.querySelector('button.register-btn') as HTMLButtonElement;

    expect(button).not.toBeNull();
    button.click();
    expect(onRegisterClick).toHaveBeenCalledTimes(1);
  });
});

describe('BackgroundWatermark', () => {
  it('has correct class name for CSS styling (opacity, pointer-events, min-width)', () => {
    const watermark = createBackgroundWatermark();

    expect(watermark.className).toBe('background-watermark');
  });

  it('contains an img element with logo src', () => {
    const watermark = createBackgroundWatermark();
    const img = watermark.querySelector('img');

    expect(img).not.toBeNull();
    expect(img!.src).toContain('/ChikuMiku-LearnVerse-Logo.png');
  });

  it('hides container on image load error', () => {
    const watermark = createBackgroundWatermark();
    const img = watermark.querySelector('img')!;

    img.dispatchEvent(new Event('error'));

    expect(watermark.style.display).toBe('none');
  });
});

describe('LoginCard', () => {
  function createDefaultCard() {
    return createLoginCard({
      onForgotPassword: () => {},
      onSubmit: async () => {},
    });
  }

  describe('structure', () => {
    it('has username input with matching label for/id', () => {
      const card = createDefaultCard();
      const label = card.querySelector('label[for="username"]');
      const input = card.querySelector('input#username');

      expect(label).not.toBeNull();
      expect(input).not.toBeNull();
      expect(label!.textContent).toBe('Username');
    });

    it('has password input with matching label for/id', () => {
      const card = createDefaultCard();
      const label = card.querySelector('label[for="password"]');
      const input = card.querySelector('input#password');

      expect(label).not.toBeNull();
      expect(input).not.toBeNull();
      expect(label!.textContent).toBe('Password');
    });

    it('has submit button labeled "Log In"', () => {
      const card = createDefaultCard();
      const button = card.querySelector('button[type="submit"]') as HTMLButtonElement;

      expect(button).not.toBeNull();
      expect(button.textContent).toBe('Log In');
    });

    it('has login-card class on the card container', () => {
      const wrapper = createDefaultCard();
      const card = wrapper.querySelector('.login-card');

      expect(card).not.toBeNull();
    });
  });

  describe('form submission', () => {
    it('shows loading state: button disabled and text changes', async () => {
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });

      const card = createLoginCard({
        onForgotPassword: () => {},
        onSubmit: async () => {
          await submitPromise;
        },
      });

      const usernameInput = card.querySelector('input#username') as HTMLInputElement;
      const passwordInput = card.querySelector('input#password') as HTMLInputElement;
      const submitButton = card.querySelector('button[type="submit"]') as HTMLButtonElement;
      const form = card.querySelector('form') as HTMLFormElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'testpass';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Allow microtask to process
      await new Promise((r) => setTimeout(r, 0));

      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toBe('Signing in...');

      resolveSubmit!();
      await new Promise((r) => setTimeout(r, 0));
    });

    it('displays error message on submission failure', async () => {
      const card = createLoginCard({
        onForgotPassword: () => {},
        onSubmit: async () => {
          throw new Error('Invalid credentials');
        },
      });

      const usernameInput = card.querySelector('input#username') as HTMLInputElement;
      const passwordInput = card.querySelector('input#password') as HTMLInputElement;
      const form = card.querySelector('form') as HTMLFormElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'wrongpass';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 0));

      const messageArea = card.querySelector('#message-area') as HTMLElement;
      expect(messageArea.style.display).toBe('block');
      expect(messageArea.textContent).toContain('Invalid credentials');
    });

    it('re-enables button after submission failure', async () => {
      const card = createLoginCard({
        onForgotPassword: () => {},
        onSubmit: async () => {
          throw new Error('Login failed');
        },
      });

      const usernameInput = card.querySelector('input#username') as HTMLInputElement;
      const passwordInput = card.querySelector('input#password') as HTMLInputElement;
      const submitButton = card.querySelector('button[type="submit"]') as HTMLButtonElement;
      const form = card.querySelector('form') as HTMLFormElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'wrongpass';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 0));

      expect(submitButton.disabled).toBe(false);
      expect(submitButton.textContent).toBe('Log In');
    });

    it('keeps loading state on successful submission', async () => {
      const card = createLoginCard({
        onForgotPassword: () => {},
        onSubmit: async () => {},
      });

      const usernameInput = card.querySelector('input#username') as HTMLInputElement;
      const passwordInput = card.querySelector('input#password') as HTMLInputElement;
      const submitButton = card.querySelector('button[type="submit"]') as HTMLButtonElement;
      const form = card.querySelector('form') as HTMLFormElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'testpass';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 0));

      // On success, loading state is maintained (parent handles navigation)
      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toBe('Signing in...');
    });
  });

  describe('network error handling', () => {
    it('displays network error message', async () => {
      const card = createLoginCard({
        onForgotPassword: () => {},
        onSubmit: async () => {
          throw new Error('Unable to connect. Please check your internet connection.');
        },
      });

      const usernameInput = card.querySelector('input#username') as HTMLInputElement;
      const passwordInput = card.querySelector('input#password') as HTMLInputElement;
      const form = card.querySelector('form') as HTMLFormElement;

      usernameInput.value = 'testuser';
      passwordInput.value = 'testpass';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await new Promise((r) => setTimeout(r, 0));

      const messageArea = card.querySelector('#message-area') as HTMLElement;
      expect(messageArea.style.display).toBe('block');
      expect(messageArea.textContent).toContain('Unable to connect');
    });
  });

  describe('accessibility', () => {
    it('sets aria-describedby on username input when validation error occurs', () => {
      const card = createDefaultCard();
      const form = card.querySelector('form') as HTMLFormElement;
      const usernameInput = card.querySelector('input#username') as HTMLInputElement;

      // Leave username empty to trigger validation
      usernameInput.value = '';
      (card.querySelector('input#password') as HTMLInputElement).value = 'somepass';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      expect(usernameInput.getAttribute('aria-describedby')).toBe('username-error');
    });

    it('sets aria-describedby on password input when validation error occurs', () => {
      const card = createDefaultCard();
      const form = card.querySelector('form') as HTMLFormElement;
      const passwordInput = card.querySelector('input#password') as HTMLInputElement;

      (card.querySelector('input#username') as HTMLInputElement).value = 'testuser';
      passwordInput.value = '';

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      expect(passwordInput.getAttribute('aria-describedby')).toBe('password-error');
    });

    it('all inputs have associated labels', () => {
      const card = createDefaultCard();
      const inputs = card.querySelectorAll('input');

      inputs.forEach((input) => {
        const id = input.id;
        const label = card.querySelector(`label[for="${id}"]`);
        expect(label).not.toBeNull();
      });
    });
  });

  describe('responsive', () => {
    it('login-card-wrapper class is applied for max-width styling', () => {
      const wrapper = createDefaultCard();
      expect(wrapper.className).toBe('login-card-wrapper');
    });
  });

  describe('forgot-password link', () => {
    it('is present with correct text', () => {
      const card = createDefaultCard();
      const link = card.querySelector('a.forgot-password-link') as HTMLAnchorElement;

      expect(link).not.toBeNull();
      expect(link.textContent).toBe('Forgot password?');
    });

    it('triggers onForgotPassword callback when clicked', () => {
      const onForgotPassword = vi.fn();
      const card = createLoginCard({
        onForgotPassword,
        onSubmit: async () => {},
      });

      const link = card.querySelector('a.forgot-password-link') as HTMLAnchorElement;
      link.click();

      expect(onForgotPassword).toHaveBeenCalledTimes(1);
    });
  });
});
