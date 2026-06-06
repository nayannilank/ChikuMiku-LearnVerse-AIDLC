import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  ReactNode,
} from 'react';
import type {DeviceStorageInterface} from '@chikumiku/platform-contracts';
import {resolveInitialRoute, TokenState} from '../navigation/routeResolver';
import {
  onSessionExpired,
  clearSessionExpiredHandler,
} from '../utils/sessionInterceptor';
import {
  preserveUnsavedInput,
  UnsavedInput,
} from '../utils/unsavedInputStorage';

// --- Constants ---

const SESSION_TOKEN_KEY = 'session_token';

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

// --- Types ---

export interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokenState: TokenState;
  error: string | null;
  /** Error message when preserving unsaved input fails during session expiry */
  unsavedInputError: string | null;
  login: (username: string, password: string) => Promise<void>;
  registerParent: (data: {
    name: string;
    username: string;
    phone: string;
    email: string;
    password: string;
  }) => Promise<void>;
  registerStudent: (data: {
    name: string;
    username: string;
    password: string;
    grade: number;
    parentUsername: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Handles session expiry mid-session. Attempts to preserve unsaved
   * learner input to device storage before logging out. If preservation
   * fails, sets unsavedInputError so the UI can let the user choose.
   *
   * Requirements: 1.3, 1.6
   */
  sessionExpiredLogout: (unsavedInput?: UnsavedInput) => Promise<void>;
  /** Dismiss the unsaved input error and proceed without saving */
  dismissUnsavedInputError: () => void;
}

// --- State management ---

interface AuthState {
  tokenState: TokenState;
  isLoading: boolean;
  error: string | null;
  unsavedInputError: string | null;
}

type AuthAction =
  | {type: 'LOADING'}
  | {type: 'SET_TOKEN_STATE'; tokenState: TokenState; error?: string | null}
  | {type: 'SET_ERROR'; error: string}
  | {type: 'INITIALIZED'; tokenState: TokenState; error?: string | null}
  | {type: 'SESSION_EXPIRED'; error: string; unsavedInputError?: string | null}
  | {type: 'DISMISS_UNSAVED_INPUT_ERROR'};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return {...state, isLoading: true, error: null};
    case 'SET_TOKEN_STATE':
      return {
        tokenState: action.tokenState,
        isLoading: false,
        error: action.error ?? null,
        unsavedInputError: null,
      };
    case 'SET_ERROR':
      return {...state, isLoading: false, error: action.error};
    case 'INITIALIZED':
      return {
        tokenState: action.tokenState,
        isLoading: false,
        error: action.error ?? null,
        unsavedInputError: null,
      };
    case 'SESSION_EXPIRED':
      return {
        tokenState: 'expired',
        isLoading: false,
        error: action.error,
        unsavedInputError: action.unsavedInputError ?? null,
      };
    case 'DISMISS_UNSAVED_INPUT_ERROR':
      return {...state, unsavedInputError: null};
    default:
      return state;
  }
}

const initialState: AuthState = {
  tokenState: 'missing',
  isLoading: true,
  error: null,
  unsavedInputError: null,
};

// --- Default in-memory storage fallback ---

function createInMemoryStorage(): DeviceStorageInterface {
  const store = new Map<string, string>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
    getAllKeys: async () => Array.from(store.keys()),
  };
}

// --- Context ---

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// --- Provider Props ---

export interface AuthProviderProps {
  children: ReactNode;
  /** Optional storage implementation. Falls back to in-memory storage if not provided. */
  storage?: DeviceStorageInterface;
}

// --- Provider Component ---

/**
 * AuthProvider manages authentication state and provides auth operations
 * to the component tree. It checks for stored tokens on mount and
 * determines the initial route using resolveInitialRoute.
 *
 * On mount, it loads the stored token from DeviceStorageInterface and
 * validates it via GET /api/v1/auth/validate. If the token is valid,
 * the user is authenticated; otherwise, they are routed to the auth screen.
 */
