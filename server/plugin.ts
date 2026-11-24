/**
 * Local production bridge (dev server only, this computer only).
 *
 *   POST /api/production/jobs          create a job → saved to <jobs>/<id>/, queued for the agent
 *   GET  /api/production/jobs          list jobs with status
 *   GET  /api/production/jobs/:id/preview   the exported preview.png
 *   GET  /api/production/jobs/:id/files/artwork.psd|artwork.ai   the layered source, as a download
 *   GET  /api/production/health        which runner is active
 *   GET  /api/production/skills        whether each skill named in production/skills.json is installed
 *
 * Runner (env LUMORA_RUNNER): "claude" starts a Claude Code agent that may use only the Photoshop and
 * Illustrator tools plus file tools; "mock" writes a placeholder (tests / demos); "off" only queues.
 * Default: "claude" when the CLI is found (LUMORA_CLAUDE_BIN or `claude` on PATH), otherwise "off".
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import {
  DOWNLOAD_FILES, HAND_MADE_SKILL, JOB_SHEET, SOURCE_FILES, applySkillChange, buildAgentPrompt, buildHandmadePrompt, handmadeJobSheet,
  judgeHandmade, judgeResult, parseSkillFile, skillStatus, validateJobRequest,
  type BridgeHealth, type DownloadFile, type JobStatus, type JobView, type ProductionJob, type RunnerKind, type SkillUse, type SkillsState,
} from '../src/state/production';
import {
  fakePsd, installSkill, listSkills, psdLayerCountOfFile, readSkillMap, readSkillText, skillDirs, skillInstallDir, writeSkillMap,
} from './files';

const MAX_BODY_BYTES = 16 * 1024 * 1024;
const AGENT_TIMEOUT_MS = 45 * 60 * 1000;
/** The agent can draw in the Adobe apps and read/write files — no shell, no network tools. */
const ALLOWED_TOOLS = 'mcp__photoshop,mcp__illustrator,Skill,Read,Write,Edit,Glob,Grep';
/** Hand-made jobs: the agent may only read and write the job sheet — no Adobe tools, so it cannot draw. */
const HANDMADE_TOOLS = 'Skill,Read,Write,Glob,Grep';
/** Anything in a hand-made job's output that would mean the agent made artwork. */
const ARTWORK_FILE = /\.(psd|psb|ai|svg|png|jpe?g|webp|pdf|eps|tiff?)$/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const JOB_ID = /^[a-z0-9]{12}$/;
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

interface StoredJob extends JobView { dir: string }

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

/** Only pages served from this computer may talk to the bridge (blocks other websites from starting jobs). */
function isLocalRequest(req: IncomingMessage): boolean {
  if (!LOCAL_HOST.test(req.headers.host ?? '')) return false;
  const { origin } = req.headers;
  if (!origin) return true;
  try {
    return LOCAL_HOST.test(new URL(origin).host);
  } catch {
    return false;
  }
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too-large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('bad-json'));
      }
    });
    req.on('error', reject);
  });
}

const exists = (p: string) => fs.stat(p).then((s) => s.size > 0, () => false);

function runProcess(bin: string, args: string[], cwd: string, stdin: string | null, timeoutMs: number, logFile: string | null): Promise<number | null> {
  return new Promise((resolve) => {
    // shell is needed on Windows for .cmd shims; every argument here is a fixed constant, never user text.
    const viaShell = process.platform === 'win32';
    const command = viaShell && /\s/.test(bin) && !bin.startsWith('"') ? `"${bin}"` : bin;
    const child = spawn(command, args, { cwd, shell: viaShell, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const log: Buffer[] = [];
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d: Buffer) => log.push(d));
    child.stderr.on('data', (d: Buffer) => log.push(d));
    const finish = (code: number | null) => {
      clearTimeout(timer);
      if (logFile) void fs.writeFile(logFile, Buffer.concat(log)).catch(() => undefined);
      resolve(code);
    };
    child.on('error', () => finish(null));
    child.on('close', finish);
    if (stdin !== null) child.stdin.write(stdin);
    child.stdin.end();
  });
}

