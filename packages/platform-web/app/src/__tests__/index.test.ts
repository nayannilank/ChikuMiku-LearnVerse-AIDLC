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

  describe('capability methods throw or reject when invoked (stub behavior)', () => {
    it('camera.requestPermission rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.camera.requestPermission()).rejects.toThrow('Not implemented');
    });

    it('camera.capture rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(
        provider.camera.capture({ format: 'jpeg', quality: 80 })
      ).rejects.toThrow('Not implemented');
    });

    it('fileSystem.pickFiles rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(
        provider.fileSystem.pickFiles({ acceptedTypes: ['image/png'], multiple: false })
      ).rejects.toThrow('Not implemented');
    });

    it('fileSystem.readFile rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.fileSystem.readFile('/test.txt')).rejects.toThrow('Not implemented');
    });

    it('fileSystem.writeFile rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(
        provider.fileSystem.writeFile('/test.txt', new ArrayBuffer(0), 'text/plain')
      ).rejects.toThrow('Not implemented');
    });

    it('fileSystem.deleteFile rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.fileSystem.deleteFile('/test.txt')).rejects.toThrow('Not implemented');
    });

    it('fileSystem.getAvailableSpace rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.fileSystem.getAvailableSpace()).rejects.toThrow('Not implemented');
    });

    it('notifications.requestPermission rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.notifications.requestPermission()).rejects.toThrow('Not implemented');
    });

    it('notifications.registerForPush rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.notifications.registerForPush()).rejects.toThrow('Not implemented');
    });

    it('notifications.showLocalNotification rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(
        provider.notifications.showLocalNotification({
          id: '1',
          title: 'Test',
          body: 'Test body',
        })
      ).rejects.toThrow('Not implemented');
    });

    it('audio.requestMicrophonePermission rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.audio.requestMicrophonePermission()).rejects.toThrow('Not implemented');
    });

    it('audio.startRecording rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(
        provider.audio.startRecording({ maxDurationSeconds: 30, format: 'wav' })
      ).rejects.toThrow('Not implemented');
    });

    it('audio.stopRecording rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.audio.stopRecording()).rejects.toThrow('Not implemented');
    });

    it('audio.playAudio rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.audio.playAudio(new ArrayBuffer(0))).rejects.toThrow('Not implemented');
    });

    it('audio.stopPlayback rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.audio.stopPlayback()).rejects.toThrow('Not implemented');
    });

    it('navigation.navigate throws "Not implemented"', () => {
      const provider = createWebPlatformProvider();
      expect(() => provider.navigation.navigate('/home')).toThrow('Not implemented');
    });

    it('navigation.goBack throws "Not implemented"', () => {
      const provider = createWebPlatformProvider();
      expect(() => provider.navigation.goBack()).toThrow('Not implemented');
    });

    it('storage.getItem rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.getItem('key')).rejects.toThrow('Not implemented');
    });

    it('storage.setItem rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.setItem('key', 'value')).rejects.toThrow('Not implemented');
    });

    it('storage.removeItem rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.removeItem('key')).rejects.toThrow('Not implemented');
    });

    it('storage.clear rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.clear()).rejects.toThrow('Not implemented');
    });

    it('storage.getAllKeys rejects with "Not implemented"', async () => {
      const provider = createWebPlatformProvider();
      await expect(provider.storage.getAllKeys()).rejects.toThrow('Not implemented');
    });
  });
});
