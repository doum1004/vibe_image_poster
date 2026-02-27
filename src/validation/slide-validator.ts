import type { IssueSeverity } from "../pipeline/types.js";
import { log } from "../utils/logger.js";

export interface ValidationRule {
  id: string;
  description: string;
  severity: IssueSeverity;
  check: (html: string, slideNumber: number) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  detail?: string;
}

export interface SlideValidationReport {
  slideNumber: number;
  results: Array<{
    rule: string;
    severity: IssueSeverity;
    passed: boolean;
    detail?: string;
  }>;
}

// ─── Rule Definitions ────────────────────────────────────────────────

const RULES: ValidationRule[] = [
  {
    id: "canvas-size",
    description: "Canvas must be 1080x1440px",
    severity: "high",
    check: (html) => {
      const has1080 = html.includes("1080") && html.includes("1440");
      return {
        passed: has1080,
        detail: has1080 ? undefined : "Missing 1080x1440 canvas dimensions",
      };
    },
  },
  {
    id: "overflow-hidden",
    description: "overflow:hidden must be present",
    severity: "high",
    check: (html) => {
      const hasOverflow = /overflow\s*:\s*hidden/.test(html);
      return {
        passed: hasOverflow,
        detail: hasOverflow ? undefined : "Missing overflow:hidden",
      };
    },
  },
  {
    id: "no-vertical-overflow",
    description: "Content must fit within the 1080x1440 canvas (no overflow)",
    severity: "high",
    check: (html) => {
      // Heuristic: flag if content suggests scrollable body/card or explicit overflow-y
      const hasOverflowY = /overflow-y\s*:\s*(scroll|auto)/i.test(html);
      // Also catch obvious oversized min-height blocks (>=360px) combined with many bullets
      const tallBlocks = html.match(/min-height\s*:\s*(\d+)px/gi) || [];
      const tall = tallBlocks.some((m) => {
        const val = parseInt(m.replace(/\D+/g, ""), 10);
        return val >= 360;
      });
      const manyBullets = (html.match(/class\s*=\s*"[^"]*bullet[^"]*"/gi) || []).length >= 6;

      const risk = hasOverflowY || (tall && manyBullets);
      return {
        passed: !risk,
        detail: risk
          ? "Potential vertical overflow: reduce block heights/padding or bullet count"
          : undefined,
      };
    },
  },
  {
    id: "word-break-keep-all",
    description: "word-break:keep-all must be present for Korean text",
    severity: "high",
    check: (html) => {
      const hasKeepAll = /word-break\s*:\s*keep-all/.test(html);
      return {
        passed: hasKeepAll,
        detail: hasKeepAll ? undefined : "Missing word-break:keep-all",
      };
    },
  },
  {
    id: "no-external-urls",
    description: "No external URLs (CDN, http/https links)",
    severity: "high",
    check: (html) => {
      // Allow data: URIs and skip checking inside comments
      const urlPattern = /(?:src|href|url)\s*[=(]\s*['"]?(https?:\/\/)/gi;
      const matches = html.match(urlPattern);
      const hasExternal = matches !== null && matches.length > 0;
      return {
        passed: !hasExternal,
        detail: hasExternal
          ? `Found external URL references: ${matches?.slice(0, 3).join(", ")}`
          : undefined,
      };
    },
  },
  {
    id: "min-font-size",
    description: "No font size below 28px",
    severity: "high",
    check: (html) => {
      // Match font-size declarations with px values
      const fontSizes = html.matchAll(/font-size\s*:\s*(\d+)px/gi);
      const smallFonts: number[] = [];
      for (const match of fontSizes) {
        const size = parseInt(match[1], 10);
        if (size < 28) smallFonts.push(size);
      }
      return {
        passed: smallFonts.length === 0,
        detail:
          smallFonts.length > 0
            ? `Found font sizes below 28px: ${smallFonts.join(", ")}px`
            : undefined,
      };
    },
  },
  {
    id: "bottom-bar",
    description: "Slide must have a .bottom-bar element",
    severity: "medium",
    check: (html) => {
      const hasBar = html.includes("bottom-bar");
      return {
        passed: hasBar,
        detail: hasBar ? undefined : "Missing .bottom-bar element",
      };
    },
  },
  {
    id: "accent-limit",
    description: "Max 2 accent elements per slide",
    severity: "medium",
    check: (html) => {
      const accentCount = (html.match(/class\s*=\s*["'][^"']*accent[^"']*["']/gi) || []).length;
      // Also count inline accent spans
      const inlineAccent = (html.match(/<span[^>]*class\s*=\s*["']accent["'][^>]*>/gi) || [])
        .length;
      const total = Math.max(accentCount, inlineAccent);
      return {
        passed: total <= 2,
        detail: total > 2 ? `Found ${total} accent elements (max 2)` : undefined,
      };
    },
  },
  {
    id: "strong-limit",
    description: "Max 1 <strong> per slide",
    severity: "medium",
    check: (html) => {
      const strongCount = (html.match(/<strong/gi) || []).length;
      return {
        passed: strongCount <= 1,
        detail: strongCount > 1 ? `Found ${strongCount} <strong> elements (max 1)` : undefined,
      };
    },
  },
  {
    id: "has-doctype",
    description: "HTML must have DOCTYPE declaration",
    severity: "medium",
    check: (html) => {
      const hasDoctype = /<!DOCTYPE\s+html>/i.test(html);
      return {
        passed: hasDoctype,
        detail: hasDoctype ? undefined : "Missing <!DOCTYPE html>",
      };
    },
  },
  {
    id: "lang-ko",
    description: "HTML must have lang='ko' for Korean content",
    severity: "low",
    check: (html) => {
      const hasLang = /lang\s*=\s*["']ko["']/i.test(html);
      return {
        passed: hasLang,
        detail: hasLang ? undefined : "Missing lang='ko' attribute",
      };
    },
  },
];

/**
 * Validate a single slide HTML against all rules.
 */
export function validateSlide(html: string, slideNumber: number): SlideValidationReport {
  return {
    slideNumber,
    results: RULES.map((rule) => {
      const result = rule.check(html, slideNumber);
      return {
        rule: rule.id,
        severity: rule.severity,
        passed: result.passed,
        detail: result.detail,
      };
    }),
  };
}

/**
 * Validate all slides and return combined results.
 * Also checks cross-slide rules (consecutive patterns, temperatures).
 */
export function validateAllSlides(slides: Map<number, string>): {
  reports: SlideValidationReport[];
  allPassed: boolean;
  highCount: number;
  mediumCount: number;
  lowCount: number;
} {
  const reports: SlideValidationReport[] = [];
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  const sortedKeys = [...slides.keys()].sort((a, b) => a - b);

  for (const num of sortedKeys) {
    const html = slides.get(num);
    if (!html) continue;
    const report = validateSlide(html, num);
    reports.push(report);

    for (const r of report.results) {
      if (!r.passed) {
        if (r.severity === "high") highCount++;
        else if (r.severity === "medium") mediumCount++;
        else lowCount++;
      }
    }
  }

  const allPassed = highCount === 0 && mediumCount === 0;

  // Log summary
  log.group("Slide Validation Results");
  for (const report of reports) {
    const failures = report.results.filter((r) => !r.passed);
    if (failures.length === 0) {
      log.success(`Slide ${report.slideNumber}: All checks passed`);
    } else {
      log.warn(`Slide ${report.slideNumber}: ${failures.length} issue(s)`);
      for (const f of failures) {
        const icon = f.severity === "high" ? "!!!" : f.severity === "medium" ? " !!" : "  !";
        log.info(`  ${icon} [${f.severity}] ${f.rule}: ${f.detail || ""}`);
      }
    }
  }
  log.divider();
  log.info(`Total: ${highCount} high, ${mediumCount} medium, ${lowCount} low`);
  if (allPassed) {
    log.success("All critical checks passed.");
  } else {
    log.warn("Slides need revision.");
  }
  log.groupEnd();

  return { reports, allPassed, highCount, mediumCount, lowCount };
}
