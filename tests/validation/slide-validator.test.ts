import { describe, expect, it } from "bun:test";
import { validateAllSlides, validateSlide } from "../../src/validation/slide-validator.js";

const VALID_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    :root { --canvas-w: 1080px; --canvas-h: 1440px; }
    html, body { width: 1080px; height: 1440px; overflow: hidden; }
    body { font-family: sans-serif; word-break: keep-all; font-size: 38px; }
    .card { width: 1080px; height: 1440px; overflow: hidden; }
    .bottom-bar { height: 64px; background: #171717; color: #fff; font-size: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-content">
      <h2 style="font-size: 56px;">Test Heading</h2>
      <p>Test body text</p>
    </div>
    <div class="bottom-bar">@default</div>
  </div>
</body>
</html>`;

const INVALID_HTML_NO_OVERFLOW = `<!DOCTYPE html>
<html lang="ko">
<head>
  <style>
    html, body { width: 1080px; height: 1440px; }
    body { font-family: sans-serif; word-break: keep-all; font-size: 38px; }
    .bottom-bar { font-size: 28px; }
  </style>
</head>
<body>
  <div class="card"><div class="bottom-bar">@test</div></div>
</body>
</html>`;

const INVALID_HTML_SMALL_FONT = `<!DOCTYPE html>
<html lang="ko">
<head>
  <style>
    html, body { width: 1080px; height: 1440px; overflow: hidden; }
    body { font-family: sans-serif; word-break: keep-all; }
    .card { overflow: hidden; }
    .small { font-size: 14px; }
    .bottom-bar { font-size: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="small">tiny text</span>
    <div class="bottom-bar">@test</div>
  </div>
</body>
</html>`;

const INVALID_HTML_EXTERNAL_URL = `<!DOCTYPE html>
<html lang="ko">
<head>
  <style>
    html, body { width: 1080px; height: 1440px; overflow: hidden; }
    body { font-family: sans-serif; word-break: keep-all; font-size: 38px; }
    .card { overflow: hidden; }
    .bottom-bar { font-size: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://example.com/image.png" />
    <div class="bottom-bar">@test</div>
  </div>
</body>
</html>`;

describe("validateSlide", () => {
  it("passes valid HTML", () => {
    const report = validateSlide(VALID_HTML, 1);
    const failures = report.results.filter((r) => !r.passed);
    expect(failures).toEqual([]);
  });

  it("detects missing overflow:hidden", () => {
    const report = validateSlide(INVALID_HTML_NO_OVERFLOW, 1);
    const overflowRule = report.results.find((r) => r.rule === "overflow-hidden");
    expect(overflowRule?.passed).toBe(false);
  });

  it("detects font size below 28px", () => {
    const report = validateSlide(INVALID_HTML_SMALL_FONT, 1);
    const fontRule = report.results.find((r) => r.rule === "min-font-size");
    expect(fontRule?.passed).toBe(false);
    expect(fontRule?.detail).toContain("14");
  });

  it("detects external URLs", () => {
    const report = validateSlide(INVALID_HTML_EXTERNAL_URL, 1);
    const urlRule = report.results.find((r) => r.rule === "no-external-urls");
    expect(urlRule?.passed).toBe(false);
  });

  it("detects missing bottom-bar", () => {
    const html = VALID_HTML.replace(/bottom-bar/g, "footer");
    const report = validateSlide(html, 1);
    const barRule = report.results.find((r) => r.rule === "bottom-bar");
    expect(barRule?.passed).toBe(false);
  });

  it("detects too many accent elements", () => {
    const html = VALID_HTML.replace(
      "<p>Test body text</p>",
      '<span class="accent">a</span><span class="accent">b</span><span class="accent">c</span>',
    );
    const report = validateSlide(html, 1);
    const accentRule = report.results.find((r) => r.rule === "accent-limit");
    expect(accentRule?.passed).toBe(false);
  });

  it("detects too many strong elements", () => {
    const html = VALID_HTML.replace(
      "<p>Test body text</p>",
      "<strong>a</strong><strong>b</strong>",
    );
    const report = validateSlide(html, 1);
    const strongRule = report.results.find((r) => r.rule === "strong-limit");
    expect(strongRule?.passed).toBe(false);
  });
});

describe("validateAllSlides", () => {
  it("validates multiple slides and counts issues", () => {
    const slides = new Map<number, string>();
    slides.set(1, VALID_HTML);
    slides.set(2, INVALID_HTML_SMALL_FONT);

    const result = validateAllSlides(slides);
    expect(result.reports.length).toBe(2);
    expect(result.highCount).toBeGreaterThan(0);
    expect(result.allPassed).toBe(false);
  });

  it("passes when all slides are valid", () => {
    const slides = new Map<number, string>();
    slides.set(1, VALID_HTML);
    slides.set(2, VALID_HTML);

    const result = validateAllSlides(slides);
    expect(result.allPassed).toBe(true);
    expect(result.highCount).toBe(0);
    expect(result.mediumCount).toBe(0);
  });
});
