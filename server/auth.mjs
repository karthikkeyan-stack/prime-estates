/**
 * Admin authentication.
 *
 * Real server-side auth: scrypt password hashing, HttpOnly cookie sessions
 * persisted in Postgres. No frontend password checks, no secrets in the
 * bundle. Mirrors the Supabase Auth contract so swapping is mechanical.
 */
import crypto from 'node:crypto';
import { query, one } from './db.mjs';

const SESSION_DAYS = 7;
const COOKIE = 'pe_session';

/* ----------------------------- passwords ----------------------------- */

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split(':');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* ------------------------------ bootstrap ---------------------------- */

/**
 * Create the first admin user from environment variables.
 *
 * There are deliberately NO credential fallbacks. Shipping a default
 * email/password would mean every deployment of this codebase starts with
 * the same publicly-known admin login. In production both variables are
 * mandatory; in development we only fall back to a per-machine RANDOM
 * password that is printed once, never a constant.
 */
export async function ensureAdminUser() {
  const rawEmail = process.env.ADMIN_EMAIL?.trim();
  const rawPassword = process.env.ADMIN_PASSWORD;
  const production = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

  if (production && (!rawEmail || !rawPassword)) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD are required in production.\n' +
      'Set them as environment variables (e.g. Vercel project settings).\n' +
      'Refusing to create an admin account with default credentials.',
    );
  }
  if (production && rawPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters in production.');
  }

  const email = (rawEmail || 'admin@example.test').toLowerCase().trim();
  const existing = await one('SELECT id FROM admin_users WHERE email = $1', [email]);
  if (existing) return { email, created: false, generatedPassword: null };

  // Dev-only: random password so no fixed credential ever exists in source.
  const generated = rawPassword ? null : crypto.randomBytes(12).toString('base64url');
  const password = rawPassword || generated;

  await query(
    'INSERT INTO admin_users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)',
    [email, hashPassword(password), 'Prime Estates Admin', 'admin'],
  );
  return { email, created: true, generatedPassword: generated };
}

/* ------------------------------ sessions ----------------------------- */

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await query('INSERT INTO admin_sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [
    token,
    userId,
    expires.toISOString(),
  ]);
  return { token, expires };
}

export async function destroySession(token) {
  if (token) await query('DELETE FROM admin_sessions WHERE token = $1', [token]);
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

export function setSessionCookie(res, token, expires) {
  // Session tokens are random 256-bit values looked up server-side, so they
  // need no signing secret. `Secure` is set on Vercel too, not just when
  // NODE_ENV is explicitly "production".
  const secure = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`,
  );
}

export function clearSessionCookie(res) {
  const secure = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

export async function currentUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  const row = await one(
    `SELECT u.id, u.email, u.full_name, u.role, s.expires_at
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token = $1`,
    [token],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, full_name: row.full_name, role: row.role };
}

/** Express middleware guarding every /api/admin route server-side. */
export async function requireAuth(req, res, next) {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}
