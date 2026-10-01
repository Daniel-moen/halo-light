import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// PAGES=1: build and serve under /halo-light/ like GitHub Pages.
// LIVE_URL=https://…/halo-light/: test a deployed site (no local server).
const LIVE_URL = process.env.LIVE_URL;
const BASE = process.env.PAGES ? '/halo-light/' : '/';
const build = process.env.PAGES ? 'npm run build:pages' : 'npm run build';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: LIVE_URL ?? `http://127.0.0.1:${PORT}${BASE}` },
  webServer: LIVE_URL ? undefined : {
    command: `${build} && DIST=${process.env.PAGES ? 'dist-pages' : 'dist'} BASE=${BASE} node server.mjs ${PORT} 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}${BASE}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        permissions: ['camera'],
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
      },
    },
    {
      name: 'webkit',
      testIgnore: /mobile|camera|offline/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'iphone', testMatch: /mobile/, use: { ...devices['iPhone 13'] } },
    { name: 'ipad', testMatch: /mobile/, use: { ...devices['iPad Pro 11'] } },
  ],
});
