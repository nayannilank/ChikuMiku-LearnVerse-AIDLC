/**
 * StudentRegistrationView — Student (Learner) registration page for the LearnVerse web application.
 *
 * Parents use this form to register their children as learners.
 * Composes a dark auth header (with parent username) and a centered registration card.
 *
 * Requirements: 1.20–1.31, 1.24 (Gender), 1.44, 1.45
 */

import { createHeaderLogo } from '../components/HeaderLogo';
import { createPasswordStrengthIndicator } from '../components/PasswordStrengthIndicator';
import { registerStudent } from '../services/AuthService';
import { escapeHtml } from '../utils/escapeHtml';
import { getAccessToken } from '../services/api';
import '../styles/registration-view.css';

// --- Constants ---

const GRADES = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
  'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth',
] as const;

const DEFAULT_SUBJECTS = [
  'Maths', 'Science', 'Computers', 'EVS', 'Hindi', 'English', 'Kannada',
];

const SUBJECT_COLORS: Record<string, string> = {
  Maths: '#E94F9B',
  Science: '#4ECDC4',
  Computers: '#4A6CF7',
  EVS: '#27AE60',
  Hindi: '#F7C948',
  English: '#5DADE2',
  Kannada: '#9B59B6',
};

/** Subject icons matching the mockup design. */
const SUBJECT_ICONS: Record<string, string> = {
  Maths: '📐',
  Science: '🧪',
  Computers: '🖥',
  EVS: '🌿',
  Hindi: 'हि',
  English: '🅰',
  Kannada: 'ಅ',
};

const GENDER_OPTIONS: Array<{ value: 'male' | 'female' | 'other'; icon: string; label: string }> = [
  { value: 'male', icon: '👨', label: 'Male' },
  { value: 'female', icon: '👩', label: 'Female' },
  { value: 'other', icon: '🧑', label: 'Other' },
];

// Custom color cycling for custom subjects
const CUSTOM_COLORS = [
  '#FF6B6B', '#FF8E72', '#FFA94D', '#FFD43B', '#A9E34B',
  '#69DB7C', '#38D9A9', '#3BC9DB', '#4DABF7', '#748FFC',
];

// --- Helper: get parent username from token or localStorage ---

function getParentUsername(): string {
  // 1. Check localStorage for stored parent username (set on login)
  try {
    const stored = localStorage.getItem('learnverse_username');
    if (stored) return stored;
  } catch {
    // Ignore storage errors
  }

  // 2. Fall back to JWT decode
  try {
    const token = getAccessToken();
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.username || payload['cognito:username'] || 'parent';
    }
  } catch {
    // Ignore decode errors
  }

  // 3. Fall back to generic 'parent'
  return 'parent';
}

// --- Validation ---

function validateUsername(val: string): string | null {
  if (!val) return 'Username is required';
  if (val.length < 8 || val.length > 15) return 'Username must be 8-15 characters';
  if (!/^[a-z0-9_-]+$/.test(val)) return 'Only a-z, 0-9, hyphens, underscores allowed';
  return null;
}

function validateName(val: string): string | null {
  if (!val) return 'Name is required';
  if (val.length < 5 || val.length > 20) return 'Name must be 5-20 characters';
  if (!/^[a-zA-Z\s]+$/.test(val)) return 'Only alphabets and spaces allowed';
  return null;
}

function validatePassword(val: string): string | null {
  if (!val) return 'Password is required';
  if (val.length < 8 || val.length > 20) return 'Password must be 8-20 characters';
  if (!/[A-Z]/.test(val)) return 'Needs at least one uppercase letter';
  if (!/[a-z]/.test(val)) return 'Needs at least one lowercase letter';
  if (!/[0-9]/.test(val)) return 'Needs at least one number';
  if (!/[^a-zA-Z0-9\s]/.test(val)) return 'Needs at least one symbol';
  return null;
}

