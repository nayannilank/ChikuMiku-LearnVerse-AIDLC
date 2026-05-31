/**
 * Package Naming Convention Validator
 *
 * Validates that each package's `name` field in package.json matches the
 * expected naming pattern based on its directory location within the monorepo.
 *
 * Naming rules:
 * - packages/services/*          → @chikumiku/service-{name} where {name} matches [a-z][a-z0-9-]* (1-50 chars)
 * - packages/platform-contracts  → @chikumiku/platform-contracts (exact match)
 * - packages/platform-web/*      → @chikumiku/web-{name} where {name} matches [a-z][a-z0-9-]* (1-50 chars)
 * - packages/platform-mobile/*   → @chikumiku/mobile-{name} where {name} matches [a-z][a-z0-9-]* (1-50 chars)
 *
 * Usage: npx tsx scripts/validate-naming.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PackageInfo {
  name: string;
  directory: string;
  relativePath: string;
}

export interface NamingViolation {
  packageDir: string;
  actualName: string;
  expectedPattern: string;
  reason: string;
}

const NAME_PART_REGEX = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_PART_LENGTH = 50;

export function discoverPackages(workspaceRoot: string): PackageInfo[] {
  const packages: PackageInfo[] = [];

  const workspaceGlobs = [
    { base: 'packages/services', pattern: '*' },
    { base: 'packages/platform-contracts', pattern: null },
    { base: 'packages/platform-web', pattern: '*' },
    { base: 'packages/platform-mobile', pattern: '*' },
  ];

  for (const glob of workspaceGlobs) {
    const baseDir = path.join(workspaceRoot, glob.base);

    if (!fs.existsSync(baseDir)) {
      continue;
    }

    if (glob.pattern === null) {
      // Direct package (platform-contracts)
      const pkgJsonPath = path.join(baseDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        packages.push({
          name: pkgJson.name || '',
          directory: baseDir,
          relativePath: glob.base,
        });
      }
    } else {
      // Wildcard packages (services/*, platform-web/*, platform-mobile/*)
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pkgDir = path.join(baseDir, entry.name);
        const pkgJsonPath = path.join(pkgDir, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          packages.push({
            name: pkgJson.name || '',
            directory: pkgDir,
            relativePath: path.join(glob.base, entry.name),
          });
        }
      }
    }
  }

  return packages;
}

export function getExpectedPattern(relativePath: string): { pattern: string; description: string } | null {
  if (relativePath === 'packages/platform-contracts') {
    return {
      pattern: '@chikumiku/platform-contracts',
      description: 'Must be exactly "@chikumiku/platform-contracts"',
    };
  }

  if (relativePath.startsWith('packages/services/')) {
    return {
      pattern: '@chikumiku/service-{name}',
      description: '@chikumiku/service-{name} where {name} matches [a-z][a-z0-9-]* (1-50 chars)',
    };
  }

  if (relativePath.startsWith('packages/platform-web/')) {
    return {
      pattern: '@chikumiku/web-{name}',
      description: '@chikumiku/web-{name} where {name} matches [a-z][a-z0-9-]* (1-50 chars)',
    };
  }

  if (relativePath.startsWith('packages/platform-mobile/')) {
    return {
      pattern: '@chikumiku/mobile-{name}',
      description: '@chikumiku/mobile-{name} where {name} matches [a-z][a-z0-9-]* (1-50 chars)',
    };
  }

  return null;
}

export function validateNamePart(namePart: string): boolean {
  if (namePart.length < 1 || namePart.length > MAX_NAME_PART_LENGTH) {
    return false;
  }
  return NAME_PART_REGEX.test(namePart);
}

export function validatePackageName(pkg: PackageInfo): NamingViolation | null {
  const expected = getExpectedPattern(pkg.relativePath);

  if (!expected) {
    // Unknown directory location — skip without error
    return null;
  }

  // Platform-contracts: exact match
  if (expected.pattern === '@chikumiku/platform-contracts') {
    if (pkg.name !== '@chikumiku/platform-contracts') {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" must be named exactly "@chikumiku/platform-contracts", but found "${pkg.name}"`,
      };
    }
    return null;
  }

  // Service packages: @chikumiku/service-{name}
  if (expected.pattern === '@chikumiku/service-{name}') {
    const prefix = '@chikumiku/service-';
    if (!pkg.name.startsWith(prefix)) {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" must match pattern "${expected.description}", but found "${pkg.name}"`,
      };
    }
    const namePart = pkg.name.slice(prefix.length);
    if (!validateNamePart(namePart)) {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" has name "${pkg.name}" where the suffix "${namePart}" does not match [a-z][a-z0-9-]* (1-50 chars)`,
      };
    }
    return null;
  }

  // Web packages: @chikumiku/web-{name}
  if (expected.pattern === '@chikumiku/web-{name}') {
    const prefix = '@chikumiku/web-';
    if (!pkg.name.startsWith(prefix)) {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" must match pattern "${expected.description}", but found "${pkg.name}"`,
      };
    }
    const namePart = pkg.name.slice(prefix.length);
    if (!validateNamePart(namePart)) {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" has name "${pkg.name}" where the suffix "${namePart}" does not match [a-z][a-z0-9-]* (1-50 chars)`,
      };
    }
    return null;
  }

  // Mobile packages: @chikumiku/mobile-{name}
  if (expected.pattern === '@chikumiku/mobile-{name}') {
    const prefix = '@chikumiku/mobile-';
    if (!pkg.name.startsWith(prefix)) {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" must match pattern "${expected.description}", but found "${pkg.name}"`,
      };
    }
    const namePart = pkg.name.slice(prefix.length);
    if (!validateNamePart(namePart)) {
      return {
        packageDir: pkg.relativePath,
        actualName: pkg.name,
        expectedPattern: expected.description,
        reason: `Package at "${pkg.relativePath}" has name "${pkg.name}" where the suffix "${namePart}" does not match [a-z][a-z0-9-]* (1-50 chars)`,
      };
    }
    return null;
  }

  return null;
}

function main(): void {
  const workspaceRoot = process.cwd();

  console.log('Validating package naming conventions...\n');

  const packages = discoverPackages(workspaceRoot);

  if (packages.length === 0) {
    console.error('Error: No packages found in workspace. Are you running from the project root?');
    process.exit(1);
  }

  console.log(`Found ${packages.length} packages to validate.\n`);

  const violations: NamingViolation[] = [];

  for (const pkg of packages) {
    const violation = validatePackageName(pkg);
    if (violation) {
      violations.push(violation);
    }
  }

  if (violations.length === 0) {
    console.log('✓ All packages follow the naming convention.\n');
    console.log('Packages validated:');
    for (const pkg of packages) {
      console.log(`  ✓ ${pkg.name} (${pkg.relativePath})`);
    }
    process.exit(0);
  } else {
    console.error(`✗ Found ${violations.length} naming convention violation(s):\n`);
    for (const violation of violations) {
      console.error(`  ✗ ${violation.packageDir}`);
      console.error(`    Actual name: ${violation.actualName}`);
      console.error(`    Expected:    ${violation.expectedPattern}`);
      console.error(`    Reason:      ${violation.reason}`);
      console.error('');
    }
    process.exit(1);
  }
}

// Run main only when executed directly (not when imported as a module)
const isDirectExecution = process.argv[1]?.includes('validate-naming');
if (isDirectExecution) {
  main();
}
