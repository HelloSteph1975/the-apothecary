process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, describe } from 'vitest';
import fs from 'node:fs';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { skyForDay, SIGNS, PHASE_NAMES, PHASE_GROUPS, FESTIVALS } from '../../server/lib/sky.js';
import { PLANETS, ELEMENTS } from '../../server/schemas.js';
import { getSettings } from '../../server/services/settings.js';
import { seedRecipeTypes } from '../../server/services/recipeTypes.js';
import {
  seedTimingRules, loadStarterRules, rulesForDay, todaySuggestions, startDates, listTimingRules,
  TIMING_RULES_SEED_VERSION,
} from '../../server/services/timing.js';

let t;
afterEach(() => t?.cleanup());

const FILE = new URL('../../server/data/timing-rules.json', import.meta.url);
const count = () => t.ctx.db.prepare('SELECT COUNT(*) n FROM timing_rules').get().n;
const rule = (o = {}) => ({ kind: 'phase_group', value: 'waxing', text: 'A test rule.', weight: 1, sort_order: 0, ...o });
const J = a => JSON.stringify(a);

describe('starter file', () => {
  const rules = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const valid = {
    phase_group: PHASE_GROUPS, phase: PHASE_NAMES, moon_element: ELEMENTS, moon_sign: SIGNS, day_ruler: PLANETS,
    festival: FESTIVALS.map(f => f.name),
  };
  it('has 19 well-formed rules', () => {
    expect(rules).toHaveLength(19);
    expect(new Set(rules.map(r => r.slug)).size).toBe(19);
    for (const r of rules) {
      expect(Object.keys(valid)).toContain(r.kind);
      expect(valid[r.kind]).toContain(r.value);
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.text.length).toBeLessThanOrEqual(300);
      expect(r.text).not.toMatch(/[–—]/);
      expect([1, 2, 3]).toContain(r.weight);
      for (const p of r.planets) expect(PLANETS).toContain(p);
      for (const e of r.elements) expect(ELEMENTS).toContain(e);
      for (const s of r.recipe_types) expect(s).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });
  it('only names recipe types that exist in the starter recipe types', () => {
    const slugs = new Set(JSON.parse(fs.readFileSync(new URL('../../server/data/recipe-types.json', import.meta.url), 'utf8')).map(x => x.slug));
    for (const r of rules) for (const s of r.recipe_types) expect(slugs.has(s), `${r.slug}: ${s}`).toBe(true);
  });
});

describe('seeding', () => {
  it('adds the 19 starters once, hides the key, and keeps her edits and deletions', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    expect(seedTimingRules(db)).toEqual({ added: 19 });
    expect(count()).toBe(19);
    expect(getSettings(db)).not.toHaveProperty('timing_rules_seed_version');
    expect(db.prepare("SELECT value FROM settings WHERE key = 'timing_rules_seed_version'").get().value).toBe(String(TIMING_RULES_SEED_VERSION));
    const r = repos(db).timingRules;
    const waxing = db.prepare("SELECT id FROM timing_rules WHERE slug = 'waxing-build'").get().id;
    const yule = db.prepare("SELECT id FROM timing_rules WHERE slug = 'yule'").get().id;
    r.update(waxing, { text: 'Mine now.' });
    r.remove(yule);
    expect(seedTimingRules(db)).toEqual({ added: 0 });
    expect(r.get(waxing).text).toBe('Mine now.');
    expect(count()).toBe(19);
    expect(r.get(yule)).toBeNull();
  });
  it('does not bring a deleted rule back even when a newer seed version adds entries', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    const starters = loadStarterRules();
    seedTimingRules(db, starters);
    const id = db.prepare("SELECT id FROM timing_rules WHERE slug = 'samhain'").get().id;
    repos(db).timingRules.remove(id);
    db.prepare("DELETE FROM settings WHERE key = 'timing_rules_seed_version'").run();
    expect(seedTimingRules(db, [...starters, { ...starters[0], slug: 'brand-new' }])).toEqual({ added: 1 });
    expect(count()).toBe(20);
    expect(db.prepare("SELECT deleted_at FROM timing_rules WHERE slug = 'samhain'").get().deleted_at).not.toBeNull();
  });
  it('stores the lists as text and the API returns arrays', async () => {
    t = makeTestContext();
    seedTimingRules(t.ctx.db);
    const res = await t.http().get('/api/timing-rules');
    expect(res.body).toHaveLength(19);
    expect(res.body[0]).toMatchObject({ slug: 'waxing-build', kind: 'phase_group', value: 'waxing', weight: 2, is_starter: 1 });
    expect(res.body[0].recipe_types).toEqual(['tincture', 'glycerite', 'infused-oil', 'oxymel', 'vinegar', 'syrup']);
    expect(res.body[4].planets).toEqual(['Saturn', 'Venus']);
  });
});

