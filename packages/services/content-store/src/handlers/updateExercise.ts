/**
 * Update Exercise Handler
 *
 * PUT /exercises/:id
 *
 * Updates an existing exercise record. Returns the updated exercise.
 * Validates required fields and returns 400 with field-specific errors.
 *
 * Requirements: 18.1, 18.4, 18.5
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

export interface UpdateExerciseInput {
  subjectId?: string;
  chapterId?: string | null;
  exerciseType?: ExerciseType;
  difficultyLevel?: DifficultyLevel;
  sequenceNumber?: number;
  content?: Record<string, unknown>;
  correctAnswer?: Record<string, unknown>;
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

export interface UpdateExerciseDbClient {
  updateExercise(id: string, input: UpdateExerciseInput): Promise<ExerciseRecord | null>;
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
 * Creates an updateExercise Lambda handler with an injected database client.
 */
export function createUpdateExerciseHandler(dbClient: UpdateExerciseDbClient): LambdaHandler {
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

      // Validate path parameter
      const exerciseId = event.pathParameters?.id;
      if (!exerciseId || !UUID_REGEX.test(exerciseId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Exercise ID must be a valid UUID',
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

      // Validate fields (all optional for update, but must be valid if provided)
      const validationErrors = validateUpdateInput(body);
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

      const input: UpdateExerciseInput = {};
      if (body.subjectId !== undefined) input.subjectId = body.subjectId as string;
      if (body.chapterId !== undefined) input.chapterId = (body.chapterId as string | null) ?? null;
      if (body.exerciseType !== undefined) input.exerciseType = body.exerciseType as ExerciseType;
      if (body.difficultyLevel !== undefined) input.difficultyLevel = body.difficultyLevel as DifficultyLevel;
      if (body.sequenceNumber !== undefined) input.sequenceNumber = body.sequenceNumber as number;
      if (body.content !== undefined) input.content = body.content as Record<string, unknown>;
      if (body.correctAnswer !== undefined) input.correctAnswer = body.correctAnswer as Record<string, unknown>;
      if (body.explanation !== undefined) input.explanation = (body.explanation as string | null) ?? null;

      const updated = await dbClient.updateExercise(exerciseId, input);

      if (!updated) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 404,
            errorCode: 'NOT_FOUND',
            message: `Exercise with ID ${exerciseId} not found`,
          }),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(updated),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating the exercise',
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

function validateUpdateInput(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // subjectId - optional, but must be UUID if provided
  if (body.subjectId !== undefined) {
    if (typeof body.subjectId !== 'string' || !UUID_REGEX.test(body.subjectId)) {
      errors.push({ field: 'subjectId', message: 'subjectId must be a valid UUID' });
    }
  }

  // chapterId - optional, but must be UUID if provided (can be null)
  if (body.chapterId !== undefined && body.chapterId !== null) {
    if (typeof body.chapterId !== 'string' || !UUID_REGEX.test(body.chapterId)) {
      errors.push({ field: 'chapterId', message: 'chapterId must be a valid UUID' });
    }
  }

  // exerciseType - optional, but must be valid if provided
  if (body.exerciseType !== undefined) {
    if (!VALID_EXERCISE_TYPES.includes(body.exerciseType as ExerciseType)) {
      errors.push({
        field: 'exerciseType',
        message: `exerciseType must be one of: ${VALID_EXERCISE_TYPES.join(', ')}`,
      });
    }
  }

  // difficultyLevel - optional, but must be valid if provided
  if (body.difficultyLevel !== undefined) {
    if (!VALID_DIFFICULTY_LEVELS.includes(body.difficultyLevel as DifficultyLevel)) {
      errors.push({
        field: 'difficultyLevel',
        message: `difficultyLevel must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}`,
      });
    }
  }

  // sequenceNumber - optional, but must be positive integer if provided
  if (body.sequenceNumber !== undefined) {
    if (
      typeof body.sequenceNumber !== 'number' ||
      !Number.isInteger(body.sequenceNumber) ||
      body.sequenceNumber < 1
    ) {
      errors.push({ field: 'sequenceNumber', message: 'sequenceNumber must be a positive integer' });
    }
  }

  // content - optional, but must be an object if provided
  if (body.content !== undefined) {
    if (body.content === null || typeof body.content !== 'object' || Array.isArray(body.content)) {
      errors.push({ field: 'content', message: 'content must be a JSON object' });
    }
  }

  // correctAnswer - optional, but must be an object if provided
  if (body.correctAnswer !== undefined) {
    if (body.correctAnswer === null || typeof body.correctAnswer !== 'object' || Array.isArray(body.correctAnswer)) {
      errors.push({ field: 'correctAnswer', message: 'correctAnswer must be a JSON object' });
    }
  }

  return errors;
}
