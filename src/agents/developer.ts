import { getPatternById } from "../design-system/shared/patterns.js";
import type { PipelineContext } from "../pipeline/context.js";
import { DeveloperOutput } from "../pipeline/types.js";
import { BaseAgent } from "./base-agent.js";

type DeveloperOutputType = typeof DeveloperOutput._output;

/**
 * Developer Agent
 * Responsibility: HTML/CSS build ONLY. Translates copy + design brief into standalone HTML.
 * Generates reusable template HTML with data-bind attributes.
 * Does NOT plan content, write copy, or do QA.
 */
export class DeveloperAgent extends BaseAgent<DeveloperOutputType> {
  readonly name = "developer";
  readonly description = "Builds standalone HTML template slides from copy and design brief.";

  protected getSystemPrompt(): string {
    return `You are a frontend developer. Your ONLY job is to produce standalone HTML slides.

## RULES
- You code ONLY. You do NOT plan, write copy, design, or do QA.
- Output ONLY valid JSON with HTML strings. No extra commentary.
- Each slide is a self-contained HTML file. No external dependencies.
- Canvas: exactly 1080px wide x 1440px tall. Keep all content inside a safe area (leave ~32-40px breathing room inside the edges; avoid pushing content flush to edges).
- All CSS is inline in <style> tags. No external stylesheets or CDN links.
- No external images. If images are needed, use CSS shapes, gradients, or emojis.
- Use Korean web font stack: 'Pretendard', 'Noto Sans KR', sans-serif.
- word-break: keep-all on body (Korean text rule).
- overflow: hidden on html, body, and .card. Avoid vertical overflow: do not stack large blocks (e.g., two tall cards + long bullet list) without reducing sizes/gaps.
- Every slide MUST have a .bottom-bar element at the bottom.

## DESIGN TOKEN USAGE
- Use CSS custom properties (var(--token)) for ALL values.
- Never hardcode colors, sizes, or spacing directly.
- Include all token definitions in each HTML file (standalone requirement).
- Override tokens per-slide based on the design brief's color direction.

## MINIMUM FONT SIZE
- No font smaller than 28px anywhere. This is non-negotiable.
- Prefer scaling down headings, big numbers, padding, and gutters when bullets or multiple stat blocks appear to prevent overflow.

## EMPHASIS RULES
- Max 2 elements with class "accent" per slide.
- Max 1 <strong> per slide.
- Never nest accent inside strong.

## DATA BINDING (CRITICAL — TEMPLATE REUSE)
Every content element MUST have a data-bind attribute matching its copy.json field name.
This enables users to update copy.json and re-render slides without AI.

Supported data-bind values:
  heading     — on the heading element (e.g., <h1 data-bind="heading">...</h1>)
  subheading  — on the subheading element
  body        — on the body text container (e.g., <p data-bind="body">...</p>)
  bullets     — on the <ul> or <ol> list wrapper
  bullet      — on each <li> inside the bullet list
  accentText  — on the accent/highlight element
  footnote    — on the footnote element
  ctaText     — on the CTA button or text element

Rules:
- The actual copy text MUST be present as the element's visible text content. Never leave empty placeholders.
- Every slide MUST use these data-bind attributes on the corresponding content elements.
- Example: <h1 data-bind="heading">AI 시대의 생산성 혁명</h1>
- For bullet lists:
    <ul data-bind="bullets">
      <li data-bind="bullet">첫 번째 항목</li>
      <li data-bind="bullet">두 번째 항목</li>
    </ul>

## HTML STRUCTURE
Each HTML file must follow this structure:
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    /* Design tokens */
    :root { ... }
    /* Base styles */
    ...
    /* Slide-specific styles */
    ...
  </style>
</head>
<body>
  <div class="card">
    <div class="card-content">
      <!-- Slide content with data-bind attributes -->
    </div>
    <div class="bottom-bar">@series_name</div>
  </div>
</body>
</html>

## OUTPUT SCHEMA (JSON)
{
  "slides": [
    {
      "slideNumber": number,
      "html": "string -- complete standalone HTML with data-bind attributes"
    }
  ]
}

## SELF-CHECK before responding:
1. Is every HTML file standalone (no external deps)?
2. Does every file set 1080x1440 canvas with overflow:hidden?
3. Does every file include word-break:keep-all?
4. Is every font >= 28px?
5. Does every slide have a .bottom-bar?
6. Are all colors/sizes using CSS variables?
7. Max 2 .accent, max 1 strong per slide?
8. Does every content element have the correct data-bind attribute?
9. Did I output ONLY the JSON object?`;
  }

