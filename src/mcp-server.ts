#!/usr/bin/env bun
/**
 * MCP server that exposes vibe-poster as tools for external LLM agents.
 *
 * Key design: The connected LLM agent **is** the brain. It does all the
 * creative work (research, planning, copywriting, design decisions, HTML coding).
 * This server only provides:
 *   - Prompts: guidance for each pipeline stage (schemas, rules, pattern catalog)
 *   - Tools:  non-AI operations (validate HTML, build slides, render PNGs, save files)
 *   - Resources: design tokens, pattern catalog, base styles
 *
 * No LLM API keys needed. The agent calling these tools IS the LLM.
 */
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPatternListForPrompt, PATTERN_CATALOG } from "./design-system/shared/patterns.js";
import {
  CopyOutput,
  DesignBriefOutput,
  PlanOutput,
  QAReport,
  ResearchOutput,
} from "./pipeline/types.js";
import { buildSlideHtml } from "./renderer/html-builder.js";
import { closeBrowser, renderAllSlides } from "./renderer/png-exporter.js";
import { buildPresentation } from "./renderer/presentation-builder.js";
import { ensureDir, listDirs, readTextFile, writeJsonFile, writeOutputFile } from "./utils/file.js";
import { resolveFromSrc } from "./utils/paths.js";
import { validateAllSlides } from "./validation/slide-validator.js";

const server = new McpServer(
  { name: "vibe-poster", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS — give the agent the knowledge it needs for each stage
// ═══════════════════════════════════════════════════════════════════════════

server.registerPrompt(
  "pipeline_overview",
  {
    title: "Card News Pipeline Overview",
    description:
      "Complete guide to generating card news. Start here. " +
      "Explains the 8-stage pipeline and JSON schemas for each stage.",
  },
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# vibe-poster Card News Pipeline

You are generating Instagram card news (1080×1440px slides). Follow these 8 stages in order.
Each stage produces JSON that feeds into the next. Use the tools to save, validate, and render.

## Stage 1: Research
Produce structured research about the topic.
Schema: { topic, summary, keyFacts: [{fact, source?}], statistics: [{value, description, source?}], quotes: [{text, author?}], targetAudience, keywords: [string] }

## Stage 2: Plan
Plan slide structure with emotional curve: empathy → transition → evidence → action.
Schema: { title, subtitle?, totalSlides, narrative, slides: [{slideNumber, role: "cover"|"body"|"cta", emotionPhase, emotionTemperature: 1-5, purpose, direction}] }
Rules: Slide 1 = cover, last = cta, middle = body. No same temperature 3x in a row.

## Stage 3: Copy
Write Korean copy for each slide following the plan.
Schema: { title, slides: [{slideNumber, role, heading?(max 15 chars), subheading?(max 25), bodyText?(max 80/para), bulletPoints?[], accentText?(max 20), footnote?, ctaText?(max 30)}] }
Rules: Use Korean (한국어). Max 2 accent highlights per slide. Max 1 <strong> per slide.

## Stage 4: Design
Select layout patterns and color palette.
Use get_pattern_catalog resource for available patterns.
Schema: { seriesTheme, colorPalette: {primary, secondary, accent, background, text}, slides: [{slideNumber, layoutPattern, primaryColor?, secondaryColor?, backgroundColor?, notes?}] }
Rules: No same pattern on consecutive slides. Cover→intro-cover, CTA→intro-cta.

## Stage 5: Build HTML
Write standalone HTML for each slide. Each file: 1080×1440px, all CSS inline, no external deps.
Call build_slides tool with your HTML. It validates and saves.
Rules: Korean font stack, word-break:keep-all, overflow:hidden, min font 28px, data-bind attributes on content elements, .bottom-bar at bottom.

## Stage 6: Validate & QA Review
Run validate_slides to get auto-check results. Then review slides yourself:
- Cross-reference all facts/stats against Stage 1 research data.
- Check layout rules, emphasis limits, design consistency.
- Produce a QA report → call save_qa_report to save it.
Schema: { passedAutoChecks, autoCheckResults: [{rule, passed, detail?}], issues: [{slideNumber, severity: "high"|"medium"|"low", category, description, suggestion?}], overallVerdict: "pass"|"needs_revision" }
If verdict is "needs_revision": fix the HTML and call build_slides again, then re-validate.

## Stage 7: Render PNGs
Call render_pngs tool to convert HTML slides to PNG images. Also auto-generates presentation.html.

## Stage 8: Presentation (automatic)
render_pngs auto-generates presentation.html. Or call generate_presentation independently.

## Workflow
1. Research the topic → call save_pipeline_data(stage="research", data=...)
2. Plan slides → call save_pipeline_data(stage="plan", data=...)
3. Write copy → call save_pipeline_data(stage="copy", data=...)
4. Design → call save_pipeline_data(stage="design", data=...)
5. Build HTML → call build_slides(slides=[...], series=...)
6. Validate → call validate_slides(slidesDir=...) → review results → call save_qa_report(...)
7. If QA fails: fix HTML → call build_slides again → re-validate
8. Render → call render_pngs(slidesDir=...)
`,
        },
      },
    ],
  }),
);

server.registerPrompt(
  "html_developer_guide",
  {
    title: "HTML Developer Guide",
    description: "Detailed rules for building standalone HTML slides with data-bind attributes.",
  },
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# HTML Slide Development Guide

## Canvas
- Exactly 1080px × 1440px. overflow:hidden on html, body, .card.
- Safe area: ~32-40px breathing room from edges.

## Standalone
- Each slide is a complete HTML file. No external stylesheets, CDN, images, or JS.
- Use CSS shapes, gradients, emoji for visuals.
- Korean font stack: 'Pretendard', 'Noto Sans KR', sans-serif
- word-break: keep-all on body.

## Design Tokens (CSS custom properties)
Define all tokens in :root { } per slide. Use var(--token) everywhere.
Never hardcode colors/sizes. See get_design_tokens resource.

## Font Size
MINIMUM 28px. Non-negotiable. Prefer scaling down headings and padding when space is tight.

## Data Binding (CRITICAL for template reuse)
Every content element MUST have data-bind attribute:
  heading, subheading, body, bullets, bullet, accentText, footnote, ctaText

Example:
  <h1 data-bind="heading">AI 시대의 혁명</h1>
  <ul data-bind="bullets">
    <li data-bind="bullet">첫 번째</li>
  </ul>

## Emphasis
- Max 2 elements with class "accent" per slide
- Max 1 <strong> per slide
- Never nest accent inside strong

## Structure
\`\`\`html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    :root { /* tokens */ }
    /* base + slide styles */
  </style>
</head>
<body>
  <div class="card">
    <div class="card-content">
      <!-- content with data-bind -->
    </div>
    <div class="bottom-bar">@series_name</div>
  </div>
</body>
</html>
\`\`\`
`,
        },
      },
    ],
  }),
);

