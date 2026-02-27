import { readTextFile } from "../utils/file.js";
import { resolveFromSrc } from "../utils/paths.js";

/**
 * Reads the shared design tokens CSS file.
 */
export async function getDesignTokensCSS(): Promise<string> {
  const tokensPath = resolveFromSrc("design-system", "shared", "design-tokens.css");
  return readTextFile(tokensPath);
}

/**
 * Reads the shared base styles CSS file.
 */
export async function getBaseStylesCSS(): Promise<string> {
  const stylesPath = resolveFromSrc("design-system", "shared", "base-styles.css");
  return readTextFile(stylesPath);
}

/**
 * Reads a series theme CSS file.
 */
export async function getThemeCSS(series: string): Promise<string> {
  const themePath = resolveFromSrc("design-system", "series", series, "theme.css");
  try {
    return await readTextFile(themePath);
  } catch {
    return "/* no theme overrides */";
  }
}

/**
 * Assembles a complete standalone HTML document for a slide.
 * Merges design tokens + base styles + theme + slide-specific CSS + content.
 */
export async function buildSlideHtml(slideHtml: string, series: string): Promise<string> {
  // If the HTML already has <!DOCTYPE, assume it's already complete
  if (slideHtml.trim().startsWith("<!DOCTYPE") || slideHtml.trim().startsWith("<html")) {
    return slideHtml;
  }

  // Otherwise, wrap the content in a complete HTML document
  const tokens = await getDesignTokensCSS();
  const baseStyles = await getBaseStylesCSS();
  const theme = await getThemeCSS(series);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
${tokens}
${baseStyles}
${theme}
  </style>
</head>
<body>
  ${slideHtml}
</body>
</html>`;
}

/**
 * Validates that an HTML string appears to be a valid standalone slide.
 * Returns a list of issues found.
 */
export function quickValidateHtml(html: string): string[] {
  const issues: string[] = [];

  if (!html.includes("<!DOCTYPE html>") && !html.includes("<!doctype html>")) {
    issues.push("Missing <!DOCTYPE html>");
  }
  if (!html.includes('lang="ko"')) {
    issues.push('Missing lang="ko" attribute');
  }
  if (!html.includes("overflow") || !html.includes("hidden")) {
    issues.push("Missing overflow:hidden");
  }
  if (!html.includes("keep-all")) {
    issues.push("Missing word-break:keep-all");
  }
  if (!html.includes("bottom-bar")) {
    issues.push("Missing .bottom-bar element");
  }
  if (html.includes("http://") || html.includes("https://")) {
    issues.push("Contains external URL reference");
  }

  return issues;
}
