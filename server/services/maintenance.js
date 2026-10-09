import { purgeSoftDeleted, purgeTrash } from './purge.js';
import { ensureRecentBackup, rotateBackups } from './backup.js';
import { contentMaintenance } from './content.js';

export { contentMaintenance };

// Startup housekeeping. A failed step is logged and the rest still run.
export function runMaintenance(ctx, contentSteps) {
  const { db, config } = ctx;
  const steps = [
    ['Startup backup', () => ensureRecentBackup(db, config.dataDir)],
    ['Purging old deleted rows', () => purgeSoftDeleted(db, config.dataDir)],
    ['Purging photo trash', () => purgeTrash(config.dataDir)],
    ['Rotating backups', () => rotateBackups(config.dataDir)],
  ];
  for (const [label, fn] of steps) {
    try { fn(); } catch (err) { console.error(`${label} failed (the app will still run):`, err); }
  }
  contentMaintenance(db, contentSteps);
}
