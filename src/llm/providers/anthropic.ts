/**
 * Anthropic provider — wraps @anthropic-ai/sdk for Claude models.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ProviderName } from "../models.js";
import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from "../provider.js";

export class AnthropicProvider implements LLMProvider {
  readonly name: ProviderName = "anthropic";
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }
}
