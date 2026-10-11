process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach, describe } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { skyFacts, moonSignAt, localNoon } from '../../server/lib/sky.js';
import { entryTitle } from '../../server/services/garden.js';
import { stampSky } from '../../server/services/journal.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const herb = r.herbs.create({
    common_name: 'Calendula', latin_name: 'Calendula officinalis', garden_harvest_part: 'flower', garden_harvest_timing: 'Pick open blooms',
    garden_sun: 'Full sun', garden_water: 'Moderate', garden_companions: JSON.stringify(['Tomato', 'Basil']),
  });
  const s = { h: t.http, r, herb };
  s.plant = (body = {}) => s.h().post('/api/garden/plants').send({ name: 'Calendula bed', ...body }).then(res => res.body);
  s.entry = (body = {}) => s.h().post('/api/garden/entries').send({ entry_date: '2026-10-10', kind: 'observed', plant_name: 'Sage', ...body }).then(res => res.body);
  return s;
}

it('builds an entry title from the kind and the stored plant name', () => {
  expect(entryTitle('harvested', 'Calendula')).toBe('Harvested Calendula');
  expect(entryTitle('sowed', 'sweet basil')).toBe('Sowed sweet basil');
});

describe('plants', () => {
  it('creates a plant, naming it after the herb when the name is empty', async () => {
    const { h, herb } = setup();
    const res = await h().post('/api/garden/plants').send({ herb_id: herb.id, name: '', place: 'Front bed', planted_on: '2026-04-01', expected_harvest_on: '2026-07-01' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ name: 'Calendula', place: 'Front bed', herb: { id: herb.id, name: 'Calendula', live: true }, entries: [], photos: [] });
    expect(res.body.garden_notes).toEqual({
      garden_harvest_part: 'flower', garden_harvest_timing: 'Pick open blooms', garden_sun: 'Full sun', garden_water: 'Moderate',
      garden_companions: ['Tomato', 'Basil'],
    });
  });

  it('has no garden notes without a live herb and checks the herb is live', async () => {
    const { h, herb } = setup();
    const p = await h().post('/api/garden/plants').send({ name: 'Mystery vine' });
    expect(p.body.garden_notes).toBeNull();
    expect(p.body.herb).toBeNull();
    repos(t.ctx.db).herbs.remove(herb.id);
    const bad = await h().post('/api/garden/plants').send({ name: 'X', herb_id: herb.id });
    expect(bad.status).toBe(400);
    expect(bad.body.details.herb_id).toBeTruthy();
    const none = await h().post('/api/garden/plants').send({ name: '' });
    expect(none.status).toBe(400);
    expect(none.body.details.name).toBeTruthy();
  });

  it('refuses end and harvest dates before planting, and dates outside 1900 to 2100', async () => {
    const { h } = setup();
    const a = await h().post('/api/garden/plants').send({ name: 'A', planted_on: '2026-05-01', ended_on: '2026-04-30' });
    expect(a.status).toBe(400);
    expect(a.body.details.ended_on).toBeTruthy();
    const b = await h().post('/api/garden/plants').send({ name: 'B', planted_on: '2026-05-01', expected_harvest_on: '2026-04-01' });
    expect(b.body.details.expected_harvest_on).toBeTruthy();
    const c = await h().post('/api/garden/plants').send({ name: 'C', planted_on: '1850-05-01' });
    expect(c.body.details.planted_on).toBe('Pick a date between 1900 and 2100');
    const ok = await h().post('/api/garden/plants').send({ name: 'D', planted_on: '2026-05-01', ended_on: '2026-05-01' });
    expect(ok.status).toBe(201);
    const p = ok.body;
    const patch = await h().patch(`/api/garden/plants/${p.id}`).send({ planted_on: '2026-06-01' });
    expect(patch.status).toBe(400);
    expect(patch.body.details.ended_on).toBeTruthy();
  });

  it('filters by status and reports the last entry and cover', async () => {
    const { h } = setup();
    const grow = await (async () => (await h().post('/api/garden/plants').send({ name: 'Sage' })).body)();
    const old = (await h().post('/api/garden/plants').send({ name: 'Basil', ended_on: '2026-09-01' })).body;
    await h().post('/api/garden/entries').send({ plant_id: grow.id, kind: 'planted', entry_date: '2026-04-01' });
    const latest = (await h().post('/api/garden/entries').send({ plant_id: grow.id, kind: 'pruned', entry_date: '2026-06-01' })).body;
    await h().post('/api/garden/entries').send({ plant_id: grow.id, kind: 'observed', entry_date: '2026-05-01' });
    const names = async q => (await h().get(`/api/garden/plants${q}`)).body.map(p => p.name);
    expect(await names('')).toEqual(['Sage']);
    expect(await names('?status=growing')).toEqual(['Sage']);
    expect(await names('?status=ended')).toEqual(['Basil']);
    expect(await names('?status=all')).toEqual(['Basil', 'Sage']);
    expect((await h().get('/api/garden/plants?status=nope')).status).toBe(400);
    const row = (await h().get('/api/garden/plants')).body[0];
    expect(row).toEqual({
      id: grow.id, name: 'Sage', herb: null, place: null, planted_on: null, expected_harvest_on: null, ended_on: null,
      last_entry: { id: latest.id, kind: 'pruned', entry_date: '2026-06-01' }, cover: null,
    });
    expect((await h().get('/api/garden/plants?status=ended')).body[0].last_entry).toBeNull();
    expect(old.ended_on).toBe('2026-09-01');
  });

  it('returns the detail with newest entries first, capped at 50', async () => {
    const { h, r } = setup();
    const p = await (async () => (await h().post('/api/garden/plants').send({ name: 'Sage' })).body)();
    for (let i = 0; i < 53; i++) {
      r.gardenEntries.create({ entry_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, kind: 'observed', plant_id: p.id, plant_name: 'Sage' });
    }
    const res = await h().get(`/api/garden/plants/${p.id}`);
    expect(res.body.entries).toHaveLength(50);
    expect(res.body.entries[0].entry_date >= res.body.entries[49].entry_date).toBe(true);
    expect((await h().get('/api/garden/plants/9999')).status).toBe(404);
  });

  it('renames the plant on its entries, live and deleted, and follows a herb change', async () => {
    const { h, herb } = setup();
    const p = await (async () => (await h().post('/api/garden/plants').send({ name: 'Sage' })).body)();
    const e1 = (await h().post('/api/garden/entries').send({ plant_id: p.id, kind: 'planted', entry_date: '2026-04-01' })).body;
    const e2 = (await h().post('/api/garden/entries').send({ plant_id: p.id, kind: 'pruned', entry_date: '2026-05-01' })).body;
    await h().delete(`/api/garden/entries/${e2.id}`);
    const res = await h().patch(`/api/garden/plants/${p.id}`).send({ name: 'Garden sage', herb_id: herb.id });
    expect(res.status).toBe(200);
    const rows = t.ctx.db.prepare('SELECT plant_name, herb_id FROM garden_entries ORDER BY id').all();
    expect(rows).toEqual([{ plant_name: 'Garden sage', herb_id: herb.id }, { plant_name: 'Garden sage', herb_id: herb.id }]);
    expect((await h().get(`/api/garden/entries/${e1.id}`)).body.title).toBe('Planted Garden sage');
  });

  it('deletes with its photos, keeps its entries showing the plant as gone, and undoes', async () => {
    const { h, r } = setup();
    const p = await (async () => (await h().post('/api/garden/plants').send({ name: 'Sage' })).body)();
    const e = (await h().post('/api/garden/entries').send({ plant_id: p.id, kind: 'planted', entry_date: '2026-04-01' })).body;
    const photo = r.photos.create({ owner_type: 'garden_plant', owner_id: p.id, filename: '1-aaaaaaaa.jpg' });
    const del = await h().delete(`/api/garden/plants/${p.id}`);
    expect(del.body).toEqual({ ok: true, restore: `/api/garden/plants/${p.id}/restore` });
    expect((await h().get(`/api/garden/plants/${p.id}`)).status).toBe(404);
    expect((await h().get('/api/garden/plants?status=all')).body).toEqual([]);
    const shown = (await h().get(`/api/garden/entries/${e.id}`)).body;
    expect(shown.plant).toEqual({ id: p.id, name: 'Sage', live: false });
    expect(r.photos.get(photo.id)).toBeNull();
    const back = await h().post(`/api/garden/plants/${p.id}/restore`);
    expect(back.status).toBe(200);
    expect(back.body.name).toBe('Sage');
    expect(r.photos.get(photo.id)).not.toBeNull();
    expect((await h().get(`/api/garden/entries/${e.id}`)).body.plant.live).toBe(true);
    expect((await h().post(`/api/garden/plants/${p.id}/restore`)).status).toBe(404);
  });
});

