import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../navigation/routeResolver';
import {useAuth} from '../hooks/useAuth';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

/**
 * LoginScreen provides username/password authentication with:
 * - Username input (5-15 chars)
 * - Password input (masked, max 20 chars)
 * - Submit button with loading state
 * - "Forgot Password" link
 * - Error display (invalid credentials, lockout, network)
 * - Link to registration screens
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 1.4
 */
export default function LoginScreen({navigation}: Props) {
  const {login, isLoading, error} = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLockout, setIsLockout] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);

  const passwordInputRef = useRef<TextInput>(null);
  const previousErrorRef = useRef<string | null>(null);

  // Detect error changes from auth context and handle form state
  useEffect(() => {
    if (error && error !== previousErrorRef.current) {
      setLocalError(error);
      // Clear password on any error (Req 2.4)
      setPassword('');

      // Detect lockout from error message (Req 2.5)
      if (error.toLowerCase().includes('locked')) {
        setIsLockout(true);
        // Set lockout end time to 15 minutes from now
        setLockoutEndTime(Date.now() + 15 * 60 * 1000);
      }
    }
    previousErrorRef.current = error;
  }, [error]);

  // Auto-clear lockout when period expires
  useEffect(() => {
    if (!lockoutEndTime) return;

    const remainingMs = lockoutEndTime - Date.now();
    if (remainingMs <= 0) {
      setIsLockout(false);
      setLockoutEndTime(null);
      setLocalError(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsLockout(false);
      setLockoutEndTime(null);
      setLocalError(null);
    }, remainingMs);

    return () => clearTimeout(timer);
  }, [lockoutEndTime]);

  const isSubmitDisabled = isLoading || isLockout;

  const handleLogin = useCallback(async () => {
    if (isSubmitDisabled) return;

    // Client-side validation
    if (username.length < 5 || username.length > 15) {
      setLocalError('Username must be between 5 and 15 characters.');
      return;
    }

    if (password.length === 0) {
      setLocalError('Password is required.');
      return;
    }

    setLocalError(null);
    await login(username, password);
    // On success, AuthContext sets isAuthenticated=true and RootNavigator
    // automatically switches to MainNavigator (Req 2.3)
  }, [username, password, login, isSubmitDisabled]);

  const handleForgotPassword = useCallback(() => {
    // Navigate to ForgotPassword screen (Req 2.7)
    // The route is defined in AuthStackParamList but may not yet be registered
    // in the navigator. If not available, this will be a no-op or show an alert.
    try {
      navigation.navigate('ForgotPassword');
    } catch {
      // ForgotPassword screen not yet registered — show inline message
      setLocalError(
        'Password recovery is not yet available. Please contact support.',
      );
    }
  }, [navigation]);

  const handleNavigateToRegister = useCallback(() => {
    navigation.navigate('ParentRegistration');
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Log in to continue learning</Text>

          {/* Error display */}
          {localError && (
            <View
              style={styles.errorContainer}
              accessibilityRole="alert"
              accessible={true}>
              <Text style={styles.errorText}>{localError}</Text>
            </View>
          )}

          {/* Username input */}
          <TextInput
            style={styles.input}
            placeholder="Username (5-15 characters)"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            maxLength={15}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            accessibilityLabel="Username input"
            editable={!isLoading}
          />

          {/* Password input */}
          <TextInput
            ref={passwordInputRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            maxLength={20}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            accessibilityLabel="Password input"
            editable={!isLoading}
          />

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitDisabled && styles.submitButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isSubmitDisabled}
            accessibilityRole="button"
            accessibilityLabel="Log In"
            accessibilityState={{disabled: isSubmitDisabled}}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Log In</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password link */}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleForgotPassword}
            accessibilityRole="button"
            accessibilityLabel="Forgot Password">
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Registration link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerPrompt}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={handleNavigateToRegister}
              accessibilityRole="button"
              accessibilityLabel="Register">
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF5350',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#2D2D2D',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: '#B0ADE0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  registerPrompt: {
    fontSize: 14,
    color: '#666',
  },
  registerLink: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
  },
});
