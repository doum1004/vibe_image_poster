#!/usr/bin/env bun
import { Command } from "commander";
import { generate } from "./commands/generate.js";
import { createTheme, listThemes } from "./commands/theme.js";
import { addTemplate, listTemplates } from "./commands/template.js";
import { buildVideo } from "./commands/video.js";
import { loadConfig } from "./config.js";
import { log } from "./utils/logger.js";
import {
  getPreference,
  getPreferencesFilePath,
  loadPreferences,
  PREFERENCE_KEYS,
  removePreference,
  setPreference,
  TTS_PROVIDERS,
} from "./utils/preferences.js";

const program = new Command();

program
  .name("slideagile")
  .description(
    "Generate Instagram card news (1080x1440px). " +
      "Use as an MCP server (recommended) or CLI for template re-rendering.",
  )
  .version("0.1.0");

program
  .command("generate")
  .description("Apply copy.json to HTML slide templates and export PNGs")
  .requiredOption("--template <dir>", "Source directory with slides/ templates to reuse")
  .requiredOption(
    "--rerender <file>",
    "Path to copy.json to apply to templates",
  )
  .option("-t, --theme <name>", "Theme to use")
  .option("-a, --author <name>", "Bottom-bar author/brand text")
  .option("-o, --output <dir>", "Output directory")
  .action(async (opts) => {
    try {
      const config = loadConfig();
      opts.theme = opts.theme || config.defaultTheme || getPreference("theme") || "default";
      opts.author = opts.author || config.defaultAuthor || getPreference("author") || "@SlideForge";

      await generate(opts);
    } catch (err) {
      log.error("Generation failed", err instanceof Error ? err : undefined);
      process.exit(1);
    }
  });

program
  .command("theme")
  .description("Manage themes")
  .addCommand(
    new Command("list").description("List available themes").action(async () => {
      await listThemes();
    }),
  )
  .addCommand(
    new Command("create")
      .description("Create a new theme")
      .argument("<name>", "Name of the new theme")
      .action(async (name: string) => {
        await createTheme(name);
      }),
  );

program
  .command("template")
  .description("Manage saved slide templates")
  .addCommand(
    new Command("list").description("List saved templates").action(async () => {
      await listTemplates();
    }),
  )
  .addCommand(
    new Command("add")
      .description("Save an output folder as a reusable template")
      .argument("<folder>", "Output directory containing slides/ to save")
      .argument("[name]", "Template name (defaults to folder basename)")
      .action(async (folder: string, name?: string) => {
        await addTemplate(folder, name);
      }),
  );

program
  .command("video")
  .description("Build MP4 video from slide PNG files")
  .addCommand(
    new Command("build")
      .description("Create a deck.mp4 from slide-XX.png files")
      .requiredOption(
        "--input <dir>",
        "Output directory containing slides/ or the slides/ directory itself",
      )
      .option("--out <file>", "Output video path (default: <input>/deck.mp4)")
      .option("--seconds-per-slide <n>", "Seconds each slide stays on screen", parseFloat, 4)
      .option("--fps <n>", "Output frame rate", (value) => parseInt(value, 10), 30)
      .option("--ffmpeg <path>", "Path to ffmpeg executable")
      .option("--tts", "Enable narration from copy.json")
      .option(
        "--tts-provider <name>",
        `TTS provider (${TTS_PROVIDERS.join(", ")})`,
      )
      .option("--tts-voice <id>", "TTS voice ID (provider-specific)")
      .option("--tts-language <code>", "TTS language code (default: ko-KR)")
      .option("--script-file <file>", "Path to narration script JSON (per-slide presenter script)")
      .action(async (opts) => {
        try {
          if (
            opts.ttsProvider &&
            !TTS_PROVIDERS.includes(opts.ttsProvider as (typeof TTS_PROVIDERS)[number])
          ) {
            log.error(`ttsProvider must be one of: ${TTS_PROVIDERS.join(", ")}`);
            process.exit(1);
          }

          await buildVideo({
            input: opts.input,
            out: opts.out,
            secondsPerSlide: opts.secondsPerSlide,
            fps: opts.fps,
            ffmpegPath: opts.ffmpeg,
            tts: opts.tts,
            ttsProvider: opts.ttsProvider,
            ttsVoice: opts.ttsVoice,
            ttsLanguage: opts.ttsLanguage,
            scriptFile: opts.scriptFile,
          });
        } catch (err) {
          log.error("Video build failed", err instanceof Error ? err : undefined);
          process.exit(1);
        }
      }),
  );

