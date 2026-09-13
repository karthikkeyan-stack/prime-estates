/**
 * Development server: Express API + Vite middleware in one process, so the
 * browser only ever talks to one origin (works inside the sandbox preview).
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { api, initApi } from './api.mjs';
import { seed } from './seed.mjs';

const PORT = Number(process.env.PORT || 3000);
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const { adminEmail } = await initApi();
const result = await seed();
console.log(`[seed] ${result.skipped ? 'existing data kept' : 'demo data created'} — ${result.properties} properties`);

app.use('/api', api);
app.get('/sitemap.xml', (req, res) => res.redirect(307, '/api/seo/sitemap.xml'));
app.get('/robots.txt', (req, res) => {
  // Sitemap must be an absolute URL per the robots.txt spec.
  const origin = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
});

const vite = await createViteServer({
  // allowedHosts:true is required so the *.e2b.app preview host is accepted.
  // HMR is left at its default so the client derives ws/wss + host from
  // window.location — correct both on localhost and behind the preview proxy.
  server: { middlewareMode: true, host: true, allowedHosts: true },
  appType: 'spa',
});
app.use(vite.middlewares);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Prime Estates running on http://0.0.0.0:${PORT}`);
  console.log(`  Admin login: ${adminEmail}\n`);
});
