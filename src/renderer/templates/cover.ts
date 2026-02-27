import type { SlideCopy } from "../../pipeline/types.js";

/**
 * Generate cover slide HTML content.
 * The developer agent generates full HTML, but this serves as a fallback template.
 */
export function coverTemplate(
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
      --fs-subtitle: 44px;
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
      justify-content: center;
      gap: 32px;
    }
    .series-label {
      font-size: var(--fs-caption);
      font-weight: 600;
      color: var(--color-primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .hero-title {
      font-size: var(--fs-hero);
      font-weight: 900;
      line-height: 1.2;
      letter-spacing: -0.03em;
    }
    .subtitle {
      font-size: var(--fs-subtitle);
      font-weight: 400;
      line-height: 1.4;
      opacity: 0.8;
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
      <div class="series-label">@${seriesName}</div>
      <h1 class="hero-title">${copy.heading || ""}</h1>
      ${copy.subheading ? `<p class="subtitle">${copy.subheading}</p>` : ""}
    </div>
    <div class="bottom-bar">@${seriesName}</div>
  </div>
</body>
</html>`;
}
