/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { evaluatePasswordStrength, createPasswordStrengthIndicator } from '../PasswordStrengthIndicator';

describe('PasswordStrengthIndicator', () => {
  describe('DOM structure', () => {
    it('renders a container with class "password-strength-indicator"', () => {
      const { element } = createPasswordStrengthIndicator();
      expect(element.classList.contains('password-strength-indicator')).toBe(true);
    });

    it('contains five criterion elements with correct labels', () => {
      const { element } = createPasswordStrengthIndicator();
      const criteria = element.querySelectorAll('.password-criterion');
      expect(criteria.length).toBe(5);

      const labels = Array.from(criteria).map(
        (el) => el.querySelector('.password-criterion__label')?.textContent
      );
      expect(labels).toEqual(['Uppercase', 'Lowercase', 'Number', 'Symbol', '8+ chars']);
    });

    it('each criterion has a data-criterion attribute', () => {
      const { element } = createPasswordStrengthIndicator();
      const criteria = element.querySelectorAll('.password-criterion');
      const attrs = Array.from(criteria).map((el) => el.getAttribute('data-criterion'));
      expect(attrs).toEqual(['uppercase', 'lowercase', 'number', 'symbol', 'minLength']);
    });
  });

  describe('evaluatePasswordStrength', () => {
    it('returns all false for empty string', () => {
      expect(evaluatePasswordStrength('')).toEqual({
        uppercase: false,
        lowercase: false,
        number: false,
        symbol: false,
        minLength: false,
      });
    });

    it('returns all true for "Abc1!xyz"', () => {
      expect(evaluatePasswordStrength('Abc1!xyz')).toEqual({
        uppercase: true,
        lowercase: true,
        number: true,
        symbol: true,
        minLength: true,
      });
    });

    it('returns only uppercase true for "A"', () => {
      expect(evaluatePasswordStrength('A')).toEqual({
        uppercase: true,
        lowercase: false,
        number: false,
        symbol: false,
        minLength: false,
      });
    });

    it('returns lowercase and minLength true for "abcdefgh"', () => {
      expect(evaluatePasswordStrength('abcdefgh')).toEqual({
        uppercase: false,
        lowercase: true,
        number: false,
        symbol: false,
        minLength: true,
      });
    });

    it('returns number and symbol true for "1@"', () => {
      expect(evaluatePasswordStrength('1@')).toEqual({
        uppercase: false,
        lowercase: false,
        number: true,
        symbol: true,
        minLength: false,
      });
    });
  });

  describe('green checkmark display', () => {
    it('shows "✓" with color #27AE60 when criterion is met', () => {
      const { element, update } = createPasswordStrengthIndicator();
      update('A');

      const uppercaseCriterion = element.querySelector('[data-criterion="uppercase"]');
      const icon = uppercaseCriterion?.querySelector('.password-criterion__icon') as HTMLElement;
      expect(icon.textContent).toBe('✓');
      // jsdom normalizes hex to rgb
      expect(icon.style.color).toBe('rgb(39, 174, 96)');
    });

    it('shows "○" with color #6B7280 when criterion is not met', () => {
      const { element, update } = createPasswordStrengthIndicator();
      update('a');

      const uppercaseCriterion = element.querySelector('[data-criterion="uppercase"]');
      const icon = uppercaseCriterion?.querySelector('.password-criterion__icon') as HTMLElement;
      expect(icon.textContent).toBe('○');
      // jsdom normalizes hex to rgb
      expect(icon.style.color).toBe('rgb(107, 114, 128)');
    });
  });

  describe('visibility toggle', () => {
    it('is initially hidden (display: none)', () => {
      const { element } = createPasswordStrengthIndicator();
      expect(element.style.display).toBe('none');
    });

    it('becomes visible (display: flex) after update with content', () => {
      const { element, update } = createPasswordStrengthIndicator();
      update('a');
      expect(element.style.display).toBe('flex');
    });

    it('becomes hidden again (display: none) after update with empty string', () => {
      const { element, update } = createPasswordStrengthIndicator();
      update('a');
      expect(element.style.display).toBe('flex');

      update('');
      expect(element.style.display).toBe('none');
    });
  });
});