describe('rule routes and validation', () => {
  it('creates, edits, deletes and restores', async () => {
    t = makeTestContext();
    const h = t.http;
    let res = await h().post('/api/timing-rules').send({
      kind: 'moon_sign', value: 'Cancer', text: ' Cancer moon. ', weight: 3, recipe_types: ['tincture'], planets: ['Moon'], elements: ['Water'],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'moon_sign', value: 'Cancer', text: 'Cancer moon.', weight: 3, recipe_types: ['tincture'], planets: ['Moon'],
      elements: ['Water'], is_starter: 0, slug: null,
    });
    const id = res.body.id;
    res = await h().post('/api/timing-rules').send({ kind: 'festival', value: 'Yule', text: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ weight: 1, recipe_types: [], planets: [], elements: [], sort_order: 1 });
    res = await h().patch(`/api/timing-rules/${id}`).send({ text: 'Edited', weight: 1, planets: [] });
    expect(res.body).toMatchObject({ text: 'Edited', weight: 1, planets: [], value: 'Cancer' });
    res = await h().get('/api/timing-rules');
    expect(res.body.map(r => r.id)).toContain(id);
    res = await h().delete(`/api/timing-rules/${id}`);
    expect(res.body.restore).toBe(`/api/timing-rules/${id}/restore`);
    expect((await h().get('/api/timing-rules')).body.map(r => r.id)).not.toContain(id);
    res = await h().post(res.body.restore);
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Edited');
    expect((await h().patch('/api/timing-rules/9999').send({ text: 'x' })).status).toBe(404);
    expect((await h().delete('/api/timing-rules/9999')).status).toBe(404);
  });

  const bad = async (body, field, method = 'post', url = '/api/timing-rules') => {
    const res = await t.http()[method](url).send(body);
    expect(res.status, J(res.body)).toBe(400);
    expect(res.body.details[field], J(res.body)).toBeTruthy();
  };

  it('reports each bad field', async () => {
    t = makeTestContext();
    await bad({ value: 'waxing', text: 'x' }, 'kind');
    await bad({ kind: 'sunrise', value: 'x', text: 'x' }, 'kind');
    await bad({ kind: 'phase', text: 'x' }, 'value');
    await bad({ kind: 'phase', value: 'waxing', text: 'x' }, 'value');
    await bad({ kind: 'phase_group', value: 'full moon', text: 'x' }, 'value');
    await bad({ kind: 'moon_element', value: 'Aries', text: 'x' }, 'value');
    await bad({ kind: 'moon_sign', value: 'Earth', text: 'x' }, 'value');
    await bad({ kind: 'day_ruler', value: 'Pluto', text: 'x' }, 'value');
    await bad({ kind: 'festival', value: 'Christmas', text: 'x' }, 'value');
    await bad({ kind: 'festival', value: 'Yule' }, 'text');
    await bad({ kind: 'festival', value: 'Yule', text: 'a'.repeat(301) }, 'text');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', weight: 4 }, 'weight');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', weight: 0 }, 'weight');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', planets: ['Pluto'] }, 'planets');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', planets: 'Sun' }, 'planets');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', elements: ['Ether'] }, 'elements');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', recipe_types: [''] }, 'recipe_types');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', recipe_types: ['a'.repeat(41)] }, 'recipe_types');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', recipe_types: Array.from({ length: 21 }, (_, i) => `t${i}`) }, 'recipe_types');
    await bad({ kind: 'festival', value: 'Yule', text: 'x', recipe_types: [5] }, 'recipe_types');
  });

  it('checks the value against the kind on edit', async () => {
    t = makeTestContext();
    const made = (await t.http().post('/api/timing-rules').send(rule({ kind: 'phase_group', value: 'waxing' }))).body;
    await bad({ kind: 'moon_sign' }, 'value', 'patch', `/api/timing-rules/${made.id}`);
    await bad({ value: 'Leo' }, 'value', 'patch', `/api/timing-rules/${made.id}`);
    const ok = await t.http().patch(`/api/timing-rules/${made.id}`).send({ kind: 'moon_sign', value: 'Leo' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ kind: 'moon_sign', value: 'Leo' });
  });
});

