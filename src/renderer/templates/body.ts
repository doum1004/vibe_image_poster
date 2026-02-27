import type { SlideCopy } from "../../pipeline/types.js";

/**
 * Fallback body slide template.
 * The developer agent generates full HTML, but this serves as a baseline.
 */
export function bodyTemplate(
  copy: SlideCopy,
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  },
  seriesName: string,
): string {
  const bullets = copy.bulletPoints?.length
    ? `<ul class="bullet-list">
        ${copy.bulletPoints.map((b) => `<li>${b}</li>`).join("\n        ")}
      </ul>`
    : "";

  const bodyParagraph = copy.bodyText ? `<p class="text-body">${copy.bodyText}</p>` : "";

  const accentBlock = copy.accentText
    ? `<p class="accent-block"><span class="accent">${copy.accentText}</span></p>`
    : "";

  const footnote = copy.footnote ? `<p class="footnote">${copy.footnote}</p>` : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --canvas-w: 1080px;
      --canvas-h: 1440px;
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      --color-bg: ${colors.background};
      --color-text: ${colors.text};
      --pad: 72px;
      --fs-title: 52px;
      --fs-subtitle: 42px;
      --fs-body: 36px;
      --fs-body-sm: 32px;
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
       gap: 32px;
    }
    .slide-header { display: flex; flex-direction: column; gap: 16px; }
    .text-title {
      font-size: var(--fs-title);
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }
    .text-subtitle {
      font-size: var(--fs-subtitle);
      font-weight: 600;
      line-height: 1.35;
      color: var(--color-secondary);
    }
    .text-body {
      font-size: var(--fs-body);
      font-weight: 400;
      line-height: 1.5;
    }
    .bullet-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 20px;
      font-size: var(--fs-body-sm);
      line-height: 1.5;
    }
    .bullet-list li {
      padding-left: 32px;
      position: relative;
    }
    .bullet-list li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 14px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-primary);
    }
    .accent { color: var(--color-accent); font-weight: 600; }
    .accent-block {
      font-size: var(--fs-body);
      padding: 32px;
      background: color-mix(in srgb, var(--color-accent) 10%, transparent);
      border-radius: 16px;
      border-left: 6px solid var(--color-accent);
    }
    .footnote {
      font-size: var(--fs-caption);
      color: #737373;
      margin-top: auto;
    }
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
      <div class="slide-header">
        ${copy.heading ? `<h2 class="text-title">${copy.heading}</h2>` : ""}
        ${copy.subheading ? `<p class="text-subtitle">${copy.subheading}</p>` : ""}
      </div>
      ${bodyParagraph}
      ${bullets}
      ${accentBlock}
      ${footnote}
    </div>
    <div class="bottom-bar">@${seriesName}</div>
  </div>
</body>
</html>`;
}
