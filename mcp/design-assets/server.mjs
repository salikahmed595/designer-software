#!/usr/bin/env node
// design-assets MCP server (stdio, no dependencies).
// Free, licence-checked assets for 2D client artwork, from sources that need no API key:
//   icons     — Iconify (200k+ SVG icons; only sets whose licence allows commercial use and logos)
//   fonts     — Fontsource (Google Fonts and other open fonts; OFL / Apache only)
//   textures  — Poly Haven (CC0 photo textures)
//   art       — Art Institute of Chicago (public-domain artworks, CC0 images) as reference
// Downloads are saved only inside the --save-root folders given on the command line, checked from their bytes,
// and recorded in <folder>/asset-credits.json (source, author, licence, page) so every asset can be traced.
//
// Usage: node server.mjs --save-root <folder> [--save-root <folder> ...]
import { createInterface } from 'node:readline';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertAllowedUrl, iconSvgUrl, licencePolicy, matchesQuery, parseIconId, resolveSaveDir, safeFileName, sniffType } from './lib.mjs';

const VERSION = '1.0.0';
const UA = `lumora-design-assets/${VERSION} (design studio tool)`;
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 60 * 1024 * 1024;
// Poly Haven's API terms (July 2026) ask services that use the API live to show this credit.
const POLY_HAVEN_CREDIT = 'Powered by Poly Haven';
const SAVE_ROOTS = [];
for (let i = 2; i < process.argv.length; i++) if (process.argv[i] === '--save-root' && process.argv[i + 1]) SAVE_ROOTS.push(path.resolve(process.argv[++i]));

const fail = (msg) => {
  const e = new Error(msg);
  e.userFacing = true;
  throw e;
};

/* ---------- http: allowed hosts only, redirects re-checked, size-capped ---------- */

async function get(url, { json = false, headers = {} } = {}) {
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    assertAllowedUrl(target);
    const host = new URL(target).hostname;
    const res = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: json ? 'application/json' : '*/*', ...(host.endsWith('artic.edu') ? { 'AIC-User-Agent': UA } : {}), ...headers },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      target = new URL(res.headers.get('location'), target).toString();
      continue;
    }
    if (res.status === 429) fail(`${host} is rate-limiting requests. Wait a minute and try again.`);
    if (res.status === 404) fail(`Not found on ${host}.`);
    if (!res.ok) fail(`${host} answered ${res.status}.`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) fail('The file is larger than 60 MB.');
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > MAX_BYTES) fail('The file is larger than 60 MB.');
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    if (!json) return buf;
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch {
      fail(`${host} did not return JSON.`);
    }
  }
  fail('Too many redirects.');
}

/* ---------- saving + credits ---------- */

async function saveAsset(destDir, fileName, buf, expected, credit) {
  const dir = resolveSaveDir(SAVE_ROOTS, destDir);
  const type = sniffType(buf);
  if (!type || !expected.includes(type)) fail(`The download is not a valid ${expected.join('/')} file, so it was not saved.`);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, safeFileName(fileName, `.${type}`));
  await fs.writeFile(file, buf);
  const creditsFile = path.join(dir, 'asset-credits.json');
  let credits = [];
  try {
    credits = JSON.parse(await fs.readFile(creditsFile, 'utf8'));
    if (!Array.isArray(credits)) credits = [];
  } catch {
    /* first asset in this folder */
  }
  const entry = { file: path.basename(file), ...credit, downloaded_at: new Date().toISOString() };
  credits = credits.filter((c) => c.file !== entry.file).concat(entry);
  await fs.writeFile(creditsFile, JSON.stringify(credits, null, 2));
  return { saved: file, bytes: buf.length, type, credit: entry, credits_file: creditsFile };
}

function cleared(licence, allowAttribution) {
  const p = licencePolicy(licence);
  if (p.use === 'yes' || (p.use === 'attribution' && allowAttribution)) return p;
  fail(`Licence ${licence || 'unknown'} is not cleared for client work: ${p.why}`);
}

/* ---------- argument checks ---------- */

