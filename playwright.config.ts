import { copyFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Tests change skills, so they get their own copy of the skill map and their own install folder:
// your real production/skills.json and ~/.claude/skills are never written to.
// (Made once; worker processes inherit LUMORA_E2E_DIR and reuse it.)
if (!process.env.LUMORA_E2E_DIR) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lumora-e2e-'));
  mkdirSync(path.join(dir, 'skills'));
  copyFileSync('production/skills.json', path.join(dir, 'skills.json'));
  process.env.LUMORA_E2E_DIR = dir;
}
const e2eDir = process.env.LUMORA_E2E_DIR;

// Uses the system Google Chrome by default so no browser download is needed.
// Override with PW_CHANNEL=msedge, or PW_CHANNEL= (empty) after `npx playwright install chromium`.
const channel = process.env.PW_CHANNEL ?? 'chrome';
const ch = channel ? { channel } : {};
// Port for the test copy of the studio; set E2E_PORT if 5174 is taken.
const port = Number(process.env.E2E_PORT ?? 5174);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  // One at a time: the skill map is shared by every test, and some tests change it.
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...ch } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, ...ch } },
  ],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    // Never start a real agent from tests: the demo runner writes a placeholder instead.
    env: {
      LUMORA_RUNNER: 'mock',
      LUMORA_JOBS_DIR: 'test-results/production-jobs',
      LUMORA_SKILLS_FILE: path.join(e2eDir, 'skills.json'),
      LUMORA_SKILLS_INSTALL_DIR: path.join(e2eDir, 'skills'),
    },
    timeout: 60_000,
  },
});
