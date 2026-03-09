#!/usr/bin/env bun
import { Command } from "commander";
import { generate } from "./commands/generate.js";
import { createTheme, listThemes } from "./commands/theme.js";
import { addTemplate, listTemplates } from "./commands/template.js";
import { buildVideo, VIDEO_FORMATS } from "./commands/video.js";
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
  TtsProvider,
  UserPreferences,
} from "./utils/preferences.js";

const program = new Command();

program
  .name("slideagile")
  .description(`
Generate short-form card news (default 1080x1920 vertical slides).

QUICK START:
  slideagile generate --template <dir> --rerender copy.json
  slideagile video build --input ./output
  slideagile config set theme default

DOCUMENTATION:
  - Templates: Reusable slide layouts stored in ~/.slideagile/templates/
  - Themes: Visual styling (colors, fonts, backgrounds)
  - Preferences: Cross-platform settings stored in OS config directory

SEE ALSO:
  slideagile --help          Show all commands
  slideagile <cmd> --help   Show detailed help for a command
  `)
  .version("0.1.0")
  .helpOption("--help", "Show this help message")
  .addHelpCommand("help [cmd]", "Display help for a command");

program
  .command("generate")
  .description("Apply copy.json content to HTML slide templates and export PNG images")
  .summary("Render slides from templates + JSON content")
  .requiredOption(
    "--template <dir>",
    "Source directory containing slides/ subdirectory with HTML templates to reuse",
  )
  .requiredOption(
    "--rerender <file>",
    "Path to copy.json file containing slide content (title, body, images, etc.)",
  )
  .option(
    "-t, --theme <name>",
    "Theme name to apply (overrides config default). Valid: any theme in themes/ directory",
    "default",
  )
  .option(
    "-a, --author <name>",
    "Author/brand text shown in bottom bar (overrides config default)",
    "@SlideAgile",
  )
  .option(
    "-o, --output <dir>",
    "Output directory for PNG slides (default: ./output)",
    "./output",
  )
  .addHelpText(
    "after",
    `
EXAMPLES:
  # Generate slides with default theme
  slideagile generate --template ./my-template --rerender ./copy.json

  # Generate with custom theme and author
  slideagile generate --template ./my-template --rerender ./copy.json --theme minimal --author "@MyBrand"

  # Generate to specific output directory
  slideagile generate -t news -o ./my-slides --template ./template --rerender ./content.json

NOTES:
  - copy.json should contain an array of slide objects with 'title', 'body', etc.
  - Templates use Handlebars syntax: {{title}}, {{body}}, {{image}}
  - Output PNG files are named slide-01.png, slide-02.png, etc.
`,
  )
  .action(async (opts) => {
    try {
      const config = loadConfig();
      opts.theme = opts.theme || config.defaultTheme || getPreference("theme") || "default";
      opts.author = opts.author || config.defaultAuthor || getPreference("author") || "@SlideAgile";

      await generate(opts);
    } catch (err) {
      log.error("Generation failed", err instanceof Error ? err : undefined);
      process.exit(1);
    }
  });

const THEME_EXAMPLES = `
EXAMPLES:
  # List all available themes
  slideagile theme list

  # Create a new theme from the default template
  slideagile theme create my-custom-theme

SEE ALSO:
  slideagile template add   Save slide layouts as reusable templates
  slideagile generate       Generate slides using a theme
`;

const TEMPLATE_EXAMPLES = `
EXAMPLES:
  # List all saved templates
  slideagile template list

  # Save an output folder as a template
  slideagile template add ./my-output-folder

  # Save with custom name
  slideagile template add ./my-output-folder my-template-name

SEE ALSO:
  slideagile theme create    Create visual themes (colors, fonts)
  slideagile generate       Generate slides using a template
`;

