#!/usr/bin/env bun
import { Command } from "commander";
import { reRender } from "./commands/re-render.js";
import { reuse } from "./commands/reuse.js";
import { createSeries, listSeries } from "./commands/series.js";
import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline/orchestrator.js";
import { log } from "./utils/logger.js";

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
  .option("-s, --series <name>", "Series theme to use", "default")
  .option("-n, --slides <count>", "Number of slides to generate", "10")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option(
    "-m, --model <alias>",
    "LLM model alias or ID (e.g., claude-sonnet-4, gpt-4o, gemini-2.5-pro)",
  )
  .action(async (topic: string | undefined, opts) => {
    try {
      const config = loadConfig();

      if (!topic && !opts.input) {
        log.error("Provide a topic or --input file. Run --help for usage.");
        process.exit(1);
      }

      const slideCount = parseInt(opts.slides, 10);
      if (Number.isNaN(slideCount) || slideCount < 3 || slideCount > 20) {
        log.error("Slide count must be between 3 and 20.");
        process.exit(1);
      }

      log.banner("vibe-poster: Card News Generator");
      log.info(`Topic: ${topic || `(from file: ${opts.input})`}`);
      log.info(`Series: ${opts.series}`);
      log.info(`Slides: ${slideCount}`);
      log.info(`Model: ${opts.model || config.llmModel}`);
      log.info(`Output: ${opts.output}`);
      log.divider();

      await runPipeline({
        topic: topic || "",
        inputFile: opts.input,
        series: opts.series,
        slideCount,
        outputDir: opts.output,
        model: opts.model,
      });
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
  .command("re-render")
  .description("Re-render slides from updated copy.json without running AI pipeline")
  .argument("<dir>", "Output directory containing copy.json and slides/")
  .action(async (dir: string) => {
    try {
      loadConfig();
      await reRender(dir);
    } catch (err) {
      log.error("Re-render failed", err instanceof Error ? err : undefined);
      process.exit(1);
    }
  });

program
  .command("reuse")
  .description("Reuse existing HTML templates with new copy content (creates new output dir)")
  .argument("<dir>", "Source directory containing slides/ templates")
  .argument("[copyFile]", "Path to a user-provided copy.json file")
  .option("-t, --topic <topic>", "New topic for AI research (used when no copyFile)")
  .option("-i, --input <file>", "Input markdown file for AI research")
  .option("-o, --output <dir>", "Base output directory for the new folder", "./output")
  .option(
    "-m, --model <alias>",
    "LLM model alias or ID (e.g., claude-sonnet-4, gpt-4o, gemini-2.5-pro)",
  )
  .action(async (dir: string, copyFile: string | undefined, opts) => {
    try {
      loadConfig();
      await reuse(dir, copyFile, {
        topic: opts.topic,
        input: opts.input,
        model: opts.model,
        output: opts.output,
      });
    } catch (err) {
      log.error("Reuse failed", err instanceof Error ? err : undefined);
      process.exit(1);
    }
  });

program.parse();
