/**
 * Web Notification Adapter
 *
 * Implements the PushNotificationInterface from platform-contracts using
 * browser Notification API. This is a stub/scaffold implementation
 * that will be filled in with actual browser notification logic.
 */

import type {
  PushNotificationInterface,
  NotificationPayload,
  NotificationPermission,
  NotificationError,
} from '@chikumiku/platform-contracts';

/**
 * Web-specific implementation of PushNotificationInterface.
 * Uses the browser Notification API for push notification support.
 */
export class WebNotificationAdapter implements PushNotificationInterface {
  private lastError: NotificationError | null = null;

  async getPermissionStatus(): Promise<NotificationPermission> {
    throw new Error('Not implemented');
  }

  async requestPermission(): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async registerForPush(): Promise<string> {
    throw new Error('Not implemented');
  }

  async showLocalNotification(payload: NotificationPayload): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async cancelNotification(id: string): Promise<boolean> {
    throw new Error('Not implemented');
  }

  onNotificationTapped(handler: (payload: NotificationPayload) => void): void {
    throw new Error('Not implemented');
  }

  getLastError(): NotificationError | null {
    return this.lastError;
  }
}
