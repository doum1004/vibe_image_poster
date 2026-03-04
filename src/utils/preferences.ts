/**
 * Cross-platform user preferences.
 *
 * Stores preferences in a JSON file at the OS-appropriate config directory:
 *   - Windows:  %APPDATA%/vibe-poster/preferences.json
 *   - macOS:    ~/Library/Application Support/vibe-poster/preferences.json
 *   - Linux:    ~/.config/vibe-poster/preferences.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ─── Preferences Schema ────────────────────────────────────────────────

export interface UserPreferences {
  /** Default series / brand name for the bottom bar */
  series?: string;
  /** Default LLM model alias or ID */
  model?: string;
  /** Default number of slides */
  slides?: number;
  /** Default output directory */
  output?: string;
}

/** Keys that are valid for get/set operations */
export const PREFERENCE_KEYS: ReadonlyArray<keyof UserPreferences> = [
  "series",
  "model",
  "slides",
  "output",
];

// ─── Config Directory Resolution ────────────────────────────────────────

function getConfigDir(): string {
  const appName = "vibe-poster";

  switch (process.platform) {
    case "win32": {
      const appData = process.env.APPDATA;
      if (appData) return join(appData, appName);
      // Fallback for Windows without APPDATA
      return join(process.env.USERPROFILE || "~", "AppData", "Roaming", appName);
    }
    case "darwin": {
      const home = process.env.HOME || "~";
      return join(home, "Library", "Application Support", appName);
    }
    default: {
      // Linux / other Unix — follow XDG Base Directory spec
      const xdgConfig = process.env.XDG_CONFIG_HOME;
      if (xdgConfig) return join(xdgConfig, appName);
      const home = process.env.HOME || "~";
      return join(home, ".config", appName);
    }
  }
}

function getPreferencesPath(): string {
  return join(getConfigDir(), "preferences.json");
}

// ─── Read / Write ───────────────────────────────────────────────────────

export function loadPreferences(): UserPreferences {
  const filePath = getPreferencesPath();

  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as UserPreferences;
  } catch {
    // Corrupted file — return empty
    return {};
  }
}

export function savePreferences(prefs: UserPreferences): void {
  const filePath = getPreferencesPath();
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, `${JSON.stringify(prefs, null, 2)}\n`, "utf-8");
}

// ─── Convenience Accessors ──────────────────────────────────────────────

/**
 * Get a single preference value.
 */
export function getPreference<K extends keyof UserPreferences>(
  key: K,
): UserPreferences[K] | undefined {
  return loadPreferences()[key];
}

/**
 * Set a single preference value and persist to disk.
 */
export function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const prefs = loadPreferences();
  prefs[key] = value;
  savePreferences(prefs);
}

/**
 * Remove a single preference and persist to disk.
 */
export function removePreference(key: keyof UserPreferences): void {
  const prefs = loadPreferences();
  delete prefs[key];
  savePreferences(prefs);
}

/**
 * Get the path to the preferences file (for display to user).
 */
export function getPreferencesFilePath(): string {
  return getPreferencesPath();
}
