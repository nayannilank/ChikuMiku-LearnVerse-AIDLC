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

const MAX_NAME_LENGTH = 200;

export interface ChapterCreationFormProps {
  textbookId: string;
  subjectId: string;
  onSuccess: (chapter: any) => void;
  onCancel: () => void;
}

export default function ChapterCreationForm({
  textbookId,
  onSuccess,
  onCancel,
}: ChapterCreationFormProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 'Chapter name is required';
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Chapter name must be ${MAX_NAME_LENGTH} characters or fewer`;
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
        `${BASE_URL}/api/v1/textbooks/${textbookId}/chapters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer dev-token',
            'x-learner-id': 'mobile-learner-1',
          },
          body: JSON.stringify({name: name.trim()}),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle validation error (400) or textbook not found (404)
        setError(data.message || `Error: ${response.status}`);
        setLoading(false);
        return;
      }

      // Success (201) - call onSuccess with the created chapter
      onSuccess(data.data);
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Chapter</Text>

      <Text style={styles.label}>Chapter Name</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={name}
        onChangeText={text => {
          setName(text);
          if (error) {
            setError(null);
          }
        }}
        placeholder="Enter chapter name"
        placeholderTextColor="#999"
        maxLength={MAX_NAME_LENGTH}
        editable={!loading}
        autoFocus
      />
      <View style={styles.counterRow}>
        {error ? <Text style={styles.errorText}>{error}</Text> : <View />}
        <Text style={styles.charCount}>
          {name.length}/{MAX_NAME_LENGTH}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={loading}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            loading ? styles.submitButtonDisabled : null,
          ]}
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Create Chapter</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2D',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2D2D2D',
    backgroundColor: '#F8F9FA',
  },
  inputError: {
    borderColor: '#E53E3E',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  errorText: {
    fontSize: 13,
    color: '#E53E3E',
    flex: 1,
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