export function AuthProvider({children, storage}: AuthProviderProps) {
  const storageImpl = useMemo(
    () => storage ?? createInMemoryStorage(),
    [storage],
  );

  const [state, dispatch] = useReducer(authReducer, initialState);

  const isAuthenticated = resolveInitialRoute(state.tokenState) === 'Main';

  // On mount: load stored token and validate it
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const storedToken = await storageImpl.getItem(SESSION_TOKEN_KEY);

        if (!storedToken) {
          if (!cancelled) {
            dispatch({type: 'INITIALIZED', tokenState: 'missing'});
          }
          return;
        }

        // Validate the token against the backend
        const response = await fetch(`${BASE_URL}/api/v1/auth/validate`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (cancelled) return;

        if (response.ok) {
          dispatch({type: 'INITIALIZED', tokenState: 'valid'});
        } else if (response.status === 401) {
          // Token expired or invalid
          await storageImpl.removeItem(SESSION_TOKEN_KEY);
          dispatch({type: 'INITIALIZED', tokenState: 'expired'});
        } else {
          await storageImpl.removeItem(SESSION_TOKEN_KEY);
          dispatch({type: 'INITIALIZED', tokenState: 'invalid'});
        }
      } catch (_error) {
        // Network error during validation
        if (!cancelled) {
          dispatch({
            type: 'INITIALIZED',
            tokenState: 'network_error',
            error: 'Connection problem. Please check your network.',
          });
        }
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
  }, [storageImpl]);

  // --- Auth actions ---

  const login = useCallback(
    async (username: string, password: string) => {
      dispatch({type: 'LOADING'});

      try {
        const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({username, password}),
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle lockout
          if (data.code === 'ACCOUNT_LOCKED') {
            const retryMinutes = Math.ceil((data.retryAfter || 900) / 60);
            dispatch({
              type: 'SET_TOKEN_STATE',
              tokenState: 'invalid',
              error: `Account locked. Please retry after ${retryMinutes} minutes.`,
            });
            return;
          }

          dispatch({
            type: 'SET_TOKEN_STATE',
            tokenState: 'invalid',
            error: data.message || 'Invalid username or password.',
          });
          return;
        }

        // Success: store token
        const token = data.accessToken || data.token;
        await storageImpl.setItem(SESSION_TOKEN_KEY, token);
        dispatch({type: 'SET_TOKEN_STATE', tokenState: 'valid'});
      } catch (_error) {
        dispatch({
          type: 'SET_TOKEN_STATE',
          tokenState: 'network_error',
          error:
            'Network connection required. Please check your connection and try again.',
        });
      }
    },
    [storageImpl],
  );

  const registerParent = useCallback(
    async (data: {
      name: string;
      username: string;
      phone: string;
      email: string;
      password: string;
    }) => {
      dispatch({type: 'LOADING'});

      try {
        const response = await fetch(
          `${BASE_URL}/api/v1/auth/register/parent`,
          {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name: data.name,
              username: data.username,
              phone: data.phone,
              email: data.email,
              password: data.password,
            }),
          },
        );

        const responseData = await response.json();

        if (!response.ok) {
          dispatch({
            type: 'SET_TOKEN_STATE',
            tokenState: 'missing',
            error:
              responseData.message ||
              'Registration failed. Please check your details.',
          });
          return;
        }

        // Parent registration succeeds but doesn't auto-login
        dispatch({type: 'SET_TOKEN_STATE', tokenState: 'missing'});
      } catch (_error) {
        dispatch({
          type: 'SET_TOKEN_STATE',
          tokenState: 'network_error',
          error:
            'Network connection required. Please check your connection and try again.',
        });
      }
    },
    [storageImpl],
  );

  const registerStudent = useCallback(
    async (data: {
      name: string;
      username: string;
      password: string;
      grade: number;
      parentUsername: string;
    }) => {
      dispatch({type: 'LOADING'});

      try {
        const response = await fetch(
          `${BASE_URL}/api/v1/auth/register/student`,
          {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name: data.name,
              username: data.username,
              password: data.password,
              grade: data.grade,
              parentUsername: data.parentUsername,
            }),
          },
        );

        const responseData = await response.json();

        if (!response.ok) {
          dispatch({
            type: 'SET_TOKEN_STATE',
            tokenState: 'missing',
            error:
              responseData.message ||
              'Registration failed. Please check your details.',
          });
          return;
        }

        // Student registration returns a token for auto-login
        const token = responseData.accessToken || responseData.token;
        await storageImpl.setItem(SESSION_TOKEN_KEY, token);
        dispatch({type: 'SET_TOKEN_STATE', tokenState: 'valid'});
      } catch (_error) {
        dispatch({
          type: 'SET_TOKEN_STATE',
          tokenState: 'network_error',
          error:
            'Network connection required. Please check your connection and try again.',
        });
      }
    },
    [storageImpl],
  );

  const logout = useCallback(async () => {
    await storageImpl.removeItem(SESSION_TOKEN_KEY);
    dispatch({type: 'SET_TOKEN_STATE', tokenState: 'missing'});
  }, [storageImpl]);

  /**
   * Handles session expiry mid-session (Req 1.3, 1.6).
   * Attempts to preserve unsaved input before logging out.
   * If preservation fails, sets unsavedInputError so UI can prompt user.
   */
  const sessionExpiredLogout = useCallback(
    async (unsavedInput?: UnsavedInput) => {
      let unsavedInputError: string | null = null;

      // Attempt to preserve unsaved learner input (Req 1.6)
      if (unsavedInput) {
        const result = await preserveUnsavedInput(storageImpl, unsavedInput);
        if (!result.success) {
          unsavedInputError =
            result.error ||
            'Failed to save your work. Storage may be full or unavailable.';
        }
      }

      // Clear the session token
      await storageImpl.removeItem(SESSION_TOKEN_KEY);

      // Dispatch session expired with "Session ended" message
      dispatch({
        type: 'SESSION_EXPIRED',
        error: 'Session ended. Please log in again.',
        unsavedInputError,
      });
    },
    [storageImpl],
  );

  const dismissUnsavedInputError = useCallback(() => {
    dispatch({type: 'DISMISS_UNSAVED_INPUT_ERROR'});
  }, []);

  // Register session expiry handler for the interceptor (Req 1.3)
  useEffect(() => {
    onSessionExpired(() => {
      // When the interceptor detects a 401, trigger session expiry logout
      // without unsaved input (the calling screen should handle its own
      // preservation via the sessionExpiredLogout method directly).
      sessionExpiredLogout();
    });

    return () => {
      clearSessionExpiredHandler();
    };
  }, [sessionExpiredLogout]);

  // --- Context value ---

  const value: AuthContextValue = useMemo(
    () => ({
      isLoading: state.isLoading,
      isAuthenticated,
      tokenState: state.tokenState,
      error: state.error,
      unsavedInputError: state.unsavedInputError,
      login,
      registerParent,
      registerStudent,
      logout,
      sessionExpiredLogout,
      dismissUnsavedInputError,
    }),
    [
      state.isLoading,
      state.tokenState,
      state.error,
      state.unsavedInputError,
      isAuthenticated,
      login,
      registerParent,
      registerStudent,
      logout,
      sessionExpiredLogout,
      dismissUnsavedInputError,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context from child components.
 * Must be used within an AuthProvider.
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
