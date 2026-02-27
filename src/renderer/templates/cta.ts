import type { SlideCopy } from "../../pipeline/types.js";

/**
 * Fallback CTA slide template.
 * The developer agent generates full HTML, but this serves as a baseline.
 */
export function ctaTemplate(
  copy: SlideCopy,
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  },
  seriesName: string,
): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --canvas-w: 1080px;
      --canvas-h: 1440px;
      --color-primary: ${colors.primary};
      --color-accent: ${colors.accent};
      --color-bg: ${colors.background};
      --color-text: ${colors.text};
      --pad: 80px;
      --fs-hero: 80px;
      --fs-title: 56px;
      --fs-body: 38px;
      --fs-caption: 28px;
      --bar-height: 64px;
    }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: var(--canvas-w);
      height: var(--canvas-h);
      overflow: hidden;
      font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
      word-break: keep-all;
      overflow-wrap: break-word;
    }
    body { background: var(--color-bg); color: var(--color-text); }
    .card {
      width: var(--canvas-w);
      height: var(--canvas-h);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-content {
      flex: 1;
      padding: var(--pad);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 48px;
    }
    .cta-heading {
      font-size: var(--fs-hero);
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }
    .cta-body {
      font-size: var(--fs-body);
      line-height: 1.5;
      max-width: 800px;
      opacity: 0.85;
    }
    .cta-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 24px 64px;
      background: var(--color-primary);
      color: #fff;
      font-size: var(--fs-body);
      font-weight: 700;
      border-radius: 16px;
      letter-spacing: -0.01em;
    }
    .accent { color: var(--color-accent); font-weight: 600; }
    .bottom-bar {
      width: 100%;
      height: var(--bar-height);
      background: #171717;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--fs-caption);
      font-weight: 500;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-content">
      <h2 class="cta-heading">${copy.heading || copy.ctaText || ""}</h2>
      ${copy.bodyText ? `<p class="cta-body">${copy.bodyText}</p>` : ""}
      ${copy.ctaText ? `<div class="cta-button">${copy.ctaText}</div>` : ""}
    </div>
    <div class="bottom-bar">@${seriesName}</div>
  </div>
</body>
</html>`;
}
