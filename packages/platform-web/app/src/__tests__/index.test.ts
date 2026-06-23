import { describe, it, expect } from 'vitest';
import { createWebPlatformProvider } from '../index';

describe('createWebPlatformProvider', () => {
  it('returns a provider with platform set to "web"', () => {
    const provider = createWebPlatformProvider();
    expect(provider.platform).toBe('web');
  });

  describe('interface properties are non-null objects', () => {
    it('has a non-null camera object', () => {
      const provider = createWebPlatformProvider();
      expect(provider.camera).not.toBeNull();
      expect(typeof provider.camera).toBe('object');
    });

    it('has a non-null fileSystem object', () => {
      const provider = createWebPlatformProvider();
      expect(provider.fileSystem).not.toBeNull();
      expect(typeof provider.fileSystem).toBe('object');
    });

    it('has a non-null notifications object', () => {
      const provider = createWebPlatformProvider();
      expect(provider.notifications).not.toBeNull();
      expect(typeof provider.notifications).toBe('object');
    });

    it('has a non-null audio object', () => {
      const provider = createWebPlatformProvider();
      expect(provider.audio).not.toBeNull();
      expect(typeof provider.audio).toBe('object');
    });

    it('has a non-null navigation object', () => {
      const provider = createWebPlatformProvider();
      expect(provider.navigation).not.toBeNull();
      expect(typeof provider.navigation).toBe('object');
    });

    it('has a non-null storage object', () => {
      const provider = createWebPlatformProvider();
      expect(provider.storage).not.toBeNull();
      expect(typeof provider.storage).toBe('object');
    });
  });

  describe('no permissions requested on construction (no side effects)', () => {
    it('does not throw during construction', () => {
      expect(() => createWebPlatformProvider()).not.toThrow();
    });

    it('camera reports unavailable without requesting permission', async () => {
      const provider = createWebPlatformProvider();
      const available = await provider.camera.isAvailable();
      expect(available).toBe(false);
    });

    it('audio reports microphone unavailable without requesting permission', async () => {
      const provider = createWebPlatformProvider();
      const available = await provider.audio.isMicrophoneAvailable();
      expect(available).toBe(false);
    });

    it('notifications reports permission as not_determined without requesting', async () => {
      const provider = createWebPlatformProvider();
      const status = await provider.notifications.getPermissionStatus();
      expect(status).toBe('not_determined');
    });

    it('navigation reports current route without side effects', () => {
      const provider = createWebPlatformProvider();
      const route = provider.navigation.getCurrentRoute();
      expect(typeof route).toBe('string');
    });

    it('navigation reports canGoBack without side effects', () => {
      const provider = createWebPlatformProvider();
      const canGoBack = provider.navigation.canGoBack();
      expect(canGoBack).toBe(false);
    });
  });

  describe('capability methods degrade gracefully when browser APIs are unavailable', () => {
    it('camera.requestPermission resolves to false when mediaDevices is unavailable', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.camera.requestPermission();
      expect(result).toBe(false);
    });

    it('camera.capture throws a CameraError when mediaDevices is unavailable', async () => {
      const provider = createWebPlatformProvider();
      await expect(
        provider.camera.capture({ format: 'jpeg', quality: 80 })
      ).rejects.toEqual(expect.objectContaining({ code: 'CAMERA_UNAVAILABLE' }));
    });

    it('fileSystem.readFile resolves with empty data when file is not found', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.fileSystem.readFile('/test.txt');
      expect(result.data.byteLength).toBe(0);
    });

    it('fileSystem.deleteFile resolves to false when file does not exist', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.fileSystem.deleteFile('/test.txt');
      expect(result).toBe(false);
    });

    it('fileSystem.getAvailableSpace resolves to 0 when Storage API is unavailable', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.fileSystem.getAvailableSpace();
      expect(result).toBe(0);
    });

    it('notifications.requestPermission resolves to false when Notification API is unavailable', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.notifications.requestPermission();
      expect(result).toBe(false);
    });

    it('notifications.registerForPush resolves to empty string when push is unavailable', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.notifications.registerForPush();
      expect(result).toBe('');
    });

    it('notifications.showLocalNotification resolves to false when permission not granted', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.notifications.showLocalNotification({
        id: '1',
        title: 'Test',
        body: 'Test body',
      });
      expect(result).toBe(false);
    });

    it('audio.requestMicrophonePermission resolves to false when mediaDevices is unavailable', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.audio.requestMicrophonePermission();
      expect(result).toBe(false);
    });

    it('audio.stopRecording resolves with empty result when no recording active', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.audio.stopRecording();
      expect(result.data.byteLength).toBe(0);
      expect(result.durationSeconds).toBe(0);
    });

    it('audio.stopPlayback resolves without error when nothing is playing', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.audio.stopPlayback()).resolves.toBeUndefined();
    });

    it('navigation.navigate throws "Not implemented"', () => {
      const provider = createWebPlatformProvider();
      expect(() => provider.navigation.navigate('/home')).toThrow('Not implemented');
    });

    it('navigation.goBack throws "Not implemented"', () => {
      const provider = createWebPlatformProvider();
      expect(() => provider.navigation.goBack()).toThrow('Not implemented');
    });

    it('storage.setItem resolves successfully', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.setItem('key', 'value')).resolves.toBeUndefined();
    });

    it('storage.getItem resolves to null for non-existent key', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.storage.getItem('nonexistent');
      expect(result).toBeNull();
    });

    it('storage.removeItem resolves successfully', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.removeItem('key')).resolves.toBeUndefined();
    });

    it('storage.clear resolves successfully', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.clear()).resolves.toBeUndefined();
    });

    it('storage.getAllKeys resolves to an array', async () => {
      const provider = createWebPlatformProvider();
      const result = await provider.storage.getAllKeys();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
