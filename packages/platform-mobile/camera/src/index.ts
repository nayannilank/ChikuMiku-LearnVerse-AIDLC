/**
 * Mobile Camera Adapter
 *
 * Implements the CameraInterface from platform-contracts using native
 * camera APIs (e.g., expo-camera, react-native-camera). This is a
 * stub/scaffold implementation that will be filled in with actual
 * native camera logic.
 */

import type {
  CameraInterface,
  CameraCaptureOptions,
  CameraCaptureResult,
  CameraError,
} from '@learnverse/platform-contracts';

/**
 * Mobile-specific implementation of CameraInterface.
 * Uses native camera APIs (e.g., expo-camera, react-native-camera) for camera access.
 */
export class MobileCameraAdapter implements CameraInterface {
  private lastError: CameraError | null = null;

  async isAvailable(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async requestPermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async capture(options: CameraCaptureOptions): Promise<CameraCaptureResult> {
    throw new Error('Not implemented');
  }

  getLastError(): CameraError | null {
    return this.lastError;
  }
}
