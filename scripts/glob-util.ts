/**
 * Simple glob utility for resolving workspace patterns.
 * Handles patterns like:
 *   - "packages/services/*" (single-level wildcard)
 *   - "packages/platform-contracts" (exact path)
 *   - "packages/platform-web/*" (single-level wildcard)
 *
 * No external dependencies required.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Resolves a workspace glob pattern to absolute directory paths.
 * Supports single-level wildcards (*) at the end of a pattern.
 */
export function glob(pattern: string, rootDir: string): string[] {
  const fullPattern = path.resolve(rootDir, pattern);

  // If pattern contains a wildcard, expand it
  if (fullPattern.includes('*')) {
    const parts = fullPattern.split('*');
    const baseDir = parts[0].replace(/\/$/, '');
    const suffix = parts[1] || '';

    if (!fs.existsSync(baseDir)) return [];

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const dirs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidate = path.join(baseDir, entry.name + suffix);
        if (fs.existsSync(candidate)) {
          dirs.push(candidate);
        } else {
          // If no suffix or the directory itself matches
          dirs.push(path.join(baseDir, entry.name));
        }
      }
    }

    return dirs;
  }

  // Exact path (no wildcard)
  if (fs.existsSync(fullPattern)) {
    return [fullPattern];
  }

  return [];
}
