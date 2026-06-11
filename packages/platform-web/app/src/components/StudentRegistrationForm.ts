/**
 * StudentRegistrationForm — Registration form for student accounts, accessible
 * only after parent authentication via the ParentLoginGate.
 *
 * Creates an HTMLElement containing a form with parent username (read-only),
 * student username, name, grade dropdown, and school name fields. Includes
 * inline validation, loading state, success/error messaging, and auto-navigation.
 *
 * Usage:
 *   import { createStudentRegistrationForm } from './components/StudentRegistrationForm';
 *   document.body.appendChild(createStudentRegistrationForm({
 *     parentUsername: 'parent_user',
 *     parentToken: 'auth-token',
 *     onSuccess: () => { ... },
 *   }));
 *
 * Validates: Requirements 7.1–7.7, 8.1–8.8, 9.1–9.4, 13.2, 13.3, 13.6
 */

import { registerStudent } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';
import {
  validate,
  lengthValidator,
  charsetValidator,
  requiredValidator,
} from '../validation/ValidationEngine';
import type { ExtendedFieldRule } from '../validation/ValidationEngine';

/**
 * Configuration options for the StudentRegistrationForm component.
 */
export interface StudentRegistrationFormOptions {
  /** The authenticated parent's username (displayed read-only). */
  parentUsername: string;
  /** The parent's authentication token for the Authorization header. */
  parentToken: string;
  /** Callback invoked on successful registration. */
  onSuccess: () => void;
}

/** Grade options available in the dropdown (Req 7.5). */
const GRADE_OPTIONS = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
  'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth',
];

const BUTTON_TEXT_DEFAULT = 'Register Student';
const BUTTON_TEXT_LOADING = 'Registering...';

/** Navigation delay after successful registration (ms). */
const SUCCESS_NAVIGATE_DELAY = 3000;

/**
 * Validation rules for the student registration form (Req 8.1–8.7).
 */
const VALIDATION_RULES: ExtendedFieldRule[] = [
  {
    fieldName: 'studentUsername',
    validators: [
      requiredValidator(),
      lengthValidator(8, 15),
      charsetValidator(/[a-zA-Z0-9_\-]/),
    ],
  },
  {
    fieldName: 'name',
    validators: [
      requiredValidator(),
      lengthValidator(5, 20),
      charsetValidator(/[a-zA-Z ]/),
    ],
  },
  {
    fieldName: 'grade',
    validators: [
      requiredValidator(),
    ],
  },
  {
    fieldName: 'schoolName',
    validators: [
      requiredValidator(),
      lengthValidator(5, 20),
      charsetValidator(/[a-zA-Z ,\-]/),
    ],
  },
];

/**
 * Creates a student registration form DOM element with all required fields,
 * validation, loading state, and success/error messaging.
 *
 * @param options - Configuration with parentUsername, parentToken, and onSuccess callback.
 * @returns An HTMLElement containing the student registration form UI.
 */
