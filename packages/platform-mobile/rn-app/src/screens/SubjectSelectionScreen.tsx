import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  startLearningSession,
  selectSubject,
  enrollInSubject,
  EnrolledSubject,
} from '../api/learningApi';

interface Props {
  navigation: any;
}

const AVAILABLE_SUBJECTS = [
  {id: 'english', name: 'English', emoji: '📖'},
  {id: 'hindi', name: 'Hindi', emoji: '🕉️'},
  {id: 'kannada', name: 'Kannada', emoji: '🏛️'},
  {id: 'mathematics', name: 'Mathematics', emoji: '🔢'},
  {id: 'science', name: 'Science', emoji: '🔬'},
];

export default function SubjectSelectionScreen({navigation}: Props) {
  const [enrolledSubjects, setEnrolledSubjects] = useState<EnrolledSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startSession();
  }, []);

  async function startSession() {
    setLoading(true);
    setError(null);
    try {
      const response = await startLearningSession();
      setEnrolledSubjects(response.availableSubjects);
    } catch (err: any) {
      if (err.message?.includes('enroll')) {
        // No subjects enrolled yet — show enrollment UI
        setEnrolledSubjects([]);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSubject(subjectId: string) {
    try {
      await selectSubject(subjectId);
      navigation.navigate('TextbookList', {
        subjectId,
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function handleEnroll(subjectId: string) {
    try {
      await enrollInSubject(subjectId);
      // Restart session to get updated list
      await startSession();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading subjects...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={startSession}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (enrolledSubjects.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome! 🎉</Text>
        <Text style={styles.subtitle}>
          Choose a subject to get started
        </Text>
        <FlatList
          data={AVAILABLE_SUBJECTS}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.enrollCard}
              onPress={() => handleEnroll(item.id)}>
              <Text style={styles.emoji}>{item.emoji}</Text>
              <Text style={styles.subjectName}>{item.name}</Text>
              <Text style={styles.enrollBadge}>+ Enroll</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What would you like to learn?</Text>
      <Text style={styles.subtitle}>Select a subject to continue</Text>
      <FlatList
        data={enrolledSubjects}
        keyExtractor={item => item.subjectId}
        renderItem={({item}) => {
          const meta = AVAILABLE_SUBJECTS.find(s => s.id === item.subjectId);
          return (
            <TouchableOpacity
              style={styles.subjectCard}
              onPress={() => handleSelectSubject(item.subjectId)}>
              <Text style={styles.emoji}>{meta?.emoji ?? '📚'}</Text>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>
                  {meta?.name ?? item.subjectId}
                </Text>
                <Text style={styles.enrolledDate}>
                  Enrolled {new Date(item.enrolledAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA', padding: 20},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20},
  title: {fontSize: 28, fontWeight: 'bold', color: '#2D2D2D', marginBottom: 8},
  subtitle: {fontSize: 16, color: '#666', marginBottom: 24},
  loadingText: {marginTop: 12, color: '#666', fontSize: 16},
  errorText: {color: '#E53E3E', fontSize: 16, textAlign: 'center', marginBottom: 16},
  retryButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {color: '#FFF', fontWeight: '600'},
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  enrollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emoji: {fontSize: 32, marginRight: 16},
  subjectInfo: {flex: 1},
  subjectName: {fontSize: 18, fontWeight: '600', color: '#2D2D2D'},
  enrolledDate: {fontSize: 13, color: '#999', marginTop: 4},
  enrollBadge: {
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '600',
  },
  arrow: {fontSize: 24, color: '#6C63FF'},
});