const text = (v, name, max = 120) => {
  if (typeof v !== 'string' || !v.trim()) fail(`${name} is required.`);
  if (v.length > max) fail(`${name} is too long.`);
  return v.trim();
};
const limitOf = (v, def, max) => Math.min(Math.max(Number.isInteger(v) ? v : def, 1), max);
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const idOf = (v, name) => (typeof v === 'string' && ID.test(v) ? v : fail(`${name} is not a valid id.`));

/* ---------- sources ---------- */

let iconSetsCache = null;
async function iconSets() {
  iconSetsCache ??= await get('https://api.iconify.design/collections', { json: true });
  return iconSetsCache;
}
const setInfo = (sets, prefix) => {
  const s = sets[prefix];
  return s ? { set_name: s.name, licence: s.license?.spdx ?? 'unknown', licence_url: s.license?.url ?? null, author: s.author?.name ?? null, author_url: s.author?.url ?? null } : null;
};

let fontsCache = null;
let texturesCache = null;

const TOOLS = [
  {
    name: 'assets_sources',
    description: 'List the asset sources, what each is good for, and the licence rules every download is checked against.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'icons_search',
    description: 'Search 200,000+ open SVG icons (Iconify: Material, Lucide, Tabler, Phosphor, Remix, game icons...). Only icon sets whose licence allows paid client work and logos are returned unless allow_attribution is true (then CC BY sets, which need a visible credit, are included and marked).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the icon shows, e.g. "sword", "crown", "controller".' },
        set: { type: 'string', description: 'Optional icon set prefix, e.g. "lucide", "mdi", "tabler", "ph", "game-icons".' },
        limit: { type: 'integer', minimum: 1, maximum: 64, description: 'Results (default 24).' },
        allow_attribution: { type: 'boolean', description: 'Include CC BY sets (credit required; never inside a logo). Default false.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'icons_download',
    description: 'Save one icon as a clean SVG (vector, editable in Illustrator) into dest_dir, and record its credit.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Icon id from icons_search, e.g. "lucide:sword".' },
        dest_dir: { type: 'string', description: 'Absolute folder to save into (must be inside an allowed save folder).' },
        color: { type: 'string', description: 'Optional hex colour for single-colour icons, e.g. #ffcc00.' },
        height: { type: 'integer', description: 'Optional height in px (16-2048).' },
        allow_attribution: { type: 'boolean', description: 'Allow a CC BY icon (credit required). Default false.' },
      },
      required: ['id', 'dest_dir'],
      additionalProperties: false,
    },
  },
  {
    name: 'fonts_search',
    description: 'Search open fonts (Google Fonts and others via Fontsource). Only OFL / Apache / permissive fonts are returned: free for commercial work and logos.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Part of the family name, e.g. "bungee". Leave empty to browse a category.' },
        category: { type: 'string', enum: ['display', 'sans-serif', 'serif', 'handwriting', 'monospace'], description: 'Font category.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Results (default 20).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'fonts_download',
    description: 'Save one font weight/style as a .ttf into dest_dir and record its licence. Use fonts_install to make it usable for live text in Photoshop/Illustrator.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Font id from fonts_search, e.g. "bungee".' },
        dest_dir: { type: 'string', description: 'Absolute folder to save into.' },
        weight: { type: 'integer', description: 'e.g. 400 or 700 (default: the first available).' },
        style: { type: 'string', enum: ['normal', 'italic'], description: 'Default normal.' },
      },
      required: ['id', 'dest_dir'],
      additionalProperties: false,
    },
  },
  {
    name: 'fonts_install',
    description: 'Install a font file you downloaded with fonts_download for the current Windows user only (no admin), so Photoshop and Illustrator can use it for live text. They may need a restart to list it.',
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'Absolute path of a .ttf/.otf saved by fonts_download.' } },
      required: ['file'],
      additionalProperties: false,
    },
  },
  {
    name: 'textures_search',
    description: 'Search CC0 photo textures (Poly Haven): rock, metal, wood, fabric, ground, wall, grunge... Good for overlays, backgrounds and surface detail. Free for any use, no credit needed.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words that must all match the name or tags, e.g. "rusty metal".' },
        limit: { type: 'integer', minimum: 1, maximum: 40, description: 'Results (default 20).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'textures_download',
    description: 'Save a Poly Haven texture (colour map, JPG) into dest_dir and record its credit.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Texture id from textures_search.' },
        dest_dir: { type: 'string', description: 'Absolute folder to save into.' },
        resolution: { type: 'string', enum: ['1k', '2k', '4k'], description: 'Default 2k.' },
      },
      required: ['id', 'dest_dir'],
      additionalProperties: false,
    },
  },
  {
    name: 'art_search',
    description: 'Search public-domain artworks at the Art Institute of Chicago (CC0 images): paintings, prints, armour, ornament, calligraphy. Use as study reference for poses, costume, ornament and composition.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'e.g. "samurai armor", "dragon", "art nouveau poster".' },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'Results (default 12).' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'art_download',
    description: 'Save a public-domain artwork image (JPG, 843 px wide) from the Art Institute of Chicago into dest_dir and record its credit.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Artwork id from art_search.' },
        dest_dir: { type: 'string', description: 'Absolute folder to save into.' },
      },
      required: ['id', 'dest_dir'],
      additionalProperties: false,
    },
  },
];

