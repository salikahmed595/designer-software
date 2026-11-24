// Rules for the design-assets MCP server: which licences are safe for client work, where files may be saved,
// which hosts may be fetched and what a download must really be. Pure functions, no network.
import path from 'node:path';

/**
 * Client artwork is sold and often used as a trademark (logos, channel branding), so:
 *  yes         — public domain / permissive: commercial use, edits and logos allowed, no credit inside the artwork.
 *  attribution — CC BY: allowed only if the client deliverable can carry a credit, so only when asked for.
 *  no          — non-commercial, no-derivatives, share-alike, copyleft or unknown.
 */
const YES = new Set(['cc0', 'cc0-1.0', 'pdm', 'public-domain', 'mit', 'apache-2.0', 'isc', 'bsd-2-clause', 'bsd-3-clause', 'ofl-1.1', 'unlicense', '0bsd']);
const ATTRIBUTION = new Set(['by', 'cc-by-3.0', 'cc-by-4.0']);

export function licencePolicy(id) {
  const key = String(id ?? '').trim().toLowerCase();
  if (YES.has(key)) return { use: 'yes', why: 'Free for commercial client work, edits and logos; no credit needed in the artwork.' };
  if (ATTRIBUTION.has(key)) return { use: 'attribution', why: 'Needs a visible credit to the author wherever it is used — only for deliverables that can carry a credit, never inside a logo.' };
  if (/nc/.test(key)) return { use: 'no', why: 'Non-commercial only: not allowed in paid client work.' };
  if (/nd/.test(key)) return { use: 'no', why: 'No derivatives: it may not be edited or built into new artwork.' };
  if (/sa|gpl|mpl/.test(key)) return { use: 'no', why: 'Share-alike / copyleft: the client artwork would have to use the same licence.' };
  return { use: 'no', why: 'Unknown licence: not cleared for client work.' };
}

export function safeFileName(name, ext) {
  const base = String(name ?? '').split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '');
  const stem = (base.toLowerCase().endsWith(ext) ? base.slice(0, -ext.length) : base).slice(0, 80) || 'asset';
  return `${stem}${ext}`;
}

const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

/** An absolute folder inside one of the allowed save roots (the roots come from the command line, never from the agent). */
export function resolveSaveDir(roots, dir) {
  if (!roots.length) throw new Error('No save folder is configured for downloads (start the server with --save-root).');
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new Error('dest_dir must be an absolute folder path.');
  const target = path.resolve(dir);
  for (const root of roots) {
    const rel = path.relative(norm(path.resolve(root)), norm(target));
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return target;
  }
  throw new Error(`dest_dir is outside the allowed folders: ${roots.join(', ')}`);
}

export const ALLOWED_HOSTS = new Set([
  'api.iconify.design', 'api.fontsource.org', 'cdn.jsdelivr.net', 'api.polyhaven.com', 'dl.polyhaven.org', 'cdn.polyhaven.com', 'api.artic.edu', 'www.artic.edu',
]);

export function assertAllowedUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`"${url}" is not a valid URL.`);
  }
  if (u.protocol !== 'https:') throw new Error('Only https downloads are allowed.');
  if (u.username || u.password || !ALLOWED_HOSTS.has(u.hostname)) throw new Error(`${u.hostname} is not an allowed asset host.`);
  return u;
}

const ICON_ID = /^([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseIconId(id) {
  const m = typeof id === 'string' ? ICON_ID.exec(id) : null;
  if (!m) throw new Error('icon id must look like "set:name", e.g. "lucide:sword".');
  return { set: m[1], name: m[2] };
}

export function iconSvgUrl(id, color, height) {
  const { set, name } = parseIconId(id);
  const params = new URLSearchParams();
  if (color !== undefined) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) throw new Error('colour must be a hex colour like #ff3366.');
    params.set('color', color);
  }
  if (height !== undefined) params.set('height', String(Math.min(Math.max(Math.round(Number(height)) || 24, 16), 2048)));
  const q = params.toString();
  return `https://api.iconify.design/${set}/${name}.svg${q ? `?${q}` : ''}`;
}

/** Every word of the query must appear in the item's name, tags or categories. */
export function matchesQuery(item, query) {
  const hay = [item.name, ...(item.tags ?? []), ...(item.categories ?? [])].join(' ').toLowerCase();
  return String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/** The real type of a downloaded file from its first bytes; null = refuse it. SVGs with scripts or event handlers are refused. */
export function sniffType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 4 && buf.readUInt32BE(0) === 0x00010000) return 'ttf';
  if (buf.subarray(0, 4).toString('latin1') === 'OTTO') return 'otf';
  const head = buf.subarray(0, 512).toString('utf8').trimStart();
  if (/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    const text = buf.toString('utf8');
    return /<script|\son[a-z]+\s*=|javascript:/i.test(text) ? null : 'svg';
  }
  return null;
}
