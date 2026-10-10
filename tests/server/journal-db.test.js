import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { migrations } from '../../server/db/migrations.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';
import { JOURNAL_ICONS, MOODS, JOURNAL_LINK_TYPES } from '../../server/schemas.js';
import { seedJournalTypes, loadStarterJournalTypes, JOURNAL_TYPES_SEED_VERSION } from '../../server/services/journalTypes.js';

let t;
afterEach(() => t?.cleanup());

it('migration 8 creates the journal tables', () => {
  t = makeTestContext();
  expect(migrations.length).toBeGreaterThanOrEqual(8);
  const names = t.ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  expect(names).toEqual(expect.arrayContaining(['journal_types', 'journal_entries', 'journal_links', 'journal_tags']));
  expect(() => t.ctx.db.prepare("INSERT INTO journal_links (entry_id, link_type, link_id) VALUES (1, 'item', 1)").run()).toThrow();
});

it('exposes the schema lists and the journal photo owner', () => {
  expect(PHOTO_OWNERS.journal).toBe('journal_entries');
  expect(JOURNAL_ICONS).toHaveLength(12);
  expect(MOODS).toHaveLength(8);
  expect(JOURNAL_LINK_TYPES).toEqual(['herb', 'recipe', 'batch']);
});

it('the starter journal types file has 8 valid entries with plain dashes', () => {
  const entries = loadStarterJournalTypes();
  expect(entries).toHaveLength(8);
  expect(entries.map(e => e.slug)).toEqual(['ritual', 'moon-observance', 'festival', 'dream', 'garden', 'foraging-walk', 'reflection', 'note']);
  expect(new Set(entries.map(e => e.slug)).size).toBe(8);
  for (const e of entries) { expect(JOURNAL_ICONS).toContain(e.icon); expect(e.name && e.description).toBeTruthy(); }
  const text = fs.readFileSync(path.join(import.meta.dirname, '../../server/data/journal-types.json'), 'utf8');
  expect(text).not.toMatch(/[–—]/);
});

it('seeds 8 types in order as starters, once', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  expect(seedJournalTypes(db)).toEqual({ added: 8 });
  const types = repos(db).journalTypes.list();
  expect(types.map(x => x.name)).toEqual(loadStarterJournalTypes().map(e => e.name));
  expect(types.every(x => x.is_starter === 1)).toBe(true);
  expect(types.map(x => x.sort_order)).toEqual([...Array(8).keys()]);
  expect(types[0]).toMatchObject({ slug: 'ritual', icon: 'sparkles' });
  expect(db.prepare("SELECT value FROM settings WHERE key = 'journal_types_seed_version'").get().value).toBe(String(JOURNAL_TYPES_SEED_VERSION));
  expect(seedJournalTypes(db)).toEqual({ added: 0 });
  expect(repos(db).journalTypes.list()).toHaveLength(8);
});

it('keeps her edits and does not re-add a deleted type', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  seedJournalTypes(db);
  const r = repos(db);
  const [ritual, , , dream] = r.journalTypes.list();
  r.journalTypes.update(ritual.id, { name: 'My workings' });
  r.journalTypes.remove(dream.id);
  db.prepare("DELETE FROM settings WHERE key = 'journal_types_seed_version'").run();
  expect(seedJournalTypes(db)).toEqual({ added: 0 });
  const live = r.journalTypes.list();
  expect(live).toHaveLength(7);
  expect(live[0].name).toBe('My workings');
  expect(live.some(x => x.slug === 'dream')).toBe(false);
});
