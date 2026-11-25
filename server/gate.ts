/**
 * The production gate (dev server only, this computer only).
 *
 * A drawing run must never see the AI concept: it is reference only. This is enforced outside the prompt, in four
 * independent layers, all set up here for every production run:
 *  1. Folders: the concept lives in <job>/concepts/reference_only/, outside <job>/production/, the agent's working folder.
 *  2. Connectors: the run gets its own MCP config (--strict-mcp-config) in which Photoshop and Illustrator are started
 *     with the production folder as their ONLY --allowed-root (the user-scope registration allows the whole drive).
 *     The connector refuses any other path before it talks to the app.
 *  3. Claude Code permissions (--settings): Read/Edit of the concept, control and approval folders denied; shells,
 *     web tools and Image Trace denied.
 *  4. A PreToolUse hook (production-guard.mjs) that checks every tool call's paths. (Hooks do not run in --bare mode,
 *     used only for the API-key account; layers 1–3 still apply there.)
 */
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_ENGINE, ENGINES, type EngineId } from '../src/state/engines';
import type { AgentAccount } from './accounts';
import type { GuardConfig } from './production-guard.mjs';

export interface JobPaths {
  root: string;
  brief: string;
  concepts: string;
  approvals: string;
  plans: string;
  /** the agent's working folder and the connectors' only root */
  production: string;
  output: string;
  /** outside production: run config, guard config, prompts and agent logs (the agent cannot change its own guard) */
  control: string;
  logs: string;
  exports: string;
}

export function jobPaths(root: string): JobPaths {
  const r = path.resolve(root);
  const production = path.join(r, 'production');
  return {
    root: r, brief: path.join(r, 'brief'), concepts: path.join(r, 'concepts', 'reference_only'), approvals: path.join(r, 'approvals'),
    plans: path.join(r, 'plans'), production, output: path.join(production, 'output'), control: path.join(r, 'control'),
    logs: path.join(r, 'logs'), exports: path.join(r, 'exports'),
  };
}

/** Resolved from the app folder (the dev server runs there), like the design-assets server. */
export const GUARD_SCRIPT = path.resolve(process.env.LUMORA_GUARD_SCRIPT?.trim() || 'server/production-guard.mjs');
const FILE_TOOLS = ['mcp__design-assets', 'Skill', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];
/** Only this job's drawing apps, the free-assets connector and file tools. */
export const productionAllowedTools = (engine: EngineId = DEFAULT_ENGINE): string => [...ENGINES[engine].toolPrefixes, ...FILE_TOOLS].join(',');
const BASE_DENIED_TOOLS = ['Bash', 'PowerShell', 'WebFetch', 'WebSearch', 'NotebookEdit'];
export const productionDeniedTools = (engine: EngineId = DEFAULT_ENGINE): string[] => [...BASE_DENIED_TOOLS, ...ENGINES[engine].deniedTools];
/** The Adobe lists (kept for callers that predate engines). */
export const PRODUCTION_ALLOWED_TOOLS = productionAllowedTools('adobe');
export const PRODUCTION_DENIED_TOOLS = productionDeniedTools('adobe');

const protectedDirs = (p: JobPaths) => [p.concepts, p.control, p.approvals, p.logs, p.plans, p.brief, p.exports];

export const guardConfig = (p: JobPaths, jobsRoot: string, engine: EngineId = DEFAULT_ENGINE): GuardConfig => ({
  production: p.production, allowedRoots: [p.production], deniedRoots: protectedDirs(p), jobsRoot: path.resolve(jobsRoot),
  connectors: [...ENGINES[engine].toolPrefixes, 'mcp__design-assets'].map((t) => `${t}__`),
  deniedTools: ENGINES[engine].deniedTools,
  deniedCommands: ENGINES[engine].deniedCommands,
});

type McpEntry = { command?: unknown; args?: unknown; [k: string]: unknown };

