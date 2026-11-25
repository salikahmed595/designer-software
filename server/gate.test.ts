import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GUARD_SCRIPT, PRODUCTION_DENIED_TOOLS, findConceptCopies, guardConfig, jobPaths, permissionPath, productionArgs, productionMcpConfig,
  productionSettings, sha256File,
} from './gate';
// The guard is plain JavaScript so Claude Code can run it with node as a hook.
import { decide } from './production-guard.mjs';

let tmp: string;
let paths: ReturnType<typeof jobPaths>;
let conceptFile: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lumora-gate-'));
  paths = jobPaths(path.join(tmp, 'jobs', 'abcdef123456'));
  for (const d of [paths.concepts, paths.production, paths.control, path.join(paths.production, 'assets')]) await fs.mkdir(d, { recursive: true });
  conceptFile = path.join(paths.concepts, 'concept-v1.png');
  await fs.writeFile(conceptFile, Buffer.from('concept pixels'));
});
afterAll(() => fs.rm(tmp, { recursive: true, force: true }));

describe('job folder layout (spec §12)', () => {
  it('keeps the concept outside the production folder', () => {
    expect(paths.concepts).toBe(path.join(paths.root, 'concepts', 'reference_only'));
    expect(path.relative(paths.production, paths.concepts).startsWith('..')).toBe(true);
    expect(path.relative(paths.production, paths.control).startsWith('..')).toBe(true);
    expect(paths.output).toBe(path.join(paths.production, 'output'));
  });
});

const CLAUDE_JSON = JSON.stringify({
  mcpServers: {
    photoshop: { type: 'stdio', command: 'C:\\venv\\cli-anything-photoshop.exe', args: ['mcp', '--allowed-root', 'C:\\Users\\salik', '--allowed-root', 'D:\\'], env: {} },
    illustrator: { type: 'stdio', command: 'C:\\venv\\cli-anything-illustrator.exe', args: ['mcp', '--allowed-root=D:\\', '--allow-jsx'], env: {} },
    'design-assets': { type: 'stdio', command: 'node.exe', args: ['server.mjs', '--save-root', 'D:\\jobs', '--save-root', 'C:\\Lumora-assets'] },
    github: { command: 'gh-mcp' },
  },
});

describe('per-job connector config: the production folder is the only root', () => {
  it('replaces every broad root with the job production folder', () => {
    const cfg = productionMcpConfig(CLAUDE_JSON, paths);
    expect(Object.keys(cfg.mcpServers).sort()).toEqual(['design-assets', 'illustrator', 'photoshop']);
    expect(cfg.mcpServers.photoshop).toEqual({ type: 'stdio', command: 'C:\\venv\\cli-anything-photoshop.exe', args: ['mcp', '--allowed-root', paths.production], env: {} });
    // --allow-jsx (arbitrary scripts) is dropped too: only the typed tools are used in production
    expect(cfg.mcpServers.illustrator.args).toEqual(['mcp', '--allowed-root', paths.production]);
    expect(cfg.mcpServers['design-assets'].args).toEqual(['server.mjs', '--save-root', path.join(paths.production, 'assets')]);
    // every root any connector gets is the production folder (or inside it) — no drive, no home folder
    for (const e of Object.values(cfg.mcpServers)) {
      e.args.forEach((a, i) => {
        if (a === '--allowed-root' || a === '--save-root') expect(e.args[i + 1].startsWith(paths.production)).toBe(true);
      });
    }
  });

  it('leaves out connectors that are not registered', () => {
    expect(productionMcpConfig('{}', paths).mcpServers).toEqual({});
    expect(productionMcpConfig('not json', paths).mcpServers).toEqual({});
  });
});

