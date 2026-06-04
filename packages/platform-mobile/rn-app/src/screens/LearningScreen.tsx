import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {endChapter, endSession} from '../api/learningApi';

interface Props {
  navigation: any;
  route: {
    params: {
      subjectId: string;
      chapterId: string | null;
    };
  };
}

export default function LearningScreen({navigation, route}: Props) {
  const {subjectId, chapterId} = route.params;

  async function handleEndChapter() {
    try {
      await endChapter();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function handleEndSession() {
    try {
      await endSession();
      navigation.popToTop();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subjectBadge}>
          {subjectId.charAt(0).toUpperCase() + subjectId.slice(1)}
        </Text>
        <Text style={styles.chapterBadge}>
          {chapterId ? `Chapter: ${chapterId}` : '📝 New Chapter'}
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.emoji}>🎓</Text>
        <Text style={styles.title}>Learning in Progress</Text>
        <Text style={styles.description}>
          {chapterId
            ? 'Continue working on this chapter. Upload photos, practice pronunciation, or take a revision test.'
            : 'Start by uploading a photo of your textbook page to create content for this chapter.'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleEndChapter}>
          <Text style={styles.secondaryButtonText}>← Back to Chapters</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
          <Text style={styles.endButtonText}>End Session</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F9FA', padding: 20},
  header: {flexDirection: 'row', gap: 8, marginBottom: 32},
  subjectBadge: {
    backgroundColor: '#EDE9FE',
    color: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
  chapterBadge: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
  content: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20},
  emoji: {fontSize: 64, marginBottom: 16},
  title: {fontSize: 24, fontWeight: 'bold', color: '#2D2D2D', marginBottom: 12},
  description: {fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24},
  actions: {gap: 12},
  secondaryButton: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryButtonText: {fontSize: 16, color: '#6C63FF', fontWeight: '600'},
  endButton: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButtonText: {fontSize: 16, color: '#DC2626', fontWeight: '600'},
});
