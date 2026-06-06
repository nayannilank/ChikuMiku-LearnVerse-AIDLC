import {ChapterSummary} from '../api/learningApi';

/**
 * Represents the possible states of a stored authentication token.
 */
export type TokenState =
  | 'valid'
  | 'invalid'
  | 'expired'
  | 'missing'
  | 'network_error';

/**
 * Root-level navigation param list.
 * The root navigator conditionally renders either the Auth or Main stack.
 */
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

/**
 * Auth stack param list for login/registration screens.
 */
export type AuthStackParamList = {
  Login: undefined;
  ParentRegistration: undefined;
  StudentRegistration: undefined;
  ForgotPassword: undefined;
};

/**
 * Main stack param list for authenticated content screens.
 */
export type MainStackParamList = {
  SubjectSelection: undefined;
  TextbookList: {subjectId: string};
  ChapterSelection: {
    subjectId: string;
    textbookId: string;
    chapters: ChapterSummary[];
  };
  Learning: {
    subjectId: string;
    textbookId: string;
    chapterId: string | null;
  };
};

/**
 * Resolves the initial route based on the current token state.
 * Returns 'Main' only when the token is valid; returns 'Auth' for all other states.
 *
 * @param tokenState - The current authentication token state
 * @returns 'Auth' or 'Main' route name
 */
export function resolveInitialRoute(tokenState: TokenState): 'Auth' | 'Main' {
  if (tokenState === 'valid') {
    return 'Main';
  }
  return 'Auth';
}
