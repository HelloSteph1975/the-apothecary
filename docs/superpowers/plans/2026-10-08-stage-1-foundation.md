# The Apothecary, Stage 1: Foundation and Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running, installable shell of The Apothecary: server, database, backups, settings, Windows schedule and shortcut, the cabinet-of-drawers side bar, the walnut-and-parchment theme, a Today page, a Settings page, a demo mode, and docs.

**Architecture:** Copy Hearth & Larder's proven server and tooling (Express 5 + `node:sqlite`, backups, host guard, stop script, Windows scripts) into this repo and rename it. Build the client shell fresh with the new theme. Each later stage adds one or two drawers on top of this.

**Tech Stack:** Node 24+, Express 5, `node:sqlite`, React 19, React Router 7, Vite 8, Vitest 5, Supertest, Testing Library, Playwright, `@fontsource/cormorant-garamond`, `@fontsource/eb-garamond`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`

**Source to copy from:** `C:\Users\S_Lip\dev\hearth-and-larder` (called **H&L** below). Read-only. Never edit it from this plan.

## Global Constraints

- Node 24 or newer (`"engines": { "node": ">=24" }`).
- App port 4197, demo port 4201, browser test port 4203. Env overrides: `APOTHECARY_PORT`, `APOTHECARY_DATA_DIR`, `APOTHECARY_DEMO_PORT`, `APOTHECARY_DEMO_DATA_DIR`.
- Data folder default: `Documents\The Apothecary Data`; demo: `Documents\The Apothecary Demo Data`. Database file `apothecary.db`. Sub-folders `photos\`, `photos\_trash\`, `labels\`, `backups\`.
- Backup file names: `apothecary-YYYY-MM-DD.db` and `pre-restore-<stamp>.db`.
- Scheduled tasks: `The Apothecary - Start Morning` (5:30 AM, StartWhenAvailable, ExecutionTimeLimit 72 hours) and `The Apothecary - Stop 9-30 PM` (9:30 PM). Both allowed on battery. Stop runs Node through a hidden `.vbs`, never PowerShell.
- Desktop shortcut `The Apothecary Dashboard.lnk`, running `windows\Launch The Apothecary.vbs` through wscript, icon `windows\the-apothecary.ico`.
- Server listens on `127.0.0.1` only.
- All art is original SVG in this repo. Fonts are OFL, bundled through `@fontsource`. No third-party images.
- Body text must meet WCAG AA contrast. Respect `prefers-reduced-motion`.
- UI and docs text: plain, warm, short. No em dashes.
- Work on branch `feat/stage-1-foundation`, never on `main`. Commit after every task. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

```
package.json, vite.config.js, vitest.config.js, playwright.config.js, .gitignore, LICENSE
README.md, AGENTS.md, CLAUDE.md, NOTICE.md
server/
  index.js        start-up, maintenance, listen (copied, renamed)
  app.js          express app, static client, /photos (copied)
  config.js       ports, data folder, config.json (copied, renamed)
  context.js      ctx = { config, db, reopen } (copied)
  http.js         HttpError, hostGuard, localOnly, errorHandler (copied)
  validate.js     schema checks (copied)
  db/connection.js  open db, data folders, transaction (copied, adds labels\)
  db/migrations.js  stage 1 tables: settings, photos (new)
  db/backups.js     photo names in a backup (copied)
  services/backup.js   backup, rotate, restore (copied, renamed)
  services/photos.js   photo file trash/untrash helpers (copied, trimmed)
  services/purge.js    purge old photo rows and trash (new, small)
  services/settings.js settings keys for stage 1 (new)
  routes/index.js      health, settings, system (new, small)
  routes/settings.js   GET/PUT /api/settings (new)
  routes/system.js     backups, restore, data folder, shutdown (copied)
  demo/seed.js         demo settings (new)
