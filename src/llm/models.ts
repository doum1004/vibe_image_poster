/**
 * Model Registry — known models with aliases, provider mapping, and context windows.
 *
 * Only real, currently-existing models are registered here.
 * Users can always pass raw model IDs for models not in the registry;
 * they will be routed based on the provider prefix or config.
 */

export type ProviderName = "anthropic" | "openai" | "google" | "openai-compatible";

export interface ModelEntry {
  /** Short alias for CLI/env (e.g., "claude-4.5") */
  alias: string;
  /** Provider that serves this model */
  provider: ProviderName;
  /** Actual API model ID string */
  modelId: string;
  /** Max context window in tokens */
  contextWindow: number;
  /** Default max output tokens */
  maxOutputTokens: number;
  /** Human-readable description */
  description: string;
}

/**
 * Built-in model registry.
 * Keyed by alias for fast lookup.
 */
const MODEL_REGISTRY: ReadonlyMap<string, ModelEntry> = new Map<string, ModelEntry>([
  // --- Anthropic Claude ---
  [
    "claude-sonnet-4.5",
    {
      alias: "claude-sonnet-4.5",
      provider: "anthropic",
      modelId: "claude-sonnet-4-5-20250929",
      contextWindow: 200_000,
      maxOutputTokens: 8_192,
      description: "Claude Sonnet 4.5 — strong all-round, hybrid reasoning",
    },
  ],
  [
    "claude-sonnet-4",
    {
      alias: "claude-sonnet-4",
      provider: "anthropic",
      modelId: "claude-sonnet-4-20250514",
      contextWindow: 200_000,
      maxOutputTokens: 8_192,
      description: "Claude Sonnet 4 — balanced speed and intelligence",
    },
  ],
  [
    "claude-opus-4",
    {
      alias: "claude-opus-4",
      provider: "anthropic",
      modelId: "claude-opus-4-20250918",
      contextWindow: 200_000,
      maxOutputTokens: 32_000,
      description: "Claude Opus 4 — strongest Anthropic model",
    },
  ],
  [
    "claude-haiku-3.5",
    {
      alias: "claude-haiku-3.5",
      provider: "anthropic",
      modelId: "claude-3-5-haiku-20241022",
      contextWindow: 200_000,
      maxOutputTokens: 8_192,
      description: "Claude Haiku 3.5 — fastest, cheapest Anthropic model",
    },
  ],

  // --- OpenAI ---
  [
    "gpt-4o",
    {
      alias: "gpt-4o",
      provider: "openai",
      modelId: "gpt-4o",
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
      description: "GPT-4o — OpenAI flagship multimodal model",
    },
  ],
  [
    "gpt-4o-mini",
    {
      alias: "gpt-4o-mini",
      provider: "openai",
      modelId: "gpt-4o-mini",
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
      description: "GPT-4o Mini — fast and cost-effective",
    },
  ],
  [
    "gpt-4.1",
    {
      alias: "gpt-4.1",
      provider: "openai",
      modelId: "gpt-4.1",
      contextWindow: 1_047_576,
      maxOutputTokens: 32_768,
      description: "GPT-4.1 — flagship with 1M context",
    },
  ],
  [
    "gpt-4.1-mini",
    {
      alias: "gpt-4.1-mini",
      provider: "openai",
      modelId: "gpt-4.1-mini",
      contextWindow: 1_047_576,
      maxOutputTokens: 32_768,
      description: "GPT-4.1 Mini — balanced cost and capability",
    },
  ],
  [
    "gpt-4.1-nano",
    {
      alias: "gpt-4.1-nano",
      provider: "openai",
      modelId: "gpt-4.1-nano",
      contextWindow: 1_047_576,
      maxOutputTokens: 32_768,
      description: "GPT-4.1 Nano — fastest, cheapest OpenAI model",
    },
  ],
  [
    "gpt-5-mini",
    {
      alias: "gpt-5-mini",
      provider: "openai",
      modelId: "gpt-5-mini",
      contextWindow: 400_000,
      maxOutputTokens: 128_000,
      description: "GPT-5 Mini — compact next-gen OpenAI model",
    },
  ],
  [
    "o3",
    {
      alias: "o3",
      provider: "openai",
      modelId: "o3",
      contextWindow: 200_000,
      maxOutputTokens: 100_000,
      description: "o3 — OpenAI reasoning model",
    },
  ],
  [
    "o3-mini",
    {
      alias: "o3-mini",
      provider: "openai",
      modelId: "o3-mini",
      contextWindow: 200_000,
      maxOutputTokens: 100_000,
      description: "o3-mini — cost-efficient reasoning model",
    },
  ],
  [
    "o4-mini",
    {
      alias: "o4-mini",
      provider: "openai",
      modelId: "o4-mini",
      contextWindow: 200_000,
      maxOutputTokens: 100_000,
      description: "o4-mini — latest compact reasoning model",
    },
  ],

  // --- Google Gemini ---
  [
    "gemini-2.5-pro",
    {
      alias: "gemini-2.5-pro",
      provider: "google",
      modelId: "gemini-2.5-pro-preview-06-05",
      contextWindow: 1_048_576,
      maxOutputTokens: 65_536,
      description: "Gemini 2.5 Pro — Google's strongest model",
    },
  ],
  [
    "gemini-2.5-flash",
    {
      alias: "gemini-2.5-flash",
      provider: "google",
      modelId: "gemini-2.5-flash-preview-05-20",
      contextWindow: 1_048_576,
      maxOutputTokens: 65_536,
      description: "Gemini 2.5 Flash — fast and adaptive thinking",
    },
  ],
  [
    "gemini-2.0-flash",
    {
      alias: "gemini-2.0-flash",
      provider: "google",
      modelId: "gemini-2.0-flash",
      contextWindow: 1_048_576,
      maxOutputTokens: 8_192,
      description: "Gemini 2.0 Flash — workhorse model",
    },
  ],
]);

