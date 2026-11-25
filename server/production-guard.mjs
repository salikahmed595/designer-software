#!/usr/bin/env node
/**
 * Production guard — a Claude Code PreToolUse hook for every production (drawing) run.
 *
 *   node production-guard.mjs <guard.json>     (tool call as JSON on stdin; exit 2 = refused, reason on stderr)
 *
 * It refuses, whatever the prompt says:
 *  - any path into the job's concept folder (reference only), control, approvals, logs, plans, brief or exports folders,
 *    or into any other job; any string mentioning "reference_only";
 *  - writing, saving, opening or placing files outside the job's production folder;
 *  - shells, web access, sub-agents, Image Trace and every connector except Photoshop, Illustrator and design-assets.
 * Unreadable input or config fails closed (refused). Plain JavaScript on purpose: it runs with node alone.
 */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DENIED_TOOLS = new Set(['Bash', 'PowerShell', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'NotebookEdit', 'mcp__illustrator__trace']);
const CONNECTORS = ['mcp__photoshop__', 'mcp__illustrator__', 'mcp__design-assets__'];
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
/** Input fields that hold file or folder paths. */
const PATH_KEYS = new Set(['path', 'file_path', 'filePath', 'file', 'files', 'paths', 'dest', 'dest_dir', 'destDir', 'folder', 'dir', 'directory', 'out', 'output', 'save_path', 'target', 'source', 'src']);
/** Free text (file contents, layer text, SVG data) is never read as a path, except for the reference_only check. */
const TEXT_KEYS = new Set(['content', 'new_string', 'old_string', 'text', 'prompt', 'description', 'query', 'd', 'svg', 'contents', 'name', 'notes']);

const deny = (reason) => ({ allow: false, reason });

/** Real path when the file (or its nearest existing parent) exists, so links and short names cannot dodge the check. */
function canonical(p) {
  let head = path.resolve(p);
  const rest = [];
  for (let i = 0; i < 64; i++) {
    try {
      return path.join(realpathSync.native(head), ...rest.reverse());
    } catch {
      const parent = path.dirname(head);
      if (parent === head) return path.resolve(p);
      rest.push(path.basename(head));
      head = parent;
    }
  }
  return path.resolve(p);
}

/** Case-insensitive on purpose: Windows paths are, and refusing more is the safe side. */
const key = (p) => canonical(p).replace(/[\\/]+$/, '').toLowerCase();
const inside = (child, root) => {
  const c = key(child);
  const r = key(root);
  return c === r || c.startsWith(r + path.sep) || c.startsWith(`${r}/`);
};

const looksAbsolute = (s) => /^[a-zA-Z]:[\\/]/.test(s) || /^[\\/]{2}[^\\/]/.test(s) || /^\/[^\s*]/.test(s) || /^~[\\/]/.test(s);

function collect(value, keyName, out, depth = 0) {
  if (depth > 8 || out.length > 500) return;
  if (typeof value === 'string') out.push({ key: keyName, value });
  else if (Array.isArray(value)) for (const v of value) collect(v, keyName, out, depth + 1);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collect(v, k, out, depth + 1);
}

/**
 * @param {{ tool_name?: unknown, tool_input?: unknown, cwd?: unknown }} input  the hook's stdin
 * @param {{ production: string, allowedRoots: string[], deniedRoots: string[], jobsRoot: string }} config
 * @returns {{ allow: true } | { allow: false, reason: string }}
 */
export function decide(input, config) {
  if (!input || typeof input !== 'object' || !config || !Array.isArray(config.allowedRoots)) return deny('The production guard could not read this tool call, so it was refused.');
  const tool = String(input.tool_name ?? '');
  if (DENIED_TOOLS.has(tool)) return deny(`${tool} is not allowed in production. Draw with the Photoshop and Illustrator tools only.`);
  if (tool.startsWith('mcp__') && !CONNECTORS.some((c) => tool.startsWith(c))) return deny(`The connector tool ${tool} is not allowed in production.`);
  const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : config.production;
  const strings = [];
  collect(input.tool_input ?? {}, '', strings);
  const writes = WRITE_TOOLS.has(tool) || tool.startsWith('mcp__');
  for (const { key: k, value } of strings) {
    if (/reference[_-]?only/i.test(value)) return deny('The concept is reference only. It can never be opened, placed, read or copied in production.');
    if (TEXT_KEYS.has(k)) continue;
    const pathy = PATH_KEYS.has(k) || (k === 'pattern' && tool === 'Glob') || looksAbsolute(value);
    if (!pathy || value.trim() === '') continue;
    const base = value.replace(/^~(?=[\\/])/, process.env.USERPROFILE || process.env.HOME || '~').split(/[*?[{]/)[0] || '.';
    const full = path.resolve(cwd, base);
    if (config.deniedRoots.some((r) => inside(full, r))) {
      return deny(`That path is outside this job's production folder (it is in the concept, approval or control area): ${value}`);
    }
    const inProduction = config.allowedRoots.some((r) => inside(full, r));
    if (!inProduction && inside(full, config.jobsRoot)) return deny(`That path is outside this job's production folder: ${value}`);
    if (!inProduction && writes) return deny(`Files can only be written, opened, saved or placed inside this job's production folder (${config.production}). Refused: ${value}`);
  }
  return { allow: true };
}

async function main() {
  const fail = (reason) => {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  };
  let config;
  try {
    config = JSON.parse(readFileSync(process.argv[2] ?? '', 'utf8'));
  } catch {
    return fail('The production guard has no readable config, so every tool call is refused.');
  }
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return fail('The production guard could not read this tool call, so it was refused.');
  }
  const r = decide(input, config);
  if (!r.allow) return fail(r.reason);
  process.exit(0);
}

const self = path.resolve(fileURLToPath(import.meta.url)).toLowerCase();
if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === self) void main();
