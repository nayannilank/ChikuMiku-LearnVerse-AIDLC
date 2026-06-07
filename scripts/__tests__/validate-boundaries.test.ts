import { describe, it, expect } from 'vitest';
import { classifyPackageLayer, validateDependencyBoundaries } from '../validate-boundaries';
import { glob } from '../glob-util';
import * as path from 'node:path';

// --- classifyPackageLayer tests ---

describe('classifyPackageLayer', () => {
  it('classifies service packages correctly', () => {
    expect(classifyPackageLayer('@learnverse/service-core')).toBe('services');
    expect(classifyPackageLayer('@learnverse/service-auth')).toBe('services');
    expect(classifyPackageLayer('@learnverse/service-content-ingestion')).toBe('services');
  });

  it('classifies platform-contracts correctly', () => {
    expect(classifyPackageLayer('@learnverse/platform-contracts')).toBe('contracts');
  });

  it('classifies web packages correctly', () => {
    expect(classifyPackageLayer('@learnverse/web-app')).toBe('web');
    expect(classifyPackageLayer('@learnverse/web-camera')).toBe('web');
    expect(classifyPackageLayer('@learnverse/web-ui')).toBe('web');
  });

  it('classifies mobile packages correctly', () => {
    expect(classifyPackageLayer('@learnverse/mobile-app')).toBe('mobile');
    expect(classifyPackageLayer('@learnverse/mobile-camera')).toBe('mobile');
    expect(classifyPackageLayer('@learnverse/mobile-ui')).toBe('mobile');
  });

  it('returns undefined for packages that do not match any known layer pattern', () => {
    expect(classifyPackageLayer('lodash')).toBeUndefined();
    expect(classifyPackageLayer('@types/node')).toBeUndefined();
    expect(classifyPackageLayer('@learnverse/unknown-thing')).toBeUndefined();
    expect(classifyPackageLayer('vitest')).toBeUndefined();
  });
});

// --- validateDependencyBoundaries tests ---

