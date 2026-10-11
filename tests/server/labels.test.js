process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, describe } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { LABEL_SIZES } from '../../server/services/labelSizes.js';
import { skyFacts } from '../../server/lib/sky.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const s = { h: t.http, r, db: t.ctx.db };
  s.herb = (body = {}) => r.herbs.create({ common_name: 'Sage', latin_name: 'Salvia officinalis', ...body });
  s.jar = (body = {}) => s.h().post('/api/items').send({ section_id: 1, name: 'Sage jar', unit: 'g', amount: 5, ...body }).then(res => res.body);
  s.type = (body = {}) => r.recipeTypes.create({ name: 'Salve', ...body });
  s.batch = (body = {}) => {
    const id = Number(s.db.prepare('INSERT INTO batches (name, start_date, type_id, finished_on, expires_on, item_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(body.name ?? 'Cold care', body.start_date ?? '2026-10-11', body.type_id ?? null, body.finished_on ?? null, body.expires_on ?? null, body.item_id ?? null).lastInsertRowid);
    (body.ingredients ?? []).forEach(([name, herb_id], i) => s.db.prepare('INSERT INTO batch_ingredients (batch_id, name, herb_id, sort_order) VALUES (?, ?, ?, ?)').run(id, name, herb_id ?? null, i));
    return id;
  };
  s.data = (q = '') => s.h().get(`/api/labels/data${q}`);
  return s;
}

describe('sizes', () => {
  it('lists the three sizes with the sheet layout', async () => {
    const { h } = setup();
    const res = await h().get('/api/labels/sizes');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(LABEL_SIZES);
    expect(res.body.map(s => s.key)).toEqual(['small-round', 'medium-rect', 'large-rect']);
    expect(res.body[1]).toEqual({
      key: 'medium-rect', name: 'Medium rectangle', shape: 'rect', width: 3.5, height: 2, cols: 2, rows: 5,
      left: 0.5, top: 0.5, pitchX: 4, pitchY: 2, perSheet: 10,
      fields: ['name', 'latin_name', 'made_on', 'expires_on', 'ingredients', 'caution'],
    });
    for (const s of res.body) expect(s.perSheet).toBe(s.cols * s.rows);
    expect(res.body[0].perSheet).toBe(12);
    expect(res.body[2].perSheet).toBe(6);
  });
});

describe('label data', () => {
  it('shapes a herb jar, with the moon phase and a caution that points to the herb', async () => {
    const s = setup();
    const herb = s.herb({ caution_pregnancy: 'Avoid in pregnancy.' });
    const jar = await s.jar({ herb_id: herb.id, latin_name: 'Salvia officinalis', acquired_on: '2026-10-11', expires_on: '2027-04-11' });
    const res = await s.data(`?items=${jar.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{
      source: { kind: 'item', id: jar.id }, name: 'Sage jar', latin_name: 'Salvia officinalis', made_on: '2026-10-11',
      phase: skyFacts('2026-10-11').phase.name, expires_on: '2027-04-11', ingredients: null,
      caution: 'Check cautions for Sage before use.',
    }]);
  });

  it('gives a jar with no herb cautions and no date a null caution and phase', async () => {
    const s = setup();
    const herb = s.herb();
    const jar = await s.jar({ herb_id: herb.id });
    const [row] = (await s.data(`?items=${jar.id}`)).body;
    expect(row).toMatchObject({ made_on: null, phase: null, expires_on: null, caution: null, ingredients: null });
    const plain = await s.jar({ name: 'Plain' });
    expect((await s.data(`?items=${plain.id}`)).body[0].caution).toBeNull();
  });

  it('uses the finished batch that made a jar for ingredients and caution', async () => {
    const s = setup();
    const sage = s.herb({ common_name: 'Sage', caution_medications: 'Maybe.' });
    const mint = s.herb({ common_name: 'Mint', latin_name: 'Mentha' });
    const jarHerb = s.herb({ common_name: 'Rue', caution_pregnancy: 'No.' });
    const jar = await s.jar({ name: 'Tea blend', herb_id: jarHerb.id });
    s.batch({ item_id: jar.id, finished_on: '2026-10-12', ingredients: [['Sage leaf', sage.id], ['Mint', mint.id], ['Honey', null]] });
    const [row] = (await s.data(`?items=${jar.id}`)).body;
    expect(row.ingredients).toBe('Sage leaf, Mint, Honey');
    expect(row.caution).toBe('Check cautions for Sage before use.');
  });

  it('ignores an unfinished batch for a jar', async () => {
    const s = setup();
    const jar = await s.jar();
    s.batch({ item_id: jar.id, finished_on: null, ingredients: [['Sage', null]] });
    expect((await s.data(`?items=${jar.id}`)).body[0].ingredients).toBeNull();
  });

  it('shapes a batch with the type caution first, then the herb caution', async () => {
    const s = setup();
    const type = s.type({ label_caution: 'For external use only.' });
    const arnica = s.herb({ common_name: 'Arnica', caution_topical: 'Not on broken skin.' });
    const calendula = s.herb({ common_name: 'Calendula', caution_duration: 'Short term.' });
    const clover = s.herb({ common_name: 'Clover' });
    const id = s.batch({ name: 'Bruise salve', start_date: '2026-09-20', expires_on: '2027-03-20', type_id: type.id,
      ingredients: [['Arnica', arnica.id], ['Clover', clover.id], ['Calendula', calendula.id], ['Oil', null]] });
    const res = await s.data(`?batches=${id}`);
    expect(res.body).toEqual([{
      source: { kind: 'batch', id }, name: 'Bruise salve', latin_name: null, made_on: '2026-09-20',
      phase: skyFacts('2026-09-20').phase.name, expires_on: '2027-03-20', ingredients: 'Arnica, Clover, Calendula, Oil',
      caution: 'For external use only. Check cautions for Arnica, Calendula before use.',
    }]);
  });

  it('gives only the type caution when no herb has one, and null when neither applies', async () => {
    const s = setup();
    const type = s.type({ label_caution: 'Shake well.' });
    const a = s.batch({ type_id: type.id, ingredients: [['Oil', null]] });
    const b = s.batch({ ingredients: [['Oil', null]] });
    const body = (await s.data(`?batches=${a},${b}`)).body;
    expect(body.map(x => x.caution)).toEqual(['Shake well.', null]);
  });

  it('leaves out the caution of a soft-deleted recipe type', async () => {
    const s = setup();
    const type = s.type({ label_caution: 'For external use only.' });
    const id = s.batch({ type_id: type.id, ingredients: [['Oil', null]] });
    s.db.prepare("UPDATE recipe_types SET deleted_at = datetime('now') WHERE id = ?").run(type.id);
    expect((await s.data(`?batches=${id}`)).body[0].caution).toBeNull();
  });

  it('leaves out a deleted herb when working out cautions', async () => {
    const s = setup();
    const herb = s.herb({ caution_pregnancy: 'No.' });
    const id = s.batch({ ingredients: [['Sage', herb.id]] });
    s.db.prepare("UPDATE herbs SET deleted_at = datetime('now') WHERE id = ?").run(herb.id);
    expect((await s.data(`?batches=${id}`)).body[0].caution).toBeNull();
  });

  it('keeps the given order, jars first, and leaves out unknown and deleted ids', async () => {
    const s = setup();
    const j1 = await s.jar({ name: 'One' });
    const j2 = await s.jar({ name: 'Two' });
    const gone = await s.jar({ name: 'Gone' });
    await s.h().delete(`/api/items/${gone.id}`);
    const b1 = s.batch({ name: 'B1' });
    const b2 = s.batch({ name: 'B2' });
    const res = await s.data(`?items=${j2.id},9999,${gone.id},${j1.id}&batches=${b2},${b1}`);
    expect(res.body.map(x => x.name)).toEqual(['Two', 'One', 'B2', 'B1']);
    s.db.prepare("UPDATE batches SET deleted_at = datetime('now') WHERE id = ?").run(b1);
    expect((await s.data(`?batches=${b1}`)).body).toEqual([]);
  });

  it('allows 60 ids in all and refuses 61', async () => {
    const s = setup();
    const ids = n => Array.from({ length: n }, (_, i) => i + 1).join(',');
    expect((await s.data(`?items=${ids(40)}&batches=${ids(20)}`)).status).toBe(200);
    const res = await s.data(`?items=${ids(40)}&batches=${ids(21)}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/60/);
  });

  it('refuses ids that are not numbers', async () => {
    const s = setup();
    expect((await s.data('?items=1,abc')).status).toBe(400);
    expect((await s.data('?batches=0')).status).toBe(400);
    expect((await s.data('')).body).toEqual([]);
  });
});