// ─── Config / Preferences ───────────────────────────────────────────────

const configCmd = program
  .command("config")
  .description("Manage user preferences (persisted cross-platform)");

configCmd
  .command("set")
  .description("Set a user preference")
  .argument("<key>", `Preference key (${PREFERENCE_KEYS.join(", ")})`)
  .argument("<value>", "Value to set")
  .action((key: string, value: string) => {
    if (!PREFERENCE_KEYS.includes(key as keyof import("./utils/preferences.js").UserPreferences)) {
      log.error(`Unknown preference key: "${key}". Valid keys: ${PREFERENCE_KEYS.join(", ")}`);
      process.exit(1);
    }

    const typedKey = key as keyof import("./utils/preferences.js").UserPreferences;

    if (typedKey === "slides") {
      const num = parseInt(value, 10);
      if (Number.isNaN(num) || num < 3 || num > 20) {
        log.error("Slides must be a number between 3 and 20.");
        process.exit(1);
      }
      setPreference(typedKey, num);
    } else if (typedKey === "ttsProvider") {
      if (!TTS_PROVIDERS.includes(value as (typeof TTS_PROVIDERS)[number])) {
        log.error(`ttsProvider must be one of: ${TTS_PROVIDERS.join(", ")}`);
        process.exit(1);
      }
      setPreference(typedKey, value as (typeof TTS_PROVIDERS)[number]);
    } else if (typedKey === "ttsVoice") {
      if (value.trim().length === 0) {
        log.error("ttsVoice cannot be empty.");
        process.exit(1);
      }
      setPreference(typedKey, value);
    } else if (typedKey === "ttsLanguage") {
      if (!/^[a-z]{2}-[A-Z]{2}$/.test(value.trim())) {
        log.error('ttsLanguage must look like "ko-KR" or "en-US".');
        process.exit(1);
      }
      setPreference(typedKey, value.trim());
    } else {
      setPreference(typedKey, value);
    }

    log.success(`Set ${key} = ${value}`);
    log.info(`Saved to: ${getPreferencesFilePath()}`);
  });

configCmd
  .command("get")
  .description("Get a user preference value")
  .argument("<key>", `Preference key (${PREFERENCE_KEYS.join(", ")})`)
  .action((key: string) => {
    if (!PREFERENCE_KEYS.includes(key as keyof import("./utils/preferences.js").UserPreferences)) {
      log.error(`Unknown preference key: "${key}". Valid keys: ${PREFERENCE_KEYS.join(", ")}`);
      process.exit(1);
    }

    const typedKey = key as keyof import("./utils/preferences.js").UserPreferences;
    const value = getPreference(typedKey);
    const config = loadConfig();

    if (value === undefined) {
      if (typedKey === "ttsProvider") {
        log.info(`${key}: ${config.defaultTtsProvider ?? "gcp-hd"} (default)`);
        return;
      }
      if (typedKey === "ttsVoice" && config.defaultTtsVoice) {
        log.info(`${key}: ${config.defaultTtsVoice} (default)`);
        return;
      }
      if (typedKey === "ttsLanguage") {
        log.info(`${key}: ${config.defaultTtsLanguage ?? "ko-KR"} (default)`);
        return;
      }
      log.info(`${key}: (not set)`);
    } else {
      log.info(`${key}: ${value}`);
    }
  });

configCmd
  .command("list")
  .description("List all user preferences")
  .action(() => {
    const prefs = loadPreferences();
    const entries = Object.entries(prefs).filter(([, v]) => v !== undefined);

    if (entries.length === 0) {
      log.info("No preferences set.");
      log.info(`File: ${getPreferencesFilePath()}`);
      return;
    }

    log.banner("User Preferences");
    for (const [key, value] of entries) {
      log.info(`  ${key}: ${value}`);
    }
    log.divider();
    log.info(`File: ${getPreferencesFilePath()}`);
  });

configCmd
  .command("unset")
  .description("Remove a user preference")
  .argument("<key>", `Preference key (${PREFERENCE_KEYS.join(", ")})`)
  .action((key: string) => {
    if (!PREFERENCE_KEYS.includes(key as keyof import("./utils/preferences.js").UserPreferences)) {
      log.error(`Unknown preference key: "${key}". Valid keys: ${PREFERENCE_KEYS.join(", ")}`);
      process.exit(1);
    }

    removePreference(key as keyof import("./utils/preferences.js").UserPreferences);
    log.success(`Removed preference: ${key}`);
  });

program.parse();