export function productionBridge(): Plugin {
  const jobsDir = path.resolve(process.env.LUMORA_JOBS_DIR ?? 'production/jobs');
  /** Which skill draws what — written by the Skills screen. */
  const skillsFile = path.resolve(process.env.LUMORA_SKILLS_FILE ?? 'production/skills.json');
  const claudeBin = process.env.LUMORA_CLAUDE_BIN?.trim() || 'claude';
  const jobs = new Map<string, StoredJob>();
  const queue: string[] = [];
  let busy = false;
  let runner: RunnerKind = 'off';
  let detail = 'Checking for the Claude Code agent…';

  const ready = (async () => {
    await fs.mkdir(jobsDir, { recursive: true });
    // Reload earlier jobs; anything that was mid-run when the server stopped is marked as interrupted.
    for (const id of await fs.readdir(jobsDir)) {
      if (!JOB_ID.test(id)) continue;
      try {
        const saved = JSON.parse(await fs.readFile(path.join(jobsDir, id, 'status.json'), 'utf8')) as JobView & { skill?: string };
        // Jobs saved before skills were per job had a single "skill" and no file list.
        const { skill: oldSkill, ...view } = saved;
        const skills: SkillUse[] = Array.isArray(view.skills) ? view.skills : oldSkill ? [{ name: oldSkill, role: 'style' }] : [];
        const interrupted = view.status === 'queued' || view.status === 'running';
        jobs.set(id, {
          ...view, skills, files: Array.isArray(view.files) ? view.files : [], layers: view.layers ?? null, dir: path.join(jobsDir, id),
          ...(interrupted ? { status: 'failed' as JobStatus, message: 'Interrupted: the app was restarted before this job finished.' } : {}),
        });
      } catch {
        /* not a job folder */
      }
    }
    const wanted = process.env.LUMORA_RUNNER;
    if (wanted === 'mock') {
      runner = 'mock';
      detail = 'Demo runner: jobs finish with a placeholder image. No artwork is made.';
    } else if (wanted === 'off') {
      detail = 'The runner is switched off (LUMORA_RUNNER=off). Jobs are saved but not started.';
    } else if ((await runProcess(claudeBin, ['--version'], jobsDir, null, 20_000, null)) === 0) {
      runner = 'claude';
      detail = 'Connected: the agent will draw in Photoshop and Illustrator on this computer.';
    } else {
      detail = 'The drawing agent is not set up on this computer yet, so jobs are saved but cannot start. Ask your studio admin — the setup steps are in the README.';
    }
  })();

  const save = async (job: StoredJob) => {
    const { dir, ...view } = job;
    await fs.writeFile(path.join(dir, 'status.json'), JSON.stringify(view, null, 2));
  };
  const update = async (id: string, patch: Partial<StoredJob>) => {
    const job = jobs.get(id);
    if (!job) return;
    Object.assign(job, patch);
    await save(job).catch(() => undefined);
  };

  /** Demo runner: a placeholder preview and a skeleton 3-layer PSD, judged exactly like a real job. */
  async function runMock(out: string): Promise<number> {
    await new Promise((r) => setTimeout(r, 700));
    await fs.writeFile(path.join(out, 'preview.png'), PLACEHOLDER_PNG);
    await fs.writeFile(path.join(out, 'artwork.psd'), fakePsd(3));
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ ok: true, files: ['artwork.psd', 'preview.png'], notes: 'Demo runner — placeholder files. No artwork was made.' }));
    return 0;
  }

  /** Demo runner for an agent-written hand-made job sheet. */
  async function runMockHandmade(out: string): Promise<number> {
    await new Promise((r) => setTimeout(r, 400));
    await fs.writeFile(path.join(out, JOB_SHEET), '# Hand-made job sheet (demo)\n\nAI-assisted: demo runner placeholder. No artwork was made.\n');
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ ok: true, notes: 'Demo runner — placeholder job sheet.' }));
    return 0;
  }

  async function runJob(job: StoredJob): Promise<void> {
    const out = path.join(job.dir, 'output');
    await fs.mkdir(out, { recursive: true });
    const handmade = job.handmade === 'agent';
    const prompt = () => fs.readFile(path.join(job.dir, 'prompt.txt'), 'utf8');
    const exitCode = runner === 'mock'
      ? await (handmade ? runMockHandmade(out) : runMock(out))
      : await runProcess(claudeBin, ['-p', '--allowedTools', handmade ? HANDMADE_TOOLS : ALLOWED_TOOLS], job.dir, await prompt(), AGENT_TIMEOUT_MS, path.join(job.dir, 'agent.log'));

    let notes: string | null = null;
    let reportedOk: boolean | null = null;
    try {
      const result = JSON.parse(await fs.readFile(path.join(out, 'result.json'), 'utf8')) as Record<string, unknown>;
      reportedOk = result.ok === true;
      notes = String(result.notes ?? result.reason ?? '').slice(0, 600) || null;
    } catch {
      /* the agent did not write a result file */
    }
    if (handmade) {
      const made = (await fs.readdir(out).catch(() => [] as string[])).filter((f) => ARTWORK_FILE.test(f));
      const hasSheet = await exists(path.join(out, JOB_SHEET));
      const verdict = judgeHandmade({ hasSheet, madeArtwork: made.length > 0, reportedOk, notes, exitCode });
      await update(job.id, { status: verdict.status, message: verdict.message, hasPreview: false, files: verdict.status === 'done' ? [JOB_SHEET] : [], layers: null });
      return;
    }

    const files: DownloadFile[] = [];
    for (const f of SOURCE_FILES) if (await exists(path.join(out, f))) files.push(f);
    const hasPsd = files.includes('artwork.psd');
    const hasPreview = await exists(path.join(out, 'preview.png'));
    const verdict = judgeResult({
      hasPreview, hasPsd, hasAi: files.includes('artwork.ai'), psdLayers: hasPsd ? await psdLayerCountOfFile(path.join(out, 'artwork.psd')) : null,
      reportedOk, notes, exitCode,
    });
    await update(job.id, { status: verdict.status, message: verdict.message, layers: verdict.layers, hasPreview, files });
  }

  /* ---------- skills: read on every request so a change (in the app or by hand) applies to the next job ---------- */

  async function skillsState(): Promise<SkillsState> {
    const [{ map, error }, installed] = await Promise.all([readSkillMap(skillsFile), listSkills(skillDirs())]);
    return { map, installed, fileError: error };
  }

  /** Changes to skills.json run one at a time, so two quick edits can't overwrite each other. */
  let mapLock: Promise<unknown> = Promise.resolve();
  function withMapLock<T>(work: () => Promise<T>): Promise<T> {
    const run = mapLock.then(work, work);
    mapLock = run.catch(() => undefined);
    return run;
  }

  /** One job at a time: Photoshop and Illustrator are single shared apps. */
  async function pump(): Promise<void> {
    if (busy || runner === 'off') return;
    const id = queue.shift();
    const job = id ? jobs.get(id) : undefined;
    if (!job) return;
    busy = true;
    try {
      await update(job.id, { status: 'running', message: null });
      await runJob(job);
    } catch (e) {
      await update(job.id, { status: 'failed', message: `Bridge error: ${e instanceof Error ? e.message : 'unknown'}` });
    } finally {
      busy = false;
      void pump();
    }
  }

  async function createJob(job: ProductionJob): Promise<StoredJob> {
    const id = randomBytes(6).toString('hex');
    const dir = path.join(jobsDir, id);
    await fs.mkdir(path.join(dir, 'output'), { recursive: true });
    const { reference, ...rest } = job;
    if (reference) await fs.writeFile(path.join(dir, `reference.${reference.ext}`), Buffer.from(reference.base64, 'base64'));
    await fs.writeFile(
      path.join(dir, 'job.json'),
      JSON.stringify({ ...rest, reference: reference ? { file: `reference.${reference.ext}`, role: reference.role } : null }, null, 2),
    );
    const createdAt = Date.now();
    const mode = job.handmade?.mode ?? null;
    const briefExcerpt = job.brief === '' && mode ? 'Exact copy of the client’s original' : job.brief.length > 140 ? `${job.brief.slice(0, 140)}…` : job.brief;
    const base = { id, dir, createdAt, styleName: job.styleName, skills: job.skills, ratio: job.ratio, templateTitle: job.templateTitle, briefExcerpt, runner, handmade: mode, layers: null, hasPreview: false };

    // Strict hand-made: no agent at all. The sheet is built from the designer's notes and the skill's text.
    if (mode === 'strict') {
      const skillName = job.skills[0]?.name ?? HAND_MADE_SKILL;
      const sheet = handmadeJobSheet(job, { id, createdAt, skillName, skillText: await readSkillText(skillDirs(), skillName), referenceFile: reference ? `reference.${reference.ext}` : null });
      await fs.writeFile(path.join(dir, 'output', JOB_SHEET), sheet);
      const stored: StoredJob = { ...base, status: 'done', message: 'Job sheet ready. A designer draws this by hand — no AI was used for this job.', files: [JOB_SHEET] };
      jobs.set(id, stored);
      await save(stored);
      return stored;
    }

    await fs.writeFile(path.join(dir, 'prompt.txt'), mode === 'agent' ? buildHandmadePrompt(job, dir) : buildAgentPrompt(job, dir));
    const stored: StoredJob = { ...base, status: 'queued', message: runner === 'off' ? 'Saved. It will not start until a runner is available.' : null, files: [] };
    jobs.set(id, stored);
    await save(stored);
    if (runner !== 'off') {
      queue.push(id);
      void pump();
    }
    return stored;
  }

  async function handle(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/api/production/')) return next();
    if (!isLocalRequest(req)) return send(res, 403, { error: 'The production bridge only accepts requests from this computer.' });
    await ready;
    const route = url.slice('/api/production/'.length);

    if (req.method === 'GET' && route === 'health') {
      const health: BridgeHealth = { online: true, runner, detail };
      return send(res, 200, health);
    }
    if (req.method === 'GET' && route === 'skills') {
      return send(res, 200, await skillsState());
    }
    if (req.method === 'GET' && route === 'jobs') {
      const list: JobView[] = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(({ dir: _dir, ...view }) => view);
      return send(res, 200, { jobs: list });
    }

    if (req.method !== 'POST' || !['jobs', 'skills/assign', 'skills/add'].includes(route)) return handleFiles(req, res, route);
    // Every POST is JSON. Browsers can't send JSON to another site without asking first, which blocks other websites.
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'Send JSON.' });
    let body: unknown;
    try {
      body = await readJson(req);
    } catch (e) {
      const tooLarge = e instanceof Error && e.message === 'too-large';
      return send(res, tooLarge ? 413 : 400, { error: tooLarge ? 'The request is too large.' : 'The request is not valid JSON.' });
    }

    if (route === 'skills/assign') {
      return withMapLock(async () => {
        const { map, installed } = await skillsState();
        const changed = applySkillChange(map, body, new Set(installed.map((s) => s.name)));
        if (!changed.ok) return send(res, 400, { error: changed.error });
        await writeSkillMap(skillsFile, changed.map);
        send(res, 200, await skillsState());
      });
    }

    if (route === 'skills/add') {
      const b = (body ?? {}) as { content?: unknown; useFor?: unknown };
      const parsed = typeof b.content === 'string' ? parseSkillFile(b.content) : { ok: false as const, error: 'Add the SKILL.md text.' };
      if (!parsed.ok) return send(res, 400, { error: parsed.error });
      return withMapLock(async () => {
        const before = await skillsState();
        if (before.installed.some((s) => s.name === parsed.name)) {
          return send(res, 409, { error: `A skill called “${parsed.name}” is already installed. Pick it from the lists below, or change the name: line in the file.` });
        }
        try {
          await installSkill(skillInstallDir(), parsed.name, b.content as string);
        } catch (e) {
          return send(res, 409, { error: e instanceof Error ? e.message : 'The skill could not be added.' });
        }
        let note: string | null = null;
        if (b.useFor && typeof b.useFor === 'object') {
          const after = await skillsState();
          const changed = applySkillChange(after.map, { ...(b.useFor as object), skill: parsed.name }, new Set(after.installed.map((s) => s.name)));
          if (changed.ok) await writeSkillMap(skillsFile, changed.map);
          else note = `Added, but not assigned: ${changed.error}`;
        }
        send(res, 201, { ...(await skillsState()), added: parsed.name, note });
      });
    }

    // POST jobs
    const { map, installed } = await skillsState();
    const checked = validateJobRequest(map, body);
    if (!checked.ok) return send(res, 400, { error: checked.errors.join(' ') });
    // A real agent can't draw with a skill that isn't installed — say so now instead of failing later.
    // (A strict hand-made job runs no agent, so a missing skill only means its steps are left out of the sheet.)
    if (runner === 'claude' && checked.job.handmade?.mode !== 'strict') {
      const have = new Set(installed.map((s) => s.name));
      const missing = checked.job.skills.filter((s) => skillStatus(s.name, have) === 'missing').map((s) => `“${s.name}”`);
      if (missing.length > 0) {
        return send(res, 409, { error: `The skill ${missing.join(' and ')} is not installed on this computer, so this can’t be drawn yet. Pick another one on the Skills screen.` });
      }
    }
    const { dir: _dir, ...view } = await createJob(checked.job);
    return send(res, 201, { job: view });
  }

  async function handleFiles(req: IncomingMessage, res: ServerResponse, route: string): Promise<void> {
    const preview = /^jobs\/([a-z0-9]+)\/preview$/.exec(route);
    if (req.method === 'GET' && preview && JOB_ID.test(preview[1])) {
      const job = jobs.get(preview[1]);
      const file = job ? path.join(job.dir, 'output', 'preview.png') : null;
      if (!file || !(await exists(file))) return send(res, 404, { error: 'No preview for this job.' });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      createReadStream(file).pipe(res);
      return;
    }
    // Only fixed file names (the two sources and the hand-made job sheet) can ever be served — no paths from the request reach the disk.
    const download = /^jobs\/([a-z0-9]+)\/files\/([a-z.-]+)$/.exec(route);
    if (req.method === 'GET' && download && JOB_ID.test(download[1])) {
      const name = DOWNLOAD_FILES.find((f) => f === download[2]);
      const job = jobs.get(download[1]);
      const file = job && name ? path.join(job.dir, 'output', name) : null;
      if (!file || !name || !(await exists(file))) return send(res, 404, { error: 'That file is not there.' });
      const base = (job?.templateTitle ?? 'artwork').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artwork';
      res.statusCode = 200;
      res.setHeader('Content-Type', name.endsWith('.psd') ? 'image/vnd.adobe.photoshop' : name.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'application/postscript');
      res.setHeader('Content-Disposition', `attachment; filename="${base}-${download[1]}${path.extname(name)}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      createReadStream(file).pipe(res);
      return;
    }
    return send(res, 404, { error: 'Not found.' });
  }

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    handle(req, res, next).catch(() => send(res, 500, { error: 'The production bridge hit an unexpected error.' }));
  };

  return {
    name: 'lumora-production-bridge',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
