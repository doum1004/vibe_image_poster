import { join } from "node:path";
import { CopyOutput } from "../pipeline/types.js";
import { renderAllSlides } from "../renderer/png-exporter.js";
import { reRenderAllSlides } from "../renderer/template-renderer.js";
import { fileExists, readJsonFile } from "../utils/file.js";
import { log } from "../utils/logger.js";

/**
 * Re-render slides from an existing output directory.
 *
 * Reads copy.json and slide HTML templates, applies the copy data
 * to the templates via data-bind attributes, then re-exports PNGs.
 *
 * This allows users to edit copy.json manually and regenerate
 * slides without running the full AI pipeline.
 *
 * @param outputDir - Path to the output directory (e.g., ./output/2026-02-27_topic)
 */
export async function reRender(outputDir: string): Promise<void> {
  log.banner("Re-render: Update slides from copy.json");
  log.info(`Output directory: ${outputDir}`);
  log.divider();

  // Validate that required files exist
  const copyPath = join(outputDir, "copy.json");
  const slidesDir = join(outputDir, "slides");

  if (!(await fileExists(copyPath))) {
    log.error(`copy.json not found at ${copyPath}`);
    log.info("Run the full pipeline first to generate initial output.");
    process.exit(1);
  }

  if (!(await fileExists(slidesDir))) {
    log.error(`slides/ directory not found at ${slidesDir}`);
    log.info("Run the full pipeline first to generate initial output.");
    process.exit(1);
  }

  // Read and validate copy data
  log.step("Reading copy.json");
  const rawCopy = await readJsonFile(copyPath);
  let copyOutput: typeof CopyOutput._output;
  try {
    copyOutput = CopyOutput.parse(rawCopy);
  } catch (err) {
    log.error("Invalid copy.json format", err instanceof Error ? err : undefined);
    process.exit(1);
  }
  log.success(`Loaded ${copyOutput.slides.length} slides from copy.json`);

  // Re-render HTML from templates + copy data
  log.step("Applying copy data to HTML templates");
  const updatedSlides = await reRenderAllSlides(slidesDir, copyOutput);

  // Re-export PNGs
  log.step("Rendering PNGs");
  const pngPaths = await renderAllSlides(updatedSlides, slidesDir);

  // Summary
  log.divider();
  log.banner("Re-render Complete!");
  log.info(`Output directory: ${outputDir}`);
  log.info(`Slides updated: ${updatedSlides.size}`);
  log.info(`PNG files: ${pngPaths.size}`);
  log.divider();
}