const VIDEO_BUILD_EXAMPLES = `
EXAMPLES:
  # Simple video from slides (no audio)
  slideagile video build --input ./output

  # Custom output path and timing
  slideagile video build --input ./output --out ./video.mp4 --seconds-per-slide 3

  # High quality output with custom format
  slideagile video build --input ./slides --format 1080p --fps 60

  # Video with TTS narration (auto-generated from copy.json)
  slideagile video build --input ./output --tts

  # Video with TTS using specific provider and voice
  slideagile video build --input ./output --tts --tts-provider gcp-hd --tts-voice en-US-Neural2-J

  # TTS with custom narration script
  slideagile video build --input ./output --tts --script-file ./narration-script.json

NOTES:
  - Requires ffmpeg installed in PATH (or use --ffmpeg to specify path)
  - Output format options: ` +
  VIDEO_FORMATS.join(", ") +
  `
  - TTS providers: ` +
  TTS_PROVIDERS.join(", ") + `

SCRIPT RESOLUTION ORDER:
  1. --script-file <path>        (explicitly provided)
  2. <output-dir>/narration-script.json
  3. Auto-generated from copy.json content (fallback)

NARRATION SCRIPT FORMAT:
  {
    "slides": [
      { "slideNumber": 1, "script": "Welcome! Today we're exploring..." },
      { "slideNumber": 2, "script": "Let's start with the first key point..." },
      { "slideNumber": 3, "script": "Now, here's what this means for you..." }
    ]
  }

SCRIPT BEST PRACTICES (for natural-sounding TTS):
  - Write conversationally - speak TO the viewer, don't just read the slide
  - Use short, declarative sentences (TTS handles pauses better)
  - Add verbal transitions: "Now let's move on to...", "Building on that idea..."
  - Include markers: "First...", "Second...", "Finally..." to guide the listener
  - Keep pacing: ~25-30 words per 4-second slide is comfortable
  - AVOID: Emojis, complex punctuation, jargon, abbreviations (use "for example" not "e.g.")

EXAMPLE NARRAION SCRIPT (3-slide presentation):
  Slide 1 (Cover): "Welcome! In this quick presentation, we'll explore three
    powerful strategies for boosting your daily productivity."
  Slide 2 (Body):   "First, time blocking. Instead of reacting to whatever
    comes up, you proactively reserve chunks of time for deep work.
    Second, the two-minute rule. If something takes less than two minutes,
    do it immediately. Third, energy management. Work when you're most
    alert, rest when you're not."
  Slide 3 (CTA):    "So try implementing one of these techniques today.
    Start small, track your progress, and watch your productivity soar.
    Thanks for watching!"

SEE ALSO:
  slideagile generate       Generate PNG slides first
`;

program
  .command("theme")
  .description("Manage visual themes (colors, fonts, backgrounds)")
  .summary("Create and list slide themes")
  .addHelpText("after", THEME_EXAMPLES)
  .addCommand(
    new Command("list")
      .description("List all available themes in the themes/ directory")
      .summary("List available themes")
      .action(async () => {
        await listThemes();
      }),
  )
  .addCommand(
    new Command("create")
      .description("Create a new theme from the default template")
      .summary("Create a new theme")
      .argument("<name>", "Name of the new theme (alphanumeric, dashes allowed)")
      .action(async (name: string) => {
        await createTheme(name);
      }),
  );

