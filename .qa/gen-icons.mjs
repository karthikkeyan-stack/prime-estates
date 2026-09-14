import fs from 'node:fs';
// Scan src/ for every icon name actually referenced, so this can never drift
// out of sync with the code (a missing icon renders as an empty gap).
function collect(dir, out = new Set()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) collect(p, out);
    else if (/\.tsx?$/.test(e.name)) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/(?:name|icon)[:=]\s*'([a-z0-9_]+)'/g)) out.add(m[1]);
      for (const m of s.matchAll(/name="([a-z0-9_]+)"/g)) out.add(m[1]);
    }
  }
  return out;
}
const dirCheck = 'node_modules/@material-symbols/svg-400/outlined/';
const names = [...collect('src')].filter(n => fs.existsSync(dirCheck + n + '.svg')).sort();
const dir = 'node_modules/@material-symbols/svg-400/outlined/';
const out = {}; const missing = [];
for (const n of names) {
  const f = dir + n + '.svg';
  if (!fs.existsSync(f)) { missing.push(n); continue; }
  const svg = fs.readFileSync(f,'utf8');
  // Material Symbols SVGs are a single <path d="..."/> on a 0 0 960 960 viewBox
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m=>m[1]);
  if (!paths.length) { missing.push(n); continue; }
  out[n] = paths.join(' ');
}
console.log('resolved:', Object.keys(out).length, 'missing:', missing);
const entries = Object.entries(out).sort(([a],[b])=>a.localeCompare(b))
  .map(([k,v])=>`  '${k}': '${v.replace(/'/g,"\\'")}',`).join('\n');
const src = `// AUTO-GENERATED — do not edit by hand.
// Regenerate with:  node .qa/gen-icons.mjs
//
// Why this file exists
// --------------------
// The Material Symbols *variable icon font* from Google Fonts weighs ~3.9 MB.
// The app uses ${Object.keys(out).length} icons. Shipping the font to render ${Object.keys(out).length} glyphs is the
// single most expensive thing the site could do on a mobile connection, so the
// glyphs are inlined here as SVG path data instead (a few KB, no network
// request, no FOUT, no render-blocking stylesheet).
//
// All paths are from the official @material-symbols/svg-400 package
// (Apache-2.0) on the standard 0 0 960 960 viewBox.

export const ICON_PATHS: Record<string, string> = {
${entries}
};

export type IconName = keyof typeof ICON_PATHS;
`;
fs.writeFileSync('src/components/icon-paths.ts', src);
const kb = (Buffer.byteLength(src)/1024).toFixed(1);
console.log('wrote src/components/icon-paths.ts —', kb, 'KB raw (vs 3900 KB font)');
