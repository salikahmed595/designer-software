import { describe, expect, it } from 'vitest';
import { adobeSummary, ensureAdobe, mcpAddArgs, parseCheck, readRegisteredServers, shellArg, type Exec } from './adobe';

const okReply = (label: string) => JSON.stringify({ ok: true, result: { ok: true, message: `${label} found at D:\\softwares\\x.exe.` } });
const missingReply = (label: string) => JSON.stringify({ ok: false, error: `${label} is not installed on this computer. Install ${label} (version 25.x), open it once, then try again.` });

describe('parseCheck', () => {
  it('accepts a passing 2024 check', () => {
    expect(parseCheck('photoshop', 0, okReply('Adobe Photoshop 2024'))).toEqual({ app: 'photoshop', ok: true, message: 'Adobe Photoshop 2024 found at D:\\softwares\\x.exe.' });
  });
  it('passes the connector’s install message through', () => {
    const r = parseCheck('photoshop', 1, missingReply('Adobe Photoshop 2024'));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Install Adobe Photoshop 2024/);
  });
  it('explains a connector that could not run at all', () => {
    expect(parseCheck('illustrator', null, '').message).toMatch(/Illustrator 2024 connector .* could not run/);
  });
  it('never treats garbage output as success', () => {
    expect(parseCheck('illustrator', 0, 'hello').ok).toBe(false);
  });
});

describe('adobeSummary', () => {
  it('is connected only when both 2024 apps pass', () => {
    const s = adobeSummary([{ app: 'photoshop', ok: true, message: '' }, { app: 'illustrator', ok: true, message: '' }]);
    expect(s.ok).toBe(true);
    expect(s.detail).toMatch(/Photoshop 2024 and Illustrator 2024/);
  });
  it('lists what to install and asks for a restart', () => {
    const s = adobeSummary([{ app: 'photoshop', ok: true, message: '' }, { app: 'illustrator', ok: false, message: 'Install Adobe Illustrator 2024.' }]);
    expect(s.ok).toBe(false);
    expect(s.detail).toBe('Install Adobe Illustrator 2024. Then restart the studio app.');
  });
});

describe('readRegisteredServers', () => {
  it('reads the user-scope MCP commands', () => {
    const text = JSON.stringify({ mcpServers: { photoshop: { command: 'C:\\ps.exe', args: [] }, other: { command: 'x' } } });
    expect(readRegisteredServers(text)).toEqual({ photoshop: 'C:\\ps.exe' });
  });
  it('survives a missing or broken file', () => {
    expect(readRegisteredServers('')).toEqual({});
    expect(readRegisteredServers('{nope')).toEqual({});
  });
});

describe('shellArg / mcpAddArgs', () => {
  it('quotes paths with spaces and refuses characters cmd would expand', () => {
    expect(shellArg('C:\\a b\\x.exe')).toBe('"C:\\a b\\x.exe"');
    expect(shellArg('mcp')).toBe('mcp');
    expect(() => shellArg('a"b')).toThrow();
    expect(() => shellArg('%PATH%')).toThrow();
  });
  it('registers the server at user scope with allowed roots', () => {
    expect(mcpAddArgs('photoshop', 'C:\\ps.exe', ['C:\\Users\\u', 'D:\\jobs'])).toEqual(
      ['mcp', 'add', '--scope', 'user', 'photoshop', '--', 'C:\\ps.exe', 'mcp', '--allowed-root', 'C:\\Users\\u', '--allowed-root', 'D:\\jobs'],
    );
  });
});

describe('ensureAdobe', () => {
  const fakeExec = (handler: (bin: string, args: string[]) => { code: number | null; stdout: string }) => {
    const calls: Array<[string, string[]]> = [];
    const exec: Exec = async (bin, args) => {
      calls.push([bin, args]);
      return handler(bin, args);
    };
    return { exec, calls };
  };

  it('checks the already-registered connectors without registering again', async () => {
    const { exec, calls } = fakeExec((bin) => ({ code: 0, stdout: okReply(bin.includes('ps') ? 'Adobe Photoshop 2024' : 'Adobe Illustrator 2024') }));
    const out = await ensureAdobe({ claudeBin: 'claude', roots: ['C:\\u'], registered: { photoshop: 'C:\\ps.exe', illustrator: 'C:\\ai.exe' }, exec });
    expect(out.ok).toBe(true);
    expect(calls).toEqual([['C:\\ps.exe', ['--json', 'app', 'check']], ['C:\\ai.exe', ['--json', 'app', 'check']]]);
  });

  it('registers a missing connector with Claude Code automatically, then checks it', async () => {
    const { exec, calls } = fakeExec((bin) => {
      if (bin === 'where') return { code: 0, stdout: 'C:\\venv\\cli-anything-illustrator.exe\r\n' };
      if (bin === 'claude') return { code: 0, stdout: 'Added' };
      return { code: 0, stdout: okReply('Adobe 2024') };
    });
    const out = await ensureAdobe({ claudeBin: 'claude', roots: ['C:\\u'], registered: { photoshop: 'C:\\ps.exe' }, exec });
    expect(out.ok).toBe(true);
    expect(calls).toContainEqual(['claude', mcpAddArgs('illustrator', 'C:\\venv\\cli-anything-illustrator.exe', ['C:\\u'])]);
    expect(calls).toContainEqual(['C:\\venv\\cli-anything-illustrator.exe', ['--json', 'app', 'check']]);
    expect(out.results.find((r) => r.app === 'illustrator')?.registeredNow).toBe(true);
  });

  it('says to install the connector when it is nowhere on this computer', async () => {
    const { exec } = fakeExec((bin) => (bin === 'where' ? { code: 1, stdout: '' } : { code: 0, stdout: okReply('Adobe Photoshop 2024') }));
    const out = await ensureAdobe({ claudeBin: 'claude', roots: ['C:\\u'], registered: { photoshop: 'C:\\ps.exe' }, exec });
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/Illustrator 2024 connector \(cli-anything-illustrator\) is not installed/);
  });

  it('reports a missing 2024 app with the connector’s install message', async () => {
    const { exec } = fakeExec((bin) => (bin.includes('ps') ? { code: 1, stdout: missingReply('Adobe Photoshop 2024') } : { code: 0, stdout: okReply('Adobe Illustrator 2024') }));
    const out = await ensureAdobe({ claudeBin: 'claude', roots: ['C:\\u'], registered: { photoshop: 'C:\\ps.exe', illustrator: 'C:\\ai.exe' }, exec });
    expect(out.ok).toBe(false);
    expect(out.detail).toMatch(/Install Adobe Photoshop 2024/);
  });
});