function validateSchoolName(val: string): string | null {
  if (!val) return 'School name is required';
  if (val.length < 5 || val.length > 30) return 'School name must be 5-30 characters';
  if (!/^[a-zA-Z0-9,\s-]+$/.test(val)) return 'Only letters, numbers, commas, hyphens allowed';
  return null;
}

/**
 * Creates the Student Registration view element.
 */
export function createStudentRegistrationView(): HTMLElement {
  const parentUsername = getParentUsername();

  const container = document.createElement('div');
  container.className = 'registration-view';

  // ===== Auth Header =====
  const header = document.createElement('header');
  header.className = 'auth-header';
  header.setAttribute('aria-label', 'Site header');

  const logo = createHeaderLogo({
    logoSrc: '/ChikuMiku-LearnVerse-Logo.png',
    maxHeight: 36,
    altText: 'ChikuMiku LearnVerse',
  });
  header.appendChild(logo);

  // Right side: "Welcome, username" + avatar
  const headerRight = document.createElement('div');
  Object.assign(headerRight.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  });

  const welcomeText = document.createElement('span');
  Object.assign(welcomeText.style, {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '600',
  });
  welcomeText.textContent = `Welcome, ${parentUsername}`;
  headerRight.appendChild(welcomeText);

  const avatar = document.createElement('div');
  Object.assign(avatar.style, {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#E94F9B',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: '700',
  });
  avatar.textContent = parentUsername.charAt(0).toUpperCase();
  avatar.setAttribute('aria-label', `Avatar for ${parentUsername}`);
  headerRight.appendChild(avatar);

  header.appendChild(headerRight);

  container.appendChild(header);

  // ===== Registration Card =====
  const card = document.createElement('div');
  card.className = 'registration-card';

  const heading = document.createElement('h1');
  heading.className = 'registration-card__heading';

  const backArrow = document.createElement('a');
  backArrow.href = '#dashboard';
  backArrow.textContent = '←';
  backArrow.setAttribute('aria-label', 'Back to dashboard');
  Object.assign(backArrow.style, {
    textDecoration: 'none',
    marginRight: '8px',
    color: '#2C2341',
    fontSize: '20px',
  });
  backArrow.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#dashboard';
  });
  heading.appendChild(backArrow);
  heading.appendChild(document.createTextNode('Register New Learner'));
  card.appendChild(heading);

  const subtitle = document.createElement('p');
  subtitle.className = 'registration-card__subtitle';
  subtitle.textContent = 'Register your child as a learner';
  card.appendChild(subtitle);

  // ===== Form =====
  const form = document.createElement('form');
  form.className = 'registration-form';
  form.noValidate = true;

  // Error elements map
  const errorElements: Record<string, HTMLElement> = {};

  // --- Helper: create a field group ---
  function createFieldGroup(id: string, labelText: string, helperText?: string): {
    group: HTMLElement;
    errorEl: HTMLElement;
  } {
    const group = document.createElement('div');
    group.className = 'form-field';

    const label = document.createElement('label');
    label.className = 'form-field__label';
    label.htmlFor = `student-reg-${id}`;
    label.textContent = labelText;
    group.appendChild(label);

    if (helperText) {
      const helper = document.createElement('span');
      Object.assign(helper.style, {
        fontSize: '10px',
        color: '#6B7280',
        marginBottom: '4px',
        display: 'block',
      });
      helper.textContent = helperText;
      group.appendChild(helper);
    }

    const errorEl = document.createElement('div');
    errorEl.className = 'form-field__error';
    errorEl.id = `student-reg-${id}-error`;
    errorEl.setAttribute('role', 'alert');
    errorEl.style.display = 'none';
    errorElements[id] = errorEl;

    return { group, errorEl };
  }

  // --- 1. Parent Username (read-only) ---
  const { group: parentGroup, errorEl: parentErr } = createFieldGroup(
    'parentUsername', 'Parent Username *'
  );
  const parentInput = document.createElement('input');
  parentInput.className = 'form-field__input';
  parentInput.type = 'text';
  parentInput.id = 'student-reg-parentUsername';
  parentInput.name = 'parentUsername';
  parentInput.value = parentUsername;
  parentInput.readOnly = true;
  parentInput.style.backgroundColor = '#f3f0f7';
  parentInput.style.cursor = 'not-allowed';
  parentGroup.appendChild(parentInput);
  parentGroup.appendChild(parentErr);
  form.appendChild(parentGroup);

  // --- 2. Learner Username ---
  const { group: usernameGroup, errorEl: usernameErr } = createFieldGroup(
    'username', 'Learner Username *', '8-15 chars, a-z/0-9/-/_'
  );
  const usernameInput = document.createElement('input');
  usernameInput.className = 'form-field__input';
  usernameInput.type = 'text';
  usernameInput.id = 'student-reg-username';
  usernameInput.name = 'username';
  usernameInput.placeholder = '8-15 characters';
  usernameInput.autocomplete = 'username';
  usernameInput.setAttribute('aria-describedby', 'student-reg-username-error');
  usernameGroup.appendChild(usernameInput);
  usernameGroup.appendChild(usernameErr);
  form.appendChild(usernameGroup);

  // --- 3. Name ---
  const { group: nameGroup, errorEl: nameErr } = createFieldGroup(
    'name', 'Name *', '5-20 chars, alphabets & spaces'
  );
  const nameInput = document.createElement('input');
  nameInput.className = 'form-field__input';
  nameInput.type = 'text';
  nameInput.id = 'student-reg-name';
  nameInput.name = 'name';
  nameInput.placeholder = '5-20 characters';
  nameInput.autocomplete = 'name';
  nameInput.setAttribute('aria-describedby', 'student-reg-name-error');
  nameGroup.appendChild(nameInput);
  nameGroup.appendChild(nameErr);
  form.appendChild(nameGroup);

  // --- 4. Password (with show/hide toggle) ---
  const { group: pwGroup, errorEl: pwErr } = createFieldGroup(
    'password', 'Password *', '8-20 chars • Uppercase • Lowercase • Number • Symbol'
  );
  const pwWrapper = document.createElement('div');
  Object.assign(pwWrapper.style, { position: 'relative', display: 'flex', alignItems: 'center' });

  const passwordInput = document.createElement('input');
  passwordInput.className = 'form-field__input';
  passwordInput.type = 'password';
  passwordInput.id = 'student-reg-password';
  passwordInput.name = 'password';
  passwordInput.placeholder = '8-20 characters';
  passwordInput.autocomplete = 'new-password';
  passwordInput.setAttribute('aria-describedby', 'student-reg-password-error');
  passwordInput.style.paddingRight = '40px';
  pwWrapper.appendChild(passwordInput);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
  Object.assign(toggleBtn.style, {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    color: '#6B7280',
  });
  toggleBtn.textContent = '👁';
  toggleBtn.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? '🙈' : '👁';
  });
  pwWrapper.appendChild(toggleBtn);
  pwGroup.appendChild(pwWrapper);

  // Password strength indicator
  const { element: strengthEl, update: strengthUpdate } = createPasswordStrengthIndicator();
  passwordInput.addEventListener('input', () => strengthUpdate(passwordInput.value));
  pwGroup.appendChild(strengthEl);
  pwGroup.appendChild(pwErr);
  form.appendChild(pwGroup);

  // --- 5. Gender (radio card group) ---
  const { group: genderGroup, errorEl: genderErr } = createFieldGroup('gender', 'Gender *');
  let selectedGender: 'male' | 'female' | 'other' | null = null;

  const genderContainer = document.createElement('div');
  genderContainer.setAttribute('role', 'radiogroup');
  genderContainer.setAttribute('aria-label', 'Gender');
  Object.assign(genderContainer.style, {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  });

  const genderCards: HTMLElement[] = [];

  GENDER_OPTIONS.forEach((opt, idx) => {
    const card2 = document.createElement('div');
    card2.setAttribute('role', 'radio');
    card2.setAttribute('aria-checked', 'false');
    card2.setAttribute('aria-label', opt.label);
    card2.setAttribute('tabindex', idx === 0 ? '0' : '-1');
    card2.dataset.value = opt.value;
    Object.assign(card2.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 20px',
      border: '2px solid #E0D8EC',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'border-color 0.2s, background-color 0.2s',
      flex: '1',
      textAlign: 'center',
      userSelect: 'none',
    });

    const icon = document.createElement('span');
    icon.style.fontSize = '24px';
    icon.textContent = opt.icon;
    card2.appendChild(icon);

    const lbl = document.createElement('span');
    Object.assign(lbl.style, { fontSize: '12px', fontWeight: '600', marginTop: '4px', color: '#2C2341' });
    lbl.textContent = opt.label;
    card2.appendChild(lbl);

    function selectGender(value: 'male' | 'female' | 'other'): void {
      selectedGender = value;
      genderCards.forEach((c) => {
        const isSelected = c.dataset.value === value;
        c.style.borderColor = isSelected ? '#E94F9B' : '#E0D8EC';
        c.style.backgroundColor = isSelected ? '#fef0f7' : '#FFFFFF';
        c.setAttribute('aria-checked', String(isSelected));
        c.setAttribute('tabindex', isSelected ? '0' : '-1');
      });
    }

    card2.addEventListener('click', () => selectGender(opt.value));
    card2.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectGender(opt.value);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = (idx + 1) % GENDER_OPTIONS.length;
        genderCards[nextIdx].focus();
        selectGender(GENDER_OPTIONS[nextIdx].value);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = (idx - 1 + GENDER_OPTIONS.length) % GENDER_OPTIONS.length;
        genderCards[prevIdx].focus();
        selectGender(GENDER_OPTIONS[prevIdx].value);
      }
    });

    genderCards.push(card2);
    genderContainer.appendChild(card2);
  });

  genderGroup.appendChild(genderContainer);
  genderGroup.appendChild(genderErr);
  form.appendChild(genderGroup);

  // --- 6. Grade (dropdown) ---
  const { group: gradeGroup, errorEl: gradeErr } = createFieldGroup('grade', 'Grade *');
  const gradeSelect = document.createElement('select');
  gradeSelect.className = 'form-field__input';
  gradeSelect.id = 'student-reg-grade';
  gradeSelect.name = 'grade';
  gradeSelect.setAttribute('aria-describedby', 'student-reg-grade-error');

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select Grade';
  defaultOption.disabled = true;
  defaultOption.selected = true;
  gradeSelect.appendChild(defaultOption);

  for (const g of GRADES) {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    gradeSelect.appendChild(opt);
  }
  gradeGroup.appendChild(gradeSelect);
  gradeGroup.appendChild(gradeErr);
  form.appendChild(gradeGroup);

  // --- 7. School Name ---
  const { group: schoolGroup, errorEl: schoolErr } = createFieldGroup(
    'schoolName', 'School Name *', '5-30 chars, letters/numbers/commas/hyphens'
  );
  const schoolInput = document.createElement('input');
  schoolInput.className = 'form-field__input';
  schoolInput.type = 'text';
  schoolInput.id = 'student-reg-schoolName';
  schoolInput.name = 'schoolName';
  schoolInput.placeholder = '5-30 characters';
  schoolInput.setAttribute('aria-describedby', 'student-reg-schoolName-error');
  schoolGroup.appendChild(schoolInput);
  schoolGroup.appendChild(schoolErr);
  form.appendChild(schoolGroup);

  // --- 8. Subjects (pill-toggle UI — no checkboxes) ---
  const { group: subjectsGroup, errorEl: subjectsErr } = createFieldGroup(
    'subjects', 'Select Subjects * (min. 1 required)'
  );

  // Track selected subjects
  const selectedSubjects = new Set<string>(DEFAULT_SUBJECTS);
  const customSubjects: string[] = [];
  let customColorIndex = 0;

  // Subject pills container
  const pillsContainer = document.createElement('div');
  Object.assign(pillsContainer.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px',
  });

  function getSubjectColor(name: string): string {
    if (SUBJECT_COLORS[name]) return SUBJECT_COLORS[name];
    const idx = customSubjects.indexOf(name);
    if (idx >= 0) return CUSTOM_COLORS[idx % CUSTOM_COLORS.length];
    return CUSTOM_COLORS[customColorIndex++ % CUSTOM_COLORS.length];
  }

  function renderPills(): void {
    pillsContainer.innerHTML = '';
    const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects];
    for (const subj of allSubjects) {
      const isSelected = selectedSubjects.has(subj);
      const color = getSubjectColor(subj);
      const icon = SUBJECT_ICONS[subj] || '📘';

      const pill = document.createElement('span');
      pill.className = `subject-pill${isSelected ? ' selected' : ''}`;
      pill.setAttribute('role', 'button');
      pill.setAttribute('aria-pressed', String(isSelected));
      pill.setAttribute('aria-label', `${subj}${isSelected ? ' (selected)' : ' (unselected)'}`);
      pill.setAttribute('tabindex', '0');

      // Mockup style: colored border, light tinted background, icon + name + ⊗
      Object.assign(pill.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        color: isSelected ? color : '#999',
        backgroundColor: isSelected ? `${color}12` : '#f9f9f9',
        border: `2px solid ${isSelected ? color : '#ddd'}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
        userSelect: 'none',
        opacity: isSelected ? '1' : '0.6',
      });

      // Icon
      const iconSpan = document.createElement('span');
      iconSpan.setAttribute('aria-hidden', 'true');
      Object.assign(iconSpan.style, { fontSize: '13px' });
      iconSpan.textContent = icon;
      pill.appendChild(iconSpan);

      // Subject name
      const nameSpan = document.createElement('span');
      nameSpan.textContent = subj;
      pill.appendChild(nameSpan);

      if (isSelected) {
        // ⊗ close/deselect button
        const closeBtn = document.createElement('span');
        closeBtn.className = 'pill-close';
        closeBtn.textContent = '⊗';
        Object.assign(closeBtn.style, {
          fontSize: '14px',
          fontWeight: '700',
          marginLeft: '2px',
          opacity: '0.7',
        });
        pill.appendChild(closeBtn);

        const handleDeselect = (): void => {
          selectedSubjects.delete(subj);
          renderPills();
        };
        pill.addEventListener('click', handleDeselect);
        pill.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleDeselect(); }
        });
      } else {
        // Click to re-select
        const handleSelect = (): void => {
          selectedSubjects.add(subj);
          renderPills();
        };
        pill.addEventListener('click', handleSelect);
        pill.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleSelect(); }
        });
      }

      pillsContainer.appendChild(pill);
    }
  }

  renderPills();
  subjectsGroup.appendChild(pillsContainer);

  // "Add Custom Subject" link
  const addNewBtn = document.createElement('button');
  addNewBtn.type = 'button';
  addNewBtn.textContent = '+ Add Custom Subject';
  Object.assign(addNewBtn.style, {
    marginTop: '10px',
    padding: '0',
    fontSize: '12px',
    fontWeight: '600',
    color: '#E94F9B',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    display: 'block',
  });

  addNewBtn.addEventListener('click', () => {
    const name = prompt('Enter custom subject name (1-50 characters):');
    if (name && name.trim().length >= 1 && name.trim().length <= 50) {
      const trimmed = name.trim();
      if (!customSubjects.includes(trimmed) && !DEFAULT_SUBJECTS.includes(trimmed)) {
        customSubjects.push(trimmed);
        selectedSubjects.add(trimmed);
        renderPills();
      }
    }
  });

  subjectsGroup.appendChild(addNewBtn);
  subjectsGroup.appendChild(subjectsErr);
  form.appendChild(subjectsGroup);

  // --- 9. Submit Button ---
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'registration-form__submit';
  submitButton.textContent = 'Register Learner';
  form.appendChild(submitButton);

  card.appendChild(form);
  container.appendChild(card);

  // ===== Form Submission =====

  function showError(field: string, msg: string): void {
    const el = errorElements[field];
    if (el) {
      el.innerHTML = `<span>${escapeHtml(msg)}</span>`;
      el.style.display = 'block';
    }
  }

  function clearErrors(): void {
    for (const el of Object.values(errorElements)) {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }

  function setLoading(loading: boolean): void {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? 'Registering...' : 'Register Learner';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    // Validate
    let hasErrors = false;

    const uErr = validateUsername(usernameInput.value);
    if (uErr) { showError('username', uErr); hasErrors = true; }

    const nErr = validateName(nameInput.value);
    if (nErr) { showError('name', nErr); hasErrors = true; }

    const pErr = validatePassword(passwordInput.value);
    if (pErr) { showError('password', pErr); hasErrors = true; }

    if (!selectedGender) {
      showError('gender', 'Please select a gender');
      hasErrors = true;
    }

    if (!gradeSelect.value) {
      showError('grade', 'Please select a grade');
      hasErrors = true;
    }

    const sErr = validateSchoolName(schoolInput.value);
    if (sErr) { showError('schoolName', sErr); hasErrors = true; }

    if (selectedSubjects.size === 0) {
      showError('subjects', 'At least one subject must be selected');
      hasErrors = true;
    }

    if (hasErrors) return;

    setLoading(true);

    // Build subjects array (default names as IDs for now)
    const subjectsArray = [...selectedSubjects].filter(
      (s) => DEFAULT_SUBJECTS.includes(s)
    );
    const customSubjectPayload = [...selectedSubjects]
      .filter((s) => !DEFAULT_SUBJECTS.includes(s))
      .map((name) => ({ name }));

    const result = await registerStudent({
      parentUsername,
      studentUsername: usernameInput.value,
      name: nameInput.value,
      password: passwordInput.value,
      gender: selectedGender!,
      grade: gradeSelect.value,
      schoolName: schoolInput.value,
      subjects: subjectsArray,
      customSubjects: customSubjectPayload.length > 0 ? customSubjectPayload : undefined,
    });

    setLoading(false);

    // Remove any previous banner
    const existingBanner = form.querySelector('.reg-banner');
    if (existingBanner) existingBanner.remove();

    if (result.success) {
      const banner = document.createElement('div');
      banner.className = 'reg-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      Object.assign(banner.style, {
        marginTop: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        color: '#166534',
        backgroundColor: '#f0fdf4',
        border: '1px solid #bbf7d0',
        fontSize: '13px',
        fontWeight: '600',
        textAlign: 'center',
      });
      banner.textContent = '✓ Learner registered successfully!';
      form.appendChild(banner);

      setTimeout(() => {
        window.location.hash = '#dashboard';
      }, 3000);
    } else {
      const banner = document.createElement('div');
      banner.className = 'reg-banner';
      banner.setAttribute('role', 'alert');
      banner.setAttribute('aria-live', 'assertive');
      Object.assign(banner.style, {
        marginTop: '0.75rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        color: '#991b1b',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        fontSize: '13px',
        fontWeight: '500',
        textAlign: 'center',
      });
      banner.innerHTML = `<span>${escapeHtml(result.error || 'Registration failed. Please try again.')}</span>`;
      form.appendChild(banner);
    }
  });

  return container;
}
