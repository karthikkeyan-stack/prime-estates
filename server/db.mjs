/**
 * Database access layer.
 *
 * Two interchangeable drivers behind one `query(sql, params)` API:
 *   - DATABASE_URL set  -> node-postgres pool (real Postgres / Supabase)
 *   - DATABASE_URL empty-> PGlite, a real WASM PostgreSQL persisted to ./data
 *
 * Both speak genuine PostgreSQL, so the SQL written here (arrays, ILIKE,
 * window counts, partial indexes) is identical in dev and production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let driver = null;
let ready = null;

/** True on Vercel, or whenever NODE_ENV=production. */
export function isProduction() {
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
}

async function boot() {
  const url = process.env.DATABASE_URL?.trim();

  // PRODUCTION GUARD: never silently fall back to the embedded dev database.
  // A serverless filesystem is ephemeral and per-instance, so PGlite in
  // production would mean data that silently disappears between requests.
  if (!url && isProduction()) {
    throw new Error(
      'DATABASE_URL is required in production.\n' +
      'Set it to your Supabase Postgres connection string, e.g.\n' +
      '  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres\n' +
      'Refusing to start with the embedded PGlite database, whose data would not persist.',
    );
  }

  if (url) {
    const { default: pg } = await import('pg');
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    // Supabase's transaction pooler (port 6543) does not support prepared
    // statements; node-postgres only uses them for named queries, which we
    // never issue, so the pooler is safe and is the right choice for
    // serverless. Each lambda instance keeps a tiny pool.
    const serverless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    /*
     * Strip any sslmode from the URL and let the `ssl` option below decide.
     *
     * node-postgres >= 8.16 honours sslmode in the connection string and
     * treats `sslmode=require` as full chain verification. Supabase's
     * pooler presents a self-signed chain, so a URL copied verbatim from
     * the Supabase dashboard fails with SELF_SIGNED_CERT_IN_CHAIN and the
     * `ssl` option is ignored. Removing the parameter makes this object
     * the single source of truth: TLS is still used, we simply do not
     * verify the chain (standard practice for Supabase's pooler).
     */
    let cleanUrl = url;
    try {
      const u = new URL(url);
      if (u.searchParams.has('sslmode')) {
        u.searchParams.delete('sslmode');
        cleanUrl = u.toString();
      }
    } catch { /* not a parseable URL — pass through untouched */ }

    const pool = new pg.Pool({
      connectionString: cleanUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: serverless ? 1 : 10,
      idleTimeoutMillis: serverless ? 10_000 : 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: serverless,
    });
    // A pool-level error must never take the whole process down.
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));
    driver = {
      kind: 'postgres',
      query: (sql, params = []) => pool.query(sql, params),
      // node-postgres happily runs multi-statement scripts through query()
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = path.join(ROOT, 'data', 'pgdata');
    fs.mkdirSync(dir, { recursive: true });

    // A process killed mid-write (or a backup taken while running) leaves a
    // stale postmaster.pid / socket lock behind. Postgres then refuses to
    // start even though no server is actually running, so clear them first.
    for (const stale of ['postmaster.pid', '.s.PGSQL.5432', '.s.PGSQL.5432.lock.out']) {
      const f = path.join(dir, stale);
      if (fs.existsSync(f)) {
        try { fs.rmSync(f, { force: true }); } catch { /* best effort */ }
      }
    }

    let pglite;
    try {
      pglite = await PGlite.create(dir);
    } catch (err) {
      // The embedded datastore is unrecoverable (typically a data directory
      // copied while the server was mid-write). Everything here is rebuildable
      // from schema.sql + seed.mjs, so move the bad copy aside and start clean
      // rather than leaving the app dead on boot.
      const quarantine = `${dir}-corrupt-${Date.now()}`;
      console.error(`[db] embedded datastore failed to open: ${String(err.message).split('\n')[0]}`);
      console.error(`[db] moving it to ${quarantine} and recreating a fresh database.`);
      console.error('[db] NOTE: admin-entered content in that copy is not carried over.');
      try { fs.renameSync(dir, quarantine); } catch { fs.rmSync(dir, { recursive: true, force: true }); }
      fs.mkdirSync(dir, { recursive: true });
      pglite = await PGlite.create(dir);
    }
    driver = {
      kind: 'pglite',
      query: (sql, params = []) => pglite.query(sql, params),
      // PGlite's query() is a prepared statement — multi-statement scripts
      // must go through exec().
      exec: (sql) => pglite.exec(sql),
      close: () => pglite.close(),
    };
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await driver.exec(schema);
  return driver;
}

export function db() {
  if (!ready) ready = boot();
  return ready;
}

/** Run a parameterised query. Always use $1,$2… — never string concatenation. */
export async function query(sql, params = []) {
  const d = await db();
  return d.query(sql, params);
}

export async function rows(sql, params = []) {
  return (await query(sql, params)).rows;
}

export async function one(sql, params = []) {
  return (await query(sql, params)).rows[0] ?? null;
}

export async function driverKind() {
  return (await db()).kind;
}