describe('agent arguments and settings', () => {
  const files = { mcp: 'C:/job/control/mcp.json', settings: 'C:/job/control/settings.json' };
  it('always uses only the per-job connectors and the guard settings', () => {
    const args = productionArgs({ label: 'login', kind: 'login', secret: null }, files);
    expect(args).toContain('--strict-mcp-config');
    expect(args.slice(args.indexOf('--mcp-config'), args.indexOf('--mcp-config') + 2)).toEqual(['--mcp-config', files.mcp]);
    expect(args.slice(args.indexOf('--settings'), args.indexOf('--settings') + 2)).toEqual(['--settings', files.settings]);
    expect(args[args.indexOf('--disallowedTools') + 1]).toBe(PRODUCTION_DENIED_TOOLS.join(','));
    expect(args).not.toContain('--bare');
    expect(productionArgs({ label: 'key', kind: 'apikey', secret: 'x' }, files)[0]).toBe('--bare');
  });

  it('writes Claude Code permission paths in its //drive/ form', () => {
    expect(permissionPath('D:\\Salik\\jobs\\a b\\concepts')).toBe('//d/Salik/jobs/a b/concepts');
    expect(permissionPath('/home/u/jobs')).toBe('//home/u/jobs');
  });

  it('denies reads and edits of the concept and control folders and runs the guard hook on every tool', () => {
    const s = productionSettings(paths, { node: 'C:\\Program Files\\nodejs\\node.exe', configFile: path.join(paths.control, 'guard.json') });
    for (const tool of ['Read', 'Edit']) {
      expect(s.permissions.deny).toContain(`${tool}(${permissionPath(paths.concepts)}/**)`);
      expect(s.permissions.deny).toContain(`${tool}(${permissionPath(paths.control)}/**)`);
    }
    for (const t of PRODUCTION_DENIED_TOOLS) expect(s.permissions.deny).toContain(t);
    const hook = s.hooks.PreToolUse[0];
    expect(hook.matcher).toBe('*');
    expect(hook.hooks[0].command).toContain(GUARD_SCRIPT.replace(/\\/g, '/'));
    expect(hook.hooks[0].command).toContain('guard.json');
  });
});

describe('the production guard (PreToolUse hook)', () => {
  const cfg = () => guardConfig(paths, path.join(tmp, 'jobs'));
  const call = (tool_name: string, tool_input: Record<string, unknown>) => decide({ tool_name, tool_input, cwd: paths.production }, cfg());

  it.each([
    ['mcp__photoshop__place', { path: () => conceptFile }],
    ['mcp__illustrator__place', { path: () => conceptFile }],
    ['mcp__photoshop__doc_open', { path: () => conceptFile }],
    ['mcp__illustrator__doc_open', { path: () => conceptFile }],
    ['Read', { file_path: () => conceptFile }],
  ])('refuses %s of the concept file', (tool, input) => {
    const r = call(tool, Object.fromEntries(Object.entries(input).map(([k, f]) => [k, f()])));
    expect(r.allow).toBe(false);
  });

  it('refuses tricks: relative traversal, forward slashes, other case, glob patterns, other jobs', () => {
    expect(call('Read', { file_path: '../concepts/reference_only/concept-v1.png' }).allow).toBe(false);
    expect(call('mcp__photoshop__place', { path: conceptFile.replace(/\\/g, '/') }).allow).toBe(false);
    expect(call('mcp__photoshop__place', { path: conceptFile.toUpperCase() }).allow).toBe(false);
    expect(call('Glob', { pattern: '**/reference_only/*.png', path: tmp }).allow).toBe(false);
    expect(call('Glob', { pattern: '../**/*.png' }).allow).toBe(false);
    expect(call('Grep', { pattern: 'x', path: path.join(paths.root, 'approvals') }).allow).toBe(false);
    expect(call('Read', { file_path: path.join(tmp, 'jobs', 'ffffff000000', 'production', 'output', 'preview.png') }).allow).toBe(false);
    expect(call('Edit', { file_path: path.join(paths.control, 'guard.json'), old_string: 'a', new_string: 'b' }).allow).toBe(false);
  });

  it('refuses shells, web access, Image Trace and unknown connectors', () => {
    for (const t of ['Bash', 'PowerShell', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'mcp__illustrator__trace', 'mcp__github__create_issue']) {
      expect(call(t, {}).allow, t).toBe(false);
    }
  });

  it('refuses writing anywhere but the production folder', () => {
    expect(call('Write', { file_path: path.join(tmp, 'elsewhere.txt'), content: 'x' }).allow).toBe(false);
    expect(call('mcp__photoshop__doc_save', { path: path.join(tmp, 'out.psd') }).allow).toBe(false);
  });

  it('allows normal production work', () => {
    expect(call('mcp__photoshop__doc_new', { width: 100, height: 100 }).allow).toBe(true);
    expect(call('mcp__photoshop__doc_save', { path: path.join(paths.output, 'artwork.psd') }).allow).toBe(true);
    expect(call('mcp__illustrator__place', { path: path.join(paths.production, 'assets', 'icon.svg') }).allow).toBe(true);
    expect(call('Write', { file_path: path.join(paths.production, 'stages', 'fox', '01-sketch.json'), content: '{}' }).allow).toBe(true);
    expect(call('Read', { file_path: 'job.json' }).allow).toBe(true);
    // skill files live outside the jobs folder
    expect(call('Read', { file_path: path.join(os.homedir(), '.claude', 'skills', 'x', 'SKILL.md') }).allow).toBe(true);
    expect(call('Skill', { skill: 'universal-artwork-production-agent' }).allow).toBe(true);
  });
});

