/**
 * The orchestrator (dev server only, this computer only): runs every AI-assisted job through the master
 * orchestration (skill universal-artwork-production-agent). It — not the drawing agent — makes every state
 * transition, persists it with its evidence, and decides from files on disk and the independent verifier's verdicts.
 *
 * Job folder (spec §12):
 *   status.json                    the job view + its orchestration record (state, history, concept, registry, approvals)
 *   brief/job.json, brief/reference.*            the brief as data (read-only reference)
 *   concepts/reference_only/concept-vN.png|json  AI concepts: shown to the designer, never reachable from production
 *   approvals/concept.json, approvals/final.json who approved what, when, which exact version/hash
 *   plans/style_contract.json, plans/asset_registry.json
 *   production/                    the drawing agent's ONLY folder: job.json, stages/, checkpoints/, evidence/, output/
 *   control/                       per-run connector config, guard config, settings, prompts, agent logs
 *   logs/transitions.jsonl, logs/verification.jsonl
 *   exports/, final_report.json    written only after the designer approved one exact version
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  MAX_CONCEPT_ATTEMPTS, STAGES, applyStageReports, applyVerdicts, approveConcept as approveConceptRule, approveFinal as approveFinalRule,
  buildRegistry, conceptPrompt, conceptQa, markExecuting, newOrchestration, openAiSize, openDefects, pngSize, registrySummary,
  styleContractFor, transition, unblock, viewStatus,
  type Actor, type CheckedReport, type ConceptQa, type JobState, type Orchestration, type Stage, type StyleContract, type Verdict,
} from '../src/state/orchestration';
import {
  SOURCE_FILES, buildOrchestratedPrompt, judgeResult, withOrchestration,
  type DownloadFile, type JobView, type ProductionJob, type RunnerKind,
} from '../src/state/production';
import { ART_STYLES } from '../src/state/styles';
import { appFor, engineOf, type EngineId } from '../src/state/engines';
import { psdLayerCountOfFile } from './files';
import { findConceptCopies, guardConfig, jobPaths, productionMcpConfig, productionSettings, sha256File, type JobPaths } from './gate';
import type { ConceptImage } from './openai';

export type StoredJobData = Omit<ProductionJob, 'reference'> & { reference: { file: string; ext: string; role: string } | null };

export interface CreatorRun {
  jobId: string; job: StoredJobData; paths: JobPaths; prompt: string; files: { mcp: string; settings: string }; run: number; logFile: string; signal: AbortSignal;
}
export interface VerifierItem {
  asset: string; name: string; app: string; stage: Stage; claimed: 'passed' | 'not_applicable'; reason: string | null; evidence: string[]; checkpoint: string | null; defectsBefore: string[];
}
export interface VerifierRun {
  jobId: string; paths: JobPaths; items: VerifierItem[]; contract: StyleContract | null; brief: string; run: number; signal: AbortSignal;
  /** the locked concept (absolute path): the verifier may Read it to judge fidelity; it never reaches production */
  concept: string | null;
}

export interface OrchestratorDeps {
  jobsDir: string;
  now?: () => number;
  /** false = approved jobs wait at ASSET_PLANNING */
  canRun: () => boolean;
  runnerKind: () => RunnerKind;
  claudeJson: () => Promise<string>;
  nodeBin: string;
  generateConcept: (r: { prompt: string; size: string; attempt: number; jobId: string }) => Promise<ConceptImage>;
  /** optional read-only visual critic of the concept (its own process; never production) */
  critiqueConcept?: (r: { file: string; contract: StyleContract | null; jobId: string }) => Promise<ConceptQa & { description?: string | null }>;
  runCreator: (run: CreatorRun) => Promise<{ exitCode: number | null; account: string | null }>;
  runVerifier: (run: VerifierRun) => Promise<{ ok: true; verdicts: Verdict[] } | { ok: false; error: string }>;
  /** skill names that are not installed (production is refused while any is missing) */
  missingSkills?: (names: string[]) => Promise<string[]>;
  /** null when the job's drawing apps are connected, else why not (production then waits for a human) */
  engineReady?: (engine: EngineId) => string | null;
  /** creator runs per job before a human must step in */
  maxRuns?: number;
}

export type ActionResult = { ok: true; job: JobView } | { ok: false; status: number; error: string };

interface Rec {
  id: string;
  paths: JobPaths;
  job: StoredJobData;
  o: Orchestration;
  createdAt: number;
  briefExcerpt: string;
  runner: RunnerKind;
  account: string | null;
  layers: number | null;
  hasPreview: boolean;
  files: DownloadFile[];
  /** history entries already in logs/transitions.jsonl */
  logged: number;
  abort: AbortController | null;
}

