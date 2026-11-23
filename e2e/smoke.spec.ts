import { test, expect, type Page } from '@playwright/test';

const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
};
const h1 = (page: Page, name: RegExp) => page.getByRole('heading', { level: 1, name });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('browse-first: category → artwork → customize → brief, no overflow on any screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await expect(h1(page, /what would you like to create/i)).toBeVisible();
  await noOverflow(page);

  const categories = page.getByRole('list', { name: 'Artwork categories' }).getByRole('button');
  await expect(categories).toHaveCount(6);
  await expect(categories.filter({ hasText: 'Animation' })).toBeDisabled();

  await categories.filter({ hasText: 'Streaming' }).click();
  await expect(h1(page, /choose your streaming artwork/i)).toBeVisible();
  await noOverflow(page);

  // Every artwork card shows a real, sized thumbnail.
  const cards = page.getByRole('list', { name: 'Streaming artwork' }).getByRole('button');
  await expect(cards).toHaveCount(8);
  for (const thumb of await cards.locator('svg[data-thumb]').all()) {
    const box = await thumb.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(60);
    expect(box?.width ?? 0).toBeGreaterThan(90);
  }

  await cards.filter({ hasText: 'Webcam Frame' }).click();
  await expect(h1(page, /customize webcam frame/i)).toBeVisible();
  await noOverflow(page);
  await expect(page.locator('details.advanced')).not.toHaveAttribute('open', '');

  await page.getByRole('radio', { name: 'Ocean' }).click();
  await page.getByLabel(/name on the tag/i).fill('NightWolf');
  await expect(page.getByLabel('Summary')).toContainText('Webcam Frame · Cyberpunk · Ocean');
  await expect(page.getByRole('button', { name: /create artwork/i })).toBeInViewport();

  await page.getByRole('button', { name: /create artwork/i }).click();
  await expect(h1(page, /your artwork brief is ready/i)).toBeVisible();
  await expect(page.getByRole('note')).toContainText(/no artwork has been made yet/i);
  await noOverflow(page);

  // Going back to edit keeps the inputs, and the brief survives a reload (saved on this device).
  await page.getByRole('button', { name: /edit artwork brief/i }).click();
  await expect(page.getByLabel(/name on the tag/i)).toHaveValue('NightWolf');
  await page.reload();
  await page.getByRole('list', { name: 'Artwork categories' }).getByRole('button').filter({ hasText: 'Streaming' }).click();
  await page.getByRole('list', { name: 'Streaming artwork' }).getByRole('button').filter({ hasText: 'Webcam Frame' }).click();
  await expect(page.getByLabel(/name on the tag/i)).toHaveValue('NightWolf');
  await expect(page.getByRole('radio', { name: 'Ocean' })).toHaveAttribute('aria-checked', 'true');

  expect(errors).toEqual([]);
});

test('prompt-first: confident idea is matched, ambiguous idea asks', async ({ page }) => {
  const prompt = page.getByLabel(/describe your idea/i);
  await prompt.fill('Purple Twitch webcam border');
  await page.getByRole('button', { name: /find my artwork/i }).click();
  await expect(h1(page, /customize webcam frame/i)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Violet' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Lumora home' }).click();
  await prompt.fill('Discord dragon art');
  await page.getByRole('button', { name: /find my artwork/i }).click();
  await expect(h1(page, /your idea could become/i)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Suggested artwork' }).getByRole('button')).toHaveCount(3);
  await noOverflow(page);
});

test('search finds artwork by synonym', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search all artwork' }).fill('brb');
  await expect(page.getByRole('list', { name: 'Search results' }).getByRole('button').first()).toContainText('BRB Screen');
  await page.getByRole('searchbox', { name: 'Search all artwork' }).fill('qqqqzz');
  await expect(page.getByText(/couldn't find an exact match/i)).toBeVisible();
});

test('production: style + brief + reference + ratio reaches the bridge and the job completes (demo runner)', async ({ page, isMobile, request }) => {
  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Production' }).click();
  } else await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Production' }).click();
  await expect(h1(page, /send to production/i)).toBeVisible();
  await expect(page.getByText(/demo runner: jobs finish with a placeholder/i)).toBeVisible();
  await noOverflow(page);

  for (const thumb of await page.locator('.style-card svg[data-thumb]').all()) {
    expect((await thumb.boundingBox())?.height ?? 0).toBeGreaterThan(60);
  }

  const brief = `E2E ${Date.now()} ${isMobile ? 'm' : 'd'} — chibi fox mascot, orange and teal`;
  await page.getByRole('radio', { name: /chibi/i }).click();
  await page.getByLabel(/client brief/i).fill(brief);
  await page.locator('input[type=file]').setInputFiles({
    name: 'client-ref.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.getByText('client-ref.png')).toBeVisible();
  await page.getByRole('button', { name: /send to production/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /reference image should be used/i }).first()).toBeVisible();
  await page.getByRole('radio', { name: 'Character reference' }).click();
  await page.getByRole('radiogroup', { name: 'Ratio' }).getByRole('radio', { name: 'Portrait', exact: true }).click();
  await page.getByRole('button', { name: /send to production/i }).click();

  const job = page.getByRole('list', { name: 'Production jobs' }).getByRole('listitem').filter({ hasText: brief });
  await expect(job).toBeVisible();
  await expect(job).toHaveAttribute('data-status', 'done', { timeout: 15000 });
  await expect(job).toContainText(/no artwork was made/i);
  await expect(job).toContainText('2d-artwork-photoshop-illustrator');
  await noOverflow(page);

  // The bridge refuses bad input, and requests that do not come from this computer.
  const bad = await request.post('/api/production/jobs', { data: { styleId: '../../x', ratio: 'Square', brief: 'x' } });
  expect(bad.status()).toBe(400);
  const foreign = await request.post('/api/production/jobs', { data: { styleId: 'chibi', ratio: 'Square', brief: 'x' }, headers: { Origin: 'https://evil.example' } });
  expect(foreign.status()).toBe(403);
});

test('tools stay reachable and the classic generator still works', async ({ page, isMobile }) => {
  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
  else await page.getByRole('button', { name: /^tools/i }).click();
  await page.getByRole('menuitem', { name: 'Image' }).click();
  await expect(h1(page, /image generator/i)).toBeVisible();
  await noOverflow(page);

  const generate = page.getByRole('button', { name: /^generate/i });
  await expect(generate).toBeDisabled();
  await page.getByLabel(/describe the image/i).fill('a lighthouse at dusk');
  await generate.click();
  const first = page.getByRole('list', { name: 'Generation sessions' }).getByRole('listitem').first();
  await expect(first).toHaveAttribute('aria-busy', 'true');
  await expect(first).toHaveAttribute('aria-busy', 'false', { timeout: 6000 });
  await expect(page.getByText('19 AI credits')).toBeVisible();

  await page.getByRole('button', { name: /visual style:/i }).click();
  await expect(page.getByRole('dialog', { name: /apply visual style/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
