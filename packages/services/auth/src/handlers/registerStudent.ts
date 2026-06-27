/**
 * Student Registration Lambda Handler
 *
 * Validates input, creates Cognito user, adds to student group,
 * inserts into students table, and seeds student_subjects.
 *
 * Requirements: 1.20, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 1.27, 1.28, 1.29, 1.30
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, LambdaHandler } from '@learnverse/service-core';
import { randomUUID } from 'crypto';

// --- Types ---

export type StudentGrade =
  | 'LKG' | 'UKG' | 'First' | 'Second' | 'Third' | 'Fourth'
  | 'Fifth' | 'Sixth' | 'Seventh' | 'Eighth' | 'Ninth'
  | 'Tenth' | 'Eleventh' | 'Twelfth';

const VALID_GRADES: readonly StudentGrade[] = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
  'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth',
];

export interface CustomSubjectInput {
  name: string;
}

export type StudentGender = 'male' | 'female' | 'other';

const VALID_GENDERS: readonly StudentGender[] = ['male', 'female', 'other'];

export interface StudentRegistrationBody {
  parentUsername: string;
  username: string;
  name: string;
  password: string;
  gender: string;
  grade: string;
  schoolName: string;
  subjects: string[]; // subject IDs
  customSubjects?: CustomSubjectInput[];
}

export interface FieldError {
  field: string;
  message: string;
}

// --- Color Palette for Custom Subjects ---

const CUSTOM_SUBJECT_COLORS = [
  '#FF6B6B', '#FF8E72', '#FFA94D', '#FFD43B', '#A9E34B',
  '#69DB7C', '#38D9A9', '#3BC9DB', '#4DABF7', '#748FFC',
  '#9775FA', '#DA77F2', '#F783AC', '#E599F7', '#66D9E8',
];

// --- Cognito Client Interface ---

export interface CognitoClient {
  createUser(username: string, password: string): Promise<{ cognitoSub: string }>;
  addUserToGroup(username: string, group: string): Promise<void>;
}

// --- DB Client Interface ---

export interface DBClient {
  findParentByUsername(username: string): Promise<{ id: string } | null>;
  findStudentByUsername(username: string): Promise<{ id: string } | null>;
  insertStudent(student: {
    id: string;
    parentId: string;
    username: string;
    name: string;
    gender: StudentGender;
    grade: StudentGrade;
    schoolName: string;
    cognitoSub: string;
  }): Promise<void>;
  insertStudentSubjects(studentId: string, subjectIds: string[]): Promise<void>;
  insertCustomSubject(subject: {
    id: string;
    name: string;
    isDefault: boolean;
    color: string;
    createdBy: string;
  }): Promise<{ id: string }>;
  getExistingCustomSubjectCount(parentId: string): Promise<number>;
}

// --- Validation Helpers ---

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const NAME_PATTERN = /^[a-zA-Z\s]+$/;
const SCHOOL_NAME_PATTERN = /^[a-zA-Z0-9,\s-]+$/;

function validateStudentUsername(username: unknown): FieldError | null {
  if (typeof username !== 'string' || username.length === 0) {
    return { field: 'username', message: 'Username is required' };
  }
  if (username.length < 8 || username.length > 15) {
    return { field: 'username', message: 'Username must be between 8 and 15 characters' };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { field: 'username', message: 'Username must contain only alphabets, numbers, hyphens, or underscores' };
  }
  return null;
}

function validateStudentName(name: unknown): FieldError | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { field: 'name', message: 'Name is required' };
  }
  if (name.length < 5 || name.length > 20) {
    return { field: 'name', message: 'Name must be between 5 and 20 characters' };
  }
  if (!NAME_PATTERN.test(name)) {
    return { field: 'name', message: 'Name must contain only alphabets and spaces' };
  }
  return null;
}

function validateStudentPassword(password: unknown): FieldError | null {
  if (typeof password !== 'string' || password.length === 0) {
    return { field: 'password', message: 'Password is required' };
  }
  if (password.length < 8 || password.length > 20) {
    return { field: 'password', message: 'Password must be between 8 and 20 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one number' };
  }
  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one special symbol' };
  }
  return null;
}

function validateStudentGrade(grade: unknown): FieldError | null {
  if (typeof grade !== 'string' || !VALID_GRADES.includes(grade as StudentGrade)) {
    return { field: 'grade', message: `Grade must be one of: ${VALID_GRADES.join(', ')}` };
  }
  return null;
}

function validateStudentGender(gender: unknown): FieldError | null {
  if (typeof gender !== 'string' || !VALID_GENDERS.includes(gender as StudentGender)) {
    return { field: 'gender', message: `Gender must be one of: ${VALID_GENDERS.join(', ')}` };
  }
  return null;
}

function validateSchoolName(schoolName: unknown): FieldError | null {
  if (typeof schoolName !== 'string' || schoolName.trim().length === 0) {
    return { field: 'schoolName', message: 'School name is required' };
  }
  if (schoolName.length < 5 || schoolName.length > 30) {
    return { field: 'schoolName', message: 'School name must be between 5 and 30 characters' };
  }
  if (!SCHOOL_NAME_PATTERN.test(schoolName)) {
    return { field: 'schoolName', message: 'School name must contain only alphabets, numbers, commas, and hyphens' };
  }
  return null;
}

function validateSubjects(subjects: unknown, customSubjects?: unknown): FieldError[] {
  const errors: FieldError[] = [];

  if (!Array.isArray(subjects)) {
    errors.push({ field: 'subjects', message: 'Subjects must be an array' });
    return errors;
  }

  const customArr = Array.isArray(customSubjects) ? customSubjects : [];
  const totalSubjects = subjects.length + customArr.length;

  if (totalSubjects < 1) {
    errors.push({ field: 'subjects', message: 'At least one subject must be selected' });
    return errors;
  }

  // Validate custom subject names
  for (let i = 0; i < customArr.length; i++) {
    const cs = customArr[i];
    if (!cs || typeof cs.name !== 'string' || cs.name.trim().length === 0) {
      errors.push({ field: `customSubjects[${i}].name`, message: 'Custom subject name is required' });
    } else if (cs.name.length < 1 || cs.name.length > 50) {
      errors.push({ field: `customSubjects[${i}].name`, message: 'Custom subject name must be between 1 and 50 characters' });
    }
  }

  return errors;
}

function validateParentUsername(parentUsername: unknown): FieldError | null {
  if (typeof parentUsername !== 'string' || parentUsername.trim().length === 0) {
    return { field: 'parentUsername', message: 'Parent username is required' };
  }
  return null;
}

// --- Handler Factory ---

export function createRegisterStudentHandler(
  cognitoClient: CognitoClient,
  dbClient: DBClient,
): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Parse body
      if (!event.body) {
        return errorResponse(400, [{ field: 'body', message: 'Request body is required' }]);
      }

      let body: StudentRegistrationBody;
      try {
        body = JSON.parse(event.body);
      } catch {
        return errorResponse(400, [{ field: 'body', message: 'Invalid JSON in request body' }]);
      }

      // Validate all fields
      const errors: FieldError[] = [];

      const parentUsernameError = validateParentUsername(body.parentUsername);
      if (parentUsernameError) errors.push(parentUsernameError);

      const usernameError = validateStudentUsername(body.username);
      if (usernameError) errors.push(usernameError);

      const nameError = validateStudentName(body.name);
      if (nameError) errors.push(nameError);

      const passwordError = validateStudentPassword(body.password);
      if (passwordError) errors.push(passwordError);

      const genderError = validateStudentGender(body.gender);
      if (genderError) errors.push(genderError);

      const gradeError = validateStudentGrade(body.grade);
      if (gradeError) errors.push(gradeError);

      const schoolNameError = validateSchoolName(body.schoolName);
      if (schoolNameError) errors.push(schoolNameError);

      const subjectErrors = validateSubjects(body.subjects, body.customSubjects);
      errors.push(...subjectErrors);

      if (errors.length > 0) {
        return errorResponse(400, errors);
      }

      // Validate parent exists
      const parent = await dbClient.findParentByUsername(body.parentUsername);
      if (!parent) {
        return errorResponse(400, [{ field: 'parentUsername', message: 'Parent account does not exist' }]);
      }

      // Check username uniqueness
      const existingStudent = await dbClient.findStudentByUsername(body.username);
      if (existingStudent) {
        return errorResponse(409, [{ field: 'username', message: 'Username already taken — please choose a different username' }]);
      }

      // Create Cognito user
      const { cognitoSub } = await cognitoClient.createUser(body.username, body.password);

      // Add to student group
      await cognitoClient.addUserToGroup(body.username, 'student');

      // Generate student ID
      const studentId = randomUUID();

      // Insert student record
      await dbClient.insertStudent({
        id: studentId,
        parentId: parent.id,
        username: body.username,
        name: body.name,
        gender: body.gender as StudentGender,
        grade: body.grade as StudentGrade,
        schoolName: body.schoolName,
        cognitoSub,
      });

      // Handle custom subjects
      const allSubjectIds = [...body.subjects];

      if (body.customSubjects && body.customSubjects.length > 0) {
        const existingCount = await dbClient.getExistingCustomSubjectCount(parent.id);
        for (let i = 0; i < body.customSubjects.length; i++) {
          const colorIndex = (existingCount + i) % CUSTOM_SUBJECT_COLORS.length;
          const customSubject = await dbClient.insertCustomSubject({
            id: randomUUID(),
            name: body.customSubjects[i].name,
            isDefault: false,
            color: CUSTOM_SUBJECT_COLORS[colorIndex],
            createdBy: parent.id,
          });
          allSubjectIds.push(customSubject.id);
        }
      }

      // Seed student_subjects
      await dbClient.insertStudentSubjects(studentId, allSubjectIds);

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          studentId,
          message: 'Student registered successfully',
        }),
      };
    } catch (error) {
      // Handle Cognito duplicate username error
      if (error instanceof Error && error.message.includes('UsernameExistsException')) {
        return errorResponse(409, [{ field: 'username', message: 'Username already taken — please choose a different username' }]);
      }

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Something went wrong — please try again after some time',
        }),
      };
    }
  };
}

// --- Response Helper ---

function errorResponse(statusCode: number, errors: FieldError[]): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: false, errors }),
  };
}
