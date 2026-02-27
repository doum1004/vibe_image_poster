import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

/**
 * Write content to a file, creating parent directories as needed.
 */
export async function writeOutputFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, content, "utf-8");
}

/**
 * Write binary content to a file, creating parent directories as needed.
 */
export async function writeBinaryFile(
  filePath: string,
  content: Buffer | Uint8Array,
): Promise<void> {
  await ensureDir(dirname(filePath));
  // Delete existing file first to guarantee a clean overwrite
  try {
    await unlink(filePath);
  } catch {
    // File doesn't exist — nothing to remove
  }
  await writeFile(filePath, content);
}

/**
 * Read a text file and return its contents.
 */
export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

/**
 * Read a JSON file and parse it.
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const text = await readTextFile(filePath);
  return JSON.parse(text) as T;
}

/**
 * Write a JSON file with pretty formatting.
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await writeOutputFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Create a slug from a topic string (supports Korean).
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List subdirectories in a directory.
 */
export async function listDirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Get the output directory for a given topic.
 */
export function getOutputDir(baseOutput: string, topic: string): string {
  const slug = slugify(topic);
  const timestamp = new Date().toISOString().slice(0, 10);
  return join(baseOutput, `${timestamp}_${slug}`);
}