describe('entries', () => {
  it('creates from a plant, taking its name, herb and place', async () => {
    const { h, herb } = setup();
    const p = await (async () => (await h().post('/api/garden/plants').send({ herb_id: herb.id, place: 'Front bed' })).body)();
    const res = await h().post('/api/garden/entries').send({
      plant_id: p.id, kind: 'harvested', entry_date: '2026-10-10', amount: 40, unit: 'g', plant_name: 'ignored', weather: 'Sunny',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'harvested', title: 'Harvested Calendula', plant_name: 'Calendula', herb_id: herb.id, place: 'Front bed', amount: 40, unit: 'g',
      plant: { id: p.id, name: 'Calendula', live: true }, item: null, photos: [],
    });
    const own = await h().post('/api/garden/entries').send({ plant_id: p.id, kind: 'observed', entry_date: '2026-10-11', place: 'Pot by the door' });
    expect(own.body.place).toBe('Pot by the door');
  });

  it('creates from free text and needs a name then', async () => {
    const { h, herb } = setup();
    const res = await h().post('/api/garden/entries').send({ kind: 'foraged', entry_date: '2026-10-10', plant_name: 'Wild mint', herb_id: herb.id, place: 'Creek' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ plant_name: 'Wild mint', herb_id: herb.id, plant: null, title: 'Foraged Wild mint' });
    const bad = await h().post('/api/garden/entries').send({ kind: 'foraged', entry_date: '2026-10-10' });
    expect(bad.status).toBe(400);
    expect(bad.body.details.plant_name).toBeTruthy();
    const gone = await h().post('/api/garden/entries').send({ kind: 'foraged', entry_date: '2026-10-10', plant_id: 9999 });
    expect(gone.body.details.plant_id).toBeTruthy();
    const badHerb = await h().post('/api/garden/entries').send({ kind: 'foraged', entry_date: '2026-10-10', plant_name: 'X', herb_id: 9999 });
    expect(badHerb.body.details.herb_id).toBeTruthy();
    const badDate = await h().post('/api/garden/entries').send({ kind: 'foraged', entry_date: '2101-01-01', plant_name: 'X' });
    expect(badDate.body.details.entry_date).toBe('Pick a date between 1900 and 2100');
    const badKind = await h().post('/api/garden/entries').send({ kind: 'dug', entry_date: '2026-10-10', plant_name: 'X' });
    expect(badKind.status).toBe(400);
    expect((await h().post('/api/garden/entries').send({ kind: 'sowed', entry_date: '2026-10-10', plant_name: 'X', amount: -1 })).status).toBe(400);
  });

  it('stamps the sky and restamps when the date changes', async () => {
    const { h, entry } = setup();
    const e = await entry({ entry_date: '2026-10-25' });
    const f = skyFacts('2026-10-25');
    expect(e.sky).toEqual({ phase: f.phase.name, sign: moonSignAt(localNoon('2026-10-25')).sign });
    expect(t.ctx.db.prepare('SELECT sky_phase, sky_phase_group, sky_sign FROM garden_entries WHERE id = ?').get(e.id))
      .toEqual({ sky_phase: f.phase.name, sky_phase_group: f.phase.group, sky_sign: stampSky('2026-10-25', null).sky_sign });
    const moved = await h().patch(`/api/garden/entries/${e.id}`).send({ entry_date: '2026-10-10' });
    const g = skyFacts('2026-10-10');
    expect(moved.body.sky.phase).toBe(g.phase.name);
    expect(moved.body.sky.phase).not.toBe(f.phase.name);
    const same = await h().patch(`/api/garden/entries/${e.id}`).send({ weather: 'Rain' });
    expect(same.body).toMatchObject({ weather: 'Rain', sky: { phase: g.phase.name } });
  });

  it('edits an entry, moving it to another plant or to free text', async () => {
    const { h } = setup();
    const p1 = await (async () => (await h().post('/api/garden/plants').send({ name: 'Sage', place: 'Bed 1' })).body)();
    const p2 = await (async () => (await h().post('/api/garden/plants').send({ name: 'Thyme', place: 'Bed 2' })).body)();
    const e = (await h().post('/api/garden/entries').send({ plant_id: p1.id, kind: 'observed', entry_date: '2026-10-10' })).body;
    expect(e.place).toBe('Bed 1');
    const moved = await h().patch(`/api/garden/entries/${e.id}`).send({ plant_id: p2.id, place: '' });
    expect(moved.body).toMatchObject({ plant_name: 'Thyme', place: 'Bed 2', plant: { id: p2.id } });
    const free = await h().patch(`/api/garden/entries/${e.id}`).send({ plant_id: null, plant_name: 'Wild thyme' });
    expect(free.body).toMatchObject({ plant: null, plant_name: 'Wild thyme' });
    const none = await h().patch(`/api/garden/entries/${e.id}`).send({ plant_name: '' });
    expect(none.body.details.plant_name).toBeTruthy();
    expect((await h().patch('/api/garden/entries/9999').send({ weather: 'x' })).status).toBe(404);
  });

  it('lists newest first with filters, 30 per page, and the options list', async () => {
    const { h, r, herb } = setup();
    const p = await (async () => (await h().post('/api/garden/plants').send({ herb_id: herb.id })).body)();
    for (let i = 0; i < 32; i++) {
      r.gardenEntries.create({ entry_date: `2026-0${(i % 9) + 1}-10`, kind: 'observed', plant_name: 'Sage' });
    }
    const a = (await h().post('/api/garden/entries').send({ plant_id: p.id, kind: 'harvested', entry_date: '2026-10-05' })).body;
    const b = (await h().post('/api/garden/entries').send({ plant_id: p.id, kind: 'pruned', entry_date: '2026-10-07' })).body;
    const page1 = (await h().get('/api/garden/entries')).body;
    expect(page1).toMatchObject({ total: 34, page: 1 });
    expect(page1.entries).toHaveLength(30);
    expect(page1.entries.slice(0, 2).map(e => e.id)).toEqual([b.id, a.id]);
    expect(page1.entries[0]).toEqual({
      id: b.id, entry_date: '2026-10-07', kind: 'pruned', title: 'Pruned Calendula', plant: { id: p.id, name: 'Calendula', live: true },
      plant_name: 'Calendula', place: null, amount: null, unit: null, weather: null, sky: { phase: skyFacts('2026-10-07').phase.name, sign: b.sky.sign },
      item: null, cover: null,
    });
    expect((await h().get('/api/garden/entries?page=2')).body.entries).toHaveLength(4);
    const ids = async q => (await h().get(`/api/garden/entries?${q}`)).body.entries.map(e => e.id);
    expect(await ids('kind=harvested')).toEqual([a.id]);
    expect(await ids(`plant_id=${p.id}`)).toEqual([b.id, a.id]);
    expect(await ids(`herb_id=${herb.id}&from=2026-10-06`)).toEqual([b.id]);
    expect(await ids('to=2026-10-05&from=2026-10-05')).toEqual([a.id]);
    expect((await h().get('/api/garden/entries?kind=dug')).status).toBe(400);
    expect((await h().get('/api/garden/entries?from=nope')).status).toBe(400);
    expect((await h().get('/api/garden/entries?page=0')).status).toBe(400);
    const options = (await h().get('/api/garden/entries/options')).body;
    expect(options).toHaveLength(34);
    expect(options[0]).toEqual({ id: b.id, title: 'Pruned Calendula', entry_date: '2026-10-07' });
  });

  it('deletes with its photos and undoes', async () => {
    const { h, r, entry } = setup();
    const e = await entry();
    const photo = r.photos.create({ owner_type: 'garden_entry', owner_id: e.id, filename: '2-bbbbbbbb.jpg' });
    expect((await h().delete(`/api/garden/entries/${e.id}`)).body.restore).toBe(`/api/garden/entries/${e.id}/restore`);
    expect((await h().get(`/api/garden/entries/${e.id}`)).status).toBe(404);
    expect((await h().get('/api/garden/entries')).body.total).toBe(0);
    expect(r.photos.get(photo.id)).toBeNull();
    const back = await h().post(`/api/garden/entries/${e.id}/restore`);
    expect(back.status).toBe(200);
    expect(back.body.photos).toHaveLength(1);
    expect((await h().post(`/api/garden/entries/${e.id}/restore`)).status).toBe(404);
  });
});

