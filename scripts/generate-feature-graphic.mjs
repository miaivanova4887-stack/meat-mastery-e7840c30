import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const heroPath = path.join(root, "src/assets/hero-athletic.jpg");
const outPath = path.join(root, "public/feature-graphic.png");
const fontPath = path.join(__dirname, "fonts/Inter-ExtraBold.ttf");

const W = 1024, H = 500;
const BG = "#0e0c09";
const AMBER = "#e8821a";
const WHITE = "#f5f0e8";
const MUTED = "#a09890";

// --- Render the wordmark via resvg using the bundled Inter ExtraBold font.
// This guarantees the same look as the in-app CarnivoreXLogo:
//   uppercase, font-extrabold (800), tracking-[0.3em], leading-none, white + amber X.
// Render at 4x then resize down via sharp for crisp output.
const LOGO_HEIGHT = 48;          // 2x — bolder, more prominent wordmark
const LOGO_FONT_PX = 36;         // 2x visual size at final height
const SCALE = 4;
const fontPx = LOGO_FONT_PX * SCALE;
// Letter-spacing 0.3em — matches in-app `tracking-[0.3em]`
const tracking = (0.3 * fontPx).toFixed(2);
// Wide-enough canvas so the amber `X` is never clipped before sharp trims.
// Generous width (4000px) since sharp.trim() removes transparent padding anyway.
const SVG_W = 4000;
const SVG_H = LOGO_HEIGHT * SCALE * 2;
const wordmarkSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}">
  <text x="0" y="${fontPx * 0.82}"
        font-family="Inter"
        font-weight="800"
        font-size="${fontPx}"
        letter-spacing="${tracking}"
        fill="${WHITE}">CARNIVORE<tspan fill="${AMBER}">X</tspan></text>
</svg>`;

const resvg = new Resvg(wordmarkSvg, {
  background: "rgba(0,0,0,0)",
  font: {
    fontFiles: [fontPath],
    loadSystemFonts: false,
    defaultFontFamily: "Inter",
  },
});
const wordmarkRaw = resvg.render().asPng();
// Trim transparent edges and resize to target height
const wordmarkBuf = await sharp(wordmarkRaw)
  .trim()
  .resize({ height: LOGO_HEIGHT })
  .png()
  .toBuffer();

// --- Hero image: cover right ~700px column, full height
const heroW = 700;
const heroBuf = await sharp(heroPath)
  .resize({ width: heroW, height: H, fit: "cover", position: "right top" })
  .toBuffer();

// --- SVG overlay: gradient + headline + subtitle + pills + amber bar
// (wordmark removed — composited as an image instead)
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.45" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.78" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
    <style>
      .h1 { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 800; font-size: 64px; letter-spacing: -1.5px; }
      .sub { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 400; font-size: 20px; }
      .pill { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; }
    </style>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#fade)"/>
  <rect x="0" y="0" width="5" height="${H}" fill="${AMBER}"/>

  <text x="60" y="210" class="h1" fill="${WHITE}">Health is Wealth.</text>
  <text x="60" y="260" class="sub" fill="${MUTED}">Let food be your medicine — meat heals.</text>

  <g transform="translate(60, 310)">
    ${[
      { label: "Lion Diet", w: 110 },
      { label: "Strict Carnivore", w: 160 },
      { label: "Animal-Based", w: 140 },
    ].reduce((acc, p) => {
      const x = acc.x;
      acc.svg += `
        <rect x="${x}" y="0" width="${p.w}" height="34" rx="17" ry="17"
              fill="${AMBER}" fill-opacity="0.15" stroke="${AMBER}" stroke-opacity="0.6" stroke-width="1"/>
        <text x="${x + p.w / 2}" y="22" class="pill" fill="${AMBER}" text-anchor="middle">${p.label}</text>`;
      acc.x += p.w + 12;
      return acc;
    }, { x: 0, svg: "" }).svg}
  </g>
</svg>`;

await sharp({
  create: { width: W, height: H, channels: 4, background: BG },
})
  .composite([
    { input: heroBuf, left: W - heroW, top: 0 },
    { input: Buffer.from(svg), left: 0, top: 0 },
    { input: wordmarkBuf, left: 52, top: 35 },
  ])
  .png()
  .toFile(outPath);

const meta = await sharp(outPath).metadata();
console.log(`Wrote ${outPath} ${meta.width}x${meta.height}`);
console.log(`Wordmark composited from real Inter ExtraBold font (height=${LOGO_HEIGHT}px @ 52,35)`);
