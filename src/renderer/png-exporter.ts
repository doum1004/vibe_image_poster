import puppeteer, { type Browser } from "puppeteer-core";
import { getConfig } from "../config.js";
import { writeBinaryFile } from "../utils/file.js";
import { log } from "../utils/logger.js";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1440;

let browserInstance: Browser | null = null;

/**
 * Find Chrome/Chromium executable path.
 * Checks config first, then common installation paths.
 */
async function findChromePath(): Promise<string> {
  const config = getConfig();
  if (config.chromePath) return config.chromePath;

  // Common paths by platform
  const platform = process.platform;
  const candidates: string[] = [];

  if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    );
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    );
  }

  for (const candidate of candidates) {
    try {
      const file = Bun.file(candidate);
      const exists = await file.exists();
      if (exists) {
        return candidate;
      }
    } catch {}
  }

  throw new Error(
    "Chrome/Chromium not found. Set CHROME_PATH in .env or install Chrome.\n" +
      "Checked paths:\n" +
      candidates.map((p) => `  - ${p}`).join("\n"),
  );
}

/**
 * Get or create a shared browser instance.
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) {
    return browserInstance;
  }

  const chromePath = await findChromePath();
  log.debug(`Using Chrome at: ${chromePath}`);

  browserInstance = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
      "--disable-gpu",
    ],
  });

  return browserInstance;
}

/**
 * Close the shared browser instance.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Render a standalone HTML string to a PNG file.
 * Uses page.setContent() to avoid file:// protocol issues.
 */
export async function renderHtmlToPng(htmlContent: string, outputPath: string): Promise<void> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      deviceScaleFactor: 1,
    });

    // Use setContent to avoid file:// CORS issues
    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });

    // Wait for fonts to be ready (runs in browser context)
    await page.evaluate("document.fonts.ready");

    const screenshot = await page.screenshot({
      type: "png",
      fullPage: false, // Clip to viewport only (1080x1440)
      omitBackground: false,
    });

    await writeBinaryFile(outputPath, Buffer.from(screenshot));
  } finally {
    await page.close();
  }
}

/**
 * Render multiple HTML slides to PNG files.
 * Reuses the browser instance for efficiency.
 */
export async function renderAllSlides(
  slides: Map<number, string>,
  outputDir: string,
): Promise<Map<number, string>> {
  const pngPaths = new Map<number, string>();

  log.group("Rendering slides to PNG");

  for (const [num, html] of slides.entries()) {
    const padded = String(num).padStart(2, "0");
    const pngPath = `${outputDir}/slide-${padded}.png`;

    log.info(`Rendering slide ${padded}...`);
    await renderHtmlToPng(html, pngPath);
    pngPaths.set(num, pngPath);
    log.success(`slide-${padded}.png`);
  }

  log.groupEnd();

  // Clean up browser after all renders
  await closeBrowser();

  return pngPaths;
}
