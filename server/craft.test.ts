import { describe, expect, it } from 'vitest';
import { craftSummary, ensureCraft, parseVersion, readCraftServers } from './craft';

const CLAUDE_JSON = JSON.stringify({
  mcpServers: {
    photocraft: { type: 'stdio', command: 'C:\\ArtCraft\\PhotoCraft\\photocraft-cli.exe', args: ['mcp'] },
    vectorcraft: { type: 'stdio', command: 'C:\\ArtCraft\\VectorCraft\\vectorcraft-cli.exe', args: ['mcp'] },
    photoshop: { command: 'ps.exe' },
  },
});

describe('readCraftServers', () => {
  it('reads the registered PhotoCraft / VectorCraft commands', () => {
    expect(readCraftServers(CLAUDE_JSON)).toEqual({
      photocraft: 'C:\\ArtCraft\\PhotoCraft\\photocraft-cli.exe', vectorcraft: 'C:\\ArtCraft\\VectorCraft\\vectorcraft-cli.exe',
    });
  });
  it('survives a missing or broken file', () => {
    expect(readCraftServers('')).toEqual({});
    expect(readCraftServers('{"mcpServers":{"photocraft":{"command":""}}}')).toEqual({});
  });
});

describe('parseVersion', () => {
  it('accepts the program’s own version line', () => {
    expect(parseVersion('photocraft', 0, 'photocraft-cli 0.23.1 (45066c482, 2026-11-12)\n')).toEqual({ app: 'photocraft', ok: true, message: 'PhotoCraft 0.23.1' });
    expect(parseVersion('vectorcraft', 0, 'vectorcraft-cli 0.24.1\n').message).toBe('VectorCraft 0.24.1');
  });
  it('explains a program that is not where it was registered (the “path not found” case)', () => {
    const r = parseVersion('photocraft', null, '');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/PhotoCraft.*could not (run|be started)/);
  });
  it('never treats other output as ready', () => {
    expect(parseVersion('vectorcraft', 0, 'photocraft-cli 1.0').ok).toBe(false);
    expect(parseVersion('vectorcraft', 1, 'vectorcraft-cli 0.24.1').ok).toBe(false);
  });
});

describe('ensureCraft', () => {
  it('checks both registered programs and reports their versions', async () => {
    const calls: string[] = [];
    const r = await ensureCraft({
      registered: readCraftServers(CLAUDE_JSON),
      exec: async (bin, args) => {
        calls.push(`${bin} ${args.join(' ')}`);
        return { code: 0, stdout: bin.includes('photocraft') ? 'photocraft-cli 0.23.1\n' : 'vectorcraft-cli 0.24.1\n' };
      },
    });
    expect(calls).toEqual(['C:\\ArtCraft\\PhotoCraft\\photocraft-cli.exe --version', 'C:\\ArtCraft\\VectorCraft\\vectorcraft-cli.exe --version']);
    expect(r.ok).toBe(true);
    expect(r.detail).toContain('PhotoCraft 0.23.1');
    expect(r.detail).toContain('VectorCraft 0.24.1');
  });

  it('says how to connect an app that is not registered, and starts nothing for it', async () => {
    const calls: string[] = [];
    const r = await ensureCraft({ registered: {}, exec: async (bin) => (calls.push(bin), { code: 0, stdout: '' }) });
    expect(calls).toEqual([]);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/PhotoCraft is not connected to Claude Code/);
    expect(r.detail).toMatch(/VectorCraft is not connected/);
  });
});

describe('craftSummary', () => {
  it('is ready only when both apps are', () => {
    expect(craftSummary([{ app: 'photocraft', ok: true, message: 'PhotoCraft 1' }, { app: 'vectorcraft', ok: false, message: 'VectorCraft is missing.' }]).ok).toBe(false);
  });
});
