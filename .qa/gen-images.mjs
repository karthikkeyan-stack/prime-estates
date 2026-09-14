/**
 * Responsive image pipeline for the bundled demo/media images.
 *
 * Why: property photography is the heaviest thing on a real-estate site. The
 * source JPEGs here are ~200-340 KB each at 1408px wide, and a 390px-wide
 * phone was downloading the full-resolution file to paint a 358px-wide card.
 *
 * This generates, for each source image, a ladder of widths in AVIF + WebP
 * (plus a JPEG fallback), so the browser can pick the smallest file that
 * still looks sharp on its screen and DPR.
 *
 *   thumb  400w   property cards on mobile
 *   card   800w   property cards on desktop / cards at 2x on mobile
 *   full  1408w   hero and detail-page primary image
 *
 * Run:  node .qa/gen-images.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC = 'public/media';
const OUT = 'public/media/r';
const WIDTHS = [400, 800, 1408];

// AVIF is ~30% smaller than WebP but slower to encode; both are generated so
// the browser picks via <source type>. Quality tuned by eye against the
// originals — photographic content hides compression well.
const FORMATS = [
  { ext: 'avif', opts: { quality: 52, effort: 4 } },
  { ext: 'webp', opts: { quality: 74 } },
];

await fs.mkdir(OUT, { recursive: true });

const files = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f));
let originalTotal = 0;
let newTotal = 0;
const manifest = {};

for (const file of files) {
  const base = file.replace(/\.(jpe?g|png)$/i, '');
  const srcPath = path.join(SRC, file);
  const input = sharp(srcPath);
  const meta = await input.metadata();
  originalTotal += (await fs.stat(srcPath)).size;

  const entry = { width: meta.width, height: meta.height, sizes: {} };

  for (const w of WIDTHS) {
    // Never upscale past the source.
    if (meta.width && w > meta.width && w !== WIDTHS[0]) continue;
    const target = Math.min(w, meta.width || w);

    for (const { ext, opts } of FORMATS) {
      const outName = `${base}-${w}.${ext}`;
      const outPath = path.join(OUT, outName);
      await sharp(srcPath)
        .resize({ width: target, withoutEnlargement: true })
        .toFormat(ext, opts)
        .toFile(outPath);
      newTotal += (await fs.stat(outPath)).size;
    }

    // JPEG fallback at each width for very old browsers.
    const jpgName = `${base}-${w}.jpg`;
    await sharp(srcPath)
      .resize({ width: target, withoutEnlargement: true })
      .jpeg({ quality: 76, mozjpeg: true })
      .toFile(path.join(OUT, jpgName));
    newTotal += (await fs.stat(path.join(OUT, jpgName))).size;

    entry.sizes[w] = true;
  }
  manifest[base] = entry;
  process.stdout.write('.');
}

await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n${files.length} source images -> ${WIDTHS.length} widths x 3 formats`);
console.log(`originals: ${(originalTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`derivatives: ${(newTotal / 1024 / 1024).toFixed(2)} MB total on disk`);

// Report what a phone actually downloads for one card, before vs after.
const sample = files[0].replace(/\.(jpe?g|png)$/i, '');
const before = (await fs.stat(path.join(SRC, files[0]))).size;
const after = (await fs.stat(path.join(OUT, `${sample}-400.avif`))).size;
console.log(
  `\nPer-card on mobile: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB ` +
  `(${(100 - (after / before) * 100).toFixed(0)}% smaller)`,
);
