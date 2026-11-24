/**
 * File checks for the production bridge:
 *  - how many layers a saved PSD has (a flat PSD is useless to a designer who wants to edit it)
 *  - which skills are installed on this computer (so a typo or missing skill is caught before a job starts)
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

/** Where Claude Code keeps personal skills, plus any extra folders in LUMORA_SKILLS_DIRS. */
export function skillDirs(): string[] {
  const extra = (process.env.LUMORA_SKILLS_DIRS ?? '').split(path.delimiter).map((d) => d.trim()).filter(Boolean);
  return [path.join(os.homedir(), '.claude', 'skills'), ...extra];
}

/** Names of skill folders (folders with a SKILL.md) in the given places. Missing places are skipped. */
export async function installedSkills(dirs: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const dir of dirs) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const ok = await fs.stat(path.join(dir, entry.name, 'SKILL.md')).then((s) => s.isFile(), () => false);
      if (ok) found.add(entry.name);
    }
  }
  return found;
}
