import { test, expect, type Page } from '@playwright/test';

// These tests run against the real dev server and its production bridge, with the demo runner
// (LUMORA_RUNNER=mock in playwright.config.ts) so no real agent is ever started.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
/** A minimal layered PSD (header + layer count only), like the demo runner's. */
const psd = (layers: number) => {
  const b = Buffer.alloc(26 + 4 + 4 + 10);
  b.write('8BPS', 0, 'latin1');
  b.writeUInt16BE(1, 4);
  b.writeUInt16BE(3, 12);
  b.writeUInt32BE(64, 14);
  b.writeUInt32BE(64, 18);
  b.writeUInt16BE(8, 22);
  b.writeUInt16BE(3, 24);
  b.writeUInt32BE(6, 34);
  b.writeUInt32BE(2, 38);
  b.writeInt16BE(layers, 42);
  return b;
};
const h1 = (page: Page, name: RegExp) => page.getByRole('heading', { level: 1, name });
const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
};
const thumbsHaveSize = async (page: Page, selector: string, min: number) => {
  const thumbs = await page.locator(selector).all();
  expect(thumbs.length).toBeGreaterThan(0);
  for (const t of thumbs) expect((await t.boundingBox())?.height ?? 0).toBeGreaterThan(min);
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('the whole job: choose artwork → brief → send → finished in Jobs', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // Step 1
  await expect(h1(page, /what does the client need/i)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('button')).toHaveText(['New artwork', 'Jobs', 'Skills']);
  await expect(page.getByRole('tab', { name: /3D Artwork/ })).toBeDisabled();
  await thumbsHaveSize(page, '.artwork-card [data-thumb]', 60);
  await noOverflow(page);

  await page.getByRole('tab', { name: 'Characters & VTubers' }).click();
  const cards = page.getByRole('list', { name: 'Artwork' }).getByRole('button');
  await expect(cards).toHaveCount(8);
  await cards.filter({ hasText: 'Mascot Character' }).click();

  // Step 2
  await expect(h1(page, /brief for mascot character/i)).toBeVisible();
  await thumbsHaveSize(page, '.style-card [data-thumb]', 60);
  await noOverflow(page);

  await page.getByRole('button', { name: /send to production/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Choose an art style.' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Write the client brief.' })).toBeVisible();

  const brief = `E2E ${Date.now()} ${isMobile ? 'm' : 'd'} — chibi fox mascot, orange and teal`;
  await page.getByRole('radio', { name: /^Chibi/ }).click();
  await page.getByLabel(/paste the client’s brief/i).fill(brief);
  await page.getByLabel(/mascot name/i).fill('Blaze');
  await page.locator('input[type=file]').setInputFiles({ name: 'client-ref.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('client-ref.png')).toBeVisible();
  await page.getByRole('button', { name: /send to production/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /reference image should be used/i }).first()).toBeVisible();
  await page.getByRole('radio', { name: 'Character reference' }).click();
  await page.getByRole('radiogroup', { name: 'Size' }).getByRole('radio', { name: 'Portrait', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Checklist' })).toContainText('Portrait · 1080 × 1350');

  // The unfinished brief survives a reload (except the uploaded image, which is never stored).
  await page.reload();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByLabel(/paste the client’s brief/i)).toHaveValue(brief);
  await expect(page.getByRole('radio', { name: /^Chibi/ })).toHaveAttribute('aria-checked', 'true');
  await page.locator('input[type=file]').setInputFiles({ name: 'client-ref.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('radio', { name: 'Character reference' }).click();

  await page.getByRole('button', { name: /send to production/i }).click();

  // Step 3
  await expect(h1(page, /^jobs$/i)).toBeVisible();
  const job = page.getByRole('list', { name: 'Jobs' }).getByRole('listitem').filter({ hasText: brief });
  await expect(job).toBeVisible();
  await expect(job).toContainText('Mascot Character');
  await expect(job).toHaveAttribute('data-status', 'done', { timeout: 15000 });
  await expect(job).toContainText(/no artwork was made/i);
  await expect(job).toContainText('2d-artwork-photoshop-illustrator');

  // The layered source is judged by the bridge (layer count read from the PSD) and can be downloaded.
  const psd = job.getByRole('link', { name: /download layered psd/i });
  await expect(psd).toContainText('3 layers');
  const href = await psd.getAttribute('href');
  const file = await page.request.get(href!);
  expect(file.status()).toBe(200);
  expect(file.headers()['content-disposition']).toMatch(/^attachment; filename="mascot-character-[a-z0-9]{12}\.psd"$/);
  expect((await file.body()).subarray(0, 4).toString('latin1')).toBe('8BPS');
  await noOverflow(page);

  // The brief is cleared for the next client.
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'New artwork' }).click();
  await expect(page.getByText(/unfinished brief/i)).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('search finds artwork by the words people use', async ({ page }) => {
  const box = page.getByRole('searchbox', { name: 'Search artwork' });
  await box.fill('brb');
  await expect(page.getByRole('list', { name: 'Search results' }).getByRole('button').first()).toContainText('BRB Screen');
  await box.fill('qqqqzz');
  await expect(page.getByText(/nothing matches/i)).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByRole('list', { name: 'Artwork' })).toBeVisible();
});

test('the brief shows the dedicated skills for the chosen style and artwork', async ({ page }) => {
  await page.getByRole('tab', { name: 'Characters & VTubers' }).click();
  await page.getByRole('list', { name: 'Artwork' }).getByRole('button').filter({ hasText: 'VTuber Model Art' }).click();
  await page.getByRole('radio', { name: /^Vector Artwork/ }).click();
  const drawnWith = page.getByRole('list', { name: 'Drawn with' });
  await expect(drawnWith.getByRole('listitem')).toHaveText([/Art style\s*2dvector-photoshop-illustrator-salik/, /Artwork\s*vtuber-master/]);
});

test('a designer adds their own skill, uses it for a style, and changes the default skill', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const nav = page.getByRole('navigation', { name: 'Primary' });
  const toast = page.locator('.toast');
  const name = `e2e-${isMobile ? 'm' : 'd'}-${Date.now()}`;
  const skillFile = `---\nname: ${name}\ndescription: Test pixel style made by the E2E run.\n---\n\n# Pixel\n`;

  await nav.getByRole('button', { name: 'Skills' }).click();
  await expect(h1(page, /^skills$/i)).toBeVisible();
  await expect(page.getByRole('table', { name: 'Artwork types' }).getByRole('row')).toHaveCount(45);
  const defaultPick = page.getByRole('combobox', { name: 'Default skill' });
  await expect(defaultPick).toHaveValue('2d-artwork-photoshop-illustrator');
  await noOverflow(page);

  // Add: upload the SKILL.md, see what it is, say where to use it, add.
  const add = page.getByRole('region', { name: 'Add a skill' });
  await expect(add.getByRole('button', { name: 'Add skill' })).toBeDisabled();
  await add.getByLabel(/skill\.md file/i).setInputFiles({ name: 'SKILL.md', mimeType: 'text/markdown', buffer: Buffer.from(skillFile) });
  await expect(add.getByText(/ready to add/i)).toContainText(name);
  await add.getByRole('combobox', { name: /use it for/i }).selectOption('style:pixel-art');
  await add.getByRole('button', { name: 'Add skill' }).click();
  await expect(toast).toContainText(`Added “${name}”`);
  await expect(page.getByRole('combobox', { name: 'Skill for Pixel Art' })).toHaveValue(name);

  // It really was installed and saved by the bridge (in the test's own folder).
  const state = (await (await page.request.get('/api/production/skills')).json()) as { map: { styles: Record<string, string | null> }; installed: { name: string; description: string }[] };
  expect(state.map.styles['pixel-art']).toBe(name);
  expect(state.installed).toContainEqual({ name, description: 'Test pixel style made by the E2E run.' });

  // The brief uses it straight away.
  await nav.getByRole('button', { name: 'New artwork' }).click();
  await page.getByRole('tab', { name: 'Streaming' }).click();
  await page.getByRole('list', { name: 'Artwork' }).getByRole('button').filter({ hasText: 'Stream Overlay' }).click();
  await page.getByRole('radio', { name: /^Pixel Art/ }).click();
  await expect(page.getByRole('list', { name: 'Drawn with' })).toContainText(name);

  // The default skill can be changed, and put back.
  await nav.getByRole('button', { name: 'Skills' }).click();
  await page.getByRole('combobox', { name: 'Default skill' }).selectOption(name);
  await expect(toast).toContainText(`Default skill is now ${name}`);
  await expect(page.getByRole('combobox', { name: 'Skill for Manga' }).locator('option').first()).toHaveText(`Default skill (${name})`);
  await page.getByRole('combobox', { name: 'Default skill' }).selectOption('2d-artwork-photoshop-illustrator');
  await expect(toast).toContainText('Default skill is now 2d-artwork-photoshop-illustrator');
  await page.getByRole('combobox', { name: 'Skill for Pixel Art' }).selectOption('');
  await expect(toast).toContainText('Pixel Art now uses the default skill');

  // Adding the same name again is refused with a clear reason.
  await add.getByLabel(/or paste/i).fill(skillFile);
  await add.getByRole('button', { name: 'Add skill' }).click();
  await expect(add.getByRole('alert')).toContainText(/already installed/i);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('hand-made: the original + the designer’s changes become a job sheet, with no agent and no artwork', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const extra = `Gold rim ${isMobile ? 'm' : 'd'} ${Date.now()}`;

  await page.getByRole('tab', { name: 'Hand-made' }).click();
  await page.getByRole('list', { name: 'Artwork' }).getByRole('button').filter({ hasText: 'Hand-made Emblem' }).click();
  await expect(h1(page, /brief for hand-made emblem/i)).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Art style' })).toHaveCount(0);
  await noOverflow(page);

  await page.getByRole('button', { name: /send to production/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Add the client’s original design' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Something to add' }).fill(extra);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('textbox', { name: 'Something to take out' }).fill('The small tagline');
  await page.getByRole('textbox', { name: 'Something to take out' }).press('Enter');
  await expect(page.getByRole('list', { name: 'Take out of the design' }).getByRole('listitem')).toHaveCount(1);
  await page.locator('input[type=file]').setInputFiles({ name: 'machine-corps.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: /send to production/i }).click();

  await expect(h1(page, /^jobs$/i)).toBeVisible();
  const job = page.getByRole('list', { name: 'Jobs' }).getByRole('listitem').filter({ hasText: 'Hand-made Emblem' }).first();
  await expect(job).toHaveAttribute('data-status', 'done');
  await expect(job).toContainText(/no ai was used/i);
  await expect(job.getByRole('link', { name: /psd|illustrator/i })).toHaveCount(0);
  const href = await job.getByRole('link', { name: 'Download job sheet' }).getAttribute('href');
  const sheet = await page.request.get(href!);
  expect(sheet.status()).toBe(200);
  expect(sheet.headers()['content-type']).toMatch(/^text\/markdown/);
  const text = await sheet.text();
  expect(text).toContain('No AI was used to prepare this job sheet');
  expect(text).toContain(`- Add: ${extra}`);
  expect(text).toContain('- Remove: The small tagline');
  expect(text).toMatch(/## The skill: hand-made/);

  // The designer draws it by hand, then hands in the layered PSD on the same job.
  await expect(job.getByText('Hand in the finished artwork')).toBeVisible();
  const drawn = psd(5);
  await job.getByLabel('Upload layered PSD').setInputFiles({ name: 'emblem-final.psd', mimeType: 'image/vnd.adobe.photoshop', buffer: drawn });
  const psdLink = job.getByRole('link', { name: /download layered psd/i });
  await expect(psdLink).toContainText('5 layers');
  await expect(job).toContainText(/handed in/i);
  const back = await page.request.get((await psdLink.getAttribute('href'))!);
  expect(back.status()).toBe(200);
  expect(Buffer.compare(await back.body(), drawn)).toBe(0);
  await job.getByLabel('Upload Illustrator file').setInputFiles({ name: 'emblem-final.ai', mimeType: 'application/postscript', buffer: PNG });
  await expect(job.getByRole('alert')).toHaveText('This is not an Illustrator file (.ai).');
  await expect(job.getByRole('link', { name: /download illustrator file/i })).toHaveCount(0);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('a hand-in is checked from its real bytes and only hand-made jobs take one', async ({ request }) => {
  const made = await request.post('/api/production/jobs', {
    data: { templateId: 'handmade-logo', brief: '', handmadeMode: 'strict', changes: { add: [], remove: [] }, reference: { dataUrl: `data:image/png;base64,${PNG.toString('base64')}`, role: 'Original to redraw' } },
  });
  expect(made.status()).toBe(201);
  const { job } = (await made.json()) as { job: { id: string } };
  const handIn = (kind: string, data: Buffer, headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' }, id = job.id) =>
    request.post(`/api/production/jobs/${id}/hand-in/${kind}`, { data, headers });

  const flat = await handIn('psd', psd(1));
  expect(flat.status()).toBe(400);
  expect(((await flat.json()) as { error: string }).error).toMatch(/flattened/);
  expect((await handIn('psd', PNG)).status()).toBe(400);
  expect((await handIn('psd', Buffer.alloc(0))).status()).toBe(400);
  expect((await handIn('psd', psd(4), { 'Content-Type': 'text/plain' })).status()).toBe(415);
  expect((await handIn('psd', psd(4), { 'Content-Type': 'application/octet-stream', Origin: 'https://evil.example' })).status()).toBe(403);
  expect((await handIn('png', psd(4))).status()).toBe(404);
  expect((await handIn('psd', psd(4), undefined, 'zzzzzzzzzzzz')).status()).toBe(404);
  expect((await request.get(`/api/production/jobs/${job.id}/files/artwork.psd`)).status()).toBe(404);

  const pdfAi = Buffer.from('%PDF-1.6 % Illustrator test file');
  const ok = await handIn('ai', pdfAi);
  expect(ok.status()).toBe(200);
  expect(((await ok.json()) as { job: { files: string[] } }).job.files).toEqual(['artwork.ai', 'handmade-job-sheet.md']);
  expect((await (await request.get(`/api/production/jobs/${job.id}/files/artwork.ai`)).body()).toString()).toBe(pdfAi.toString());

  // A normal agent job never takes a hand-in: its files come from the agent and are judged on their own.
  const agentJob = await request.post('/api/production/jobs', { data: { styleId: 'chibi', ratio: 'Square', brief: `hand-in guard ${Date.now()}`, templateId: 'mascot' } });
  const { job: other } = (await agentJob.json()) as { job: { id: string } };
  await expect.poll(async () => ((await (await request.get('/api/production/jobs')).json()) as { jobs: { id: string; status: string }[] }).jobs.find((j) => j.id === other.id)?.status, { timeout: 15000 }).toBe('done');
  expect((await handIn('psd', psd(4), undefined, other.id)).status()).toBe(409);
});

test('the skills API refuses bad input and other websites', async ({ request }) => {
  const assign = (data: unknown, headers: Record<string, string> = {}) => request.post('/api/production/skills/assign', { data, headers });
  expect((await assign({ kind: 'style', id: 'manga', skill: 'not-installed-anywhere-zz' })).status()).toBe(400);
  expect((await assign({ kind: 'style', id: '../../x', skill: null })).status()).toBe(400);
  expect((await assign({ kind: 'default', skill: null })).status()).toBe(400);
  expect((await assign({ kind: 'style', id: 'manga', skill: null }, { Origin: 'https://evil.example' })).status()).toBe(403);
  const add = (content: string) => request.post('/api/production/skills/add', { data: { content } });
  expect((await add('---\nname: ../../evil\ndescription: x\n---\n')).status()).toBe(400);
  expect((await add('no front matter')).status()).toBe(400);
  const plain = await request.post('/api/production/skills/add', { data: '---\nname: x\n---', headers: { 'Content-Type': 'text/plain' } });
  expect(plain.status()).toBe(415);
});

test('the production bridge refuses bad input and other websites', async ({ request }) => {
  const bad = await request.post('/api/production/jobs', { data: { styleId: '../../x', ratio: 'Square', brief: 'x' } });
  expect(bad.status()).toBe(400);
  const foreign = await request.post('/api/production/jobs', { data: { styleId: 'chibi', ratio: 'Square', brief: 'x' }, headers: { Origin: 'https://evil.example' } });
  expect(foreign.status()).toBe(403);
  expect((await request.get('/api/production/jobs/zzzzzzzzzzzz/preview')).status()).toBe(404);
  expect((await request.get('/api/production/skills', { headers: { Origin: 'https://evil.example' } })).status()).toBe(403);
});

test('only the layered source files and the hand-made job sheet can ever be downloaded', async ({ request }) => {
  const made = await request.post('/api/production/jobs', { data: { styleId: 'chibi', ratio: 'Square', brief: `download guard ${Date.now()}`, templateId: 'mascot' } });
  expect(made.status()).toBe(201);
  const { job } = (await made.json()) as { job: { id: string } };
  await expect.poll(async () => ((await (await request.get('/api/production/jobs')).json()) as { jobs: { id: string; status: string }[] }).jobs.find((j) => j.id === job.id)?.status, { timeout: 15000 }).toBe('done');

  expect((await request.get(`/api/production/jobs/${job.id}/files/artwork.psd`)).status()).toBe(200);
  for (const evil of ['job.json', 'prompt.txt', 'result.json', '..%2Fjob.json', '..%2F..%2Fpackage.json', 'artwork.psd%00.png']) {
    expect((await request.get(`/api/production/jobs/${job.id}/files/${evil}`)).status(), evil).toBe(404);
  }
  expect((await request.get('/api/production/jobs/zzzzzzzzzzzz/files/artwork.psd')).status()).toBe(404);
});
