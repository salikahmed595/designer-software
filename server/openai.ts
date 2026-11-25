/**
 * OpenAI concept generation (dev server only, this computer only). The concept is reference only.
 *
 * The key comes from OPENAI_API_KEY, or from a key file (LUMORA_OPENAI_KEY_FILE, else the repo root .env.txt or .env,
 * else the app's .env). It is held in memory for one request, never written to job files, logs, prompts or replies,
 * and every error text is passed through redact() before anyone sees it.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

type Env = Record<string, string | undefined>;

const KEY_RE = /sk-[A-Za-z0-9_-]{20,}/;
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.6-sunburst';

export const redact = (text: string): string =>
  text.replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…(hidden)').replace(/Bearer\s+\S+/gi, 'Bearer …(hidden)');

/** Where a key file may be. The app runs in studio-frontend/, inside the repo. */
export function keyFiles(env: Env, appDir: string): string[] {
  const own = env.LUMORA_OPENAI_KEY_FILE?.trim();
  const repo = path.dirname(path.resolve(appDir));
  return [...(own ? [path.resolve(own)] : []), path.join(repo, '.env.txt'), path.join(repo, '.env'), path.join(path.resolve(appDir), '.env')];
}

/** The key and where it came from (a description without the key), or null. */
export async function readOpenAiKey(env: Env, files: string[]): Promise<{ key: string; source: string } | null> {
  const fromEnv = env.OPENAI_API_KEY?.trim();
  if (fromEnv && KEY_RE.test(fromEnv)) return { key: KEY_RE.exec(fromEnv)![0], source: 'environment variable OPENAI_API_KEY' };
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    const m = text ? KEY_RE.exec(text) : null;
    if (m) return { key: m[0], source: `file ${path.basename(file)}` };
  }
  return null;
}

export type ConceptImage = { ok: true; png: Buffer; model: string } | { ok: false; error: string };

export async function generateConceptImage(o: {
  key: string; prompt: string; size: string; model: string; quality?: string; fetch?: typeof fetch; timeoutMs?: number;
}): Promise<ConceptImage> {
  const doFetch = o.fetch ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 5 * 60 * 1000);
  try {
    let res: Response;
    try {
      res = await doFetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: o.model, prompt: o.prompt, size: o.size, quality: o.quality ?? 'medium', n: 1 }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (ctrl.signal.aborted) return { ok: false, error: 'OpenAI did not answer in time. Try again.' };
      return { ok: false, error: redact(`Could not reach OpenAI: ${e instanceof Error ? e.message : 'network error'}`) };
    }
    const body = (await res.json().catch(() => null)) as { data?: Array<{ b64_json?: unknown }>; error?: { message?: unknown } } | null;
    if (!res.ok) {
      const msg = typeof body?.error?.message === 'string' ? body.error.message : 'no details';
      return { ok: false, error: redact(`OpenAI refused the concept request (HTTP ${res.status}): ${msg.slice(0, 400)}`) };
    }
    const b64 = body?.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: 'OpenAI answered without an image.' };
    return { ok: true, png: Buffer.from(b64, 'base64'), model: o.model };
  } finally {
    clearTimeout(timer);
  }
}
