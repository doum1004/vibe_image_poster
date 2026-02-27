import { z } from "zod";

// ─── Schema ─────────────────────────────────────────────────────────────

const ConfigSchema = z.object({
  // Provider API keys (at least one required — validated at runtime when model is resolved)
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  googleApiKey: z.string().optional(),

  // Default model alias or raw model ID (e.g., "claude-sonnet-4", "gpt-4o", "gemini-2.5-pro")
  llmModel: z.string().default("gpt-5-mini"),

  // Optional base URL for OpenAI-compatible endpoints (LiteLLM proxy, Ollama, vLLM)
  llmBaseUrl: z.string().url().optional(),

  // Per-agent model overrides (alias or raw model ID)
  researcherModel: z.string().optional(),
  plannerModel: z.string().optional(),
  copyModel: z.string().optional(),
  designerModel: z.string().optional(),
  developerModel: z.string().optional(),
  qaModel: z.string().optional(),

  // Puppeteer / rendering
  chromePath: z.string().optional(),

  // Pipeline settings
  maxQaLoops: z.coerce.number().int().positive().default(3),
  defaultSlides: z.coerce.number().int().min(3).max(20).default(10),
});

export type Config = z.infer<typeof ConfigSchema>;

// ─── Backward-compatible env var mapping ────────────────────────────────

let _config: Config | null = null;

export function loadConfig(): Config {
  if (_config) return _config;

  const raw = {
    // API keys — support both new and legacy env var names
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    googleApiKey: process.env.GOOGLE_API_KEY || undefined,

    // Model — LLM_MODEL takes priority, falls back to legacy CLAUDE_MODEL
    llmModel: process.env.LLM_MODEL || process.env.CLAUDE_MODEL || undefined,

    // Base URL for LiteLLM proxy / custom endpoints
    llmBaseUrl: process.env.LLM_BASE_URL || undefined,

    // Per-agent model overrides
    researcherModel: process.env.RESEARCHER_MODEL || undefined,
    plannerModel: process.env.PLANNER_MODEL || undefined,
    copyModel: process.env.COPY_MODEL || undefined,
    designerModel: process.env.DESIGNER_MODEL || undefined,
    developerModel: process.env.DEVELOPER_MODEL || undefined,
    qaModel: process.env.QA_MODEL || undefined,

    // Rendering
    chromePath: process.env.CHROME_PATH || undefined,

    // Pipeline
    maxQaLoops: process.env.MAX_QA_LOOPS ?? undefined,
    defaultSlides: process.env.DEFAULT_SLIDES ?? undefined,
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuration error:\n${errors}`);
  }

  _config = result.data;
  return _config;
}

export function getConfig(): Config {
  if (!_config) return loadConfig();
  return _config;
}

/**
 * Reset cached config. Useful for testing.
 */
export function resetConfig(): void {
  _config = null;
}

// ─── Agent name → config field mapping ──────────────────────────────────

const AGENT_MODEL_KEYS: Record<string, keyof Config> = {
  researcher: "researcherModel",
  planner: "plannerModel",
  "copy-writer": "copyModel",
  designer: "designerModel",
  developer: "developerModel",
  "qa-reviewer": "qaModel",
};

/**
 * Get the model alias/ID for a specific agent.
 * Resolution order: per-agent override → CLI/pipeline model → config default
 */
export function getModelForAgent(agentName: string, pipelineModel?: string): string {
  const config = getConfig();

  // 1. Per-agent override from env
  const configKey = AGENT_MODEL_KEYS[agentName];
  if (configKey) {
    const override = config[configKey];
    if (typeof override === "string" && override) return override;
  }

  // 2. Pipeline-level model (from --model CLI flag)
  if (pipelineModel) return pipelineModel;

  // 3. Config default
  return config.llmModel;
}
