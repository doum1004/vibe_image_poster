import { beforeEach, describe, expect, test } from "bun:test";
import { clearProviderCache, getApiKeyForProvider } from "../../src/llm/provider.js";

describe("Provider", () => {
  beforeEach(() => {
    clearProviderCache();
  });

  describe("getApiKeyForProvider", () => {
    const keys = {
      anthropicApiKey: "sk-ant-test",
      openaiApiKey: "sk-test",
      googleApiKey: "AIza-test",
    };

    test("returns Anthropic key", () => {
      expect(getApiKeyForProvider("anthropic", keys)).toBe("sk-ant-test");
    });

    test("returns OpenAI key", () => {
      expect(getApiKeyForProvider("openai", keys)).toBe("sk-test");
    });

    test("returns OpenAI key for openai-compatible", () => {
      expect(getApiKeyForProvider("openai-compatible", keys)).toBe("sk-test");
    });

    test("returns Google key", () => {
      expect(getApiKeyForProvider("google", keys)).toBe("AIza-test");
    });

    test("throws when Anthropic key is missing", () => {
      expect(() => getApiKeyForProvider("anthropic", { openaiApiKey: "sk-test" })).toThrow(
        "ANTHROPIC_API_KEY",
      );
    });

    test("throws when OpenAI key is missing", () => {
      expect(() => getApiKeyForProvider("openai", { anthropicApiKey: "sk-ant-test" })).toThrow(
        "OPENAI_API_KEY",
      );
    });

    test("throws when Google key is missing", () => {
      expect(() => getApiKeyForProvider("google", { anthropicApiKey: "sk-ant-test" })).toThrow(
        "GOOGLE_API_KEY",
      );
    });
  });
});
