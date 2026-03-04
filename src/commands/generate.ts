import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CopyAgent } from "../agents/contents-marketer.js";
import { ResearcherAgent } from "../agents/researcher.js";
import { PipelineContext } from "../pipeline/context.js";
import { CopyOutput, PlanOutput, type ResearchOutput } from "../pipeline/types.js";
import { runPipeline } from "../pipeline/orchestrator.js";
import { renderAllSlides } from "../renderer/png-exporter.js";
import { reRenderAllSlides } from "../renderer/template-renderer.js";
import {
  ensureDir,
  fileExists,
  getOutputDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeOutputFile,
} from "../utils/file.js";
import { log } from "../utils/logger.js";

export interface GenerateOptions {
  input?: string;
  series?: string;
  slides?: string;
  output?: string;
  model?: string;
  template?: string;
  rerender?: string;
}

/**
 * Consolidated generate command handler.
 *
 * Three modes:
 *
 * 1. Full pipeline (no --template)
 *    Runs the standard AI pipeline from scratch.
 *
 * 2. Template + AI (--template + topic/input)
 *    Reuses HTML templates from a previous run, runs Research + Copy agents
 *    with the new topic, then applies copy and exports PNGs.
 *
 * 3. Template + Rerender (--template + --rerender)
 *    Reuses HTML templates, applies user-provided copy.json, exports PNGs.
 *    Skips all AI entirely.
 */
export async function generate(topic: string | undefined, opts: GenerateOptions): Promise<void> {
  if (opts.template && opts.rerender) {
    await templateRerender(opts.template, opts.rerender, opts);
  } else if (opts.template) {
    if (!topic && !opts.input) {
      log.error(
        "--template without --rerender requires a topic or --input for AI copy generation.",
      );
      process.exit(1);
    }
    await templateWithAI(opts.template, topic, opts);
  } else {
    // Full pipeline — no template
    if (!topic && !opts.input) {
      log.error("Provide a topic or --input file. Run --help for usage.");
      process.exit(1);
    }

    const slideCount = parseInt(opts.slides || "10", 10);
    if (Number.isNaN(slideCount) || slideCount < 3 || slideCount > 20) {
      log.error("Slide count must be between 3 and 20.");
      process.exit(1);
    }

    log.banner("vibe-poster: Card News Generator");
    log.info(`Topic: ${topic || `(from file: ${opts.input})`}`);
    log.info(`Series: ${opts.series}`);
    log.info(`Slides: ${slideCount}`);
    log.info(`Model: ${opts.model || "(default)"}`);
    log.info(`Output: ${opts.output}`);
    log.divider();

    await runPipeline({
      topic: topic || "",
      inputFile: opts.input,
      series: opts.series || "default",
      slideCount,
      outputDir: opts.output || "./output",
      model: opts.model,
    });
  }
}

// ─── Template + Rerender (Mode A / re-render) ──────────────────────────────

/**
 * Apply a user-provided copy.json to existing templates.
 * Creates a new output directory — source is never modified.
 */
async function templateRerender(
  templateDir: string,
  copyFile: string,
  options: GenerateOptions,
): Promise<void> {
  log.banner("Generate: Apply copy.json to existing templates");
  log.info(`Source templates: ${templateDir}`);
  log.divider();

  // Validate source slides directory exists
  const sourceSlidesDir = join(templateDir, "slides");
  if (!(await fileExists(sourceSlidesDir))) {
    log.error(`slides/ directory not found at ${sourceSlidesDir}`);
    log.info("Run the full pipeline first to generate HTML templates.");
    process.exit(1);
  }

  if (!(await fileExists(copyFile))) {
    log.error(`copy.json not found at ${copyFile}`);
    process.exit(1);
  }

  // Read and validate copy data
  log.step("Reading copy.json");
  const rawCopy = await readJsonFile(copyFile);
  let copyOutput: typeof CopyOutput._output;
  try {
    copyOutput = CopyOutput.parse(rawCopy);
  } catch (err) {
    log.error("Invalid copy.json format", err instanceof Error ? err : undefined);
    process.exit(1);
  }
  log.success(`Loaded ${copyOutput.slides.length} slides from copy.json`);

  // Create new output directory
  const baseOutput = options.output || dirname(templateDir);
  const newOutputDir = getOutputDir(baseOutput, copyOutput.title || "reuse");
  const newSlidesDir = join(newOutputDir, "slides");

  log.step(`Creating new output: ${newOutputDir}`);

  // Copy templates and artifacts to new directory
  const htmlFiles = await copyTemplates(sourceSlidesDir, newSlidesDir);
  log.success(`Copied ${htmlFiles.length} HTML templates`);
  await copySourceArtifacts(templateDir, newOutputDir);

  // Apply copy to templates in the NEW directory
  log.step("Applying copy data to HTML templates");
  const updatedSlides = await reRenderAllSlides(newSlidesDir, copyOutput);

  // Save copy.json
  await writeJsonFile(join(newOutputDir, "copy.json"), copyOutput);

  // Export PNGs
  log.step("Rendering PNGs");
  const pngPaths = await renderAllSlides(updatedSlides, newSlidesDir);

  log.divider();
  log.banner("Generate Complete!");
  log.info(`New output: ${newOutputDir}`);
  log.info(`Slides updated: ${updatedSlides.size}`);
  log.info(`PNG files: ${pngPaths.size}`);
  log.divider();
}

