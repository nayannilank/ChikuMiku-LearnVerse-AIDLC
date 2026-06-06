import React, {useEffect, useRef} from 'react';
import {View, Image, StyleSheet, ActivityIndicator} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

/**
 * Minimum splash visibility duration in milliseconds.
 */
const MIN_SPLASH_MS = 1000;

/**
 * Maximum splash visibility duration in milliseconds.
 * If initialization hasn't completed by this time, transition to Auth with error.
 */
const MAX_SPLASH_MS = 5000;

/**
 * Clamps the splash duration between MIN and MAX seconds.
 * Formula: Math.max(1, Math.min(durationSeconds, 5))
 *
 * Exported for property-based testing (Property 12).
 */
export function clampSplashDuration(durationSeconds: number): number {
  return Math.max(1, Math.min(durationSeconds, 5));
}

// RootStack param list type — aligns with design doc RootStackParamList
type RootStackParamList = {
  Splash: undefined;
  Auth: {errorMessage?: string} | undefined;
  Main: undefined;
};

type SplashScreenProps = Partial<
  NativeStackScreenProps<RootStackParamList, 'Splash'>
>;

/**
 * Validates the stored session token by calling the auth validate endpoint.
 * Returns true if the token is valid, false otherwise.
 */
async function validateStoredToken(): Promise<boolean> {
  try {
    // Use AsyncStorage to retrieve stored token
    const AsyncStorage =
      require('@react-native-community/async-storage').default;
    const token: string | null = await AsyncStorage.getItem('session_token');

    if (!token) {
      return false;
    }

    // Validate the token against the backend
    const BASE_URL = __DEV__
      ? 'http://10.0.2.2:3000'
      : 'https://api.chikumiku.example.com';

    const response = await fetch(`${BASE_URL}/api/v1/auth/validate`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Logo asset from project root
const logo = require('../../../../ChikuMiku-LearnVerse-Logo.png');

/**
 * SplashScreen displays the ChikuMiku LearnVerse logo centered on a white
 * background while validating the stored session token.
 *
 * Can be used in two modes:
 * 1. Standalone (no navigation prop): Simply displays the splash UI.
 *    Used by App.tsx during initial auth context loading.
 * 2. As a navigator screen (with navigation prop): Performs token validation
 *    with timeout clamping and navigates to Auth or Main.
 *
 * Timing behavior (Requirements 6.1, 6.2, 6.5):
 * - Minimum visibility: 1 second (even if token validates instantly)
 * - Maximum visibility: 5 seconds (timeout triggers auth screen with error)
 * - Clamping formula: max(1s, min(actualDuration, 5s))
 *
 * On valid token: navigates to Main screen
 * On invalid/missing token: navigates to Auth screen (no error)
 * On failure/timeout: navigates to Auth screen with error message
 */
export default function SplashScreen({navigation}: SplashScreenProps) {
  const startTimeRef = useRef<number>(Date.now());
  const hasNavigatedRef = useRef<boolean>(false);

  useEffect(() => {
    // If no navigation prop, this is used as a standalone splash display
    if (!navigation) {
      return;
    }

    let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let minDelayId: ReturnType<typeof setTimeout> | null = null;

    const navigateTo = (
      screen: 'Auth' | 'Main',
      params?: {errorMessage?: string},
    ) => {
      if (hasNavigatedRef.current) {
        return;
      }
      hasNavigatedRef.current = true;

      if (screen === 'Auth') {
        navigation.replace('Auth', params);
      } else {
        navigation.replace('Main');
      }
    };

    const performInitialization = async () => {
      // Set up the 5-second maximum timeout (Requirement 6.5)
      maxTimeoutId = setTimeout(() => {
        navigateTo('Auth', {
          errorMessage:
            'Unable to connect. Please check your connection and try again.',
        });
      }, MAX_SPLASH_MS);

      try {
        const isValid = await validateStoredToken();
        const elapsed = Date.now() - startTimeRef.current;
        const remainingMinDelay = Math.max(0, MIN_SPLASH_MS - elapsed);

        // Clear the max timeout since initialization completed in time
        if (maxTimeoutId) {
          clearTimeout(maxTimeoutId);
          maxTimeoutId = null;
        }

        // Ensure minimum 1-second visibility (Requirement 6.2)
        minDelayId = setTimeout(() => {
          if (isValid) {
            navigateTo('Main');
          } else {
            navigateTo('Auth');
          }
        }, remainingMinDelay);
      } catch {
        // Clear the max timeout on error
        if (maxTimeoutId) {
          clearTimeout(maxTimeoutId);
          maxTimeoutId = null;
        }

        const elapsed = Date.now() - startTimeRef.current;
        const remainingMinDelay = Math.max(0, MIN_SPLASH_MS - elapsed);

        // Transition to Auth with error after minimum delay
        minDelayId = setTimeout(() => {
          navigateTo('Auth', {
            errorMessage:
              'Something went wrong during initialization. Please try again.',
          });
        }, remainingMinDelay);
      }
    };

    performInitialization();

    // Cleanup timers on unmount
    return () => {
      if (maxTimeoutId) {
        clearTimeout(maxTimeoutId);
      }
      if (minDelayId) {
        clearTimeout(minDelayId);
      }
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={logo}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="ChikuMiku LearnVerse Logo"
      />
      <ActivityIndicator
        style={styles.spinner}
        size="small"
        color="#6C63FF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  spinner: {
    marginTop: 24,
  },
});