describe('rulesForDay', () => {
  const add = o => repos(t.ctx.db).timingRules.create({ recipe_types: '[]', planets: '[]', elements: '[]', ...o });
  const sky = (o = {}) => ({
    day: '2026-10-11', phase: { name: 'waxing gibbous', group: 'waxing', illumination: 80 },
    moon: { sign: 'Cancer', element: 'Water', changes: [{ at: 'x', sign: 'Leo' }] }, ruler: 'Venus', festival: null, ...o,
  });
  it('matches each kind and ignores deleted rules', () => {
    t = makeTestContext();
    const mk = (kind, value) => add({ kind, value, text: `${kind}:${value}`, sort_order: 0 });
    mk('phase_group', 'waxing'); mk('phase_group', 'waning');
    mk('phase', 'waxing gibbous'); mk('phase', 'full');
    mk('moon_element', 'Water'); mk('moon_element', 'Fire');
    mk('moon_sign', 'Cancer'); mk('moon_sign', 'Leo');
    mk('day_ruler', 'Venus'); mk('day_ruler', 'Mars');
    mk('festival', 'Yule');
    const gone = mk('festival', 'Samhain');
    repos(t.ctx.db).timingRules.remove(gone.id);
    expect(rulesForDay(t.ctx.db, sky()).map(r => r.text)).toEqual([
      'phase_group:waxing', 'phase:waxing gibbous', 'moon_element:Water', 'moon_sign:Cancer', 'day_ruler:Venus',
    ]);
    expect(rulesForDay(t.ctx.db, sky({ festival: 'Yule', ruler: 'Mars' })).map(r => r.text)).toContain('festival:Yule');
    expect(rulesForDay(t.ctx.db, sky({ festival: 'Samhain' })).map(r => r.text)).not.toContain('festival:Samhain');
    expect(rulesForDay(t.ctx.db, sky({ festival: null })).map(r => r.kind)).not.toContain('festival');
  });
  it('returns parsed lists', () => {
    t = makeTestContext();
    add({ kind: 'day_ruler', value: 'Venus', text: 'v', planets: '["Venus"]', recipe_types: '["balm"]' });
    expect(rulesForDay(t.ctx.db, sky())[0]).toMatchObject({ planets: ['Venus'], recipe_types: ['balm'], elements: [] });
  });
});

describe('todaySuggestions', () => {
  const on = { sky_suggestions: 'on', hemisphere: 'north' };
  const add = o => repos(t.ctx.db).timingRules.create({ recipe_types: '[]', planets: '[]', elements: '[]', ...o });
  it('returns the two highest-weight matches, ties by sort order', () => {
    t = makeTestContext();
    const sky = skyForDay('2026-10-11');
    add({ kind: 'day_ruler', value: sky.ruler, text: 'low', weight: 1, sort_order: 0 });
    add({ kind: 'phase_group', value: sky.phase.group, text: 'mid-b', weight: 2, sort_order: 5 });
    add({ kind: 'moon_element', value: sky.moon.element, text: 'mid-a', weight: 2, sort_order: 3 });
    add({ kind: 'moon_sign', value: sky.moon.sign, text: 'top', weight: 3, sort_order: 9 });
    const res = todaySuggestions(t.ctx.db, '2026-10-11', on);
    expect(res.sky).toEqual(sky);
    expect(res.suggestions.map(s => s.text)).toEqual(['top', 'mid-a']);
    expect(Object.keys(res.suggestions[0]).sort()).toEqual(['id', 'text']);
  });
  it('gives none when suggestions are off, but still the sky', () => {
    t = makeTestContext();
    const sky = skyForDay('2026-10-11');
    add({ kind: 'day_ruler', value: sky.ruler, text: 'x' });
    const res = todaySuggestions(t.ctx.db, '2026-10-11', { ...on, sky_suggestions: 'off' });
    expect(res.suggestions).toEqual([]);
    expect(res.sky.phase.name).toBe(sky.phase.name);
  });
  it('uses her hemisphere for festivals', () => {
    t = makeTestContext();
    expect(todaySuggestions(t.ctx.db, '2026-12-21', on).sky.festival).toBe('Yule');
    expect(todaySuggestions(t.ctx.db, '2026-12-21', { ...on, hemisphere: 'south' }).sky.festival).toBe('Litha');
  });
});

