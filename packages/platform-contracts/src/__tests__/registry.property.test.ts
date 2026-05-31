/**
 * Property Test: PlatformRegistry throws without active provider
 *
 * Property 9: For any sequence of PlatformRegistry operations that does not
 * include a successful setActive() call, invoking getActive() SHALL throw an
 * error with the message 'No active platform provider. Call setActive() first.'
 *
 * **Validates: Requirements 8.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  PlatformRegistry,
  PlatformProvider,
  CameraInterface,
  FileSystemInterface,
  PushNotificationInterface,
  AudioInterface,
  NavigationInterface,
  DeviceStorageInterface,
} from '../index';

/** Valid platform identifiers */
const platforms = ['android', 'web', 'ios'] as const;
type Platform = (typeof platforms)[number];

/**
 * Creates a minimal stub PlatformProvider for testing registry operations.
 */
function createStubProvider(platform: Platform): PlatformProvider {
  return {
    platform,
    camera: {} as CameraInterface,
    fileSystem: {} as FileSystemInterface,
    notifications: {} as PushNotificationInterface,
    audio: {} as AudioInterface,
    navigation: {} as NavigationInterface,
    storage: {} as DeviceStorageInterface,
  };
}

/**
 * Represents a registry operation that does NOT result in a successful setActive.
 */
type RegistryOperation =
  | { type: 'register'; platform: Platform }
  | { type: 'setActiveUnregistered'; platform: Platform };

/**
 * Arbitrary that generates a sequence of register() calls with random platforms.
 * No setActive() calls are included, so getActive() must always throw.
 */
const registerOnlyOperations: fc.Arbitrary<RegistryOperation[]> = fc.array(
  fc.constantFrom(...platforms).map((platform) => ({
    type: 'register' as const,
    platform,
  })),
  { minLength: 0, maxLength: 20 }
);

/**
 * Arbitrary that generates a sequence of register() and setActive() calls,
 * where setActive() is always called with a platform that has NOT been registered.
 * This ensures setActive() never succeeds (returns false).
 */
const mixedOperationsWithFailedSetActive: fc.Arbitrary<RegistryOperation[]> = fc
  .record({
    registeredPlatforms: fc.subarray([...platforms], { minLength: 0, maxLength: 3 }),
    operations: fc.array(
      fc.record({
        type: fc.constantFrom('register', 'setActiveUnregistered') as fc.Arbitrary<
          'register' | 'setActiveUnregistered'
        >,
        platform: fc.constantFrom(...platforms),
      }),
      { minLength: 1, maxLength: 20 }
    ),
  })
  .map(({ registeredPlatforms, operations }) => {
    // Build a sequence where:
    // - register() calls only register platforms from registeredPlatforms
    // - setActive() calls only use platforms NOT in registeredPlatforms
    const unregisteredPlatforms = platforms.filter(
      (p) => !registeredPlatforms.includes(p)
    );

    // If all platforms are registered, we can't have a failed setActive,
    // so only emit register operations
    if (unregisteredPlatforms.length === 0) {
      return operations
        .filter((op) => op.type === 'register')
        .map((op) => ({
          type: 'register' as const,
          platform: registeredPlatforms[0] ?? ('web' as Platform),
        }));
    }

    return operations.map((op) => {
      if (op.type === 'register') {
        // Only register from the allowed set
        const idx = Math.abs(op.platform.charCodeAt(0)) % registeredPlatforms.length;
        return {
          type: 'register' as const,
          platform: registeredPlatforms.length > 0
            ? registeredPlatforms[idx]
            : ('web' as Platform), // won't be used since setActive won't target it
        };
      } else {
        // setActive with an unregistered platform (will fail)
        const idx = Math.abs(op.platform.charCodeAt(0)) % unregisteredPlatforms.length;
        return {
          type: 'setActiveUnregistered' as const,
          platform: unregisteredPlatforms[idx],
        };
      }
    });
  });

describe('Property 9: PlatformRegistry throws without active provider', () => {
  it('getActive() throws when no operations are performed on a fresh registry', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const registry = new PlatformRegistry();
        expect(() => registry.getActive()).toThrowError(
          'No active platform provider. Call setActive() first.'
        );
      })
    );
  });

  it('getActive() throws after any sequence of register() calls without setActive()', () => {
    fc.assert(
      fc.property(registerOnlyOperations, (operations) => {
        const registry = new PlatformRegistry();

        // Execute all register operations
        for (const op of operations) {
          registry.register(createStubProvider(op.platform));
        }

        // getActive() must throw since setActive() was never called
        expect(() => registry.getActive()).toThrowError(
          'No active platform provider. Call setActive() first.'
        );
      }),
      { numRuns: 200 }
    );
  });

  it('getActive() throws after register() and failed setActive() calls (unregistered platform)', () => {
    fc.assert(
      fc.property(mixedOperationsWithFailedSetActive, (operations) => {
        const registry = new PlatformRegistry();
        const registeredPlatforms = new Set<string>();

        // Execute operations
        for (const op of operations) {
          if (op.type === 'register') {
            registry.register(createStubProvider(op.platform));
            registeredPlatforms.add(op.platform);
          } else {
            // setActive with unregistered platform should return false
            const result = registry.setActive(op.platform);
            // Verify setActive did NOT succeed
            if (registeredPlatforms.has(op.platform)) {
              // If it was actually registered, skip this test case
              // (generator should prevent this, but guard against edge cases)
              return;
            }
            expect(result).toBe(false);
          }
        }

        // getActive() must throw since no setActive() succeeded
        expect(() => registry.getActive()).toThrowError(
          'No active platform provider. Call setActive() first.'
        );
      }),
      { numRuns: 200 }
    );
  });
});
