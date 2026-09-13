/**
 * Image storage abstraction.
 *
 * Two interchangeable backends behind one interface:
 *
 *   supabase  - used when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 *               REQUIRED in production: serverless filesystems are ephemeral
 *               and per-instance, so anything written to disk vanishes.
 *   local     - development fallback writing to /public/uploads.
 *
 * The service-role key is read from the server environment only. It is never
 * imported by frontend code and never prefixed with VITE_, so it cannot end
 * up in the browser bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');

export const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'property-images';

function isProduction() {
  return process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
}

function supabaseConfig() {
  // SUPABASE_URL is the server-side name; VITE_SUPABASE_URL is the public one
  // and is only a convenience alias for the URL (never for the secret key).
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key, configured: !!(url && key) };
}

let clientPromise = null;
async function getClient() {
  const { url, key } = supabaseConfig();
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }
  return clientPromise;
}

export function storageKind() {
  return supabaseConfig().configured ? 'supabase' : 'local';
}

/**
 * Fail fast at boot rather than at the first upload attempt, so a
 * misconfigured deployment is obvious immediately.
 */
export function assertStorageReady() {
  if (isProduction() && !supabaseConfig().configured) {
    throw new Error(
      'Supabase Storage is required in production.\n' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).\n' +
      'Refusing to use the local /public/uploads directory: on Vercel the\n' +
      'filesystem is read-only and per-instance, so uploads would be lost.',
    );
  }
}

/**
 * Validate a base64 data URI and return its decoded parts.
 * Returns { error } instead of throwing so routes can map it to a status code.
 */
export function decodeDataUri(data) {
  const match = /^data:([a-z0-9/+.-]+);base64,(.+)$/i.exec(String(data || ''));
  if (!match) return { error: 'Invalid image payload' };

  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) return { error: 'Only JPG, PNG, WebP or AVIF images are allowed', status: 400 };

  let buffer;
  try {
    buffer = Buffer.from(match[2], 'base64');
  } catch {
    return { error: 'Image could not be decoded', status: 400 };
  }
  if (!buffer.length) return { error: 'Image is empty', status: 400 };
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { error: 'Image must be under 8 MB', status: 413 };
  }

  // Verify the real file signature; never trust the declared MIME type.
  if (!signatureMatches(buffer, ext)) {
    return { error: 'File content does not match its image type', status: 400 };
  }
  return { mime, ext, buffer };
}

/** Magic-number check so a renamed script cannot masquerade as an image. */
function signatureMatches(buf, ext) {
  if (buf.length < 12) return false;
  switch (ext) {
    case 'jpg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'png':
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case 'webp':
      return buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    case 'avif':
      return buf.toString('ascii', 4, 8) === 'ftyp';
    default:
      return false;
  }
}

export function buildObjectName(propertyId, ext) {
  return `p${propertyId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
}

/**
 * Persist an image. Returns { url, objectName, backend }.
 * The returned URL is absolute for Supabase, root-relative for local.
 */
export async function putImage({ propertyId, buffer, ext, mime }) {
  const objectName = buildObjectName(propertyId, ext);

  if (storageKind() === 'supabase') {
    const supabase = await getClient();
    const { error } = await supabase.storage.from(BUCKET).upload(objectName, buffer, {
      contentType: mime,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
    return { url: data.publicUrl, objectName, backend: 'supabase' };
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, objectName), buffer);
  return { url: `/uploads/${objectName}`, objectName, backend: 'local' };
}

/**
 * Remove a stored image. Only removes objects this app owns; ignores
 * seeded /media/ assets and any external URL. Never throws.
 */
export async function removeImage(url) {
  if (!url) return false;
  try {
    if (url.startsWith('/uploads/')) {
      const file = path.join(UPLOAD_DIR, path.basename(url));
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return true;
    }
    if (storageKind() === 'supabase' && url.includes(`/${BUCKET}/`)) {
      const objectName = decodeURIComponent(url.split(`/${BUCKET}/`).pop().split('?')[0]);
      const supabase = await getClient();
      const { error } = await supabase.storage.from(BUCKET).remove([objectName]);
      if (error) {
        console.error('[storage] delete failed:', error.message);
        return false;
      }
      return true;
    }
  } catch (e) {
    console.error('[storage] delete error:', e.message);
  }
  return false;
}

/** Connectivity + bucket check used by /api/health and the QA harness. */
export async function storageHealth() {
  if (storageKind() !== 'supabase') {
    return { backend: 'local', ok: true, bucket: null, writable: fs.existsSync(ROOT) };
  }
  try {
    const supabase = await getClient();
    const { data, error } = await supabase.storage.getBucket(BUCKET);
    if (error) return { backend: 'supabase', ok: false, bucket: BUCKET, error: error.message };
    return {
      backend: 'supabase',
      ok: true,
      bucket: BUCKET,
      public: data?.public ?? null,
      sizeLimit: data?.file_size_limit ?? null,
    };
  } catch (e) {
    return { backend: 'supabase', ok: false, bucket: BUCKET, error: e.message };
  }
}
