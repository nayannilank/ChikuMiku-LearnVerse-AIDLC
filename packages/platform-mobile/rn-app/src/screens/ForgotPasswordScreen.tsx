import React, {useCallback, useState} from 'react';
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

type ForgotPasswordNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'ForgotPassword'
>;

interface Props {
  navigation: ForgotPasswordNavigationProp;
}

/**
 * ForgotPasswordScreen allows a learner to initiate password recovery
 * using the phone number or email registered to the Parent account
 * linked to the Student.
 *
 * Requirements: 2.7
 */
export default function ForgotPasswordScreen({navigation}: Props) {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (isLoading) return;

    const trimmed = identifier.trim();
    if (trimmed.length === 0) {
      setError('Please enter your phone number or email address.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const BASE_URL = __DEV__
        ? 'http://10.0.2.2:3000'
        : 'https://api.chikumiku.example.com';

      const response = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({identifier: trimmed}),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            'Unable to process your request. Please try again later.',
        );
      } else {
        setMessage(
          'If an account exists with that phone number or email, you will receive password recovery instructions.',
        );
      }
    } catch (_err) {
      setError(
        'Network connection required. Please check your connection and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [identifier, isLoading]);

  const handleBackToLogin = useCallback(() => {
    navigation.navigate('Login');
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
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter the phone number or email address linked to your parent
            account. We'll send recovery instructions.
          </Text>

          {error && (
            <View
              style={styles.errorContainer}
              accessibilityRole="alert"
              accessible={true}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {message && (
            <View
              style={styles.successContainer}
              accessibilityRole="alert"
              accessible={true}>
              <Text style={styles.successText}>{message}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Phone number or email"
            placeholderTextColor="#999"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            accessibilityLabel="Phone number or email input"
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send Recovery Instructions"
            accessibilityState={{disabled: isLoading}}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                Send Recovery Instructions
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleBackToLogin}
            accessibilityRole="button"
            accessibilityLabel="Back to Login">
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
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
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
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
  successContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#66BB6A',
  },
  successText: {
    color: '#2E7D32',
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
    fontSize: 16,
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
});