// ─── Template + AI (Mode B) ────────────────────────────────────────────────

/**
 * Run AI Research + Copy agents with a new topic,
 * reusing existing plan.json and HTML templates.
 * Creates a new output directory — source is never modified.
 */
async function templateWithAI(
  templateDir: string,
  topic: string | undefined,
  options: GenerateOptions,
): Promise<void> {
  log.banner("Generate: AI copy with existing templates");
  log.info(`Source templates: ${templateDir}`);
  log.divider();

  // Validate source slides directory exists
  const sourceSlidesDir = join(templateDir, "slides");
  if (!(await fileExists(sourceSlidesDir))) {
    log.error(`slides/ directory not found at ${sourceSlidesDir}`);
    log.info("Run the full pipeline first to generate HTML templates.");
    process.exit(1);
  }

  // Load existing plan.json from source
  const planPath = join(templateDir, "plan.json");
  if (!(await fileExists(planPath))) {
    log.error(`plan.json not found at ${planPath}`);
    log.info("The source directory must contain a plan.json from a previous run.");
    process.exit(1);
  }

  log.step("Loading plan.json from previous run");
  const rawPlan = await readJsonFile(planPath);
  let planOutput: typeof PlanOutput._output;
  try {
    planOutput = PlanOutput.parse(rawPlan);
  } catch (err) {
    log.error("Invalid plan.json format", err instanceof Error ? err : undefined);
    process.exit(1);
  }
  log.success(`Plan loaded: ${planOutput.totalSlides} slides, "${planOutput.title}"`);

  // Resolve topic
  let resolvedTopic = topic || "";
  if (options.input && !resolvedTopic) {
    const content = await readTextFile(options.input);
    resolvedTopic = content.split("\n")[0].replace(/^#\s*/, "").trim() || "Untitled Topic";
  }

  // Create new output directory
  const baseOutput = options.output || dirname(templateDir);
  const newOutputDir = getOutputDir(baseOutput, resolvedTopic || "reuse");
  const newSlidesDir = join(newOutputDir, "slides");

  log.step(`Creating new output: ${newOutputDir}`);

  // Copy templates and artifacts to new directory
  const htmlFiles = await copyTemplates(sourceSlidesDir, newSlidesDir);
  log.success(`Copied ${htmlFiles.length} HTML templates`);
  await copySourceArtifacts(templateDir, newOutputDir);

  // Build pipeline context targeting the new output dir
  const ctx = new PipelineContext({
    topic: resolvedTopic,
    inputFile: options.input,
    series: "default",
    slideCount: planOutput.totalSlides,
    outputDir: newOutputDir,
    model: options.model,
  });

  // Hydrate plan from disk (skip Stage 2).
  // Adapt the plan's topic-specific fields so the CopyAgent writes about
  // the new topic instead of following old-topic references in purpose/direction.
  ctx.plan = adaptPlanForNewTopic(planOutput, resolvedTopic || "(from input file)");

  // If user provided an input file, read it as raw research content
  if (options.input) {
    log.step(`Reading input file: ${options.input}`);
    ctx.rawResearchContent = await readTextFile(options.input);
    if (!topic) {
      const firstLine = ctx.rawResearchContent.split("\n")[0].replace(/^#\s*/, "").trim();
      (ctx.options as unknown as Record<string, unknown>).topic = firstLine || "Untitled Topic";
    }
  }

  const pipelineModel = options.model;
  const totalTokens = { input: 0, output: 0 };

  // Stage 1: Research
  log.step("Stage 1: Research (new topic)");
  const researcher = new ResearcherAgent();
  const researchResult = await researcher.run(ctx, pipelineModel);
  ctx.research = researchResult.output;
  totalTokens.input += researchResult.tokensUsed.input;
  totalTokens.output += researchResult.tokensUsed.output;

  await writeJsonFile(join(newOutputDir, "research.json"), ctx.research);
  await writeOutputFile(join(newOutputDir, "research.md"), formatResearchAsMarkdown(ctx.research));
  log.success("New research saved");

  // Stage 3: Copy (skip Stage 2 — plan reused from disk)
  log.step("Stage 3: Copywriting (using existing plan)");
  const copywriter = new CopyAgent();
  const copyResult = await copywriter.run(ctx, pipelineModel);
  ctx.copy = copyResult.output;
  totalTokens.input += copyResult.tokensUsed.input;
  totalTokens.output += copyResult.tokensUsed.output;

  await writeJsonFile(join(newOutputDir, "copy.json"), ctx.copy);
  log.success("New copy saved");

  // Apply copy to templates in the NEW directory
  log.step("Applying new copy to HTML templates");
  const copyOutput = ctx.requireCopy();
  const updatedSlides = await reRenderAllSlides(newSlidesDir, copyOutput);

  // Export PNGs
  log.step("Rendering PNGs");
  const pngPaths = await renderAllSlides(updatedSlides, newSlidesDir);

  // Summary
  log.divider();
  log.banner("Generate Complete!");
  log.info(`Source templates: ${templateDir}`);
  log.info(`New output: ${newOutputDir}`);
  log.info(`Slides updated: ${updatedSlides.size}`);
  log.info(`PNG files: ${pngPaths.size}`);
  log.info(
    `Tokens used: ${totalTokens.input.toLocaleString()} input, ${totalTokens.output.toLocaleString()} output`,
  );
  log.divider();
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/**
 * Copy HTML template files from source slides/ to a new slides/ directory.
 * Returns the list of copied file names.
 */
async function copyTemplates(sourceSlidesDir: string, destSlidesDir: string): Promise<string[]> {
  await ensureDir(destSlidesDir);

  const files = await readdir(sourceSlidesDir);
  const htmlFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();

  if (htmlFiles.length === 0) {
    throw new Error(`No slide HTML files found in ${sourceSlidesDir}`);
  }

  for (const file of htmlFiles) {
    const content = await readTextFile(join(sourceSlidesDir, file));
    await writeOutputFile(join(destSlidesDir, file), content);
  }

  return htmlFiles;
}

/**
 * Copy JSON artifacts (plan.json, design-brief.json) from source to new output dir
 * so the new folder is self-contained.
 */
async function copySourceArtifacts(sourceDir: string, newOutputDir: string): Promise<void> {
  const artifacts = ["plan.json", "design-brief.json"];
  for (const name of artifacts) {
    const src = join(sourceDir, name);
    if (await fileExists(src)) {
      const content = await readTextFile(src);
      await writeOutputFile(join(newOutputDir, name), content);
    }
  }
}

/**
 * Format research output as readable markdown.
 */
function formatResearchAsMarkdown(research: typeof ResearchOutput._output): string {
  let md = `# ${research.topic}\n\n`;
  md += `## Summary\n${research.summary}\n\n`;
  md += `## Target Audience\n${research.targetAudience}\n\n`;

  md += "## Key Facts\n";
  for (const f of research.keyFacts) {
    md += `- ${f.fact}${f.source ? ` *(${f.source})*` : ""}\n`;
  }

  md += "\n## Statistics\n";
  for (const s of research.statistics) {
    md += `- **${s.value}**: ${s.description}${s.source ? ` *(${s.source})*` : ""}\n`;
  }

  md += "\n## Quotes\n";
  for (const q of research.quotes) {
    md += `> "${q.text}"${q.author ? ` — ${q.author}` : ""}\n\n`;
  }

  md += `## Keywords\n${research.keywords.join(", ")}\n`;

  return md;
}

/**
 * Adapt a plan from a previous topic to work with a new topic.
 *
 * The plan's structural fields (roles, emotions, temperatures, slide count)
 * are preserved. The topic-specific fields (title, narrative, and each
 * slide's purpose/direction) are prefixed with an instruction to apply
 * them to the new topic so the CopyAgent doesn't follow old-topic wording.
 */
function adaptPlanForNewTopic(
  plan: typeof PlanOutput._output,
  newTopic: string,
): typeof PlanOutput._output {
  return {
    ...plan,
    title: `[NEW TOPIC: ${newTopic}]`,
    subtitle: plan.subtitle,
    narrative: `IMPORTANT: The original plan was for a different topic. Rewrite all content for the NEW topic: "${newTopic}". Use the same slide structure, emotional curve, and roles, but replace all subject matter with the new topic. Original narrative for structural reference: ${plan.narrative}`,
    slides: plan.slides.map((slide) => ({
      ...slide,
      purpose: `[Apply to new topic: ${newTopic}] ${slide.purpose}`,
      direction: `[IGNORE old topic references — write about: ${newTopic}] ${slide.direction}`,
    })),
  };
}
