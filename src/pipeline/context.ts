import type {
  CopyOutput,
  DesignBriefOutput,
  PipelineOptions,
  PlanOutput,
  QAReport,
  ResearchOutput,
} from "./types.js";

/**
 * PipelineContext holds all state as it flows through the agent pipeline.
 * Each agent reads from context and writes its output back.
 */
export class PipelineContext {
  readonly options: PipelineOptions;

  // Stage outputs (populated as pipeline progresses)
  research: ResearchOutput | null = null;
  plan: PlanOutput | null = null;
  copy: CopyOutput | null = null;
  designBrief: DesignBriefOutput | null = null;
  htmlSlides: Map<number, string> = new Map();
  pngPaths: Map<number, string> = new Map();
  qaReport: QAReport | null = null;
  qaIteration = 0;

  // Raw research content (if user provides a .md file)
  rawResearchContent: string | null = null;

  constructor(options: PipelineOptions) {
    this.options = options;
  }

  get slidesDir(): string {
    return `${this.options.outputDir}/slides`;
  }

  /**
   * Check if a required stage output is available.
   */
  requireResearch(): ResearchOutput {
    if (!this.research) {
      throw new Error("Research output not available. Run researcher first.");
    }
    return this.research;
  }

  requirePlan(): PlanOutput {
    if (!this.plan) {
      throw new Error("Plan output not available. Run contents-marketer first.");
    }
    return this.plan;
  }

  requireCopy(): CopyOutput {
    if (!this.copy) {
      throw new Error("Copy output not available. Run contents-marketer first.");
    }
    return this.copy;
  }

  requireDesignBrief(): DesignBriefOutput {
    if (!this.designBrief) {
      throw new Error("Design brief not available. Run designer first.");
    }
    return this.designBrief;
  }

  /**
   * Whether the QA report has blocking issues (high or medium severity).
   */
  hasBlockingIssues(): boolean {
    if (!this.qaReport) return false;
    return this.qaReport.issues.some((i) => i.severity === "high" || i.severity === "medium");
  }
}
