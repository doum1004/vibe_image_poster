import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getModelForAgent, loadConfig, resetConfig } from "../../src/config.js";

describe("Config — Multi-provider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    // Clear all relevant env vars
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.LLM_MODEL;
    delete process.env.CLAUDE_MODEL;
    delete process.env.LLM_BASE_URL;
    delete process.env.RESEARCHER_MODEL;
    delete process.env.PLANNER_MODEL;
    delete process.env.COPY_MODEL;
    delete process.env.DESIGNER_MODEL;
    delete process.env.DEVELOPER_MODEL;
    delete process.env.QA_MODEL;
    delete process.env.CHROME_PATH;
    delete process.env.MAX_QA_LOOPS;
    delete process.env.DEFAULT_SLIDES;
  });

  afterEach(() => {
    resetConfig();
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  test("loads with defaults (no API keys required at schema level)", () => {
    const config = loadConfig();
    expect(config.llmModel).toBe("gpt-5-mini");
    expect(config.anthropicApiKey).toBeUndefined();
    expect(config.openaiApiKey).toBeUndefined();
    expect(config.googleApiKey).toBeUndefined();
  });

  test("reads LLM_MODEL env var", () => {
    process.env.LLM_MODEL = "gpt-4o";
    const config = loadConfig();
    expect(config.llmModel).toBe("gpt-4o");
  });

  test("falls back to CLAUDE_MODEL if LLM_MODEL not set", () => {
    process.env.CLAUDE_MODEL = "claude-opus-4-20250918";
    const config = loadConfig();
    expect(config.llmModel).toBe("claude-opus-4-20250918");
  });

  test("LLM_MODEL takes priority over CLAUDE_MODEL", () => {
    process.env.LLM_MODEL = "gpt-4o";
    process.env.CLAUDE_MODEL = "claude-sonnet-4-20250514";
    const config = loadConfig();
    expect(config.llmModel).toBe("gpt-4o");
  });

  test("reads per-agent model overrides", () => {
    process.env.RESEARCHER_MODEL = "gpt-4o-mini";
    process.env.DEVELOPER_MODEL = "claude-opus-4";
    const config = loadConfig();
    expect(config.researcherModel).toBe("gpt-4o-mini");
    expect(config.developerModel).toBe("claude-opus-4");
    expect(config.plannerModel).toBeUndefined();
  });

  test("reads multiple API keys", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.GOOGLE_API_KEY = "AIza-test";
    const config = loadConfig();
    expect(config.anthropicApiKey).toBe("sk-ant-test");
    expect(config.openaiApiKey).toBe("sk-test");
    expect(config.googleApiKey).toBe("AIza-test");
  });

  describe("getModelForAgent", () => {
    test("returns per-agent override when set", () => {
      process.env.RESEARCHER_MODEL = "gpt-4o-mini";
      loadConfig();
      expect(getModelForAgent("researcher")).toBe("gpt-4o-mini");
    });

    test("returns pipeline model when no per-agent override", () => {
      loadConfig();
      expect(getModelForAgent("researcher", "gpt-4o")).toBe("gpt-4o");
    });

    test("returns config default when no overrides", () => {
      process.env.LLM_MODEL = "gemini-2.5-pro";
      loadConfig();
      expect(getModelForAgent("researcher")).toBe("gemini-2.5-pro");
    });

    test("per-agent override takes priority over pipeline model", () => {
      process.env.DEVELOPER_MODEL = "claude-opus-4";
      loadConfig();
      expect(getModelForAgent("developer", "gpt-4o")).toBe("claude-opus-4");
    });

    test("unknown agent name falls through to pipeline model", () => {
      loadConfig();
      expect(getModelForAgent("unknown-agent", "gpt-4o")).toBe("gpt-4o");
    });
  });
});
