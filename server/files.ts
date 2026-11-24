/**
 * File checks for the production bridge:
 *  - how many layers a saved PSD has (a flat PSD is useless to a designer who wants to edit it)
 *  - which skills are installed on this computer (so a typo or missing skill is caught before a job starts)
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultSkillMap, normalizeSkillMap, type SkillMap } from '../src/state/production';

type Reader = (position: number, length: number) => Promise<Buffer>;

/** Tagged blocks that hold the layer list for 16- and 32-bit documents. */
const LAYER_KEYS = new Set(['Lr16', 'Lr32', 'Layr']);

/**
 * Number of layers in a PSD (version 1), read from its section headers only — the image data is never loaded.
 * Returns null when the file is not a readable PSD (PSB, truncated, wrong format).
 */
export async function psdLayerCount(read: Reader): Promise<number | null> {
  const take = async (pos: number, len: number) => {
    const b = await read(pos, len);
    if (b.length < len) throw new Error('short');
    return b;
  };
  try {
    const header = await take(0, 26);
    if (header.toString('latin1', 0, 4) !== '8BPS' || header.readUInt16BE(4) !== 1) return null;
    let pos = 26;
    pos += 4 + (await take(pos, 4)).readUInt32BE(0); // colour mode data
    pos += 4 + (await take(pos, 4)).readUInt32BE(0); // image resources
    const sectionLength = (await take(pos, 4)).readUInt32BE(0); // layer and mask information
    if (sectionLength === 0) return 0;
    const sectionEnd = pos + 4 + sectionLength;
    pos += 4;
    const layerInfoLength = (await take(pos, 4)).readUInt32BE(0);
    if (layerInfoLength > 0) return Math.abs((await take(pos + 4, 2)).readInt16BE(0));

    // 16/32-bit documents keep their layers in a tagged block after the global layer mask.
    pos += 4;
    pos += 4 + (await take(pos, 4)).readUInt32BE(0);
    while (pos + 12 <= sectionEnd) {
      const block = await take(pos, 12);
      const length = block.readUInt32BE(8);
      if (LAYER_KEYS.has(block.toString('latin1', 4, 8))) return length === 0 ? 0 : Math.abs((await take(pos + 12, 2)).readInt16BE(0));
      pos += 12 + length;
    }
    return 0;
  } catch {
    return null;
  }
}

export async function psdLayerCountOfFile(file: string): Promise<number | null> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(file, 'r');
    const h = handle;
    return await psdLayerCount(async (position, length) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await h.read(buffer, 0, length, position);
      return buffer.subarray(0, bytesRead);
    });
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

/** A minimal PSD skeleton with a layer count — for tests and the demo runner only (it has no pixels). */
export function fakePsd(layers: number, opts: { colorModeBytes?: number; resourceBytes?: number } = {}): Buffer {
  const header = Buffer.alloc(26);
  header.write('8BPS', 0, 'latin1');
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(3, 12);
  header.writeUInt32BE(64, 14);
  header.writeUInt32BE(64, 18);
  header.writeUInt16BE(8, 22);
  header.writeUInt16BE(3, 24);
  const block = (n: number) => {
    const b = Buffer.alloc(4 + n);
    b.writeUInt32BE(n, 0);
    return b;
  };
  const layerSection = Buffer.alloc(layers === 0 ? 4 : 10);
  if (layers > 0) {
    layerSection.writeUInt32BE(6, 0);
    layerSection.writeUInt32BE(2, 4);
    layerSection.writeInt16BE(layers, 8);
  }
  return Buffer.concat([header, block(opts.colorModeBytes ?? 0), block(opts.resourceBytes ?? 0), layerSection]);
}

/* ---------- skills on this computer ---------- */

/** Where new skills are installed: Claude Code's personal skills folder (LUMORA_SKILLS_INSTALL_DIR overrides it, e.g. for tests). */
export const skillInstallDir = (): string => path.resolve(process.env.LUMORA_SKILLS_INSTALL_DIR?.trim() || path.join(os.homedir(), '.claude', 'skills'));

/** Where skills are looked for: the install folder plus any extra folders in LUMORA_SKILLS_DIRS. */
export function skillDirs(): string[] {
  const extra = (process.env.LUMORA_SKILLS_DIRS ?? '').split(path.delimiter).map((d) => d.trim()).filter(Boolean);
  return [...new Set([skillInstallDir(), path.join(os.homedir(), '.claude', 'skills'), ...extra.map((d) => path.resolve(d))])];
}

