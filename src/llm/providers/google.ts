/**
 * Google provider — wraps @google/generative-ai for Gemini models.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProviderName } from "../models.js";
import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig } from "../provider.js";

export class GoogleProvider implements LLMProvider {
  readonly name: ProviderName = "google";
  private client: GoogleGenerativeAI;

  constructor(config: ProviderConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const model = this.client.getGenerativeModel({
      model: request.model,
      systemInstruction: request.system,
      generationConfig: {
        maxOutputTokens: request.maxTokens,
      },
    });

    const contents = request.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const result = await model.generateContent({ contents });
    const response = result.response;

    const text = response.text();

    // Google GenAI provides usage metadata
    const usageMetadata = response.usageMetadata;

    return {
      text,
      tokensUsed: {
        input: usageMetadata?.promptTokenCount ?? 0,
        output: usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
