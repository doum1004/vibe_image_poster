import { readdir, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import textToSpeech from "@google-cloud/text-to-speech";
import ffmpegStatic from "ffmpeg-static";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { CopyOutput } from "../pipeline/types.js";
import { fileExists, readJsonFile } from "../utils/file.js";
import { log } from "../utils/logger.js";
import { getPreference, type TtsProvider } from "../utils/preferences.js";

export interface VideoBuildOptions {
  input: string;
  out?: string;
  secondsPerSlide?: number;
  fps?: number;
  ffmpegPath?: string;
  tts?: boolean;
  ttsProvider?: TtsProvider;
  ttsVoice?: string;
  ttsLanguage?: string;
  scriptFile?: string;
  format?: VideoFormat;
}

export const VIDEO_FORMATS = ["match-source", "short-form", "widescreen"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

const NarrationScript = z.object({
  slides: z.array(
    z.object({
      slideNumber: z.number().int().min(1),
      script: z.string().min(1),
    }),
  ),
});

export async function buildVideo(opts: VideoBuildOptions): Promise<void> {
  const secondsPerSlide = opts.secondsPerSlide ?? 4;
  const fps = opts.fps ?? 30;

  if (!Number.isFinite(secondsPerSlide) || secondsPerSlide <= 0) {
    throw new Error("--seconds-per-slide must be a positive number.");
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    throw new Error("--fps must be an integer between 1 and 120.");
  }

  const { slidesDir, outputPath, outputDir } = await resolvePaths(opts.input, opts.out);
  const slideAssets = await listSlidePngs(slidesDir);

  const ffmpeg = resolveFfmpegPath(opts.ffmpegPath);
  const format = opts.format ?? "match-source";
  const frameProfile = resolveFrameProfile(format);

  const ttsEnabled = opts.tts ?? false;
  const ttsSettings = resolveTtsSettings(opts);

  log.banner("SlideAgile: Build video");
  log.info(`Slides: ${slidesDir}`);
  log.info(`Output: ${outputPath}`);
  log.info(`Timing: ${secondsPerSlide}s per slide @ ${fps} fps`);
  log.info(`Format: ${frameProfile.label}`);
  log.info(`FFmpeg: ${ffmpeg}`);

  if (!ttsEnabled) {
    const inputPattern = join(slidesDir, "slide-%02d.png");
    const inputFps = 1 / secondsPerSlide;
    log.step("Running ffmpeg");
    const args = [
      "-y",
      "-framerate",
      inputFps.toString(),
      "-i",
      inputPattern,
      "-c:v",
      "libx264",
      "-r",
      String(fps),
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ];
    if (frameProfile.videoFilter) {
      args.splice(6, 0, "-vf", frameProfile.videoFilter);
    }
    await runFfmpeg(ffmpeg, args);
    log.divider();
    log.success(`Video created: ${outputPath}`);
    return;
  }

  if (ttsSettings.provider !== "gcp-hd") {
    throw new Error(
      `TTS provider "${ttsSettings.provider}" is not implemented yet. Use "gcp-hd" for now.`,
    );
  }

  const narrationBySlide = await loadNarrationBySlide(outputDir, opts.scriptFile);
  const tmpBase = join(outputDir, ".slideagile-video");
  const tempFiles: string[] = [];
  const segmentPaths: string[] = [];

  log.step(`Synthesizing per-slide narration with ${ttsSettings.provider}`);
  log.info(`Language: ${ttsSettings.language}`);
  log.info(`Voice: ${ttsSettings.voice ?? "(auto by language)"}`);

  try {
    for (const slide of slideAssets) {
      const slideText = narrationBySlide.get(slide.slideNumber) ?? null;
      const audioPath = `${tmpBase}-audio-${String(slide.slideNumber).padStart(2, "0")}.mp3`;
      const segmentPath = `${tmpBase}-segment-${String(slide.slideNumber).padStart(2, "0")}.mp4`;
      tempFiles.push(audioPath, segmentPath);
      segmentPaths.push(segmentPath);

      if (slideText) {
        await synthesizeGcpNarration(slideText, audioPath, ttsSettings.language, ttsSettings.voice);
      } else {
        // Keep timing stable for slides without copy content.
        await runFfmpeg(ffmpeg, [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "anullsrc=r=24000:cl=mono",
          "-t",
          String(secondsPerSlide),
          "-q:a",
          "9",
          "-acodec",
          "libmp3lame",
          audioPath,
        ]);
      }

      const segmentArgs = [
        "-y",
        "-loop",
        "1",
        "-i",
        slide.pngPath,
        "-i",
        audioPath,
        "-c:v",
        "libx264",
        "-r",
        String(fps),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        segmentPath,
      ];
      if (frameProfile.videoFilter) {
        segmentArgs.splice(7, 0, "-vf", frameProfile.videoFilter);
      }
      await runFfmpeg(ffmpeg, segmentArgs);
    }

    const concatPath = `${tmpBase}-segments.txt`;
    tempFiles.push(concatPath);
    await writeFile(
      concatPath,
      segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf-8",
    );

    log.step("Combining slide segments");
    await runFfmpeg(ffmpeg, [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c:v",
      "libx264",
      "-r",
      String(fps),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      outputPath,
    ]);
  } finally {
    for (const file of tempFiles) {
      await unlink(file).catch(() => undefined);
    }
  }

  log.divider();
  log.success(`Video created: ${outputPath}`);
}

async function resolvePaths(
  input: string,
  out?: string,
): Promise<{ slidesDir: string; outputPath: string; outputDir: string }> {
  const resolvedInput = resolve(input);
  const looksLikeSlidesDir = basename(resolvedInput).toLowerCase() === "slides";

  const slidesDir = looksLikeSlidesDir ? resolvedInput : join(resolvedInput, "slides");
  if (!(await fileExists(slidesDir))) {
    throw new Error(`slides directory not found: ${slidesDir}`);
  }

  const outputPath = out ? resolve(out) : join(looksLikeSlidesDir ? dirname(slidesDir) : resolvedInput, "deck.mp4");
  const outputDir = dirname(outputPath);
  return { slidesDir, outputPath, outputDir };
}

async function listSlidePngs(slidesDir: string): Promise<Array<{ slideNumber: number; pngPath: string }>> {
  const files = await readdir(slidesDir);
  const pngFiles = files.filter((f) => /^slide-\d+\.png$/.test(f)).sort();
  if (pngFiles.length === 0) {
    throw new Error(`No slide PNG files found in ${slidesDir}. Run slideagile generate first.`);
  }
  return pngFiles.map((file) => ({
    slideNumber: parseInt(file.match(/\d+/)?.[0] ?? "0", 10),
    pngPath: join(slidesDir, file),
  }));
}

async function runFfmpeg(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", (err) => {
      if ("code" in err && err.code === "ENOENT") {
        rejectPromise(
          new Error(
            "ffmpeg not found. Provide --ffmpeg <path> or set FFMPEG_PATH.",
          ),
        );
        return;
      }
      rejectPromise(err);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`ffmpeg exited with code ${code}.`));
    });
  });
}