async function callTool(name, a = {}) {
  switch (name) {
    case 'assets_sources':
      return {
        save_folders: SAVE_ROOTS,
        licence_rule: 'Allowed: public domain/CC0, MIT, Apache-2.0, ISC, BSD, OFL. CC BY only with allow_attribution (credit required, never inside a logo). Refused: NC, ND, SA, GPL/MPL and unknown licences. None of these licences give trademark rights or exclusivity, so a logo mark must be drawn from scratch.',
        sources: [
          { tools: 'icons_search / icons_download', source: 'Iconify (api.iconify.design)', good_for: 'SVG icons and symbols for UI, badges, overlays, emote props', licence: 'per icon set; checked on every result' },
          { tools: 'fonts_search / fonts_download / fonts_install', source: 'Fontsource (Google Fonts and more)', good_for: 'display and gaming fonts for logos, titles, overlays', licence: 'OFL-1.1 / Apache-2.0' },
          { tools: 'textures_search / textures_download', source: 'Poly Haven', good_for: 'rock, metal, wood, fabric, grunge textures for backgrounds and overlays', licence: 'CC0', credit: POLY_HAVEN_CREDIT },
          { tools: 'art_search / art_download', source: 'Art Institute of Chicago', good_for: 'public-domain reference: armour, costume, ornament, composition', licence: 'CC0 (public-domain works only)' },
          { tools: 'openverse_search_images (openverse server)', source: 'Openverse (Wikimedia, Smithsonian, Flickr CC...)', good_for: 'broad reference search', licence: 'filter license_type=commercial,modification; prefer cc0/pdm' },
        ],
      };

    case 'icons_search': {
      const query = text(a.query, 'query', 80);
      const params = new URLSearchParams({ query, limit: String(Math.min(limitOf(a.limit, 24, 64) * 4, 256)) });
      if (a.set !== undefined) params.set('prefix', text(a.set, 'set', 40));
      const found = await get(`https://api.iconify.design/search?${params}`, { json: true });
      const sets = await iconSets();
      const results = [];
      let refused = 0;
      for (const id of found.icons ?? []) {
        const info = setInfo(sets, id.split(':')[0]);
        const p = licencePolicy(info?.licence);
        if (!info || !(p.use === 'yes' || (p.use === 'attribution' && a.allow_attribution === true))) {
          refused++;
          continue;
        }
        results.push({ id, ...info, credit_required: p.use === 'attribution', preview_svg: iconSvgUrl(id) });
        if (results.length >= limitOf(a.limit, 24, 64)) break;
      }
      return { results, left_out_for_licence: refused };
    }

    case 'icons_download': {
      const { set, name: icon } = parseIconId(a.id);
      const info = setInfo(await iconSets(), set) ?? fail(`Unknown icon set "${set}".`);
      cleared(info.licence, a.allow_attribution === true);
      const buf = await get(iconSvgUrl(a.id, a.color, a.height));
      return saveAsset(a.dest_dir, `${set}-${icon}`, buf, ['svg'], {
        source: 'Iconify', id: a.id, title: `${icon} (${info.set_name})`, author: info.author, licence: info.licence, licence_url: info.licence_url, page: `https://icon-sets.iconify.design/${set}/${icon}/`,
      });
    }

    case 'fonts_search': {
      fontsCache ??= await get('https://api.fontsource.org/v1/fonts', { json: true });
      const q = typeof a.query === 'string' ? a.query.trim().toLowerCase() : '';
      const results = fontsCache
        .filter((f) => licencePolicy(f.license).use === 'yes')
        .filter((f) => (!q || f.family.toLowerCase().includes(q) || f.id.includes(q)) && (!a.category || f.category === a.category))
        .slice(0, limitOf(a.limit, 20, 50))
        .map((f) => ({ id: f.id, family: f.family, category: f.category, weights: f.weights, styles: f.styles, licence: f.license, page: `https://fontsource.org/fonts/${f.id}` }));
      return { results };
    }

    case 'fonts_download': {
      const id = idOf(a.id, 'id').toLowerCase();
      const font = await get(`https://api.fontsource.org/v1/fonts/${id}`, { json: true });
      cleared(font.license, false);
      const weight = String(a.weight ?? font.weights?.[0] ?? 400);
      const style = a.style ?? 'normal';
      const variant = font.variants?.[weight]?.[style] ?? fail(`${font.family} has no ${weight} ${style}. Available weights: ${(font.weights ?? []).join(', ')}.`);
      const subset = variant[font.defSubset] ? font.defSubset : variant.latin ? 'latin' : Object.keys(variant)[0];
      const url = variant[subset]?.url?.ttf ?? fail('No TTF file is published for this font.');
      const buf = await get(url);
      const saved = await saveAsset(a.dest_dir, `${font.id}-${weight}-${style}`, buf, ['ttf', 'otf'], {
        source: 'Fontsource', id: font.id, title: `${font.family} ${weight} ${style}`, author: font.source ?? null, licence: font.license, licence_url: 'https://openfontlicense.org', page: `https://fontsource.org/fonts/${font.id}`,
      });
      return { ...saved, family: font.family, subset, next: 'Call fonts_install with the saved file to use it for live text.' };
    }

    case 'fonts_install': {
      if (process.platform !== 'win32') fail('fonts_install works on Windows only.');
      const file = typeof a.file === 'string' ? path.resolve(a.file) : fail('file is required.');
      resolveSaveDir(SAVE_ROOTS, path.dirname(file));
      const buf = await fs.readFile(file).catch(() => fail('That font file does not exist.'));
      const type = sniffType(buf);
      if (type !== 'ttf' && type !== 'otf') fail('That is not a TTF/OTF font file.');
      const fontsDir = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts');
      await fs.mkdir(fontsDir, { recursive: true });
      const target = path.join(fontsDir, path.basename(file));
      await fs.copyFile(file, target);
      const label = `${path.basename(file, path.extname(file))} (${type === 'otf' ? 'OpenType' : 'TrueType'})`;
      await new Promise((resolve, reject) =>
        execFile('reg', ['add', 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', label, '/t', 'REG_SZ', '/d', target, '/f'], { windowsHide: true }, (err) => (err ? reject(err) : resolve())),
      ).catch(() => fail('Windows refused to register the font.'));
      return { installed: target, for: 'current Windows user only', note: 'If Photoshop or Illustrator do not list it yet, they need a restart.' };
    }

    case 'textures_search': {
      const query = text(a.query, 'query', 80);
      texturesCache ??= await get('https://api.polyhaven.com/assets?t=textures', { json: true });
      const results = Object.entries(texturesCache)
        .map(([id, t]) => ({ id, ...t }))
        .filter((t) => matchesQuery(t, query))
        .sort((x, y) => (y.download_count ?? 0) - (x.download_count ?? 0))
        .slice(0, limitOf(a.limit, 20, 40))
        .map((t) => ({ id: t.id, name: t.name, tags: (t.tags ?? []).slice(0, 8), categories: t.categories, licence: 'CC0-1.0', powered_by: POLY_HAVEN_CREDIT, preview: `https://cdn.polyhaven.com/asset_img/thumbs/${t.id}.png?width=256`, page: `https://polyhaven.com/a/${t.id}` }));
      return { results };
    }

    case 'textures_download': {
      const id = idOf(a.id, 'id');
      const res = ['1k', '2k', '4k'].includes(a.resolution) ? a.resolution : '2k';
      const files = await get(`https://api.polyhaven.com/files/${id}`, { json: true });
      const url = files?.Diffuse?.[res]?.jpg?.url ?? fail(`No ${res} colour map for "${id}".`);
      const info = await get(`https://api.polyhaven.com/info/${id}`, { json: true }).catch(() => ({}));
      const buf = await get(url);
      return saveAsset(a.dest_dir, `${id}-${res}`, buf, ['jpg'], {
        source: 'Poly Haven', id, title: info.name ?? id, author: Object.keys(info.authors ?? {}).join(', ') || null, licence: 'CC0-1.0', licence_url: 'https://polyhaven.com/license', page: `https://polyhaven.com/a/${id}`, powered_by: POLY_HAVEN_CREDIT,
      });
    }

    case 'art_search': {
      const query = text(a.query, 'query', 80);
      const params = new URLSearchParams({ q: query, limit: String(limitOf(a.limit, 12, 30)), fields: 'id,title,artist_display,date_display,image_id,is_public_domain' });
      params.set('query[term][is_public_domain]', 'true');
      const data = await get(`https://api.artic.edu/api/v1/artworks/search?${params}`, { json: true });
      const results = (data.data ?? [])
        .filter((w) => w.is_public_domain && w.image_id)
        .map((w) => ({ id: w.id, title: w.title, artist: w.artist_display, date: w.date_display, licence: 'CC0-1.0', preview: `https://www.artic.edu/iiif/2/${w.image_id}/full/400,/0/default.jpg`, page: `https://www.artic.edu/artworks/${w.id}` }));
      return { results };
    }

    case 'art_download': {
      if (!Number.isInteger(a.id) || a.id < 1) fail('id must be an artwork id number from art_search.');
      const { data: w } = await get(`https://api.artic.edu/api/v1/artworks/${a.id}?fields=id,title,artist_display,date_display,image_id,is_public_domain`, { json: true });
      if (!w?.is_public_domain || !w.image_id) fail('That artwork is not public domain (or has no image), so it can’t be used.');
      const buf = await get(`https://www.artic.edu/iiif/2/${w.image_id}/full/843,/0/default.jpg`);
      return saveAsset(a.dest_dir, `aic-${w.id}-${w.title}`, buf, ['jpg'], {
        source: 'Art Institute of Chicago', id: w.id, title: w.title, author: w.artist_display, licence: 'CC0-1.0', licence_url: 'https://www.artic.edu/open-access/open-access-images', page: `https://www.artic.edu/artworks/${w.id}`,
      });
    }

    default:
      fail(`Unknown tool: ${name}`);
  }
}

/* ---------- JSON-RPC 2.0 over stdio (newline-delimited) ---------- */

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  let result;
  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'design-assets', version: VERSION },
        instructions:
          'Licence-checked free assets for client artwork: icons (SVG), open fonts, CC0 textures and public-domain art reference. Every download is saved inside the allowed folders and credited in asset-credits.json next to it. Use assets as building blocks and reference you redraw or adapt by hand — never as a finished artwork.',
      };
      break;
    case 'ping':
      result = {};
      break;
    case 'tools/list':
      result = { tools: TOOLS };
      break;
    case 'tools/call':
      try {
        const data = await callTool(params?.name, params?.arguments ?? {});
        result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        result = { content: [{ type: 'text', text: e.userFacing || e.message ? e.message : 'Request failed.' }], isError: true };
      }
      break;
    default:
      if (!isRequest) return;
      return send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
  if (isRequest) send({ jsonrpc: '2.0', id, result });
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  handle(msg).catch((e) => msg.id != null && send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: e.message } }));
});
