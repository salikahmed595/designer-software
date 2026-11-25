/**
 * Integration: the orchestrator on a real temporary jobs folder, with the demo runner's well-behaved agent and
 * test verifiers. Proves the server — not the agent — moves every job through the spec states, persists them,
 * and keeps production away from the concept.
 */
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CONCEPT_ATTEMPTS, type Verdict } from '../src/state/orchestration';
import type { ProductionJob } from '../src/state/production';
import { mockConcept, mockCreate, mockPng, mockVerify, type MockCreatorOptions } from './mock-runner';
import { createOrchestrator, type CreatorRun, type OrchestratorDeps, type VerifierRun } from './orchestrator';

const JOB: ProductionJob = {
  styleId: 'anime-cel', styleName: 'Anime cel', handmade: null, skills: [{ name: '2d-pfp', role: 'style' }], ratio: 'Square', canvas: { width: 2000, height: 2000 },
  brief: 'A fox knight PFP', templateId: 'pfp', templateTitle: 'PFP', madeIn: 'Illustrator + Photoshop', text: 'FOX', reference: null,
  plan: {
    understood: 'fox', concept: 'fox knight', composition: 'centred', palette: [{ name: 'A', hex: '#111111' }, { name: 'B', hex: '#FF6A1A' }], typography: 'none',
    parts: [{ name: 'Background', app: 'Photoshop', detail: '' }, { name: 'Fox', app: 'Illustrator', detail: '' }], assets: [], assumptions: [], styleNote: null,
  },
};

let tmp: string;
let now: number;
const CLAUDE_JSON = JSON.stringify({ mcpServers: { photoshop: { command: 'ps.exe', args: ['mcp', '--allowed-root', 'D:\\'] }, illustrator: { command: 'ai.exe', args: ['mcp', '--allowed-root', 'D:\\'] } } });

function setup(over: Partial<OrchestratorDeps> & { creator?: MockCreatorOptions } = {}) {
  const creatorRuns: CreatorRun[] = [];
  const verifierRuns: VerifierRun[] = [];
  const conceptCalls: Array<{ prompt: string }> = [];
  const deps: OrchestratorDeps = {
    jobsDir: path.join(tmp, 'jobs'),
    now: () => (now += 1000),
    canRun: () => true,
    runnerKind: () => 'mock',
    claudeJson: async () => CLAUDE_JSON,
    nodeBin: process.execPath,
    generateConcept: async (r) => {
      conceptCalls.push({ prompt: r.prompt });
      return mockConcept(r);
    },
    runCreator: async (run) => {
      creatorRuns.push(run);
      return mockCreate(run, over.creator);
    },
    runVerifier: async (run) => {
      verifierRuns.push(run);
      return mockVerify(run);
    },
    ...over,
  };
  return { orch: createOrchestrator(deps), creatorRuns, verifierRuns, conceptCalls, deps };
}

const state = (o: ReturnType<typeof setup>['orch'], id: string) => o.get(id)?.orchestration?.state;
const readJson = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lumora-orch-'));
  now = 1_700_000_000_000;
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

async function toConceptReview(s: ReturnType<typeof setup>, job = JOB) {
  await s.orch.ready;
  const created = await s.orch.create(job);
  await s.orch.idle();
  return created.id;
}