describe('startDates', () => {
  const on = { sky_suggestions: 'on', hemisphere: 'north' };
  function recipeOf(typeSlug, herbPlanets = []) {
    const db = t.ctx.db;
    const r = repos(db);
    seedRecipeTypes(db);
    const type = db.prepare('SELECT id FROM recipe_types WHERE slug = ?').get(typeSlug);
    const recipe = r.recipes.create({ name: 'Test', type_id: type.id });
    herbPlanets.forEach((planet, i) => {
      const herb = r.herbs.create({ common_name: `Herb ${i}`, planet });
      r.recipeIngredients.create({ recipe_id: recipe.id, herb_id: herb.id, name: `Herb ${i}`, sort_order: i });
    });
    return recipe;
  }
  const days = n => Array.from({ length: n }, (_, i) => {
    const d = new Date(2026, 9, 11 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const lists = { recipe_types: '[]', planets: '[]', elements: '[]' };

  it('scores a tincture higher on waxing water-sign days (starter rules)', () => {
    t = makeTestContext();
    seedTimingRules(t.ctx.db);
    const recipe = recipeOf('tincture');
    const res = startDates(t.ctx.db, recipe.id, { from: '2026-10-11' }, on);
    expect(res.length).toBeGreaterThan(0);
    expect(res.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].score > res[i].score || (res[i - 1].score === res[i].score && res[i - 1].day < res[i].day)).toBe(true);
    }
    const rules = loadStarterRules();
    const expected = (day, s) => rules.filter(r => r.recipe_types.includes('tincture') && (
      (r.kind === 'phase_group' && r.value === s.phase.group) || (r.kind === 'phase' && r.value === s.phase.name)
      || (r.kind === 'moon_element' && r.value === s.moon.element) || (r.kind === 'moon_sign' && r.value === s.moon.sign)
      || (r.kind === 'day_ruler' && r.value === s.ruler) || (r.kind === 'festival' && r.value === s.festival)))
      .reduce((n, r) => n + r.weight, 0);
    const all = days(28).map(d => { const sky = skyForDay(d); return { d, sky, s: expected(d, sky) }; });
    for (const r of res) expect(r.score).toBe(all.find(x => x.d === r.day).s);
    expect(res[0].score).toBe(Math.max(...all.map(x => x.s)));
    const good = all.filter(x => x.sky.phase.group === 'waxing' && x.sky.moon.element === 'Water');
    const poor = all.filter(x => x.sky.phase.group === 'waning' && x.sky.moon.element !== 'Water');
    expect(good.length).toBeGreaterThan(0);
    expect(poor.length).toBeGreaterThan(0);
    expect(Math.min(...good.map(x => x.s))).toBeGreaterThan(Math.max(...poor.map(x => x.s)));
    expect(res[0]).toMatchObject({ sky: { phase: expect.any(String), sign: expect.any(String), ruler: expect.any(String) } });
    expect(res[0].reasons.length).toBeGreaterThan(0);
  });

  it('scores a moon sign rule on the days the moon is in that sign', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    repos(db).timingRules.create({ ...lists, kind: 'moon_sign', value: 'Cancer', text: 'Cancer moon.', weight: 3, recipe_types: '["tincture"]' });
    const recipe = recipeOf('tincture');
    const res = startDates(db, recipe.id, { from: '2026-10-11' }, on);
    const expected = days(28).filter(d => skyForDay(d).moon.sign === 'Cancer');
    expect(expected.length).toBeGreaterThan(0);
    expect(res.map(r => r.day)).toEqual(expected.slice(0, 5));
    expect(res.every(r => r.score === 3 && r.sky.sign === 'Cancer')).toBe(true);
  });

  it('scores a moon sign rule on the days the moon is in that sign', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    repos(db).timingRules.create({ ...lists, kind: 'moon_sign', value: 'Cancer', text: 'Cancer moon.', weight: 3, recipe_types: '["tincture"]' });
    const recipe = recipeOf('tincture');
    const res = startDates(db, recipe.id, { from: '2026-10-11' }, on);
    const expected = days(28).filter(d => skyForDay(d).moon.sign === 'Cancer');
    expect(expected.length).toBeGreaterThan(0);
    expect(res.map(r => r.day)).toEqual(expected.slice(0, 5));
    expect(res.every(r => r.score === 3 && r.sky.sign === 'Cancer')).toBe(true);
  });

  it('lets Venus herbs favour Fridays', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    repos(db).timingRules.create({ ...lists, kind: 'day_ruler', value: 'Venus', text: 'Friday work.', weight: 2, planets: '["Venus"]' });
    repos(db).timingRules.create({ ...lists, kind: 'day_ruler', value: 'Mars', text: 'Tuesday work.', weight: 2, planets: '["Mars"]' });
    const venus = recipeOf('infusion', ['Venus']);
    const res = startDates(db, venus.id, { from: '2026-10-11' }, on);
    expect(res.map(r => r.day)).toEqual(['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);
    expect(res[0]).toEqual({ day: '2026-10-16', score: 2, sky: expect.objectContaining({ ruler: 'Venus' }), reasons: ['Friday work.'] });
    const plain = recipeOf('infusion');
    expect(startDates(db, plain.id, { from: '2026-10-11' }, on)).toEqual([]);
  });

  it('counts a rule once even when type, planet and element all match, and uses herb elements', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    repos(db).timingRules.create({
      kind: 'day_ruler', value: 'Venus', text: 'Once.', weight: 3, planets: '["Venus"]', elements: '["Earth"]', recipe_types: '["infusion"]',
    });
    const recipe = recipeOf('infusion', ['Venus']);
    expect(startDates(db, recipe.id, { from: '2026-10-11' }, on)[0].score).toBe(3);
    const herb = repos(db).herbs.create({ common_name: 'Mint', element: 'Earth' });
    const other = recipeOf('salve');
    repos(db).recipeIngredients.create({ recipe_id: other.id, herb_id: herb.id, name: 'Mint', sort_order: 0 });
    expect(startDates(db, other.id, { from: '2026-10-11' }, on)[0].score).toBe(3);
  });

  it('ignores deleted herbs, returns nothing when off, and fails for a missing recipe', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    repos(db).timingRules.create({ ...lists, kind: 'day_ruler', value: 'Venus', text: 'F', weight: 1, planets: '["Venus"]' });
    const recipe = recipeOf('infusion', ['Venus']);
    expect(startDates(db, recipe.id, { from: '2026-10-11' }, { ...on, sky_suggestions: 'off' })).toEqual([]);
    db.prepare('UPDATE herbs SET deleted_at = ?').run(new Date().toISOString());
    expect(startDates(db, recipe.id, { from: '2026-10-11' }, on)).toEqual([]);
    expect(() => startDates(db, 9999, { from: '2026-10-11' }, on)).toThrow(/recipe/i);
  });

  it('defaults to today and follows the recipe type even if her type was deleted', () => {
    t = makeTestContext();
    const db = t.ctx.db;
    repos(db).timingRules.create({ ...lists, kind: 'phase_group', value: 'waxing', text: 'W', weight: 1, recipe_types: '["balm"]' });
    for (const value of ['waning', 'full', 'new']) repos(db).timingRules.create({ ...lists, kind: 'phase_group', value, text: 'N', weight: 1, recipe_types: '["balm"]' });
    const recipe = recipeOf('balm');
    db.prepare('UPDATE recipe_types SET deleted_at = ? WHERE slug = ?').run(new Date().toISOString(), 'balm');
    const res = startDates(db, recipe.id, {}, on);
    expect(res).toHaveLength(5);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(res.every(r => r.day >= today)).toBe(true);
    expect(res[0].day).toBe(today);
  });
});

describe('list', () => {
  it('orders by sort order', () => {
    t = makeTestContext();
    const r = repos(t.ctx.db).timingRules;
    const base = { recipe_types: '[]', planets: '[]', elements: '[]', kind: 'festival', value: 'Yule' };
    r.create({ ...base, text: 'b', sort_order: 2 });
    r.create({ ...base, text: 'a', sort_order: 1 });
    expect(listTimingRules(t.ctx.db).map(x => x.text)).toEqual(['a', 'b']);
  });
});
