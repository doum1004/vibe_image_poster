import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { CopyOutput, SlideCopy } from "../pipeline/types.js";
import { readTextFile, writeOutputFile } from "../utils/file.js";
import { log } from "../utils/logger.js";

/**
 * Mapping from data-bind attribute values to SlideCopy field names.
 */
const BIND_FIELD_MAP: Record<string, keyof SlideCopy> = {
  heading: "heading",
  subheading: "subheading",
  body: "bodyText",
  accentText: "accentText",
  footnote: "footnote",
  ctaText: "ctaText",
};

/**
 * Escape HTML special characters in text content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace the text content of elements with a specific data-bind attribute.
 *
 * Uses regex to find elements like: <tag data-bind="key"...>old content</tag>
 * and replaces the inner text with the new value.
 *
 * This approach handles:
 * - Single-line elements: <h1 data-bind="heading">text</h1>
 * - Elements with other attributes before/after data-bind
 * - Nested inline elements (accent, strong) are replaced with plain text
 */
function replaceBindContent(html: string, bindKey: string, newContent: string): string {
  // Match: <tag ... data-bind="key" ...>content</tag>
  // Capture groups: (1) opening tag with attrs, (2) tag name, (3) closing tag
  const pattern = new RegExp(
    `(<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bdata-bind="${bindKey}"[^>]*>)([\\s\\S]*?)(<\\/\\2>)`,
    "gi",
  );

  return html.replace(pattern, (_match, openTag, _tagName, _oldContent, closeTag) => {
    return `${openTag}${escapeHtml(newContent)}${closeTag}`;
  });
}

/**
 * Replace bullet list content.
 *
 * Finds the element with data-bind="bullets" and replaces its <li> children
 * with new items from the copy data.
 */
function replaceBullets(html: string, bullets: string[]): string {
  // Match: <ul/ol ... data-bind="bullets" ...>...list items...</ul/ol>
  const pattern = /(<(ul|ol)\b[^>]*\bdata-bind="bullets"[^>]*>)([\s\S]*?)(<\/\2>)/gi;

  return html.replace(pattern, (_, openTag, _tagName, oldContent, closeTag) => {
    // Detect indentation from the original list items
    const liMatch = oldContent.match(/^(\s*)<li/m);
    const indent = liMatch ? liMatch[1] : "      ";

    const newItems = bullets
      .map((b) => `${indent}<li data-bind="bullet">${escapeHtml(b)}</li>`)
      .join("\n");

    return `${openTag}\n${newItems}\n${indent.replace(/ {2}$/, "")}${closeTag}`;
  });
}

/**
 * Apply copy data to an HTML template by replacing data-bind element contents.
 *
 * @param htmlTemplate - The HTML string with data-bind attributes
 * @param slideCopy - The copy data to inject
 * @returns The HTML with updated content
 */
export function renderTemplateWithCopy(htmlTemplate: string, slideCopy: SlideCopy): string {
  let result = htmlTemplate;

  // Replace simple text bindings
  for (const [bindKey, fieldName] of Object.entries(BIND_FIELD_MAP)) {
    const value = slideCopy[fieldName];
    if (typeof value === "string" && value.length > 0) {
      result = replaceBindContent(result, bindKey, value);
    }
  }

  // Replace bullet list
  if (slideCopy.bulletPoints && slideCopy.bulletPoints.length > 0) {
    result = replaceBullets(result, slideCopy.bulletPoints);
  }

  return result;
}

function replaceBottomBarAuthor(html: string, author: string): string {
  // Replace existing text inside .bottom-bar while keeping element/attributes intact.
  const pattern = /(<[^>]*class="[^"]*\bbottom-bar\b[^"]*"[^>]*>)([\s\S]*?)(<\/[^>]+>)/gi;
  return html.replace(pattern, (_match, openTag, _oldContent, closeTag) => {
    return `${openTag}${escapeHtml(author)}${closeTag}`;
  });
}

/**
 * Check if an HTML file contains data-bind attributes.
 */
export function hasDataBindings(html: string): boolean {
  return /\bdata-bind="/.test(html);
}

/**
 * Re-render all slide HTML templates in a directory with updated copy data.
 *
 * @param slidesDir - Directory containing slide-XX.html files
 * @param copyOutput - The copy data (from copy.json)
 * @returns Map of slide number to updated HTML content
 */
export async function reRenderAllSlides(
  slidesDir: string,
  copyOutput: CopyOutput,
  options?: { author?: string },
): Promise<Map<number, string>> {
  const updatedSlides = new Map<number, string>();

  // Find all slide HTML files
  const files = await readdir(slidesDir);
  const slideFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();

  if (slideFiles.length === 0) {
    throw new Error(`No slide HTML files found in ${slidesDir}`);
  }

  log.group("Re-rendering slides from copy data");

  let bindWarningShown = false;

  for (const file of slideFiles) {
    const match = file.match(/^slide-(\d+)\.html$/);
    if (!match) continue;

    const slideNumber = parseInt(match[1], 10);
    const filePath = join(slidesDir, file);
    const html = await readTextFile(filePath);

    // Find corresponding copy data
    const slideCopy = copyOutput.slides.find((s) => s.slideNumber === slideNumber);

    if (!slideCopy) {
      log.warn(`No copy data for slide ${slideNumber}, keeping original HTML`);
      updatedSlides.set(slideNumber, html);
      continue;
    }

    // Check if template has data-bind attributes
    if (!hasDataBindings(html)) {
      if (!bindWarningShown) {
        log.warn(
          "HTML files do not contain data-bind attributes. " +
            "They may have been generated before template support was added. " +
            "Re-run the full pipeline to generate template HTML.",
        );
        bindWarningShown = true;
      }
      updatedSlides.set(slideNumber, html);
      continue;
    }

    let updated = renderTemplateWithCopy(html, slideCopy);
    if (options?.author) {
      updated = replaceBottomBarAuthor(updated, options.author);
    }
    updatedSlides.set(slideNumber, updated);

    // Write updated HTML back to disk
    await writeOutputFile(filePath, updated);
    log.success(`slide-${match[1]}.html updated`);
  }

  log.groupEnd();

  return updatedSlides;
}