server.registerPrompt(
  "qa_reviewer_guide",
  {
    title: "QA Reviewer Guide",
    description:
      "Rules and checklist for reviewing slides. Use after build_slides or validate_slides " +
      "to perform a thorough QA review before rendering.",
  },
  async () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# QA Reviewer Guide

You are reviewing card news slides for quality. Check every slide against these rules.

## What You Check

### Factual Accuracy (HIGH severity)
- Every statistic in slides MUST match the research data exactly.
- Every fact MUST be traceable to the research. No invented data.
- Numbers, percentages, and sources must be consistent.

### Layout Rules (HIGH severity)
- Canvas: 1080×1440px with overflow:hidden on html/body/.card.
- word-break: keep-all present.
- No font size below 28px.
- No external URLs (http://, https://, CDN links).

### Design Rules (MEDIUM severity)
- Every slide has a .bottom-bar element.
- Max 2 .accent elements per slide.
- Max 1 <strong> per slide. No nested accent inside strong.
- Colors use CSS variables (no hardcoded hex in HTML elements).
- Same layout pattern NOT used on 2 consecutive slides.

### Content Rules (LOW severity)
- Same emotion temperature not 3 slides in a row.
- Text not truncated or incomplete.
- Korean typography: keep-all respected, no awkward line breaks.

## Severity Levels
- **high**: Must fix before rendering. Factual errors, layout overflow, missing critical elements.
- **medium**: Should fix. Design rule violations, emphasis overuse.
- **low**: Nice to fix. Minor style suggestions.

## Verdict
- "pass" ONLY if zero high and zero medium issues.
- "needs_revision" if any high or medium issue exists.

## QA Report Schema
{ passedAutoChecks: boolean, autoCheckResults: [{rule, passed, detail?}], issues: [{slideNumber, severity, category, description, suggestion?}], overallVerdict: "pass"|"needs_revision" }

## Workflow
1. Call validate_slides to get auto-check results.
2. Review the auto-check output + read the HTML yourself.
3. Cross-reference facts against research data.
4. Produce the QA report → call save_qa_report to save it.
5. If verdict is "needs_revision", fix the slides and call build_slides again.
`,
        },
      },
    ],
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCES — read-only reference data
// ═══════════════════════════════════════════════════════════════════════════

server.registerResource(
  "pattern_catalog",
  "vibe-poster://patterns",
  {
    description: "All 28 layout patterns with IDs, categories, and structure hints.",
    mimeType: "application/json",
  },
  async () => ({
    contents: [
      {
        uri: "vibe-poster://patterns",
        mimeType: "application/json",
        text: JSON.stringify(PATTERN_CATALOG, null, 2),
      },
    ],
  }),
);

server.registerResource(
  "design_tokens",
  "vibe-poster://design-tokens",
  { description: "CSS custom properties (design tokens) for slides.", mimeType: "text/css" },
  async () => {
    const css = await readTextFile(resolveFromSrc("design-system", "shared", "design-tokens.css"));
    return {
      contents: [{ uri: "vibe-poster://design-tokens", mimeType: "text/css", text: css }],
    };
  },
);

server.registerResource(
  "base_styles",
  "vibe-poster://base-styles",
  { description: "Base CSS reset and utility classes for slides.", mimeType: "text/css" },
  async () => {
    const css = await readTextFile(resolveFromSrc("design-system", "shared", "base-styles.css"));
    return {
      contents: [{ uri: "vibe-poster://base-styles", mimeType: "text/css", text: css }],
    };
  },
);

server.registerResource(
  "pattern_list_for_prompt",
  "vibe-poster://pattern-list",
  { description: "Compact pattern list formatted for AI prompts.", mimeType: "text/plain" },
  async () => ({
    contents: [
      {
        uri: "vibe-poster://pattern-list",
        mimeType: "text/plain",
        text: getPatternListForPrompt(),
      },
    ],
  }),
);

// ═══════════════════════════════════════════════════════════════════════════
// TOOLS — non-AI operations the agent calls with its outputs
// ═══════════════════════════════════════════════════════════════════════════

// ─── Tool: save_pipeline_data ───────────────────────────────────────────────

server.registerTool(
  "save_pipeline_data",
  {
    title: "Save Pipeline Stage Data",
    description:
      "Save JSON output from a pipeline stage (research, plan, copy, design) to the output directory. " +
      "Validates the data against the expected schema before saving.",
    inputSchema: {
      stage: z.enum(["research", "plan", "copy", "design"]).describe("Pipeline stage name."),
      data: z.string().describe("JSON string of the stage output."),
      outputDir: z
        .string()
        .default("./output")
        .describe("Base output directory. A subfolder will be used or created."),
      topic: z
        .string()
        .default("untitled")
        .describe("Topic name, used for naming the output subfolder."),
    },
    annotations: {
      title: "Save Pipeline Data",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args) => {
    try {
      const parsed = JSON.parse(args.data);

      const schemaMap: Record<string, z.ZodTypeAny> = {
        research: ResearchOutput,
        plan: PlanOutput,
        copy: CopyOutput,
        design: DesignBriefOutput,
      };

      const schema = schemaMap[args.stage];
      const validated = schema.parse(parsed);

      const outDir = resolveOutputDir(args.outputDir, args.topic);
      await ensureDir(outDir);

      const fileMap: Record<string, string> = {
        research: "research.json",
        plan: "plan.json",
        copy: "copy.json",
        design: "design-brief.json",
      };

      const filePath = join(outDir, fileMap[args.stage]);
      await writeJsonFile(filePath, validated);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                stage: args.stage,
                file: filePath,
                outputDir: outDir,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Validation/save failed for stage "${args.stage}": ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ─── Tool: build_slides ─────────────────────────────────────────────────────

server.registerTool(
  "build_slides",
  {
    title: "Build & Validate HTML Slides",
    description:
      "Accepts HTML for each slide, validates against design rules, wraps with design tokens/base styles, " +
      "and saves to disk. Returns validation results. Call this after writing HTML. " +
      "Also auto-generates presentation.html viewer.",
    inputSchema: {
      slides: z
        .array(
          z.object({
            slideNumber: z.number().int().min(1),
            html: z.string().describe("Complete standalone HTML for this slide."),
          }),
        )
        .describe("Array of slide objects with slideNumber and html."),
      series: z.string().default("default").describe("Series theme name."),
      outputDir: z.string().default("./output").describe("Base output directory."),
      topic: z.string().default("untitled").describe("Topic name for subfolder."),
    },
    annotations: {
      title: "Build Slides",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args) => {
    try {
      const outDir = resolveOutputDir(args.outputDir, args.topic);
      const slidesDir = join(outDir, "slides");
      await ensureDir(slidesDir);

      const htmlMap = new Map<number, string>();

      for (const slide of args.slides) {
        const html = await buildSlideHtml(slide.html, args.series);
        htmlMap.set(slide.slideNumber, html);

        const padded = String(slide.slideNumber).padStart(2, "0");
        await writeOutputFile(join(slidesDir, `slide-${padded}.html`), html);
      }

      const validation = validateAllSlides(htmlMap);

      let presentationPath: string | null = null;
      try {
        presentationPath = await buildPresentation(slidesDir);
      } catch {
        // non-fatal — presentation generation can fail without blocking the build
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                slidesDir,
                slidesBuilt: args.slides.length,
                ...(presentationPath ? { presentationPath } : {}),
                validation: {
                  allPassed: validation.allPassed,
                  highIssues: validation.highCount,
                  mediumIssues: validation.mediumCount,
                  lowIssues: validation.lowCount,
                  details: validation.reports.flatMap((r) =>
                    r.results
                      .filter((v) => !v.passed)
                      .map((v) => ({
                        slide: r.slideNumber,
                        rule: v.rule,
                        severity: v.severity,
                        detail: v.detail,
                      })),
                  ),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Build failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ─── Tool: render_pngs ─────────────────────────────────────────────────────

server.registerTool(
  "render_pngs",
  {
    title: "Render Slides to PNG",
    description:
      "Renders HTML slide files to 1080×1440px PNG images using headless Chrome. " +
      "Reads slide-XX.html files from the slides directory.",
    inputSchema: {
      slidesDir: z
        .string()
        .describe("Path to the slides/ directory containing slide-XX.html files."),
    },
    annotations: {
      title: "Render PNGs",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
  async (args) => {
    try {
      const dir = resolve(args.slidesDir);
      const files = await readdir(dir);
      const htmlFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();

      if (htmlFiles.length === 0) {
        return {
          isError: true,
          content: [{ type: "text", text: `No slide HTML files found in ${dir}` }],
        };
      }

      const slideMap = new Map<number, string>();
      for (const file of htmlFiles) {
        const num = parseInt(file.match(/\d+/)?.[0] ?? "0", 10);
        const html = await readTextFile(join(dir, file));
        slideMap.set(num, html);
      }

      const pngPaths = await renderAllSlides(slideMap, dir);
      await closeBrowser();

      const rendered = [...pngPaths.entries()].map(([num, path]) => ({
        slide: num,
        png: path,
      }));

      let presentationPath: string | null = null;
      let presentationError: string | null = null;
      try {
        presentationPath = await buildPresentation(dir);
      } catch (e) {
        presentationError = e instanceof Error ? e.message : String(e);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                rendered,
                count: rendered.length,
                ...(presentationPath ? { presentationPath } : {}),
                ...(presentationError
                  ? { presentationWarning: `Presentation generation failed: ${presentationError}` }
                  : {}),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      await closeBrowser();
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `PNG rendering failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ─── Tool: list_series ──────────────────────────────────────────────────────

server.registerTool(
  "list_series",
  {
    title: "List Series Themes",
    description: "List available series themes for card news generation.",
    annotations: {
      title: "List Series",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async () => {
    const seriesDir = resolveFromSrc("design-system", "series");
    const dirs = await listDirs(seriesDir);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { series: dirs.length > 0 ? dirs : ["default"], count: dirs.length || 1 },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ─── Tool: get_pattern_catalog ──────────────────────────────────────────────

server.registerTool(
  "get_pattern_catalog",
  {
    title: "Get Layout Pattern Catalog",
    description: "Returns all 28 layout patterns with IDs, descriptions, and HTML structure hints.",
    annotations: {
      title: "Pattern Catalog",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(PATTERN_CATALOG, null, 2),
      },
    ],
  }),
);

// ─── Tool: validate_slides ──────────────────────────────────────────────────

server.registerTool(
  "validate_slides",
  {
    title: "Validate Slides",
    description:
      "Runs auto-validation rules on built HTML slides (canvas size, overflow, font size, " +
      "external URLs, bottom-bar, accent/strong limits, etc.). Returns per-slide results. " +
      "Call this before QA review or after fixing slides to re-check.",
    inputSchema: {
      slidesDir: z
        .string()
        .describe("Path to the slides/ directory containing slide-XX.html files."),
    },
    annotations: {
      title: "Validate Slides",
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args) => {
    try {
      const dir = resolve(args.slidesDir);
      const files = await readdir(dir);
      const htmlFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();

      if (htmlFiles.length === 0) {
        return {
          isError: true,
          content: [{ type: "text", text: `No slide HTML files found in ${dir}` }],
        };
      }

      const slideMap = new Map<number, string>();
      for (const file of htmlFiles) {
        const num = parseInt(file.match(/\d+/)?.[0] ?? "0", 10);
        const html = await readTextFile(join(dir, file));
        slideMap.set(num, html);
      }

      const validation = validateAllSlides(slideMap);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                slidesDir: dir,
                slidesChecked: slideMap.size,
                allPassed: validation.allPassed,
                highIssues: validation.highCount,
                mediumIssues: validation.mediumCount,
                lowIssues: validation.lowCount,
                details: validation.reports.flatMap((r) =>
                  r.results
                    .filter((v) => !v.passed)
                    .map((v) => ({
                      slide: r.slideNumber,
                      rule: v.rule,
                      severity: v.severity,
                      detail: v.detail,
                    })),
                ),
                passedRulesSummary: validation.reports.map((r) => ({
                  slide: r.slideNumber,
                  passed: r.results.filter((v) => v.passed).length,
                  failed: r.results.filter((v) => !v.passed).length,
                  total: r.results.length,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Validation failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ─── Tool: save_qa_report ───────────────────────────────────────────────────

server.registerTool(
  "save_qa_report",
  {
    title: "Save QA Report",
    description:
      "Validates and saves a QA review report. The agent produces this after reviewing " +
      "auto-validation results and manually checking facts, layout, and design rules.",
    inputSchema: {
      data: z.string().describe("JSON string of the QA report."),
      outputDir: z.string().default("./output").describe("Base output directory."),
      topic: z.string().default("untitled").describe("Topic name for subfolder."),
    },
    annotations: {
      title: "Save QA Report",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args) => {
    try {
      const parsed = JSON.parse(args.data);
      const validated = QAReport.parse(parsed);

      const outDir = resolveOutputDir(args.outputDir, args.topic);
      await ensureDir(outDir);

      const filePath = join(outDir, "qa-report.json");
      await writeJsonFile(filePath, validated);

      const highIssues = validated.issues.filter((i) => i.severity === "high").length;
      const mediumIssues = validated.issues.filter((i) => i.severity === "medium").length;
      const lowIssues = validated.issues.filter((i) => i.severity === "low").length;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                file: filePath,
                verdict: validated.overallVerdict,
                passedAutoChecks: validated.passedAutoChecks,
                issues: { high: highIssues, medium: mediumIssues, low: lowIssues },
                totalIssues: validated.issues.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `QA report save failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ─── Tool: generate_presentation ────────────────────────────────────────────

server.registerTool(
  "generate_presentation",
  {
    title: "Generate Presentation Viewer",
    description:
      "Generates a standalone presentation.html from a slides directory. " +
      "Shows all slides in a carousel with keyboard/touch navigation and HTML↔PNG toggle. " +
      "Automatically called after render_pngs, but can also be called independently.",
    inputSchema: {
      slidesDir: z
        .string()
        .describe(
          "Path to the slides/ directory containing slide-XX.html (and optionally .png) files.",
        ),
    },
    annotations: {
      title: "Generate Presentation",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args) => {
    try {
      const dir = resolve(args.slidesDir);
      const presentationPath = await buildPresentation(dir);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, presentation: presentationPath }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Presentation generation failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const outputDirCache = new Map<string, string>();

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Resolve (and cache) a stable output directory for a given topic.
 * Uses a timestamp + slug, but reuses the same dir within one session.
 */
function resolveOutputDir(baseOutput: string, topic: string): string {
  const key = `${baseOutput}::${topic}`;
  const cached = outputDirCache.get(key);
  if (cached) return cached;

  const slug = slugify(topic);
  const iso = new Date().toISOString();
  const ts = `${iso.slice(0, 10)}_${iso.slice(11, 19).replace(/:/g, "-")}`;
  const dir = resolve(baseOutput, `${ts}_${slug}`);
  outputDirCache.set(key, dir);
  return dir;
}

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
