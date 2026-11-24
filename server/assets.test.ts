import { describe, expect, it } from 'vitest';
import { DESIGN_ASSETS, assetsAddArgs, assetsRegistration, ensureDesignAssets } from './assets';
import type { Exec } from './adobe';

const NODE = 'C:\\Program Files\\nodejs\\node.exe';
const FILE = 'D:\\studio\\mcp\\design-assets\\server.mjs';
const ROOTS = ['D:\\studio\\production\\jobs', 'C:\\Users\\me\\Documents\\Lumora-assets'];
const registered = (args: string[]) => JSON.stringify({ mcpServers: { [DESIGN_ASSETS]: { type: 'stdio', command: NODE, args } } });
const goodArgs = [FILE, '--save-root', ROOTS[0], '--save-root', ROOTS[1]];

describe('assetsRegistration', () => {
  it('is ok when the connector points at this server file with every save folder', () => {
    expect(assetsRegistration(registered(goodArgs), FILE, ROOTS)).toBe('ok');
    expect(assetsRegistration(registered(goodArgs.map((a) => a.toLowerCase())), FILE, ROOTS)).toBe('ok');
  });
  it('is missing when not registered or the config is unreadable', () => {
    expect(assetsRegistration(JSON.stringify({ mcpServers: {} }), FILE, ROOTS)).toBe('missing');
    expect(assetsRegistration('not json', FILE, ROOTS)).toBe('missing');
  });
  it('is stale when it points at another copy or lacks a save folder (e.g. the jobs folder moved)', () => {
    expect(assetsRegistration(registered(['D:\\old\\server.mjs', ...goodArgs.slice(1)]), FILE, ROOTS)).toBe('stale');
    expect(assetsRegistration(registered([FILE, '--save-root', ROOTS[1]]), FILE, ROOTS)).toBe('stale');
  });
});

describe('ensureDesignAssets', () => {
  const run = (code: number) => {
    const calls: string[][] = [];
    const exec: Exec = async (bin, args) => {
      calls.push([bin, ...args]);
      return { code, stdout: '' };
    };
    return { calls, exec };
  };

  it('does nothing when it is already registered', async () => {
    const { calls, exec } = run(0);
    const r = await ensureDesignAssets({ claudeBin: 'claude', claudeJson: registered(goodArgs), nodeBin: NODE, serverFile: FILE, roots: ROOTS, exec });
    expect(r).toEqual({ ok: true, message: 'Free asset sources are connected (icons, fonts, textures, public-domain art).' });
    expect(calls).toEqual([]);
  });

  it('registers it at user scope with node, the server file and each save folder', async () => {
    const { calls, exec } = run(0);
    const r = await ensureDesignAssets({ claudeBin: 'claude', claudeJson: '{}', nodeBin: NODE, serverFile: FILE, roots: ROOTS, exec });
    expect(r.ok).toBe(true);
    expect(calls).toEqual([['claude', 'mcp', 'add', '--scope', 'user', 'design-assets', '--', NODE, FILE, '--save-root', ROOTS[0], '--save-root', ROOTS[1]]]);
    expect(assetsAddArgs(NODE, FILE, ROOTS)).toEqual(calls[0].slice(1));
  });

  it('replaces a stale registration', async () => {
    const { calls, exec } = run(0);
    await ensureDesignAssets({ claudeBin: 'claude', claudeJson: registered(['D:\\old\\server.mjs']), nodeBin: NODE, serverFile: FILE, roots: ROOTS, exec });
    expect(calls.map((c) => c.slice(1, 3).join(' '))).toEqual(['mcp remove', 'mcp add']);
  });

  it('never blocks drawing: a failed registration is a note with the command to run', async () => {
    const { exec } = run(1);
    const r = await ensureDesignAssets({ claudeBin: 'claude', claudeJson: '{}', nodeBin: NODE, serverFile: FILE, roots: ROOTS, exec });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/^Free asset sources could not be connected automatically\. Run: claude mcp add --scope user design-assets -- /);
  });
});
