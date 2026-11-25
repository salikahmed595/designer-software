/**
 * PhotoCraft + VectorCraft readiness for the drawing agent (dev server only, this computer only).
 *
 * The "craft" engine draws through two MCP servers registered with Claude Code: `photocraft` and `vectorcraft`
 * (the ArtCraft photocraft-cli / vectorcraft-cli programs, headless). At startup this module reads which of them
 * are registered (~/.claude.json, user scope) and runs `<program> --version`, which starts no engine and opens
 * nothing. A program that moved or is being reinstalled fails here, with a plain message, instead of failing
 * half-way through a job. Nothing is registered automatically: the install folder and its roots are the user's.
 */
import type { Exec } from './adobe';
import { execProgram } from './adobe';

export type CraftApp = 'photocraft' | 'vectorcraft';
export const CRAFT_APPS: readonly CraftApp[] = ['photocraft', 'vectorcraft'];
const LABEL: Record<CraftApp, string> = { photocraft: 'PhotoCraft', vectorcraft: 'VectorCraft' };

export interface CraftReadiness { app: CraftApp; ok: boolean; message: string }

/** Commands of the photocraft / vectorcraft MCP servers registered at user scope in ~/.claude.json. */
export function readCraftServers(claudeJsonText: string): Partial<Record<CraftApp, string>> {
  const out: Partial<Record<CraftApp, string>> = {};
  try {
    const servers = (JSON.parse(claudeJsonText) as { mcpServers?: Record<string, { command?: unknown }> }).mcpServers ?? {};
    for (const app of CRAFT_APPS) {
      const command = servers[app]?.command;
      if (typeof command === 'string' && command.trim()) out[app] = command;
    }
  } catch {
    /* no or unreadable config: nothing registered */
  }
  return out;
}

/** Read `<program> --version` ("photocraft-cli 0.23.1 (…)"). Anything else counts as not ready. */
export function parseVersion(app: CraftApp, code: number | null, stdout: string): CraftReadiness {
  if (code === null) {
    return { app, ok: false, message: `${LABEL[app]} could not be started: its program is not where it was registered (moved, or being installed or updated). Reinstall ${LABEL[app]} or fix its path, then restart the studio app.` };
  }
  const m = new RegExp(`^${app}-cli\\s+(\\S+)`, 'm').exec(stdout.trim());
  if (code === 0 && m) return { app, ok: true, message: `${LABEL[app]} ${m[1]}` };
  return { app, ok: false, message: `${LABEL[app]} gave an unexpected answer (exit code ${code}).` };
}

export function craftSummary(results: CraftReadiness[]): { ok: boolean; detail: string } {
  const bad = results.filter((r) => !r.ok);
  if (!bad.length) return { ok: true, detail: `Connected: ${results.map((r) => r.message).join(' and ')} (headless).` };
  return { ok: false, detail: bad.map((r) => r.message).join(' ') };
}

export async function ensureCraft(opts: { registered: Partial<Record<CraftApp, string>>; exec?: Exec }): Promise<{ ok: boolean; detail: string; results: CraftReadiness[] }> {
  const exec = opts.exec ?? execProgram;
  const results: CraftReadiness[] = [];
  for (const app of CRAFT_APPS) {
    const command = opts.registered[app];
    if (!command) {
      results.push({ app, ok: false, message: `${LABEL[app]} is not connected to Claude Code (no "${app}" MCP server is registered; see the README).` });
      continue;
    }
    const r = await exec(command, ['--version']);
    results.push(parseVersion(app, r.code, r.stdout));
  }
  return { ...craftSummary(results), results };
}
