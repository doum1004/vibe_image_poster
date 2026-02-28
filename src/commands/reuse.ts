import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CopyAgent } from "../agents/contents-marketer.js";
import { ResearcherAgent } from "../agents/researcher.js";
import { PipelineContext } from "../pipeline/context.js";
import { CopyOutput, PlanOutput, type ResearchOutput } from "../pipeline/types.js";
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

export interface ReuseOptions {
  topic?: string;
  input?: string;
  model?: string;
  output?: string;
}

/**
 * Reuse existing HTML templates with new copy content.
 *
 * Both modes create a NEW output directory — the source templates are never modified.
 *
 * Mode A — User provides a copy.json file:
 *   Copies templates to a new dir, applies copy.json, exports PNGs.
 *
 * Mode B — AI generates new copy from a new topic:
 *   Copies templates to a new dir, runs Research + Copy agents,
 *   applies generated copy, exports PNGs.
 *
 * @param sourceDir - Path to the existing output directory with slides/
 * @param copyFile  - Optional path to a user-provided copy.json
 * @param options   - Options: --topic, --input, --model, --output
 */
export async function reuse(
  sourceDir: string,
  copyFile: string | undefined,
  options: ReuseOptions,
): Promise<void> {
  log.banner("Reuse: Apply new content to existing templates");
  log.info(`Source templates: ${sourceDir}`);
  log.divider();

  // Validate source slides directory exists
  const sourceSlidesDir = join(sourceDir, "slides");
  if (!(await fileExists(sourceSlidesDir))) {
    log.error(`slides/ directory not found at ${sourceSlidesDir}`);
    log.info("Run the full pipeline first to generate HTML templates.");
    process.exit(1);
  }

  if (copyFile) {
    await reuseModeA(sourceDir, sourceSlidesDir, copyFile, options);
  } else if (options.topic || options.input) {
    await reuseModeB(sourceDir, sourceSlidesDir, options);
  } else {
    log.error("Provide a copy.json file or use --topic / --input for AI-generated copy.");
    log.info("Usage:");
    log.info("  vibe-poster reuse <dir> <copy.json>           # Mode A: user-provided copy");
    log.info('  vibe-poster reuse <dir> --topic "new topic"    # Mode B: AI-generated copy');
    process.exit(1);
  }
}

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
 * Mode A: Apply a user-provided copy.json to existing templates.
 * Creates a new output directory — source is never modified.
 */
async function reuseModeA(
  sourceDir: string,
  sourceSlidesDir: string,
  copyFile: string,
  options: ReuseOptions,
): Promise<void> {
  log.info("Mode: User-provided copy.json");
  log.divider();

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
  const baseOutput = options.output || dirname(sourceDir);
  const newOutputDir = getOutputDir(baseOutput, copyOutput.title || "reuse");
  const newSlidesDir = join(newOutputDir, "slides");

  log.step(`Creating new output: ${newOutputDir}`);

  // Copy templates and artifacts to new directory
  const htmlFiles = await copyTemplates(sourceSlidesDir, newSlidesDir);
  log.success(`Copied ${htmlFiles.length} HTML templates`);
  await copySourceArtifacts(sourceDir, newOutputDir);

  // Apply copy to templates in the NEW directory
  log.step("Applying copy data to HTML templates");
  const updatedSlides = await reRenderAllSlides(newSlidesDir, copyOutput);

  // Save copy.json
  await writeJsonFile(join(newOutputDir, "copy.json"), copyOutput);

  // Export PNGs
  log.step("Rendering PNGs");
  const pngPaths = await renderAllSlides(updatedSlides, newSlidesDir);

  printSummary(newOutputDir, updatedSlides.size, pngPaths.size);
}

/**
 * Mode B: Run AI Research + Copy agents with a new topic,
 * reusing the existing plan.json and HTML templates.
 * Creates a new output directory — source is never modified.
 */
async function reuseModeB(
  sourceDir: string,
  sourceSlidesDir: string,
  options: ReuseOptions,
): Promise<void> {
  log.info("Mode: AI-generated copy from new topic");
  log.divider();

  // Load existing plan.json from source
  const planPath = join(sourceDir, "plan.json");
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
  let topic = options.topic || "";
  if (options.input && !topic) {
    const content = await readTextFile(options.input);
    topic = content.split("\n")[0].replace(/^#\s*/, "").trim() || "Untitled Topic";
  }

  // Create new output directory
  const baseOutput = options.output || dirname(sourceDir);
  const newOutputDir = getOutputDir(baseOutput, topic || "reuse");
  const newSlidesDir = join(newOutputDir, "slides");

  log.step(`Creating new output: ${newOutputDir}`);

  // Copy templates and artifacts to new directory
  const htmlFiles = await copyTemplates(sourceSlidesDir, newSlidesDir);
  log.success(`Copied ${htmlFiles.length} HTML templates`);
  await copySourceArtifacts(sourceDir, newOutputDir);

  // Build pipeline context targeting the new output dir
  const ctx = new PipelineContext({
    topic,
    inputFile: options.input,
    series: "default",
    slideCount: planOutput.totalSlides,
    outputDir: newOutputDir,
    model: options.model,
  });

  // Hydrate plan from disk (skip Stage 2).
  // Adapt the plan's topic-specific fields so the CopyAgent writes about
  // the new topic instead of following old-topic references in purpose/direction.
  ctx.plan = adaptPlanForNewTopic(planOutput, topic || "(from input file)");

  // If user provided an input file, read it as raw research content
  if (options.input) {
    log.step(`Reading input file: ${options.input}`);
    ctx.rawResearchContent = await readTextFile(options.input);
    if (!options.topic) {
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
  log.banner("Reuse Complete!");
  log.info(`Source templates: ${sourceDir}`);
  log.info(`New output: ${newOutputDir}`);
  log.info(`Slides updated: ${updatedSlides.size}`);
  log.info(`PNG files: ${pngPaths.size}`);
  log.info(
    `Tokens used: ${totalTokens.input.toLocaleString()} input, ${totalTokens.output.toLocaleString()} output`,
  );
  log.divider();
}

/**
 * Print completion summary for Mode A.
 */
function printSummary(outputDir: string, slideCount: number, pngCount: number): void {
  log.divider();
  log.banner("Reuse Complete!");
  log.info(`New output: ${outputDir}`);
  log.info(`Slides updated: ${slideCount}`);
  log.info(`PNG files: ${pngCount}`);
  log.divider();
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