function resolveFfmpegPath(cliPath?: string): string {
  if (cliPath && cliPath.trim().length > 0) return cliPath;

  const envPath = process.env.FFMPEG_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;

  if (typeof ffmpegStatic === "string" && ffmpegStatic.trim().length > 0) {
    return ffmpegStatic;
  }

  return "ffmpeg";
}

function resolveTtsSettings(
  opts: VideoBuildOptions,
): { provider: TtsProvider; voice?: string; language: string } {
  const config = loadConfig();
  const provider =
    opts.ttsProvider ??
    config.defaultTtsProvider ??
    getPreference("ttsProvider") ??
    "gcp-hd";

  const voice =
    opts.ttsVoice ??
    config.defaultTtsVoice ??
    getPreference("ttsVoice");

  const language =
    opts.ttsLanguage ??
    config.defaultTtsLanguage ??
    getPreference("ttsLanguage") ??
    "ko-KR";

  return { provider, voice, language };
}

function resolveFrameProfile(format: VideoFormat): { label: string; videoFilter?: string } {
  if (format === "match-source") {
    return {
      label: "Match source slide resolution",
    };
  }
  if (format === "widescreen") {
    return {
      label: "Widescreen long-form (1920x1080)",
      videoFilter:
        "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1",
    };
  }

  return {
    label: "Short-form mobile (1080x1920)",
    videoFilter:
      "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1",
  };
}