/** Drops every `--flag value` / `--flag=value` for the given flags (and bare --allow-jsx). */
function stripFlags(args: string[], flags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--allow-jsx') continue;
    if (flags.includes(a)) {
      i += 1;
      continue;
    }
    if (flags.some((f) => a.startsWith(`${f}=`))) continue;
    out.push(a);
  }
  return out;
}

/** How each connector is told which folders it may use (Adobe: one flag; Craft: separate read and write roots). */
const ROOT_FLAGS: Record<EngineId, string[]> = {
  adobe: ['--allowed-root'],
  craft: ['--automation-read-root', '--automation-write-root'],
};

/** This job's drawing connectors (and design-assets), rewritten so the production folder is their only root. */
export function productionMcpConfig(claudeJsonText: string, p: JobPaths, engine: EngineId = DEFAULT_ENGINE): { mcpServers: Record<string, McpEntry & { args: string[] }> } {
  let servers: Record<string, McpEntry> = {};
  try {
    servers = (JSON.parse(claudeJsonText) as { mcpServers?: Record<string, McpEntry> }).mcpServers ?? {};
  } catch {
    /* unreadable: no connectors */
  }
  const out: Record<string, McpEntry & { args: string[] }> = {};
  const args = (e: McpEntry) => (Array.isArray(e.args) ? e.args.filter((a): a is string => typeof a === 'string') : []);
  const flags = ROOT_FLAGS[engine];
  for (const app of ENGINES[engine].servers) {
    const e = servers[app];
    if (e && typeof e.command === 'string') out[app] = { ...e, args: [...stripFlags(args(e), flags), ...flags.flatMap((f) => [f, p.production])] };
  }
  const assets = servers['design-assets'];
  if (assets && typeof assets.command === 'string') {
    out['design-assets'] = { ...assets, args: [...stripFlags(args(assets), ['--save-root']), '--save-root', path.join(p.production, 'assets')] };
  }
  return { mcpServers: out };
}

/** Claude Code permission rules use //<drive>/… for absolute paths (POSIX form on Windows). */
export function permissionPath(p: string): string {
  const m = /^([a-zA-Z]):[\\/]?(.*)$/.exec(p);
  if (m) return `//${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/').replace(/\/+$/, '')}`;
  return `/${p.replace(/\\/g, '/').replace(/\/+$/, '')}`;
}

const fwd = (p: string) => p.replace(/\\/g, '/');

export function productionSettings(p: JobPaths, opts: { node: string; configFile: string }, engine: EngineId = DEFAULT_ENGINE) {
  const deny = [...productionDeniedTools(engine), ...protectedDirs(p).flatMap((d) => ['Read', 'Edit'].map((t) => `${t}(${permissionPath(d)}/**)`))];
  return {
    permissions: { deny },
    hooks: {
      PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `"${fwd(opts.node)}" "${fwd(GUARD_SCRIPT)}" "${fwd(opts.configFile)}"`, timeout: 30 }] }],
    },
  };
}

/** The drawing agent's arguments: only the per-job connectors, the guard settings, and no shell or web tools. */
export function productionArgs(account: AgentAccount, files: { mcp: string; settings: string }, engine: EngineId = DEFAULT_ENGINE): string[] {
  return [
    ...(account.kind === 'apikey' ? ['--bare'] : []),
    '-p', '--allowedTools', productionAllowedTools(engine), '--disallowedTools', productionDeniedTools(engine).join(','),
    '--strict-mcp-config', '--mcp-config', files.mcp, '--settings', files.settings,
  ];
}

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')));
  });
}

/** Files under `dir` whose bytes equal a concept version (relative paths). Links are not followed. */
export async function findConceptCopies(dir: string, hashes: Set<string>): Promise<string[]> {
  const found: string[] = [];
  const walk = async (d: string, depth: number): Promise<void> => {
    if (depth > 12) return;
    for (const e of await fs.readdir(d, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else if (e.isFile() && hashes.has(await sha256File(full).catch(() => ''))) found.push(path.relative(dir, full));
    }
  };
  await walk(path.resolve(dir), 0);
  return found.sort();
}