  protected buildUserMessage(ctx: PipelineContext): string {
    const copy = ctx.requireCopy();
    const design = ctx.requireDesignBrief();
    const plan = ctx.requirePlan();

    const slidesInfo = copy.slides.map((c) => {
      const d = design.slides.find((s) => s.slideNumber === c.slideNumber);
      const p = plan.slides.find((s) => s.slideNumber === c.slideNumber);
      const pattern = d ? getPatternById(d.layoutPattern) : null;

      return `
--- Slide ${c.slideNumber} [${c.role}] ---
Layout Pattern: ${d?.layoutPattern || "auto"} (${pattern?.name || "unknown"})
Pattern Structure: ${pattern?.structureHint || "flexible"}
Background: ${d?.backgroundColor || design.colorPalette.background}
Primary Color: ${d?.primaryColor || design.colorPalette.primary}
Secondary Color: ${d?.secondaryColor || design.colorPalette.secondary}
${p?.emotionPhase ? `Emotion Phase: ${p.emotionPhase}` : ""}
${p?.purpose ? `Purpose: ${p.purpose}` : ""}
${c.heading ? `Heading: ${c.heading}` : ""}
${c.subheading ? `Subheading: ${c.subheading}` : ""}
${c.bodyText ? `Body: ${c.bodyText}` : ""}
${c.bulletPoints?.length ? `Bullets:\n${c.bulletPoints.map((b) => `  - ${b}`).join("\n")}` : ""}
${c.accentText ? `Accent: ${c.accentText}` : ""}
${c.footnote ? `Footnote: ${c.footnote}` : ""}
${c.ctaText ? `CTA: ${c.ctaText}` : ""}
${d?.notes ? `Design Notes: ${d.notes}` : ""}`;
    });

    // Build QA feedback section if we have issues from a previous iteration
    let qaFeedback = "";
    if (ctx.qaReport && ctx.qaIteration > 1) {
      const issues = ctx.qaReport.issues.filter(
        (i) => i.severity === "high" || i.severity === "medium",
      );
      if (issues.length > 0) {
        qaFeedback = `\n\n## QA FEEDBACK — FIX THESE ISSUES
The previous HTML had the following problems. Fix them in your output:
${issues.map((i) => `- Slide ${i.slideNumber} [${i.severity}] ${i.category}: ${i.description}${i.suggestion ? ` (Suggestion: ${i.suggestion})` : ""}`).join("\n")}

Re-generate ALL slides, fixing the issues listed above. Keep other aspects unchanged.`;
      }
    }

    // Build auto-validation feedback if available
    let validationFeedback = "";
    if (ctx.autoValidation && !ctx.autoValidation.allPassed) {
      const failures: string[] = [];
      for (const report of ctx.autoValidation.reports) {
        for (const r of report.results) {
          if (!r.passed) {
            failures.push(`- Slide ${report.slideNumber} [${r.severity}] ${r.rule}: ${r.detail}`);
          }
        }
      }
      if (failures.length > 0) {
        validationFeedback = `\n\n## AUTO-VALIDATION FAILURES
The following automated checks failed on the previous output:
${failures.join("\n")}

Ensure these are fixed in your output.`;
      }
    }

    return `Build standalone HTML template slides for this card news series.
IMPORTANT: Every content element MUST have data-bind attributes for template reuse.

Series: ${ctx.options.series}
Color Palette:
  Primary: ${design.colorPalette.primary}
  Secondary: ${design.colorPalette.secondary}
  Accent: ${design.colorPalette.accent}
  Background: ${design.colorPalette.background}
  Text: ${design.colorPalette.text}

Bottom Bar Text: @${ctx.options.series}

${slidesInfo.join("\n")}

Build all ${copy.slides.length} slides as standalone HTML with data-bind attributes. Output the JSON.${qaFeedback}${validationFeedback}`;
  }

  protected parseResponse(responseText: string): DeveloperOutputType {
    const json = this.extractJson(responseText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      // The LLM often returns JSON with literal newlines inside string values
      // (invalid JSON). Fix by escaping unescaped newlines within strings.
      let fixed = "";
      let inStr = false;
      let esc = false;

      for (let i = 0; i < json.length; i++) {
        const ch = json[i];

        if (esc) {
          fixed += ch;
          esc = false;
          continue;
        }

        if (ch === "\\" && inStr) {
          fixed += ch;
          esc = true;
          continue;
        }

        if (ch === '"') {
          inStr = !inStr;
          fixed += ch;
          continue;
        }

        if (inStr && ch === "\n") {
          fixed += "\\n";
          continue;
        }

        if (inStr && ch === "\r") {
          fixed += "\\r";
          continue;
        }

        if (inStr && ch === "\t") {
          fixed += "\\t";
          continue;
        }

        fixed += ch;
      }

      try {
        parsed = JSON.parse(fixed);
      } catch (e2) {
        const preview = json.substring(0, 500);
        throw new Error(
          `Failed to parse developer JSON: ${(e2 as Error).message}\nExtracted JSON preview:\n${preview}`,
        );
      }
    }

    // Validate with Zod schema
    return DeveloperOutput.parse(parsed);
  }
}

// Re-export for external usage
export type { DeveloperOutputType as DeveloperOutput };
