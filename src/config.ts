import { z } from "zod";
import { TTS_PROVIDERS } from "./utils/preferences.js";

const ConfigSchema = z.object({
  chromePath: z.string().optional(),
  defaultTheme: z.string().optional(),
  defaultAuthor: z.string().optional(),
  defaultTtsProvider: z.enum(TTS_PROVIDERS).optional(),
  defaultTtsVoice: z.string().optional(),
  defaultTtsLanguage: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const raw = {
    chromePath: process.env.CHROME_PATH || undefined,
    defaultTheme: process.env.DEFAULT_THEME || undefined,
    defaultAuthor: process.env.DEFAULT_AUTHOR || undefined,
    defaultTtsProvider: process.env.DEFAULT_TTS_PROVIDER || undefined,
    defaultTtsVoice: process.env.DEFAULT_TTS_VOICE || undefined,
    defaultTtsLanguage: process.env.DEFAULT_TTS_LANGUAGE || undefined,
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration error:\n${errors}`);
  }

  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}

/**
 * Reset cached config. Useful for testing.
 */
export function resetConfig(): void {
  _config = null;
}
