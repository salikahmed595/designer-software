// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fakePsd, installedSkills, psdLayerCount, psdLayerCountOfFile } from './files';

const reader = (buf: Buffer) => async (pos: number, len: number) => buf.subarray(pos, pos + len);

describe('PSD layer count (so a flat file can be caught)', () => {
  it('reads the number of layers from a layered PSD', async () => {
    expect(await psdLayerCount(reader(fakePsd(7)))).toBe(7);
  });

  it('reads a negative count (first alpha is transparency) as its size', async () => {
    const buf = fakePsd(5);
    buf.writeInt16BE(-5, buf.length - 2);
    expect(await psdLayerCount(reader(buf))).toBe(5);
  });

  it('skips colour-mode and image-resource data of any length', async () => {
    expect(await psdLayerCount(reader(fakePsd(3, { colorModeBytes: 768, resourceBytes: 40_000 })))).toBe(3);
  });

  it('treats a PSD with no layer section as flat (0 layers)', async () => {
    expect(await psdLayerCount(reader(fakePsd(0)))).toBe(0);
  });

  it('returns null for files it cannot read: not a PSD, a PSB, or truncated', async () => {
    expect(await psdLayerCount(reader(Buffer.from('not a psd at all, sorry')))).toBeNull();
    const psb = fakePsd(4);
    psb.writeUInt16BE(2, 4);
    expect(await psdLayerCount(reader(psb))).toBeNull();
    expect(await psdLayerCount(reader(fakePsd(4).subarray(0, 30)))).toBeNull();
  });

  it('reads a real file on disk, and null when it is missing', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'lumora-psd-'));
    try {
      await writeFile(path.join(dir, 'a.psd'), fakePsd(12, { resourceBytes: 5000 }));
      expect(await psdLayerCountOfFile(path.join(dir, 'a.psd'))).toBe(12);
      expect(await psdLayerCountOfFile(path.join(dir, 'missing.psd'))).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('installed skills', () => {
  let a: string;
  let b: string;
  beforeAll(async () => {
    a = await mkdtemp(path.join(os.tmpdir(), 'lumora-skills-a-'));
    b = await mkdtemp(path.join(os.tmpdir(), 'lumora-skills-b-'));
    for (const [dir, name] of [[a, 'anime-art'], [a, 'vtuber-master'], [b, 'manga-effects']]) {
      await mkdir(path.join(dir, name), { recursive: true });
      await writeFile(path.join(dir, name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
    }
    await mkdir(path.join(a, 'no-skill-file'), { recursive: true });
  });
  afterAll(async () => {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  });

  it('finds skill folders that contain a SKILL.md, across several places', async () => {
    const found = await installedSkills([a, b, path.join(a, 'does-not-exist')]);
    expect([...found].sort()).toEqual(['anime-art', 'manga-effects', 'vtuber-master']);
  });
});
