/**
 * Web Camera Adapter
 *
 * Implements the CameraInterface from platform-contracts using browser
 * MediaDevices API / getUserMedia. This is a stub/scaffold implementation
 * that will be filled in with actual browser camera logic.
 */

import type {
  CameraInterface,
  CameraCaptureOptions,
  CameraCaptureResult,
  CameraError,
} from '@chikumiku/platform-contracts';

/**
 * Web-specific implementation of CameraInterface.
 * Uses the browser MediaDevices API for camera access.
 */
export class WebCameraAdapter implements CameraInterface {
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
