import { describe, expect, it } from "bun:test";
import { PipelineContext } from "../../src/pipeline/context.js";
import type { PipelineOptions, ResearchOutput } from "../../src/pipeline/types.js";

const mockOptions: PipelineOptions = {
  topic: "Test Topic",
  series: "default",
  slideCount: 10,
  outputDir: "./output/test",
};

describe("PipelineContext", () => {
  it("initializes with options", () => {
    const ctx = new PipelineContext(mockOptions);
    expect(ctx.options.topic).toBe("Test Topic");
    expect(ctx.options.slideCount).toBe(10);
    expect(ctx.research).toBeNull();
    expect(ctx.plan).toBeNull();
    expect(ctx.qaIteration).toBe(0);
  });

  it("throws when requiring missing research", () => {
    const ctx = new PipelineContext(mockOptions);
    expect(() => ctx.requireResearch()).toThrow("Research output not available");
  });

  it("throws when requiring missing plan", () => {
    const ctx = new PipelineContext(mockOptions);
    expect(() => ctx.requirePlan()).toThrow("Plan output not available");
  });

  it("throws when requiring missing copy", () => {
    const ctx = new PipelineContext(mockOptions);
    expect(() => ctx.requireCopy()).toThrow("Copy output not available");
  });

  it("throws when requiring missing design brief", () => {
    const ctx = new PipelineContext(mockOptions);
    expect(() => ctx.requireDesignBrief()).toThrow("Design brief not available");
  });

  it("returns research when set", () => {
    const ctx = new PipelineContext(mockOptions);
    const research: ResearchOutput = {
      topic: "Test",
      summary: "Test summary",
      keyFacts: [{ fact: "Fact 1" }],
      statistics: [],
      quotes: [],
      targetAudience: "Developers",
      keywords: ["test"],
    };
    ctx.research = research;
    expect(ctx.requireResearch().topic).toBe("Test");
  });

  it("detects blocking issues in QA report", () => {
    const ctx = new PipelineContext(mockOptions);

    // No report = no blocking issues
    expect(ctx.hasBlockingIssues()).toBe(false);

    // Report with only low issues = no blocking
    ctx.qaReport = {
      passedAutoChecks: true,
      autoCheckResults: [],
      issues: [
        {
          slideNumber: 1,
          severity: "low",
          category: "style",
          description: "Minor issue",
        },
      ],
      overallVerdict: "pass",
    };
    expect(ctx.hasBlockingIssues()).toBe(false);

    // Report with high issue = blocking
    ctx.qaReport = {
      passedAutoChecks: false,
      autoCheckResults: [],
      issues: [
        {
          slideNumber: 1,
          severity: "high",
          category: "fact-check",
          description: "Wrong statistic",
        },
      ],
      overallVerdict: "needs_revision",
    };
    expect(ctx.hasBlockingIssues()).toBe(true);
  });

  it("computes slidesDir from outputDir", () => {
    const ctx = new PipelineContext(mockOptions);
    expect(ctx.slidesDir).toBe("./output/test/slides");
  });
});
