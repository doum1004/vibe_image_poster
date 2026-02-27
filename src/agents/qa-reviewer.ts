import type { PipelineContext } from "../pipeline/context.js";
import { QAReport } from "../pipeline/types.js";
import { BaseAgent } from "./base-agent.js";

/**
 * QA Reviewer Agent
 * Responsibility: READ-ONLY validation. Cannot write or modify any files.
 * Checks facts against research, validates layout rules, emphasis limits.
 */
export class QAReviewerAgent extends BaseAgent<QAReport> {
  readonly name = "qa-reviewer";
  readonly description = "Reviews slides for factual accuracy and design rule compliance.";

  protected getSystemPrompt(): string {
    return `You are a QA reviewer for card news slides. Your ONLY job is to find issues.

## RULES
- You review ONLY. You do NOT write copy, design, code, or fix anything.
- You have NO write access. You can only report issues.
- Output ONLY valid JSON. No extra commentary.

## WHAT YOU CHECK

### Factual Accuracy (HIGH severity)
- Every statistic in slides MUST exist in the research data.
- Every fact MUST be traceable to the research.
- No invented or hallucinated data.

### Layout Rules (HIGH severity)
- Canvas must be 1080x1440px (check HTML for width/height).
- overflow:hidden must be present on html/body/.card.
- word-break:keep-all must be present.
- No font size below 28px.
- No external URLs (http://, https://, CDN links).

### Design Rules (MEDIUM severity)
- Every slide must have a .bottom-bar element.
- Max 2 .accent elements per slide.
- Max 1 <strong> per slide.
- No nested accent inside strong.
- All colors should use CSS variables (no hardcoded hex in HTML elements).
- Same layout pattern not used on 2 consecutive slides.

### Content Rules (LOW severity)
- Same emotion temperature not 3 slides in a row.
- Text should not feel truncated or incomplete.

## SEVERITY LEVELS
- high: Factual errors, layout overflow, missing critical elements. MUST fix.
- medium: Design rule violations, emphasis overuse. SHOULD fix.
- low: Minor style issues, suggestions. NICE to fix.

## OUTPUT SCHEMA (JSON)
{
  "passedAutoChecks": boolean,
  "autoCheckResults": [
    { "rule": "string", "passed": boolean, "detail": "string (optional)" }
  ],
  "issues": [
    {
      "slideNumber": number,
      "severity": "high" | "medium" | "low",
      "category": "string (e.g., 'fact-check', 'layout', 'emphasis', 'design')",
      "description": "string — what is wrong",
      "suggestion": "string (optional) — how to fix it"
    }
  ],
  "overallVerdict": "pass" | "needs_revision"
}

## VERDICT RULES
- "pass" ONLY if there are zero high and zero medium issues.
- "needs_revision" if any high or medium issue exists.

## SELF-CHECK before responding:
1. Did I check every statistic against the research?
2. Did I verify layout rules for each slide?
3. Did I count .accent and <strong> in each slide?
4. Is the severity correctly assigned?
5. Did I output ONLY the JSON object?`;
  }

  protected buildUserMessage(ctx: PipelineContext): string {
    const research = ctx.requireResearch();
    const copy = ctx.requireCopy();
    const plan = ctx.requirePlan();

    // Collect all HTML slides
    const htmlSlides: string[] = [];
    for (const [num, html] of ctx.htmlSlides.entries()) {
      htmlSlides.push(`\n--- SLIDE ${num} HTML (first 2000 chars) ---\n${html.slice(0, 2000)}`);
    }

    return `Review this card news series for issues.

--- RESEARCH (source of truth for facts) ---
Topic: ${research.topic}
Key Facts:
${research.keyFacts.map((f) => `- ${f.fact}${f.source ? ` (${f.source})` : ""}`).join("\n")}

Statistics:
${research.statistics.map((s) => `- ${s.value}: ${s.description}${s.source ? ` (${s.source})` : ""}`).join("\n")}

--- PLAN (emotion temperatures) ---
${plan.slides.map((s) => `Slide ${s.slideNumber}: temp=${s.emotionTemperature}, pattern direction: ${s.direction}`).join("\n")}

--- COPY ---
${copy.slides.map((s) => `Slide ${s.slideNumber} [${s.role}]: heading="${s.heading || ""}" body="${(s.bodyText || "").slice(0, 100)}" accent="${s.accentText || ""}"`).join("\n")}

--- HTML SLIDES ---
${htmlSlides.join("\n")}

Review all slides and output the QA report JSON.`;
  }

  protected parseResponse(responseText: string): QAReport {
    const json = this.extractJson(responseText);
    return QAReport.parse(JSON.parse(json));
  }
}
