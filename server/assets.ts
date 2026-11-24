/**
 * The design-assets connector (mcp/design-assets/server.mjs): free, licence-checked icons, fonts, textures and
 * public-domain art for the drawing agent. The studio registers it with Claude Code at startup, like the Adobe
 * connectors. It never blocks drawing: if it can't be registered, jobs still run without assets.
 */
import { execProgram, type Exec } from './adobe';

export const DESIGN_ASSETS = 'design-assets';

export const assetsAddArgs = (nodeBin: string, serverFile: string, roots: string[]): string[] => [
  'mcp', 'add', '--scope', 'user', DESIGN_ASSETS, '--', nodeBin, serverFile, ...roots.flatMap((r) => ['--save-root', r]),
];

const same = (a: string, b: string) => (process.platform === 'win32' || /^[a-z]:\\/i.test(a) ? a.toLowerCase() === b.toLowerCase() : a === b);

/** ok = registered at user scope for this server file with every save folder; stale = registered differently. */
export function assetsRegistration(claudeJsonText: string, serverFile: string, roots: string[]): 'ok' | 'missing' | 'stale' {
  let entry: { args?: unknown } | undefined;
  try {
    entry = (JSON.parse(claudeJsonText) as { mcpServers?: Record<string, { args?: unknown }> }).mcpServers?.[DESIGN_ASSETS];
  } catch {
    return 'missing';
  }
  if (!entry) return 'missing';
  const args = Array.isArray(entry.args) ? entry.args.filter((a): a is string => typeof a === 'string') : [];
  const saveRoots = args.flatMap((a, i) => (args[i - 1] === '--save-root' ? [a] : []));
  const fileOk = args[0] !== undefined && same(args[0], serverFile);
  return fileOk && roots.every((r) => saveRoots.some((s) => same(s, r))) ? 'ok' : 'stale';
}

export async function ensureDesignAssets(opts: {
  claudeBin: string;
  claudeJson: string;
  nodeBin: string;
  serverFile: string;
  /** Folders downloads may be saved in (the jobs folder must be one of them). */
  roots: string[];
  exec?: Exec;
}): Promise<{ ok: boolean; message: string }> {
  const exec = opts.exec ?? execProgram;
  const connected = { ok: true, message: 'Free asset sources are connected (icons, fonts, textures, public-domain art).' };
  const state = assetsRegistration(opts.claudeJson, opts.serverFile, opts.roots);
  if (state === 'ok') return connected;
  if (state === 'stale') await exec(opts.claudeBin, ['mcp', 'remove', '--scope', 'user', DESIGN_ASSETS]);
  const args = assetsAddArgs(opts.nodeBin, opts.serverFile, opts.roots);
  const added = await exec(opts.claudeBin, args);
  return added.code === 0 ? connected : { ok: false, message: `Free asset sources could not be connected automatically. Run: claude ${args.join(' ')}` };
}
