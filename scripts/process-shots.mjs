import sharp from "sharp";
import fs from "fs";
import path from "path";

const TARGET_W = 1080;
const TARGET_H = 1920;
const SRC = "/tmp/shots";
const OUT = "public/screenshots";

const files = [
  ["01-home.png", "screen-01-home.png"],
  ["02-ketosis.png", "screen-02-ketosis.png"],
  ["03-recipes.png", "screen-03-recipes.png"],
  ["04-meal-plan.png", "screen-04-meal-plan.png"],
  ["05-progress.png", "screen-05-progress.png"],
  ["06-budget.png", "screen-06-budget.png"],
];

fs.mkdirSync(OUT, { recursive: true });

for (const [src, dst] of files) {
  const inputPath = path.join(SRC, src);
  const meta = await sharp(inputPath).metadata();
  // Crop the lovable build-stamp banner at the top (~45px in source coords)
  const cropTop = 50;
  const cropped = await sharp(inputPath)
    .extract({ left: 0, top: cropTop, width: meta.width, height: meta.height - cropTop })
    .toBuffer();

  // Resize to 1080 wide preserving aspect, then pad/crop to 1920 tall
  const resized = sharp(cropped).resize({ width: TARGET_W, withoutEnlargement: false });
  const resizedMeta = await resized.clone().metadata();
  const resizedBuf = await resized.toBuffer();
  const rMeta = await sharp(resizedBuf).metadata();

  let finalBuf;
  if (rMeta.height >= TARGET_H) {
    // crop center vertically
    const top = Math.floor((rMeta.height - TARGET_H) / 2);
    finalBuf = await sharp(resizedBuf).extract({ left: 0, top, width: TARGET_W, height: TARGET_H }).png().toBuffer();
  } else {
    // pad with black on top/bottom
    const padTotal = TARGET_H - rMeta.height;
    const padTop = Math.floor(padTotal / 2);
    const padBot = padTotal - padTop;
    finalBuf = await sharp(resizedBuf)
      .extend({ top: padTop, bottom: padBot, left: 0, right: 0, background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .png()
      .toBuffer();
  }

  fs.writeFileSync(path.join(OUT, dst), finalBuf);
  const fm = await sharp(finalBuf).metadata();
  console.log(dst, fm.width + "x" + fm.height);
}
