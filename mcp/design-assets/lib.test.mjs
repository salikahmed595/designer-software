// Unit tests for the design-assets rules (no network). Run: node --test mcp/design-assets/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { licencePolicy, safeFileName, resolveSaveDir, assertAllowedUrl, parseIconId, iconSvgUrl, matchesQuery, sniffType } from './lib.mjs';

test('licence policy: client-safe licences pass, attribution licences need opt-in, the rest are refused', () => {
  for (const id of ['CC0-1.0', 'cc0', 'PDM', 'public-domain', 'MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause', 'OFL-1.1', 'Unlicense']) {
    assert.deepEqual([id, licencePolicy(id).use], [id, 'yes'], id);
  }
  for (const id of ['CC-BY-4.0', 'CC-BY-3.0', 'by']) assert.equal(licencePolicy(id).use, 'attribution', id);
  for (const id of ['CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'by-nd', 'GPL-3.0', 'GPL-2.0-or-later', 'MPL-2.0', '', 'something-new', undefined]) {
    assert.equal(licencePolicy(id).use, 'no', String(id));
  }
  assert.match(licencePolicy('CC-BY-NC-4.0').why, /commercial/i);
  assert.match(licencePolicy('CC-BY-4.0').why, /credit/i);
});

test('file names are reduced to safe characters and always get the right extension', () => {
  assert.equal(safeFileName('Lucide Sword', '.svg'), 'Lucide-Sword.svg');
  assert.equal(safeFileName('../../evil', '.svg'), 'evil.svg');
  assert.equal(safeFileName('a.exe', '.ttf'), 'a.exe.ttf');
  assert.equal(safeFileName('rock.jpg', '.jpg'), 'rock.jpg');
  assert.equal(safeFileName('', '.png'), 'asset.png');
  assert.equal(safeFileName('x'.repeat(300), '.png').length, 84);
});

test('downloads only go inside an allowed folder', () => {
  const root = path.join(os.tmpdir(), 'da-root');
  assert.equal(resolveSaveDir([root], path.join(root, 'job1', 'assets')), path.join(root, 'job1', 'assets'));
  assert.equal(resolveSaveDir([root], root), root);
  assert.throws(() => resolveSaveDir([root], path.join(root, '..', 'elsewhere')), /outside/);
  assert.throws(() => resolveSaveDir([root], path.join(os.tmpdir(), 'da-root-evil')), /outside/);
  assert.throws(() => resolveSaveDir([root], 'relative/dir'), /absolute/);
  assert.throws(() => resolveSaveDir([], root), /no save folder/i);
  if (process.platform === 'win32') assert.equal(resolveSaveDir([root], root.toUpperCase()), path.resolve(root.toUpperCase()));
});

test('only https URLs on the known asset hosts are fetched', () => {
  assert.doesNotThrow(() => assertAllowedUrl('https://api.iconify.design/lucide/sword.svg'));
  assert.doesNotThrow(() => assertAllowedUrl('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/x/x_diff_1k.jpg'));
  assert.throws(() => assertAllowedUrl('http://api.iconify.design/x.svg'), /https/);
  assert.throws(() => assertAllowedUrl('https://evil.example/x.svg'), /not an allowed/);
  assert.throws(() => assertAllowedUrl('https://api.iconify.design.evil.example/x'), /not an allowed/);
  assert.throws(() => assertAllowedUrl('https://user@api.iconify.design/x'), /not an allowed/);
  assert.throws(() => assertAllowedUrl('not a url'), /not a valid/);
});

test('icon ids and colours are validated before they reach a URL', () => {
  assert.deepEqual(parseIconId('lucide:sword'), { set: 'lucide', name: 'sword' });
  assert.deepEqual(parseIconId('game-icons:crossed-swords'), { set: 'game-icons', name: 'crossed-swords' });
  for (const bad of ['lucide', 'lucide:../x', 'Lucide:Sword', 'a:b:c', 'lucide:sw ord', 7]) assert.throws(() => parseIconId(bad), /icon id/, String(bad));
  assert.equal(iconSvgUrl('lucide:sword'), 'https://api.iconify.design/lucide/sword.svg');
  assert.equal(iconSvgUrl('lucide:sword', '#FF00aa', 512), 'https://api.iconify.design/lucide/sword.svg?color=%23FF00aa&height=512');
  assert.throws(() => iconSvgUrl('lucide:sword', 'red;}'), /colour/);
});

test('local search matches every word against names and tags', () => {
  const item = { name: 'Rock Wall 08', tags: ['stone', 'cliff'], categories: ['rock'] };
  assert.equal(matchesQuery(item, 'rock'), true);
  assert.equal(matchesQuery(item, 'stone wall'), true);
  assert.equal(matchesQuery(item, 'wood'), false);
  assert.equal(matchesQuery(item, ''), true);
});

test('a download is checked from its first bytes, not its claimed type', () => {
  assert.equal(sniffType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg');
  assert.equal(sniffType(Buffer.from('<?xml version="1.0"?><svg></svg>')), 'svg');
  assert.equal(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(sniffType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
  assert.equal(sniffType(Buffer.from([0x00, 0x01, 0x00, 0x00, 0x00])), 'ttf');
  assert.equal(sniffType(Buffer.from('OTTO')), 'otf');
  assert.equal(sniffType(Buffer.from('<!DOCTYPE html><html>')), null);
  assert.equal(sniffType(Buffer.from('<svg onload="alert(1)"><script>x</script></svg>')), null, 'SVGs with scripts are refused');
});
