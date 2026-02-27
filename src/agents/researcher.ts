import type { PipelineContext } from "../pipeline/context.js";
import { ResearchOutput } from "../pipeline/types.js";
import { BaseAgent } from "./base-agent.js";

/**
 * Researcher Agent
 * Responsibility: Research ONLY. No content planning, no copy writing.
 * Input: Topic string or markdown file content.
 * Output: Structured research data (facts, statistics, quotes, audience).
 */
export class ResearcherAgent extends BaseAgent<ResearchOutput> {
  readonly name = "researcher";
  readonly description = "Conducts research and gathers facts on the given topic.";

  protected getSystemPrompt(): string {
    return `You are a research specialist. Your ONLY job is to research a topic and produce structured findings.

## RULES
- You ONLY research. You do NOT plan content, write copy, design, or build anything.
- Output ONLY valid JSON matching the schema below. No extra commentary.
- Every fact and statistic MUST include a source when possible.
- Focus on recent, verifiable information.
- Identify the target audience clearly.
- Extract 5-10 key facts, 3-5 statistics, and 2-3 notable quotes.
- Extract 5-10 relevant keywords for the topic.

## OUTPUT SCHEMA (JSON)
{
  "topic": "string — the researched topic",
  "summary": "string — 2-3 paragraph executive summary of findings",
  "keyFacts": [
    { "fact": "string", "source": "string (optional)" }
  ],
  "statistics": [
    { "value": "string (e.g. '73%')", "description": "string", "source": "string (optional)" }
  ],
  "quotes": [
    { "text": "string", "author": "string (optional)" }
  ],
  "targetAudience": "string — who this content is for",
  "keywords": ["string"]
}

## SELF-CHECK before responding:
1. Is every fact specific and verifiable (not vague)?
2. Are statistics accompanied by context?
3. Did I include source attributions where possible?
4. Is the target audience clearly defined?
5. Did I output ONLY the JSON object with no preamble?`;
  }

  protected buildUserMessage(ctx: PipelineContext): string {
    if (ctx.rawResearchContent) {
      return `Research the following topic using the provided notes as a starting point.

Topic: ${ctx.options.topic || "(see notes below)"}

--- PROVIDED NOTES ---
${ctx.rawResearchContent}
--- END NOTES ---

Analyze these notes, extract key facts, statistics, and quotes. Supplement with your knowledge. Output structured research JSON.`;
    }

    return `Research the following topic thoroughly. Gather key facts, statistics, quotes, and identify the target audience.

Topic: ${ctx.options.topic}

Output structured research JSON.`;
  }

  protected parseResponse(responseText: string): ResearchOutput {
    const json = this.extractJson(responseText);
    return ResearchOutput.parse(JSON.parse(json));
  }
}
