/** Runs a CLI (the Claude Code agent) with a timeout, an optional log file and an optional cancel signal. */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { shellArg } from './adobe';

export function runProcess(
  bin: string, args: string[], cwd: string, stdin: string | null, timeoutMs: number, logFile: string | null, env?: NodeJS.ProcessEnv, signal?: AbortSignal,
): Promise<number | null> {
  return new Promise((resolve) => {
    // shell is needed on Windows for .cmd shims; arguments are fixed constants or our own paths, quoted for cmd.
    const viaShell = process.platform === 'win32';
    let command = bin;
    let argv = args;
    try {
      if (viaShell) {
        command = /\s/.test(bin) && !bin.startsWith('"') ? `"${bin}"` : bin;
        argv = args.map(shellArg);
      }
    } catch {
      resolve(null);
      return;
    }
    const child = spawn(command, argv, { cwd, shell: viaShell, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, ...(env ? { env } : {}) });
    const log: Buffer[] = [];
    const timer = setTimeout(() => child.kill(), timeoutMs);
    // Cancel: stop the agent (and, through the shell on Windows, its process tree).
    const stop = () => {
      if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }).on('error', () => undefined);
      else child.kill();
    };
    if (signal?.aborted) stop();
    signal?.addEventListener('abort', stop, { once: true });
    child.stdout.on('data', (d: Buffer) => log.push(d));
    child.stderr.on('data', (d: Buffer) => log.push(d));
    let finished = false;
    const finish = (code: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      // The log is complete before the caller reads it (it decides whether to try the next account).
      if (logFile) void fs.writeFile(logFile, Buffer.concat(log)).catch(() => undefined).then(() => resolve(code));
      else resolve(code);
    };
    child.on('error', () => finish(null));
    child.on('close', finish);
    if (stdin !== null) child.stdin.write(stdin);
    child.stdin.end();
  });
}
