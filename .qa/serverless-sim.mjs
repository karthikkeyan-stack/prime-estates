/**
 * Simulates Vercel's runtime:
 *   - imports api/index.mjs (the real serverless handler, no app.listen)
 *   - serves dist/ statically the way Vercel's CDN does
 *   - applies the vercel.json rewrites, including the SPA fallback
 *
 * This is how we prove /api/*, deep links and refreshes work in production
 * WITHOUT deploying. Run: node .qa/serverless-sim.mjs
 */
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.SIM_PORT || 4010);

const handler = (await import('../api/index.mjs')).default;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

// Mirrors the Cache-Control rules in vercel.json so the simulation reports
// the same caching behaviour the real CDN would.
const IMMUTABLE = [
  `${path.sep}assets${path.sep}`,
  `${path.sep}fonts${path.sep}`,
  `${path.sep}media${path.sep}r${path.sep}`,
];

// Vercel's CDN brotli/gzips text responses automatically. The simulator does
// the same, otherwise measurements here are pessimistic by ~3x on JS/CSS.
const COMPRESSIBLE = /\.(js|css|html|json|svg|xml|txt|map)$/i;

function serveStatic(res, file, req) {
  let body = fs.readFileSync(file);
  const immutable = IMMUTABLE.some((seg) => file.includes(seg));
  const media = file.includes(`${path.sep}media${path.sep}`);
  const headers = {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': immutable
      ? 'public, max-age=31536000, immutable'
      : media
        ? 'public, max-age=2592000'
        : 'public, max-age=0, must-revalidate',
  };
  const accept = String(req?.headers?.['accept-encoding'] || '');
  if (COMPRESSIBLE.test(file)) {
    if (/\bbr\b/.test(accept)) {
      body = zlib.brotliCompressSync(body, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
      });
      headers['Content-Encoding'] = 'br';
    } else if (/\bgzip\b/.test(accept)) {
      body = zlib.gzipSync(body, { level: 6 });
      headers['Content-Encoding'] = 'gzip';
    }
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  // 1. /api/* , /sitemap.xml and /robots.txt -> serverless function
  if (pathname.startsWith('/api/') || pathname === '/sitemap.xml' || pathname === '/robots.txt') {
    return handler(req, res);
  }

  // 2. real static asset from dist/ or public/
  for (const base of [DIST, path.join(ROOT, 'public')]) {
    const candidate = path.join(base, pathname);
    if (candidate.startsWith(base) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return serveStatic(res, candidate, req);
    }
  }

  // 3. SPA fallback — every other route renders index.html (deep links/refresh)
  const index = path.join(DIST, 'index.html');
  if (!fs.existsSync(index)) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('dist/index.html missing — run `npm run build` first');
  }
  return serveStatic(res, index, req);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[vercel-sim] listening on http://0.0.0.0:${PORT}`);
  console.log('[vercel-sim] /api/* -> api/index.mjs (serverless handler)');
  console.log('[vercel-sim] everything else -> dist/ then SPA fallback');
});
