import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const heroPath = path.join(root, "src/assets/hero-athletic.jpg");
const outPath = path.join(root, "public/feature-graphic.png");

const W = 1024, H = 500;
const BG = "#0e0c09";
const AMBER = "#e8821a";
const WHITE = "#f5f0e8";
const MUTED = "#a09890";

// Resize hero to cover right ~60% of canvas (width ~ 700, full height)
const heroW = 700;
const heroBuf = await sharp(heroPath)
  .resize({ width: heroW, height: H, fit: "cover", position: "right top" })
  .toBuffer();

// SVG overlay with gradient + text + bar + pills
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.45" stop-color="${BG}" stop-opacity="1"/>
      <stop offset="0.78" stop-color="${BG}" stop-opacity="0"/>
    </linearGradient>
    <style>
      .wm { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: 6.6px; }
      .h1 { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 800; font-size: 64px; letter-spacing: -1.5px; }
      .sub { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 400; font-size: 20px; }
      .pill { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; }
    </style>
  </defs>

  <!-- Fade gradient over hero so left text remains readable -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#fade)"/>

  <!-- Left amber accent bar -->
  <rect x="0" y="0" width="5" height="${H}" fill="${AMBER}"/>

  <!-- Wordmark -->
  <text x="60" y="92" class="wm" fill="${WHITE}">CARNIVORE<tspan fill="${AMBER}">X</tspan></text>

  <!-- Headline -->
  <text x="60" y="210" class="h1" fill="${WHITE}">Health is Wealth.</text>

  <!-- Subtitle -->
  <text x="60" y="260" class="sub" fill="${MUTED}">Let food be your medicine — meat heals.</text>

  <!-- Pills -->
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
  ])
  .png()
  .toFile(outPath);

const meta = await sharp(outPath).metadata();
console.log(`Wrote ${outPath} ${meta.width}x${meta.height}`);