describe('brief → concept → designer review', () => {
  it('generates the concept server-side into the reference-only folder and waits for the designer', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    const view = s.orch.get(id)!;
    expect(view.orchestration!.state).toBe('CONCEPT_REVIEW');
    expect(view.status).toBe('review');
    expect(view.orchestration!.history.map((h) => h.to)).toEqual(['ART_DIRECTION_READY', 'CONCEPT_GENERATING', 'CONCEPT_QA', 'CONCEPT_REVIEW']);
    const v1 = view.orchestration!.concept.versions[0];
    expect(v1).toMatchObject({ version: 1, file: 'concepts/reference_only/concept-v1.png', attempt: 1, qa: { passed: true, problems: [] } });
    const root = path.join(tmp, 'jobs', id);
    expect(existsSync(path.join(root, v1.file))).toBe(true);
    expect(existsSync(path.join(root, 'plans', 'style_contract.json'))).toBe(true);
    // persisted with its history, and the transitions are in an append-only log
    expect((await readJson(path.join(root, 'status.json'))).orchestration.state).toBe('CONCEPT_REVIEW');
    expect((await fs.readFile(path.join(root, 'logs', 'transitions.jsonl'), 'utf8')).trim().split('\n')).toHaveLength(4);
    // the concept prompt carries the style contract; nothing was drawn
    expect(s.conceptCalls[0].prompt).toMatch(/Concept is reference only/);
    expect(s.creatorRuns).toHaveLength(0);
  });

  it('retries a concept that fails QA, at most 4 times, then asks a human', async () => {
    let calls = 0;
    const s = setup({ generateConcept: async () => ({ ok: true, png: mockPng(100, 100, calls++), model: 'test' }) });
    const id = await toConceptReview(s);
    expect(calls).toBe(MAX_CONCEPT_ATTEMPTS);
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(o.resumeTo).toBe('CONCEPT_GENERATING');
    expect(o.blocker).toMatch(/4 automatic/);
    expect(o.concept.versions).toHaveLength(4);
    // the designer resumes with a note: a fresh round of attempts
    const r = await s.orch.resume(id, 'Make it bigger');
    expect(r.ok).toBe(true);
    await s.orch.idle();
    expect(calls).toBe(MAX_CONCEPT_ATTEMPTS * 2);
  });

  it('a generator failure (no key, API error) is recorded and escalated, never faked', async () => {
    const s = setup({ generateConcept: async () => ({ ok: false, error: 'No OpenAI key was found.' }) });
    const id = await toConceptReview(s);
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(o.blocker).toBe('No OpenAI key was found.');
    expect(o.concept.versions).toHaveLength(0);
  });

  it('reject with feedback makes a new version that answers the feedback; only the newest can be approved', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    expect((await s.orch.rejectConcept(id, '  ')).ok).toBe(false);
    expect((await s.orch.rejectConcept(id, 'Silver armour, not gold')).ok).toBe(true);
    await s.orch.idle();
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('CONCEPT_REVIEW');
    expect(o.concept.versions.map((v) => [v.version, v.feedback])).toEqual([[1, null], [2, 'Silver armour, not gold']]);
    expect(s.conceptCalls[1].prompt).toContain('Silver armour, not gold');
    expect((await s.orch.approveConcept(id, 1)).ok).toBe(false);
  });

  it('refuses to approve a concept whose file changed after it was made', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    await fs.appendFile(path.join(tmp, 'jobs', id, 'concepts', 'reference_only', 'concept-v1.png'), 'tampered');
    const r = await s.orch.approveConcept(id, 1);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/changed/) });
    expect(s.creatorRuns).toHaveLength(0);
  });
});

describe('production gate', () => {
  it('no drawing run before the designer approves; then one run with the locked concept, both skills, and the per-job gate', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    expect(s.creatorRuns).toHaveLength(0);
    const r = await s.orch.approveConcept(id, 1);
    expect(r.ok).toBe(true);
    await s.orch.idle();
    expect(s.creatorRuns).toHaveLength(1);
    const run = s.creatorRuns[0];
    const o = s.orch.get(id)!.orchestration!;
    expect(o.concept.locked).toMatchObject({ version: 1, sha256: o.concept.versions[0].sha256, by: 'designer' });
    expect(existsSync(path.join(tmp, 'jobs', id, 'approvals', 'concept.json'))).toBe(true);

    // master orchestration first, then the style skill
    expect(run.job.skills.map((x) => x.name)).toEqual(['universal-artwork-production-agent', '2d-pfp']);
    expect(run.prompt).toContain('"universal-artwork-production-agent"');
    // the run's connectors only reach the production folder; the guard is wired in; control is outside production
    const mcp = await readJson(run.files.mcp);
    expect(mcp.mcpServers.photoshop.args).toEqual(['mcp', '--allowed-root', run.paths.production]);
    const settings = await readJson(run.files.settings);
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain('production-guard.mjs');
    expect(path.relative(run.paths.production, run.files.mcp).startsWith('..')).toBe(true);
    // the agent's data has the registry and no concept path
    const data = await fs.readFile(path.join(run.paths.production, 'job.json'), 'utf8');
    expect(JSON.parse(data).registry.map((a: { id: string }) => a.id)).toEqual(['background', 'fox']);
    expect(data).not.toMatch(/reference_only|concept-v1/);
  });

  it('refuses production when a needed skill is missing', async () => {
    const s = setup({ missingSkills: async (names) => names.filter((n) => n === '2d-pfp') });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    expect(s.creatorRuns).toHaveLength(0);
    expect(state(s.orch, id)).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(s.orch.get(id)!.orchestration!.blocker).toMatch(/2d-pfp/);
  });

  it('waits at ASSET_PLANNING while no runner is available', async () => {
    const s = setup({ canRun: () => false });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    expect(state(s.orch, id)).toBe('ASSET_PLANNING');
    expect(s.creatorRuns).toHaveLength(0);
  });
});