/**
 * Provider detection heuristics for raw model IDs (not in registry).
 * Order matters — first match wins.
 */
const PROVIDER_PREFIXES: ReadonlyArray<{ pattern: RegExp; provider: ProviderName }> = [
  { pattern: /^claude-/i, provider: "anthropic" },
  { pattern: /^gpt-/i, provider: "openai" },
  { pattern: /^o[1-9]/i, provider: "openai" },
  { pattern: /^gemini-/i, provider: "google" },
  // LiteLLM-style prefixes
  { pattern: /^anthropic\//i, provider: "anthropic" },
  { pattern: /^openai\//i, provider: "openai" },
  { pattern: /^google\//i, provider: "google" },
  { pattern: /^vertex_ai\//i, provider: "google" },
];

export interface ResolvedModel {
  /** The alias if found in registry, otherwise the raw input */
  alias: string;
  /** Provider to use */
  provider: ProviderName;
  /** Actual model ID to send to the API */
  modelId: string;
  /** Max output tokens (from registry or default) */
  maxOutputTokens: number;
  /** Whether this came from the registry */
  fromRegistry: boolean;
}

/**
 * Resolve a model alias or raw model ID to a full model descriptor.
 *
 * Resolution order:
 *   1. Exact alias match in registry
 *   2. Match by modelId in registry (in case user passes full model ID)
 *   3. Detect provider from name heuristics
 *   4. Fall back to "openai-compatible" provider (for LiteLLM proxy, etc.)
 *
 * @param aliasOrId - Model alias (e.g., "claude-4.5") or raw model ID
 * @param providerOverride - Force a specific provider (e.g., for LiteLLM proxy)
 */
export function resolveModel(aliasOrId: string, providerOverride?: ProviderName): ResolvedModel {
  // 1. Exact alias match
  const byAlias = MODEL_REGISTRY.get(aliasOrId);
  if (byAlias) {
    return {
      alias: byAlias.alias,
      provider: providerOverride ?? byAlias.provider,
      modelId: byAlias.modelId,
      maxOutputTokens: byAlias.maxOutputTokens,
      fromRegistry: true,
    };
  }

  // 2. Match by modelId
  for (const entry of MODEL_REGISTRY.values()) {
    if (entry.modelId === aliasOrId) {
      return {
        alias: entry.alias,
        provider: providerOverride ?? entry.provider,
        modelId: entry.modelId,
        maxOutputTokens: entry.maxOutputTokens,
        fromRegistry: true,
      };
    }
  }

  // 3. Detect provider from name
  let detectedProvider: ProviderName = "openai-compatible";
  let modelId = aliasOrId;

  for (const { pattern, provider } of PROVIDER_PREFIXES) {
    if (pattern.test(aliasOrId)) {
      detectedProvider = provider;
      // Strip LiteLLM-style prefix (e.g., "anthropic/claude-..." → "claude-...")
      if (aliasOrId.includes("/")) {
        modelId = aliasOrId.split("/").slice(1).join("/");
      }
      break;
    }
  }

  return {
    alias: aliasOrId,
    provider: providerOverride ?? detectedProvider,
    modelId,
    maxOutputTokens: 8_192,
    fromRegistry: false,
  };
}

/**
 * List all registered models. Useful for CLI help and series info.
 */
export function listModels(): ReadonlyArray<ModelEntry> {
  return Array.from(MODEL_REGISTRY.values());
}

/**
 * Get a specific model entry by alias.
 */
export function getModelByAlias(alias: string): ModelEntry | undefined {
  return MODEL_REGISTRY.get(alias);
}
