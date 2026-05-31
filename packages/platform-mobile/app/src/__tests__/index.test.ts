import { describe, it, expect } from 'vitest';
import { createMobilePlatformProvider } from '../index';

describe('createMobilePlatformProvider', () => {
  describe('platform property', () => {
    it('should return a provider with platform set to "android" or "ios"', () => {
      const provider = createMobilePlatformProvider();
      expect(['android', 'ios']).toContain(provider.platform);
    });

    it('should default to "android" in a Node.js environment without navigator', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.platform).toBe('android');
    });
  });

  describe('interface properties are non-null objects', () => {
    it('should have a non-null camera object', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.camera).not.toBeNull();
      expect(typeof provider.camera).toBe('object');
    });

    it('should have a non-null fileSystem object', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.fileSystem).not.toBeNull();
      expect(typeof provider.fileSystem).toBe('object');
    });

    it('should have a non-null notifications object', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.notifications).not.toBeNull();
      expect(typeof provider.notifications).toBe('object');
    });

    it('should have a non-null audio object', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.audio).not.toBeNull();
      expect(typeof provider.audio).toBe('object');
    });

    it('should have a non-null navigation object', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.navigation).not.toBeNull();
      expect(typeof provider.navigation).toBe('object');
    });

    it('should have a non-null storage object', () => {
      const provider = createMobilePlatformProvider();
      expect(provider.storage).not.toBeNull();
      expect(typeof provider.storage).toBe('object');
    });
  });

  describe('no side effects on construction', () => {
    it('should not request any permissions during construction', () => {
      // Construction should complete without throwing or triggering permission requests.
      // If permissions were requested, the stubs would throw "Not implemented".
      const provider = createMobilePlatformProvider();
      expect(provider).toBeDefined();
    });

    it('should return a new provider instance on each call', () => {
      const provider1 = createMobilePlatformProvider();
      const provider2 = createMobilePlatformProvider();
      expect(provider1).not.toBe(provider2);
      expect(provider1.camera).not.toBe(provider2.camera);
    });
  });

  describe('capability methods throw or reject appropriately (stub behavior)', () => {
    it('camera.capture should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(
        provider.camera.capture({ format: 'jpeg' })
      ).rejects.toThrow('Not implemented');
    });

    it('camera.requestPermission should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.camera.requestPermission()).rejects.toThrow('Not implemented');
    });

    it('fileSystem.pickFiles should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(
        provider.fileSystem.pickFiles({ acceptedTypes: ['image/png'], multiple: false })
      ).rejects.toThrow('Not implemented');
    });

    it('fileSystem.readFile should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.fileSystem.readFile('/test.txt')).rejects.toThrow('Not implemented');
    });

    it('notifications.registerForPush should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.notifications.registerForPush()).rejects.toThrow('Not implemented');
    });

    it('notifications.showLocalNotification should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(
        provider.notifications.showLocalNotification({
          id: '1',
          title: 'Test',
          body: 'Test body',
        })
      ).rejects.toThrow('Not implemented');
    });

    it('audio.startRecording should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(
        provider.audio.startRecording({ maxDurationSeconds: 30, format: 'wav' })
      ).rejects.toThrow('Not implemented');
    });

    it('audio.stopRecording should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.audio.stopRecording()).rejects.toThrow('Not implemented');
    });

    it('navigation.navigate should throw "Not implemented"', () => {
      const provider = createMobilePlatformProvider();
      expect(() => provider.navigation.navigate('/home')).toThrow('Not implemented');
    });

    it('navigation.goBack should throw "Not implemented"', () => {
      const provider = createMobilePlatformProvider();
      expect(() => provider.navigation.goBack()).toThrow('Not implemented');
    });

    it('storage.getItem should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.storage.getItem('key')).rejects.toThrow('Not implemented');
    });

    it('storage.setItem should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.storage.setItem('key', 'value')).rejects.toThrow('Not implemented');
    });

    it('storage.clear should reject with "Not implemented"', async () => {
      const provider = createMobilePlatformProvider();
      await expect(provider.storage.clear()).rejects.toThrow('Not implemented');
    });
  });
});
