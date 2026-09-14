/**
 * Subsets the self-hosted fonts to the characters this site can actually
 * render, then re-compresses as woff2.
 *
 * Even the "latin" subset from Google carries accented glyphs, currency
 * symbols and punctuation an English/Tamil-English property site never shows.
 * Restricting to the real character set roughly halves each file.
 *
 * The set below is deliberately generous: full ASCII, the Latin-1 accents
 * that appear in place names, typographic quotes/dashes, the rupee sign, and
 * the arrows/bullets used in the UI. Widening it later is a one-line change.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const UNICODES = [
  'U+0020-007E',        // ASCII
  'U+00A0-00FF',        // Latin-1 supplement (accented place names)
  'U+0131,U+0152-0153', // dotless i, OE
  'U+2010-2015',        // hyphens / dashes
  'U+2018-201E',        // curly quotes
  'U+2022',             // bullet
  'U+2026',             // ellipsis
  'U+20B9',             // rupee
  'U+20AC',             // euro
  'U+2122',             // trademark
  'U+2190-2193',        // arrows
  'U+00D7',             // multiplication sign
].join(',');

let before = 0, after = 0;
for (const f of fs.readdirSync('public/fonts').filter((f) => f.endsWith('.woff2'))) {
  const p = `public/fonts/${f}`;
  before += fs.statSync(p).size;
  execSync(
    `python3 -m fontTools.subset "${p}" --unicodes="${UNICODES}" ` +
    `--layout-features="kern,liga,clig,calt" --flavor=woff2 --output-file="${p}.tmp"`,
    { stdio: 'pipe' },
  );
  fs.renameSync(`${p}.tmp`, p);
  const sz = fs.statSync(p).size;
  after += sz;
  console.log(`  ${f.padEnd(20)} ${(sz / 1024).toFixed(1)} KB`);
}
console.log(`\ntotal ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB ` +
            `(${(100 - (after / before) * 100).toFixed(0)}% smaller)`);
