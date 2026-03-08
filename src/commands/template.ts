import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { ensureDir, fileExists, listDirs, readTextFile, writeOutputFile } from "../utils/file.js";
import { log } from "../utils/logger.js";

const TEMPLATES_DIR = "./templates";

/**
 * List all saved templates in the templates directory.
 * Each template is a named subfolder containing slides/ and optional JSON artifacts.
 */
export async function listTemplates(): Promise<void> {
  const dirs = await listDirs(TEMPLATES_DIR);

  if (dirs.length === 0) {
    log.info("No saved templates.");
    log.info(`Add one with: slideagile template add <output-folder>`);
    return;
  }

  log.banner("Saved Templates");
  for (const name of dirs.sort()) {
    const slidesDir = join(TEMPLATES_DIR, name, "slides");
    const slideFiles = await countSlides(slidesDir);
    log.info(`  ${name}  (${slideFiles} slides)`);
  }
  log.divider();
  log.info(`Location: ${TEMPLATES_DIR}/`);
}

/**
 * Copy an output folder's template files (slides/ + JSON artifacts)
 * into the templates directory under a given name.
 */
export async function addTemplate(sourceDir: string, name?: string): Promise<void> {
  // Validate source has slides/
  const sourceSlidesDir = join(sourceDir, "slides");
  if (!(await fileExists(sourceSlidesDir))) {
    log.error(`slides/ directory not found at ${sourceSlidesDir}`);
    log.info("Provide an output directory from a previous run.");
    process.exit(1);
  }

  // Derive template name from folder basename if not provided
  const templateName = name || basename(sourceDir);
  const destDir = join(TEMPLATES_DIR, templateName);

  if (await fileExists(destDir)) {
    log.error(`Template "${templateName}" already exists.`);
    log.info(`Remove it first or choose a different name with: slideagile template add <dir> <name>`);
    process.exit(1);
  }

  // Copy slides
  const destSlidesDir = join(destDir, "slides");
  await ensureDir(destSlidesDir);

  const files = await readdir(sourceSlidesDir);
  const htmlFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();

  if (htmlFiles.length === 0) {
    log.error(`No slide HTML files found in ${sourceSlidesDir}`);
    process.exit(1);
  }

  for (const file of htmlFiles) {
    const content = await readTextFile(join(sourceSlidesDir, file));
    await writeOutputFile(join(destSlidesDir, file), content);
  }

  // Copy JSON artifacts (plan.json, design-brief.json)
  const artifacts = ["plan.json", "design-brief.json", "slide-format.json"];
  for (const artifact of artifacts) {
    const src = join(sourceDir, artifact);
    if (await fileExists(src)) {
      const content = await readTextFile(src);
      await writeOutputFile(join(destDir, artifact), content);
    }
  }

  log.success(`Template "${templateName}" saved (${htmlFiles.length} slides)`);
  log.info(`Location: ${destDir}`);
  log.info(`Use with: slideagile generate --template ${destDir} --rerender copy.json`);
}

async function countSlides(slidesDir: string): Promise<number> {
  try {
    const files = await readdir(slidesDir);
    return files.filter((f) => /^slide-\d+\.html$/.test(f)).length;
  } catch {
    return 0;
  }
}
