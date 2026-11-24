/**
 * Adobe readiness for the drawing agent (dev server only, this computer only).
 *
 * The agent draws through two MCP connectors, `photoshop` and `illustrator` (the cli-anything-* programs).
 * Those connectors are pinned to Photoshop 2023 and Illustrator 2023 and never open another version
 * (a newer install can ask for a licence key). At startup this module:
 *   1. reads which connectors are registered with Claude Code (~/.claude.json, user scope),
 *   2. registers a missing one automatically (`claude mcp add --scope user …`) when its program is installed,
 *   3. runs `<connector> --json app check`, which reads the registry only and starts nothing,
 * and turns the result into one plain status line ("install Photoshop 2023 …" when it is missing).
 */
import { spawn } from 'node:child_process';

export type AdobeApp = 'photoshop' | 'illustrator';
export const ADOBE_APPS: readonly AdobeApp[] = ['photoshop', 'illustrator'];
const LABEL: Record<AdobeApp, string> = { photoshop: 'Photoshop 2023', illustrator: 'Illustrator 2023' };

export interface AppReadiness { app: AdobeApp; ok: boolean; message: string; registeredNow?: boolean }
export interface AdobeReadiness { ok: boolean; detail: string; results: AppReadiness[] }
export type Exec = (bin: string, args: string[]) => Promise<{ code: number | null; stdout: string }>;

/** Read a connector's `--json app check` reply. Anything unreadable counts as not ready. */
export function parseCheck(app: AdobeApp, code: number | null, stdout: string): AppReadiness {
  const last = stdout.trim().split(/\r?\n/).pop() ?? '';
  try {
    const reply = JSON.parse(last) as { ok?: unknown; error?: unknown; result?: { ok?: unknown; message?: unknown } };
    if (reply.ok === true && reply.result?.ok === true) return { app, ok: true, message: String(reply.result.message ?? '') };
    if (reply.ok === false && typeof reply.error === 'string') return { app, ok: false, message: reply.error };
  } catch {
    /* not JSON */
  }
  if (code === null) return { app, ok: false, message: `The ${LABEL[app]} connector (cli-anything-${app}) could not run on this computer.` };
  return { app, ok: false, message: `The ${LABEL[app]} connector gave an unexpected answer (exit code ${code}).` };
}

export function adobeSummary(results: AppReadiness[]): { ok: boolean; detail: string } {
  const bad = results.filter((r) => !r.ok);
  if (!bad.length) {
    return { ok: true, detail: 'Connected: the agent will draw in Photoshop 2023 and Illustrator 2023 on this computer (other versions are never opened).' };
  }
  return { ok: false, detail: `${bad.map((r) => r.message).join(' ')} Then restart the studio app.` };
}

/** Commands of the photoshop / illustrator MCP servers registered at user scope in ~/.claude.json. */
export function readRegisteredServers(claudeJsonText: string): Partial<Record<AdobeApp, string>> {
  const out: Partial<Record<AdobeApp, string>> = {};
  try {
    const servers = (JSON.parse(claudeJsonText) as { mcpServers?: Record<string, { command?: unknown }> }).mcpServers ?? {};
    for (const app of ADOBE_APPS) {
      const command = servers[app]?.command;
      if (typeof command === 'string' && command.trim()) out[app] = command;
    }
  } catch {
    /* no or unreadable config: nothing registered */
  }
  return out;
}

/** Quote one argument for cmd.exe. Refuses characters cmd still expands inside quotes. */
export function shellArg(arg: string): string {
  if (/["%\r\n]/.test(arg)) throw new Error(`Unsafe argument for the shell: ${arg}`);
  return /[\s&|<>^()]/.test(arg) ? `"${arg}"` : arg;
}

export const mcpAddArgs = (app: AdobeApp, exe: string, roots: string[]): string[] => [
  'mcp', 'add', '--scope', 'user', app, '--', exe, 'mcp', ...roots.flatMap((r) => ['--allowed-root', r]),
];

/** Run a program and collect stdout. A bare name (e.g. `claude`, a .cmd shim) goes through the shell with quoted args. */
export const execProgram: Exec = (bin, args) => new Promise((resolve) => {
  const viaShell = process.platform === 'win32' && !/\.exe$/i.test(bin);
  let command = bin;
  let argv = args;
  try {
    if (viaShell) {
      command = shellArg(bin);
      argv = args.map(shellArg);
    }
  } catch {
    resolve({ code: null, stdout: '' });
    return;
  }
  const child = spawn(command, argv, { shell: viaShell, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks: Buffer[] = [];
  const timer = setTimeout(() => child.kill(), 60_000);
  child.stdout.on('data', (d: Buffer) => chunks.push(d));
  const done = (code: number | null) => {
    clearTimeout(timer);
    resolve({ code, stdout: Buffer.concat(chunks).toString('utf8') });
  };
  child.on('error', () => done(null));
  child.on('close', done);
});

export async function ensureAdobe(opts: {
  claudeBin: string;
  /** Folders the connector may read and write (the jobs folder must be one of them). */
  roots: string[];
  registered: Partial<Record<AdobeApp, string>>;
  exec?: Exec;
}): Promise<AdobeReadiness> {
  const exec = opts.exec ?? execProgram;
  const results: AppReadiness[] = [];
  for (const app of ADOBE_APPS) {
    let command = opts.registered[app];
    let registeredNow = false;
    if (!command) {
      const found = await exec('where', [`cli-anything-${app}`]);
      const exe = found.code === 0 ? found.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean) : undefined;
      if (!exe) {
        results.push({ app, ok: false, message: `The ${LABEL[app]} connector (cli-anything-${app}) is not installed on this computer. Install it (see the README).` });
        continue;
      }
      const added = await exec(opts.claudeBin, mcpAddArgs(app, exe, opts.roots));
      if (added.code !== 0) {
        results.push({ app, ok: false, message: `Could not connect ${LABEL[app]} to Claude Code automatically. Run: claude ${mcpAddArgs(app, exe, opts.roots).join(' ')}` });
        continue;
      }
      command = exe;
      registeredNow = true;
    }
    const check = await exec(command, ['--json', 'app', 'check']);
    results.push({ ...parseCheck(app, check.code, check.stdout), ...(registeredNow ? { registeredNow } : {}) });
  }
  return { ...adobeSummary(results), results };
}
