import { readTextFile } from "../utils/file.js";
import { resolveFromSrc } from "../utils/paths.js";
import { LEGACY_CANVAS, type SlideCanvas } from "./slide-format.js";

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
 * Reads a theme CSS file.
 */
export async function getThemeCSS(theme: string): Promise<string> {
  const themePath = resolveFromSrc("design-system", "themes", theme, "theme.css");
  try {
    return await readTextFile(themePath);
  } catch {
    return "/* no theme overrides */";
  }
}

/**
 * CSS media query that enables scrolling when the HTML is opened
 * in a normal browser (viewport smaller than the 1080x1440 canvas).
 * Puppeteer renders at exactly 1080x1440, so this does NOT activate
 * during PNG export.
 */
function getBrowserPreviewCss(canvas: SlideCanvas): string {
  return `
/* Browser preview: scale card to fit viewport height */
@media (max-width: ${canvas.width - 1}px), (max-height: ${canvas.height - 1}px) {
  html {
    width: 100% !important;
    height: 100vh !important;
    overflow: hidden !important;
  }
  body {
    width: 100% !important;
    height: 100vh !important;
    overflow: hidden !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #222 !important;
  }
  .card {
    transform-origin: center center;
    margin: 0 auto;
    flex-shrink: 0;
  }
}`;
}

function getBrowserPreviewJs(canvas: SlideCanvas): string {
  return [
    "<script>",
    "(function() {",
    `  var CARD_W = ${canvas.width}, CARD_H = ${canvas.height};`,
    "  function fit() {",
    `    if (window.innerWidth >= ${canvas.width} && window.innerHeight >= ${canvas.height}) return;`,
    "    var card = document.querySelector('.card');",
    "    if (!card) return;",
    "    var scaleX = window.innerWidth / CARD_W;",
    "    var scaleY = window.innerHeight / CARD_H;",
    "    var scale = Math.min(scaleX, scaleY);",
    "    card.style.transform = 'scale(' + scale + ')';",
    "  }",
    "  window.addEventListener('resize', fit);",
    "  window.addEventListener('DOMContentLoaded', fit);",
    "  fit();",
    "})();",
    "</script>",
  ].join("\n");
}

/**
 * Inject browser-preview CSS into a complete HTML document.
 * Inserts before the closing </style> or </head> tag.
 */
function injectPreviewCSS(html: string, canvas: SlideCanvas): string {
  const previewCss = getBrowserPreviewCss(canvas);
  const previewJs = getBrowserPreviewJs(canvas);
  // Inject CSS before the last </style> tag
  const styleCloseIdx = html.lastIndexOf("</style>");
  if (styleCloseIdx !== -1) {
    html = `${html.slice(0, styleCloseIdx)}${previewCss}\n${html.slice(styleCloseIdx)}`;
  } else {
    // Fallback: insert before </head>
    const headCloseIdx = html.indexOf("</head>");
    if (headCloseIdx !== -1) {
      html =
        html.slice(0, headCloseIdx) +
        `<style>${previewCss}\n</style>\n` +
        html.slice(headCloseIdx);
    }
  }

  // Inject scaling JS before </body>
  const bodyCloseIdx = html.lastIndexOf("</body>");
  if (bodyCloseIdx !== -1) {
    html = `${html.slice(0, bodyCloseIdx)}${previewJs}\n${html.slice(bodyCloseIdx)}`;
  } else {
    html += previewJs;
  }

  return html;
}

/**
 * Assembles a complete standalone HTML document for a slide.
 * Merges design tokens + base styles + theme + slide-specific CSS + content.
 */
export async function buildSlideHtml(
  slideHtml: string,
  theme: string,
  canvas: SlideCanvas = LEGACY_CANVAS,
): Promise<string> {
  // If the HTML already has <!DOCTYPE, assume it's already complete
  if (slideHtml.trim().startsWith("<!DOCTYPE") || slideHtml.trim().startsWith("<html")) {
    return injectPreviewCSS(slideHtml, canvas);
  }

  // Otherwise, wrap the content in a complete HTML document
  const tokens = await getDesignTokensCSS();
  const baseStyles = await getBaseStylesCSS();
  const themeCSS = await getThemeCSS(theme);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
${tokens}
${baseStyles}
${themeCSS}
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
