#!/usr/bin/env bun
import { Command } from "commander";
import { generate } from "./commands/generate.js";
import { createSeries, listSeries } from "./commands/series.js";
import { addTemplate, listTemplates } from "./commands/template.js";
import { loadConfig } from "./config.js";
import { log } from "./utils/logger.js";
import {
  getPreference,
  getPreferencesFilePath,
  loadPreferences,
  PREFERENCE_KEYS,
  removePreference,
  setPreference,
} from "./utils/preferences.js";

const program = new Command();

program
  .name("vibe-poster")
  .description("Generate Instagram card news (1080x1440px) using AI-powered 5-agent pipeline")
  .version("0.1.0");

program
  .command("generate")
  .description("Generate card news from a topic or markdown file")
  .argument("[topic]", "Topic to generate card news about")
  .option("-i, --input <file>", "Input markdown file with research/notes")
  .option("-s, --series <name>", "Series theme to use")
  .option("-n, --slides <count>", "Number of slides to generate", "10")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option(
    "-m, --model <alias>",
    "LLM model alias or ID (e.g., claude-sonnet-4, gpt-4o, gemini-2.5-pro)",
  )
  .option("--template <dir>", "Source directory with slides/ templates to reuse")
  .option(
    "--rerender <file>",
    "Path to copy.json — skip AI, just apply copy to templates (requires --template)",
  )
  .action(async (topic: string | undefined, opts) => {
    try {
      const config = loadConfig();

      // Validate: --rerender requires --template
      if (opts.rerender && !opts.template) {
        log.error("--rerender requires --template. Provide a template directory.");
        process.exit(1);
      }

      // Resolution order: CLI flag > env var (DEFAULT_SERIES) > user preference > "default"
      opts.series = opts.series || config.defaultSeries || getPreference("series") || "default";

      // For full pipeline mode, use config model as fallback for logging
      if (!opts.template) {
        opts.model = opts.model || config.llmModel;
      }

      await generate(topic, opts);
    } catch (err) {
      log.error("Generation failed", err instanceof Error ? err : undefined);
      process.exit(1);
    }
  });

program
  .command("series")
  .description("Manage series themes")
  .addCommand(
    new Command("list").description("List available series themes").action(async () => {
      await listSeries();
    }),
  )
  .addCommand(
    new Command("create")
      .description("Create a new series theme")
      .argument("<name>", "Name of the new series")
      .action(async (name: string) => {
        await createSeries(name);
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

    // Coerce numeric values
    if (typedKey === "slides") {
      const num = parseInt(value, 10);
      if (Number.isNaN(num) || num < 3 || num > 20) {
        log.error("Slides must be a number between 3 and 20.");
        process.exit(1);
      }
      setPreference(typedKey, num);
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

    const value = getPreference(key as keyof import("./utils/preferences.js").UserPreferences);
    if (value === undefined) {
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