const CRAFT_JSON = JSON.stringify({
  mcpServers: {
    ...JSON.parse(CLAUDE_JSON).mcpServers,
    photocraft: { type: 'stdio', command: 'C:\\ArtCraft\\photocraft-cli.exe', args: ['mcp', '--automation-read-root', 'C:\\Users\\salik\\Documents\\PhotoCraft-Work', '--automation-write-root', 'C:\\Users\\salik\\Documents\\PhotoCraft-Work'], env: {} },
    vectorcraft: { type: 'stdio', command: 'C:\\ArtCraft\\vectorcraft-cli.exe', args: ['mcp', '--automation-read-root=D:\\', '--automation-write-root', 'D:\\'], env: {} },
  },
});

describe('PhotoCraft + VectorCraft jobs (engine "craft")', () => {
  it('give the agent only the Craft connectors, each rooted in the production folder for reading and writing', () => {
    const cfg = productionMcpConfig(CRAFT_JSON, paths, 'craft');
    expect(Object.keys(cfg.mcpServers).sort()).toEqual(['design-assets', 'photocraft', 'vectorcraft']);
    const both = ['mcp', '--automation-read-root', paths.production, '--automation-write-root', paths.production];
    expect(cfg.mcpServers.photocraft.args).toEqual(both);
    expect(cfg.mcpServers.vectorcraft.args).toEqual(both);
    // the Adobe config is unchanged and never includes the Craft apps
    expect(Object.keys(productionMcpConfig(CRAFT_JSON, paths).mcpServers).sort()).toEqual(['design-assets', 'illustrator', 'photoshop']);
  });

  it('allow only the Craft tools, and deny window control', () => {
    const args = productionArgs({ label: 'login', kind: 'login', secret: null }, { mcp: 'm.json', settings: 's.json' }, 'craft');
    const allowed = args[args.indexOf('--allowedTools') + 1].split(',');
    expect(allowed).toEqual(expect.arrayContaining(['mcp__photocraft', 'mcp__vectorcraft', 'mcp__design-assets', 'Skill', 'Write']));
    expect(allowed).not.toContain('mcp__photoshop');
    const denied = args[args.indexOf('--disallowedTools') + 1].split(',');
    expect(denied).toEqual(expect.arrayContaining(['Bash', 'mcp__vectorcraft__pointer_gesture', 'mcp__photocraft__control_call']));
    const s = productionSettings(paths, { node: 'node', configFile: 'g.json' }, 'craft');
    expect(s.permissions.deny).toContain('mcp__photocraft__ui_pointer');
  });

  describe('the guard', () => {
    const cfg = () => guardConfig(paths, path.join(tmp, 'jobs'), 'craft');
    const call = (tool_name: string, tool_input: Record<string, unknown>) => decide({ tool_name, tool_input, cwd: paths.production }, cfg());

    it('refuses the concept, the other engine, window control and Image Trace commands', () => {
      expect(call('mcp__photocraft__doc_place', { path: conceptFile }).allow).toBe(false);
      expect(call('mcp__vectorcraft__open_file', { path: '../concepts/reference_only/concept-v1.png' }).allow).toBe(false);
      expect(call('mcp__photoshop__doc_new', {}).allow).toBe(false);
      expect(call('mcp__vectorcraft__pointer_gesture', {}).allow).toBe(false);
      expect(call('mcp__vectorcraft__command_run', { id: 'imageTrace.makeAndExpand', params: {} }).allow).toBe(false);
      expect(call('mcp__vectorcraft__run_command', { command: 'ImageTrace.make' }).allow).toBe(false);
      expect(call('mcp__vectorcraft__command_batch', { commands: [{ id: 'object.group' }, { id: 'addon.document.batchTraceFolder' }] }).allow).toBe(false);
      expect(call('mcp__photocraft__doc_save', { path: path.join(tmp, 'out.psd') }).allow).toBe(false);
    });

    it('allows normal Craft work inside the production folder', () => {
      expect(call('mcp__vectorcraft__command_run', { id: 'file.new', params: { width: 1280, height: 720, units: 'Pixels' } }).allow).toBe(true);
      expect(call('mcp__vectorcraft__draw_path', { d: 'M0 0 C10 10 20 10 30 0 Z', fill: '#ff0000', stroke: 'none', name: 'Flame' }).allow).toBe(true);
      expect(call('mcp__vectorcraft__save_file', { path: 'output/artwork.ai' }).allow).toBe(true);
      expect(call('mcp__photocraft__doc_place', { path: 'parts/flame.svg' }).allow).toBe(true);
      expect(call('mcp__photocraft__doc_save', { path: path.join(paths.output, 'artwork.psd') }).allow).toBe(true);
      expect(call('mcp__photocraft__command_batch', { commands: [{ id: 'layer.new.layer', params: { name: 'Glow' } }] }).allow).toBe(true);
    });

    it('keeps the Adobe guard as it was', () => {
      const adobe = (tool_name: string, tool_input: Record<string, unknown>) => decide({ tool_name, tool_input, cwd: paths.production }, guardConfig(paths, path.join(tmp, 'jobs')));
      expect(adobe('mcp__photocraft__doc_new', {}).allow).toBe(false);
      expect(adobe('mcp__photoshop__doc_new', {}).allow).toBe(true);
      expect(adobe('mcp__illustrator__trace', {}).allow).toBe(false);
    });
  });
});

