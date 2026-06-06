import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {endChapter, endSession} from '../api/learningApi';
import PageAdditionUI from '../components/PageAdditionUI';
import type {PageImageFormat} from '../components/PageAdditionUI';
import ImagePreview from '../components/ImagePreview';
import type {
  CameraInterface,
  FileSystemInterface,
} from '@chikumiku/platform-contracts';

interface Props {
  navigation: any;
  route: {
    params: {
      subjectId: string;
      textbookId: string;
      chapterId: string | null;
    };
  };
  /** Platform camera interface (optional until platform provider wiring in task 9) */
  camera?: CameraInterface;
  /** Platform file system interface (optional until platform provider wiring in task 9) */
  fileSystem?: FileSystemInterface;
}

interface PreviewState {
  imageData: ArrayBuffer;
  imageFormat: 'jpeg' | 'png';
  imageSizeBytes: number;
}

export default function LearningScreen({navigation, route, camera, fileSystem}: Props) {
  const {subjectId, textbookId, chapterId} = route.params;
  const [preview, setPreview] = useState<PreviewState | null>(null);

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

  function handleImageCaptured(
    data: ArrayBuffer,
    format: PageImageFormat,
    sizeBytes: number,
  ) {
    setPreview({imageData: data, imageFormat: format, imageSizeBytes: sizeBytes});
  }

  function handlePreviewAccepted() {
    setPreview(null);
    Alert.alert('Success', 'Page added successfully!');
  }

  function handlePreviewRetake() {
    setPreview(null);
  }

  function handlePreviewError(message: string) {
    setPreview(null);
    Alert.alert('Error', message);
  }

  // If in preview mode and chapter is active, show ImagePreview
  if (preview && chapterId) {
    return (
      <ImagePreview
        imageData={preview.imageData}
        imageFormat={preview.imageFormat}
        imageSizeBytes={preview.imageSizeBytes}
        chapterId={chapterId}
        onAccepted={handlePreviewAccepted}
        onRetake={handlePreviewRetake}
        onError={handlePreviewError}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContent}>
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

      {/* Show PageAdditionUI when chapter is active and platform interfaces are available */}
      {chapterId && camera && fileSystem && (
        <PageAdditionUI
          camera={camera}
          fileSystem={fileSystem}
          chapterId={chapterId}
          onImageCaptured={handleImageCaptured}
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleEndChapter}>
          <Text style={styles.secondaryButtonText}>← Back to Chapters</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
          <Text style={styles.endButtonText}>End Session</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {flex: 1, backgroundColor: '#F8F9FA'},
  scrollContent: {flexGrow: 1, padding: 20},
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
  actions: {gap: 12, marginTop: 24},
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