export function createStudentRegistrationForm(options: StudentRegistrationFormOptions): HTMLElement {
  const { parentUsername, parentToken, onSuccess } = options;

  // Container
  const container = document.createElement('div');
  container.className = 'student-registration-form-container';

  // Form
  const form = document.createElement('form');
  form.className = 'student-registration-form';
  form.noValidate = true;

  // --- Parent Username form group (Req 7.2, 13.2, 13.6: read-only with aria-readonly) ---
  const parentUsernameGroup = document.createElement('div');
  parentUsernameGroup.className = 'form-group';

  const parentUsernameLabel = document.createElement('label');
  parentUsernameLabel.htmlFor = 'student-reg-parent-username';
  parentUsernameLabel.textContent = 'Parent Username';

  const parentUsernameInput = document.createElement('input');
  parentUsernameInput.type = 'text';
  parentUsernameInput.id = 'student-reg-parent-username';
  parentUsernameInput.name = 'parentUsername';
  parentUsernameInput.value = parentUsername;
  parentUsernameInput.readOnly = true;
  parentUsernameInput.setAttribute('aria-readonly', 'true');

  parentUsernameGroup.appendChild(parentUsernameLabel);
  parentUsernameGroup.appendChild(parentUsernameInput);

  // --- Student Username form group (Req 7.3, 13.2) ---
  const studentUsernameGroup = document.createElement('div');
  studentUsernameGroup.className = 'form-group';

  const studentUsernameLabel = document.createElement('label');
  studentUsernameLabel.htmlFor = 'student-reg-username';
  studentUsernameLabel.textContent = 'Student Username';

  const studentUsernameInput = document.createElement('input');
  studentUsernameInput.type = 'text';
  studentUsernameInput.id = 'student-reg-username';
  studentUsernameInput.name = 'studentUsername';

  const studentUsernameError = document.createElement('div');
  studentUsernameError.id = 'student-reg-username-error';
  studentUsernameError.className = 'form-group__error';
  studentUsernameError.style.display = 'none';

  studentUsernameGroup.appendChild(studentUsernameLabel);
  studentUsernameGroup.appendChild(studentUsernameInput);
  studentUsernameGroup.appendChild(studentUsernameError);

  // --- Name form group (Req 7.4, 13.2) ---
  const nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';

  const nameLabel = document.createElement('label');
  nameLabel.htmlFor = 'student-reg-name';
  nameLabel.textContent = 'Name';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'student-reg-name';
  nameInput.name = 'name';

  const nameError = document.createElement('div');
  nameError.id = 'student-reg-name-error';
  nameError.className = 'form-group__error';
  nameError.style.display = 'none';

  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  nameGroup.appendChild(nameError);

  // --- Grade dropdown form group (Req 7.5, 13.2) ---
  const gradeGroup = document.createElement('div');
  gradeGroup.className = 'form-group';

  const gradeLabel = document.createElement('label');
  gradeLabel.htmlFor = 'student-reg-grade';
  gradeLabel.textContent = 'Grade';

  const gradeSelect = document.createElement('select');
  gradeSelect.id = 'student-reg-grade';
  gradeSelect.name = 'grade';

  // Default disabled option so requiredValidator can detect empty selection
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Select Grade --';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  gradeSelect.appendChild(defaultOption);

  for (const grade of GRADE_OPTIONS) {
    const option = document.createElement('option');
    option.value = grade;
    option.textContent = grade;
    gradeSelect.appendChild(option);
  }

  const gradeError = document.createElement('div');
  gradeError.id = 'student-reg-grade-error';
  gradeError.className = 'form-group__error';
  gradeError.style.display = 'none';

  gradeGroup.appendChild(gradeLabel);
  gradeGroup.appendChild(gradeSelect);
  gradeGroup.appendChild(gradeError);

  // --- School Name form group (Req 7.6, 13.2) ---
  const schoolNameGroup = document.createElement('div');
  schoolNameGroup.className = 'form-group';

  const schoolNameLabel = document.createElement('label');
  schoolNameLabel.htmlFor = 'student-reg-school-name';
  schoolNameLabel.textContent = 'School Name';

  const schoolNameInput = document.createElement('input');
  schoolNameInput.type = 'text';
  schoolNameInput.id = 'student-reg-school-name';
  schoolNameInput.name = 'schoolName';

  const schoolNameError = document.createElement('div');
  schoolNameError.id = 'student-reg-school-name-error';
  schoolNameError.className = 'form-group__error';
  schoolNameError.style.display = 'none';

  schoolNameGroup.appendChild(schoolNameLabel);
  schoolNameGroup.appendChild(schoolNameInput);
  schoolNameGroup.appendChild(schoolNameError);

  // --- Submit button (Req 7.7, 9.3: loading state) ---
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'student-registration-form__submit';
  submitButton.textContent = BUTTON_TEXT_DEFAULT;

  // Append all groups to form
  form.appendChild(parentUsernameGroup);
  form.appendChild(studentUsernameGroup);
  form.appendChild(nameGroup);
  form.appendChild(gradeGroup);
  form.appendChild(schoolNameGroup);
  form.appendChild(submitButton);

  container.appendChild(form);

  // --- API Error message area (Req 9.4: display error below form) ---
  const errorArea = document.createElement('div');
  errorArea.className = 'student-registration-form__error';
  errorArea.setAttribute('role', 'alert');
  errorArea.style.display = 'none';

  container.appendChild(errorArea);

  // --- Success message area (Req 9.2: success message + navigation) ---
  const successArea = document.createElement('div');
  successArea.className = 'student-registration-form__success';
  successArea.style.display = 'none';

  container.appendChild(successArea);

  // --- Error element map for aria-describedby association ---
  const errorElements: Record<string, { element: HTMLElement; input: HTMLElement }> = {
    studentUsername: { element: studentUsernameError, input: studentUsernameInput },
    name: { element: nameError, input: nameInput },
    grade: { element: gradeError, input: gradeSelect },
    schoolName: { element: schoolNameError, input: schoolNameInput },
  };

  // --- Helpers ---
  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? BUTTON_TEXT_LOADING : BUTTON_TEXT_DEFAULT;
  }

  function showApiError(message: string): void {
    errorArea.innerHTML = `<span class="student-registration-form__error-message">${escapeHtml(message)}</span>`;
    errorArea.style.display = 'block';
  }

  function clearApiError(): void {
    errorArea.innerHTML = '';
    errorArea.style.display = 'none';
  }

  function showInlineErrors(errors: Record<string, string>): void {
    for (const [fieldName, entry] of Object.entries(errorElements)) {
      const errorMessage = errors[fieldName];
      if (errorMessage) {
        entry.element.innerHTML = `<span>${escapeHtml(errorMessage)}</span>`;
        entry.element.style.display = 'block';
        // Req 8.8, 13.3: associate error with input via aria-describedby
        entry.input.setAttribute('aria-describedby', entry.element.id);
      } else {
        entry.element.innerHTML = '';
        entry.element.style.display = 'none';
        entry.input.removeAttribute('aria-describedby');
      }
    }
  }

  function clearInlineErrors(): void {
    for (const entry of Object.values(errorElements)) {
      entry.element.innerHTML = '';
      entry.element.style.display = 'none';
      entry.input.removeAttribute('aria-describedby');
    }
  }

  function showSuccess(): void {
    form.style.display = 'none';
    clearApiError();
    successArea.innerHTML = `
      <p class="student-registration-form__success-message">${escapeHtml('Student registered successfully!')}</p>
      <a href="#" class="student-registration-form__login-link">Go to Login</a>
    `;
    successArea.style.display = 'block';

    // Req 9.2: navigate to login view after 3 seconds
    setTimeout(() => {
      window.location.hash = '#';
      onSuccess();
    }, SUCCESS_NAVIGATE_DELAY);
  }

  // --- Form submit handler ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearApiError();
    clearInlineErrors();

    // Gather values
    const values: Record<string, string> = {
      studentUsername: studentUsernameInput.value,
      name: nameInput.value,
      grade: gradeSelect.value,
      schoolName: schoolNameInput.value,
    };

    // Req 8.1–8.7: validate form fields
    const result = validate(VALIDATION_RULES, values);

    if (!result.valid) {
      // Req 8.8: show inline errors with aria-describedby
      showInlineErrors(result.errors);
      return;
    }

    // Req 9.3: set loading state
    setLoading(true);

    // Req 9.1: call registerStudent with form data and parent token
    const response = await registerStudent(
      {
        parentUsername,
        studentUsername: values.studentUsername,
        name: values.name,
        grade: values.grade,
        schoolName: values.schoolName,
      },
      parentToken
    );

    if (response.success) {
      // Req 9.2: show success message and navigate
      setLoading(false);
      showSuccess();
    } else {
      // Req 9.4: on API error, display error below form and hide inline errors
      setLoading(false);
      clearInlineErrors();
      const message = response.error || 'Registration failed. Please try again.';
      showApiError(message);
    }
  });

  return container;
}
