/**
 * Layout Pattern Catalog — 29 shared patterns.
 * The designer agent selects from these patterns for each slide.
 * The developer agent uses the pattern to determine HTML structure.
 */

export interface PatternDefinition {
  id: string;
  category: string;
  name: string;
  description: string;
  /** Suggested slide roles this pattern works well with */
  suitableFor: ("cover" | "body" | "cta")[];
  /** HTML structure hint for the developer agent */
  structureHint: string;
}

export const PATTERN_CATALOG: PatternDefinition[] = [
  // ─── Information (7) ───────────────────────────
  {
    id: "info-stats",
    category: "information",
    name: "Statistics Highlight",
    description: "Large number/statistic with supporting context below",
    suitableFor: ["body"],
    structureHint: "big-number + description + source",
  },
  {
    id: "info-quote",
    category: "information",
    name: "Quote Block",
    description: "Featured quote with attribution",
    suitableFor: ["body"],
    structureHint: "quote-mark + quote-text + author",
  },
  {
    id: "info-definition",
    category: "information",
    name: "Definition",
    description: "Term + definition in a clear layout",
    suitableFor: ["body"],
    structureHint: "term-heading + definition-body + example",
  },
  {
    id: "info-list",
    category: "information",
    name: "Bullet List",
    description: "Heading with 3-5 bullet points",
    suitableFor: ["body"],
    structureHint: "heading + bullet-list(3-5 items)",
  },
  {
    id: "info-highlight",
    category: "information",
    name: "Key Insight",
    description: "Single important insight with emphasis styling",
    suitableFor: ["body"],
    structureHint: "label + highlighted-text-block + footnote",
  },
  {
    id: "info-callout",
    category: "information",
    name: "Callout Box",
    description: "Important message in a colored callout container",
    suitableFor: ["body"],
    structureHint: "callout-container(icon + heading + body)",
  },
  {
    id: "info-icon-grid",
    category: "information",
    name: "Icon Grid",
    description: "2x2 or 3x2 grid of icon + label items",
    suitableFor: ["body"],
    structureHint: "heading + grid(emoji + label + description) x 4-6",
  },

  // ─── Procedure (5) ─────────────────────────────
  {
    id: "proc-steps",
    category: "procedure",
    name: "Step by Step",
    description: "Numbered steps with descriptions",
    suitableFor: ["body"],
    structureHint: "heading + step(number + title + desc) x 3-5",
  },
  {
    id: "proc-timeline",
    category: "procedure",
    name: "Timeline",
    description: "Vertical timeline with milestones",
    suitableFor: ["body"],
    structureHint: "heading + timeline-line + milestone(dot + label + desc) x 3-5",
  },
  {
    id: "proc-numbered",
    category: "procedure",
    name: "Numbered Cards",
    description: "Numbered items in card containers",
    suitableFor: ["body"],
    structureHint: "heading + card(number-badge + title + desc) x 3-4",
  },
  {
    id: "proc-flowchart",
    category: "procedure",
    name: "Flow Chart",
    description: "Connected boxes showing process flow",
    suitableFor: ["body"],
    structureHint: "heading + box(text) -> arrow -> box(text) x 3-4",
  },
  {
    id: "proc-checklist",
    category: "procedure",
    name: "Checklist",
    description: "Checkbox-style items for actionable lists",
    suitableFor: ["body", "cta"],
    structureHint: "heading + checkbox-item(check + text) x 4-6",
  },

  // ─── Comparison (3) ────────────────────────────
  {
    id: "comp-before-after",
    category: "comparison",
    name: "Before & After",
    description: "Side-by-side or top-bottom comparison",
    suitableFor: ["body"],
    structureHint: "heading + before-panel(label + content) + after-panel(label + content)",
  },
  {
    id: "comp-versus",
    category: "comparison",
    name: "Versus",
    description: "Two options compared with VS divider",
    suitableFor: ["body"],
    structureHint: "option-a(heading + points) + VS-divider + option-b(heading + points)",
  },
  {
    id: "comp-table",
    category: "comparison",
    name: "Comparison Table",
    description: "Simple table comparing features/attributes",
    suitableFor: ["body"],
    structureHint: "heading + table(header-row + data-rows x 3-5)",
  },

  // ─── Data (3) ──────────────────────────────────
  {
    id: "data-bar",
    category: "data",
    name: "Bar Chart",
    description: "Horizontal bar chart using CSS (no images)",
    suitableFor: ["body"],
    structureHint: "heading + bar(label + bar-fill(width%) + value) x 3-5",
  },
  {
    id: "data-pie",
    category: "data",
    name: "Donut/Pie Visual",
    description: "CSS conic-gradient pie chart with legend",
    suitableFor: ["body"],
    structureHint: "heading + conic-gradient-circle + legend(color + label + value) x 3-5",
  },
  {
    id: "data-metric",
    category: "data",
    name: "Metric Dashboard",
    description: "Multiple KPI-style metric cards",
    suitableFor: ["body"],
    structureHint: "heading + metric-card(value + label + change) x 3-4",
  },

  // ─── Emphasis (4) ──────────────────────────────
  {
    id: "emph-big-text",
    category: "emphasis",
    name: "Big Text",
    description: "Full-width large text with minimal decoration",
    suitableFor: ["body", "cover"],
    structureHint: "hero-text(large) + subtitle(small) + decoration-line",
  },
  {
    id: "emph-centered",
    category: "emphasis",
    name: "Centered Statement",
    description: "Vertically and horizontally centered text",
    suitableFor: ["body"],
    structureHint: "centered-container(heading + body-text)",
  },
  {
    id: "emph-split",
    category: "emphasis",
    name: "Split Screen",
    description: "Left/right split with different backgrounds",
    suitableFor: ["body"],
    structureHint: "left-panel(bg-color + text) + right-panel(bg-color + text)",
  },
  {
    id: "emph-gradient",
    category: "emphasis",
    name: "Gradient Background",
    description: "Text on a gradient background for visual impact",
    suitableFor: ["body", "cover"],
    structureHint: "gradient-bg + centered-text(heading + subtitle)",
  },

  // ─── Code (2) ──────────────────────────────────
  {
    id: "code-snippet",
    category: "code",
    name: "Code Snippet",
    description: "Syntax-highlighted code block with explanation",
    suitableFor: ["body"],
    structureHint: "heading + code-block(monospace) + explanation-text",
  },
  {
    id: "code-terminal",
    category: "code",
    name: "Terminal",
    description: "Terminal/command-line style display",
    suitableFor: ["body"],
    structureHint: "terminal-window(title-bar + command-lines) + explanation",
  },

  // ─── Mixed (2) ─────────────────────────────────
  {
    id: "mixed-text-image",
    category: "mixed",
    name: "Text + Image",
    description: "Text content alongside an image area",
    suitableFor: ["body"],
    structureHint: "text-column(heading + body) + image-area(placeholder or base64)",
  },
  {
    id: "mixed-card-grid",
    category: "mixed",
    name: "Card Grid",
    description: "Grid of small info cards",
    suitableFor: ["body"],
    structureHint: "heading + grid(card(icon + title + desc)) x 4-6",
  },

  // ─── Intro (2) ─────────────────────────────────
  {
    id: "intro-cover",
    category: "intro",
    name: "Cover Slide",
    description: "Title page with series branding and topic",
    suitableFor: ["cover"],
    structureHint: "series-label + hero-title + subtitle + decoration",
  },
  {
    id: "intro-cta",
    category: "intro",
    name: "Call to Action",
    description: "Final slide with action prompt and branding",
    suitableFor: ["cta"],
    structureHint: "cta-heading + cta-body + button-style-element + branding-footer",
  },
];

/**
 * Get patterns suitable for a given slide role.
 */
export function getPatternsForRole(role: "cover" | "body" | "cta"): PatternDefinition[] {
  return PATTERN_CATALOG.filter((p) => p.suitableFor.includes(role));
}

/**
 * Get a pattern by ID.
 */
export function getPatternById(id: string): PatternDefinition | undefined {
  return PATTERN_CATALOG.find((p) => p.id === id);
}

/**
 * Get all pattern IDs as a formatted list for AI prompts.
 */
export function getPatternListForPrompt(): string {
  return PATTERN_CATALOG.map((p) => `- ${p.id}: ${p.name} — ${p.description}`).join("\n");
}
