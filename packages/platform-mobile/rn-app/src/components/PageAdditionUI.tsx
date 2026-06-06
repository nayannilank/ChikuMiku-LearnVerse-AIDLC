import React, {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import type {
  CameraInterface,
  FileSystemInterface,
} from '@chikumiku/platform-contracts';

/** Maximum page image size in bytes (10 MB) */
export const MAX_PAGE_IMAGE_SIZE_BYTES = 10_485_760;

/** Valid image MIME types for gallery picker */
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png'];

/** Valid image formats for pages */
export type PageImageFormat = 'jpeg' | 'png';

/**
 * Validates whether a file should be accepted for preview based on size and format.
 * Returns null if valid, or an error message string if invalid.
 *
 * This is exported for testability (Property 13: File size gate).
 */
export function validatePageImage(
  sizeBytes: number,
  mimeType: string,
): {valid: true; format: PageImageFormat} | {valid: false; error: string} {
  const format = mimeToFormat(mimeType);
  if (!format) {
    return {valid: false, error: 'Only JPEG and PNG images are supported'};
  }
  if (sizeBytes > MAX_PAGE_IMAGE_SIZE_BYTES) {
    return {valid: false, error: 'File exceeds 10 MB limit'};
  }
  return {valid: true, format};
}

/**
 * Converts a MIME type string to a PageImageFormat, or null if unsupported.
 */
function mimeToFormat(mimeType: string): PageImageFormat | null {
  if (mimeType === 'image/jpeg') return 'jpeg';
  if (mimeType === 'image/png') return 'png';
  return null;
}

export interface PageAdditionUIProps {
  /** Platform camera interface (injected) */
  camera: CameraInterface;
  /** Platform file system interface (injected) */
  fileSystem: FileSystemInterface;
  /** The active chapter ID */
  chapterId: string;
  /** Callback when a valid image is ready for preview */
  onImageCaptured: (
    data: ArrayBuffer,
    format: PageImageFormat,
    sizeBytes: number,
  ) => void;
}

/**
 * PageAdditionUI - Combined interface for camera capture and gallery upload.
 *
 * Displays camera and gallery buttons for adding textbook pages to a chapter.
 * Handles permission requests, validates file size (≤ 10 MB) and format (JPEG/PNG),
 * and calls onImageCaptured when a valid image is ready for preview.
 *
 * Requirements: 5.1, 5.2, 5.6, 5.7, 5.9, 5.10, 5.14, 5.15
 */
export default function PageAdditionUI({
  camera,
  fileSystem,
  onImageCaptured,
}: PageAdditionUIProps) {
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    camera.isAvailable().then(available => {
      if (mounted) {
        setCameraAvailable(available);
      }
    });
    return () => {
      mounted = false;
    };
  }, [camera]);

  /**
   * Validates that an image format string is a supported PageImageFormat.
   */
  function isValidFormat(format: string): format is PageImageFormat {
    return format === 'jpeg' || format === 'png';
  }

  /**
   * Validates file size is within the 10 MB limit.
   */
  function isValidSize(sizeBytes: number): boolean {
    return sizeBytes <= MAX_PAGE_IMAGE_SIZE_BYTES;
  }

  /**
   * Handles camera capture button tap.
   * Requests permission if needed, captures image, validates, and calls callback.
   */
  async function handleCameraCapture() {
    setErrorMessage(null);

    // Request camera permission (Requirement 5.2)
    const permissionGranted = await camera.requestPermission();
    if (!permissionGranted) {
      // Requirement 5.6: display guidance message
      setErrorMessage(
        'Camera access is required. Please enable it in your device settings.',
      );
      return;
    }

    try {
      // Capture in JPEG format
      const result = await camera.capture({format: 'jpeg', quality: 90});

      // Validate format (Requirement 5.14)
      if (!isValidFormat(result.format)) {
        setErrorMessage('Only JPEG and PNG images are supported');
        return;
      }

      // Validate size (Requirement 5.14)
      if (!isValidSize(result.sizeBytes)) {
        setErrorMessage('File exceeds 10 MB limit');
        return;
      }

      // Valid image - pass to preview callback
      onImageCaptured(result.data, result.format, result.sizeBytes);
    } catch {
      // Check the last error for more specific messaging
      const lastError = camera.getLastError();
      if (lastError && lastError.code === 'CANCELLED') {
        // User cancelled - no error to display (Requirement 5.13 analog)
        return;
      }
      setErrorMessage(
        lastError?.message || 'Failed to capture image. Please try again.',
      );
    }
  }

  /**
   * Handles gallery upload button tap.
   * Requests storage permission if needed, opens picker, validates, and calls callback.
   */
  async function handleGalleryUpload() {
    setErrorMessage(null);

    try {
      // Open file picker filtered to JPEG/PNG (Requirement 5.10)
      const files = await fileSystem.pickFiles({
        acceptedTypes: ACCEPTED_MIME_TYPES,
        multiple: false,
        maxSizeBytes: MAX_PAGE_IMAGE_SIZE_BYTES,
      });

      // If no files selected (user cancelled) - Requirement 5.13
      if (files.length === 0) {
        return;
      }

      const selectedFile = files[0];

      // Validate format based on MIME type
      const format = mimeToFormat(selectedFile.mimeType);
      if (!format) {
        setErrorMessage('Only JPEG and PNG images are supported');
        return;
      }

      // Validate size (Requirement 5.14)
      if (!isValidSize(selectedFile.sizeBytes)) {
        setErrorMessage('File exceeds 10 MB limit');
        return;
      }

      // Read the file data
      const fileResult = await fileSystem.readFile(selectedFile.path);

      // Valid image - pass to preview callback
      onImageCaptured(fileResult.data, format, selectedFile.sizeBytes);
    } catch {
      // Check the last error for permission denied (Requirement 5.9, 5.15)
      const lastError = fileSystem.getLastError();
      if (lastError && lastError.code === 'PERMISSION_DENIED') {
        setErrorMessage(
          'Photo library access is required. Please enable it in your device settings.',
        );
        return;
      }
      if (lastError && lastError.code === 'FILE_TOO_LARGE') {
        setErrorMessage('File exceeds 10 MB limit');
        return;
      }
      if (lastError && lastError.code === 'INVALID_FORMAT') {
        setErrorMessage('Only JPEG and PNG images are supported');
        return;
      }
      setErrorMessage(
        lastError?.message || 'Failed to select image. Please try again.',
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Page</Text>
      <Text style={styles.subtitle}>
        Capture or upload a textbook page image
      </Text>

      <View style={styles.buttonRow}>
        {/* Camera button - hidden if camera unavailable (Requirement 5.7) */}
        {cameraAvailable === true && (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCameraCapture}
            accessibilityLabel="Capture page with camera"
            accessibilityRole="button">
            <Text style={styles.buttonIcon}>📷</Text>
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>
        )}

        {/* Gallery button - always visible */}
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={handleGalleryUpload}
          accessibilityLabel="Upload page from gallery"
          accessibilityRole="button">
          <Text style={styles.buttonIcon}>🖼️</Text>
          <Text style={styles.buttonText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Error message display */}
      {errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
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
    fontSize: 18,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  captureButton: {
    flex: 1,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D2D2D',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
});
