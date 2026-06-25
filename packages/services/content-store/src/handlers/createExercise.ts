/**
 * Create Exercise Handler
 *
 * POST /exercises
 *
 * Creates a new exercise record and returns it with HTTP 201 status.
 * Validates required fields and returns 400 with field-specific errors.
 *
 * Requirements: 18.1, 18.3, 18.4, 18.5
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  LambdaHandler,
} from '@learnverse/service-core';

// ============================================================
// Types
// ============================================================

export type ExerciseType =
  | 'pronunciation'
  | 'grammar'
  | 'quiz'
  | 'maths'
  | 'code'
  | 'evs'
  | 'fill_blank'
  | 'match'
  | 'true_false'
  | 'short_answer';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface CreateExerciseInput {
  subjectId: string;
  chapterId?: string | null;
  exerciseType: ExerciseType;
  difficultyLevel: DifficultyLevel;
  sequenceNumber: number;
  content: Record<string, unknown>;
  correctAnswer: Record<string, unknown>;
  explanation?: string | null;
}

export interface ExerciseRecord {
  id: string;
  subjectId: string;
  chapterId: string | null;
  exerciseType: ExerciseType;
  difficultyLevel: DifficultyLevel;
  sequenceNumber: number;
  content: Record<string, unknown>;
  correctAnswer: Record<string, unknown>;
  explanation: string | null;
}

export interface CreateExerciseDbClient {
  createExercise(input: CreateExerciseInput): Promise<ExerciseRecord>;
}

// ============================================================
// Constants
// ============================================================

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const VALID_EXERCISE_TYPES: ExerciseType[] = [
  'pronunciation',
  'grammar',
  'quiz',
  'maths',
  'code',
  'evs',
  'fill_blank',
  'match',
  'true_false',
  'short_answer',
];

const VALID_DIFFICULTY_LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// Handler Factory
// ============================================================

/**
 * Creates a createExercise Lambda handler with an injected database client.
 */
export function createCreateExerciseHandler(dbClient: CreateExerciseDbClient): LambdaHandler {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Auth check
      const userId = event.requestContext.authorizer?.claims?.sub;
      if (!userId) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'Authentication required',
          }),
        };
      }

      // Parse request body
      if (!event.body) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Request body is required',
            errors: [{ field: 'body', message: 'Request body is required' }],
          }),
        };
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body);
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Invalid JSON in request body',
            errors: [{ field: 'body', message: 'Invalid JSON format' }],
          }),
        };
      }

      // Validate required fields
      const validationErrors = validateCreateInput(body);
      if (validationErrors.length > 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR',
            message: 'Validation failed',
            errors: validationErrors,
          }),
        };
      }

      const input: CreateExerciseInput = {
        subjectId: body.subjectId as string,
        chapterId: (body.chapterId as string | null) ?? null,
        exerciseType: body.exerciseType as ExerciseType,
        difficultyLevel: body.difficultyLevel as DifficultyLevel,
        sequenceNumber: body.sequenceNumber as number,
        content: body.content as Record<string, unknown>,
        correctAnswer: body.correctAnswer as Record<string, unknown>,
        explanation: (body.explanation as string | null) ?? null,
      };

      const created = await dbClient.createExercise(input);

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify(created),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the exercise',
        }),
      };
    }
  };
}

// ============================================================
// Validation
// ============================================================

interface ValidationError {
  field: string;
  message: string;
}

function validateCreateInput(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // subjectId - required, UUID
  if (!body.subjectId) {
    errors.push({ field: 'subjectId', message: 'subjectId is required' });
  } else if (typeof body.subjectId !== 'string' || !UUID_REGEX.test(body.subjectId)) {
    errors.push({ field: 'subjectId', message: 'subjectId must be a valid UUID' });
  }

  // chapterId - optional, but must be UUID if provided
  if (body.chapterId !== undefined && body.chapterId !== null) {
    if (typeof body.chapterId !== 'string' || !UUID_REGEX.test(body.chapterId)) {
      errors.push({ field: 'chapterId', message: 'chapterId must be a valid UUID' });
    }
  }

  // exerciseType - required, must be valid
  if (!body.exerciseType) {
    errors.push({ field: 'exerciseType', message: 'exerciseType is required' });
  } else if (!VALID_EXERCISE_TYPES.includes(body.exerciseType as ExerciseType)) {
    errors.push({
      field: 'exerciseType',
      message: `exerciseType must be one of: ${VALID_EXERCISE_TYPES.join(', ')}`,
    });
  }

  // difficultyLevel - required, must be valid
  if (!body.difficultyLevel) {
    errors.push({ field: 'difficultyLevel', message: 'difficultyLevel is required' });
  } else if (!VALID_DIFFICULTY_LEVELS.includes(body.difficultyLevel as DifficultyLevel)) {
    errors.push({
      field: 'difficultyLevel',
      message: `difficultyLevel must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}`,
    });
  }

  // sequenceNumber - required, positive integer
  if (body.sequenceNumber === undefined || body.sequenceNumber === null) {
    errors.push({ field: 'sequenceNumber', message: 'sequenceNumber is required' });
  } else if (
    typeof body.sequenceNumber !== 'number' ||
    !Number.isInteger(body.sequenceNumber) ||
    body.sequenceNumber < 1
  ) {
    errors.push({ field: 'sequenceNumber', message: 'sequenceNumber must be a positive integer' });
  }

  // content - required, must be an object
  if (body.content === undefined || body.content === null) {
    errors.push({ field: 'content', message: 'content is required' });
  } else if (typeof body.content !== 'object' || Array.isArray(body.content)) {
    errors.push({ field: 'content', message: 'content must be a JSON object' });
  }

  // correctAnswer - required, must be an object
  if (body.correctAnswer === undefined || body.correctAnswer === null) {
    errors.push({ field: 'correctAnswer', message: 'correctAnswer is required' });
  } else if (typeof body.correctAnswer !== 'object' || Array.isArray(body.correctAnswer)) {
    errors.push({ field: 'correctAnswer', message: 'correctAnswer must be a JSON object' });
  }

  return errors;
}