describe('stages → verification → final review → export', () => {
  it('runs the happy path to FINAL_REVIEW with every stage passed or verified N/A and evidence paths', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('FINAL_REVIEW');
    expect(o.history.map((h) => h.to).slice(4)).toEqual(['CONCEPT_APPROVED', 'ASSET_PLANNING', 'PRODUCTION', 'STAGE_VERIFYING', 'ASSEMBLY', 'FINAL_QA', 'FINAL_REVIEW']);
    for (const a of o.registry) {
      expect(a.stages.sketch.status).toBe('passed');
      expect(a.stages.sketch.checkpoint?.file).toBe(`checkpoints/${a.id}/sketch/1/${a.id}.${a.app === 'Photoshop' ? 'psd' : 'ai'}`);
      expect(a.stages.sketch.checkpoint?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(a.stages.sketch.evidence).toEqual([`evidence/${a.id}/sketch/1/capture.png`]);
      expect(a.stages.effects.status).toBe('not_applicable_verified');
    }
    expect(s.verifierRuns).toHaveLength(1);
    expect(s.verifierRuns[0].items).toHaveLength(14);
    expect(o.finalCandidate?.version).toMatch(/^[0-9a-f]{64}$/);
    expect(s.orch.get(id)!.files).toEqual([]); // nothing downloadable before final approval
  });

  it('exports only the exact approved version, then delivers', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    const version = s.orch.get(id)!.orchestration!.finalCandidate!.version;
    expect((await s.orch.approveFinal(id, 'deadbeef')).ok).toBe(false);
    const r = await s.orch.approveFinal(id, version);
    expect(r.ok).toBe(true);
    await s.orch.idle();
    const view = s.orch.get(id)!;
    expect(view.orchestration!.state).toBe('DELIVERED');
    expect(view.files.sort()).toEqual(['artwork.ai', 'artwork.psd']);
    const root = path.join(tmp, 'jobs', id);
    expect(existsSync(path.join(root, 'exports', 'artwork.psd'))).toBe(true);
    const report = await readJson(path.join(root, 'final_report.json'));
    expect(report).toMatchObject({ approvedVersion: version, concept: { version: 1 }, aiDisclosure: expect.stringMatching(/AI-assisted/) });
    expect(s.orch.exportFile(id, 'artwork.psd')).toBe(path.join(root, 'exports', 'artwork.psd'));
  });

  it('refuses export when the files changed after approval', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    const version = s.orch.get(id)!.orchestration!.finalCandidate!.version;
    await fs.appendFile(path.join(tmp, 'jobs', id, 'production', 'output', 'artwork.psd'), 'changed later');
    await s.orch.approveFinal(id, version);
    await s.orch.idle();
    expect(state(s.orch, id)).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(s.orch.get(id)!.orchestration!.blocker).toMatch(/changed after/);
    expect(existsSync(path.join(tmp, 'jobs', id, 'exports', 'artwork.psd'))).toBe(false);
  });

  it('a failed verdict triggers a targeted correction run that receives the defect', async () => {
    let first = true;
    const s = setup({
      runVerifier: async (run) => {
        const verdicts: Verdict[] = run.items.map((i) => ({ asset: i.asset, stage: i.stage, pass: true, defects: [] }));
        if (first) {
          first = false;
          const v = verdicts.find((x) => x.asset === 'fox' && x.stage === 'line_art')!;
          v.pass = false;
          v.defects = ['Gap in the ear contour at the top'];
        }
        return { ok: true, verdicts };
      },
    });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    expect(s.creatorRuns).toHaveLength(2);
    const second = await readJson(path.join(s.creatorRuns[1].paths.production, 'job.json'));
    expect(second.corrections.join(' ')).toContain('Gap in the ear contour');
    const fox = second.registry.find((a: { id: string }) => a.id === 'fox');
    expect(fox.stages.sketch.status).toBe('passed'); // approved work is protected
    expect(state(s.orch, id)).toBe('FINAL_REVIEW');
    expect(s.orch.get(id)!.orchestration!.history.map((h) => h.to)).toContain('STAGE_CORRECTING');
  });

  it('missing evidence blocks and asks a human; resuming runs again', async () => {
    let n = 0;
    const s = setup({
      runCreator: async (run) => mockCreate(run, n++ === 0 ? { skip: { asset: 'fox', stage: 'texture' } } : {}),
    });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(o.registry.find((a) => a.id === 'fox')!.stages.texture).toMatchObject({ status: 'blocked', reason: expect.stringMatching(/No report/) });
    expect(o.resumeTo).toBe('STAGE_CORRECTING');
    expect((await s.orch.resume(id, 'Please do the texture stage')).ok).toBe(true);
    await s.orch.idle();
    expect(state(s.orch, id)).toBe('FINAL_REVIEW');
  });

  it('a tool failure the agent reports is recorded as blocked with the exact reason', async () => {
    const s = setup({ creator: { fail: { asset: 'background', stage: 'sketch', reason: 'Photoshop connector has no brush tool' } } });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(o.blocker).toMatch(/no brush tool/);
  });

  it('a byte copy of the concept in production fails final QA (provenance) — never delivered', async () => {
    const s = setup({
      creator: {
        after: async (run) => {
          const jobRoot = path.dirname(run.paths.production);
          await fs.copyFile(path.join(jobRoot, 'concepts', 'reference_only', 'concept-v1.png'), path.join(run.paths.production, 'output', 'bg.png'));
        },
      },
    });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    const o = s.orch.get(id)!.orchestration!;
    expect(o.state).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(o.blocker).toMatch(/concept.*production/i);
    expect(o.finalCandidate).toBeNull();
  });

  it('final QA catches a missing preview and sends it back for correction', async () => {
    let n = 0;
    const s = setup({ runCreator: async (run) => mockCreate(run, { noPreview: n++ === 0 }) });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    expect(n).toBe(2);
    expect(state(s.orch, id)).toBe('FINAL_REVIEW');
  });

  it('a final rejection starts a correction run with the designer note, then a new review', async () => {
    const s = setup();
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await s.orch.idle();
    expect((await s.orch.rejectFinal(id, 'Move the title up 40 px')).ok).toBe(true);
    await s.orch.idle();
    expect(s.creatorRuns).toHaveLength(2);
    expect((await readJson(path.join(s.creatorRuns[1].paths.production, 'job.json'))).corrections).toContain('Designer: Move the title up 40 px');
    expect(state(s.orch, id)).toBe('FINAL_REVIEW');
  });
});

