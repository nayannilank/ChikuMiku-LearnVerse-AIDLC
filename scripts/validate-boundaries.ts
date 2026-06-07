#!/usr/bin/env npx tsx
/**
 * Dependency Boundary Validator
 *
 * Validates that packages in the monorepo respect the layered architecture rules:
 * - Service packages may only depend on other service packages or platform-contracts
 * - Platform-contracts may only depend on @learnverse/service-core
 * - Web packages may depend on platform-contracts and service packages, but NOT mobile packages
 * - Mobile packages may depend on platform-contracts and service packages, but NOT web packages
 *
 * Packages that don't match any known layer pattern are silently skipped.
 *
 * Exit code: 0 if no violations, 1 if violations found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from './glob-util';

// --- Types ---

type Layer = 'services' | 'contracts' | 'web' | 'mobile';

interface PackageInfo {
  name: string;
  dir: string;
  dependencies: string[];
}

interface DependencyViolation {
  package: string;
  dependency: string;
  reason: string;
}

interface ValidationResult {
  valid: boolean;
  violations: DependencyViolation[];
}

// --- Layer Classification ---

/**
 * Classifies a package name into its architectural layer.
 * Returns undefined if the package doesn't match any known layer pattern.
 */
export function classifyPackageLayer(name: string): Layer | undefined {
  if (name === '@learnverse/platform-contracts') return 'contracts';
  if (name.startsWith('@learnverse/service-')) return 'services';
  if (name.startsWith('@learnverse/web-')) return 'web';
  if (name.startsWith('@learnverse/mobile-')) return 'mobile';
  return undefined;
}

// --- Dependency Rules ---

function isForbidden(layer: Layer, depName: string): string | null {
  const depLayer = classifyPackageLayer(depName);

  // Only check internal @learnverse packages
  if (!depName.startsWith('@learnverse/')) return null;

  switch (layer) {
    case 'services':
      // Services may only depend on other services or platform-contracts
      if (depLayer === 'web') {
        return 'Service packages cannot depend on web packages';
      }
      if (depLayer === 'mobile') {
        return 'Service packages cannot depend on mobile packages';
      }
      break;

    case 'contracts':
      // Platform-contracts may only depend on @learnverse/service-core
      if (depName !== '@learnverse/service-core') {
        if (depLayer === 'web') {
          return 'Platform-contracts cannot depend on web packages';
        }
        if (depLayer === 'mobile') {
          return 'Platform-contracts cannot depend on mobile packages';
        }
        if (depLayer === 'services') {
          return 'Platform-contracts may only depend on @learnverse/service-core';
        }
        if (depLayer === 'contracts') {
          return 'Platform-contracts cannot depend on itself';
        }
        // Any other @learnverse package (unrecognized layer) is also forbidden
        return 'Platform-contracts may only depend on @learnverse/service-core';
      }
      break;

    case 'web':
      // Web packages may depend on platform-contracts and service packages, but NOT mobile
      if (depLayer === 'mobile') {
        return 'Web packages cannot depend on mobile packages';
      }
      break;

    case 'mobile':
      // Mobile packages may depend on platform-contracts and service packages, but NOT web
      if (depLayer === 'web') {
        return 'Mobile packages cannot depend on web packages';
      }
      break;
  }

  return null;
}

// --- Validation ---

/**
 * Validates dependency boundaries for a set of packages.
 * Returns a ValidationResult with any violations found.
 */
export function validateDependencyBoundaries(packages: PackageInfo[]): ValidationResult {
  const violations: DependencyViolation[] = [];

  for (const pkg of packages) {
    const layer = classifyPackageLayer(pkg.name);

    // Skip packages that don't match any known layer pattern
    if (layer === undefined) continue;

    for (const dep of pkg.dependencies) {
      const reason = isForbidden(layer, dep);
      if (reason !== null) {
        violations.push({
          package: pkg.name,
          dependency: dep,
          reason,
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// --- Package Discovery ---

/**
 * Discovers all packages in the workspace by reading workspace globs
 * from the root package.json.
 */
function discoverPackages(rootDir: string): PackageInfo[] {
  const rootPkgPath = path.join(rootDir, 'package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
  const workspaceGlobs: string[] = rootPkg.workspaces || [];

  const packages: PackageInfo[] = [];

  for (const pattern of workspaceGlobs) {
    const dirs = glob(pattern, rootDir);
    for (const dir of dirs) {
      const pkgJsonPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) continue;

      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const deps = Object.keys(pkgJson.dependencies || {});
      const devDeps = Object.keys(pkgJson.devDependencies || {});

      packages.push({
        name: pkgJson.name,
        dir,
        dependencies: [...deps, ...devDeps],
      });
    }
  }

  return packages;
}

// --- Main ---

function main(): void {
  const rootDir = process.cwd();
  const packages = discoverPackages(rootDir);

  const result = validateDependencyBoundaries(packages);

  if (!result.valid) {
    console.error('Dependency boundary violations found:\n');
    for (const v of result.violations) {
      console.error(`  ✗ ${v.package} → ${v.dependency}`);
      console.error(`    Reason: ${v.reason}\n`);
    }
    console.error(`Total violations: ${result.violations.length}`);
    process.exit(1);
  }

  console.log(`✓ All ${packages.length} packages respect dependency boundaries.`);
}

// Run main only when executed directly (not when imported as a module)
const isDirectExecution = process.argv[1]?.includes('validate-boundaries');
if (isDirectExecution) {
  main();
}