describe('validateDependencyBoundaries', () => {
  describe('service packages', () => {
    it('allows service packages to depend on other service packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-auth', dir: '/fake', dependencies: ['@learnverse/service-core'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('allows service packages to depend on platform-contracts', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-api', dir: '/fake', dependencies: ['@learnverse/platform-contracts'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('rejects service packages that depend on web packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-core', dir: '/fake', dependencies: ['@learnverse/web-camera'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].package).toBe('@learnverse/service-core');
      expect(result.violations[0].dependency).toBe('@learnverse/web-camera');
      expect(result.violations[0].reason).toContain('Service packages cannot depend on web packages');
    });

    it('rejects service packages that depend on mobile packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-core', dir: '/fake', dependencies: ['@learnverse/mobile-app'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].package).toBe('@learnverse/service-core');
      expect(result.violations[0].dependency).toBe('@learnverse/mobile-app');
      expect(result.violations[0].reason).toContain('Service packages cannot depend on mobile packages');
    });
  });

  describe('platform-contracts', () => {
    it('allows platform-contracts to depend on @learnverse/service-core', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/platform-contracts', dir: '/fake', dependencies: ['@learnverse/service-core'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('rejects platform-contracts depending on other service packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/platform-contracts', dir: '/fake', dependencies: ['@learnverse/service-auth'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].package).toBe('@learnverse/platform-contracts');
      expect(result.violations[0].dependency).toBe('@learnverse/service-auth');
      expect(result.violations[0].reason).toContain('Platform-contracts may only depend on @learnverse/service-core');
    });

    it('rejects platform-contracts depending on web packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/platform-contracts', dir: '/fake', dependencies: ['@learnverse/web-app'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].reason).toContain('Platform-contracts cannot depend on web packages');
    });

    it('rejects platform-contracts depending on mobile packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/platform-contracts', dir: '/fake', dependencies: ['@learnverse/mobile-camera'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].reason).toContain('Platform-contracts cannot depend on mobile packages');
    });

    it('allows platform-contracts to depend on external (non-@learnverse) packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/platform-contracts', dir: '/fake', dependencies: ['typescript', 'vitest'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('web packages', () => {
    it('allows web packages to depend on platform-contracts', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/web-app', dir: '/fake', dependencies: ['@learnverse/platform-contracts'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('allows web packages to depend on service packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/web-app', dir: '/fake', dependencies: ['@learnverse/service-core', '@learnverse/service-auth'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('rejects web packages that depend on mobile packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/web-app', dir: '/fake', dependencies: ['@learnverse/mobile-camera'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].package).toBe('@learnverse/web-app');
      expect(result.violations[0].dependency).toBe('@learnverse/mobile-camera');
      expect(result.violations[0].reason).toContain('Web packages cannot depend on mobile packages');
    });
  });

  describe('mobile packages', () => {
    it('allows mobile packages to depend on platform-contracts', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/mobile-app', dir: '/fake', dependencies: ['@learnverse/platform-contracts'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('allows mobile packages to depend on service packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/mobile-app', dir: '/fake', dependencies: ['@learnverse/service-core', '@learnverse/service-api'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('rejects mobile packages that depend on web packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/mobile-app', dir: '/fake', dependencies: ['@learnverse/web-ui'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].package).toBe('@learnverse/mobile-app');
      expect(result.violations[0].dependency).toBe('@learnverse/web-ui');
      expect(result.violations[0].reason).toContain('Mobile packages cannot depend on web packages');
    });
  });

  describe('unknown layer packages', () => {
    it('skips packages whose names do not match any known layer pattern', () => {
      const result = validateDependencyBoundaries([
        { name: 'lodash', dir: '/fake', dependencies: ['@learnverse/web-app', '@learnverse/mobile-app'] },
        { name: '@types/node', dir: '/fake', dependencies: ['@learnverse/service-core'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('violation reports', () => {
    it('reports offending package name, forbidden dependency, and human-readable reason', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-auth', dir: '/fake', dependencies: ['@learnverse/web-camera'] },
      ]);
      expect(result.violations).toHaveLength(1);
      const v = result.violations[0];
      expect(v.package).toBe('@learnverse/service-auth');
      expect(v.dependency).toBe('@learnverse/web-camera');
      expect(v.reason).toBeTruthy();
      expect(v.reason.length).toBeGreaterThan(0);
    });

    it('reports multiple violations when multiple forbidden dependencies exist', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-core', dir: '/fake', dependencies: ['@learnverse/web-app', '@learnverse/mobile-camera'] },
      ]);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].dependency).toBe('@learnverse/web-app');
      expect(result.violations[1].dependency).toBe('@learnverse/mobile-camera');
    });
  });

  describe('external dependencies', () => {
    it('allows all layers to depend on external (non-@learnverse) packages', () => {
      const result = validateDependencyBoundaries([
        { name: '@learnverse/service-core', dir: '/fake', dependencies: ['typescript', 'vitest', 'lodash'] },
        { name: '@learnverse/web-app', dir: '/fake', dependencies: ['react', 'react-dom'] },
        { name: '@learnverse/mobile-app', dir: '/fake', dependencies: ['react-native', 'expo'] },
      ]);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});

// --- glob utility tests ---

describe('glob utility', () => {
  const rootDir = path.resolve(__dirname, '../..');

  it('resolves exact path patterns (no wildcard)', () => {
    const result = glob('packages/platform-contracts', rootDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('packages/platform-contracts');
  });

  it('resolves wildcard patterns to subdirectories', () => {
    const result = glob('packages/services/*', rootDir);
    expect(result.length).toBeGreaterThan(0);
    // Should include service packages
    const names = result.map((d) => path.basename(d));
    expect(names).toContain('core');
    expect(names).toContain('auth');
    expect(names).toContain('api');
  });

  it('resolves platform-web wildcard pattern', () => {
    const result = glob('packages/platform-web/*', rootDir);
    expect(result.length).toBeGreaterThan(0);
    const names = result.map((d) => path.basename(d));
    expect(names).toContain('app');
    expect(names).toContain('camera');
  });

  it('resolves platform-mobile wildcard pattern', () => {
    const result = glob('packages/platform-mobile/*', rootDir);
    expect(result.length).toBeGreaterThan(0);
    const names = result.map((d) => path.basename(d));
    expect(names).toContain('app');
    expect(names).toContain('camera');
  });

  it('returns empty array for non-existent paths', () => {
    const result = glob('packages/nonexistent/*', rootDir);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for non-existent exact path', () => {
    const result = glob('packages/does-not-exist', rootDir);
    expect(result).toHaveLength(0);
  });
});