scripts/setup.js, scripts/stop.js, scripts/make-icon.js (copied, renamed)
windows/*.vbs, windows/*.ps1, windows/the-apothecary.ico (copied, renamed; icon generated)
client/
  index.html, public/favicon.svg, public/manifest.webmanifest (new)
  src/main.jsx, src/App.jsx (new)
  src/lib/api.js, src/lib/useApi.js (copied)
  src/lib/dates.js (new: greeting and long date)
  src/theme/tokens.css, src/theme/global.css (new)
  src/components/  Dialog, Button, Field, ToastProvider, ConfirmProvider (copied, restyled by CSS)
                   Layout.jsx, Cabinet.jsx (drawer side bar), ParchmentCard.jsx, WaxSeal.jsx,
                   Botanicals.jsx, PageHeader.jsx, SettingsProvider.jsx (new)
  src/screens/Today.jsx, Settings.jsx, DrawerSoon.jsx, NotFound.jsx (new)
tests/server/*.test.js, tests/client/*.test.jsx, e2e/drawers.spec.js, e2e/teardown.js
```

---

### Task 1: Project scaffold and health check

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `.gitignore`, `LICENSE`
- Create (copied, renamed): `server/index.js`, `server/app.js`, `server/config.js`, `server/context.js`, `server/http.js`, `server/validate.js`, `server/db/connection.js`, `server/db/backups.js`, `server/services/backup.js`, `server/services/photos.js`, `server/routes/system.js`
- Create (new): `server/db/migrations.js`, `server/services/purge.js`, `server/routes/index.js`
- Test: `tests/server/helpers.js`, `tests/server/health.test.js`, `tests/server/config.test.js`, `tests/server/validate.test.js`, `tests/server/db.test.js`

**Interfaces:**
- Produces: `loadConfig({ env, root, demo }) -> { dataDir, port, demo }`, `DEFAULT_PORT = 4197`, `DEMO_PORT = 4201`, `defaultDataDir(demo)`, `createContext(config) -> ctx`, `createApp(ctx, { onShutdown }) -> express app`, `openDb(dataDir)`, `ensureDataDirs(dataDir)`, `transaction(db, fn)`, `check(schema, body, { partial })`, `HttpError`, `localOnly`, `hostGuard`, `makeTestContext({ onShutdown }) -> { ctx, app, dataDir, http, cleanup }`.

- [ ] **Step 1: Create the branch**

```bash
cd /c/Users/S_Lip/dev/the-apothecary
git switch main && git switch -c feat/stage-1-foundation
```

If `docs/design-spec` has not been merged yet, branch from it instead: `git switch docs/design-spec && git switch -c feat/stage-1-foundation`.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "the-apothecary",
  "version": "0.1.0",
  "description": "A witchy home apothecary keeper: herb cabinet, grimoire, recipes, batches, journal, calendar and garden log.",
  "type": "module",
  "license": "MIT",
  "engines": { "node": ">=24" },
  "scripts": {
    "start": "node --disable-warning=ExperimentalWarning server/index.js",
    "demo": "node --disable-warning=ExperimentalWarning server/index.js --demo",
    "dev": "concurrently -n api,web \"node --disable-warning=ExperimentalWarning --watch server/index.js\" \"vite\"",
    "build": "vite build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "icon": "node scripts/make-icon.js",
    "setup": "npm install && npm run build && node scripts/setup.js",
    "install-windows": "node scripts/setup.js --windows",
    "uninstall-windows": "powershell -NoProfile -ExecutionPolicy Bypass -File windows/uninstall-windows.ps1",
    "stop": "node scripts/stop.js"
  },
  "dependencies": {
    "@fontsource/cormorant-garamond": "^5.3.0",
    "@fontsource/eb-garamond": "^5.3.0",
    "express": "^5.2.1",
    "lucide-react": "^1.52.0",
    "multer": "^2.4.0",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router-dom": "^7.18.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.64.0",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@vitejs/plugin-react": "^6.1.2",
    "concurrently": "^10.0.5",
    "jsdom": "^30.1.2",
    "png-to-ico": "^3.0.2",
    "supertest": "^7.3.1",
    "vite": "^8.3.3",
    "vitest": "^5.0.3"
  }
}
```

Check the two `@fontsource` package versions with `npm view @fontsource/cormorant-garamond version` and `npm view @fontsource/eb-garamond version`, and use the current major if it differs.

- [ ] **Step 3: Copy config files and rename**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
cp $H/vite.config.js $H/vitest.config.js $H/LICENSE .
sed -i 's/4193/4197/g' vite.config.js
```

Write `.gitignore` (H&L ignores `docs/superpowers/`; this repo keeps it):

```
node_modules/
client/dist/
config.json
.superpowers/
*.log
test-results/
playwright-report/
```

Edit `LICENSE`: keep MIT text, set the copyright line to `Copyright (c) 2026 Stephanie Lippencott`.

- [ ] **Step 4: Copy server files**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
mkdir -p server/db server/services server/routes server/demo tests/server
cp $H/server/index.js $H/server/app.js $H/server/config.js $H/server/context.js $H/server/http.js $H/server/validate.js server/
cp $H/server/db/connection.js $H/server/db/backups.js server/db/
cp $H/server/services/backup.js $H/server/services/photos.js server/services/
cp $H/server/routes/system.js server/routes/
cp $H/tests/server/helpers.js $H/tests/server/health.test.js $H/tests/server/config.test.js $H/tests/server/validate.test.js tests/server/
```

- [ ] **Step 5: Rename everything that names Hearth & Larder**

```bash
FILES="server/*.js server/db/*.js server/services/*.js server/routes/*.js tests/server/*.js"
sed -i \
  -e 's/Hearth & Larder/The Apothecary/g' \
  -e 's/HEARTH_/APOTHECARY_/g' \
  -e 's/hearth\.db/apothecary.db/g' \
  -e 's/hearth-/apothecary-/g' \
  -e 's/hl-cfg-/ap-cfg-/g' \
  -e 's/Kitchen Data/Apothecary Data/g' \
  -e 's/4193/4197/g' -e 's/4195/4201/g' -e 's/4199/4203/g' \
  $FILES
grep -rniE "hearth|larder|kitchen|4193|4195|4199" server tests || echo "clean"
```

Expected: `clean`. Fix any leftover by hand.

- [ ] **Step 6: Add the `labels` folder to `ensureDataDirs`**

In `server/db/connection.js`, replace the folder list:

```js
export function ensureDataDirs(dataDir) {
  for (const d of [dataDir, path.join(dataDir, 'photos'), path.join(dataDir, 'photos', '_trash'), path.join(dataDir, 'labels'), path.join(dataDir, 'backups')]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
```

and make the default file name `'apothecary.db'` (Step 5 already did this; confirm).

- [ ] **Step 7: Trim `server/services/photos.js` to what Stage 1 needs**

Keep `ALLOWED_TYPES`, `PHOTO_NAME`, `savePhotoFile`, `trashPhotoFile`, `restorePhotoFile`, `untrashLivePhotos`. Delete `cascadeDeletePhotos` and `cascadeRestorePhotos` (they name H&L tables). Stage 2 adds a generic cascade.

- [ ] **Step 8: Write `server/db/migrations.js`**

```js
const TS = `created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT`;

// Each entry runs once, in order. Never edit an entry after it ships; add a new one.
export const migrations = [
  // 1: settings and photos. Photos can belong to any kind of record, so owner_type is free text;
  // the photos route checks it against the kinds that exist.
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE photos (id INTEGER PRIMARY KEY, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL,
    filename TEXT NOT NULL, caption TEXT, is_cover INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE INDEX idx_photos_owner ON photos(owner_type, owner_id);
  `,
];

export function migrate(db) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = current; i < migrations.length; i++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migrations[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
```

- [ ] **Step 9: Write `server/services/purge.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { transaction } from '../db/connection.js';
import { photosInBackups } from './backup.js';

// Removes photo rows deleted more than `days` ago, and their files unless a kept backup still needs them.
// Later stages add their own tables here, children before parents.
export function purgeSoftDeleted(db, dataDir, { days = 30, now = Date.now() } = {}) {
  const cutoff = new Date(now - days * 86400000).toISOString();
  let files = [];
  const counts = transaction(db, () => {
    files = db.prepare('SELECT filename FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ?').all(cutoff).map(r => r.filename);
    return { photos: db.prepare('DELETE FROM photos WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff).changes };
  });
  const live = path.join(dataDir, 'photos');
  const trash = path.join(live, '_trash');
  const keep = files.length ? photosInBackups(dataDir) : new Set();
  for (const f of files) {
    try {
      if (keep.has(f)) {
        if (fs.existsSync(path.join(live, f))) fs.renameSync(path.join(live, f), path.join(trash, f));
        continue;
      }
      for (const dir of [live, trash]) fs.rmSync(path.join(dir, f), { force: true });
    } catch {}
  }
  return counts;
}

// Empties trash files older than the cutoff, except ones a kept backup still refers to.
export function purgeTrash(dataDir, olderThanDays = 30, now = Date.now()) {
  const dir = path.join(dataDir, 'photos', '_trash');
  if (!fs.existsSync(dir)) return 0;
  const old = fs.readdirSync(dir).filter(f => now - fs.statSync(path.join(dir, f)).mtimeMs > olderThanDays * 86400000);
  if (!old.length) return 0;
  const keep = photosInBackups(dataDir);
  let n = 0;
  for (const f of old) {
    if (keep.has(f)) continue;
    fs.rmSync(path.join(dir, f), { force: true });
    n++;
  }
  return n;
}
```

- [ ] **Step 10: Write `server/routes/index.js` (health and system only for now)**

```js
import { Router } from 'express';
import { HttpError } from '../http.js';
import { systemRouter } from './system.js';

export function apiRouter(ctx, { onShutdown }) {
  const r = Router();
  r.get('/health', (req, res) => res.json({ ok: true, version: '0.1.0', demo: ctx.config.demo }));
  r.use(systemRouter(ctx, { onShutdown }));
  r.use((req, res, next) => next(new HttpError(404, 'No such API route')));
  return r;
}
```

In `server/index.js`, remove the demo seed lines for now (Task 7 adds them back) and keep the rest. `server/app.js` stays as copied.

- [ ] **Step 11: Write `tests/server/db.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { transaction } from '../../server/db/connection.js';
import { migrate, migrations } from '../../server/db/migrations.js';

let t;
afterEach(() => t?.cleanup());

it('creates the data folder layout', () => {
  t = makeTestContext();
  for (const p of ['apothecary.db', 'photos', 'photos/_trash', 'labels', 'backups']) {
    expect(fs.existsSync(path.join(t.dataDir, p)), p).toBe(true);
  }
});

it('runs every migration once and is safe to run again', () => {
  t = makeTestContext();
  expect(t.ctx.db.prepare('PRAGMA user_version').get().user_version).toBe(migrations.length);
  migrate(t.ctx.db);
  expect(t.ctx.db.prepare('PRAGMA user_version').get().user_version).toBe(migrations.length);
});

it('transaction rolls back on error and supports nesting', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  expect(() => transaction(db, () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('a', '1')").run();
    transaction(db, () => db.prepare("INSERT INTO settings (key, value) VALUES ('b', '2')").run());
    throw new Error('boom');
  })).toThrow('boom');
  expect(db.prepare("SELECT COUNT(*) n FROM settings WHERE key IN ('a','b')").get().n).toBe(0);
});
```

- [ ] **Step 12: Install and run the tests**

```bash
npm install
npx vitest run --project server
```

Expected: health, config, validate and db tests pass. `config.test.js` should now expect port 4197, demo port 4201, and a demo folder ending in `The Apothecary Demo Data` (Step 5 renamed these; fix any assertion that still fails).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Set up the server foundation from Hearth & Larder" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backups, restore, shutdown and host guard

**Files:**
- Test (copied, adapted): `tests/server/backup.test.js`, `tests/server/system.test.js`, `tests/server/hardening.test.js`, `tests/server/purge.test.js`

**Interfaces:**
- Consumes: Task 1 server.
- Produces: `backupNow(db, dataDir, now)`, `listBackups(dataDir)`, `rotateBackups(dataDir, opts)`, `ensureRecentBackup(db, dataDir, now)`, `restoreBackup(ctx, name)`; routes `GET/POST /api/backups`, `POST /api/backups/restore`, `GET /api/data-folder`, `POST /api/data-folder/open`, `POST /api/shutdown`.

- [ ] **Step 1: Copy and rename the tests**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
cp $H/tests/server/backup.test.js $H/tests/server/system.test.js tests/server/
sed -i -e 's/Hearth & Larder/The Apothecary/g' -e 's/hearth\.db/apothecary.db/g' -e 's/hearth-/apothecary-/g' tests/server/backup.test.js tests/server/system.test.js
```

- [ ] **Step 2: Point the backup tests at the settings table**

H&L's tests write to `stores`, which doesn't exist here. In `tests/server/backup.test.js`, replace every
`INSERT INTO stores (name) VALUES ('X')` with `INSERT INTO settings (key, value) VALUES ('marker_X', 'X')`,
and every `SELECT name FROM stores` with `SELECT value AS name FROM settings WHERE key LIKE 'marker_%'`.

- [ ] **Step 3: Write `tests/server/hardening.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { loadConfig } from '../../server/config.js';

let t;
const tmpDirs = [];
afterEach(() => {
  t?.cleanup();
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

it('refuses system calls from another site and requests that name another host', async () => {
  t = makeTestContext();
  const h = t.http;
  expect((await h().post('/api/backups').set('Origin', 'https://evil.example')).status).toBe(403);
  expect((await h().post('/api/backups').set('Origin', 'null')).status).toBe(403);
  expect((await h().get('/api/health').set('Host', 'evil.example')).status).toBe(403);
  expect((await h().get('/photos/1-abcdef12.jpg').set('Host', 'evil.example:4197')).status).toBe(403);
  expect((await h().get('/api/health').set('Host', 'localhost:4197')).status).toBe(200);
  expect((await h().post('/api/backups').set('Origin', 'http://localhost:4197')).status).toBe(201);
});

it('serves only app-named photo files, with nosniff', async () => {
  t = makeTestContext();
  const h = t.http;
  const dir = path.join(t.dataDir, 'photos');
  fs.writeFileSync(path.join(dir, '1700000000000-abcdef12.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const ok = await h().get('/photos/1700000000000-abcdef12.jpg');
  expect(ok.status).toBe(200);
  expect(ok.headers['x-content-type-options']).toBe('nosniff');
  fs.writeFileSync(path.join(dir, 'notes.html'), '<script>alert(1)</script>');
  fs.writeFileSync(path.join(dir, '1-abcdef12.svg'), '<svg/>');
  fs.writeFileSync(path.join(dir, '_trash', '1700000000000-abcdef12.jpg'), 'x');
  for (const p of ['notes.html', '1-abcdef12.svg', '_trash/1700000000000-abcdef12.jpg', '%5Ftrash/1700000000000-abcdef12.jpg', '1-abcdef12.jpg']) {
    expect((await h().get(`/photos/${p}`)).status, p).toBe(404);
  }
});

it('explains a broken config.json and a bad port', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-cfg-'));
  tmpDirs.push(root);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "dataDir": "D:\\Apothecary Data" }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/config\.json.*double backslashes in Windows paths \(\\\\\)/s);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "port": "abc" }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/1 to 65535/);
  expect(() => loadConfig({ env: { APOTHECARY_PORT: '0' }, root })).toThrow(/APOTHECARY_PORT/);
  expect(() => loadConfig({ env: { APOTHECARY_DEMO_PORT: 'x' }, root, demo: true })).toThrow(/APOTHECARY_DEMO_PORT/);
});
```

- [ ] **Step 4: Write `tests/server/purge.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { purgeSoftDeleted, purgeTrash } from '../../server/services/purge.js';

let t;
afterEach(() => t?.cleanup());

it('purges photo rows deleted over 30 days ago and their files', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const old = new Date(Date.now() - 40 * 86400000).toISOString();
  const recent = new Date().toISOString();
  db.prepare("INSERT INTO photos (owner_type, owner_id, filename, deleted_at) VALUES ('herb', 1, '1-aaaaaaaa.jpg', ?)").run(old);
  db.prepare("INSERT INTO photos (owner_type, owner_id, filename, deleted_at) VALUES ('herb', 1, '2-bbbbbbbb.jpg', ?)").run(recent);
  fs.writeFileSync(path.join(t.dataDir, 'photos', '_trash', '1-aaaaaaaa.jpg'), 'x');
  expect(purgeSoftDeleted(db, t.dataDir).photos).toBe(1);
  expect(db.prepare('SELECT filename FROM photos').all().map(r => r.filename)).toEqual(['2-bbbbbbbb.jpg']);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', '1-aaaaaaaa.jpg'))).toBe(false);
});

it('purgeTrash removes old trash files only', () => {
  t = makeTestContext();
  const trash = path.join(t.dataDir, 'photos', '_trash');
  fs.writeFileSync(path.join(trash, 'old.jpg'), 'x');
  fs.writeFileSync(path.join(trash, 'new.jpg'), 'x');
  const old = new Date(Date.now() - 40 * 86400000);
  fs.utimesSync(path.join(trash, 'old.jpg'), old, old);
  purgeTrash(t.dataDir, 30);
  expect(fs.readdirSync(trash)).toEqual(['new.jpg']);
});
```

- [ ] **Step 5: Run the server tests**

Run: `npx vitest run --project server`
Expected: all pass. If `system.test.js` fails because `/api/backups` lists more than one file, check the startup backup is not being made by `makeTestContext` (it shouldn't; `runMaintenance` runs only from `server/index.js`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Cover backups, restore, shutdown and the host guard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Settings service and route

**Files:**
- Create: `server/services/settings.js`, `server/routes/settings.js`
- Modify: `server/routes/index.js`
- Test: `tests/server/settings.test.js`

**Interfaces:**
- Produces: `DEFAULT_SETTINGS`, `getSettings(db) -> object of strings`, `saveSettings(db, input) -> object` (throws `HttpError(400)` with per-field details); routes `GET /api/settings`, `PUT /api/settings`.

- [ ] **Step 1: Write the failing test `tests/server/settings.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('returns defaults set for Mexico City', async () => {
  t = makeTestContext();
  const res = await t.http().get('/api/settings');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332',
    hemisphere: 'north', units: 'metric',
  });
});

it('saves good values and trims them', async () => {
  t = makeTestContext();
  const res = await t.http().put('/api/settings').send({ keeper_name: '  Stephanie ', latitude: 40.7, longitude: '-74', hemisphere: 'south', units: 'us' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ keeper_name: 'Stephanie', latitude: '40.7', longitude: '-74', hemisphere: 'south', units: 'us' });
  expect((await t.http().get('/api/settings')).body.keeper_name).toBe('Stephanie');
});

it('rejects bad values and unknown keys, saving nothing', async () => {
  t = makeTestContext();
  const res = await t.http().put('/api/settings').send({ keeper_name: 'Ok', latitude: '91', longitude: 'east', hemisphere: 'up', units: 'stone', colour: 'red', ['__proto__']: 'x' });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.details).sort()).toEqual(['__proto__', 'colour', 'hemisphere', 'latitude', 'longitude', 'units'].sort());
  expect((await t.http().get('/api/settings')).body.keeper_name).toBe('');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/settings.test.js`
Expected: FAIL with 404 from `/api/settings`.

- [ ] **Step 3: Write `server/services/settings.js`**

```js
import { HttpError } from '../http.js';

export const DEFAULT_SETTINGS = {
  keeper_name: '',
  location_name: 'Mexico City',
  latitude: '19.4326',
  longitude: '-99.1332',
  hemisphere: 'north',
  units: 'metric',
};

const DECIMAL = /^-?\d+(\.\d+)?$/;
const RULES = {
  keeper_name: v => v.length <= 60,
  location_name: v => v.length >= 1 && v.length <= 80,
  latitude: v => DECIMAL.test(v) && Math.abs(Number(v)) <= 90,
  longitude: v => DECIMAL.test(v) && Math.abs(Number(v)) <= 180,
  hemisphere: v => ['north', 'south'].includes(v),
  units: v => ['metric', 'us'].includes(v),
};

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const saved = Object.fromEntries(rows.filter(r => Object.hasOwn(DEFAULT_SETTINGS, r.key)).map(r => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(db, input) {
  // Null-prototype objects, so a key like "__proto__" is reported, not swallowed.
  const errors = Object.create(null);
  const clean = Object.create(null);
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!Object.hasOwn(RULES, k)) { errors[k] = 'Unknown setting'; continue; }
    const ok = typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
    const norm = ok ? String(v).trim() : '';
    if (!ok || !RULES[k](norm)) errors[k] = 'Not a valid value';
    else clean[k] = norm;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { ...errors });
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(clean)) up.run(k, v);
  return getSettings(db);
}
```

`getSettings` ignores keys that aren't settings, so the backup tests' `marker_*` rows never leak into the API.

- [ ] **Step 4: Write `server/routes/settings.js` and mount it**

```js
import { Router } from 'express';
import { getSettings, saveSettings } from '../services/settings.js';

export function settingsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(getSettings(ctx.db)));
  r.put('/', (req, res) => res.json(saveSettings(ctx.db, req.body)));
  return r;
}
```

In `server/routes/index.js` add `import { settingsRouter } from './settings.js';` and, after the health route, `r.use('/settings', settingsRouter(ctx));`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project server`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add settings for keeper name, location, hemisphere and units" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Setup, stop script, Windows tasks, shortcut and icon

**Files:**
- Create (copied, renamed): `scripts/setup.js`, `scripts/stop.js`, `scripts/make-icon.js`, `windows/start-server.vbs`, `windows/stop-server.vbs`, `windows/Launch The Apothecary.vbs`, `windows/install-windows.ps1`, `windows/uninstall-windows.ps1`
- Create: `client/public/favicon.svg`, `windows/the-apothecary.ico` (generated)
- Test (copied, renamed): `tests/server/stop-script.test.js`

**Interfaces:**
- Produces: `resolvePort(root, env) -> number`, `stopServer(port, timeoutMs, { settleMs }) -> 'stopped' | 'not-running' | 'still-running'`.

- [ ] **Step 1: Copy and rename**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
mkdir -p scripts windows client/public
cp $H/scripts/setup.js $H/scripts/stop.js $H/scripts/make-icon.js scripts/
cp $H/windows/start-server.vbs $H/windows/stop-server.vbs $H/windows/install-windows.ps1 $H/windows/uninstall-windows.ps1 windows/
cp "$H/windows/Launch Hearth & Larder.vbs" "windows/Launch The Apothecary.vbs"
cp $H/tests/server/stop-script.test.js tests/server/
sed -i \
  -e 's/Hearth & Larder/The Apothecary/g' \
  -e 's/hearth-and-larder/the-apothecary/g' \
  -e 's/HEARTH_/APOTHECARY_/g' \
  -e 's/4193/4197/g' \
  scripts/*.js windows/*.vbs windows/*.ps1 "windows/Launch The Apothecary.vbs" tests/server/stop-script.test.js
grep -rniE "hearth|larder|4193" scripts windows tests/server/stop-script.test.js || echo "clean"
```

Expected: `clean`. Check by eye that `install-windows.ps1` now registers `The Apothecary - Start Morning` and `The Apothecary - Stop 9-30 PM`, keeps `AllowStartIfOnBatteries`, `DontStopIfGoingOnBatteries`, `-StartWhenAvailable` and the 72-hour limit on the start task, and writes `The Apothecary Dashboard.lnk` with `windows\the-apothecary.ico`.

- [ ] **Step 2: Draw the icon `client/public/favicon.svg`**

An original mark: a brass-rimmed apothecary bottle with a crescent moon on the label, on a walnut disc.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="31" fill="#2a1c14" stroke="#b08d57" stroke-width="2"/>
  <rect x="26" y="10" width="12" height="6" rx="1.5" fill="#b08d57"/>
  <rect x="27.5" y="15" width="9" height="6" fill="#7d6238"/>
  <path d="M27 21h10v4c6 3 9 8 9 14 0 9-6 15-14 15s-14-6-14-15c0-6 3-11 9-14z" fill="#6e1f24" stroke="#d4b47a" stroke-width="1.5"/>
  <rect x="22" y="33" width="20" height="13" rx="2" fill="#ece0c4"/>
  <path d="M35 36a5 5 0 1 0 0 7.2 4 4 0 1 1 0-7.2z" fill="#6e1f24"/>
</svg>
```

- [ ] **Step 3: Generate the `.ico`**

```bash
npx playwright install chromium
npm run icon
```

Expected: `Wrote windows/the-apothecary.ico`. Open `client/public/favicon.svg` in a browser to check it reads at small size.

- [ ] **Step 4: Run the stop script tests**

Run: `npx vitest run tests/server/stop-script.test.js`
Expected: PASS (it should check the default port 4197 where H&L checked 4193).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add setup, stop script, Windows schedule, shortcut and icon" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Client shell, theme and the cabinet side bar

**Files:**
- Create: `client/index.html`, `client/public/manifest.webmanifest`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/theme/tokens.css`, `client/src/theme/global.css`, `client/src/components/Layout.jsx`, `client/src/components/Cabinet.jsx`, `client/src/components/PageHeader.jsx`, `client/src/screens/DrawerSoon.jsx`, `client/src/screens/NotFound.jsx`
- Create (copied): `client/src/lib/api.js`, `client/src/lib/useApi.js`, `client/src/components/Dialog.jsx`, `client/src/components/Button.jsx`, `client/src/components/Field.jsx`, `client/src/components/ToastProvider.jsx`, `client/src/components/ConfirmProvider.jsx`
- Test: `tests/client/setup.js`, `tests/client/cabinet.test.jsx`, `tests/client/foundation.test.jsx` (copied)

**Interfaces:**
- Consumes: `/api/health`.
- Produces: `DRAWERS` (array of `{ to, label, icon }`) exported from `Cabinet.jsx`; `routes` exported from `App.jsx`; `<PageHeader title subtitle actions />`; CSS tokens listed in Step 3.

- [ ] **Step 1: Copy the shared client pieces**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
mkdir -p client/src/lib client/src/components client/src/screens client/src/theme tests/client
cp $H/client/src/lib/api.js $H/client/src/lib/useApi.js client/src/lib/
cp $H/client/src/components/Dialog.jsx $H/client/src/components/Button.jsx $H/client/src/components/Field.jsx \
   $H/client/src/components/ToastProvider.jsx $H/client/src/components/ConfirmProvider.jsx client/src/components/
cp $H/tests/client/setup.js $H/tests/client/foundation.test.jsx tests/client/
sed -i "s/Hearth & Larder/The Apothecary/g" client/src/lib/api.js
grep -rn "import" client/src/components/Dialog.jsx client/src/components/Button.jsx client/src/components/Field.jsx client/src/components/ToastProvider.jsx
```

If any copied component imports a file not copied above, copy that file too (it will be a small helper).

- [ ] **Step 2: Write the failing test `tests/client/cabinet.test.jsx`**

```jsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { DRAWERS } from '../../client/src/components/Cabinet.jsx';

beforeEach(() => {
  global.fetch = vi.fn(async url => new Response(JSON.stringify(
    url === '/api/health' ? { ok: true, demo: false } : { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' },
  ), { status: 200 }));
});

const at = path => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

it('has the eleven drawers in order', () => {
  expect(DRAWERS.map(d => d.label)).toEqual([
    'Today', 'Calendar', 'To-do', 'Herb cabinet', 'Grimoire', 'Recipe book',
    'Batch journal', 'Journal', 'Labels', 'Shopping list', 'Garden log',
  ]);
});

it('shows every drawer and marks the open one', async () => {
  at('/grimoire');
  const nav = await screen.findByRole('navigation', { name: 'Cabinet drawers' });
  const links = within(nav).getAllByRole('link');
  expect(links.map(l => l.textContent.trim())).toEqual(DRAWERS.map(d => d.label));
  expect(within(nav).getByRole('link', { name: 'Grimoire' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
});

it('opens a drawer that is not built yet with a friendly note', async () => {
  at('/garden');
  expect(await screen.findByRole('heading', { level: 1, name: 'Garden log' })).toBeInTheDocument();
  expect(screen.getByText(/being built/i)).toBeInTheDocument();
});

it('shows a not-found page for unknown paths', async () => {
  at('/nowhere');
  expect(await screen.findByRole('heading', { name: /lost in the stacks/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Write `client/src/theme/tokens.css`**

Contrast pairs checked: `--ink-green` on `--parchment` 7.4:1, `--ink-green-soft` on `--parchment` 5.2:1, `--ink-on-parchment` on `--parchment` 13:1, `--ink-soft` on `--parchment` 7.1:1, `--oxblood` on `--parchment` 8.6:1, `--forest-ink` on `--parchment` 8.0:1, `--text-on-wood` on `--walnut-800` 12:1, `--brass-light` on `--walnut-800` 7.9:1. `--brass` is for borders and decoration, and for text only on `--walnut-900`/`--walnut-800`.

```css
:root {
  --walnut-950: #120c09;
  --walnut-900: #1a110c;
  --walnut-800: #2a1c14;
  --walnut-700: #3b2a1e;
  --walnut-600: #5a4030;
  --parchment: #ece0c4;
  --parchment-deep: #dccaa2;
  --parchment-edge: #b8a37a;
  --ink-on-parchment: #2e1d12;
  --ink-soft: #5a4330;
  --text-on-wood: #e9dcc0;
  --oxblood: #6e1f24;
  --oxblood-bright: #8e2e34;
  --oxblood-wash: #f1d9d3;
  --forest: #2f4a3a;
  --forest-ink: #24402f;
  --forest-wash: #dbe5d6;
  --brass: #b08d57;
  --brass-dark: #7d6238;
  --brass-light: #d4b47a;
  --ink-green: #2b4a2b;
  --ink-green-soft: #4a6440;
  --leaf: #6b8455;
  --rule: #8c7a52;

  --font-head: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'EB Garamond', Georgia, serif;

  --radius: 4px;
  --cabinet-w: 232px;
  --gutter: clamp(16px, 3vw, 40px);
  --focus: 0 0 0 3px var(--brass-light);
}
```

- [ ] **Step 4: Write `client/src/theme/global.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text-on-wood);
  font: 18px/1.55 var(--font-body);
  background-color: var(--walnut-900);
  /* Wood grain: long soft stripes under a dark vignette. Made in CSS, no image files. */
  background-image:
    radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(10, 6, 4, .75) 100%),
    repeating-linear-gradient(92deg, rgba(255, 220, 170, .025) 0 2px, transparent 2px 9px, rgba(0, 0, 0, .06) 9px 11px, transparent 11px 23px),
    linear-gradient(180deg, var(--walnut-800), var(--walnut-900));
  background-attachment: fixed;
}

