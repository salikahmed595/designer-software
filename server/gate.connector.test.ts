/**
 * Integration: the REAL Photoshop / Illustrator connectors registered on this computer, started with the per-job
 * config the production gate writes, refuse to place or open the concept. The connector checks the path before it
 * talks to the Adobe app, so this needs the connector installed but not Photoshop or Illustrator running.
 * Skipped (and reported as skipped) when the connectors are not registered.
 */
import { spawn } from 'node:child_process';
import { existsSync, promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jobPaths, productionMcpConfig } from './gate';

const claudeJson = (() => {
  try {
    return readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8');
  } catch {
    return '{}';
  }
})();
const registered = (app: string) => {
  try {
    const cmd = (JSON.parse(claudeJson) as { mcpServers?: Record<string, { command?: string }> }).mcpServers?.[app]?.command;
    return typeof cmd === 'string' && existsSync(cmd);
  } catch {
    return false;
  }
};

/** One MCP tools/call over stdio (newline-delimited JSON-RPC). */
async function callTool(entry: { command?: unknown; args: string[] }, tool: string, args: Record<string, unknown>): Promise<{ isError: boolean; text: string }> {
  const child = spawn(String(entry.command), entry.args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let buf = '';
  const replies = new Map<number, unknown>();
  child.stdout.on('data', (d: Buffer) => {
    buf += d.toString('utf8');
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      try {
        const m = JSON.parse(line) as { id?: number };
        if (typeof m.id === 'number') replies.set(m.id, m);
      } catch {
        /* log line */
      }
    }
  });
  const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
  const wait = async (id: number) => {
    for (let i = 0; i < 300 && !replies.has(id); i++) await new Promise((r) => setTimeout(r, 100));
    return replies.get(id) as { result?: { isError?: boolean; content?: Array<{ text?: string }> }; error?: { message?: string } } | undefined;
  };
  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'gate-test', version: '1' } } });
    if (!(await wait(1))) throw new Error('connector did not initialize');
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } });
    const r = await wait(2);
    if (!r) throw new Error('connector did not answer the tool call');
    if (r.error) return { isError: true, text: r.error.message ?? '' };
    return { isError: r.result?.isError === true, text: (r.result?.content ?? []).map((c) => c.text ?? '').join(' ') };
  } finally {
    child.kill();
  }
}

let tmp: string;
let paths: ReturnType<typeof jobPaths>;
let concept: string;
beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lumora-connector-'));
  paths = jobPaths(path.join(tmp, 'jobs', 'abcdef123456'));
  await fs.mkdir(paths.concepts, { recursive: true });
  await fs.mkdir(paths.production, { recursive: true });
  concept = path.join(paths.concepts, 'concept-v1.png');
  await fs.writeFile(concept, Buffer.from('concept'));
});
afterAll(() => fs.rm(tmp, { recursive: true, force: true }));

describe('real connectors with the per-job root (integration)', () => {
  it.skipIf(!registered('photoshop'))('Photoshop refuses to place or open the concept', async () => {
    const entry = productionMcpConfig(claudeJson, paths).mcpServers.photoshop;
    for (const [tool, args] of [['place', { path: concept }], ['doc_open', { path: concept }]] as const) {
      const r = await callTool(entry, tool, args);
      expect(r.isError, `${tool}: ${r.text}`).toBe(true);
      expect(r.text).toMatch(/outside the allowed folders/i);
    }
  }, 60_000);

  it.skipIf(!registered('illustrator'))('Illustrator refuses to place or open the concept', async () => {
    const entry = productionMcpConfig(claudeJson, paths).mcpServers.illustrator;
    for (const [tool, args] of [['place', { path: concept }], ['doc_open', { path: concept }]] as const) {
      const r = await callTool(entry, tool, args);
      expect(r.isError, `${tool}: ${r.text}`).toBe(true);
      expect(r.text).toMatch(/outside the allowed folders/i);
    }
  }, 60_000);
});
