import { describe, expect, it } from "bun:test";
import {
  getPatternById,
  getPatternListForPrompt,
  getPatternsForRole,
  PATTERN_CATALOG,
} from "../../src/design-system/shared/patterns.js";

describe("PATTERN_CATALOG", () => {
  it("has exactly 28 patterns", () => {
    expect(PATTERN_CATALOG.length).toBe(28);
  });

  it("all patterns have required fields", () => {
    for (const p of PATTERN_CATALOG) {
      expect(p.id).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.suitableFor.length).toBeGreaterThan(0);
      expect(p.structureHint).toBeTruthy();
    }
  });

  it("has unique IDs", () => {
    const ids = PATTERN_CATALOG.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("getPatternsForRole", () => {
  it("returns cover patterns", () => {
    const patterns = getPatternsForRole("cover");
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.suitableFor).toContain("cover");
    }
  });

  it("returns body patterns", () => {
    const patterns = getPatternsForRole("body");
    expect(patterns.length).toBeGreaterThanOrEqual(20);
  });

  it("returns cta patterns", () => {
    const patterns = getPatternsForRole("cta");
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.suitableFor).toContain("cta");
    }
  });
});

describe("getPatternById", () => {
  it("finds existing pattern", () => {
    const p = getPatternById("intro-cover");
    expect(p).toBeDefined();
    expect(p?.name).toBe("Cover Slide");
  });

  it("returns undefined for non-existent pattern", () => {
    expect(getPatternById("non-existent")).toBeUndefined();
  });
});

describe("getPatternListForPrompt", () => {
  it("returns formatted string with all patterns", () => {
    const list = getPatternListForPrompt();
    expect(list).toContain("intro-cover");
    expect(list).toContain("intro-cta");
    expect(list.split("\n").length).toBe(28);
  });
});