h1, h2, h3 { font-family: var(--font-head); font-weight: 600; line-height: 1.1; margin: 0 0 .4em; }
h1 { font-size: clamp(2.2rem, 1.6rem + 2vw, 3.2rem); color: var(--ink-green); }
h2 { font-size: 1.7rem; }
h3 { font-size: 1.3rem; }
p { margin: 0 0 1em; }
a { color: inherit; text-underline-offset: 3px; }
:focus-visible { outline: none; box-shadow: var(--focus); border-radius: var(--radius); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ---------- Shell ---------- */
.app-shell { display: grid; grid-template-columns: var(--cabinet-w) minmax(0, 1fr); min-height: 100vh; }
.skip-link { position: absolute; left: -999px; top: 8px; background: var(--parchment); color: var(--ink-on-parchment); padding: 8px 12px; z-index: 10; }
.skip-link:focus { left: 8px; }
.main { padding: var(--gutter); outline: none; }
.page { max-width: 1180px; margin: 0 auto; }

/* The page is one parchment sheet with a double-line border and vines in the corners. */
.sheet {
  position: relative;
  color: var(--ink-on-parchment);
  background:
    radial-gradient(ellipse at 15% 10%, rgba(255, 255, 255, .4), transparent 50%),
    radial-gradient(ellipse at 90% 95%, rgba(130, 90, 45, .16), transparent 55%),
    var(--parchment);
  padding: clamp(28px, 4vw, 56px);
  border: 1px solid var(--rule);
  outline: 1px solid var(--rule); outline-offset: -10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .55);
  min-height: calc(100vh - 2 * var(--gutter));
}
.sheet-vine { position: absolute; width: 120px; height: 120px; pointer-events: none; }
.sheet-vine.tl { top: 2px; left: 2px; }
.sheet-vine.tr { top: 2px; right: 2px; transform: scaleX(-1); }
.sheet-vine.bl { bottom: 2px; left: 2px; transform: scaleY(-1); }
.sheet-vine.br { bottom: 2px; right: 2px; transform: scale(-1, -1); }
.sheet > :not(.sheet-vine) { position: relative; }
.topbar { display: none; }

