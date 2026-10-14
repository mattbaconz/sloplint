import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const external = process.env.SLOPLINT_URL;

export default defineConfig({
  testDir: '.',
  testMatch: 'verify-dom.spec.ts',
  outputDir: '../test-results',
  reporter: [['list']],
  use: {
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
  },
  webServer: external
    ? undefined
    : {
        command: 'node scripts/serve.mjs 4173',
        url: 'http://localhost:4173/site/',
        reuseExistingServer: true,
        cwd: fileURLToPath(new URL('..', import.meta.url)),
      },
});
