/**
 * LLM Provider abstraction layer.
 *
 * Defines a common interface for all LLM providers (Anthropic, OpenAI, Google)
 * and a factory function that creates the right provider based on model resolution.
 */

import type { ProviderName, ResolvedModel } from "./models.js";

// ─── Common Types ───────────────────────────────────────────────────────────

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  /** Actual model ID to send to the API (e.g., "claude-sonnet-4-5-20250929") */
  model: string;
  /** System prompt */
  system: string;
  /** Conversation messages */
  messages: LLMMessage[];
  /** Max tokens for the response */
  maxTokens: number;
}

export interface LLMResponse {
  /** Extracted text response */
  text: string;
  /** Token usage */
  tokensUsed: { input: number; output: number };
}

/**
 * Common interface that every LLM provider must implement.
 */
export interface LLMProvider {
  /** Provider identifier (e.g., "anthropic", "openai") */
  readonly name: ProviderName;
  /** Send a chat request and get a response */
  chat(request: LLMRequest): Promise<LLMResponse>;
}

// ─── Provider Config ────────────────────────────────────────────────────────

export interface ProviderConfig {
  /** API key for the provider */
  apiKey: string;
  /** Optional base URL override (for LiteLLM proxy, custom endpoints) */
  baseUrl?: string;
}

// ─── Provider Factory ───────────────────────────────────────────────────────

/**
 * Cache of created provider instances.
 * Keyed by `${providerName}:${apiKey}:${baseUrl}` to reuse clients.
 */
const providerCache = new Map<string, LLMProvider>();

/**
 * Create (or retrieve cached) an LLM provider for the given provider name.
 *
 * Lazy-imports the provider implementation to avoid loading all SDKs upfront.
 */
export async function createProvider(
  providerName: ProviderName,
  config: ProviderConfig,
): Promise<LLMProvider> {
  const cacheKey = `${providerName}:${config.apiKey.slice(0, 8)}:${config.baseUrl ?? "default"}`;

  const cached = providerCache.get(cacheKey);
  if (cached) return cached;

  let provider: LLMProvider;

  switch (providerName) {
    case "anthropic": {
      const { AnthropicProvider } = await import("./providers/anthropic.js");
      provider = new AnthropicProvider(config);
      break;
    }
    case "openai":
    case "openai-compatible": {
      const { OpenAIProvider } = await import("./providers/openai.js");
      provider = new OpenAIProvider(config, providerName);
      break;
    }
    case "google": {
      const { GoogleProvider } = await import("./providers/google.js");
      provider = new GoogleProvider(config);
      break;
    }
    default: {
      const _exhaustive: never = providerName;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }

  providerCache.set(cacheKey, provider);
  return provider;
}

/**
 * Clear the provider cache. Useful for testing.
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

// ─── Helper: Get API key for a provider from config ─────────────────────────

export interface MultiProviderKeys {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
}

/**
 * Look up the correct API key for a given provider.
 * Throws a descriptive error if the key is not configured.
 */
export function getApiKeyForProvider(provider: ProviderName, keys: MultiProviderKeys): string {
  switch (provider) {
    case "anthropic": {
      if (!keys.anthropicApiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is required for Anthropic models. " +
            "Set it in your .env file or environment.",
        );
      }
      return keys.anthropicApiKey;
    }
    case "openai":
    case "openai-compatible": {
      if (!keys.openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY is required for OpenAI / OpenAI-compatible models. " +
            "Set it in your .env file or environment.",
        );
      }
      return keys.openaiApiKey;
    }
    case "google": {
      if (!keys.googleApiKey) {
        throw new Error(
          "GOOGLE_API_KEY is required for Google Gemini models. " +
            "Set it in your .env file or environment.",
        );
      }
      return keys.googleApiKey;
    }
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

// ─── Convenience: Resolve + Create in one step ──────────────────────────────

/**
 * Given a resolved model and the set of API keys, create the appropriate provider.
 */
export async function createProviderForModel(
  resolved: ResolvedModel,
  keys: MultiProviderKeys,
  baseUrl?: string,
): Promise<LLMProvider> {
  const apiKey = getApiKeyForProvider(resolved.provider, keys);
  return createProvider(resolved.provider, { apiKey, baseUrl });
}
