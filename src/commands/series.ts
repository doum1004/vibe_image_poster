import { join } from "node:path";
import { ensureDir, fileExists, listDirs, writeJsonFile, writeOutputFile } from "../utils/file.js";
import { log } from "../utils/logger.js";
import { resolveFromSrc } from "../utils/paths.js";

function getSeriesDir(): string {
  return resolveFromSrc("design-system", "series");
}

export async function listSeries(): Promise<void> {
  const seriesDir = getSeriesDir();
  const dirs = await listDirs(seriesDir);

  if (dirs.length === 0) {
    log.warn("No series found.");
    return;
  }

  log.banner("Available Series");
  for (const name of dirs) {
    log.info(`  ${name}`);
  }
}

export async function createSeries(name: string): Promise<void> {
  const seriesDir = join(getSeriesDir(), name);

  if (await fileExists(seriesDir)) {
    log.error(`Series "${name}" already exists.`);
    process.exit(1);
  }

  await ensureDir(seriesDir);

  // Create theme.json
  await writeJsonFile(join(seriesDir, "theme.json"), {
    name,
    description: `${name} series theme`,
    createdAt: new Date().toISOString(),
  });

  // Create theme.css with overridable tokens
  const themeCss = `/* ${name} series theme overrides */
/* Override any design token from shared/design-tokens.css here */

:root {
  /* Example overrides: */
  /* --color-primary: #your-color; */
  /* --color-accent: #your-accent; */
  /* --fs-title: 60px; */
}
`;
  await writeOutputFile(join(seriesDir, "theme.css"), themeCss);

  log.success(`Series "${name}" created at ${seriesDir}`);
  log.info("Edit theme.css to customize design tokens for this series.");
}
