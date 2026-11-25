import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateConceptImage, keyFiles, readOpenAiKey, redact } from './openai';

const FAKE = 'sk-test-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd';
let tmp: string;
beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'lumora-openai-'));
});
afterAll(() => fs.rm(tmp, { recursive: true, force: true }));

describe('reading the OpenAI key (never returned to the browser, never logged)', () => {
  it('prefers the OPENAI_API_KEY environment variable', async () => {
    expect(await readOpenAiKey({ OPENAI_API_KEY: FAKE }, [])).toEqual({ key: FAKE, source: 'environment variable OPENAI_API_KEY' });
  });

  it.each([
    ['name form (.env.txt)', `openai: ${FAKE}\n`],
    ['dotenv form', `# comment\nOTHER=1\nOPENAI_API_KEY="${FAKE}"\n`],
    ['bare key', `${FAKE}\n`],
    ['with BOM and CRLF', `\uFEFFmy key: ${FAKE}\r\n`],
  ])('reads a key file in the %s', async (_label, text) => {
    const file = path.join(tmp, `k-${Math.random().toString(36).slice(2)}.txt`);
    await fs.writeFile(file, text);
    const r = await readOpenAiKey({}, [path.join(tmp, 'missing.txt'), file]);
    expect(r?.key).toBe(FAKE);
    expect(r?.source).toBe(`file ${path.basename(file)}`);
    expect(r?.source).not.toContain('sk-');
  });

  it('returns null when there is no key', async () => {
    const file = path.join(tmp, 'empty.txt');
    await fs.writeFile(file, 'nothing here');
    expect(await readOpenAiKey({}, [file])).toBeNull();
  });

  it('looks in LUMORA_OPENAI_KEY_FILE, then the repo root .env.txt / .env, then the app .env', () => {
    const files = keyFiles({ LUMORA_OPENAI_KEY_FILE: 'C:/x/key.txt' }, 'D:/repo/studio-frontend');
    expect(files.map((f) => f.replace(/\\/g, '/'))).toEqual(['C:/x/key.txt', 'D:/repo/.env.txt', 'D:/repo/.env', 'D:/repo/studio-frontend/.env']);
  });
});

describe('redacting secrets from any text that might be shown or logged', () => {
  it('removes keys and bearer tokens', () => {
    expect(redact(`Incorrect API key provided: ${FAKE}. Bearer ${FAKE}`)).not.toMatch(/ABCDEFGHIJ/);
    expect(redact('plain text')).toBe('plain text');
  });
});

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const okFetch = (seen: { url?: string; body?: Record<string, unknown>; auth?: string }) => (async (url: string | URL | Request, init?: RequestInit) => {
  seen.url = String(url);
  seen.body = JSON.parse(String(init?.body));
  seen.auth = (init?.headers as Record<string, string>).Authorization;
  return new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }), { status: 200 });
}) as typeof fetch;

describe('generating the concept with the OpenAI Images API (server-side only)', () => {
  it('posts the prompt and returns the PNG bytes', async () => {
    const seen: { url?: string; body?: Record<string, unknown>; auth?: string } = {};
    const r = await generateConceptImage({ key: FAKE, prompt: 'a fox', size: '1536x1024', model: 'gpt-image-2.6-sunburst', fetch: okFetch(seen) });
    expect(r).toEqual({ ok: true, png, model: 'gpt-image-2.6-sunburst' });
    expect(seen.url).toBe('https://api.openai.com/v1/images/generations');
    expect(seen.body).toMatchObject({ model: 'gpt-image-2.6-sunburst', prompt: 'a fox', size: '1536x1024', n: 1 });
    expect(seen.auth).toBe(`Bearer ${FAKE}`);
  });

  it('turns an API error into a plain message without the key', async () => {
    const f = (async () => new Response(JSON.stringify({ error: { message: `Incorrect API key provided: ${FAKE}` } }), { status: 401 })) as typeof fetch;
    const r = await generateConceptImage({ key: FAKE, prompt: 'x', size: '1024x1024', model: 'm', fetch: f });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/401/);
      expect(r.error).not.toContain(FAKE);
      expect(r.error).not.toMatch(/ABCDEFGHIJ/);
    }
  });

  it('handles network failures, timeouts and replies without an image', async () => {
    const boom = (async () => {
      throw new Error(`socket hang up ${FAKE}`);
    }) as typeof fetch;
    const r1 = await generateConceptImage({ key: FAKE, prompt: 'x', size: '1024x1024', model: 'm', fetch: boom });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error).not.toContain(FAKE);

    const empty = (async () => new Response(JSON.stringify({ data: [{ url: 'https://elsewhere/x.png' }] }), { status: 200 })) as typeof fetch;
    expect((await generateConceptImage({ key: FAKE, prompt: 'x', size: '1024x1024', model: 'm', fetch: empty })).ok).toBe(false);

    const slow = ((_u: unknown, init?: RequestInit) => new Promise((_r, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))) as typeof fetch;
    const r3 = await generateConceptImage({ key: FAKE, prompt: 'x', size: '1024x1024', model: 'm', fetch: slow, timeoutMs: 50 });
    expect(r3).toEqual({ ok: false, error: expect.stringMatching(/did not answer in time/) });
  });
});
