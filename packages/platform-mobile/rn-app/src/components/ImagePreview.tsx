import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const BASE_URL = __DEV__
  ? 'http://10.0.2.2:3000'
  : 'https://api.chikumiku.example.com';

const LEARNER_ID = 'mobile-learner-1';

export interface ImagePreviewProps {
  /** Raw image bytes */
  imageData: ArrayBuffer;
  /** Image format */
  imageFormat: 'jpeg' | 'png';
  /** Size of the image in bytes */
  imageSizeBytes: number;
  /** The chapter to add the page to */
  chapterId: string;
  /** Callback on successful upload (dismiss preview and refresh) */
  onAccepted: () => void;
  /** Callback to dismiss preview and allow re-capture/re-select */
  onRetake: () => void;
  /** Callback on upload failure */
  onError: (message: string) => void;
}

/**
 * Converts an ArrayBuffer to a base64-encoded string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use global btoa if available (React Native polyfills this)
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  // Fallback for environments without btoa
  return Buffer.from(buffer).toString('base64');
}

/**
 * ImagePreview — Displays a captured/selected image with Accept and Retake buttons.
 *
 * On accept: uploads the image to POST /api/v1/chapters/:chapterId/pages.
 * On success: calls onAccepted().
 * On failure: calls onError(message) to remove local page association and show error.
 * On retake: calls onRetake() to dismiss preview and go back to capture/selection mode.
 *
 * Validates: Requirements 5.4, 5.5, 5.8, 5.11, 5.12, 5.13
 */
export default function ImagePreview({
  imageData,
  imageFormat,
  imageSizeBytes,
  chapterId,
  onAccepted,
  onRetake,
  onError,
}: ImagePreviewProps) {
  const [uploading, setUploading] = useState(false);

  // Convert ArrayBuffer to base64 data URI for display
  const imageUri = useMemo(() => {
    const base64 = arrayBufferToBase64(imageData);
    const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  }, [imageData, imageFormat]);

  async function handleAccept() {
    setUploading(true);

    try {
      const response = await fetch(
        `${BASE_URL}/api/v1/chapters/${chapterId}/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer dev-token',
            'x-learner-id': LEARNER_ID,
          },
          body: JSON.stringify({
            imageUri,
            imageSizeBytes,
            imageFormat,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // Requirement 5.12: upload failure — remove local association, show error
        setUploading(false);
        onError(data.message || `Upload failed (${response.status})`);
        return;
      }

      // Requirement 5.5: successful upload — notify parent
      onAccepted();
    } catch (err: any) {
      // Requirement 5.12: network/unexpected error
      setUploading(false);
      onError(err.message || 'Failed to upload image. Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Preview</Text>
        <Text style={styles.subtitle}>
          Review your image before adding it to the chapter
        </Text>

        <View style={styles.imageContainer}>
          <Image
            source={{uri: imageUri}}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel="Preview of captured or selected image"
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={onRetake}
            disabled={uploading}
            accessibilityLabel="Retake or choose another image"
            accessibilityRole="button">
            <Text style={styles.retakeButtonText}>Retake / Choose Another</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, uploading && styles.acceptButtonDisabled]}
            onPress={handleAccept}
            disabled={uploading}
            accessibilityLabel="Accept and upload image"
            accessibilityRole="button">
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept</Text>
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
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.7,
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
