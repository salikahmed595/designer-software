/**
 * The demo runner (LUMORA_RUNNER=mock) and test doubles for the orchestrated flow: a concept generator that makes a
 * plain generated PNG, a creator that behaves like a well-behaved production agent (stage reports, checkpoints,
 * captures, layered output) and a verifier that passes what it is shown. No Adobe app, Claude or OpenAI is used —
 * the files say "mock" and the Jobs screen says it is the demo runner.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { STAGES, stageDone, type AssetRecord, type Stage, type Verdict } from '../src/state/orchestration';
import { fakePsd } from './files';
import type { CreatorRun, VerifierRun } from './orchestrator';

/** A real RGB PNG (gradient), so the concept checks and the browser can read it. */
export function mockPng(width: number, height: number, seed = 0): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = 1 + width * 3;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = y * row + 1 + x * 3;
      raw[o] = (x * 255 / width + seed * 40) & 255;
      raw[o + 1] = (y * 255 / height) & 255;
      raw[o + 2] = ((x ^ y) + seed * 17) & 255;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export async function mockConcept(r: { size: string; attempt: number }) {
  const [w, h] = r.size.split('x').map(Number);
  await new Promise((res) => setTimeout(res, 50));
  return { ok: true as const, png: mockPng(w || 1024, h || 1024, r.attempt), model: 'mock (demo runner — not OpenAI)' };
}

export interface MockCreatorOptions {
  /** leave this stage without a report, or report it as failed */
  skip?: { asset: string; stage: Stage };
  fail?: { asset: string; stage: Stage; reason: string };
  /** run after the normal work, e.g. to copy a forbidden file in */
  after?: (run: CreatorRun) => Promise<void>;
  /** no preview.png (final QA must catch it) */
  noPreview?: boolean;
}

/** What a careful production agent writes, without drawing anything. */
export async function mockCreate(run: CreatorRun, opts: MockCreatorOptions = {}): Promise<{ exitCode: number; account: string | null }> {
  const prod = run.paths.production;
  const data = JSON.parse(await fs.readFile(path.join(prod, 'job.json'), 'utf8')) as { registry: AssetRecord[]; madeIn: string | null };
  const write = async (rel: string, body: Buffer | string) => {
    await fs.mkdir(path.dirname(path.join(prod, rel)), { recursive: true });
    await fs.writeFile(path.join(prod, rel), body);
  };
  for (const asset of data.registry) {
    for (const stage of STAGES) {
      if (stageDone(asset.stages[stage].status)) continue;
      if (opts.skip?.asset === asset.id && opts.skip.stage === stage) continue;
      const report = `stages/${asset.id}/${stage}.json`;
      if (opts.fail?.asset === asset.id && opts.fail.stage === stage) {
        await write(report, JSON.stringify({ status: 'failed', reason: opts.fail.reason }));
        continue;
      }
      if (stage === 'effects') {
        await write(report, JSON.stringify({ status: 'not_applicable', reason: 'Demo runner: this asset needs no effects (flat demo shapes).' }));
        continue;
      }
      const ext = asset.app === 'Photoshop' ? 'psd' : 'ai';
      const checkpoint = `checkpoints/${asset.id}/${stage}/${run.run}/${asset.id}.${ext}`;
      const capture = `evidence/${asset.id}/${stage}/${run.run}/capture.png`;
      await write(checkpoint, ext === 'psd' ? fakePsd(2) : `%PDF-1.4 mock ${asset.id} ${stage} ${run.run}`);
      await write(capture, mockPng(32, 32, run.run));
      await write(report, JSON.stringify({ status: 'passed', checkpoint, captures: [capture], notes: 'Demo runner: placeholder checkpoint and capture.' }));
    }
  }
  await write('output/artwork.psd', fakePsd(3));
  if ((data.madeIn ?? '').includes('Illustrator')) await write('output/artwork.ai', `%PDF-1.4 mock artwork run ${run.run}`);
  if (!opts.noPreview) await write('output/preview.png', mockPng(64, 64, run.run));
  await write('output/result.json', JSON.stringify({ ok: true, files: ['artwork.psd'], notes: 'Demo runner — placeholder files. No artwork was made.' }));
  await opts.after?.(run);
  return { exitCode: 0, account: null };
}

/** Passes everything it is shown (demo); tests pass their own verifier to fail stages. */
export async function mockVerify(run: VerifierRun): Promise<{ ok: true; verdicts: Verdict[] }> {
  return { ok: true, verdicts: run.items.map((i) => ({ asset: i.asset, stage: i.stage, pass: true, defects: [] })) };
}
