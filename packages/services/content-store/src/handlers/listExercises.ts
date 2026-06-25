/**
 * List Exercises Handler
 *
 * GET /exercises
 *
 * Returns a paginated list of exercises, ordered by sequence number.
 * Supports filtering by subject, chapter, exercise type, and difficulty level.
 *
 * Requirements: 18.1, 18.2, 18.6, 18.7
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

export interface ListExercisesFilters {
  subjectId?: string;
  chapterId?: string;
  exerciseType?: ExerciseType;
  difficultyLevel?: DifficultyLevel;
  limit: number;
  offset: number;
}

export interface ListExercisesResult {
  exercises: ExerciseRecord[];
  total: number;
}

export interface ExerciseDbClient {
  listExercises(filters: ListExercisesFilters): Promise<ListExercisesResult>;
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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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
 * Creates a listExercises Lambda handler with an injected database client.
 */
export function createListExercisesHandler(dbClient: ExerciseDbClient): LambdaHandler {
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

      const params = event.queryStringParameters ?? {};

      // Validate and parse pagination
      const limit = parsePageSize(params.limit ?? params.pageSize);
      if (limit === null) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: `Invalid page size. Must be a number between 1 and ${MAX_PAGE_SIZE}`,
          }),
        };
      }

      const offset = parseOffset(params.offset ?? params.page, limit);
      if (offset === null) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'Invalid offset or page number. Must be a non-negative integer',
          }),
        };
      }

      // Validate filters
      const subjectId = params.subjectId;
      if (subjectId && !UUID_REGEX.test(subjectId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'subjectId must be a valid UUID',
          }),
        };
      }

      const chapterId = params.chapterId;
      if (chapterId && !UUID_REGEX.test(chapterId)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: 'chapterId must be a valid UUID',
          }),
        };
      }

      const exerciseType = params.exerciseType as ExerciseType | undefined;
      if (exerciseType && !VALID_EXERCISE_TYPES.includes(exerciseType)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: `Invalid exercise type. Must be one of: ${VALID_EXERCISE_TYPES.join(', ')}`,
          }),
        };
      }

      const difficultyLevel = params.difficultyLevel as DifficultyLevel | undefined;
      if (difficultyLevel && !VALID_DIFFICULTY_LEVELS.includes(difficultyLevel)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 400,
            errorCode: 'INVALID_PARAMETER',
            message: `Invalid difficulty level. Must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}`,
          }),
        };
      }

      const filters: ListExercisesFilters = {
        subjectId,
        chapterId,
        exerciseType,
        difficultyLevel,
        limit,
        offset,
      };

      const result = await dbClient.listExercises(filters);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          exercises: result.exercises,
          total: result.total,
          limit,
          offset,
        }),
      };
    } catch {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          statusCode: 500,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing exercises',
        }),
      };
    }
  };
}

// ============================================================
// Helpers
// ============================================================

function parsePageSize(value: string | undefined): number | null {
  if (!value) return DEFAULT_PAGE_SIZE;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > MAX_PAGE_SIZE) return null;
  return num;
}

function parseOffset(value: string | undefined, _limit: number): number | null {
  if (!value) return 0;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) return null;
  return num;
}
