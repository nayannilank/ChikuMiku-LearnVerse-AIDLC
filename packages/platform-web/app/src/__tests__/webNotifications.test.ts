import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWebPlatformProvider } from '../index';
import type { PushNotificationInterface } from '@learnverse/platform-contracts';

/**
 * Unit tests for WebNotifications adapter.
 * Validates: Requirements 20.1, 20.2, 20.3, 20.4
 */

describe('WebNotifications', () => {
  let notifications: PushNotificationInterface;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // Set up a minimal window object if not present (node environment)
    if (typeof globalThis.window === 'undefined') {
      // @ts-expect-error - creating minimal window mock for node env
      globalThis.window = globalThis;
    }
  });

  afterEach(() => {
    // Restore original state
    if (originalWindow === undefined) {
      // @ts-expect-error - removing window mock
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    // Clean up Notification from globalThis
    // @ts-expect-error - cleanup
    delete globalThis.Notification;
    vi.restoreAllMocks();
  });

  function setupNotificationMock(permission: 'granted' | 'denied' | 'default') {
    const notificationInstances: Array<{ title: string; options?: NotificationOptions; onclick: ((ev: Event) => void) | null }> = [];

    function MockNotificationCtor(this: Record<string, unknown>, title: string, options?: NotificationOptions) {
      const instance = { title, options, onclick: null as ((ev: Event) => void) | null };
      notificationInstances.push(instance);
      // Set onclick as a property on `this` so external code can assign it
      Object.defineProperty(this, 'onclick', {
        get: () => instance.onclick,
        set: (handler: ((ev: Event) => void) | null) => { instance.onclick = handler; },
        configurable: true,
      });
    }

    const MockNotification = vi.fn(MockNotificationCtor) as unknown as typeof Notification;

    Object.defineProperty(MockNotification, 'permission', {
      get: () => permission,
      configurable: true,
    });

    MockNotification.requestPermission = vi.fn() as typeof Notification.requestPermission;

    // Assign mock to global
    globalThis.Notification = MockNotification;

    return { MockNotification, notificationInstances };
  }

  function removeNotificationAPI() {
    // @ts-expect-error - removing to simulate unsupported API
    delete globalThis.Notification;
  }

  describe('getPermissionStatus()', () => {
    it('returns "granted" when Notification.permission is "granted"', async () => {
      setupNotificationMock('granted');
      notifications = createWebPlatformProvider().notifications;

      const status = await notifications.getPermissionStatus();
      expect(status).toBe('granted');
    });

    it('returns "denied" when Notification.permission is "denied"', async () => {
      setupNotificationMock('denied');
      notifications = createWebPlatformProvider().notifications;

      const status = await notifications.getPermissionStatus();
      expect(status).toBe('denied');
    });

    it('returns "not_determined" when Notification.permission is "default"', async () => {
      setupNotificationMock('default');
      notifications = createWebPlatformProvider().notifications;

      const status = await notifications.getPermissionStatus();
      expect(status).toBe('not_determined');
    });

    it('sets NOT_SUPPORTED error when Notification API is not available', async () => {
      removeNotificationAPI();
      notifications = createWebPlatformProvider().notifications;

      const status = await notifications.getPermissionStatus();
      expect(status).toBe('not_determined');

      const error = notifications.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('NOT_SUPPORTED');
    });
  });

  describe('requestPermission()', () => {
    it('returns true when user grants permission', async () => {
      const { MockNotification } = setupNotificationMock('default');
      (MockNotification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
      notifications = createWebPlatformProvider().notifications;

      const result = await notifications.requestPermission();
      expect(result).toBe(true);
    });

    it('returns false with PERMISSION_DENIED when denied', async () => {
      const { MockNotification } = setupNotificationMock('default');
      (MockNotification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');
      notifications = createWebPlatformProvider().notifications;

      const result = await notifications.requestPermission();
      expect(result).toBe(false);

      const error = notifications.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('PERMISSION_DENIED');
    });

    it('returns false with NOT_SUPPORTED when API is missing', async () => {
      removeNotificationAPI();
      notifications = createWebPlatformProvider().notifications;

      const result = await notifications.requestPermission();
      expect(result).toBe(false);

      const error = notifications.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('NOT_SUPPORTED');
    });
  });

  describe('showLocalNotification()', () => {
    it('creates Notification with correct params and returns true', async () => {
      const { MockNotification } = setupNotificationMock('granted');
      notifications = createWebPlatformProvider().notifications;

      const payload = {
        id: 'notif-1',
        title: 'Revision Reminder',
        body: 'Time to review your chapter!',
        data: { chapterId: 'ch-42' },
      };

      const result = await notifications.showLocalNotification(payload);
      expect(result).toBe(true);
      expect(MockNotification).toHaveBeenCalledWith('Revision Reminder', {
        body: 'Time to review your chapter!',
        data: { chapterId: 'ch-42' },
        tag: 'notif-1',
      });
    });

    it('returns false with PERMISSION_DENIED if not granted', async () => {
      setupNotificationMock('denied');
      notifications = createWebPlatformProvider().notifications;

      const payload = {
        id: 'notif-2',
        title: 'Test',
        body: 'Test body',
      };

      const result = await notifications.showLocalNotification(payload);
      expect(result).toBe(false);

      const error = notifications.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('PERMISSION_DENIED');
    });

    it('returns false with NOT_SUPPORTED if API is missing', async () => {
      removeNotificationAPI();
      notifications = createWebPlatformProvider().notifications;

      const payload = {
        id: 'notif-3',
        title: 'Test',
        body: 'Test body',
      };

      const result = await notifications.showLocalNotification(payload);
      expect(result).toBe(false);

      const error = notifications.getLastError();
      expect(error).not.toBeNull();
      expect(error!.code).toBe('NOT_SUPPORTED');
    });
  });

  describe('onNotificationTapped()', () => {
    it('handler is invoked on notification click', async () => {
      const { notificationInstances } = setupNotificationMock('granted');
      notifications = createWebPlatformProvider().notifications;

      const handler = vi.fn();
      notifications.onNotificationTapped(handler);

      const payload = {
        id: 'notif-tap',
        title: 'Tap Test',
        body: 'Click me',
        data: { key: 'value' },
      };

      await notifications.showLocalNotification(payload);

      // The Notification constructor was called, and onclick was assigned.
      // Simulate clicking the notification by invoking onclick on the instance.
      expect(notificationInstances.length).toBe(1);
      const instance = notificationInstances[0];
      expect(instance.onclick).not.toBeNull();
      instance.onclick!(new Event('click'));

      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe('getLastError()', () => {
    it('returns null when no error has occurred', () => {
      setupNotificationMock('granted');
      notifications = createWebPlatformProvider().notifications;

      expect(notifications.getLastError()).toBeNull();
    });
  });
});
