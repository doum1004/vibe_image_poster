import { CopyAgent, PlanAgent } from "../agents/contents-marketer.js";
import { DesignerAgent } from "../agents/designer.js";
import { DeveloperAgent } from "../agents/developer.js";
import { QAReviewerAgent } from "../agents/qa-reviewer.js";
// Agents
import { ResearcherAgent } from "../agents/researcher.js";
import { getConfig } from "../config.js";
// Renderer
import { buildSlideHtml } from "../renderer/html-builder.js";
import { closeBrowser, renderAllSlides } from "../renderer/png-exporter.js";
import {
  ensureDir,
  getOutputDir,
  readTextFile,
  writeJsonFile,
  writeOutputFile,
} from "../utils/file.js";
import { log } from "../utils/logger.js";
// Validation
import { validateAllSlides } from "../validation/slide-validator.js";
import { PipelineContext } from "./context.js";
import type { PipelineOptions, ResearchOutput } from "./types.js";

/**
 * Run the full card news generation pipeline.
 *
 * Flow: Research → Plan → Copy → Design → Build HTML → Validate → QA → (Fix Loop) → PNG Export
 */
export async function runPipeline(options: PipelineOptions): Promise<void> {
  const config = getConfig();

  // Resolve output directory
  const outputDir = getOutputDir(options.outputDir, options.topic || "untitled");
  const slidesDir = `${outputDir}/slides`;
  await ensureDir(slidesDir);

  const ctx = new PipelineContext({
    ...options,
    outputDir,
  });

  const pipelineModel = options.model;

  log.banner("Pipeline: Card News Generation");
  log.info(`Output: ${outputDir}`);
  log.divider();

  const totalTokens = { input: 0, output: 0 };

  try {
    // ─── Stage 1: Research ───────────────────────────────────────
    log.step("Stage 1/6: Research");

    if (options.inputFile) {
      log.info(`Reading input file: ${options.inputFile}`);
      ctx.rawResearchContent = await readTextFile(options.inputFile);
      if (!options.topic) {
        // Extract a topic from the first line of the file
        const firstLine = ctx.rawResearchContent.split("\n")[0].replace(/^#\s*/, "").trim();
        (ctx.options as unknown as Record<string, unknown>).topic = firstLine || "Untitled Topic";
      }
    }

    const researcher = new ResearcherAgent();
    const researchResult = await researcher.run(ctx, pipelineModel);
    ctx.research = researchResult.output;
    totalTokens.input += researchResult.tokensUsed.input;
    totalTokens.output += researchResult.tokensUsed.output;

    // Save research output
    await writeJsonFile(`${outputDir}/research.json`, ctx.research);
    await writeOutputFile(`${outputDir}/research.md`, formatResearchAsMarkdown(ctx.research));
    log.success("Research saved");

    // ─── Stage 2: Plan ───────────────────────────────────────────
    log.step("Stage 2/6: Content Planning");

    const planner = new PlanAgent();
    const planResult = await planner.run(ctx, pipelineModel);
    ctx.plan = planResult.output;
    totalTokens.input += planResult.tokensUsed.input;
    totalTokens.output += planResult.tokensUsed.output;

    await writeJsonFile(`${outputDir}/plan.json`, ctx.plan);
    log.success("Plan saved");

    // ─── Stage 3: Copy ───────────────────────────────────────────
    log.step("Stage 3/6: Copywriting");

    const copywriter = new CopyAgent();
    const copyResult = await copywriter.run(ctx, pipelineModel);
    ctx.copy = copyResult.output;
    totalTokens.input += copyResult.tokensUsed.input;
    totalTokens.output += copyResult.tokensUsed.output;

    await writeJsonFile(`${outputDir}/copy.json`, ctx.copy);
    log.success("Copy saved");

    // ─── Stage 4: Design ─────────────────────────────────────────
    log.step("Stage 4/6: Visual Design");

    const designer = new DesignerAgent();
    const designResult = await designer.run(ctx, pipelineModel);
    ctx.designBrief = designResult.output;
    totalTokens.input += designResult.tokensUsed.input;
    totalTokens.output += designResult.tokensUsed.output;

    await writeJsonFile(`${outputDir}/design-brief.json`, ctx.designBrief);
    log.success("Design brief saved");

    // ─── Stage 5: Build HTML ─────────────────────────────────────
    log.step("Stage 5/6: HTML Build");

    const developer = new DeveloperAgent();
    const devResult = await developer.run(ctx, pipelineModel);
    totalTokens.input += devResult.tokensUsed.input;
    totalTokens.output += devResult.tokensUsed.output;

    // Store HTML slides and save to disk
    for (const slide of devResult.output.slides) {
      const html = await buildSlideHtml(slide.html, options.series);
      ctx.htmlSlides.set(slide.slideNumber, html);

      const padded = String(slide.slideNumber).padStart(2, "0");
      await writeOutputFile(`${slidesDir}/slide-${padded}.html`, html);
    }
    log.success(`${devResult.output.slides.length} HTML slides built`);

    // ─── Auto Validation ─────────────────────────────────────────
    log.step("Auto Validation");
    const _validation = validateAllSlides(ctx.htmlSlides);

    // ─── Stage 6: QA Review + Fix Loop ───────────────────────────
    log.step("Stage 6/6: QA Review");

    const qaReviewer = new QAReviewerAgent();
    let qaLoops = 0;

    while (qaLoops < config.maxQaLoops) {
      qaLoops++;
      ctx.qaIteration = qaLoops;
      log.info(`QA iteration ${qaLoops}/${config.maxQaLoops}`);

      const qaResult = await qaReviewer.run(ctx, pipelineModel);
      ctx.qaReport = qaResult.output;
      totalTokens.input += qaResult.tokensUsed.input;
      totalTokens.output += qaResult.tokensUsed.output;

      await writeJsonFile(`${outputDir}/qa-report.json`, ctx.qaReport);

      if (ctx.qaReport.overallVerdict === "pass" || !ctx.hasBlockingIssues()) {
        log.success("QA passed — no blocking issues.");
        break;
      }

      const highCount = ctx.qaReport.issues.filter((i) => i.severity === "high").length;
      const medCount = ctx.qaReport.issues.filter((i) => i.severity === "medium").length;
      log.warn(
        `QA found ${highCount} high, ${medCount} medium issues. ` +
          (qaLoops < config.maxQaLoops ? "Requesting fixes..." : "Max iterations reached."),
      );

      if (qaLoops < config.maxQaLoops) {
        // Re-run developer with QA feedback
        log.step("Developer fix pass");
        const fixResult = await runDeveloperFix(ctx, developer, pipelineModel);
        totalTokens.input += fixResult.tokensUsed.input;
        totalTokens.output += fixResult.tokensUsed.output;

        // Update slides on disk
        for (const slide of fixResult.output.slides) {
          const html = await buildSlideHtml(slide.html, options.series);
          ctx.htmlSlides.set(slide.slideNumber, html);
          const padded = String(slide.slideNumber).padStart(2, "0");
          await writeOutputFile(`${slidesDir}/slide-${padded}.html`, html);
        }
        log.success("Fixes applied");
      }
    }

    // ─── PNG Export ──────────────────────────────────────────────
    log.step("Rendering PNGs");
    const pngPaths = await renderAllSlides(ctx.htmlSlides, slidesDir);
    ctx.pngPaths = pngPaths;

    // ─── Summary ─────────────────────────────────────────────────
    log.divider();
    log.banner("Generation Complete!");
    log.info(`Output directory: ${outputDir}`);
    log.info(`Slides generated: ${ctx.htmlSlides.size}`);
    log.info(`PNG files: ${pngPaths.size}`);
    log.info(`QA iterations: ${qaLoops}`);
    log.info(
      `Tokens used: ${totalTokens.input.toLocaleString()} input, ${totalTokens.output.toLocaleString()} output`,
    );

    if (ctx.qaReport?.overallVerdict === "needs_revision") {
      log.warn("Note: QA still has unresolved issues after max iterations. Check qa-report.json.");
    }

    log.divider();
  } catch (err) {
    await closeBrowser();
    throw err;
  }
}

/**
 * Run the developer agent in "fix" mode with QA feedback.
 */
async function runDeveloperFix(
  ctx: PipelineContext,
  developer: DeveloperAgent,
  pipelineModel?: string,
) {
  // Inject QA feedback into context for the developer's next run
  // The developer will see the issues and fix them
  return developer.run(ctx, pipelineModel);
}

/**
 * Format research output as readable markdown.
 */
function formatResearchAsMarkdown(research: ResearchOutput): string {
  let md = `# ${research.topic}\n\n`;
  md += `## Summary\n${research.summary}\n\n`;
  md += `## Target Audience\n${research.targetAudience}\n\n`;

  md += `## Key Facts\n`;
  for (const f of research.keyFacts) {
    md += `- ${f.fact}${f.source ? ` *(${f.source})*` : ""}\n`;
  }

  md += `\n## Statistics\n`;
  for (const s of research.statistics) {
    md += `- **${s.value}**: ${s.description}${s.source ? ` *(${s.source})*` : ""}\n`;
  }

  md += `\n## Quotes\n`;
  for (const q of research.quotes) {
    md += `> "${q.text}"${q.author ? ` — ${q.author}` : ""}\n\n`;
  }

  md += `## Keywords\n${research.keywords.join(", ")}\n`;

  return md;
}
