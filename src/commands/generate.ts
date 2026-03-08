import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CopyOutput } from "../pipeline/types.js";
import { closeBrowser, renderAllSlides } from "../renderer/png-exporter.js";
import { LEGACY_CANVAS } from "../renderer/slide-format.js";
import { reRenderAllSlides } from "../renderer/template-renderer.js";
import {
  ensureDir,
  fileExists,
  getOutputDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeOutputFile,
} from "../utils/file.js";
import { log } from "../utils/logger.js";
import { getPreference } from "../utils/preferences.js";

export interface GenerateOptions {
  theme?: string;
  output?: string;
  author?: string;
  template: string;
  rerender: string;
}

/**
 * Generate command: apply a copy.json to existing HTML templates and export PNGs.
 *
 * Requires --template (slides directory) and --rerender (copy.json path).
 */
export async function generate(opts: GenerateOptions): Promise<void> {
  await templateRerender(opts.template, opts.rerender, opts);
}

/**
 * Apply a user-provided copy.json to existing templates.
 * Creates a new output directory — source is never modified.
 */
async function templateRerender(
  templateDir: string,
  copyFile: string,
  options: GenerateOptions,
): Promise<void> {
  log.banner("SlideAgile: Apply copy to templates");
  log.info(`Source templates: ${templateDir}`);
  log.divider();

  const sourceSlidesDir = join(templateDir, "slides");
  if (!(await fileExists(sourceSlidesDir))) {
    log.error(`slides/ directory not found at ${sourceSlidesDir}`);
    log.info("Provide a directory from a previous run that contains a slides/ folder.");
    process.exit(1);
  }

  if (!(await fileExists(copyFile))) {
    log.error(`copy.json not found at ${copyFile}`);
    process.exit(1);
  }

  log.step("Reading copy.json");
  const rawCopy = await readJsonFile(copyFile);
  let copyOutput: typeof CopyOutput._output;
  try {
    copyOutput = CopyOutput.parse(rawCopy);
  } catch (err) {
    log.error("Invalid copy.json format", err instanceof Error ? err : undefined);
    process.exit(1);
  }
  log.success(`Loaded ${copyOutput.slides.length} slides from copy.json`);

  const baseOutput = options.output || dirname(templateDir);
  const newOutputDir = getOutputDir(baseOutput, copyOutput.title || "reuse");
  const newSlidesDir = join(newOutputDir, "slides");

  log.step(`Creating new output: ${newOutputDir}`);

  const htmlFiles = await copyTemplates(sourceSlidesDir, newSlidesDir);
  log.success(`Copied ${htmlFiles.length} HTML templates`);
  await copySourceArtifacts(templateDir, newOutputDir);

  log.step("Applying copy data to HTML templates");
  const author = options.author || process.env.DEFAULT_AUTHOR || getPreference("author") || "@SlideForge";
  const updatedSlides = await reRenderAllSlides(newSlidesDir, copyOutput, { author });

  await writeJsonFile(join(newOutputDir, "copy.json"), copyOutput);

  log.step("Rendering PNGs");
  let pngCount = 0;
  try {
    const formatMetaPath = join(newOutputDir, "slide-format.json");
    const formatMeta =
      (await fileExists(formatMetaPath))
        ? await readJsonFile<{ width?: number; height?: number }>(formatMetaPath)
        : null;
    const canvas =
      formatMeta?.width && formatMeta?.height
        ? { width: formatMeta.width, height: formatMeta.height }
        : LEGACY_CANVAS;
    const pngPaths = await renderAllSlides(updatedSlides, newSlidesDir, canvas);
    pngCount = pngPaths.size;
  } finally {
    await closeBrowser();
  }

  log.divider();
  log.banner("Generate Complete!");
  log.info(`New output: ${newOutputDir}`);
  log.info(`Slides updated: ${updatedSlides.size}`);
  log.info(`PNG files: ${pngCount}`);
  log.divider();
}

/**
 * Copy HTML template files from source slides/ to a new slides/ directory.
 */
async function copyTemplates(sourceSlidesDir: string, destSlidesDir: string): Promise<string[]> {
  await ensureDir(destSlidesDir);

  const files = await readdir(sourceSlidesDir);
  const htmlFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();

  if (htmlFiles.length === 0) {
    throw new Error(`No slide HTML files found in ${sourceSlidesDir}`);
  }

  for (const file of htmlFiles) {
    const content = await readTextFile(join(sourceSlidesDir, file));
    await writeOutputFile(join(destSlidesDir, file), content);
  }

  return htmlFiles;
}

/**
 * Copy JSON artifacts (plan.json, design-brief.json) from source to new output dir
 * so the new folder is self-contained.
 */
async function copySourceArtifacts(sourceDir: string, newOutputDir: string): Promise<void> {
  const artifacts = ["plan.json", "design-brief.json", "slide-format.json"];
  for (const name of artifacts) {
    const src = join(sourceDir, name);
    if (await fileExists(src)) {
      const content = await readTextFile(src);
      await writeOutputFile(join(newOutputDir, name), content);
    }
  }
}
