import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

const LEARNER_ID = 'mobile-learner-1';

const MAX_NAME_LENGTH = 200;

export interface TextbookEntryFormProps {
  subjectId: string;
  onSuccess: (textbook: any) => void;
  onCancel: () => void;
}

/**
 * TextbookEntryForm - A form component for creating a new textbook under a subject.
 *
 * Validates: Requirements 4.2, 4.3, 4.8, 4.9, 4.10
 */
export default function TextbookEntryForm({
  subjectId,
  onSuccess,
  onCancel,
}: TextbookEntryFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 'Textbook name is required';
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Textbook name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/subjects/${subjectId}/textbooks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer dev-token',
            'x-learner-id': LEARNER_ID,
          },
          body: JSON.stringify({name: name.trim()}),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // Requirement 4.9: backend error preserves values and shows error
        setError(data.message || `Failed to create textbook (${response.status})`);
        setLoading(false);
        return;
      }

      // Requirement 4.3: on success, inform parent to display chapter list
      onSuccess(data.data);
    } catch (err: any) {
      // Requirement 4.9: network/unexpected error preserves values and shows error
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Add Textbook</Text>
        <Text style={styles.subtitle}>
          Enter a name for your new textbook
        </Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder="Textbook name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={text => {
            setName(text);
            if (error) {
              setError(null);
            }
          }}
          maxLength={MAX_NAME_LENGTH}
          editable={!loading}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.charCount}>
          {name.trim().length}/{MAX_NAME_LENGTH}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D2D2D',
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#E53E3E',
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 13,
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
