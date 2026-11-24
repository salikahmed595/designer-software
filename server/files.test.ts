// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultSkillMap } from '../src/state/production';
import { fakePsd, installSkill, listSkills, psdLayerCount, psdLayerCountOfFile, readSkillMap, writeSkillMap } from './files';

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

const skillFile = (name: string, description = `How to draw ${name}.`) => `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;

describe('installed skills', () => {
  let a: string;
  let b: string;
  beforeAll(async () => {
    a = await mkdtemp(path.join(os.tmpdir(), 'lumora-skills-a-'));
    b = await mkdtemp(path.join(os.tmpdir(), 'lumora-skills-b-'));
    for (const [dir, name] of [[a, 'vtuber-master'], [a, 'anime-art'], [b, 'manga-effects'], [b, 'anime-art']]) {
      await mkdir(path.join(dir, name), { recursive: true });
      await writeFile(path.join(dir, name, 'SKILL.md'), skillFile(name));
    }
    await mkdir(path.join(a, 'no-skill-file'), { recursive: true });
    await mkdir(path.join(a, 'broken'), { recursive: true });
    await writeFile(path.join(a, 'broken', 'SKILL.md'), 'no front matter here');
  });
  afterAll(async () => {
    await rm(a, { recursive: true, force: true });
    await rm(b, { recursive: true, force: true });
  });

  it('finds skill folders with a SKILL.md across several places, sorted, each once, with its description', async () => {
    const found = await listSkills([a, b, path.join(a, 'does-not-exist')]);
    expect(found.map((s) => s.name)).toEqual(['anime-art', 'broken', 'manga-effects', 'vtuber-master']);
    expect(found.find((s) => s.name === 'manga-effects')?.description).toBe('How to draw manga-effects.');
    expect(found.find((s) => s.name === 'broken')?.description).toBe('');
  });
});

describe('adding a skill from the Skills screen', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'lumora-install-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes <dir>/<name>/SKILL.md, creating the folder if needed', async () => {
    const target = path.join(dir, 'nested', 'skills');
    await installSkill(target, 'anime-art', skillFile('anime-art'));
    expect(await readFile(path.join(target, 'anime-art', 'SKILL.md'), 'utf8')).toBe(skillFile('anime-art'));
  });

  it('never overwrites a skill that is already there', async () => {
    await installSkill(dir, 'anime-art', skillFile('anime-art', 'original'));
    await expect(installSkill(dir, 'anime-art', skillFile('anime-art', 'replacement'))).rejects.toThrow(/already/i);
    expect(await readFile(path.join(dir, 'anime-art', 'SKILL.md'), 'utf8')).toContain('original');
  });

  it('refuses names that could leave the skills folder', async () => {
    for (const bad of ['../evil', '..', 'a/b', 'a\\b', '', '.hidden']) {
      await expect(installSkill(dir, bad, 'x'), bad).rejects.toThrow(/name/i);
    }
  });
});

describe('the skill map file', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'lumora-map-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('saves and reads back the same map, keeping the explanation for people who open the file', async () => {
    const file = path.join(dir, 'skills.json');
    const map = { ...defaultSkillMap(), defaultSkill: 'house-style', styles: { ...defaultSkillMap().styles, manga: 'manga-effects' } };
    await writeSkillMap(file, map);
    const back = await readSkillMap(file);
    expect(back.error).toBeNull();
    expect(back.map).toEqual(map);
    expect(JSON.parse(await readFile(file, 'utf8'))._readme).toMatch(/Skills screen/);
    expect((await readdir(dir)).filter((f) => f !== 'skills.json')).toEqual([]);
  });

  it('uses the built-in defaults when the file is missing', async () => {
    const r = await readSkillMap(path.join(dir, 'missing.json'));
    expect(r).toEqual({ map: defaultSkillMap(), error: null });
  });

  it('keeps a broken file aside instead of losing it, and says so', async () => {
    const file = path.join(dir, 'skills.json');
    await writeFile(file, '{ this is not json');
    const r = await readSkillMap(file);
    expect(r.map).toEqual(defaultSkillMap());
    expect(r.error).toMatch(/could not be read/i);
    await writeSkillMap(file, r.map);
    const kept = (await readdir(dir)).filter((f) => f.startsWith('skills.json.broken-'));
    expect(kept).toHaveLength(1);
    expect(await readFile(path.join(dir, kept[0]), 'utf8')).toBe('{ this is not json');
  });
});
