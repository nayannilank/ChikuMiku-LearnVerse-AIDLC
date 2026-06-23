/**
 * PasswordStrengthIndicator — Framework-agnostic password strength indicator component.
 *
 * Evaluates a password against five criteria (uppercase, lowercase, number, symbol,
 * minimum length) and renders a visual indicator showing which criteria are met.
 * Each criterion displays a green checkmark (#27AE60) when satisfied and a neutral
 * gray indicator when not.
 *
 * Usage:
 *   import { createPasswordStrengthIndicator } from './components/PasswordStrengthIndicator';
 *   const { element, update } = createPasswordStrengthIndicator();
 *   document.body.appendChild(element);
 *   passwordInput.addEventListener('input', () => update(passwordInput.value));
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
 */

/**
 * Represents the evaluation result of a password against each strength criterion.
 */
export interface PasswordCriteria {
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
  minLength: boolean;
}

/** Criterion definition mapping keys to display labels. */
interface CriterionDef {
  key: keyof PasswordCriteria;
  label: string;
}

const CRITERIA: CriterionDef[] = [
  { key: 'uppercase', label: 'Uppercase' },
  { key: 'lowercase', label: 'Lowercase' },
  { key: 'number', label: 'Number' },
  { key: 'symbol', label: 'Symbol' },
  { key: 'minLength', label: '8+ chars' },
];

/** Color for a met criterion (green checkmark). */
const COLOR_MET = '#27AE60';
/** Color for an unmet criterion (neutral gray). */
const COLOR_UNMET = '#6B7280';
/** Text color for criterion labels. */
const COLOR_TEXT = '#2C2341';

/**
 * Evaluates a password string against all five strength criteria.
 *
 * - `uppercase`: true if the password contains at least one uppercase letter (/[A-Z]/)
 * - `lowercase`: true if the password contains at least one lowercase letter (/[a-z]/)
 * - `number`: true if the password contains at least one digit (/[0-9]/)
 * - `symbol`: true if the password contains at least one non-alphanumeric character (/[^a-zA-Z0-9]/)
 * - `minLength`: true if the password length is >= 8
 *
 * @param password - The password string to evaluate.
 * @returns An object with boolean values for each criterion.
 */
export function evaluatePasswordStrength(password: string): PasswordCriteria {
  return {
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
    minLength: password.length >= 8,
  };
}

/**
 * Creates a password strength indicator DOM element.
 *
 * The returned object contains:
 * - `element`: An HTMLElement rendering five criteria labels with status indicators
 * - `update(password)`: A function that re-evaluates the password and updates the DOM
 *
 * The indicator is hidden (display: none) when the password is empty, and visible
 * when the password has content. Each criterion shows a green checkmark (✓) when met
 * and a gray circle (○) when not met.
 *
 * @returns Object with the indicator element and an update function.
 */
export function createPasswordStrengthIndicator(): {
  element: HTMLElement;
  update: (password: string) => void;
} {
  const container = document.createElement('div');
  container.className = 'password-strength-indicator';
  Object.assign(container.style, {
    display: 'none',
    flexWrap: 'wrap',
    gap: '6px 12px',
    marginTop: '8px',
    padding: '8px 0',
  });

  /** Map of criterion key to its DOM elements for efficient updates. */
  const criterionElements: Map<keyof PasswordCriteria, { icon: HTMLSpanElement; label: HTMLSpanElement }> = new Map();

  for (const { key, label } of CRITERIA) {
    const item = document.createElement('span');
    item.className = 'password-criterion';
    item.setAttribute('data-criterion', key);
    Object.assign(item.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '11px',
      fontWeight: '500',
    });

    const icon = document.createElement('span');
    icon.className = 'password-criterion__icon';
    icon.textContent = '○';
    Object.assign(icon.style, {
      color: COLOR_UNMET,
      fontSize: '12px',
      lineHeight: '1',
    });

    const labelEl = document.createElement('span');
    labelEl.className = 'password-criterion__label';
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      color: COLOR_TEXT,
    });

    item.appendChild(icon);
    item.appendChild(labelEl);
    container.appendChild(item);

    criterionElements.set(key, { icon, label: labelEl });
  }

  /**
   * Updates the indicator based on the current password value.
   * Hides the indicator when password is empty, shows it otherwise.
   * Re-evaluates all criteria and updates icons/colors.
   */
  function update(password: string): void {
    if (password.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';

    const criteria = evaluatePasswordStrength(password);

    for (const { key } of CRITERIA) {
      const els = criterionElements.get(key);
      if (!els) continue;

      const met = criteria[key];
      els.icon.textContent = met ? '✓' : '○';
      els.icon.style.color = met ? COLOR_MET : COLOR_UNMET;
    }
  }

  return { element: container, update };
}
