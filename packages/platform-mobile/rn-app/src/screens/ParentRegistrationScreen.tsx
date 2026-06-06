import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../navigation/routeResolver';

// --- Constants ---

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

const NETWORK_TIMEOUT_MS = 30000;

const COLORS = {
  primary: '#6C63FF',
  background: '#F8F9FA',
  text: '#2D2D2D',
  error: '#DC3545',
  inputBorder: '#CED4DA',
  inputBackground: '#FFFFFF',
  placeholder: '#6C757D',
  successBackground: '#D4EDDA',
  successText: '#155724',
  linkText: '#6C63FF',
};

// --- Types ---

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'ParentRegistration'>;

interface FieldErrors {
  name?: string;
  username?: string;
  phone?: string;
  email?: string;
  password?: string;
  general?: string;
}

// --- Validation Helpers ---

function validateName(name: string): string | undefined {
  if (!name.trim()) {
    return 'Name is required';
  }
  return undefined;
}

function validateUsername(username: string): string | undefined {
  if (!username) {
    return 'Username is required';
  }
  if (username.length < 5 || username.length > 15) {
    return 'Username must be 5-15 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  return undefined;
}

function validatePhone(phone: string): string | undefined {
  if (!phone) {
    return 'Phone number is required';
  }
  if (!/^\d{10}$/.test(phone)) {
    return 'Phone number must be exactly 10 digits';
  }
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (!email) {
    return 'Email is required';
  }
  if (email.length > 254) {
    return 'Email must be 254 characters or less';
  }
  const atIndex = email.indexOf('@');
  if (atIndex < 1) {
    return 'Email must contain a valid @ symbol';
  }
  const domain = email.substring(atIndex + 1);
  if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return 'Email must have a valid domain';
  }
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8 || password.length > 20) {
    return 'Password must be 8-20 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return undefined;
}

function validateAll(fields: {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  errors.name = validateName(fields.name);
  errors.username = validateUsername(fields.username);
  errors.phone = validatePhone(fields.phone);
  errors.email = validateEmail(fields.email);
  errors.password = validatePassword(fields.password);

  // Remove undefined entries
  Object.keys(errors).forEach(key => {
    if (errors[key as keyof FieldErrors] === undefined) {
      delete errors[key as keyof FieldErrors];
    }
  });

  return errors;
}

// --- Component ---

export default function ParentRegistrationScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    // Client-side validation
    const validationErrors = validateAll({name, username, phone, email, password});
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/register/parent`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: name.trim(),
          username,
          phone,
          email,
          password,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsSuccess(true);
        return;
      }

      // Handle server-side errors
      const responseData = await response.json();

      if (responseData.errors && Array.isArray(responseData.errors)) {
        const fieldErrors: FieldErrors = {};
        responseData.errors.forEach((err: {field: string; message: string}) => {
          if (err.field === 'name' || err.field === 'username' || err.field === 'phone' || err.field === 'email' || err.field === 'password') {
            fieldErrors[err.field] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({
          general: responseData.message || 'Registration failed. Please check your details.',
        });
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        setErrors({general: 'Network connection required. Please check your connection and try again.'});
      } else {
        setErrors({general: 'Network connection required. Please check your connection and try again.'});
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [name, username, phone, email, password]);

  const handleNavigateToLogin = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const handleNavigateToStudentRegistration = useCallback(() => {
    navigation.navigate('StudentRegistration');
  }, [navigation]);

  // Success state
  if (isSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successText} accessibilityRole="alert">
            Parent account created! Register your student to get started.
          </Text>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleNavigateToStudentRegistration}
            accessibilityRole="button"
            accessibilityLabel="Register Student">
            <Text style={styles.submitButtonText}>Register Student</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNavigateToLogin}
            accessibilityRole="button"
            accessibilityLabel="Go to Login">
            <Text style={styles.linkText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Parent Account</Text>

        {errors.general && (
          <Text style={styles.generalError} accessibilityRole="alert">
            {errors.general}
          </Text>
        )}

        {/* Name Field */}
        <View style={styles.fieldContainer}>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={setName}
            placeholder="Full Name"
            placeholderTextColor={COLORS.placeholder}
            maxLength={100}
            accessibilityLabel="Full Name"
            editable={!isSubmitting}
          />
          {errors.name && (
            <Text style={styles.fieldError} accessibilityRole="alert">
              {errors.name}
            </Text>
          )}
        </View>

        {/* Username Field */}
        <View style={styles.fieldContainer}>
          <TextInput
            style={[styles.input, errors.username && styles.inputError]}
            value={username}
            onChangeText={setUsername}
            placeholder="Username (5-15 characters)"
            placeholderTextColor={COLORS.placeholder}
            maxLength={15}
            autoCapitalize="none"
            accessibilityLabel="Username (5-15 characters)"
            editable={!isSubmitting}
          />
          {errors.username && (
            <Text style={styles.fieldError} accessibilityRole="alert">
              {errors.username}
            </Text>
          )}
        </View>

        {/* Phone Field */}
        <View style={styles.fieldContainer}>
          <TextInput
            style={[styles.input, errors.phone && styles.inputError]}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone Number (10 digits)"
            placeholderTextColor={COLORS.placeholder}
            maxLength={10}
            keyboardType="phone-pad"
            accessibilityLabel="Phone Number (10 digits)"
            editable={!isSubmitting}
          />
          {errors.phone && (
            <Text style={styles.fieldError} accessibilityRole="alert">
              {errors.phone}
            </Text>
          )}
        </View>

        {/* Email Field */}
        <View style={styles.fieldContainer}>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            value={email}
            onChangeText={setEmail}
            placeholder="Email Address"
            placeholderTextColor={COLORS.placeholder}
            maxLength={254}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Email Address"
            editable={!isSubmitting}
          />
          {errors.email && (
            <Text style={styles.fieldError} accessibilityRole="alert">
              {errors.email}
            </Text>
          )}
        </View>

        {/* Password Field */}
        <View style={styles.fieldContainer}>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (8-20 chars, mixed case + digit + special)"
            placeholderTextColor={COLORS.placeholder}
            maxLength={20}
            secureTextEntry={true}
            accessibilityLabel="Password (8-20 chars, mixed case + digit + special)"
            editable={!isSubmitting}
          />
          {errors.password && (
            <Text style={styles.fieldError} accessibilityRole="alert">
              {errors.password}
            </Text>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Register"
          accessibilityState={{disabled: isSubmitting}}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Register</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <TouchableOpacity
          onPress={handleNavigateToLogin}
          style={styles.loginLink}
          accessibilityRole="button"
          accessibilityLabel="Already have an account? Login">
          <Text style={styles.linkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  generalError: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8D7DA',
    borderRadius: 8,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
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
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: COLORS.linkText,
    fontSize: 14,
    fontWeight: '500',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successText: {
    fontSize: 16,
    color: COLORS.successText,
    textAlign: 'center',
    backgroundColor: COLORS.successBackground,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    overflow: 'hidden',
  },
});
