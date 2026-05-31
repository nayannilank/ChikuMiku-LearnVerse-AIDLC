/**
 * Mobile Notification Adapter
 *
 * Implements the PushNotificationInterface from platform-contracts using
 * native mobile notification APIs (e.g., expo-notifications, Firebase Cloud Messaging).
 * This is a stub/scaffold implementation that will be filled in with actual
 * native notification logic for Android/iOS.
 */

import type {
  PushNotificationInterface,
  NotificationPayload,
  NotificationPermission,
  NotificationError,
} from '@chikumiku/platform-contracts';

/**
 * Mobile-specific implementation of PushNotificationInterface.
 * Uses native notification APIs such as expo-notifications and FCM
 * (Firebase Cloud Messaging) for push notification support on mobile platforms.
 */
export class MobileNotificationAdapter implements PushNotificationInterface {
  private lastError: NotificationError | null = null;

  /**
   * Check current notification permission status.
   * Uses expo-notifications Permissions API or native permission checks.
   */
  async getPermissionStatus(): Promise<NotificationPermission> {
    throw new Error('Not implemented');
  }

  /**
   * Request notification permission from the user.
   * Triggers the native OS permission dialog via expo-notifications.
   */
  async requestPermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  /**
   * Register for push notifications and retrieve the device token.
   * Uses FCM (Firebase Cloud Messaging) for Android and APNs for iOS.
   */
  async registerForPush(): Promise<string> {
    throw new Error('Not implemented');
  }

  /**
   * Display a local notification on the device.
   * Uses expo-notifications scheduleNotificationAsync or equivalent native API.
   */
  async showLocalNotification(payload: NotificationPayload): Promise<boolean> {
    throw new Error('Not implemented');
  }

  /**
   * Cancel a scheduled or displayed notification by ID.
   * Uses expo-notifications cancelScheduledNotificationAsync or native API.
   */
  async cancelNotification(id: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  /**
   * Set a handler for when a notification is tapped by the user.
   * Uses expo-notifications addNotificationResponseReceivedListener or equivalent.
   */
  onNotificationTapped(handler: (payload: NotificationPayload) => void): void {
    throw new Error('Not implemented');
  }

  /**
   * Get the last error that occurred during notification operations.
   */
  getLastError(): NotificationError | null {
    return this.lastError;
  }
}
