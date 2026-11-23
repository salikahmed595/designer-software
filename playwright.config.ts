import { defineConfig, devices } from '@playwright/test';

// Uses the system Google Chrome by default so no browser download is needed.
// Override with PW_CHANNEL=msedge, or PW_CHANNEL= (empty) after `npx playwright install chromium`.
const channel = process.env.PW_CHANNEL ?? 'chrome';
const ch = channel ? { channel } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...ch } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, ...ch } },
  ],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    // Never start a real agent from tests: the demo runner writes a placeholder instead.
    env: { LUMORA_RUNNER: 'mock', LUMORA_JOBS_DIR: 'test-results/production-jobs' },
    timeout: 60_000,
  },
});
