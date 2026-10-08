// Stops the test server (so Windows lets go of the database file), then deletes the throwaway data folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default async function teardown() {
  const dir = process.env.AP_E2E_DATA_DIR;
  try { await fetch('http://127.0.0.1:4203/api/shutdown', { method: 'POST', signal: AbortSignal.timeout(10000) }); } catch { /* already gone */ }
  const safe = dir && path.basename(dir).startsWith('ap-e2e-') && path.dirname(path.resolve(dir)) === path.resolve(os.tmpdir());
  if (dir && !safe) console.warn(`Skipping cleanup: ${dir} is not an ap-e2e- folder in the temp directory.`);
  else if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