/* ---------- Cabinet ---------- */
.cabinet {
  background: linear-gradient(90deg, var(--walnut-700), var(--walnut-800) 85%, var(--walnut-950));
  border-right: 4px solid var(--walnut-950);
  padding: 18px 12px;
  display: flex; flex-direction: column; gap: 8px;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.cabinet-brand { text-align: center; text-decoration: none; margin-bottom: 8px; }
.cabinet-brand .name { font-family: var(--font-head); font-size: 1.6rem; line-height: 1; color: var(--text-on-wood); display: block; }
.cabinet-brand .flourish { color: var(--brass-light); letter-spacing: .3em; font-size: .8rem; }
.drawers { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
.drawer {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px 8px 6px;
  text-decoration: none;
  background: linear-gradient(180deg, #5d4130, #45301f);
  border: 1px solid var(--walnut-950);
  box-shadow: inset 0 1px 0 rgba(255, 220, 170, .12), 0 2px 0 var(--walnut-950);
  border-radius: 3px;
  transition: transform .15s ease;
}
.drawer-plate {
  font-family: var(--font-head); font-size: 1.05rem; font-weight: 600;
  color: var(--ink-on-parchment);
  background: linear-gradient(180deg, #eadbb4, #cdb68a);
  border: 1px solid var(--brass-dark);
  outline: 1px solid var(--brass); outline-offset: 1px;
  padding: 1px 12px; border-radius: 2px; min-width: 70%; text-align: center;
}
.drawer-knob { width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, var(--brass-light), var(--brass-dark)); }
.drawer:hover { transform: translateX(3px); }
.drawer[aria-current='page'] { background: linear-gradient(180deg, var(--oxblood-bright), var(--oxblood)); transform: translateX(6px); }
.cabinet-key { margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--brass-light); text-decoration: none; padding: 8px; }
.cabinet-key[aria-current='page'] { color: var(--text-on-wood); text-decoration: underline; }
.demo-ribbon { background: var(--forest); color: var(--text-on-wood); text-align: center; font-family: var(--font-head); border-radius: 2px; }

/* ---------- Page header and flourish lines ---------- */
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
.page-header .subtitle { color: var(--ink-soft); font-variant: small-caps; letter-spacing: .08em; margin: 0; }
.flourish-line {
  text-align: center; font-variant: small-caps; letter-spacing: .14em; color: var(--ink-green-soft);
  border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
  padding: 4px 12px; margin: 0 auto 28px; width: fit-content;
}

/* ---------- Framed panel (the ParchmentCard component) ---------- */
.panel {
  position: relative;
  color: var(--ink-on-parchment);
  background: rgba(255, 250, 235, .45);
  border: 1px solid var(--rule);
  outline: 1px solid var(--rule); outline-offset: -6px;
  padding: 30px 24px 22px;
}
.panel-ornament { position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: var(--parchment); padding: 0 6px; line-height: 0; }
.panel h2 { color: var(--ink-green); text-align: center; margin-bottom: .1em; }
.panel .panel-subtitle { text-align: center; font-style: italic; color: var(--ink-soft); margin: 0 0 14px; }
.panel .muted, .sheet .muted { color: var(--ink-soft); font-style: italic; }
.panel .botanical { position: absolute; right: 12px; bottom: 10px; opacity: .9; pointer-events: none; }

/* ---------- Wax seal button ---------- */
.wax-seal {
  display: inline-flex; align-items: center; gap: 10px;
  border: 0; cursor: pointer; padding: 12px 26px 12px 18px;
  font: 600 1.1rem var(--font-head); color: #f6e6d8;
  background: radial-gradient(circle at 35% 30%, #a3343b, var(--oxblood) 60%, #4d1418);
  border-radius: 46% 54% 50% 50% / 55% 45% 55% 45%;
  box-shadow: inset 0 0 0 3px rgba(255, 200, 190, .18), 0 3px 6px rgba(0, 0, 0, .5);
}
.wax-seal:hover { filter: brightness(1.08); }

/* ---------- Grid and forms ---------- */
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
.field { display: grid; gap: 4px; margin-bottom: 14px; }
.field label { font-weight: 600; }
.field input, .field select {
  font: inherit; color: var(--ink-on-parchment); background: #f7efdc;
  border: 1px solid var(--parchment-edge); border-radius: var(--radius); padding: 8px 10px;
}
.field .error { color: var(--oxblood); font-size: .95rem; }

/* ---------- Small screens: cabinet slides in ---------- */
@media (max-width: 860px) {
  .app-shell { grid-template-columns: 1fr; }
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: var(--walnut-800); }
  .cabinet { position: fixed; inset: 0 auto 0 0; width: var(--cabinet-w); transform: translateX(-100%); transition: transform .2s ease; z-index: 5; }
  .cabinet.is-open { transform: none; }
  .scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, .5); z-index: 4; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
  .drawer:hover, .drawer[aria-current='page'] { transform: none; }
}
```

Copied components (`Button`, `Dialog`, `Field`, `ToastProvider`) use H&L class names. Search them for `className=` and add matching rules at the end of `global.css` in the same style (parchment dialogs, brass-outlined secondary buttons, oxblood danger buttons, forest primary buttons).

- [ ] **Step 5: Write `client/src/components/Cabinet.jsx`**

```jsx
import { NavLink } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useApi } from '../lib/useApi.js';

