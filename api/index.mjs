/**
 * Vercel serverless entrypoint for the whole REST API.
 *
 * vercel.json rewrites every /api/* request here. Express is used purely as
 * a request handler — there is NO app.listen(); Vercel owns the socket. The
 * exact same `api` router serves local development via server/dev.mjs, so
 * behaviour cannot drift between environments.
 *
 * Cold-start notes:
 *   - The DB pool is created lazily on first query and reused while the
 *     instance stays warm (see server/db.mjs).
 *   - initApi() runs once per instance, guarded by a module-level promise.
 *   - Seeding NEVER runs here. Production data is owned by migrations and
 *     the admin panel, not by a lambda.
 */
import express from 'express';
import { api, initApi } from '../server/api.mjs';
import { assertStorageReady } from '../server/storage.mjs';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // Vercel terminates TLS upstream

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

/**
 * One-time per-instance initialisation. Memoised so concurrent requests on a
 * cold instance all await the same promise instead of racing.
 */
let bootPromise = null;
function boot() {
  if (!bootPromise) {
    bootPromise = (async () => {
      assertStorageReady();
      await initApi();
    })().catch((err) => {
      // Reset so the next request can retry rather than caching the failure
      // for the lifetime of the instance.
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}

app.use(async (req, res, next) => {
  try {
    await boot();
    next();
  } catch (err) {
    console.error('[api:boot]', err.message);
    res.status(503).json({
      error: 'The service is not configured correctly. Please try again shortly.',
    });
  }
});

/**
 * SEO files. On Vercel these are rewritten to this function (they were
 * Express routes in the single-process server and would otherwise 404 in a
 * static deployment). The sitemap uses the live request host unless an
 * explicit site_url has been configured in Admin -> Settings.
 */
app.get(['/robots.txt', '/api/robots.txt'], (req, res) => {
  const origin = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
});

app.get(['/sitemap.xml', '/api/sitemap.xml'], (req, res, next) => {
  req.url = '/seo/sitemap.xml';
  api(req, res, next);
});

// Mounted at both paths: Vercel may forward the full path (/api/...) or the
// rewritten remainder depending on the routing rule that matched.
app.use('/api', api);
app.use('/', api);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

export default app;
