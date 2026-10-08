import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// Keep the folder name short: long Windows paths can break SQLite. Set once so workers and teardown agree.
process.env.AP_E2E_DATA_DIR ??= path.join(os.tmpdir(), `ap-e2e-${Date.now().toString(36)}`);
const dataDir = process.env.AP_E2E_DATA_DIR;

export default defineConfig({
  testDir: 'e2e',
  globalTeardown: './e2e/teardown.js',
  use: { baseURL: 'http://127.0.0.1:4203', viewport: { width: 1400, height: 900 }, video: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && node --disable-warning=ExperimentalWarning server/index.js',
    url: 'http://127.0.0.1:4203/api/health',
    env: { APOTHECARY_DATA_DIR: dataDir, APOTHECARY_PORT: '4203' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