export const DRAWERS = [
  { to: '/', label: 'Today', end: true },
  { to: '/calendar', label: 'Calendar' },
  { to: '/todo', label: 'To-do' },
  { to: '/cabinet', label: 'Herb cabinet' },
  { to: '/grimoire', label: 'Grimoire' },
  { to: '/recipes', label: 'Recipe book' },
  { to: '/batches', label: 'Batch journal' },
  { to: '/journal', label: 'Journal' },
  { to: '/labels', label: 'Labels' },
  { to: '/shopping', label: 'Shopping list' },
  { to: '/garden', label: 'Garden log' },
];

export function Brand() {
  return (
    <NavLink to="/" className="cabinet-brand" aria-label="The Apothecary, Today">
      <span className="name">The<br />Apothecary</span>
      <span className="flourish" aria-hidden="true">✦ ☾ ✦</span>
    </NavLink>
  );
}

export function Cabinet({ id, open = false }) {
  const { data: health } = useApi('/api/health');
  return (
    <aside id={id} className={`cabinet${open ? ' is-open' : ''}`} aria-label="Cabinet">
      {health?.demo && <div className="demo-ribbon" role="note">Demo</div>}
      <Brand />
      <nav aria-label="Cabinet drawers">
        <ul className="drawers">
          {DRAWERS.map(d => (
            <li key={d.to}>
              <NavLink to={d.to} end={d.end} className="drawer">
                <span className="drawer-plate">{d.label}</span>
                <span className="drawer-knob" aria-hidden="true" />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <NavLink to="/settings" className="cabinet-key"><KeyRound size={18} aria-hidden="true" />Settings</NavLink>
    </aside>
  );
}
```

NavLink sets `aria-current="page"` on the active link, which the CSS uses.

- [ ] **Step 6: Write `client/src/components/Layout.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Cabinet, Brand } from './Cabinet.jsx';
import { VineCorner } from './Botanicals.jsx';

export function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const lastPath = useRef(pathname);

  useEffect(() => {
    setOpen(false);
    // Move focus to the new page for keyboard and screen-reader users, but not on first load.
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <Brand />
        <button className="icon-btn" aria-expanded={open} aria-controls="cabinet"
          aria-label={open ? 'Close the cabinet' : 'Open the cabinet'} onClick={() => setOpen(o => !o)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      <Cabinet id="cabinet" open={open} />
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <main id="main" className="main" tabIndex={-1} ref={mainRef}>
        <div className="page sheet">
          {['tl', 'tr', 'bl', 'br'].map(c => <VineCorner key={c} className={`sheet-vine ${c}`} />)}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Write `PageHeader.jsx`, `DrawerSoon.jsx`, `NotFound.jsx`**

`client/src/components/PageHeader.jsx`:

```jsx
export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
```

`client/src/screens/DrawerSoon.jsx`:

```jsx
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';

export function DrawerSoon({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <ParchmentCard title="This drawer is being built">
        <p className="muted">It opens in a later stage. Everything you add elsewhere is kept safe in the meantime.</p>
      </ParchmentCard>
    </>
  );
}
```

`client/src/screens/NotFound.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { ParchmentCard } from '../components/ParchmentCard.jsx';

export function NotFound() {
  return (
    <ParchmentCard title="Lost in the stacks">
      <p>That page isn't in the cabinet. <Link to="/">Back to Today</Link></p>
    </ParchmentCard>
  );
}
```

(`ParchmentCard` is written in Task 6. Write Task 6 Step 3 now if you are running this test before Task 6, or run Step 9 below after Task 6 Step 3.)

- [ ] **Step 8: Write `client/src/App.jsx`, `client/src/main.jsx`, `client/index.html`, manifest**

`client/src/App.jsx`:

```jsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import { SettingsProvider } from './components/SettingsProvider.jsx';
import { Layout } from './components/Layout.jsx';
import { Today } from './screens/Today.jsx';
import { Settings } from './screens/Settings.jsx';
import { DrawerSoon } from './screens/DrawerSoon.jsx';
import { NotFound } from './screens/NotFound.jsx';
import { DRAWERS } from './components/Cabinet.jsx';

const soon = DRAWERS.filter(d => d.to !== '/').map(d => ({ path: d.to.slice(1), element: <DrawerSoon title={d.label} /> }));

export const routes = [
  {
    element: <SettingsProvider><Layout /></SettingsProvider>,
    children: [
      { index: true, element: <Today /> },
      ...soon,
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
    </ToastProvider>
  );
}
```

`SettingsProvider` sits inside the route element so the cabinet test (which renders `routes` without `App`) still gets it. `Today` and `Settings` are written in Tasks 6 and 7; until then create each as `export function Today() { return <h1>Today</h1>; }` and `export function Settings() { return <h1>Settings</h1>; }` so this task's tests run.

`client/src/main.jsx`:

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/600.css';
import './theme/tokens.css';
import './theme/global.css';
import { App } from './App.jsx';

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
```

`client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#2a1c14" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <title>The Apothecary</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`client/public/manifest.webmanifest`:

```json
{ "name": "The Apothecary", "short_name": "Apothecary", "start_url": "/", "display": "standalone",
  "background_color": "#1a110c", "theme_color": "#2a1c14",
  "icons": [{ "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }] }
```

Write `client/src/components/SettingsProvider.jsx`:

```jsx
import { createContext, useContext } from 'react';
import { useApi } from '../lib/useApi.js';

const Ctx = createContext({ settings: null, reload: () => {} });
export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }) {
  const { data, reload } = useApi('/api/settings');
  return <Ctx.Provider value={{ settings: data, reload }}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 9: Run the client tests**

Run: `npx vitest run --project client`
Expected: `cabinet.test.jsx` and `foundation.test.jsx` pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add the cabinet side bar, theme and client shell" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Framed panels, vines, wax seal, botanicals and the Today page

**Files:**
- Create: `client/src/components/ParchmentCard.jsx`, `client/src/components/WaxSeal.jsx`, `client/src/components/Botanicals.jsx`, `client/src/lib/dates.js`, `client/src/screens/Today.jsx`
- Test: `tests/client/dates.test.jsx`, `tests/client/today.test.jsx`

**Interfaces:**
- Consumes: `useSettings()` from Task 5.
- Produces: `<ParchmentCard title subtitle botanical="calendula|chamomile|lavender" children />` (a framed panel), `<WaxSeal onClick>{label}</WaxSeal>`, `Calendula`, `Chamomile`, `Lavender` SVG components (`size` prop), `VineCorner` (`className` prop), `LeafOrnament`, `greeting(date) -> 'Good morning' | 'Good afternoon' | 'Good evening'`, `longDate(date) -> 'Thursday, October 8'`.

- [ ] **Step 1: Write the failing tests**

`tests/client/dates.test.jsx`:

```jsx
import { it, expect } from 'vitest';
import { greeting, longDate } from '../../client/src/lib/dates.js';

it('greets by time of day', () => {
  expect(greeting(new Date(2026, 9, 8, 6))).toBe('Good morning');
  expect(greeting(new Date(2026, 9, 8, 11, 59))).toBe('Good morning');
  expect(greeting(new Date(2026, 9, 8, 12))).toBe('Good afternoon');
  expect(greeting(new Date(2026, 9, 8, 17, 59))).toBe('Good afternoon');
  expect(greeting(new Date(2026, 9, 8, 18))).toBe('Good evening');
  expect(greeting(new Date(2026, 9, 8, 2))).toBe('Good evening');
});

it('writes the date out in full', () => {
  expect(longDate(new Date(2026, 9, 8))).toBe('Thursday, October 8');
});
```

`tests/client/today.test.jsx`:

```jsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';

let settings;
beforeEach(() => {
  settings = { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };
  global.fetch = vi.fn(async url => new Response(JSON.stringify(url === '/api/health' ? { ok: true, demo: false } : settings), { status: 200 }));
});
const today = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />);

it('greets the keeper by name when one is set', async () => {
  settings.keeper_name = 'Stephanie';
  today();
  expect(await screen.findByRole('heading', { level: 1, name: /good (morning|afternoon|evening), stephanie/i })).toBeInTheDocument();
});

it('greets without a name when none is set', async () => {
  today();
  expect(await screen.findByRole('heading', { level: 1, name: /^good (morning|afternoon|evening)$/i })).toBeInTheDocument();
});

it('shows the three cabinet cards with gentle empty notes', async () => {
  today();
  for (const name of ['Batches due', 'Running low', 'Nearing expiry']) {
    expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
  }
  expect(screen.getAllByText(/once the herb cabinet is stocked/i)).toHaveLength(3);
});

it('has a wax seal button to log a batch', async () => {
  today();
  expect(await screen.findByRole('button', { name: /log a batch/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/client/dates.test.jsx tests/client/today.test.jsx`
Expected: FAIL (`dates.js` missing; Today is a stub).

- [ ] **Step 3: Write `client/src/lib/dates.js`**

```js
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function longDate(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
```

- [ ] **Step 4: Write `client/src/components/Botanicals.jsx`**

Original line drawings, ink on parchment. Each takes `size` (height in px).

```jsx
const ink = { fill: 'none', stroke: '#5a4330', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function Calendula({ size = 120 }) {
  return (
    <svg viewBox="0 0 80 120" height={size} aria-hidden="true" {...ink}>
      <path d="M40 118 C40 95 39 70 40 42" />
      <path d="M40 92 C30 87 22 89 16 82 C24 79 33 82 40 88" />
      <path d="M40 74 C50 69 57 71 63 64 C55 61 47 65 40 70" />
      <g transform="translate(40 28)">
        <circle r="6" />
        <circle r="3" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} transform={`rotate(${i * (360 / 14)})`} d="M0 -7 C-3 -13 -2 -20 0 -22 C2 -20 3 -13 0 -7" />
        ))}
      </g>
      <g transform="translate(58 46) scale(.55)">
        <circle r="6" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 36})`} d="M0 -7 C-3 -13 -2 -19 0 -21 C2 -19 3 -13 0 -7" />
        ))}
      </g>
      <path d="M40 42 C46 45 52 46 56 47" />
    </svg>
  );
}

export function Chamomile({ size = 120 }) {
  const flower = (x, y, s) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="5" />
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} transform={`rotate(${i * 30}) translate(0 -11)`} rx="2.6" ry="6" />
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 90 120" height={size} aria-hidden="true" {...ink}>
      <path d="M45 118 C44 90 40 60 30 30" />
      <path d="M45 100 C52 80 60 62 66 44" />
      <path d="M44 84 C48 70 50 58 52 52" />
      <path d="M38 70 l-6 -3 M38 70 l-2 -6 M58 70 l5 -4 M58 70 l1 -6 M42 95 l-7 -1 M42 95 l-4 -5" />
      {flower(30, 26, 1)}
      {flower(66, 40, .8)}
      {flower(52, 50, .55)}
    </svg>
  );
}

export function Lavender({ size = 120 }) {
  const spike = (x, top, n, lean) => (
    <g>
      <path d={`M${x} 118 C${x} 90 ${x + lean / 2} 60 ${x + lean} ${top}`} />
      {Array.from({ length: n }, (_, i) => {
        const y = top + 4 + i * 5;
        const cx = x + lean * (1 - (y - top) / (118 - top));
        return <g key={i}><ellipse cx={cx - 2.5} cy={y} rx="2" ry="3" /><ellipse cx={cx + 2.5} cy={y + 1} rx="2" ry="3" /></g>;
      })}
    </g>
  );
  return (
    <svg viewBox="0 0 70 120" height={size} aria-hidden="true" {...ink}>
      {spike(30, 8, 8, -4)}
      {spike(40, 18, 7, 6)}
      {spike(22, 30, 5, -8)}
      <path d="M32 112 C24 104 18 102 12 104 M38 108 C46 100 52 98 58 100" />
    </svg>
  );
}

// A climbing vine for the corners of the page sheet. Drawn for the top-left corner; CSS mirrors it for the others.
export function VineCorner({ className }) {
  const leaf = (x, y, r) => <path transform={`translate(${x} ${y}) rotate(${r})`} d="M0 0 C4 -6 12 -7 16 -2 C11 2 5 3 0 0 Z" fill="#6b8455" stroke="#4a6440" strokeWidth=".8" />;
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M6 116 C8 80 14 50 30 30 C46 12 76 6 116 6" fill="none" stroke="#4a6440" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 60 C26 58 32 52 34 44 M52 18 C56 26 62 30 70 30" fill="none" stroke="#4a6440" strokeWidth="1.1" strokeLinecap="round" />
      {leaf(10, 92, -70)}{leaf(14, 72, -110)}{leaf(22, 50, -60)}{leaf(34, 44, -150)}
      {leaf(40, 22, -30)}{leaf(60, 12, -10)}{leaf(70, 30, 20)}{leaf(88, 8, 10)}
      <g transform="translate(30 30)">
        {Array.from({ length: 8 }, (_, i) => <ellipse key={i} transform={`rotate(${i * 45}) translate(0 -6)`} rx="2.2" ry="4.5" fill="#f4ecd8" stroke="#5a4330" strokeWidth=".7" />)}
        <circle r="2.6" fill="#c9a24a" stroke="#5a4330" strokeWidth=".6" />
      </g>
    </svg>
  );
}

// The small sprig that sits on the top edge of a framed panel.
export function LeafOrnament() {
  return (
    <svg viewBox="0 0 60 16" width="60" height="16" aria-hidden="true" fill="none" stroke="#4a6440" strokeWidth="1" strokeLinecap="round">
      <path d="M4 8 H24 M36 8 H56" />
      <path d="M30 13 V3 M30 9 C26 8 24 5 24 3 C27 3 29 5 30 8 M30 9 C34 8 36 5 36 3 C33 3 31 5 30 8" fill="#6b8455" />
    </svg>
  );
}

export const BOTANICALS = { calendula: Calendula, chamomile: Chamomile, lavender: Lavender };
```

- [ ] **Step 5: Write `client/src/components/ParchmentCard.jsx`**

A framed panel in the printable style: double-line frame, leaf ornament on the top edge, green-ink title, optional italic subtitle and ink drawing. The name stays `ParchmentCard` because the panels sit on the parchment sheet.

```jsx
import { BOTANICALS, LeafOrnament } from './Botanicals.jsx';

export function ParchmentCard({ title, subtitle, botanical, children, className = '' }) {
  const Art = botanical ? BOTANICALS[botanical] : null;
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <span className="panel-ornament"><LeafOrnament /></span>
      {title && <h2>{title}</h2>}
      {subtitle && <p className="panel-subtitle">{subtitle}</p>}
      {children}
      {Art && <span className="botanical"><Art size={100} /></span>}
    </section>
  );
}
```

- [ ] **Step 6: Write `client/src/components/WaxSeal.jsx`**

```jsx
function Sprig() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="#f0d3c4" strokeWidth="1.4" strokeLinecap="round">
      <path d="M12 22 V6" />
      <path d="M12 16 C8 15 6 13 5 10 M12 16 C16 15 18 13 19 10 M12 11 C9 10 8 8 8 6 M12 11 C15 10 16 8 16 6" />
      <circle cx="12" cy="4" r="1.6" />
    </svg>
  );
}

export function WaxSeal({ children, ...props }) {
  return (
    <button type="button" className="wax-seal" {...props}>
      <Sprig />
      {children}
    </button>
  );
}
```

- [ ] **Step 7: Write `client/src/screens/Today.jsx`**

The cards stay empty until Stage 2 adds `/api/today`. "Log a batch" goes to the Batch journal drawer.

```jsx
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';
import { WaxSeal } from '../components/WaxSeal.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { greeting, longDate } from '../lib/dates.js';

const EMPTY = 'Nothing here yet. This fills in once the herb cabinet is stocked.';

export function Today() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const now = new Date();
  const name = settings?.keeper_name;
  return (
    <>
      <PageHeader
        title={name ? `${greeting(now)}, ${name}` : greeting(now)}
        subtitle={longDate(now)}
        actions={<WaxSeal onClick={() => navigate('/batches')}>Log a batch</WaxSeal>}
      />
      <p className="flourish-line">gather ✦ steep ✦ strain ✦ keep</p>
      <div className="card-grid">
        <ParchmentCard title="Batches due" subtitle="what's steeping, and when it's ready" botanical="calendula"><p className="muted">{EMPTY}</p></ParchmentCard>
        <ParchmentCard title="Running low" subtitle="jars to refill soon" botanical="chamomile"><p className="muted">{EMPTY}</p></ParchmentCard>
        <ParchmentCard title="Nearing expiry" subtitle="use these first" botanical="lavender"><p className="muted">{EMPTY}</p></ParchmentCard>
      </div>
    </>
  );
}
```

- [ ] **Step 8: Run the client tests**

Run: `npx vitest run --project client`
Expected: all pass.

- [ ] **Step 9: Look at it**

```bash
npm run build
APOTHECARY_DATA_DIR="$(mktemp -d)" APOTHECARY_PORT=4203 node --disable-warning=ExperimentalWarning server/index.js
```

Open http://localhost:4203 and compare with `docs/design/today-reference.jpg` and the look section of the spec. Check: drawers read as wood with brass plates, the active drawer is oxblood, the page is a light parchment sheet with vines in the corners, panels have double-line frames with a leaf ornament and green-ink titles, the flourish line is in small caps, text is easy to read, the seal looks like wax. Adjust CSS until it's close. Stop the server with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add framed panels, vines, wax seal, botanical drawings and the Today page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Settings page

**Files:**
- Create: `client/src/screens/Settings.jsx`
- Test: `tests/client/settings.test.jsx`

**Interfaces:**
- Consumes: `GET/PUT /api/settings`, `GET/POST /api/backups`, `POST /api/backups/restore`, `GET /api/data-folder`, `POST /api/data-folder/open`, `useSettings()`, `useConfirm()`, `useToast()` (check the copied `ToastProvider.jsx` for the exact hook name and `show({ message, duration })` signature).

- [ ] **Step 1: Write the failing test `tests/client/settings.test.jsx`**

```jsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

let saved;
let calls;
beforeEach(() => {
  saved = { keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };
  calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    calls.push(`${opts.method ?? 'GET'} ${url}`);
    const json = body => new Response(JSON.stringify(body), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings' && opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      if (body.latitude === '99') return new Response(JSON.stringify({ error: 'Please fix the highlighted fields.', details: { latitude: 'Not a valid value' } }), { status: 400 });
      saved = { ...saved, ...body };
      return json(saved);
    }
    if (url === '/api/settings') return json(saved);
    if (url === '/api/backups' && opts.method === 'POST') return new Response(JSON.stringify({ name: 'apothecary-2026-10-08.db' }), { status: 201 });
    if (url === '/api/backups') return json([{ name: 'apothecary-2026-10-07.db', size: 4096, modified: '2026-10-07T21:30:00.000Z' }]);
    if (url === '/api/data-folder') return json({ path: 'C:\\Users\\me\\Documents\\The Apothecary Data' });
    return json({});
  });
});

const open = () => render(
  <ToastProvider><ConfirmProvider>
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/settings'] })} />
  </ConfirmProvider></ToastProvider>,
);

it('saves the keeper name and location', async () => {
  const user = userEvent.setup();
  open();
  const name = await screen.findByLabelText('Your name');
  await user.type(name, 'Stephanie');
  await user.clear(screen.getByLabelText('Place name'));
  await user.type(screen.getByLabelText('Place name'), 'Oaxaca');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() => expect(saved).toMatchObject({ keeper_name: 'Stephanie', location_name: 'Oaxaca' }));
});

it('shows the server error next to the field', async () => {
  const user = userEvent.setup();
  open();
  const lat = await screen.findByLabelText('Latitude');
  await user.clear(lat);
  await user.type(lat, '99');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByText('Not a valid value')).toBeInTheDocument();
});

it('lists backups, backs up now, and shows the data folder', async () => {
  const user = userEvent.setup();
  open();
  expect(await screen.findByText('apothecary-2026-10-07.db')).toBeInTheDocument();
  expect(screen.getByText(/The Apothecary Data/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back up now' }));
  await waitFor(() => expect(calls).toContain('POST /api/backups'));
});

it('asks before restoring', async () => {
  const user = userEvent.setup();
  open();
  await user.click(await screen.findByRole('button', { name: 'Restore apothecary-2026-10-07.db' }));
  expect(await screen.findByText(/safety copy/i)).toBeInTheDocument();
  expect(calls).not.toContain('POST /api/backups/restore');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/client/settings.test.jsx`
Expected: FAIL (Settings is a stub).

- [ ] **Step 3: Write `client/src/screens/Settings.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader.jsx';
import { ParchmentCard } from '../components/ParchmentCard.jsx';
import { WaxSeal } from '../components/WaxSeal.jsx';
import { useSettings } from '../components/SettingsProvider.jsx';
import { useConfirm } from '../components/ConfirmProvider.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { useApi } from '../lib/useApi.js';
import { api } from '../lib/api.js';

const FIELDS = [
  { key: 'keeper_name', label: 'Your name', hint: 'Used in the greeting on Today.' },
  { key: 'location_name', label: 'Place name' },
  { key: 'latitude', label: 'Latitude', hint: 'For moon and sky timing. Mexico City is 19.4326.' },
  { key: 'longitude', label: 'Longitude', hint: 'West is negative. Mexico City is -99.1332.' },
];

function Field({ id, label, hint, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
      {error && <span className="error" role="alert">{error}</span>}
    </div>
  );
}

export function Settings() {
  const { settings, reload } = useSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const backups = useApi('/api/backups');
  const folder = useApi('/api/data-folder');

  useEffect(() => { if (settings && !form) setForm(settings); }, [settings, form]);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  async function save(e) {
    e.preventDefault();
    try {
      await api.put('/api/settings', form);
      setErrors({});
      reload();
      toast.show({ message: 'Settings saved' });
    } catch (err) {
      setErrors(err.details ?? {});
      toast.show({ message: err.message, duration: 6000 });
    }
  }

  async function backUp() {
    try {
      await api.post('/api/backups');
      backups.reload();
      toast.show({ message: 'Backed up' });
    } catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }

  async function restore(name) {
    const ok = await confirm({
      title: `Restore ${name}?`,
      body: 'Everything goes back to how it was on that day. A safety copy of how things are now is saved first, so you can undo this.',
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post('/api/backups/restore', { name });
      window.location.reload();
    } catch (err) { toast.show({ message: err.message, duration: 8000 }); }
  }

  if (!form) return <PageHeader title="Settings" />;
  return (
    <>
      <PageHeader title="Settings" subtitle="The key to the cabinet" />
      <div className="card-grid">
        <ParchmentCard title="You and your sky">
          <form onSubmit={save} noValidate>
            {FIELDS.map(f => (
              <Field key={f.key} id={`s-${f.key}`} label={f.label} hint={f.hint} error={errors[f.key]}>
                <input id={`s-${f.key}`} value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
              </Field>
            ))}
            <Field id="s-hemisphere" label="Hemisphere" hint="Turns the Wheel of the Year for where you live." error={errors.hemisphere}>
              <select id="s-hemisphere" value={form.hemisphere} onChange={e => set('hemisphere', e.target.value)}>
                <option value="north">Northern</option>
                <option value="south">Southern</option>
              </select>
            </Field>
            <Field id="s-units" label="Units" error={errors.units}>
              <select id="s-units" value={form.units} onChange={e => set('units', e.target.value)}>
                <option value="metric">Metric (g, ml)</option>
                <option value="us">US (oz, fl oz)</option>
              </select>
            </Field>
            <WaxSeal type="submit">Save settings</WaxSeal>
          </form>
        </ParchmentCard>

        <ParchmentCard title="Backups">
          <p>Your cabinet is backed up every night at 9:30 PM and kept for 30 days.</p>
          <p className="muted">Data folder: {folder.data?.path ?? '…'}</p>
          <p><button type="button" className="btn" onClick={backUp}>Back up now</button></p>
          <ul className="backup-list">
            {(backups.data ?? []).map(b => (
              <li key={b.name}>
                <span>{b.name}</span>{' '}
                <button type="button" className="btn btn-ghost" aria-label={`Restore ${b.name}`} onClick={() => restore(b.name)}>Restore</button>
              </li>
            ))}
          </ul>
        </ParchmentCard>
      </div>
    </>
  );
}
```

`WaxSeal` sets `type="button"` before spreading props, so `type="submit"` here wins. If the copied `ToastProvider` exports a different hook name, use that name.

- [ ] **Step 4: Run the client tests**

Run: `npx vitest run --project client`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the Settings page with location, units and backups" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Demo mode and the browser walk-through

**Files:**
- Create: `server/demo/seed.js`, `playwright.config.js`, `e2e/teardown.js`, `e2e/drawers.spec.js`
- Modify: `server/index.js` (demo seed lines back in)
- Test: `tests/server/demo.test.js`

**Interfaces:**
- Produces: `seedDemo(ctx, { reset })`. Later stages extend it with sample herbs, jars and so on.

- [ ] **Step 1: Write the failing test `tests/server/demo.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { seedDemo } from '../../server/demo/seed.js';
import { getSettings } from '../../server/services/settings.js';

let t;
afterEach(() => t?.cleanup());

it('fills in demo settings once and leaves later edits alone', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  expect(getSettings(t.ctx.db).keeper_name).toBe('Demo Keeper');
  t.ctx.db.prepare("UPDATE settings SET value = 'Changed' WHERE key = 'keeper_name'").run();
  seedDemo(t.ctx);
  expect(getSettings(t.ctx.db).keeper_name).toBe('Changed');
});

it('reset puts the demo settings back', () => {
  t = makeTestContext();
  seedDemo(t.ctx);
  t.ctx.db.prepare("UPDATE settings SET value = 'Changed' WHERE key = 'keeper_name'").run();
  seedDemo(t.ctx, { reset: true });
  expect(getSettings(t.ctx.db).keeper_name).toBe('Demo Keeper');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/demo.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `server/demo/seed.js`**

```js
import { transaction } from '../db/connection.js';
import { saveSettings } from '../services/settings.js';

const DEMO_SETTINGS = { keeper_name: 'Demo Keeper', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332', hemisphere: 'north', units: 'metric' };

// Seeds the demo folder once (or again with reset). Later stages add sample herbs, jars and batches here.
export function seedDemo(ctx, { reset = false } = {}) {
  const db = ctx.db;
  const seeded = db.prepare("SELECT value FROM settings WHERE key = 'demo_seeded'").get();
  if (seeded && !reset) return false;
  transaction(db, () => {
    saveSettings(db, DEMO_SETTINGS);
    db.prepare("INSERT INTO settings (key, value) VALUES ('demo_seeded', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
  });
  return true;
}
```

`getSettings` ignores the `demo_seeded` key because it isn't a setting.

- [ ] **Step 4: Put the demo seed back in `server/index.js`**

After `createContext`, add back:

```js
if (demo) {
  const { seedDemo } = await import('./demo/seed.js');
  seedDemo(ctx, { reset: process.argv.includes('--reset') });
}
```

- [ ] **Step 5: Copy and adapt the Playwright setup**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
mkdir -p e2e
cp $H/playwright.config.js .
cp $H/e2e/teardown.js e2e/
sed -i -e 's/HL_E2E_DATA_DIR/AP_E2E_DATA_DIR/g' -e 's/hl-e2e-/ap-e2e-/g' -e 's/HEARTH_/APOTHECARY_/g' -e 's/4199/4203/g' playwright.config.js e2e/teardown.js
grep -nE "HL_|HEARTH|4199" playwright.config.js e2e/teardown.js || echo "clean"
```

- [ ] **Step 6: Write `e2e/drawers.spec.js`**

```js
import { test, expect } from '@playwright/test';

const DRAWERS = ['Today', 'Calendar', 'To-do', 'Herb cabinet', 'Grimoire', 'Recipe book', 'Batch journal', 'Journal', 'Labels', 'Shopping list', 'Garden log'];

test('opens every drawer, saves a name, and greets by it', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Cabinet drawers' });
  for (const name of DRAWERS.slice(1)) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Your name').fill('Rowan');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.getByRole('button', { name: 'Back up now' }).click();
  await expect(page.getByText(/apothecary-\d{4}-\d{2}-\d{2}\.db/).first()).toBeVisible();
  await nav.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/, Rowan$/);
  await page.screenshot({ path: 'test-results/today.png', fullPage: true });
});
```

- [ ] **Step 7: Run everything**

```bash
npx vitest run
npx playwright install chromium
npm run test:e2e
```

Expected: all unit tests pass; the Playwright test passes on port 4203 and writes `test-results/today.png`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add demo mode and a browser walk-through of every drawer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs

**Files:**
- Create: `README.md`, `AGENTS.md`, `CLAUDE.md`, `NOTICE.md`

- [ ] **Step 1: Write `AGENTS.md`**

Copy H&L's `AGENTS.md` and adapt it: every name, port (4197, demo 4201, tests 4203), env variable (`APOTHECARY_*`), folder (`Documents\The Apothecary Data`), database (`apothecary.db`), the task names, the shortcut name, and the `.vbs` file names. Keep the golden rules word for word apart from names. Add the `labels\` folder to golden rule 1. Run:

```bash
grep -niE "hearth|larder|kitchen|4193|4195|4199|recipe box|meal" AGENTS.md || echo "clean"
```

Expected: `clean` (except where a line intentionally mentions recipes in the apothecary sense).

- [ ] **Step 2: Write `CLAUDE.md`**

```markdown
# The Apothecary

Read `AGENTS.md` first. It has the install, update, uninstall and troubleshooting steps, and the golden rules about the data folder.

- Design: `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`
- Plans, one per stage: `docs/superpowers/plans/`
- Look reference: `docs/design/today-reference.jpg`
```

- [ ] **Step 3: Write `README.md`**

Sections: what it is (two sentences, witchy and warm), what works in this stage (Today, Settings, backups, the cabinet; other drawers are on the way), install on Windows (Node 24, `npm run setup`, `npm run install-windows`), use it (Desktop shortcut or http://localhost:4197), your data (folder, nightly backups, only reachable from your computer), the demo (`npm run demo`, port 4201), a "Not medical advice" note for the grimoire to come, and license (MIT). Add a screenshot: copy `test-results/today.png` to `docs/screenshots/today.png` and link it. No em dashes.

- [ ] **Step 4: Write `NOTICE.md`**

```markdown
# Third-party notices

- Cormorant Garamond, by Christian Thalmann. SIL Open Font License 1.1. Bundled through @fontsource/cormorant-garamond.
- EB Garamond, by Georg Duffner and Octavio Pardo. SIL Open Font License 1.1. Bundled through @fontsource/eb-garamond.
- Lucide icons. ISC License.

All botanical drawings, the icon, the corner vines, the frame ornaments and the wax seal are original to this repository.
```

Check the font authors on each package's page (`npm view @fontsource/cormorant-garamond` and `npm view @fontsource/eb-garamond`) and correct them if they differ.

- [ ] **Step 5: Run `/unslop` on README.md and AGENTS.md, then commit**

```bash
git add -A
git commit -m "Add README, AGENTS, CLAUDE and third-party notices" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Ship Stage 1

These steps touch GitHub and the user's computer. Ask Stephanie before each one marked **(ask)**.

- [ ] **Step 1: Full check**

```bash
npx vitest run && npm run test:e2e && npm run build
```

Expected: everything passes and the build succeeds.

- [ ] **Step 2: Create the public GitHub repo (ask)**

```bash
gh repo create HelloSteph1975/the-apothecary --public --source . --remote origin --description "A witchy home apothecary keeper that runs on your own computer."
git push -u origin main
git push -u origin docs/design-spec feat/stage-1-foundation
```

Then ask Stephanie to turn on Greptile for the new repo in the Greptile dashboard.

- [ ] **Step 3: Evidence**

Use `/evidence-driven-testing` to record the walk-through (open each drawer, save a name, back up, see the greeting). Use `/before-and-after` with "before" = no app (empty repo) and "after" = the Today page.

- [ ] **Step 4: Open the PR**

Title: `Stage 1: foundation, cabinet and Today`. Body: what's in it, how to try it, the evidence, and what the next stages add. Run `/unslop` on the title and body. End the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 5: Review loop**

Run `/greploop` until Greptile gives 5/5 with no open comments.

- [ ] **Step 6: Install on Stephanie's computer (ask)**

After merge: `npm run setup`, then (after a yes) `npm run install-windows`, then start the task and check `http://127.0.0.1:4197/api/health`. Update the port list in `C:\Users\S_Lip\.claude\CLAUDE.md`: add `The Apothecary 4197 (demo 4201, browser tests 4203)` and set "Next free" to 4205. Add The Apothecary to the "Still active" list there.

---

## Later stages

Each gets its own plan, written when the stage before it is merged:

2. Grimoire (30 starter herbs with correspondences and garden notes) and Herb cabinet; photos route and gallery; `/api/today`.
3. Recipe book with user-managed recipe types, and Batch journal.
4. Sky and tradition: `astronomy-engine`, moon phase and sign, day rulers, Wheel of the Year, timing rules and suggestions.
5. Calendar and To-do list.
6. Journal and photo gallery view.
7. Garden log with garden correspondences.
8. Labels and Shopping list.