describe('cancel and restart', () => {
  it('cancel stops the run: the abort signal fires and nothing more is written', async () => {
    let release!: () => void;
    const s = setup({
      runCreator: (run) => new Promise((resolve) => {
        release = () => resolve({ exitCode: null, account: null });
        run.signal.addEventListener('abort', () => release());
      }),
    });
    const id = await toConceptReview(s);
    await s.orch.approveConcept(id, 1);
    await vi.waitFor(() => expect(state(s.orch, id)).toBe('PRODUCTION'));
    expect((await s.orch.cancel(id)).ok).toBe(true);
    await s.orch.idle();
    expect(state(s.orch, id)).toBe('CANCELLED');
    expect((await s.orch.approveFinal(id, 'x')).ok).toBe(false);
    expect((await s.orch.resume(id, 'x')).ok).toBe(false);
  });

  it('after a restart, a job that was mid-run asks a human and keeps its history', async () => {
    const s = setup({ runCreator: () => new Promise(() => undefined) });
    const id = await toConceptReview(s);
    void s.orch.approveConcept(id, 1);
    await vi.waitFor(() => expect(state(s.orch, id)).toBe('PRODUCTION'));
    // a new server process loads the same folder
    const again = setup();
    await again.orch.ready;
    const o = again.orch.get(id)!.orchestration!;
    expect(o.state).toBe('HUMAN_INTERVENTION_REQUIRED');
    expect(o.blocker).toMatch(/restarted/);
    expect(o.history.length).toBeGreaterThan(5);
  });
});