/** Runs the guard exactly like Claude Code does: JSON on stdin; exit 2 = blocked (stderr goes to the agent). */
function runGuard(configFile: string, input: unknown): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [GUARD_SCRIPT, configFile], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

describe('the guard as a real hook process (integration)', () => {
  it('exits 2 for a place of the concept and 0 for normal work; fails closed on bad input', async () => {
    const configFile = path.join(paths.control, 'guard.json');
    await fs.writeFile(configFile, JSON.stringify(guardConfig(paths, path.join(tmp, 'jobs'))));
    const blocked = await runGuard(configFile, { tool_name: 'mcp__photoshop__place', tool_input: { path: conceptFile }, cwd: paths.production });
    expect(blocked.code).toBe(2);
    expect(blocked.stderr).toMatch(/concept|production folder/i);
    const ok = await runGuard(configFile, { tool_name: 'mcp__photoshop__doc_new', tool_input: { width: 10, height: 10 }, cwd: paths.production });
    expect(ok.code).toBe(0);
    expect((await runGuard(configFile, 'not an object')).code).toBe(2);
    expect((await runGuard(path.join(tmp, 'missing.json'), { tool_name: 'Read', tool_input: {} })).code).toBe(2);
  });
});

describe('provenance: no copy of the concept in production', () => {
  it('finds a byte-for-byte copy anywhere under the production folder', async () => {
    const hash = await sha256File(conceptFile);
    expect(await findConceptCopies(paths.production, new Set([hash]))).toEqual([]);
    await fs.mkdir(path.join(paths.production, 'assets', 'deep'), { recursive: true });
    await fs.copyFile(conceptFile, path.join(paths.production, 'assets', 'deep', 'innocent.png'));
    expect(await findConceptCopies(paths.production, new Set([hash]))).toEqual([path.join('assets', 'deep', 'innocent.png')]);
  });
});
