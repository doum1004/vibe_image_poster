import { describe, expect, test } from "bun:test";
import { getModelByAlias, listModels, resolveModel } from "../../src/llm/models.js";

describe("Model Registry", () => {
  describe("listModels", () => {
    test("returns all registered models", () => {
      const models = listModels();
      expect(models.length).toBeGreaterThanOrEqual(10);
    });

    test("every model has required fields", () => {
      for (const model of listModels()) {
        expect(model.alias).toBeTruthy();
        expect(model.provider).toBeTruthy();
        expect(model.modelId).toBeTruthy();
        expect(model.contextWindow).toBeGreaterThan(0);
        expect(model.maxOutputTokens).toBeGreaterThan(0);
        expect(model.description).toBeTruthy();
      }
    });

    test("aliases are unique", () => {
      const aliases = listModels().map((m) => m.alias);
      expect(new Set(aliases).size).toBe(aliases.length);
    });
  });

  describe("getModelByAlias", () => {
    test("finds existing model by alias", () => {
      const model = getModelByAlias("claude-sonnet-4");
      expect(model).toBeDefined();
      expect(model?.provider).toBe("anthropic");
      expect(model?.modelId).toBe("claude-sonnet-4-20250514");
    });

    test("returns undefined for unknown alias", () => {
      expect(getModelByAlias("nonexistent-model")).toBeUndefined();
    });
  });

  describe("resolveModel", () => {
    test("resolves by alias — Anthropic", () => {
      const resolved = resolveModel("claude-sonnet-4.5");
      expect(resolved.provider).toBe("anthropic");
      expect(resolved.modelId).toBe("claude-sonnet-4-5-20250929");
      expect(resolved.fromRegistry).toBe(true);
    });

    test("resolves by alias — OpenAI", () => {
      const resolved = resolveModel("gpt-4o");
      expect(resolved.provider).toBe("openai");
      expect(resolved.modelId).toBe("gpt-4o");
      expect(resolved.fromRegistry).toBe(true);
    });

    test("resolves by alias — Google", () => {
      const resolved = resolveModel("gemini-2.5-pro");
      expect(resolved.provider).toBe("google");
      expect(resolved.modelId).toContain("gemini-2.5-pro");
      expect(resolved.fromRegistry).toBe(true);
    });

    test("resolves by full model ID (not alias)", () => {
      const resolved = resolveModel("claude-sonnet-4-20250514");
      expect(resolved.provider).toBe("anthropic");
      expect(resolved.modelId).toBe("claude-sonnet-4-20250514");
      expect(resolved.fromRegistry).toBe(true);
      expect(resolved.alias).toBe("claude-sonnet-4");
    });

    test("detects Anthropic provider from unknown model name", () => {
      const resolved = resolveModel("claude-future-99");
      expect(resolved.provider).toBe("anthropic");
      expect(resolved.modelId).toBe("claude-future-99");
      expect(resolved.fromRegistry).toBe(false);
    });

    test("detects OpenAI provider from unknown model name", () => {
      const resolved = resolveModel("gpt-5-turbo");
      expect(resolved.provider).toBe("openai");
      expect(resolved.modelId).toBe("gpt-5-turbo");
      expect(resolved.fromRegistry).toBe(false);
    });

    test("detects OpenAI provider for o-series models", () => {
      const resolved = resolveModel("o3");
      // o3 is in registry
      expect(resolved.provider).toBe("openai");
      expect(resolved.fromRegistry).toBe(true);

      // Unknown o-series
      const resolved2 = resolveModel("o5-large");
      expect(resolved2.provider).toBe("openai");
      expect(resolved2.fromRegistry).toBe(false);
    });

    test("detects Google provider from unknown model name", () => {
      const resolved = resolveModel("gemini-3.0-ultra");
      expect(resolved.provider).toBe("google");
      expect(resolved.modelId).toBe("gemini-3.0-ultra");
      expect(resolved.fromRegistry).toBe(false);
    });

    test("strips LiteLLM-style prefix", () => {
      const resolved = resolveModel("anthropic/claude-sonnet-4-5-20250929");
      expect(resolved.provider).toBe("anthropic");
      expect(resolved.modelId).toBe("claude-sonnet-4-5-20250929");
    });

    test("strips OpenAI LiteLLM prefix", () => {
      const resolved = resolveModel("openai/gpt-4o");
      expect(resolved.provider).toBe("openai");
      expect(resolved.modelId).toBe("gpt-4o");
    });

    test("strips vertex_ai prefix for Google", () => {
      const resolved = resolveModel("vertex_ai/gemini-1.5-pro");
      expect(resolved.provider).toBe("google");
      expect(resolved.modelId).toBe("gemini-1.5-pro");
    });

    test("falls back to openai-compatible for unrecognized models", () => {
      const resolved = resolveModel("my-custom-model");
      expect(resolved.provider).toBe("openai-compatible");
      expect(resolved.modelId).toBe("my-custom-model");
      expect(resolved.fromRegistry).toBe(false);
    });

    test("provider override takes precedence", () => {
      const resolved = resolveModel("gpt-4o", "anthropic");
      expect(resolved.provider).toBe("anthropic");
      // Model ID still correct from registry
      expect(resolved.modelId).toBe("gpt-4o");
    });

    test("max output tokens from registry", () => {
      const resolved = resolveModel("claude-opus-4");
      expect(resolved.maxOutputTokens).toBe(32_000);
    });

    test("default max output tokens for unknown models", () => {
      const resolved = resolveModel("unknown-model-xyz");
      expect(resolved.maxOutputTokens).toBe(8_192);
    });
  });
});
