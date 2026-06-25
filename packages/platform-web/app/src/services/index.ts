/**
 * Services barrel export.
 *
 * Re-exports the API client, hooks, and connectors for use across the application.
 */

export {
  api,
  authApi,
  contentApi,
  ingestionApi,
  comprehensionApi,
  progressApi,
  pronunciationApi,
  parentApi,
  API_BASE_URL,
  ApiClientError,
  clearTokens,
  setTokens,
  getAccessToken,
  createLoadingState,
  withLoadingState,
} from './api';

export type {
  ApiError,
  ApiResponse,
  RequestOptions,
  LoginResponse,
  LearnerInfo,
  PronunciationScoreResponse,
  EvaluationResponse,
  HintResponse,
  LoadingState,
} from './api';

export {
  useLoginHandler,
  useParentRegistration,
  useStudentRegistration,
  usePasswordRecovery,
  useLogout,
  useDashboardStreak,
  useDashboardSubjects,
  useContentIngestion,
  usePageUpload,
  useChapterExplanation,
  useExerciseAssistant,
  useQuizSession,
  usePronunciation,
  useParentDashboard,
} from './useApi';

export {
  createLoginHandler,
  createParentRegistrationHandler,
  createStudentRegistrationHandler,
  createPasswordRecoveryHandlers,
  createLogoutHandler,
  createStreakFetcher,
  createSubjectsFetcher,
  createContentIngestionHandlers,
  createPageUploadHandlers,
  createExplanationHandlers,
  createRevisionHandlers,
  createExerciseAssistantHandlers,
  createGrammarHandlers,
  createQuizHandlers,
  createMathsHandlers,
  createComputersHandlers,
  createPronunciationHandlers,
  createParentDashboardHandlers,
  createTranscriptHandlers,
} from './apiConnectors';
