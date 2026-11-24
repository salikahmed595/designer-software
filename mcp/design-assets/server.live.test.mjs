// Integration test: starts server.mjs over stdio like an MCP client and hits the live sources (about 15 requests).
// Run: node --test mcp/design-assets/server.live.test.mjs
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'design-assets-'));
const dest = path.join(root, 'job', 'assets');
const server = spawn(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url)), '--save-root', root], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map();
createInterface({ input: server.stdout }).on('line', (l) => {
  const m = JSON.parse(l);
  pending.get(m.id)?.(m);
  pending.delete(m.id);
});
let next = 1;
const rpc = (method, params) => new Promise((res) => {
  const id = next++;
  pending.set(id, res);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
const call = async (name, args) => {
  const r = (await rpc('tools/call', { name, arguments: args })).result;
  return { error: r.isError ? r.content[0].text : null, data: r.isError ? null : JSON.parse(r.content[0].text) };
};
const ok = async (name, args) => {
  const r = await call(name, args);
  assert.equal(r.error, null, r.error);
  return r.data;
};
after(async () => {
  server.kill();
  await fs.rm(root, { recursive: true, force: true });
});

test('initialize and list the tools', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.equal(init.result.serverInfo.name, 'design-assets');
  const { result } = await rpc('tools/list', {});
  assert.deepEqual(result.tools.map((t) => t.name).sort(), ['art_download', 'art_search', 'assets_sources', 'fonts_download', 'fonts_install', 'fonts_search', 'icons_download', 'icons_search', 'textures_download', 'textures_search']);
});

test('icons: only client-safe sets, CC BY only when asked, SVG saved with a credit', async () => {
  const safe = await ok('icons_search', { query: 'sword', limit: 10 });
  assert.ok(safe.results.length > 0);
  assert.ok(safe.results.every((r) => !r.credit_required && !/BY|NC|SA|GPL/i.test(r.licence)), JSON.stringify(safe.results.map((r) => r.licence)));
  const withBy = await ok('icons_search', { query: 'sword', set: 'game-icons', limit: 3, allow_attribution: true });
  assert.ok(withBy.results.every((r) => r.credit_required && r.licence === 'CC-BY-3.0'));
  assert.match((await call('icons_download', { id: 'game-icons:broadsword', dest_dir: dest })).error, /not cleared/);

  const saved = await ok('icons_download', { id: 'lucide:sword', dest_dir: dest, color: '#ffcc00' });
  assert.equal(saved.type, 'svg');
  assert.match(await fs.readFile(saved.saved, 'utf8'), /^<svg[\s\S]*#ffcc00/);
  const credits = JSON.parse(await fs.readFile(path.join(dest, 'asset-credits.json'), 'utf8'));
  assert.deepEqual(credits.map((c) => [c.file, c.source, c.licence]), [['lucide-sword.svg', 'Iconify', 'ISC']]);
});

test('downloads never leave the save folder', async () => {
  assert.match((await call('icons_download', { id: 'lucide:sword', dest_dir: os.homedir() })).error, /outside the allowed folders/);
  assert.match((await call('icons_download', { id: 'lucide:../../x', dest_dir: dest })).error, /icon id/);
});

test('fonts: open licences only, a real TTF is saved', async () => {
  const found = await ok('fonts_search', { query: 'bungee', limit: 5 });
  assert.ok(found.results.some((f) => f.id === 'bungee'));
  assert.ok(found.results.every((f) => ['OFL-1.1', 'Apache-2.0'].includes(f.licence)));
  const display = await ok('fonts_search', { category: 'display', limit: 5 });
  assert.equal(display.results.length, 5);
  const saved = await ok('fonts_download', { id: 'bungee', dest_dir: dest });
  assert.equal(saved.type, 'ttf');
  assert.equal(saved.credit.licence, 'OFL-1.1');
});

test('textures: CC0 Poly Haven search and a JPG colour map', async () => {
  const found = await ok('textures_search', { query: 'rock', limit: 3 });
  assert.equal(found.results.length, 3);
  const saved = await ok('textures_download', { id: found.results[0].id, dest_dir: dest, resolution: '1k' });
  assert.equal(saved.type, 'jpg');
  assert.equal(saved.credit.licence, 'CC0-1.0');
  assert.equal(saved.credit.powered_by, 'Powered by Poly Haven');
  assert.equal(found.results[0].powered_by, 'Powered by Poly Haven');
});

test('art: public-domain Art Institute of Chicago works only', async () => {
  const found = await ok('art_search', { query: 'samurai', limit: 3 });
  assert.ok(found.results.length > 0);
  const saved = await ok('art_download', { id: found.results[0].id, dest_dir: dest });
  assert.equal(saved.type, 'jpg');
  assert.equal(saved.credit.source, 'Art Institute of Chicago');
  const credits = JSON.parse(await fs.readFile(path.join(dest, 'asset-credits.json'), 'utf8'));
  assert.equal(credits.length, 4);
});
