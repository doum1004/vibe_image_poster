import { getConfig, getModelForAgent } from "../config.js";
import { resolveModel } from "../llm/models.js";
import { createProviderForModel, type LLMProvider, type LLMResponse } from "../llm/provider.js";
import type { PipelineContext } from "../pipeline/context.js";
import { log } from "../utils/logger.js";

export interface AgentResult<T> {
  output: T;
  tokensUsed: { input: number; output: number };
  /** Which model was actually used for this agent run */
  model: string;
}

/**
 * BaseAgent — shared abstraction for all 5 agents in the pipeline.
 * Each agent subclass defines its own system prompt (the "skill"),
 * input extraction, and output parsing.
 *
 * The agent is provider-agnostic. Model resolution:
 *   1. Per-agent env var override (e.g., DEVELOPER_MODEL)
 *   2. Pipeline-level --model flag
 *   3. Config default (LLM_MODEL / CLAUDE_MODEL)
 */
export abstract class BaseAgent<TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;

  /** Cached provider instance per resolved model */
  private _provider: LLMProvider | null = null;
  private _resolvedModelId: string | null = null;

  /**
   * The system prompt that defines this agent's "skill".
   * Should be ~150 lines max for token efficiency.
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Build the user message from the pipeline context.
   */
  protected abstract buildUserMessage(ctx: PipelineContext): string;

  /**
   * Parse the raw LLM response text into the typed output.
   */
  protected abstract parseResponse(responseText: string): TOutput;

  /**
   * Get (or create) the LLM provider for this agent run.
   */
  private async getProvider(pipelineModel?: string): Promise<{
    provider: LLMProvider;
    modelId: string;
    maxOutputTokens: number;
  }> {
    const config = getConfig();
    const modelAlias = getModelForAgent(this.name, pipelineModel);
    const resolved = resolveModel(modelAlias);

    // Reuse cached provider if the model hasn't changed
    if (this._provider && this._resolvedModelId === resolved.modelId) {
      return {
        provider: this._provider,
        modelId: resolved.modelId,
        maxOutputTokens: resolved.maxOutputTokens,
      };
    }

    const provider = await createProviderForModel(
      resolved,
      {
        anthropicApiKey: config.anthropicApiKey,
        openaiApiKey: config.openaiApiKey,
        googleApiKey: config.googleApiKey,
      },
      config.llmBaseUrl,
    );

    this._provider = provider;
    this._resolvedModelId = resolved.modelId;

    return {
      provider,
      modelId: resolved.modelId,
      maxOutputTokens: resolved.maxOutputTokens,
    };
  }

  /**
   * Execute this agent against the pipeline context.
   *
   * @param ctx - The pipeline context with accumulated data from previous stages.
   * @param pipelineModel - Optional model override from --model CLI flag.
   */
  async run(ctx: PipelineContext, pipelineModel?: string): Promise<AgentResult<TOutput>> {
    log.group(`Agent: ${this.name}`);
    log.info(this.description);

    const { provider, modelId, maxOutputTokens } = await this.getProvider(pipelineModel);

    log.debug(`Provider: ${provider.name}, Model: ${modelId}`);

    const systemPrompt = this.getSystemPrompt();
    const userMessage = this.buildUserMessage(ctx);

    log.debug(`System prompt: ${systemPrompt.length} chars`);
    log.debug(`User message: ${userMessage.length} chars`);

    try {
      const response: LLMResponse = await provider.chat({
        model: modelId,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: maxOutputTokens,
      });

      log.debug(
        `Response: ${response.text.length} chars, ` +
          `tokens: ${response.tokensUsed.input}in/${response.tokensUsed.output}out`,
      );

      const output = this.parseResponse(response.text);

      log.success(`${this.name} completed`);
      log.groupEnd();

      return {
        output,
        tokensUsed: response.tokensUsed,
        model: modelId,
      };
    } catch (err) {
      log.groupEnd();
      throw err;
    }
  }

  /**
   * Helper: extract JSON from a response that may contain markdown code fences.
   */
  protected extractJson(text: string): string {
    // Strip leading/trailing whitespace
    let cleaned = text.trim();

    // Remove outer code fence if present (greedy — handles nested backticks in HTML)
    const fenceMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*)\n```\s*$/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    // Try to find the outermost JSON object or array
    const firstBrace = cleaned.indexOf("{");
    const firstBracket = cleaned.indexOf("[");
    let start = -1;
    let open = "{";
    let close = "}";

    if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
      start = firstBrace;
      open = "{";
      close = "}";
    } else if (firstBracket >= 0) {
      start = firstBracket;
      open = "[";
      close = "]";
    }

    if (start >= 0) {
      // Walk forward to find the matching closing brace/bracket,
      // respecting strings so that braces inside HTML strings are skipped.
      let depth = 0;
      let inString = false;
      let isEscaped = false;

      for (let i = start; i < cleaned.length; i++) {
        const ch = cleaned[i];

        if (isEscaped) {
          isEscaped = false;
          continue;
        }

        if (ch === "\\") {
          if (inString) isEscaped = true;
          continue;
        }

        if (ch === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (ch === open) depth++;
          else if (ch === close) {
            depth--;
            if (depth === 0) {
              return cleaned.substring(start, i + 1);
            }
          }
        }
      }
    }

    return cleaned;
  }
}
