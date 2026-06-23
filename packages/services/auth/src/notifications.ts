/**
 * Notification Channel
 *
 * Abstraction for delivering messages (email or SMS) to users.
 * For local development, a console-logging implementation is used.
 * Production would inject SES/SNS adapters.
 *
 * Requirements: 3.2, 3.3, 3.5
 */

/**
 * Interface for sending notifications via email or SMS.
 * Implementations can target console (dev), SES, SNS, or other providers.
 */
export interface NotificationChannel {
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
  sendSms(to: string, message: string): Promise<boolean>;
}

/**
 * Console-logging implementation of NotificationChannel for local development.
 * Logs all notifications to the console and always returns true (success).
 */
export class ConsoleNotificationChannel implements NotificationChannel {
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    console.log(`[NotificationChannel] Email sent to: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${body}`);
    return true;
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    console.log(`[NotificationChannel] SMS sent to: ${to}`);
    console.log(`  Message: ${message}`);
    return true;
  }
}

/**
 * Singleton notification service instance for use by handlers.
 * Uses console logging for local development.
 */
export const notificationService: NotificationChannel = new ConsoleNotificationChannel();
