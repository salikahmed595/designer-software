/**
 * Local production bridge (dev server only, this computer only).
 *
 *   POST /api/production/jobs          create a job → saved to <jobs>/<id>/, queued for the agent
 *   GET  /api/production/jobs          list jobs with status
 *   GET  /api/production/jobs/:id/preview   the exported preview.png
 *   GET  /api/production/health        which runner is active
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
  buildAgentPrompt, validateJobRequest, type BridgeHealth, type JobStatus, type JobView, type ProductionJob, type RunnerKind,
} from '../src/state/production';

const MAX_BODY_BYTES = 16 * 1024 * 1024;
const AGENT_TIMEOUT_MS = 45 * 60 * 1000;
/** The agent can draw in the Adobe apps and read/write files — no shell, no network tools. */
const ALLOWED_TOOLS = 'mcp__photoshop,mcp__illustrator,Skill,Read,Write,Edit,Glob,Grep';
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
        const view = JSON.parse(await fs.readFile(path.join(jobsDir, id, 'status.json'), 'utf8')) as JobView;
        const interrupted = view.status === 'queued' || view.status === 'running';
        jobs.set(id, { ...view, dir: path.join(jobsDir, id), ...(interrupted ? { status: 'failed' as JobStatus, message: 'Interrupted: the app was restarted before this job finished.' } : {}) });
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
      detail = 'Connected: a Claude Code agent will draw in Photoshop and Illustrator on this computer.';
    } else {
      detail = 'Claude Code was not found on this computer, so jobs are saved but cannot start. Install the Claude Code CLI or set LUMORA_CLAUDE_BIN.';
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

  async function runJob(job: StoredJob): Promise<void> {
    const out = path.join(job.dir, 'output');
    await fs.mkdir(out, { recursive: true });
    if (runner === 'mock') {
      await new Promise((r) => setTimeout(r, 700));
      await fs.writeFile(path.join(out, 'preview.png'), PLACEHOLDER_PNG);
      await update(job.id, { status: 'done', hasPreview: true, message: 'Demo runner — placeholder image. No artwork was made.' });
      return;
    }
    const prompt = await fs.readFile(path.join(job.dir, 'prompt.txt'), 'utf8');
    const code = await runProcess(claudeBin, ['-p', '--allowedTools', ALLOWED_TOOLS], job.dir, prompt, AGENT_TIMEOUT_MS, path.join(job.dir, 'agent.log'));
    const hasPreview = await exists(path.join(out, 'preview.png'));
    let notes: string | null = null;
    let reportedOk: boolean | null = null;
    try {
      const result = JSON.parse(await fs.readFile(path.join(out, 'result.json'), 'utf8')) as Record<string, unknown>;
      reportedOk = result.ok === true;
      notes = String(result.notes ?? result.reason ?? '').slice(0, 600) || null;
    } catch {
      /* the agent did not write a result file */
    }
    if (hasPreview && reportedOk !== false) await update(job.id, { status: 'done', hasPreview: true, message: notes });
    else {
      const why = notes ?? (code === null ? 'The agent could not be started or timed out.' : `The agent stopped (exit code ${code}) without exporting a preview. See agent.log in the job folder.`);
      await update(job.id, { status: 'failed', hasPreview, message: why });
    }
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
    await fs.writeFile(path.join(dir, 'prompt.txt'), buildAgentPrompt(job, dir));
    const stored: StoredJob = {
      id, dir, createdAt: Date.now(), status: 'queued', styleName: job.styleName, skill: job.skill, ratio: job.ratio, templateTitle: job.templateTitle,
      briefExcerpt: job.brief.length > 140 ? `${job.brief.slice(0, 140)}…` : job.brief, runner,
      message: runner === 'off' ? 'Saved. It will not start until a runner is available.' : null, hasPreview: false,
    };
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
    if (req.method === 'GET' && route === 'jobs') {
      const list: JobView[] = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(({ dir: _dir, ...view }) => view);
      return send(res, 200, { jobs: list });
    }
    if (req.method === 'POST' && route === 'jobs') {
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'Send JSON.' });
      let body: unknown;
      try {
        body = await readJson(req);
      } catch (e) {
        const tooLarge = e instanceof Error && e.message === 'too-large';
        return send(res, tooLarge ? 413 : 400, { error: tooLarge ? 'The request is too large.' : 'The request is not valid JSON.' });
      }
      const checked = validateJobRequest(body);
      if (!checked.ok) return send(res, 400, { error: checked.errors.join(' ') });
      const { dir: _dir, ...view } = await createJob(checked.job);
      return send(res, 201, { job: view });
    }
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