describe('jar prefill and the cabinet', () => {
  it('prefills a jar from a harvest or a foraging, and refuses other kinds', async () => {
    const { h, herb, entry } = setup();
    const harvest = await entry({ kind: 'harvested', plant_name: 'Calendula', herb_id: herb.id, place: 'Front bed', amount: 40, unit: 'g' });
    const res = await h().get(`/api/garden/entries/${harvest.id}/jar`);
    expect(res.body).toEqual({
      name: 'Calendula', herb_id: herb.id, latin_name: 'Calendula officinalis', source_kind: 'grown', source_place: 'Front bed',
      acquired_on: '2026-10-10', amount: 40, unit: 'g', form: 'fresh', plant_part: 'flower',
    });
    const wild = await entry({ kind: 'foraged', plant_name: 'Wild mint' });
    expect((await h().get(`/api/garden/entries/${wild.id}/jar`)).body).toEqual({
      name: 'Wild mint', source_kind: 'foraged', acquired_on: '2026-10-10', form: 'fresh',
    });
    const seen = await entry({ kind: 'observed' });
    expect((await h().get(`/api/garden/entries/${seen.id}/jar`)).status).toBe(400);
    expect((await h().get('/api/garden/entries/9999/jar')).status).toBe(404);
  });

  it('links a new jar to the harvest once, and again after the jar is deleted', async () => {
    const { h, entry } = setup();
    const e = await entry({ kind: 'harvested' });
    const jar = body => h().post('/api/items').send({ section_id: 1, name: 'Sage', unit: 'g', amount: 10, ...body });
    const first = await jar({ garden_entry_id: e.id });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const shown = (await h().get(`/api/garden/entries/${e.id}`)).body;
    expect(shown.item).toEqual({ id: first.body.id, name: 'Sage', live: true });
    expect(shown.item_id).toBe(first.body.id);
    const second = await jar({ garden_entry_id: e.id });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('That harvest is already in the cabinet.');
    expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM items').get().n).toBe(1);
    await h().delete(`/api/items/${first.body.id}`);
    const third = await jar({ garden_entry_id: e.id });
    expect(third.status).toBe(201);
    expect((await h().get(`/api/garden/entries/${e.id}`)).body.item.id).toBe(third.body.id);
  });

  it('refuses a jar link to an entry that is gone or not a harvest', async () => {
    const { h, entry } = setup();
    const seen = await entry({ kind: 'observed' });
    const a = await h().post('/api/items').send({ section_id: 1, name: 'X', unit: 'g', amount: 1, garden_entry_id: seen.id });
    expect(a.status).toBe(400);
    expect(a.body.details.garden_entry_id).toBeTruthy();
    const b = await h().post('/api/items').send({ section_id: 1, name: 'X', unit: 'g', amount: 1, garden_entry_id: 9999 });
    expect(b.status).toBe(400);
    expect(t.ctx.db.prepare('SELECT COUNT(*) n FROM items').get().n).toBe(0);
  });
});
