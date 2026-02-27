import { z } from "zod";

// ─── Emotion & Layout Enums ────────────────────────────────────────────

export const EmotionPhase = z.enum(["empathy", "transition", "evidence", "action"]);
export type EmotionPhase = z.infer<typeof EmotionPhase>;

/** Temperature scale 1-5 (●○○○○ to ●●●●●) */
export const EmotionTemperature = z.number().int().min(1).max(5);
export type EmotionTemperature = z.infer<typeof EmotionTemperature>;

export const SlideRole = z.enum(["cover", "body", "cta"]);
export type SlideRole = z.infer<typeof SlideRole>;

export const LayoutPattern = z.enum([
  // Information (7)
  "info-stats",
  "info-quote",
  "info-definition",
  "info-list",
  "info-highlight",
  "info-callout",
  "info-icon-grid",
  // Procedure (5)
  "proc-steps",
  "proc-timeline",
  "proc-numbered",
  "proc-flowchart",
  "proc-checklist",
  // Comparison (3)
  "comp-before-after",
  "comp-versus",
  "comp-table",
  // Data (3)
  "data-bar",
  "data-pie",
  "data-metric",
  // Emphasis (4)
  "emph-big-text",
  "emph-centered",
  "emph-split",
  "emph-gradient",
  // Code (2)
  "code-snippet",
  "code-terminal",
  // Mixed (2)
  "mixed-text-image",
  "mixed-card-grid",
  // Intro (2)
  "intro-cover",
  "intro-cta",
]);
export type LayoutPattern = z.infer<typeof LayoutPattern>;

// ─── Research Output ───────────────────────────────────────────────────

export const ResearchOutput = z.object({
  topic: z.string(),
  summary: z.string(),
  keyFacts: z.array(
    z.object({
      fact: z.string(),
      source: z.string().optional(),
    }),
  ),
  statistics: z.array(
    z.object({
      value: z.string(),
      description: z.string(),
      source: z.string().optional(),
    }),
  ),
  quotes: z.array(
    z.object({
      text: z.string(),
      author: z.string().optional(),
    }),
  ),
  targetAudience: z.string(),
  keywords: z.array(z.string()),
});
export type ResearchOutput = z.infer<typeof ResearchOutput>;

// ─── Plan Output ───────────────────────────────────────────────────────

export const SlidePlan = z.object({
  slideNumber: z.number().int().min(1),
  role: SlideRole,
  emotionPhase: EmotionPhase,
  emotionTemperature: EmotionTemperature,
  purpose: z.string(),
  direction: z.string(),
});
export type SlidePlan = z.infer<typeof SlidePlan>;

export const PlanOutput = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  totalSlides: z.number().int().min(3).max(20),
  narrative: z.string(),
  slides: z.array(SlidePlan),
});
export type PlanOutput = z.infer<typeof PlanOutput>;

// ─── Copy Output ───────────────────────────────────────────────────────

export const SlideCopy = z.object({
  slideNumber: z.number().int().min(1),
  role: SlideRole,
  heading: z.string().optional(),
  subheading: z.string().optional(),
  bodyText: z.string().optional(),
  bulletPoints: z.array(z.string()).optional(),
  accentText: z.string().optional(),
  footnote: z.string().optional(),
  ctaText: z.string().optional(),
});
export type SlideCopy = z.infer<typeof SlideCopy>;

export const CopyOutput = z.object({
  title: z.string(),
  slides: z.array(SlideCopy),
});
export type CopyOutput = z.infer<typeof CopyOutput>;

// ─── Design Brief Output ──────────────────────────────────────────────

export const SlideDesign = z.object({
  slideNumber: z.number().int().min(1),
  layoutPattern: LayoutPattern,
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  notes: z.string().optional(),
});
export type SlideDesign = z.infer<typeof SlideDesign>;

export const DesignBriefOutput = z.object({
  seriesTheme: z.string(),
  colorPalette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
  }),
  slides: z.array(SlideDesign),
});
export type DesignBriefOutput = z.infer<typeof DesignBriefOutput>;

// ─── QA Report ─────────────────────────────────────────────────────────

export const IssueSeverity = z.enum(["high", "medium", "low"]);
export type IssueSeverity = z.infer<typeof IssueSeverity>;

export const QAIssue = z.object({
  slideNumber: z.number().int().min(1),
  severity: IssueSeverity,
  category: z.string(),
  description: z.string(),
  suggestion: z.string().optional(),
});
export type QAIssue = z.infer<typeof QAIssue>;

export const QAReport = z.object({
  passedAutoChecks: z.boolean(),
  autoCheckResults: z.array(
    z.object({
      rule: z.string(),
      passed: z.boolean(),
      detail: z.string().optional(),
    }),
  ),
  issues: z.array(QAIssue),
  overallVerdict: z.enum(["pass", "needs_revision"]),
});
export type QAReport = z.infer<typeof QAReport>;

// ─── Pipeline Options ──────────────────────────────────────────────────

export interface PipelineOptions {
  topic: string;
  inputFile?: string;
  series: string;
  slideCount: number;
  outputDir: string;
  /** Model alias or raw model ID override (from --model CLI flag) */
  model?: string;
}