const JOB_ID = /^[a-z0-9]{12}$/;
const CANDIDATE_FILES = ['artwork.psd', 'artwork.ai', 'preview.png'] as const;
const CONCEPT_PHASE = new Set<JobState>(['CONCEPT_GENERATING', 'CONCEPT_QA']);
const RUN_PHASE = new Set<JobState>(['PRODUCTION', 'STAGE_VERIFYING', 'ASSEMBLY', 'FINAL_QA']);

const exists = (p: string) => fs.stat(p).then((s) => s.isFile() && s.size > 0, () => false);
const writeJson = async (file: string, data: unknown) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
};
/** A path from an agent report: relative, inside the production folder, or null. */
function insideProduction(prod: string, rel: unknown): string | null {
  if (typeof rel !== 'string' || rel.trim() === '' || path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null;
  const full = path.resolve(prod, rel);
  const r = path.relative(prod, full);
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? full : null;
}

export function createOrchestrator(deps: OrchestratorDeps) {
  const now = deps.now ?? Date.now;
  const maxRuns = deps.maxRuns ?? 8;
  const jobsDir = path.resolve(deps.jobsDir);
  const recs = new Map<string, Rec>();
  const queue: string[] = [];
  const pending = new Set<Promise<unknown>>();
  let busy = false;

  /* ---------- persistence ---------- */

  const saves = new Map<string, Promise<void>>();
  function save(rec: Rec): Promise<void> {
    const run = async () => {
      await writeJson(path.join(rec.paths.root, 'status.json'), view(rec));
      const fresh = rec.o.history.slice(rec.logged);
      if (fresh.length > 0) {
        await fs.mkdir(rec.paths.logs, { recursive: true });
        await fs.appendFile(path.join(rec.paths.logs, 'transitions.jsonl'), fresh.map((t) => JSON.stringify(t)).join('\n') + '\n');
        rec.logged += fresh.length;
      }
    };
    const next = (saves.get(rec.id) ?? Promise.resolve()).then(run, run);
    saves.set(rec.id, next.catch(() => undefined));
    return next;
  }

  function move(rec: Rec, to: JobState, actor: Actor, reason: string, evidence?: string[]): void {
    const r = transition(rec.o, to, { actor, reason, at: now(), evidence });
    if (!r.ok) throw new Error(r.error);
    rec.o = r.orchestration;
  }

  async function escalate(rec: Rec, reason: string, resumeTo: Orchestration['resumeTo']): Promise<void> {
    move(rec, 'HUMAN_INTERVENTION_REQUIRED', 'server', reason);
    rec.o = { ...rec.o, blocker: reason.slice(0, 2000), resumeTo };
    await save(rec);
  }

  /** Background work: errors never vanish — the job asks a human with the reason. */
  function track(work: () => Promise<void>, rec?: Rec): void {
    const p = work().catch(async (e) => {
      const msg = `Bridge error: ${e instanceof Error ? e.message : 'unknown'}`;
      if (rec && rec.o.state !== 'CANCELLED' && rec.o.state !== 'DELIVERED' && rec.o.state !== 'HUMAN_INTERVENTION_REQUIRED') {
        try {
          await escalate(rec, msg, CONCEPT_PHASE.has(rec.o.state) ? 'CONCEPT_GENERATING' : 'STAGE_CORRECTING');
        } catch {
          /* the state does not allow escalation; it is saved as it is */
        }
      }
    });
    pending.add(p);
    void p.finally(() => pending.delete(p));
  }

  const cancelled = (rec: Rec) => rec.o.state === 'CANCELLED';

  /* ---------- the view the browser gets ---------- */

  function message(rec: Rec): string | null {
    const o = rec.o;
    switch (o.state) {
      case 'BRIEF_PENDING': case 'ART_DIRECTION_READY': return 'Preparing the art direction…';
      case 'CONCEPT_GENERATING': return `Making the concept (attempt ${o.concept.attempts} of ${MAX_CONCEPT_ATTEMPTS})…`;
      case 'CONCEPT_QA': return 'Checking the concept…';
      case 'CONCEPT_REVIEW': return 'The concept is ready. Approve it, or say what to change. Nothing is drawn until you approve.';
      case 'CONCEPT_APPROVED': case 'ASSET_PLANNING': return deps.canRun() ? 'Concept approved. Planning the assets…' : 'Concept approved. Waiting for the drawing agent to be available on this computer.';
      case 'PRODUCTION': {
        const e = engineOf(rec.job.engine);
        return `Drawing in ${e.apps.Photoshop} / ${e.apps.Illustrator} (run ${o.productionRuns})…`;
      }
      case 'STAGE_VERIFYING': return 'The independent verifier is checking every stage…';
      case 'STAGE_CORRECTING': return `Correcting ${o.corrections.length} finding${o.corrections.length === 1 ? '' : 's'}…`;
      case 'HUMAN_INTERVENTION_REQUIRED': return o.blocker;
      case 'ASSEMBLY': case 'FINAL_QA': return 'Checking the finished artwork…';
      case 'FINAL_REVIEW': return 'Finished. Check the artwork and approve this exact version, or say what to change.';
      case 'EXPORTING': return 'Exporting the approved version…';
      case 'DELIVERED': return 'Delivered. The approved version is ready to download.';
      case 'CANCELLED': return 'Cancelled.';
    }
  }

  function view(rec: Rec): JobView {
    return {
      id: rec.id, createdAt: rec.createdAt, engine: engineOf(rec.job.engine).id, status: viewStatus(rec.o.state), styleName: rec.job.styleName, skills: rec.job.skills, ratio: rec.job.ratio,
      templateTitle: rec.job.templateTitle, briefExcerpt: rec.briefExcerpt, runner: rec.runner, message: message(rec), hasPreview: rec.hasPreview,
      files: rec.files, layers: rec.layers, account: rec.account, orchestration: rec.o,
    };
  }

  /* ---------- concept ---------- */

  async function conceptRound(rec: Rec, feedback: string | null): Promise<void> {
    for (;;) {
      if (cancelled(rec)) return;
      if (rec.o.state !== 'CONCEPT_GENERATING') move(rec, 'CONCEPT_GENERATING', 'server', `Concept attempt ${rec.o.concept.attempts + 1} of ${MAX_CONCEPT_ATTEMPTS}`);
      const attempt = rec.o.concept.attempts + 1;
      rec.o = { ...rec.o, concept: { ...rec.o.concept, attempts: attempt } };
      await save(rec);
      const last = rec.o.concept.versions[rec.o.concept.versions.length - 1];
      const notes = [...(feedback ? [feedback] : []), ...(attempt > 1 && last && !last.qa.passed ? [`The previous attempt failed these checks; fix them: ${last.qa.problems.join(' ')}`] : [])];
      const img = await deps.generateConcept({ prompt: conceptPrompt(rec.o.styleContract!, rec.job, notes), size: openAiSize(rec.job.ratio), attempt, jobId: rec.id });
      if (cancelled(rec)) return;
      if (!img.ok) return escalate(rec, img.error, 'CONCEPT_GENERATING');

      const version = rec.o.concept.versions.length + 1;
      const rel = `concepts/reference_only/concept-v${version}.png`;
      const file = path.join(rec.paths.root, rel);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, img.png, { flag: 'wx' });
      const sha256 = await sha256File(file);
      let qa = conceptQa({ head: img.png.subarray(0, 33), bytes: img.png.length, ratio: rec.job.ratio });
      let description: string | null = null;
      if (qa.passed && deps.critiqueConcept) {
        const critic = await deps.critiqueConcept({ file, contract: rec.o.styleContract, jobId: rec.id });
        qa = { passed: critic.passed, problems: critic.problems };
        description = critic.description ?? null;
      }
      if (cancelled(rec)) return;
      const size = pngSize(img.png.subarray(0, 33));
      rec.o = {
        ...rec.o,
        concept: {
          ...rec.o.concept,
          versions: [...rec.o.concept.versions, { version, file: rel, sha256, createdAt: now(), attempt, width: size?.width ?? null, height: size?.height ?? null, qa, feedback, model: img.model, description }],
        },
      };
      await writeJson(file.replace(/\.png$/, '.json'), { version, sha256, model: img.model, attempt, qa, feedback, referenceOnly: true });
      move(rec, 'CONCEPT_QA', 'server', `Concept v${version} made by ${img.model}`, [rel]);
      if (qa.passed) {
        move(rec, 'CONCEPT_REVIEW', 'server', `Concept v${version} passed the automatic checks`, [rel]);
        return save(rec);
      }
      if (attempt >= MAX_CONCEPT_ATTEMPTS) {
        return escalate(rec, `${MAX_CONCEPT_ATTEMPTS} automatic concept attempts failed the checks. Last problems: ${qa.problems.join(' ')} Look at the attempts and resume with a note.`, 'CONCEPT_GENERATING');
      }
      await save(rec);
    }
  }

  /* ---------- production ---------- */

  function enqueue(rec: Rec): void {
    if (!queue.includes(rec.id)) queue.push(rec.id);
    pump();
  }

  function pump(): void {
    if (busy || !deps.canRun()) return;
    const id = queue.shift();
    const rec = id ? recs.get(id) : undefined;
    if (!rec) return;
    busy = true;
    track(async () => {
      try {
        await runProduction(rec);
      } finally {
        busy = false;
        pump();
      }
    }, rec);
  }

  async function readReports(rec: Rec): Promise<Record<string, Partial<Record<Stage, CheckedReport>>>> {
    const prod = rec.paths.production;
    const out: Record<string, Partial<Record<Stage, CheckedReport>>> = {};
    const fileOk = async (rel: unknown, ext: RegExp) => {
      const full = insideProduction(prod, rel);
      return full && ext.test(full) && (await exists(full)) ? full : null;
    };
    for (const asset of rec.o.registry) {
      for (const stage of STAGES) {
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(await fs.readFile(path.join(prod, 'stages', asset.id, `${stage}.json`), 'utf8')) as Record<string, unknown>;
        } catch {
          continue;
        }
        const status = raw.status === 'passed' || raw.status === 'not_applicable' ? raw.status : 'failed';
        const cp = await fileOk(raw.checkpoint, /\.(psd|ai|psb|pdf|svg)$/i);
        const captures = await Promise.all((Array.isArray(raw.captures) ? raw.captures.slice(0, 6) : []).map(async (c) => ({ file: String(c), ok: Boolean(await fileOk(c, /\.png$/i)) })));
        (out[asset.id] ??= {})[stage] = {
          stage, status, reason: typeof raw.reason === 'string' ? raw.reason : status === 'failed' ? `unreadable report (status ${JSON.stringify(raw.status)})` : null,
          checkpoint: raw.checkpoint === undefined ? null : { file: String(raw.checkpoint), ok: Boolean(cp), sha256: cp ? await sha256File(cp) : null },
          captures,
        };
      }
    }
    return out;
  }

  async function runProduction(rec: Rec): Promise<void> {
    if (rec.o.state !== 'ASSET_PLANNING' && rec.o.state !== 'STAGE_CORRECTING') return;
    const lock = rec.o.concept.locked;
    const lockedVersion = rec.o.concept.versions.find((v) => v.version === lock?.version);
    if (!lock || !lockedVersion) return escalate(rec, 'There is no approved concept, so production is refused.', 'CONCEPT_GENERATING');
    if ((await sha256File(path.join(rec.paths.root, lockedVersion.file)).catch(() => '')) !== lock.sha256) {
      return escalate(rec, 'The approved concept file changed after approval, so production is refused. Make and approve a new concept.', 'CONCEPT_GENERATING');
    }
    const missing = deps.missingSkills ? await deps.missingSkills(rec.job.skills.map((s) => s.name)) : [];
    if (missing.length > 0) {
      return escalate(rec, `The skill ${missing.map((m) => `“${m}”`).join(' and ')} is not installed on this computer, so this can’t be drawn. Install it, then resume.`, 'STAGE_CORRECTING');
    }
    const engine = engineOf(rec.job.engine);
    const notReady = deps.engineReady?.(engine.id) ?? null;
    if (notReady) return escalate(rec, `This job is drawn in ${engine.label}, which is not ready: ${notReady} Fix that, then resume.`, 'STAGE_CORRECTING');

    const run = rec.o.productionRuns + 1;
    const p = rec.paths;
    // Only this run's stage reports count: earlier ones are kept aside for the audit.
    if (existsSync(path.join(p.production, 'stages'))) await fs.rename(path.join(p.production, 'stages'), path.join(p.control, `stages-run-${run - 1}`)).catch(() => undefined);
    move(rec, 'PRODUCTION', 'server', `Production run ${run}`);
    rec.o = { ...rec.o, productionRuns: run, registry: markExecuting(rec.o.registry) };

    let referenceFile: string | null = null;
    if (rec.job.reference) {
      referenceFile = `client-reference.${rec.job.reference.ext}`;
      await fs.copyFile(path.join(p.brief, rec.job.reference.file), path.join(p.production, referenceFile));
    }
    const style = ART_STYLES.find((s) => s.id === rec.job.styleId);
    await writeJson(path.join(p.production, 'job.json'), {
      artwork: rec.job.templateTitle, artStyle: { name: rec.job.styleName, description: style?.description ?? '' }, madeIn: rec.job.madeIn,
      drawingApps: engine.apps,
      size: rec.job.canvas, text: rec.job.text, clientBrief: rec.job.brief, plan: rec.job.plan, styleContract: rec.o.styleContract,
      conceptDescription: lockedVersion.description ?? null, registry: rec.o.registry, corrections: rec.o.corrections, run,
      clientReference: referenceFile ? { file: referenceFile, role: rec.job.reference?.role ?? null } : null,
    });
    const files = { mcp: path.join(p.control, `mcp-run-${run}.json`), settings: path.join(p.control, `settings-run-${run}.json`) };
    const guardFile = path.join(p.control, 'guard.json');
    await writeJson(files.mcp, productionMcpConfig(await deps.claudeJson(), p, engine.id));
    await writeJson(guardFile, guardConfig(p, jobsDir, engine.id));
    await writeJson(files.settings, productionSettings(p, { node: deps.nodeBin, configFile: guardFile }, engine.id));
    const prompt = buildOrchestratedPrompt({ ...rec.job, reference: null }, p.production, { run, referenceFile });
    await fs.writeFile(path.join(p.control, `prompt-run-${run}.txt`), prompt);
    await save(rec);

    rec.abort = new AbortController();
    const result = await deps.runCreator({ jobId: rec.id, job: rec.job, paths: p, prompt, files, run, logFile: path.join(p.control, `agent-run-${run}.log`), signal: rec.abort.signal });
    rec.abort = null;
    if (cancelled(rec)) return;
    rec.account = result.account;

    // Evidence in: the server checks the files, then the independent verifier judges.
    let registry = applyStageReports(rec.o.registry, await readReports(rec));
    move(rec, 'STAGE_VERIFYING', 'server', `Run ${run} finished (exit ${result.exitCode ?? 'none'}); checking stage evidence`, [`production/stages (run ${run})`]);
    rec.o = { ...rec.o, registry };
    await save(rec);
    const items: VerifierItem[] = registry.flatMap((a) => STAGES.filter((s) => a.stages[s].status === 'verifying').map((s) => ({
      asset: a.id, name: a.name, app: appFor(engine.id, a.app), stage: s, claimed: a.stages[s].checkpoint ? 'passed' as const : 'not_applicable' as const,
      reason: a.stages[s].reason, evidence: a.stages[s].evidence, checkpoint: a.stages[s].checkpoint?.file ?? null, defectsBefore: a.stages[s].defects,
    })));
    rec.abort = new AbortController();
    const verdict = items.length > 0
      ? await deps.runVerifier({ jobId: rec.id, paths: p, items, contract: rec.o.styleContract, brief: rec.job.brief, run, signal: rec.abort.signal, concept: path.join(p.root, lockedVersion.file) })
      : { ok: true as const, verdicts: [] };
    rec.abort = null;
    if (cancelled(rec)) return;
    registry = applyVerdicts(registry, verdict.ok ? verdict.verdicts : []);
    rec.o = { ...rec.o, registry };
    await fs.appendFile(path.join(p.logs, 'verification.jsonl'), `${JSON.stringify({ run, at: now(), items: items.length, ok: verdict.ok, error: verdict.ok ? null : verdict.error, verdicts: verdict.ok ? verdict.verdicts : [] })}\n`);
    await writeJson(path.join(p.plans, 'asset_registry.json'), registry);

    const summary = registrySummary(registry);
    const defects = openDefects(registry);
    if (summary === 'blocked') {
      const why = verdict.ok ? '' : ` The verifier could not run: ${verdict.error}`;
      return escalate(rec, `Production is blocked and needs you: ${defects.slice(0, 4).join(' · ')}${defects.length > 4 ? ` (+${defects.length - 4} more)` : ''}.${why}`, 'STAGE_CORRECTING');
    }
    if (summary === 'needs_correction') return correct(rec, defects, run);

    move(rec, 'ASSEMBLY', 'server', 'Every asset passed every stage (or was verified not applicable)');
    move(rec, 'FINAL_QA', 'server', 'Checking the master files, preview and provenance');
    const out = p.output;
    const has = async (f: string) => exists(path.join(out, f));
    const hasPsd = await has('artwork.psd');
    let reportedOk: boolean | null = null;
    let notes: string | null = null;
    try {
      const r = JSON.parse(await fs.readFile(path.join(out, 'result.json'), 'utf8')) as Record<string, unknown>;
      reportedOk = r.ok === true;
      notes = String(r.notes ?? r.reason ?? '').slice(0, 600) || null;
    } catch {
      /* no result file */
    }
    const judged = judgeResult({
      hasPreview: await has('preview.png'), hasPsd, hasAi: await has('artwork.ai'), psdLayers: hasPsd ? await psdLayerCountOfFile(path.join(out, 'artwork.psd')) : null,
      reportedOk, notes, exitCode: result.exitCode,
    });
    const copies = await findConceptCopies(p.production, new Set(rec.o.concept.versions.map((v) => v.sha256)));
    if (copies.length > 0) {
      return escalate(rec, `Critical: a copy of the AI concept was found in the production folder (${copies.join(', ')}). Generated pixels must never enter production, so this was not passed.`, 'STAGE_CORRECTING');
    }
    if (judged.status === 'failed') return correct(rec, [`Final QA: ${judged.message ?? 'the master files are incomplete'}`], run);

    const candidate: Array<{ name: string; sha256: string }> = [];
    for (const f of CANDIDATE_FILES) if (await has(f)) candidate.push({ name: f, sha256: await sha256File(path.join(out, f)) });
    const version = createHash('sha256').update(candidate.map((c) => `${c.name}:${c.sha256}`).join('\n')).digest('hex');
    rec.layers = judged.layers;
    rec.hasPreview = true;
    rec.o = { ...rec.o, finalCandidate: { version, files: candidate, createdAt: now() }, corrections: [] };
    move(rec, 'FINAL_REVIEW', 'server', `Final QA passed: version ${version.slice(0, 12)}`, candidate.map((c) => `production/output/${c.name}`));
    await save(rec);
  }

  async function correct(rec: Rec, corrections: string[], run: number): Promise<void> {
    if (run >= maxRuns) return escalate(rec, `Still not passing after ${run} production runs: ${corrections.slice(0, 3).join(' · ')}`, 'STAGE_CORRECTING');
    move(rec, 'STAGE_CORRECTING', 'server', `${corrections.length} finding(s) to correct`);
    rec.o = { ...rec.o, corrections };
    await save(rec);
    enqueue(rec);
  }

  async function exportApproved(rec: Rec): Promise<void> {
    const cand = rec.o.finalCandidate;
    const approval = rec.o.finalApproval;
    if (!cand || !approval || approval.version !== cand.version) return escalate(rec, 'There is no approved version to export.', 'STAGE_CORRECTING');
    for (const f of cand.files) {
      if ((await sha256File(path.join(rec.paths.output, f.name)).catch(() => '')) !== f.sha256) {
        return escalate(rec, `${f.name} changed after you approved it, so nothing was exported. Resume to make and review a new version.`, 'STAGE_CORRECTING');
      }
    }
    await fs.mkdir(rec.paths.exports, { recursive: true });
    for (const f of cand.files) await fs.copyFile(path.join(rec.paths.output, f.name), path.join(rec.paths.exports, f.name));
    const lock = rec.o.concept.locked;
    const apps = engineOf(rec.job.engine).apps;
    await writeJson(path.join(rec.paths.root, 'final_report.json'), {
      jobId: rec.id, approvedVersion: cand.version, approvedBy: approval.by, approvedAt: new Date(approval.at).toISOString(), files: cand.files,
      concept: lock ? { version: lock.version, sha256: lock.sha256, approvedBy: lock.by, approvedAt: new Date(lock.at).toISOString(), storage: 'concepts/reference_only (never reachable from production)' } : null,
      productionRuns: rec.o.productionRuns, assets: rec.o.registry.map((a) => ({ id: a.id, stages: Object.fromEntries(STAGES.map((s) => [s, a.stages[s].status])) })),
      skills: rec.job.skills, history: rec.o.history,
      drawingApps: apps,
      aiDisclosure: `AI-assisted native-tool production: the concept was generated by an OpenAI image model as reference only; the artwork was built in ${apps.Photoshop}/${apps.Illustrator} by a Claude agent with native operations, checked by an independent verifier and approved by the designer. Not exclusively human-made.`,
    });
    rec.files = SOURCE_FILES.filter((f) => cand.files.some((c) => c.name === f));
    move(rec, 'DELIVERED', 'server', `Exported version ${cand.version.slice(0, 12)}`, cand.files.map((f) => `exports/${f.name}`));
    await save(rec);
  }

  /* ---------- loading after a restart ---------- */

  const ready = (async () => {
    await fs.mkdir(jobsDir, { recursive: true });
    for (const id of await fs.readdir(jobsDir).catch(() => [] as string[])) {
      if (!JOB_ID.test(id)) continue;
      const paths = jobPaths(path.join(jobsDir, id));
      try {
        const saved = JSON.parse(await fs.readFile(path.join(paths.root, 'status.json'), 'utf8')) as JobView;
        if (!saved.orchestration) continue;
        const job = JSON.parse(await fs.readFile(path.join(paths.brief, 'job.json'), 'utf8')) as StoredJobData;
        const rec: Rec = {
          id, paths, job, o: saved.orchestration, createdAt: saved.createdAt, briefExcerpt: saved.briefExcerpt, runner: saved.runner, account: saved.account ?? null,
          layers: saved.layers ?? null, hasPreview: saved.hasPreview, files: saved.files ?? [], logged: saved.orchestration.history.length, abort: null,
        };
        recs.set(id, rec);
        const s = rec.o.state;
        if (CONCEPT_PHASE.has(s)) await escalate(rec, `Interrupted: the app was restarted while the concept was being made (${s}). Resume to continue.`, 'CONCEPT_GENERATING');
        else if (RUN_PHASE.has(s)) await escalate(rec, `Interrupted: the app was restarted during production (${s}). Resume to continue from the last checked stage.`, 'STAGE_CORRECTING');
        else if (s === 'BRIEF_PENDING' || s === 'ART_DIRECTION_READY') track(() => conceptRound(rec, null), rec);
        else if (s === 'ASSET_PLANNING' || s === 'STAGE_CORRECTING') enqueue(rec);
        else if (s === 'EXPORTING') track(() => exportApproved(rec), rec);
      } catch {
        /* not an orchestrated job (older jobs are handled by the bridge) */
      }
    }
  })();

  /* ---------- actions ---------- */

  const fail = (status: number, error: string): ActionResult => ({ ok: false, status, error });
  const okView = (rec: Rec): ActionResult => ({ ok: true, job: view(rec) });
  const find = (id: string) => (JOB_ID.test(id) ? recs.get(id) : undefined);
  const cleanNote = (s: unknown, max = 1000) => (typeof s === 'string' ? s.replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max) : '');

  async function create(job: ProductionJob): Promise<JobView> {
    await ready;
    const id = randomBytes(6).toString('hex');
    const paths = jobPaths(path.join(jobsDir, id));
    for (const d of [paths.brief, paths.concepts, paths.approvals, paths.plans, paths.output, paths.control, paths.logs]) await fs.mkdir(d, { recursive: true });
    const { reference, ...rest } = job;
    if (reference) await fs.writeFile(path.join(paths.brief, `reference.${reference.ext}`), Buffer.from(reference.base64, 'base64'));
    const data: StoredJobData = { ...rest, skills: withOrchestration(job.skills), reference: reference ? { file: `reference.${reference.ext}`, ext: reference.ext, role: reference.role } : null };
    await writeJson(path.join(paths.brief, 'job.json'), data);
    const contract = styleContractFor(job, job.plan, ART_STYLES.find((s) => s.id === job.styleId)?.description ?? '');
    await writeJson(path.join(paths.plans, 'style_contract.json'), contract);
    const createdAt = now();
    const rec: Rec = {
      id, paths, job: data, o: newOrchestration(createdAt), createdAt, briefExcerpt: job.brief.length > 140 ? `${job.brief.slice(0, 140)}…` : job.brief,
      runner: deps.runnerKind(), account: null, layers: null, hasPreview: false, files: [], logged: 0, abort: null,
    };
    recs.set(id, rec);
    move(rec, 'ART_DIRECTION_READY', 'server', 'Brief checked; style contract written from the approved plan', ['brief/job.json', 'plans/style_contract.json']);
    rec.o = { ...rec.o, styleContract: contract };
    await save(rec);
    track(() => conceptRound(rec, null), rec);
    return view(rec);
  }

  async function approveConcept(id: string, version: unknown): Promise<ActionResult> {
    const rec = find(id);
    if (!rec) return fail(404, 'That job is not there.');
    if (rec.o.state !== 'CONCEPT_REVIEW') return fail(409, 'There is no concept waiting for approval.');
    const v = rec.o.concept.versions.find((x) => x.version === version);
    const sha = v ? await sha256File(path.join(rec.paths.root, v.file)).catch(() => '') : '';
    const r = approveConceptRule(rec.o, typeof version === 'number' ? version : -1, sha, 'designer', now());
    if (!r.ok) return fail(409, r.error);
    rec.o = r.orchestration;
    await writeJson(path.join(rec.paths.approvals, 'concept.json'), rec.o.concept.locked);
    move(rec, 'ASSET_PLANNING', 'server', 'Concept locked; asset registry built from the approved plan', ['approvals/concept.json', 'plans/asset_registry.json']);
    rec.o = { ...rec.o, registry: buildRegistry(rec.job.plan, rec.job) };
    await writeJson(path.join(rec.paths.plans, 'asset_registry.json'), rec.o.registry);
    await save(rec);
    enqueue(rec);
    return okView(rec);
  }

  async function rejectConcept(id: string, feedback: unknown): Promise<ActionResult> {
    const rec = find(id);
    if (!rec) return fail(404, 'That job is not there.');
    const note = cleanNote(feedback);
    if (note.length < 3) return fail(400, 'Say what should change in the concept.');
    if (rec.o.state !== 'CONCEPT_REVIEW') return fail(409, 'There is no concept waiting for review.');
    move(rec, 'CONCEPT_GENERATING', 'designer', `Concept rejected: ${note}`);
    rec.o = { ...rec.o, concept: { ...rec.o.concept, attempts: 0 } };
    await save(rec);
    track(() => conceptRound(rec, note), rec);
    return okView(rec);
  }

  async function approveFinal(id: string, version: unknown): Promise<ActionResult> {
    const rec = find(id);
    if (!rec) return fail(404, 'That job is not there.');
    const r = approveFinalRule(rec.o, typeof version === 'string' ? version : '', 'designer', now());
    if (!r.ok) return fail(409, r.error);
    rec.o = r.orchestration;
    await writeJson(path.join(rec.paths.approvals, 'final.json'), rec.o.finalApproval);
    await save(rec);
    track(() => exportApproved(rec), rec);
    return okView(rec);
  }

  async function rejectFinal(id: string, feedback: unknown): Promise<ActionResult> {
    const rec = find(id);
    if (!rec) return fail(404, 'That job is not there.');
    const note = cleanNote(feedback);
    if (note.length < 3) return fail(400, 'Say what should change.');
    if (rec.o.state !== 'FINAL_REVIEW') return fail(409, 'There is no final artwork waiting for review.');
    move(rec, 'STAGE_CORRECTING', 'designer', `Final artwork rejected: ${note}`);
    rec.o = { ...rec.o, corrections: [`Designer: ${note}`], finalCandidate: null };
    rec.hasPreview = false;
    await save(rec);
    enqueue(rec);
    return okView(rec);
  }

  async function resume(id: string, feedback: unknown): Promise<ActionResult> {
    const rec = find(id);
    if (!rec) return fail(404, 'That job is not there.');
    if (rec.o.state !== 'HUMAN_INTERVENTION_REQUIRED') return fail(409, 'This job is not waiting for you.');
    const note = cleanNote(feedback);
    const to = rec.o.resumeTo ?? 'STAGE_CORRECTING';
    move(rec, to, 'designer', note ? `Resumed: ${note}` : 'Resumed');
    if (to === 'CONCEPT_GENERATING') {
      // A new concept invalidates everything that depended on the old one.
      rec.o = { ...rec.o, blocker: null, resumeTo: null, concept: { ...rec.o.concept, attempts: 0, locked: null }, registry: [], finalCandidate: null, finalApproval: null, corrections: [] };
      rec.hasPreview = false;
      await save(rec);
      track(() => conceptRound(rec, note || null), rec);
    } else {
      const registry = unblock(rec.o.registry);
      rec.o = { ...rec.o, blocker: null, resumeTo: null, registry, corrections: [...openDefects(registry), ...(note ? [`Designer: ${note}`] : [])] };
      await save(rec);
      enqueue(rec);
    }
    return okView(rec);
  }

  async function cancel(id: string): Promise<ActionResult> {
    const rec = find(id);
    if (!rec) return fail(404, 'That job is not there.');
    if (rec.o.state === 'DELIVERED' || rec.o.state === 'CANCELLED') return fail(409, 'This job is already finished.');
    move(rec, 'CANCELLED', 'designer', 'Cancelled by the designer');
    rec.abort?.abort();
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
    await save(rec);
    return okView(rec);
  }

  return {
    ready,
    create,
    approveConcept, rejectConcept, approveFinal, rejectFinal, resume, cancel,
    get: (id: string): JobView | undefined => {
      const rec = find(id);
      return rec ? view(rec) : undefined;
    },
    list: (): JobView[] => [...recs.values()].map(view),
    has: (id: string) => recs.has(id),
    /** Start waiting production work (call when the drawing agent becomes available). */
    kick: () => pump(),
    conceptFile(id: string, version: number): string | null {
      const rec = find(id);
      const v = rec?.o.concept.versions.find((x) => x.version === version);
      return rec && v ? path.join(rec.paths.root, v.file) : null;
    },
    previewFile(id: string): string | null {
      const rec = find(id);
      if (!rec || !rec.hasPreview) return null;
      return path.join(rec.o.state === 'DELIVERED' ? rec.paths.exports : rec.paths.output, 'preview.png');
    },
    exportFile(id: string, name: string): string | null {
      const rec = find(id);
      return rec && rec.o.state === 'DELIVERED' && (rec.files as string[]).includes(name) ? path.join(rec.paths.exports, name) : null;
    },
    /** Resolves when no background work is left (tests, shutdown). */
    async idle(): Promise<void> {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
