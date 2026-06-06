import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../navigation/routeResolver';
import {useAuth} from '../hooks/useAuth';

// --- Constants ---

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

const NETWORK_TIMEOUT_MS = 30_000;

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// --- Validation helpers ---

interface FieldErrors {
  name?: string;
  username?: string;
  password?: string;
  grade?: string;
  parentUsername?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{5,15}$/;

function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Name is required';
  }
  if (trimmed.length > 100) {
    return 'Name must be 100 characters or less';
  }
  return undefined;
}

function validateUsername(value: string): string | undefined {
  if (value.length < 5) {
    return 'Username must be at least 5 characters';
  }
  if (value.length > 15) {
    return 'Username must be 15 characters or less';
  }
  if (!USERNAME_REGEX.test(value)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (value.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (value.length > 20) {
    return 'Password must be 20 characters or less';
  }
  if (!/[A-Z]/.test(value)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(value)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must contain at least one digit';
  }
  if (!/[^a-zA-Z0-9\s]/.test(value)) {
    return 'Password must contain at least one special character';
  }
  return undefined;
}

function validateGrade(value: number | null): string | undefined {
  if (value === null) {
    return 'Please select a grade';
  }
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    return 'Grade must be between 1 and 12';
  }
  return undefined;
}

function validateParentUsername(value: string): string | undefined {
  if (value.length < 5) {
    return "Parent's username must be at least 5 characters";
  }
  if (value.length > 15) {
    return "Parent's username must be 15 characters or less";
  }
  if (!USERNAME_REGEX.test(value)) {
    return "Parent's username can only contain letters, numbers, underscores, and hyphens";
  }
  return undefined;
}

function validateAll(
  name: string,
  username: string,
  password: string,
  grade: number | null,
  parentUsername: string,
): FieldErrors {
  const errors: FieldErrors = {};
  const nameErr = validateName(name);
  if (nameErr) errors.name = nameErr;
  const usernameErr = validateUsername(username);
  if (usernameErr) errors.username = usernameErr;
  const passwordErr = validatePassword(password);
  if (passwordErr) errors.password = passwordErr;
  const gradeErr = validateGrade(grade);
  if (gradeErr) errors.grade = gradeErr;
  const parentUsernameErr = validateParentUsername(parentUsername);
  if (parentUsernameErr) errors.parentUsername = parentUsernameErr;
  return errors;
}

// --- Component ---

type StudentRegNavProp = NativeStackNavigationProp<
  AuthStackParamList,
  'StudentRegistration'
>;

/**
 * StudentRegistrationScreen allows new students to create an account.
 *
 * Fields: name, username, password, grade (1-12 picker), parent username.
 * On success: auto-login via AuthContext (stores token, sets isAuthenticated=true),
 * which causes App.tsx to render the Main stack (SubjectSelection).
 *
 * Handles:
 * - Client-side field validation with inline errors
 * - Server-side field-specific errors (e.g., parent not found)
 * - Network timeout (30s) with connectivity error, preserves fields
 */
export default function StudentRegistrationScreen() {
  const navigation = useNavigation<StudentRegNavProp>();
  const {registerStudent} = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const [parentUsername, setParentUsername] = useState('');

  // UI state
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    // Clear previous errors
    setGeneralError(null);

    // Client-side validation
    const validationErrors = validateAll(
      name,
      username,
      password,
      grade,
      parentUsername,
    );
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});

    // Submit
    setIsSubmitting(true);

    try {
      // Use AbortController for network timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        NETWORK_TIMEOUT_MS,
      );

      const response = await fetch(
        `${BASE_URL}/api/v1/auth/register/student`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          signal: controller.signal,
          body: JSON.stringify({
            name: name.trim(),
            username,
            password,
            grade: grade as number,
            parentUsername,
          }),
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseData = await response.json();

        // Handle field-specific errors from the API
        if (responseData.errors && Array.isArray(responseData.errors)) {
          const fieldErrors: FieldErrors = {};
          for (const err of responseData.errors) {
            if (err.field && err.message) {
              (fieldErrors as Record<string, string>)[err.field] = err.message;
            }
          }
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
          } else {
            setGeneralError(
              responseData.message || 'Registration failed. Please try again.',
            );
          }
        } else {
          setGeneralError(
            responseData.message || 'Registration failed. Please try again.',
          );
        }
        setIsSubmitting(false);
        return;
      }

      // Success: use the registerStudent hook to store token and trigger auto-login
      // The API call above was direct for field-specific error handling.
      // Now call registerStudent to persist the token in AuthContext.
      await registerStudent({
        name: name.trim(),
        username,
        password,
        grade: grade as number,
        parentUsername,
      });

      // No manual navigation needed — AuthContext sets isAuthenticated=true,
      // which causes App.tsx to render the Main stack automatically.
    } catch (error: unknown) {
      // Network timeout or connectivity failure
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('abort'))
      ) {
        setGeneralError(
          'Request timed out. Please check your connection and try again.',
        );
      } else {
        setGeneralError(
          'Network connection required. Please check your connection and try again.',
        );
      }
      setIsSubmitting(false);
    }
  }, [name, username, password, grade, parentUsername, registerStudent]);

  const navigateToLogin = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const navigateToParentRegistration = useCallback(() => {
    navigation.navigate('ParentRegistration');
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.title}>Create Student Account</Text>
          <Text style={styles.subtitle}>
            Fill in the details below to get started
          </Text>

          {/* General error */}
          {generalError && (
            <View
              style={styles.generalErrorContainer}
              accessibilityRole="alert">
              <Text style={styles.generalErrorText}>{generalError}</Text>
            </View>
          )}

          {/* Name field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              maxLength={100}
              autoCapitalize="words"
              accessibilityLabel="Full Name input"
              editable={!isSubmitting}
            />
            {errors.name && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {errors.name}
              </Text>
            )}
          </View>

          {/* Username field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, errors.username ? styles.inputError : null]}
              placeholder="Username (5-15 characters)"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              maxLength={15}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Username input"
              editable={!isSubmitting}
            />
            {errors.username && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {errors.username}
              </Text>
            )}
          </View>

          {/* Password field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Password (8-20 chars)"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              maxLength={20}
              secureTextEntry={true}
              autoCapitalize="none"
              accessibilityLabel="Password input"
              editable={!isSubmitting}
            />
            {errors.password && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {errors.password}
              </Text>
            )}
          </View>

          {/* Grade picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Grade</Text>
            <View style={styles.gradeContainer}>
              {GRADES.map(g => {
                const isSelected = grade === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.gradeChip,
                      isSelected ? styles.gradeChipSelected : null,
                    ]}
                    onPress={() => !isSubmitting && setGrade(g)}
                    disabled={isSubmitting}
                    accessibilityLabel={`Grade ${g}`}
                    accessibilityState={{selected: isSelected}}
                    accessibilityRole="button">
                    <Text
                      style={[
                        styles.gradeChipText,
                        isSelected ? styles.gradeChipTextSelected : null,
                      ]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.grade && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {errors.grade}
              </Text>
            )}
          </View>

          {/* Parent Username field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Parent&apos;s Username</Text>
            <TextInput
              style={[
                styles.input,
                errors.parentUsername ? styles.inputError : null,
              ]}
              placeholder="Parent's Username"
              placeholderTextColor="#999"
              value={parentUsername}
              onChangeText={setParentUsername}
              maxLength={15}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Parent username input"
              editable={!isSubmitting}
            />
            {errors.parentUsername && (
              <Text style={styles.errorText} accessibilityRole="alert">
                {errors.parentUsername}
              </Text>
            )}
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting ? styles.submitButtonDisabled : null,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityLabel="Register student account"
            accessibilityRole="button">
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Register</Text>
            )}
          </TouchableOpacity>

          {/* Navigation links */}
          <View style={styles.linksContainer}>
            <TouchableOpacity
              onPress={navigateToLogin}
              accessibilityLabel="Navigate to login screen"
              accessibilityRole="link">
              <Text style={styles.linkText}>
                Already have an account? Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={navigateToParentRegistration}
              style={styles.secondaryLink}
              accessibilityLabel="Navigate to parent registration"
              accessibilityRole="link">
              <Text style={styles.linkText}>Register as Parent instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D2D2D',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  generalErrorContainer: {
    backgroundColor: '#FDE8E8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  generalErrorText: {
    color: '#DC3545',
    fontSize: 14,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2D',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D2D2D',
  },
  inputError: {
    borderColor: '#DC3545',
  },
  errorText: {
    color: '#DC3545',
    fontSize: 12,
    marginTop: 4,
  },
  gradeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeChipSelected: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  gradeChipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  gradeChipTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 24,
  },
  linkText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryLink: {
    marginTop: 12,
  },
});
