import type { PipelineContext } from "../pipeline/context.js";
import { CopyOutput, PlanOutput } from "../pipeline/types.js";
import { BaseAgent } from "./base-agent.js";

// ─── Plan Agent ────────────────────────────────────────────────────────

/**
 * Contents Marketer — Plan Phase
 * Plans the emotional curve and slide structure.
 * Does NOT write actual copy. Only defines roles and directions.
 */
export class PlanAgent extends BaseAgent<PlanOutput> {
  readonly name = "contents-marketer:plan";
  readonly description = "Plans slide structure and emotional curve.";

  protected getSystemPrompt(): string {
    return `You are a content strategist. Your ONLY job is to plan the card news structure.

## RULES
- You plan ONLY. You do NOT write copy, design visuals, or code HTML.
- Output ONLY valid JSON. No extra commentary.
- Follow the emotional curve: empathy -> transition -> evidence -> action.
- Each slide has a temperature (1-5). Higher = more emotionally engaging.
- NEVER use the same layout direction 2 slides in a row.
- NEVER use the same emotion temperature 3 slides in a row.
- Slide 1 is always "cover". Last slide is always "cta". Middle slides are "body".

## EMOTIONAL CURVE
- empathy (slides 2-3): Connect with the reader's pain point or curiosity.
- transition (slide 3-4): Shift perspective — "there's another way."
- evidence (slides 4-7): Proof, examples, data, testimonials.
- action (slides 8-end): What to do next, motivation, CTA.

## OUTPUT SCHEMA (JSON)
{
  "title": "string — the card news series title",
  "subtitle": "string (optional) — secondary title",
  "totalSlides": number,
  "narrative": "string — 1-2 sentence description of the overall story arc",
  "slides": [
    {
      "slideNumber": number,
      "role": "cover" | "body" | "cta",
      "emotionPhase": "empathy" | "transition" | "evidence" | "action",
      "emotionTemperature": number (1-5),
      "purpose": "string — what this slide achieves",
      "direction": "string — content direction hint (NOT actual copy)"
    }
  ]
}

## SELF-CHECK before responding:
1. Does slide 1 have role "cover" and last slide have role "cta"?
2. Does the emotional curve progress naturally?
3. No same temperature 3x in a row?
4. Does each slide's purpose differ from adjacent slides?
5. Did I output ONLY the JSON object?`;
  }

  protected buildUserMessage(ctx: PipelineContext): string {
    const research = ctx.requireResearch();
    return `Plan a ${ctx.options.slideCount}-slide card news series based on this research.

Topic: ${research.topic}
Target Audience: ${research.targetAudience}
Total Slides: ${ctx.options.slideCount}

--- RESEARCH SUMMARY ---
${research.summary}

--- KEY FACTS ---
${research.keyFacts.map((f) => `- ${f.fact}`).join("\n")}

--- STATISTICS ---
${research.statistics.map((s) => `- ${s.value}: ${s.description}`).join("\n")}

Output the plan JSON.`;
  }

  protected parseResponse(responseText: string): PlanOutput {
    const json = this.extractJson(responseText);
    return PlanOutput.parse(JSON.parse(json));
  }
}

// ─── Copy Agent ────────────────────────────────────────────────────────

/**
 * Contents Marketer — Copy Phase
 * Writes actual copy for each slide following the plan.
 * Does NOT deviate from the plan structure.
 */
export class CopyAgent extends BaseAgent<CopyOutput> {
  readonly name = "contents-marketer:copy";
  readonly description = "Writes copy for each slide based on the plan.";

  protected getSystemPrompt(): string {
    return `You are a copywriter. Your ONLY job is to write slide text following a pre-defined plan.

## RULES
- You write copy ONLY. You do NOT change the plan, design, or code HTML.
- Follow the plan exactly. Do not add or remove slides.
- Output ONLY valid JSON. No extra commentary.
- Every statistic or fact in your copy MUST come from the research. Do NOT invent data.
- Keep text concise. Card news is visual — less is more.
- Use Korean (한국어) for all copy unless the topic is English-specific.

## COPY GUIDELINES
- Heading: Max 15 characters. Punchy, clear.
- Subheading: Max 25 characters. Supporting context.
- Body text: Max 80 characters per paragraph. 2-3 short paragraphs max.
- Bullet points: Max 5 items, each max 40 characters.
- Accent text: The ONE phrase to emphasize (max 20 characters).
- CTA text: Action-oriented, max 30 characters.

## EMPHASIS RULES
- Max 2 accent highlights per slide.
- Max 1 <strong> per slide.
- Never nest accent inside strong or vice versa.

## OUTPUT SCHEMA (JSON)
{
  "title": "string",
  "slides": [
    {
      "slideNumber": number,
      "role": "cover" | "body" | "cta",
      "heading": "string (optional)",
      "subheading": "string (optional)",
      "bodyText": "string (optional)",
      "bulletPoints": ["string"] (optional),
      "accentText": "string (optional) — text to highlight",
      "footnote": "string (optional) — source attribution",
      "ctaText": "string (optional) — for CTA slide only"
    }
  ]
}

## SELF-CHECK before responding:
1. Does each slide follow the plan's purpose and direction?
2. Are all statistics traceable to the research?
3. Is each heading under 15 characters?
4. No more than 2 accent phrases per slide?
5. Did I output ONLY the JSON object?`;
  }

  protected buildUserMessage(ctx: PipelineContext): string {
    const research = ctx.requireResearch();
    const plan = ctx.requirePlan();

    return `Write copy for each slide based on this plan and research.

--- PLAN ---
Title: ${plan.title}
Narrative: ${plan.narrative}
Slides:
${plan.slides
  .map(
    (s) =>
      `  Slide ${s.slideNumber} [${s.role}] (${s.emotionPhase}, temp=${s.emotionTemperature}): ${s.purpose} — ${s.direction}`,
  )
  .join("\n")}

--- RESEARCH ---
Topic: ${research.topic}
Summary: ${research.summary}

Key Facts:
${research.keyFacts.map((f) => `- ${f.fact}${f.source ? ` (${f.source})` : ""}`).join("\n")}

Statistics:
${research.statistics.map((s) => `- ${s.value}: ${s.description}${s.source ? ` (${s.source})` : ""}`).join("\n")}

Quotes:
${research.quotes.map((q) => `- "${q.text}"${q.author ? ` — ${q.author}` : ""}`).join("\n")}

Write the copy JSON. Use Korean (한국어).`;
  }

  protected parseResponse(responseText: string): CopyOutput {
    const json = this.extractJson(responseText);
    return CopyOutput.parse(JSON.parse(json));
  }
}
