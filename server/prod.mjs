/**
 * Production server: Express API + static dist/ with SPA fallback.
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, initApi } from './api.mjs';
import { seed } from './seed.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

await initApi();
if (process.env.SEED_ON_BOOT !== 'false') await seed();

app.use('/api', api);
app.get('/sitemap.xml', (req, res) => res.redirect(307, '/api/seo/sitemap.xml'));
app.get('/robots.txt', (req, res) => {
  // Sitemap must be an absolute URL per the robots.txt spec.
  const origin = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
});

app.use(express.static(path.join(ROOT, 'dist'), { maxAge: '1y', index: false }));
app.use('/media', express.static(path.join(ROOT, 'public', 'media'), { maxAge: '30d' }));
app.use('/uploads', express.static(path.join(ROOT, 'public', 'uploads'), { maxAge: '7d' }));
app.get('*', (_req, res) => res.sendFile(path.join(ROOT, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Prime Estates (production) on :${PORT}`));