async function loadCopyBySlide(
  outputDir: string,
): Promise<Map<number, (typeof CopyOutput._output)["slides"][number]>> {
  const copyPath = join(outputDir, "copy.json");
  if (!(await fileExists(copyPath))) {
    throw new Error(`copy.json not found at ${copyPath}. Cannot build TTS narration.`);
  }

  const parsed = await readJsonFile(copyPath);
  const copy = CopyOutput.parse(parsed);
  return new Map(copy.slides.map((slide) => [slide.slideNumber, slide] as const));
}

function buildSlideNarrationFromCopy(
  slide?: (typeof CopyOutput._output)["slides"][number],
): string | null {
  if (!slide) return null;

  const lines = [
    slide.heading,
    slide.subheading,
    slide.bodyText,
    ...(slide.bulletPoints ?? []),
    slide.accentText,
    slide.ctaText,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0));

  if (lines.length === 0) return null;
  return lines.join(". ");
}

async function loadNarrationBySlide(
  outputDir: string,
  scriptFile?: string,
): Promise<Map<number, string>> {
  const copyBySlide = await loadCopyBySlide(outputDir);
  const explicitPath = scriptFile ? resolve(scriptFile) : null;
  const defaultPath = join(outputDir, "narration-script.json");
  const resolvedPath = explicitPath || ((await fileExists(defaultPath)) ? defaultPath : null);

  if (resolvedPath) {
    log.info(`Narration source: ${resolvedPath}`);
    const parsed = await readJsonFile(resolvedPath);
    const narration = NarrationScript.parse(parsed);
    const bySlide = new Map<number, string>();
    for (const slide of narration.slides) {
      const base = slide.script.trim();
      const anchored = anchorScriptToSlide(base, copyBySlide.get(slide.slideNumber));
      bySlide.set(slide.slideNumber, anchored);
    }

    for (const [slideNumber, copy] of copyBySlide.entries()) {
      if (bySlide.has(slideNumber)) continue;
      const fallback = buildSlideNarrationFromCopy(copy);
      if (fallback) bySlide.set(slideNumber, fallback);
    }

    return bySlide;
  }

  const bySlide = new Map<number, string>();
  for (const [slideNumber, slide] of copyBySlide.entries()) {
    const script = buildSlideNarrationFromCopy(slide);
    if (script) bySlide.set(slideNumber, script);
  }
  return bySlide;
}

function anchorScriptToSlide(
  script: string,
  slide?: (typeof CopyOutput._output)["slides"][number],
): string {
  if (!slide) return script;

  const anchor =
    slide.heading?.trim() ||
    slide.subheading?.trim() ||
    slide.accentText?.trim() ||
    slide.ctaText?.trim();

  if (!anchor) return script;

  const normalizedScript = normalizeForContains(script);
  const normalizedAnchor = normalizeForContains(anchor);
  if (normalizedScript.includes(normalizedAnchor)) {
    return script;
  }

  return `${anchor}. ${script}`;
}

function normalizeForContains(text: string): string {
  return text.toLowerCase().replace(/[\s.,!?;:'"()\-_/\\[\]{}]+/g, "");
}

async function synthesizeGcpNarration(
  text: string,
  outputPath: string,
  languageCode: string,
  voiceName?: string,
): Promise<void> {
  const client = new textToSpeech.TextToSpeechClient();
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode,
      ...(voiceName ? { name: voiceName } : {}),
    },
    audioConfig: {
      audioEncoding: "MP3",
    },
  });

  const audio = response.audioContent;
  if (!audio) {
    throw new Error("GCP TTS returned empty audio.");
  }

  if (typeof audio === "string") {
    await writeFile(outputPath, Buffer.from(audio, "base64"));
    return;
  }

  await writeFile(outputPath, Buffer.from(audio));
}
