/**
 * StudentRegistrationForm — React component for registering a student account.
 *
 * Pre-filled parent username (read-only), student fields with inline validation,
 * grade dropdown, subject checkboxes with "Add Subject" for custom subjects,
 * and minimum 1 subject validation.
 *
 * Validates: Requirements 1.20–1.30, 1.44–1.49
 */

import React, { useState, useCallback, useRef, type FormEvent } from 'react';

export interface StudentRegistrationFormProps {
  parentUsername: string;
  onSubmit: (data: {
    parentUsername: string;
    username: string;
    name: string;
    password: string;
    grade: string;
    schoolName: string;
    subjects: string[];
    customSubjects: Array<{ name: string }>;
  }) => Promise<{ success: boolean; fieldErrors?: Array<{ field: string; message: string }> }>;
  onBack?: () => void;
  isLoading?: boolean;
}

const COLORS = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  background: '#F8F5FF',
  border: '#E0D8EC',
  dark: '#2C2341',
  white: '#FFFFFF',
  error: '#E74C3C',
  errorBg: '#FDF2F2',
  green: '#27AE60',
  muted: '#6B7280',
} as const;

const DEFAULT_SUBJECTS = ['Maths', 'Science', 'Computers', 'EVS', 'Hindi', 'English', 'Kannada'];

const GRADE_OPTIONS = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth', 'Fifth',
  'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth',
];

// Validation helpers
const VALIDATORS = {
  username: (value: string): string | null => {
    if (!value) return 'Username is required';
    if (value.length < 8 || value.length > 15) return 'Username must be 8-15 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) return 'Only letters, numbers, hyphens, and underscores allowed';
    return null;
  },
  name: (value: string): string | null => {
    if (!value) return 'Name is required';
    if (value.length < 5 || value.length > 20) return 'Name must be 5-20 characters';
    if (!/^[a-zA-Z ]+$/.test(value)) return 'Only alphabets and spaces allowed';
    return null;
  },
  password: (value: string): string | null => {
    if (!value) return 'Password is required';
    if (value.length < 8 || value.length > 20) return 'Password must be 8-20 characters';
    if (!/[A-Z]/.test(value)) return 'Must contain at least one uppercase letter';
    if (!/[a-z]/.test(value)) return 'Must contain at least one lowercase letter';
    if (!/[0-9]/.test(value)) return 'Must contain at least one number';
    if (!/[^a-zA-Z0-9]/.test(value)) return 'Must contain at least one special character';
    return null;
  },
  schoolName: (value: string): string | null => {
    if (!value) return 'School name is required';
    if (value.length < 5 || value.length > 30) return 'School name must be 5-30 characters';
    if (!/^[a-zA-Z0-9, -]+$/.test(value)) return 'Only letters, numbers, commas, and hyphens allowed';
    return null;
  },
  grade: (value: string): string | null => {
    if (!value) return 'Please select a grade';
    return null;
  },
  customSubjectName: (value: string): string | null => {
    if (!value) return 'Subject name is required';
    if (value.length < 1 || value.length > 50) return 'Subject name must be 1-50 characters';
    return null;
  },
} as const;

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  } as React.CSSProperties,

  card: {
    backgroundColor: COLORS.white,
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '32px 28px',
    width: '100%',
    maxWidth: '480px',
  } as React.CSSProperties,

  heading: {
    fontSize: '18px',
    fontWeight: 700,
    color: COLORS.dark,
    margin: '0 0 4px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  subtitle: {
    fontSize: '13px',
    fontWeight: 400,
    color: COLORS.muted,
    margin: '0 0 20px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  fieldGroup: {
    marginBottom: '14px',
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: '4px',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  inputError: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.error}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  inputReadOnly: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
    backgroundColor: '#F3F4F6',
    color: COLORS.muted,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
    backgroundColor: COLORS.white,
    appearance: 'none' as const,
  } as React.CSSProperties,

  selectError: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.error}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
    backgroundColor: COLORS.white,
    appearance: 'none' as const,
  } as React.CSSProperties,

  errorText: {
    fontSize: '11px',
    color: COLORS.error,
    marginTop: '4px',
  } as React.CSSProperties,

  sectionLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: COLORS.dark,
    marginBottom: '8px',
  } as React.CSSProperties,

  subjectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '10px',
  } as React.CSSProperties,

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: COLORS.dark,
    cursor: 'pointer',
  } as React.CSSProperties,

  checkbox: {
    accentColor: COLORS.primary,
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  } as React.CSSProperties,

  addSubjectRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    marginTop: '8px',
  } as React.CSSProperties,

  addSubjectInput: {
    flex: 1,
    padding: '8px 10px',
    fontSize: '12px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    outline: 'none',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  addSubjectButton: {
    padding: '8px 14px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    backgroundColor: COLORS.secondary,
    color: COLORS.white,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  submitButton: (isLoading: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '12px',
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '22px',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
    marginTop: '8px',
  }),

  backButton: {
    display: 'block',
    textAlign: 'center' as const,
    fontSize: '11px',
    color: COLORS.primary,
    textDecoration: 'none',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    width: '100%',
    marginTop: '14px',
  } as React.CSSProperties,

  serverError: {
    backgroundColor: COLORS.errorBg,
    border: `1px solid ${COLORS.error}`,
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '14px',
    fontSize: '11px',
    color: COLORS.error,
  } as React.CSSProperties,

  customSubjectTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    borderRadius: '12px',
    backgroundColor: COLORS.background,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.dark,
    marginRight: '6px',
    marginBottom: '6px',
  } as React.CSSProperties,

  removeCustomBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: COLORS.error,
    fontSize: '14px',
    lineHeight: 1,
    padding: 0,
  } as React.CSSProperties,
} as const;

