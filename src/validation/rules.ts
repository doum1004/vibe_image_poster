/**
 * Validation rule definitions and severity constants.
 * These are the canonical rules referenced by both
 * the auto-validator and the QA reviewer agent.
 */

export const VALIDATION_RULES = {
  // HIGH severity — must fix
  CANVAS_SIZE: {
    id: "canvas-size",
    description: "Canvas must be exactly 1080x1440px",
    severity: "high" as const,
  },
  OVERFLOW_HIDDEN: {
    id: "overflow-hidden",
    description: "overflow:hidden must be set on html, body, and .card",
    severity: "high" as const,
  },
  WORD_BREAK: {
    id: "word-break-keep-all",
    description: "word-break:keep-all must be set for Korean text",
    severity: "high" as const,
  },
  MIN_FONT: {
    id: "min-font-size",
    description: "No font size below 28px",
    severity: "high" as const,
  },
  NO_EXTERNAL_URLS: {
    id: "no-external-urls",
    description: "No external URLs (CDN, http/https links)",
    severity: "high" as const,
  },
  FACT_ACCURACY: {
    id: "fact-accuracy",
    description: "All statistics and facts must match the research data",
    severity: "high" as const,
  },

  // MEDIUM severity — should fix
  BOTTOM_BAR: {
    id: "bottom-bar",
    description: "Every slide must have a .bottom-bar element",
    severity: "medium" as const,
  },
  ACCENT_LIMIT: {
    id: "accent-limit",
    description: "Max 2 accent highlights per slide",
    severity: "medium" as const,
  },
  STRONG_LIMIT: {
    id: "strong-limit",
    description: "Max 1 <strong> per slide",
    severity: "medium" as const,
  },
  CSS_VARIABLES: {
    id: "css-variables",
    description: "All colors and sizes should use CSS custom properties",
    severity: "medium" as const,
  },
  NO_CONSECUTIVE_PATTERNS: {
    id: "no-consecutive-patterns",
    description: "Same layout pattern must not be used on 2 consecutive slides",
    severity: "medium" as const,
  },

  // LOW severity — nice to fix
  NO_TRIPLE_TEMPERATURE: {
    id: "no-triple-temperature",
    description: "Same emotion temperature must not appear 3 slides in a row",
    severity: "low" as const,
  },
  LANG_ATTRIBUTE: {
    id: "lang-ko",
    description: "HTML tag should have lang='ko'",
    severity: "low" as const,
  },
} as const;

export type RuleId = (typeof VALIDATION_RULES)[keyof typeof VALIDATION_RULES]["id"];
