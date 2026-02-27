import { getPatternListForPrompt } from "../design-system/shared/patterns.js";
import type { PipelineContext } from "../pipeline/context.js";
import { DesignBriefOutput } from "../pipeline/types.js";
import { BaseAgent } from "./base-agent.js";

/**
 * Designer Agent
 * Responsibility: Visual direction ONLY. Selects layout patterns, color scheme.
 * Does NOT write copy. Does NOT code HTML.
 */
export class DesignerAgent extends BaseAgent<DesignBriefOutput> {
  readonly name = "designer";
  readonly description = "Creates visual direction and selects layout patterns.";

  protected getSystemPrompt(): string {
    return `You are a visual designer for card news (Instagram 1080x1440px). Your ONLY job is to select layout patterns and define the color direction for each slide.

## RULES
- You design ONLY. You do NOT write copy, code HTML, or do QA.
- Output ONLY valid JSON. No extra commentary.
- Select ONE layout pattern per slide from the catalog below.
- NEVER use the same pattern on 2 consecutive slides.
- Ensure visual variety across the series.
- The color palette should be cohesive and appropriate for the topic.
- Use hex color codes (e.g., #2563EB).

## PATTERN CATALOG
${getPatternListForPrompt()}

## PATTERN RULES
- Cover slide: Use a pattern from "intro" category (intro-cover).
- CTA slide: Use a pattern from "intro" category (intro-cta).
- Body slides: Choose from any non-intro category. Vary categories.
- No same pattern 2 slides in a row.
- Balance information-heavy and emphasis patterns.

## COLOR DIRECTION
- Choose a primary color that fits the topic mood.
- Accent color should contrast with primary for emphasis elements.
- Background should be light for readability (unless doing dark theme).
- Text color should ensure high contrast against background.

## OUTPUT SCHEMA (JSON)
{
  "seriesTheme": "string — theme name being used",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex"
  },
  "slides": [
    {
      "slideNumber": number,
      "layoutPattern": "string — pattern ID from catalog",
      "primaryColor": "#hex (optional — per-slide override)",
      "secondaryColor": "#hex (optional)",
      "backgroundColor": "#hex (optional — per-slide override)",
      "notes": "string (optional) — visual direction notes"
    }
  ]
}

## SELF-CHECK before responding:
1. Is every layoutPattern a valid ID from the catalog?
2. No same pattern on consecutive slides?
3. Cover uses intro-cover, CTA uses intro-cta?
4. Does the color palette feel cohesive?
5. Did I output ONLY the JSON object?`;
  }

  protected buildUserMessage(ctx: PipelineContext): string {
    const plan = ctx.requirePlan();
    const research = ctx.requireResearch();

    return `Design the visual direction for this ${plan.totalSlides}-slide card news series.

Series Theme: ${ctx.options.series}
Topic: ${research.topic}
Target Audience: ${research.targetAudience}

--- SLIDE PLAN ---
${plan.slides
  .map(
    (s) =>
      `  Slide ${s.slideNumber} [${s.role}] (${s.emotionPhase}, temp=${s.emotionTemperature}): ${s.purpose}`,
  )
  .join("\n")}

Select layout patterns and define the color direction. Output the design brief JSON.`;
  }

  protected parseResponse(responseText: string): DesignBriefOutput {
    const json = this.extractJson(responseText);
    return DesignBriefOutput.parse(JSON.parse(json));
  }
}
