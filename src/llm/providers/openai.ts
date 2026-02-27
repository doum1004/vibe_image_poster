/**
 * OpenAI provider — wraps the openai SDK for GPT/o-series models.
 * Also serves as the "openai-compatible" provider for LiteLLM proxy,
 * Ollama, vLLM, or any OpenAI-compatible endpoint via baseURL override.
 */

import OpenAI from "openai";
import type { ProviderName } from "../models.js";
import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from "../provider.js";

export class OpenAIProvider implements LLMProvider {
  readonly name: ProviderName;
  private client: OpenAI;

  constructor(config: ProviderConfig, providerName: ProviderName = "openai") {
    this.name = providerName;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      max_completion_tokens: request.maxTokens,
      messages: [
        { role: "system", content: request.system },
        ...request.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("OpenAI returned no choices in response");
    }

    const text = choice.message?.content ?? "";

    return {
      text,
      tokensUsed: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}