program
  .command("template")
  .description("Manage saved slide templates (reusable slide layouts)")
  .summary("Save and list slide templates")
  .addHelpText("after", TEMPLATE_EXAMPLES)
  .addCommand(
    new Command("list").description("List all saved templates").action(async () => {
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
  .summary("Create video from PNG slides with optional TTS narration")
  .addCommand(
    new Command("build")
      .description("Create a deck.mp4 from slide-XX.png files")
      .summary("Build MP4 video from slides")
      .addHelpText("after", VIDEO_BUILD_EXAMPLES)
      .requiredOption(
        "--input <dir>",
        "Output directory containing slides/ subdirectory, or the slides/ directory itself",
      )
      .option(
        "--out <file>",
        "Output video path (default: <input>/deck.mp4)",
      )
      .option(
        "--seconds-per-slide <n>",
        "Seconds each slide stays on screen (default: 4)",
        parseFloat,
        4,
      )
      .option(
        "--fps <n>",
        "Output frame rate (default: 30)",
        (value) => parseInt(value, 10),
        30,
      )
      .option(
        "--format <name>",
        `Video format (${VIDEO_FORMATS.join(", ")}, default: match-source)`,
      )
      .option(
        "--ffmpeg <path>",
        "Path to ffmpeg executable (auto-detected from PATH if not specified)",
      )
      .option(
        "--tts",
        "Enable text-to-speech narration. Uses custom script (--script-file), " +
          "narration-script.json in output dir, or auto-generates from copy.json",
      )
      .option(
        "--tts-provider <name>",
        "TTS provider (" + TTS_PROVIDERS.join(", ") + ", default: gcp-hd)",
      )
      .option(
        "--tts-voice <id>",
        "TTS voice ID (provider-specific, see provider docs for available voices)",
      )
      .option(
        "--tts-language <code>",
        "TTS language code (ISO 639-1 + region, e.g. ko-KR, en-US). Default: ko-KR",
      )
      .option(
        "--script-file <file>",
        "Path to narration-script.json with per-slide scripts for natural-sounding TTS. " +
          "See help for format and best practices.",
      )
      .action(async (opts) => {
        try {
          if (
            opts.ttsProvider &&
            !TTS_PROVIDERS.includes(opts.ttsProvider as (typeof TTS_PROVIDERS)[number])
          ) {
            log.error(`ttsProvider must be one of: ${TTS_PROVIDERS.join(", ")}`);
            process.exit(1);
          }
          if (
            opts.format &&
            !VIDEO_FORMATS.includes(opts.format as (typeof VIDEO_FORMATS)[number])
          ) {
            log.error(`format must be one of: ${VIDEO_FORMATS.join(", ")}`);
            process.exit(1);
          }

          await buildVideo({
            input: opts.input,
            out: opts.out,
            secondsPerSlide: opts.secondsPerSlide,
            fps: opts.fps,
            format: opts.format,
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

const CONFIG_EXAMPLES = `
PREFERENCE KEYS:
  theme          - Default theme name (e.g., "default", "minimal", "news")
  author         - Default author/brand text shown in bottom bar (e.g., "@MyBrand")
  slides         - Default number of slides (number: 3-20)
  output         - Default output directory path
  ttsProvider    - Default TTS provider (` +
  TTS_PROVIDERS.join(", ") + `)
  ttsVoice       - Default TTS voice ID (provider-specific)
  ttsLanguage    - Default TTS language code (e.g., ko-KR, en-US)

EXAMPLES:
  # Set default theme
  slideagile config set theme minimal

  # Set default author
  slideagile config set author "@MyBrand"

  # Set default TTS provider
  slideagile config set ttsProvider openai

  # Set default voice for a provider
  slideagile config set ttsVoice alloy

  # Set default language
  slideagile config set ttsLanguage en-US

  # View current preference
  slideagile config get theme

  # List all preferences
  slideagile config list

  # Remove a preference (revert to default)
  slideagile config unset theme

FILES:
  Preferences are stored in OS-specific config directory:
  - Windows: %APPDATA%/slideagile/preferences.json
  - macOS:   ~/Library/Application Support/slideagile/preferences.json
  - Linux:   ~/.config/slideagile/preferences.json

ENVIRONMENT VARIABLES:
  Default values can also be set via environment variables:
  - DEFAULT_THEME, DEFAULT_AUTHOR
  - DEFAULT_TTS_PROVIDER, DEFAULT_TTS_VOICE, DEFAULT_TTS_LANGUAGE

SEE ALSO:
  slideagile generate       Generate slides using preferences
  slideagile video build   Build video with TTS using preferences
`;

const configCmd = program
  .command("config")
  .description("Manage user preferences (persisted cross-platform)")
  .summary("View and modify user preferences")
  .addHelpText("after", CONFIG_EXAMPLES);

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

program.on("option:help-json", () => {
  const json: Record<string, unknown> = {
    name: program.name(),
    version: program.version(),
    description: program.description(),
    commands: [],
  };

  for (const cmd of program.commands) {
    if (cmd.name() === "config") continue;

    const cmdInfo: Record<string, unknown> = {
      name: cmd.name(),
      description: cmd.description(),
      summary: cmd.summary(),
      options: [],
    };

    for (const opt of cmd.options) {
      cmdInfo.options.push({
        flags: opt.flags,
        description: opt.description,
        defaultValue: opt.defaultValue,
        required: opt.required,
      });
    }

    for (const subCmd of cmd.commands || []) {
      const subCmdInfo: Record<string, unknown> = {
        name: subCmd.name(),
        description: subCmd.description(),
        arguments: [],
        options: [],
      };

      try {
        if (subCmd.arguments && Array.isArray(subCmd.arguments)) {
          for (const arg of subCmd.arguments) {
            subCmdInfo.arguments.push({
              name: arg.name(),
              description: arg.description(),
              required: arg.required(),
            });
          }
        }
      } catch {
        // arguments is not iterable
      }

      for (const opt of subCmd.options) {
        subCmdInfo.options.push({
          flags: opt.flags,
          description: opt.description,
          defaultValue: opt.defaultValue,
        });
      }

      (cmdInfo as Record<string, unknown>).commands = (cmdInfo.commands || []).concat(subCmdInfo);
    }

    (json.commands as Record<string, unknown>[]).push(cmdInfo);
  }

  const configCmdInfo: Record<string, unknown> = {
    name: "config",
    description: "Manage user preferences",
    preferenceKeys: PREFERENCE_KEYS,
    commands: [
      { name: "set", description: "Set a preference", arguments: ["<key>", "<value>"] },
      { name: "get", description: "Get a preference", arguments: ["<key>"] },
      { name: "list", description: "List all preferences" },
      { name: "unset", description: "Remove a preference", arguments: ["<key>"] },
    ],
  };
  (json.commands as Record<string, unknown>[]).push(configCmdInfo);

  console.log(JSON.stringify(json, null, 2));
  process.exit(0);
});

program
  .option("--help-json", "Output CLI structure as JSON for programmatic use")
  .allowUnknownOption();

program.parse();
