import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the project src/ directory path.
 * Works correctly on both Windows and Unix with Bun's import.meta.url.
 */
function getSrcDir(): string {
  // import.meta.url gives file:///C:/... on Windows
  // fileURLToPath correctly handles this
  const thisFile = fileURLToPath(import.meta.url);
  // This file is at src/utils/paths.ts, so src/ is one level up
  return dirname(dirname(thisFile));
}

/**
 * Resolve a path relative to the src/ directory.
 */
export function resolveFromSrc(...segments: string[]): string {
  return join(getSrcDir(), ...segments);
}

/**
 * Resolve a path relative to the project root (parent of src/).
 */
export function resolveFromRoot(...segments: string[]): string {
  return join(dirname(getSrcDir()), ...segments);
}