type FieldErrors = {
  username?: string | null;
  name?: string | null;
  password?: string | null;
  grade?: string | null;
  schoolName?: string | null;
  subjects?: string | null;
};

/**
 * StudentRegistrationForm React component.
 *
 * Renders the student registration form with pre-filled parent username,
 * validation, subject selection with custom subjects, and error handling.
 */
export const StudentRegistrationForm: React.FC<StudentRegistrationFormProps> = ({
  parentUsername,
  onSubmit,
  onBack,
  isLoading: externalLoading = false,
}) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([...DEFAULT_SUBJECTS]);
  const [customSubjects, setCustomSubjects] = useState<Array<{ name: string }>>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [addSubjectError, setAddSubjectError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const formRef = useRef<HTMLFormElement>(null);

  const isLoading = externalLoading || internalLoading;

  const validateField = useCallback((field: keyof typeof VALIDATORS, value: string): string | null => {
    if (field === 'customSubjectName') return VALIDATORS.customSubjectName(value);
    return VALIDATORS[field](value);
  }, []);

  const handleBlur = useCallback((field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    let value = '';
    switch (field) {
      case 'username': value = username; break;
      case 'name': value = name; break;
      case 'password': value = password; break;
      case 'grade': value = grade; break;
      case 'schoolName': value = schoolName; break;
    }
    const validatorKey = field as keyof typeof VALIDATORS;
    const error = VALIDATORS[validatorKey](value);
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
  }, [username, name, password, grade, schoolName]);

  const handleFieldChange = useCallback((field: keyof FieldErrors, value: string) => {
    switch (field) {
      case 'username': setUsername(value); break;
      case 'name': setName(value); break;
      case 'password': setPassword(value); break;
      case 'grade': setGrade(value); break;
      case 'schoolName': setSchoolName(value); break;
    }
    // Validate on change if already touched
    if (touched[field]) {
      const validatorKey = field as keyof typeof VALIDATORS;
      const error = VALIDATORS[validatorKey](value);
      setFieldErrors((prev) => ({ ...prev, [field]: error }));
    }
  }, [touched]);

  const handleSubjectToggle = useCallback((subject: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((s) => s !== subject);
      }
      return [...prev, subject];
    });
    // Clear subjects error if user selects something
    setFieldErrors((prev) => ({ ...prev, subjects: null }));
  }, []);

  const handleAddSubject = useCallback(() => {
    const trimmed = newSubjectName.trim();
    const error = VALIDATORS.customSubjectName(trimmed);
    if (error) {
      setAddSubjectError(error);
      return;
    }
    // Check for duplicate
    const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects.map((s) => s.name)];
    if (allSubjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setAddSubjectError('Subject already exists');
      return;
    }
    setCustomSubjects((prev) => [...prev, { name: trimmed }]);
    setSelectedSubjects((prev) => [...prev, trimmed]);
    setNewSubjectName('');
    setAddSubjectError(null);
    setShowAddSubject(false);
    setFieldErrors((prev) => ({ ...prev, subjects: null }));
  }, [newSubjectName, customSubjects]);

  const handleRemoveCustomSubject = useCallback((subjectName: string) => {
    setCustomSubjects((prev) => prev.filter((s) => s.name !== subjectName));
    setSelectedSubjects((prev) => prev.filter((s) => s !== subjectName));
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validate all fields
    const errors: FieldErrors = {
      username: VALIDATORS.username(username),
      name: VALIDATORS.name(name),
      password: VALIDATORS.password(password),
      grade: VALIDATORS.grade(grade),
      schoolName: VALIDATORS.schoolName(schoolName),
      subjects: selectedSubjects.length === 0 ? 'At least one subject must be selected' : null,
    };

    setFieldErrors(errors);
    setTouched({ username: true, name: true, password: true, grade: true, schoolName: true });

    // Check if any errors
    const hasErrors = Object.values(errors).some((err) => err !== null);
    if (hasErrors) return;

    setInternalLoading(true);

    try {
      const result = await onSubmit({
        parentUsername,
        username: username.trim(),
        name: name.trim(),
        password,
        grade,
        schoolName: schoolName.trim(),
        subjects: selectedSubjects,
        customSubjects,
      });

      if (!result.success && result.fieldErrors) {
        // Map server field errors
        const serverFieldErrors: FieldErrors = {};
        let genericError: string | null = null;

        for (const fe of result.fieldErrors) {
          if (fe.field === 'username' || fe.field === 'name' || fe.field === 'password' ||
              fe.field === 'grade' || fe.field === 'schoolName' || fe.field === 'subjects') {
            serverFieldErrors[fe.field] = fe.message;
          } else if (fe.field === 'server') {
            genericError = fe.message;
          }
        }

        setFieldErrors((prev) => ({ ...prev, ...serverFieldErrors }));
        if (genericError) {
          setServerError(genericError);
        }
      }
    } catch {
      // 5xx or network error — preserve all fields (Req 1.48)
      setServerError('Something went wrong — please try again after some time');
    } finally {
      setInternalLoading(false);
    }
  }, [username, name, password, grade, schoolName, selectedSubjects, customSubjects, parentUsername, onSubmit]);

  const allSubjects = [...DEFAULT_SUBJECTS, ...customSubjects.map((s) => s.name)];

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.heading}>Register Student</h2>
        <p style={styles.subtitle}>Create a student account for your child</p>

        {/* Server error banner (Req 1.48) */}
        {serverError && (
          <div style={styles.serverError} role="alert" aria-live="assertive">
            {serverError}
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Student registration form"
        >
          {/* Parent Username — read-only (Req 1.20) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="reg-parent-username" style={styles.label}>
              Parent Username
            </label>
            <input
              id="reg-parent-username"
              type="text"
              value={parentUsername}
              readOnly
              aria-readonly="true"
              style={styles.inputReadOnly}
              tabIndex={-1}
            />
          </div>

          {/* Student Username (Req 1.21) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="reg-student-username" style={styles.label}>
              Student Username
            </label>
            <input
              id="reg-student-username"
              type="text"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              onBlur={() => handleBlur('username')}
              disabled={isLoading}
              style={fieldErrors.username ? styles.inputError : styles.input}
              aria-required="true"
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            />
            {fieldErrors.username && (
              <p id="username-error" style={styles.errorText} role="alert">
                {fieldErrors.username}
              </p>
            )}
          </div>

          {/* Name (Req 1.22) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="reg-student-name" style={styles.label}>
              Name
            </label>
            <input
              id="reg-student-name"
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              disabled={isLoading}
              style={fieldErrors.name ? styles.inputError : styles.input}
              aria-required="true"
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="name-error" style={styles.errorText} role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Password (Req 1.23) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="reg-student-password" style={styles.label}>
              Password
            </label>
            <input
              id="reg-student-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              disabled={isLoading}
              style={fieldErrors.password ? styles.inputError : styles.input}
              aria-required="true"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" style={styles.errorText} role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Grade Dropdown (Req 1.24) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="reg-student-grade" style={styles.label}>
              Grade
            </label>
            <select
              id="reg-student-grade"
              name="grade"
              value={grade}
              onChange={(e) => handleFieldChange('grade', e.target.value)}
              onBlur={() => handleBlur('grade')}
              disabled={isLoading}
              style={fieldErrors.grade ? styles.selectError : styles.select}
              aria-required="true"
              aria-invalid={!!fieldErrors.grade}
              aria-describedby={fieldErrors.grade ? 'grade-error' : undefined}
            >
              <option value="">Select grade</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {fieldErrors.grade && (
              <p id="grade-error" style={styles.errorText} role="alert">
                {fieldErrors.grade}
              </p>
            )}
          </div>

          {/* School Name (Req 1.25) */}
          <div style={styles.fieldGroup}>
            <label htmlFor="reg-student-school" style={styles.label}>
              School Name
            </label>
            <input
              id="reg-student-school"
              type="text"
              name="schoolName"
              value={schoolName}
              onChange={(e) => handleFieldChange('schoolName', e.target.value)}
              onBlur={() => handleBlur('schoolName')}
              disabled={isLoading}
              style={fieldErrors.schoolName ? styles.inputError : styles.input}
              aria-required="true"
              aria-invalid={!!fieldErrors.schoolName}
              aria-describedby={fieldErrors.schoolName ? 'school-error' : undefined}
            />
            {fieldErrors.schoolName && (
              <p id="school-error" style={styles.errorText} role="alert">
                {fieldErrors.schoolName}
              </p>
            )}
          </div>

          {/* Subject Selection (Req 1.26, 1.27, 1.28, 1.29) */}
          <div style={styles.fieldGroup}>
            <span style={styles.sectionLabel} id="subjects-label">
              Subjects
            </span>
            <div
              role="group"
              aria-labelledby="subjects-label"
              style={styles.subjectsGrid}
            >
              {allSubjects.map((subject) => (
                <label key={subject} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={() => handleSubjectToggle(subject)}
                    disabled={isLoading}
                    style={styles.checkbox}
                    aria-label={`Select ${subject}`}
                  />
                  {subject}
                </label>
              ))}
            </div>

            {/* Custom subjects tags */}
            {customSubjects.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {customSubjects.map((cs) => (
                  <span key={cs.name} style={styles.customSubjectTag}>
                    {cs.name}
                    <button
                      type="button"
                      style={styles.removeCustomBtn}
                      onClick={() => handleRemoveCustomSubject(cs.name)}
                      aria-label={`Remove ${cs.name}`}
                      disabled={isLoading}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add Subject (Req 1.28) */}
            {!showAddSubject ? (
              <button
                type="button"
                onClick={() => setShowAddSubject(true)}
                disabled={isLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: COLORS.secondary,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
                aria-label="Add a custom subject"
              >
                + Add Subject
              </button>
            ) : (
              <div style={styles.addSubjectRow}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => {
                      setNewSubjectName(e.target.value);
                      setAddSubjectError(null);
                    }}
                    placeholder="Subject name (1-50 chars)"
                    style={styles.addSubjectInput}
                    aria-label="New subject name"
                    maxLength={50}
                    disabled={isLoading}
                  />
                  {addSubjectError && (
                    <p style={styles.errorText} role="alert">
                      {addSubjectError}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddSubject}
                  disabled={isLoading}
                  style={styles.addSubjectButton}
                  aria-label="Confirm add subject"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSubject(false);
                    setNewSubjectName('');
                    setAddSubjectError(null);
                  }}
                  disabled={isLoading}
                  style={{
                    ...styles.addSubjectButton,
                    backgroundColor: COLORS.muted,
                  }}
                  aria-label="Cancel adding subject"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Subjects error (Req 1.29) */}
            {fieldErrors.subjects && (
              <p style={{ ...styles.errorText, marginTop: '8px' }} role="alert">
                {fieldErrors.subjects}
              </p>
            )}
          </div>

          {/* Submit button (Req 1.30) */}
          <button
            type="submit"
            style={styles.submitButton(isLoading)}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Registering...' : 'Register Student'}
          </button>
        </form>

        {/* Back link */}
        {onBack && (
          <button
            type="button"
            style={styles.backButton}
            onClick={onBack}
            disabled={isLoading}
            aria-label="Go back"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentRegistrationForm;
