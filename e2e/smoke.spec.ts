import { test, expect, type Page } from '@playwright/test';

// These tests run against the real dev server and its production bridge, with the demo runner
// (LUMORA_RUNNER=mock in playwright.config.ts) so no real agent is ever started.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
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
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('button')).toHaveText(['New artwork', 'Jobs']);
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

test('the brief shows the dedicated skills, and the owner can see every skill slot', async ({ page }) => {
  await page.getByRole('tab', { name: 'Characters & VTubers' }).click();
  await page.getByRole('list', { name: 'Artwork' }).getByRole('button').filter({ hasText: 'VTuber Model Art' }).click();
  await page.getByRole('radio', { name: /^Vector Artwork/ }).click();
  const drawnWith = page.getByRole('list', { name: 'Drawn with' });
  await expect(drawnWith.getByRole('listitem')).toHaveText([/Art style\s*2dvector-photoshop-illustrator-salik/, /Artwork\s*vtuber-master/]);

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Jobs' }).click();
  await page.getByRole('button', { name: 'Skill setup' }).click();
  await expect(h1(page, /skill setup/i)).toBeVisible();
  const styles = page.getByRole('table', { name: 'Art styles' });
  await expect(styles.getByRole('row', { name: /Cinematic PFP/ })).toContainText('2d-pfp');
  // Real check against this computer's installed skills — not a stub.
  await expect(styles.getByRole('row', { name: /Cinematic PFP/ }).locator('.skill-status')).toHaveText(/Installed|Not installed/);
  await expect(page.getByRole('table', { name: 'Artwork types' }).getByRole('row')).toHaveCount(41);
  await noOverflow(page);
});

test('the production bridge refuses bad input and other websites', async ({ request }) => {
  const bad = await request.post('/api/production/jobs', { data: { styleId: '../../x', ratio: 'Square', brief: 'x' } });
  expect(bad.status()).toBe(400);
  const foreign = await request.post('/api/production/jobs', { data: { styleId: 'chibi', ratio: 'Square', brief: 'x' }, headers: { Origin: 'https://evil.example' } });
  expect(foreign.status()).toBe(403);
  expect((await request.get('/api/production/jobs/zzzzzzzzzzzz/preview')).status()).toBe(404);
  expect((await request.get('/api/production/skills', { headers: { Origin: 'https://evil.example' } })).status()).toBe(403);
});

test('only the two layered source files can ever be downloaded', async ({ request }) => {
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