/** The description line from a SKILL.md's front matter ('' if it has none). */
function descriptionOf(text: string): string {
  const head = text.replace(/\r\n?/g, '\n').split('\n---', 2)[0];
  const m = /^description\s*:\s*(.*)$/m.exec(head);
  if (!m) return '';
  const first = m[1].trim();
  if (first && !/^[>|][-+]?$/.test(first)) return first.replace(/^(['"])(.*)\1$/, '$2').slice(0, 400);
  const after = head.slice(head.indexOf(m[0]) + m[0].length).split('\n').slice(1);
  const more: string[] = [];
  for (const l of after) {
    if (!/^\s+\S/.test(l)) break;
    more.push(l.trim());
  }
  return more.join(' ').slice(0, 400);
}

/** Skill folders (folders with a SKILL.md) in the given places, each name once, sorted. Missing places are skipped. */
export async function listSkills(dirs: string[]): Promise<{ name: string; description: string }[]> {
  const found = new Map<string, string>();
  for (const dir of dirs) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || found.has(entry.name)) continue;
      const text = await readStart(path.join(dir, entry.name, 'SKILL.md'));
      if (text !== null) found.set(entry.name, descriptionOf(text));
    }
  }
  return [...found].sort(([a], [b]) => a.localeCompare(b)).map(([name, description]) => ({ name, description }));
}

/** First few KB of a file (enough for the front matter), or null if it is not a readable file. */
async function readStart(file: string): Promise<string | null> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(file, 'r');
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

const SAFE_FOLDER = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** A skill's whole SKILL.md (up to 256 KB) from the first place that has it; null if missing or the name is not a plain folder name. */
export async function readSkillText(dirs: string[], name: string): Promise<string | null> {
  if (!SAFE_FOLDER.test(name)) return null;
  for (const dir of dirs) {
    try {
      const file = path.join(path.resolve(dir), name, 'SKILL.md');
      const stat = await fs.stat(file);
      if (stat.isFile() && stat.size <= 256 * 1024) return await fs.readFile(file, 'utf8');
    } catch {
      /* not in this place */
    }
  }
  return null;
}

/**
 * Installs a skill as <dir>/<name>/SKILL.md. Never overwrites: if the folder exists the install fails.
 * The name must already be validated (parseSkillFile); this re-checks it so no path can leave <dir>.
 */
export async function installSkill(dir: string, name: string, content: string): Promise<void> {
  if (!SAFE_FOLDER.test(name)) throw new Error('That skill name is not allowed.');
  const root = path.resolve(dir);
  const target = path.join(root, name);
  if (path.dirname(target) !== root) throw new Error('That skill name is not allowed.');
  await fs.mkdir(root, { recursive: true });
  try {
    await fs.mkdir(target);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`A skill called “${name}” is already installed.`);
    throw e;
  }
  await fs.writeFile(path.join(target, 'SKILL.md'), content, { encoding: 'utf8', flag: 'wx' });
}

/* ---------- the skill map file (production/skills.json) ---------- */

const README = 'Which skill draws each art style and artwork type. Change it on the Skills screen in the app (it saves this file). null = use the default skill.';

/** Reads the map. A missing file means the built-in defaults; a broken one is reported (and kept aside on the next save). */
export async function readSkillMap(file: string): Promise<{ map: SkillMap; error: string | null }> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return { map: defaultSkillMap(), error: null };
  }
  let map: SkillMap | null = null;
  try {
    map = normalizeSkillMap(JSON.parse(text));
  } catch {
    /* not JSON */
  }
  return map
    ? { map, error: null }
    : { map: defaultSkillMap(), error: `${path.basename(file)} could not be read, so the built-in defaults are shown. Saving a change will keep the old file aside and start a fresh one.` };
}

/** Saves the map atomically (temp file + rename). A file that can't be read is renamed aside first, never lost. */
export async function writeSkillMap(file: string, map: SkillMap): Promise<void> {
  const current = await fs.readFile(file, 'utf8').catch(() => null);
  if (current !== null) {
    let readable = false;
    try {
      readable = normalizeSkillMap(JSON.parse(current)) !== null;
    } catch {
      /* broken */
    }
    if (!readable) await fs.rename(file, `${file}.broken-${Date.now()}`);
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify({ _readme: README, ...map }, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}
