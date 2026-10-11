process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, describe } from 'vitest';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { migrations, migrate } from '../../server/db/migrations.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';
import { RELATED_TYPES } from '../../server/lib/repeat.js';
import { skyForDay } from '../../server/lib/sky.js';
import { validate } from '../../server/validate.js';
import {
  GARDEN_KINDS, GARDEN_TASKS, UNITS, gardenPlantSchema, gardenEntrySchema, TIMING_KINDS,
} from '../../server/schemas.js';
import {
  seedTimingRules, loadStarterRules, listTimingRules, daySuggestions, startDates, isGardenOnly, parseRule,
  TIMING_RULES_SEED_VERSION,
} from '../../server/services/timing.js';
import { seedRecipeTypes } from '../../server/services/recipeTypes.js';

let t;
afterEach(() => t?.cleanup());

const FILE = new URL('../../server/data/timing-rules.json', import.meta.url);
const SEED_KEY = 'timing_rules_seed_version';
const on = { sky_suggestions: 'on', hemisphere: 'north' };
const names = (db, type) => db.prepare(`SELECT name FROM sqlite_master WHERE type = '${type}' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map(r => r.name);
const rebuilt = db => db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('tasks', 'journal_links') AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

function versionEight() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (let i = 0; i < 8; i++) db.exec(migrations[i]);
  db.exec('PRAGMA user_version = 8');
  return db;
}

describe('migration 9', () => {
  it('creates the garden tables, indexes and the timing rule column', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    expect(migrations.length).toBeGreaterThanOrEqual(9);
    expect(names(db, 'table')).toEqual(expect.arrayContaining(['garden_plants', 'garden_entries']));
    expect(names(db, 'index')).toEqual(expect.arrayContaining([
      'idx_garden_plants_herb', 'idx_garden_entries_date', 'idx_garden_entries_plant', 'idx_garden_entries_herb',
    ]));
    expect(db.prepare("SELECT name, dflt_value FROM pragma_table_info('timing_rules') WHERE name = 'garden_tasks'").get())
      .toEqual({ name: 'garden_tasks', dflt_value: "'[]'" });
    expect(db.prepare("INSERT INTO garden_plants (name) VALUES ('Basil')").run().changes).toBe(1);
    const entry = kind => db.prepare("INSERT INTO garden_entries (entry_date, kind, plant_name) VALUES ('2026-10-10', ?, 'Basil')").run(kind);
    for (const kind of GARDEN_KINDS) expect(entry(kind).changes).toBe(1);
    expect(() => entry('nope')).toThrow();
    expect(() => db.prepare("INSERT INTO garden_entries (entry_date, kind, plant_name, amount) VALUES ('2026-10-10', 'harvested', 'Basil', -1)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO garden_entries (entry_date, kind, plant_name, unit) VALUES ('2026-10-10', 'harvested', 'Basil', 'cup')").run()).toThrow();
  });

  it('keeps every task, dismissal and journal link, widens both checks and keeps the indexes', () => {
    const db = versionEight();
    const run = (sql, ...a) => db.prepare(sql).run(...a);
    const indexesBefore = rebuilt(db);
    expect(indexesBefore.map(i => i.name)).toEqual(['idx_journal_links_entry', 'idx_journal_links_target', 'idx_tasks_auto_key', 'idx_tasks_due']);
    run("INSERT INTO tasks (id, title, notes, due_on, repeat_kind, repeat_days, repeat_anchor_day, priority, related_type, related_id, kind, auto_key, snoozed_until, done_on, spawned_id, created_at, updated_at, deleted_at) VALUES (5, 'Manual', 'n', '2026-10-11', 'weekly', '[1,3]', 7, 'high', 'herb', 3, 'manual', NULL, '2026-10-12', NULL, 9, '2026-10-01 00:00:00', '2026-10-02 00:00:00', NULL)");
    run("INSERT INTO tasks (id, title, kind, auto_key) VALUES (8, 'Auto', 'auto', 'restock:1:0')");
    run("INSERT INTO tasks (id, title, deleted_at) VALUES (11, 'Gone', '2026-01-01T00:00:00.000Z')");
    run("INSERT INTO task_dismissals (auto_key, dismissed_on) VALUES ('step:2:1', '2026-10-09')");
    run("INSERT INTO journal_types (id, name) VALUES (1, 'Ritual')");
    run("INSERT INTO journal_entries (id, type_id, title, entry_date) VALUES (1, 1, 'Day', '2026-10-09')");
    run("INSERT INTO journal_links (id, entry_id, link_type, link_id) VALUES (4, 1, 'herb', 7), (6, 1, 'batch', 2)");
    const tasksBefore = db.prepare('SELECT * FROM tasks ORDER BY id').all();
    const linksBefore = db.prepare('SELECT * FROM journal_links ORDER BY id').all();

    migrate(db);

    expect(db.prepare('PRAGMA user_version').get().user_version).toBe(migrations.length);
    expect(db.prepare('SELECT * FROM tasks ORDER BY id').all()).toEqual(tasksBefore);
    expect(db.prepare('SELECT * FROM journal_links ORDER BY id').all()).toEqual(linksBefore);
    expect(db.prepare('SELECT * FROM task_dismissals').all()).toHaveLength(1);
    expect(rebuilt(db)).toEqual(indexesBefore);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()) {
      for (const fk of db.prepare(`PRAGMA foreign_key_list(${name})`).all()) expect(['tasks', 'journal_links']).not.toContain(fk.table);
    }
    // the auto key stays unique among live tasks, and the new types are accepted
    expect(() => run("INSERT INTO tasks (title, kind, auto_key) VALUES ('Dup', 'auto', 'restock:1:0')")).toThrow();
    for (const type of ['item', 'recipe', 'batch', 'herb', 'garden_plant']) {
      expect(() => run('INSERT INTO tasks (title, related_type, related_id) VALUES (?, ?, 1)', 't', type)).not.toThrow();
    }
    expect(() => run("INSERT INTO tasks (title, related_type) VALUES ('t', 'nope')")).toThrow();
    for (const type of ['herb', 'recipe', 'batch', 'garden_entry']) {
      expect(() => run('INSERT INTO journal_links (entry_id, link_type, link_id) VALUES (1, ?, 1)', type)).not.toThrow();
    }
    expect(() => run("INSERT INTO journal_links (entry_id, link_type, link_id) VALUES (1, 'nope', 1)")).toThrow();
    db.close();
  });
});

describe('schemas, repos and owners', () => {
  it('exposes the garden kinds, tasks and schemas', () => {
    expect(GARDEN_KINDS).toEqual(['planted', 'sowed', 'transplanted', 'pruned', 'harvested', 'foraged', 'observed']);
    expect(GARDEN_TASKS).toEqual(['sow-above', 'sow-root', 'transplant', 'prune', 'weed', 'harvest-above', 'harvest-root']);
    expect(validate(gardenPlantSchema, { name: 'Basil', planted_on: '2026-05-01' }).errors).toBeUndefined();
    expect(validate(gardenPlantSchema, { name: '' }).errors).toBeDefined();
    expect(validate(gardenEntrySchema, { entry_date: '2026-10-10', kind: 'harvested', amount: 3, unit: UNITS[0] }).errors).toBeUndefined();
    expect(validate(gardenEntrySchema, { entry_date: '2026-10-10', kind: 'nope' }).errors).toBeDefined();
    expect(validate(gardenEntrySchema, { entry_date: '2026-10-10', kind: 'pruned', amount: -1 }).errors).toBeDefined();
    expect(validate(gardenEntrySchema, { kind: 'pruned' }).errors).toBeDefined();
    expect(RELATED_TYPES).toContain('garden_plant');
    expect(PHOTO_OWNERS.garden_plant).toBe('garden_plants');
    expect(PHOTO_OWNERS.garden_entry).toBe('garden_entries');
  });

  it('lists plants by name and entries newest first', () => {
    t = makeTestContext();
    const r = repos(t.ctx.db);
    r.gardenPlants.create({ name: 'mint' });
    r.gardenPlants.create({ name: 'Basil' });
    expect(r.gardenPlants.list().map(p => p.name)).toEqual(['Basil', 'mint']);
    r.gardenEntries.create({ entry_date: '2026-10-01', kind: 'sowed', plant_name: 'Basil' });
    r.gardenEntries.create({ entry_date: '2026-10-09', kind: 'pruned', plant_name: 'Basil' });
    const same = r.gardenEntries.create({ entry_date: '2026-10-09', kind: 'observed', plant_name: 'Basil' });
    expect(r.gardenEntries.list().map(e => e.kind)).toEqual(['observed', 'pruned', 'sowed']);
    expect(r.gardenEntries.list()[0].id).toBe(same.id);
    const rule = r.timingRules.create({ kind: 'phase', value: 'full', text: 'x', garden_tasks: '["prune"]' });
    expect(r.timingRules.get(rule.id).garden_tasks).toBe('["prune"]');
  });
});

describe('starter file and seeding', () => {
  const rules = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const garden = rules.filter(r => r.since !== undefined);

  it('has 29 valid rules and since only on the ten garden rules', () => {
    expect(rules).toHaveLength(29);
    expect(new Set(rules.map(r => r.slug)).size).toBe(29);
    expect(garden).toHaveLength(10);
    expect(garden.every(r => r.since === 2 && r.garden_tasks.length > 0)).toBe(true);
    expect(rules.filter(r => r.since === undefined).every(r => !r.garden_tasks)).toBe(true);
    for (const r of rules) {
      expect(TIMING_KINDS).toContain(r.kind);
      expect(r.text.length).toBeLessThanOrEqual(300);
      expect(r.text).not.toMatch(/[–—]/);
      for (const g of r.garden_tasks ?? []) expect(GARDEN_TASKS).toContain(g);
      expect((r.garden_tasks ?? []).length).toBeLessThanOrEqual(7);
    }
    for (const r of garden) {
      expect(r.recipe_types ?? []).toEqual([]);
      expect(r.planets ?? []).toEqual([]);
      expect(r.elements ?? []).toEqual([]);
    }
  });

  it('seeds all 29 on a fresh database, with garden tasks stored as text', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    expect(TIMING_RULES_SEED_VERSION).toBe(2);
    expect(seedTimingRules(db)).toEqual({ added: 29 });
    expect(db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_KEY).value).toBe('2');
    const row = db.prepare("SELECT garden_tasks FROM timing_rules WHERE slug = 'garden-waxing-sow'").get();
    expect(JSON.parse(row.garden_tasks)).toEqual(['sow-above', 'transplant']);
    expect(listTimingRules(db).find(r => r.slug === 'garden-waxing-sow').garden_tasks).toEqual(['sow-above', 'transplant']);
    expect(listTimingRules(db).find(r => r.slug === 'yule').garden_tasks).toEqual([]);
  });

  it('adds only the garden rules to a version 1 database and keeps edits and deletions', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    seedTimingRules(db, loadStarterRules().filter(r => r.since === undefined));
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run('1', SEED_KEY);
    const r = repos(db).timingRules;
    const waxing = db.prepare("SELECT id FROM timing_rules WHERE slug = 'waxing-build'").get().id;
    const yule = db.prepare("SELECT id FROM timing_rules WHERE slug = 'yule'").get().id;
    r.update(waxing, { text: 'Mine now.' });
    r.remove(yule);
    expect(db.prepare('SELECT COUNT(*) n FROM timing_rules').get().n).toBe(19);
    expect(seedTimingRules(db)).toEqual({ added: 10 });
    expect(db.prepare('SELECT COUNT(*) n FROM timing_rules').get().n).toBe(29);
    expect(r.get(waxing).text).toBe('Mine now.');
    expect(r.get(yule)).toBeNull();
    expect(db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_KEY).value).toBe('2');
    expect(db.prepare("SELECT COUNT(*) n FROM timing_rules WHERE garden_tasks <> '[]'").get().n).toBe(10);
  });

  it('does not re-add a deleted garden rule, even after it is purged', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    seedTimingRules(db);
    const id = db.prepare("SELECT id FROM timing_rules WHERE slug = 'garden-new-rest'").get().id;
    repos(db).timingRules.remove(id);
    expect(seedTimingRules(db)).toEqual({ added: 0 });
    db.prepare('DELETE FROM timing_rules WHERE id = ?').run(id);
    expect(seedTimingRules(db)).toEqual({ added: 0 });
    expect(db.prepare("SELECT COUNT(*) n FROM timing_rules WHERE slug = 'garden-new-rest'").get().n).toBe(0);
  });
});

describe('garden_tasks on rules', () => {
  const post = body => t.http().post('/api/timing-rules').send({ kind: 'phase', value: 'full', text: 'Garden note.', ...body });

  it('saves a deduplicated list on create and update, and returns an array', async () => {
    t = makeTestContext();
    let res = await post({ garden_tasks: ['prune', 'weed', 'prune'] });
    expect(res.status).toBe(201);
    expect(res.body.garden_tasks).toEqual(['prune', 'weed']);
    const id = res.body.id;
    res = await t.http().patch(`/api/timing-rules/${id}`).send({ garden_tasks: ['harvest-root'] });
    expect(res.body.garden_tasks).toEqual(['harvest-root']);
    res = await t.http().patch(`/api/timing-rules/${id}`).send({ text: 'Only text.' });
    expect(res.body.garden_tasks).toEqual(['harvest-root']);
    res = await t.http().patch(`/api/timing-rules/${id}`).send({ garden_tasks: [] });
    expect(res.body.garden_tasks).toEqual([]);
    expect((await post({})).body.garden_tasks).toEqual([]);
  });

  it('rejects unknown keys, non-lists and more than seven', async () => {
    t = makeTestContext();
    for (const garden_tasks of [['dance'], 'prune', [3], ['']]) {
      const res = await post({ garden_tasks });
      expect(res.status).toBe(400);
      expect(res.body.details.garden_tasks).toBeTruthy();
    }
    const id = (await post({})).body.id;
    const res = await t.http().patch(`/api/timing-rules/${id}`).send({ garden_tasks: ['nope'] });
    expect(res.status).toBe(400);
    expect(res.body.details.garden_tasks).toBeTruthy();
    expect((await post({ garden_tasks: [...GARDEN_TASKS, 'prune'] })).status).toBe(201); // the repeat collapses to seven
    const tooMany = await post({ garden_tasks: [...GARDEN_TASKS, 'dance'] });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.details.garden_tasks).toBeTruthy();
  });
});

describe('garden-only rules stay out of the sky suggestions', () => {
  it('knows a garden-only rule', () => {
    expect(isGardenOnly({ garden_tasks: ['prune'], recipe_types: [], planets: [], elements: [] })).toBe(true);
    expect(isGardenOnly({ garden_tasks: ['prune'], recipe_types: ['salve'], planets: [], elements: [] })).toBe(false);
    expect(isGardenOnly({ garden_tasks: ['prune'], recipe_types: [], planets: ['Sun'], elements: [] })).toBe(false);
    expect(isGardenOnly({ garden_tasks: ['prune'], recipe_types: [], planets: [], elements: ['Fire'] })).toBe(false);
    expect(isGardenOnly({ garden_tasks: [], recipe_types: [], planets: [], elements: [] })).toBe(false);
    expect(isGardenOnly(parseRule({ garden_tasks: '["weed"]', recipe_types: '[]', planets: '[]', elements: '[]' }))).toBe(true);
  });

  it('returns no garden-only rule on a full moon Friday', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    seedTimingRules(db);
    let day = null;
    for (let i = 0; i < 1500 && !day; i++) {
      const date = new Date(Date.UTC(2026, 9, 1 + i));
      if (date.getUTCDay() !== 5) continue; // Fridays only; the sky maths is the slow part
      const d = date.toISOString().slice(0, 10);
      const sky = skyForDay(d, { hemisphere: 'north' });
      if (sky.phase.name === 'full' && sky.ruler === 'Venus') day = d;
    }
    expect(day).not.toBeNull();
    const gardenIds = new Set(listTimingRules(db).filter(isGardenOnly).map(r => r.id));
    expect(gardenIds.size).toBe(10);
    // garden-full-gather and garden-friday-flowers both match, so they would show if they were not skipped
    expect(daySuggestions(db, day, on).suggestions.some(s => gardenIds.has(s.id))).toBe(false);
    for (const { id } of db.prepare("SELECT id FROM timing_rules WHERE garden_tasks = '[]'").all()) repos(db).timingRules.remove(id);
    expect(daySuggestions(db, day, on).suggestions).toEqual([]);
  }, 60000);

  it('ignores them when picking start dates', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    seedTimingRules(db);
    seedRecipeTypes(db);
    const type = db.prepare("SELECT id FROM recipe_types WHERE slug = 'tincture'").get();
    const recipe = repos(db).recipes.create({ name: 'Tincture', type_id: type.id });
    const gardenTexts = new Set(loadStarterRules().filter(r => r.since).map(r => r.text));
    const res = startDates(db, recipe.id, { from: '2026-10-11', days: 60 }, on);
    expect(res.length).toBeGreaterThan(0);
    for (const d of res) for (const reason of d.reasons) expect(gardenTexts.has(reason)).toBe(false);
    for (const { id } of db.prepare("SELECT id FROM timing_rules WHERE garden_tasks = '[]'").all()) repos(db).timingRules.remove(id);
    expect(startDates(db, recipe.id, { from: '2026-10-11', days: 60 }, on)).toEqual([]);
  });
});
