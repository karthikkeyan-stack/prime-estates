/* Serves the local production build and proxies /api to the live backend,
   so the responsive audit runs against real data with local code changes. */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const UPSTREAM = 'prime-estates-lemon.vercel.app';
const PORT = Number(process.env.PORT || 4178);

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.avif':'image/avif', '.woff2':'font/woff2', '.ico':'image/x-icon', '.xml':'application/xml',
  '.txt':'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname.startsWith('/api')) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const headers = { ...req.headers, host: UPSTREAM };
      delete headers['accept-encoding'];
      const p = https.request({ hostname: UPSTREAM, path: req.url, method: req.method, headers }, (up) => {
        const h = { ...up.headers };
        // let cookies work over plain http://localhost
        if (h['set-cookie']) {
          h['set-cookie'] = h['set-cookie'].map((c) =>
            c.replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]+/gi, ''));
        }
        res.writeHead(up.statusCode || 502, h);
        up.pipe(res);
      });
      p.on('error', (e) => { res.writeHead(502); res.end('proxy error: ' + e.message); });
      if (body.length) p.write(body);
      p.end();
    });
    return;
  }

  let fp = path.join(DIST, decodeURIComponent(url.pathname));
  if (!fp.startsWith(DIST)) { res.writeHead(403); return res.end('forbidden'); }
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    return fs.createReadStream(fp).pipe(res);
  }
  // SPA fallback
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(path.join(DIST, 'index.html')).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => console.log(`audit server on http://0.0.0.0:${PORT} (api -> ${UPSTREAM})`));
