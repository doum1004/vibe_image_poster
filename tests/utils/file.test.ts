import { describe, expect, it } from "bun:test";
import { getOutputDir, slugify } from "../../src/utils/file.js";

describe("slugify", () => {
  it("converts English text to slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("handles Korean text", () => {
    const slug = slugify("AI 네이티브 캠프 후기");
    expect(slug).toBe("ai-네이티브-캠프-후기");
  });

  it("removes special characters", () => {
    expect(slugify("Hello! @World #2024")).toBe("hello-world-2024");
  });

  it("trims and removes leading/trailing dashes", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("limits length to 80 characters", () => {
    const longText = "a".repeat(100);
    expect(slugify(longText).length).toBeLessThanOrEqual(80);
  });
});

describe("getOutputDir", () => {
  it("creates dated output path with slug", () => {
    const dir = getOutputDir("./output", "Test Topic");
    expect(dir).toMatch(/output[\\/]\d{4}-\d{2}-\d{2}_test-topic/);
  });

  it("handles Korean topics", () => {
    const dir = getOutputDir("./output", "AI 캠프 후기");
    expect(dir).toContain("ai-캠프-후기");
  });
});
