/**
 * Content Management API Handlers
 *
 * CRUD operations for exercise management with pagination and filtering.
 */

export { createListExercisesHandler } from './listExercises';
export { createCreateExerciseHandler } from './createExercise';
export { createUpdateExerciseHandler } from './updateExercise';
export { createDeleteExerciseHandler } from './deleteExercise';

export type { ExerciseDbClient, ExerciseRecord, ListExercisesFilters, ListExercisesResult } from './listExercises';
export type { CreateExerciseDbClient, CreateExerciseInput } from './createExercise';
export type { UpdateExerciseDbClient, UpdateExerciseInput } from './updateExercise';
export type { DeleteExerciseDbClient } from './deleteExercise';
