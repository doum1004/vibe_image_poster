/**
 * Generates a standalone presentation HTML file that displays all slides
 * in a carousel with keyboard/touch navigation and HTML↔PNG toggle.
 *
 * Features:
 *  - Arrow keys / swipe / click to navigate slides
 *  - Toggle between live HTML (iframe) and rendered PNG views
 *  - Slide counter and thumbnail strip
 *  - Fullscreen support
 *  - Zero external dependencies — single self-contained HTML file
 */

import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { readTextFile, writeOutputFile } from "../utils/file.js";

/**
 * Build a presentation HTML file from a slides directory.
 * Expects slide-XX.html and optionally slide-XX.png files.
 *
 * @returns Path to the generated presentation.html
 */
export async function buildPresentation(slidesDir: string): Promise<string> {
  const outputDir = join(slidesDir, "..");
  const files = await readdir(slidesDir);

  const htmlFiles = files.filter((f) => /^slide-\d+\.html$/.test(f)).sort();
  const pngFiles = files.filter((f) => /^slide-\d+\.png$/.test(f)).sort();

  if (htmlFiles.length === 0) {
    throw new Error(`No slide HTML files found in ${slidesDir}`);
  }

  const slidesDirName = basename(slidesDir);
  const hasPngs = pngFiles.length > 0;

  const slideEntries: { num: number; htmlFile: string; pngFile: string | null }[] = [];
  for (const file of htmlFiles) {
    const num = parseInt(file.match(/\d+/)?.[0] ?? "0", 10);
    const pngFile = pngFiles.find((p) => p.replace(".png", "") === file.replace(".html", ""));
    slideEntries.push({ num, htmlFile: file, pngFile: pngFile ?? null });
  }

  // Read HTML content for inline embedding (for HTML mode via srcdoc)
  const htmlContents: string[] = [];
  for (const entry of slideEntries) {
    const content = await readTextFile(join(slidesDir, entry.htmlFile));
    htmlContents.push(content);
  }

  const totalSlides = slideEntries.length;
  const title = basename(outputDir)
    .replace(/^\d{4}-\d{2}-\d{2}_[\d-]+_/, "")
    .replace(/-/g, " ");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${escapeHtml(title)} — Presentation</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;font-family:'Pretendard','Noto Sans KR',-apple-system,sans-serif;background:#111;color:#fff;-webkit-tap-highlight-color:transparent}

.presenter{display:flex;flex-direction:column;height:100vh;height:100dvh}

/* ─── Top Bar ─── */
.top-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1a1a1a;border-bottom:1px solid #333;flex-shrink:0;gap:8px;z-index:10}
.top-bar .title{font-size:13px;font-weight:600;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.top-bar .controls{display:flex;align-items:center;gap:6px;flex-shrink:0}
.btn{padding:5px 10px;border:1px solid #444;border-radius:6px;background:#222;color:#ddd;font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit;white-space:nowrap}
.btn:hover{background:#333;border-color:#666}
.btn.active{background:#6C5CE7;border-color:#6C5CE7;color:#fff}
.btn-label{display:inline}
.counter{font-size:12px;color:#888;font-variant-numeric:tabular-nums;min-width:44px;text-align:center}

/* ─── Stage ─── */
.stage{flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:#111}
.slide-frame{width:1080px;height:1440px;transform-origin:center center;position:relative;overflow:hidden}
.slide-frame iframe{width:100%;height:100%;border:none;display:block}
.slide-frame img{width:100%;height:100%;object-fit:contain;display:block}

/* ─── Nav Arrows ─── */
.nav-arrow{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:64px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);border:none;color:#fff;font-size:18px;cursor:pointer;border-radius:8px;transition:background .15s;z-index:5;backdrop-filter:blur(4px)}
.nav-arrow:hover{background:rgba(0,0,0,.7)}
.nav-arrow.left{left:4px}
.nav-arrow.right{right:4px}
.nav-arrow:disabled{opacity:.15;cursor:default}

/* ─── Thumbnail Strip ─── */
.thumb-strip{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#1a1a1a;border-top:1px solid #333;overflow-x:auto;flex-shrink:0;z-index:10;-webkit-overflow-scrolling:touch}
.thumb-strip::-webkit-scrollbar{height:3px}
.thumb-strip::-webkit-scrollbar-thumb{background:#444;border-radius:2px}
.thumb{width:36px;height:48px;border-radius:3px;border:2px solid transparent;cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .15s;background:#222}
.thumb.active{border-color:#6C5CE7}
.thumb img{width:100%;height:100%;object-fit:cover}
.thumb .thumb-num{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#888}

/* ─── Desktop ─── */
@media (min-width:600px){
  .top-bar{padding:10px 20px;gap:16px}
  .top-bar .title{font-size:14px}
  .btn{padding:6px 14px;font-size:13px}
  .counter{font-size:13px;min-width:60px}
  .nav-arrow{width:48px;height:80px;font-size:22px}
  .nav-arrow.left{left:12px}
  .nav-arrow.right{right:12px}
  .slide-frame{border-radius:4px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
  .thumb-strip{gap:8px;padding:10px 20px}
  .thumb{width:54px;height:72px;border-radius:4px}
  .thumb.active{transform:scale(1.08)}
  .thumb:hover{border-color:#888}
  .thumb .thumb-num{font-size:13px}
}

/* ─── Hide fullscreen label on small screens ─── */
@media (max-width:420px){
  .btn-label{display:none}
}
</style>
</head>
<body>
<div class="presenter">
  <div class="top-bar">
    <div class="title">${escapeHtml(title)}</div>
    <div class="controls">
      <button class="btn" id="btn-fullscreen" onclick="toggleFullscreen()" title="Fullscreen (F)">⛶<span class="btn-label"> Fullscreen</span></button>
      ${hasPngs ? '<button class="btn active" id="btn-html" onclick="setMode(\'html\')">HTML</button><button class="btn" id="btn-png" onclick="setMode(\'png\')">PNG</button>' : ""}
      <span class="counter" id="counter">1 / ${totalSlides}</span>
    </div>
  </div>
  <div class="stage" id="stage">
    <button class="nav-arrow left" id="nav-prev" onclick="go(-1)">◀</button>
    <div class="slide-frame" id="slide-frame"></div>
    <button class="nav-arrow right" id="nav-next" onclick="go(1)">▶</button>
  </div>
  <div class="thumb-strip" id="thumbs"></div>
</div>

<script>
var TOTAL = ${totalSlides};
var current = 0;
var mode = 'html';
var hasPngs = ${hasPngs};

var htmlSrcdocs = ${JSON.stringify(htmlContents).replace(/<\//g, "<\\/")};
var pngFiles = ${JSON.stringify(slideEntries.map((e) => (e.pngFile ? `${slidesDirName}/${e.pngFile}` : null)))};
var htmlFileLinks = ${JSON.stringify(slideEntries.map((e) => `${slidesDirName}/${e.htmlFile}`))};

function init() {
  var strip = document.getElementById('thumbs');
  for (var i = 0; i < TOTAL; i++) {
    var t = document.createElement('div');
    t.className = 'thumb' + (i === 0 ? ' active' : '');
    t.dataset.idx = i;
    t.onclick = (function(idx) { return function() { goTo(idx); }; })(i);
    if (pngFiles[i]) {
      var img = document.createElement('img');
      img.src = pngFiles[i];
      img.loading = 'lazy';
      t.appendChild(img);
    } else {
      var n = document.createElement('div');
      n.className = 'thumb-num';
      n.textContent = (i + 1);
      t.appendChild(n);
    }
    strip.appendChild(t);
  }
  fitSlide();
  render();
}

function render() {
  var frame = document.getElementById('slide-frame');
  frame.innerHTML = '';

  if (mode === 'png' && pngFiles[current]) {
    var img = document.createElement('img');
    img.src = pngFiles[current];
    img.alt = 'Slide ' + (current + 1);
    frame.appendChild(img);
  } else {
    var iframe = document.createElement('iframe');
    iframe.srcdoc = htmlSrcdocs[current];
    iframe.sandbox = 'allow-same-origin';
    frame.appendChild(iframe);
  }

  document.getElementById('counter').textContent = (current + 1) + ' / ' + TOTAL;
  document.getElementById('nav-prev').disabled = current === 0;
  document.getElementById('nav-next').disabled = current === TOTAL - 1;

  var thumbs = document.querySelectorAll('.thumb');
  for (var i = 0; i < thumbs.length; i++) {
    thumbs[i].className = 'thumb' + (i === current ? ' active' : '');
  }
  thumbs[current].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function goTo(idx) {
  if (idx < 0 || idx >= TOTAL) return;
  current = idx;
  render();
}

function go(delta) { goTo(current + delta); }

function setMode(m) {
  mode = m;
  if (hasPngs) {
    document.getElementById('btn-html').className = 'btn' + (m === 'html' ? ' active' : '');
    document.getElementById('btn-png').className = 'btn' + (m === 'png' ? ' active' : '');
  }
  render();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function(){});
  } else {
    document.exitFullscreen();
  }
}

function fitSlide() {
  var stage = document.getElementById('stage');
  var frame = document.getElementById('slide-frame');
  var arrowSpace = stage.clientWidth < 600 ? 16 : 140;
  var sw = stage.clientWidth - arrowSpace;
  var sh = stage.clientHeight - 16;
  var scaleX = sw / 1080;
  var scaleY = sh / 1440;
  var scale = Math.min(scaleX, scaleY, 1);
  frame.style.transform = 'scale(' + scale + ')';
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
  else if (e.key === 'End') { e.preventDefault(); goTo(TOTAL - 1); }
  else if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
  else if (e.key === 't' || e.key === 'T') { setMode(mode === 'html' ? 'png' : 'html'); }
});

var touchStartX = 0;
document.getElementById('stage').addEventListener('touchstart', function(e) {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });
document.getElementById('stage').addEventListener('touchend', function(e) {
  var dx = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
}, { passive: true });

window.addEventListener('resize', fitSlide);
window.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>`;

  const outPath = join(outputDir, "presentation.html");
  await writeOutputFile(outPath, html);
  return outPath;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
