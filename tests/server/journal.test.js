process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { skyFacts, moonSignAt, signChanges, localDayBounds, localNoon } from '../../server/lib/sky.js';
import { addDays } from '../../server/lib/dates.js';
import { stampSky } from '../../server/services/journal.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const ritual = r.journalTypes.create({ name: 'Ritual', icon: 'sparkles', sort_order: 0 });
  const dream = r.journalTypes.create({ name: 'Dream', icon: 'cloud', sort_order: 1 });
  const herb = r.herbs.create({ common_name: 'Mugwort' });
  const recipeType = r.recipeTypes.create({ name: 'Tea' });
  const recipe = r.recipes.create({ name: 'Dream tea', type_id: recipeType.id });
  const s = { h: t.http, r, ritual, dream, herb, recipe };
  s.make = (type, title, date, extra = {}) => s.h().post('/api/journal').send({ type_id: type.id, title, entry_date: date, ...extra }).then(res => res.body);
  return s;
}
const post = (h, body) => h().post('/api/journal').send(body);

it('stamps the sky for the date, reading the moon sign at the entry time', () => {
  const f = skyFacts('2026-10-10');
  const noon = stampSky('2026-10-10', null);
  expect(noon).toEqual({
    sky_phase: f.phase.name, sky_phase_group: f.phase.group, sky_sign: moonSignAt(localNoon('2026-10-10')).sign,
    sky_ruler: f.ruler, sky_festival: f.festival,
  });
  expect(stampSky('2026-10-10', '12:00').sky_sign).toBe(noon.sky_sign);
});

it('changes the stamped sign inside a day when the moon crosses a sign', () => {
  let day = '2026-10-01';
  let changes = [];
  for (; !changes.length; day = addDays(day, 1)) {
    const { start, end } = localDayBounds(day);
    changes = signChanges(start, end);
  }
  day = addDays(day, -1);
  expect(stampSky(day, '00:01').sky_sign).not.toBe(stampSky(day, '23:59').sky_sign);
});

it('creates an entry with a stamp, links and tags', async () => {
  const { h, ritual, herb, recipe } = setup();
  const res = await post(h, {
    type_id: ritual.id, title: ' Full moon ', entry_date: '2026-10-25', entry_time: '21:30', body: 'Lit a candle.', mood: 'calm',
    links: [{ type: 'herb', id: herb.id }, { type: 'recipe', id: recipe.id }, { type: 'herb', id: herb.id }],
    tags: [' Moon ', 'moon', 'candle', ''],
  });
  expect(res.status).toBe(201);
  const f = skyFacts('2026-10-25');
  expect(res.body).toMatchObject({ title: 'Full moon', entry_time: '21:30', mood: 'calm', tags: ['moon', 'candle'] });
  expect(res.body.sky).toEqual({ phase: f.phase.name, sign: stampSky('2026-10-25', '21:30').sky_sign, ruler: f.ruler, festival: f.festival });
  expect(res.body.links).toEqual([
    { type: 'herb', id: herb.id, name: 'Mugwort', live: true }, { type: 'recipe', id: recipe.id, name: 'Dream tea', live: true },
  ]);
  expect(res.body.type).toMatchObject({ name: 'Ritual' });
  expect(res.body.photos).toEqual([]);
});

it('re-stamps when the date or time changes, and replaces links and tags together', async () => {
  const { h, r, ritual, herb } = setup();
  const e = (await post(h, { type_id: ritual.id, title: 'A', entry_date: '2026-10-25', links: [{ type: 'herb', id: herb.id }], tags: ['a', 'b'] })).body;
  let res = await h().patch(`/api/journal/${e.id}`).send({ title: 'B' });
  expect(res.body.sky.phase).toBe(skyFacts('2026-10-25').phase.name);
  expect(res.body.links).toHaveLength(1);
  expect(res.body.tags).toEqual(['a', 'b']);
  res = await h().patch(`/api/journal/${e.id}`).send({ entry_date: '2026-10-10', tags: ['c'], links: [] });
  expect(res.status).toBe(200);
  expect(res.body.sky.phase).toBe(skyFacts('2026-10-10').phase.name);
  expect(res.body.sky.phase).not.toBe(skyFacts('2026-10-25').phase.name);
  expect(res.body.tags).toEqual(['c']);
  expect(res.body.links).toEqual([]);
  expect(r.journalEntries.get(e.id).sky_phase_group).toBe(skyFacts('2026-10-10').phase.group);
  const late = (await h().patch(`/api/journal/${e.id}`).send({ entry_time: '23:59' })).body.sky.sign;
  const early = (await h().patch(`/api/journal/${e.id}`).send({ entry_time: '00:01' })).body.sky.sign;
  expect([late, early]).toEqual([stampSky('2026-10-10', '23:59').sky_sign, stampSky('2026-10-10', '00:01').sky_sign]);
  expect((await h().patch('/api/journal/9999').send({ title: 'x' })).status).toBe(404);
});

it('checks the type, date, time, links and tags', async () => {
  const { h, r, ritual, herb, recipe } = setup();
  const ok = { type_id: ritual.id, title: 'T', entry_date: '2026-10-10' };
  let res = await post(h, { title: '', entry_date: 'nope', mood: 'zany' });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['type_id', 'title', 'entry_date', 'mood']));
  res = await post(h, { ...ok, type_id: 999 });
  expect(res.body.details.type_id).toBeTruthy();
  for (const bad of ['25:00', '9:30', '12:60', 'noon']) expect((await post(h, { ...ok, entry_time: bad })).body.details.entry_time).toBeTruthy();
  expect((await post(h, { ...ok, entry_date: '1850-01-01' })).body.details.entry_date).toBeTruthy();
  r.recipes.remove(recipe.id);
  res = await post(h, { ...ok, links: [{ type: 'herb', id: herb.id }, { type: 'recipe', id: recipe.id }, { type: 'item', id: 1 }, { type: 'herb', id: 999 }] });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.details).sort()).toEqual(['links.1', 'links.2', 'links.3']);
  res = await post(h, { ...ok, links: Array.from({ length: 31 }, () => ({ type: 'herb', id: herb.id })) });
  expect(res.body.details.links).toBeTruthy();
  res = await post(h, { ...ok, tags: Array.from({ length: 21 }, (_, i) => `t${i}`) });
  expect(res.body.details.tags).toBeTruthy();
  expect((await post(h, { ...ok, tags: [3] })).body.details['tags.0']).toBeTruthy();
  expect((await post(h, { ...ok, links: 'x' })).body.details.links).toBeTruthy();
  expect((await post(h, { ...ok, tags: ['a'.repeat(41)] })).body.details['tags.0']).toBeTruthy();
});

it('lists newest first with the row shape, excerpt and cover', async () => {
  const s = setup();
  const a = await s.make(s.ritual, 'Old', '2026-10-01', { body: 'x'.repeat(200), tags: ['moon'] });
  const b = await s.make(s.dream, 'New', '2026-10-20', { entry_time: '08:00', mood: 'calm' });
  const c = await s.make(s.dream, 'Newer', '2026-10-20', { entry_time: '09:00' });
  s.r.photos.create({ owner_type: 'journal', owner_id: a.id, filename: '1-aaaaaaaa.jpg' });
  const res = await s.h().get('/api/journal');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ total: 3, page: 1 });
  expect(res.body.entries.map(e => e.id)).toEqual([c.id, b.id, a.id]);
  const row = res.body.entries[2];
  expect(row).toMatchObject({ id: a.id, title: 'Old', entry_date: '2026-10-01', entry_time: null, mood: null, tags: ['moon'], cover: '1-aaaaaaaa.jpg' });
  expect(row.type).toEqual({ id: s.ritual.id, name: 'Ritual', icon: 'sparkles' });
  expect(row.excerpt).toHaveLength(160);
  expect(row.sky).toEqual({ phase: expect.any(String), sign: expect.any(String), ruler: expect.any(String), festival: null });
  expect(res.body.entries[0].cover).toBeNull();
});

it('pages thirty at a time and filters by type, dates and group', async () => {
  const s = setup();
  for (let i = 1; i <= 31; i++) await s.make(s.ritual, `E${i}`, addDays('2026-09-01', i));
  const dream = await s.make(s.dream, 'Dream one', '2026-10-25');
  let res = await s.h().get('/api/journal');
  expect(res.body.total).toBe(32);
  expect(res.body.entries).toHaveLength(30);
  res = await s.h().get('/api/journal?page=2');
  expect(res.body.entries).toHaveLength(2);
  expect(res.body.page).toBe(2);
  res = await s.h().get(`/api/journal?type_id=${s.dream.id}`);
  expect(res.body.entries.map(e => e.id)).toEqual([dream.id]);
  res = await s.h().get('/api/journal?from=2026-10-25&to=2026-10-25');
  expect(res.body.total).toBe(1);
  res = await s.h().get(`/api/journal?phase_group=${skyFacts('2026-10-25').phase.group}`);
  expect(res.body.entries.map(e => e.id)).toContain(dream.id);
  expect(res.body.entries.length).toBeLessThan(32);
  expect((await s.h().get('/api/journal?from=nope')).status).toBe(400);
  expect((await s.h().get('/api/journal?page=0')).status).toBe(400);
  expect((await s.h().get('/api/journal?type_id=x')).status).toBe(400);
  expect((await s.h().get('/api/journal?view=weird')).status).toBe(400);
});

it('searches titles, bodies and tags, escaping LIKE characters', async () => {
  const s = setup();
  const a = await s.make(s.ritual, 'Rose water', '2026-10-01', { body: 'Made 100% rose' });
  const b = await s.make(s.ritual, 'Plain', '2026-10-02', { body: 'under_score here', tags: ['Lavender'] });
  await s.make(s.ritual, 'Other', '2026-10-03', { body: 'nothing' });
  const ids = async q => (await s.h().get(`/api/journal?q=${encodeURIComponent(q)}`)).body.entries.map(e => e.id).sort();
  expect(await ids('ROSE')).toEqual([a.id]);
  expect(await ids('lavender')).toEqual([b.id]);
  expect(await ids('100%')).toEqual([a.id]);
  expect(await ids('%')).toEqual([a.id]);
  expect(await ids('_')).toEqual([b.id]);
  expect(await ids('d_s')).toEqual([]);
});

it('groups by type, tag and moon phase group, with entries for the chosen group only', async () => {
  const s = setup();
  const a = await s.make(s.ritual, 'A', '2026-10-10', { tags: ['moon', 'candle'] });
  const b = await s.make(s.dream, 'B', '2026-10-25', { tags: ['moon'] });
  s.r.journalTypes.create({ name: 'Empty', sort_order: 5 });
  let res = await s.h().get('/api/journal?view=type');
  expect(res.body.types.map(x => [x.name, x.count])).toEqual([['Ritual', 1], ['Dream', 1], ['Empty', 0]]);
  expect(res.body.entries).toEqual([]);
  res = await s.h().get(`/api/journal?view=type&type_id=${s.dream.id}`);
  expect(res.body.entries.map(e => e.id)).toEqual([b.id]);
  expect(res.body.types.map(x => x.count)).toEqual([1, 1, 0]);
  res = await s.h().get('/api/journal?view=tag');
  expect(res.body.tags).toEqual([{ tag: 'candle', count: 1 }, { tag: 'moon', count: 2 }]);
  expect(res.body.entries).toEqual([]);
  res = await s.h().get('/api/journal?view=tag&tag=Moon');
  expect(res.body.entries.map(e => e.id)).toEqual([b.id, a.id]);
  expect(res.body.total).toBe(2);
  res = await s.h().get('/api/journal?view=moon');
  expect(res.body.groups.map(g => g.group)).toEqual(['new', 'waxing', 'full', 'waning']);
  const group = day => skyFacts(day).phase.group;
  const count = g => res.body.groups.find(x => x.group === g).count;
  expect(count(group('2026-10-10'))).toBeGreaterThanOrEqual(1);
  expect(res.body.groups.reduce((n, g) => n + g.count, 0)).toBe(2);
  res = await s.h().get(`/api/journal?view=moon&phase_group=${group('2026-10-25')}`);
  expect(res.body.entries.map(e => e.id)).toContain(b.id);
  expect(res.body.entries.map(e => e.id).includes(a.id)).toBe(group('2026-10-10') === group('2026-10-25'));
  expect((await s.h().get('/api/journal?view=moon&phase_group=bogus')).status).toBe(400);
});

it('lists the live tags with counts for the picker', async () => {
  const s = setup();
  const a = await s.make(s.ritual, 'A', '2026-10-10', { tags: ['moon', 'candle'] });
  await s.make(s.ritual, 'B', '2026-10-11', { tags: ['moon'] });
  await s.h().delete(`/api/journal/${a.id}`);
  expect((await s.h().get('/api/journal/tags')).body).toEqual([{ tag: 'moon', count: 1 }]);
});

it('deletes with links, tags and photos sharing the stamp, and undoes', async () => {
  const s = setup();
  const e = await s.make(s.ritual, 'A', '2026-10-10', { links: [{ type: 'herb', id: s.herb.id }], tags: ['moon'] });
  s.r.photos.create({ owner_type: 'journal', owner_id: e.id, filename: '1-bbbbbbbb.jpg' });
  const early = s.r.photos.create({ owner_type: 'journal', owner_id: e.id, filename: '2-cccccccc.jpg' });
  s.r.photos.remove(early.id, '2020-01-01T00:00:00.000Z');
  let res = await s.h().delete(`/api/journal/${e.id}`);
  expect(res.status).toBe(200);
  expect(res.body.restore).toBe(`/api/journal/${e.id}/restore`);
  expect((await s.h().get(`/api/journal/${e.id}`)).status).toBe(404);
  expect((await s.h().get('/api/journal')).body.total).toBe(0);
  const db = t.ctx.db;
  const stamp = s.r.journalEntries.get(e.id, { includeDeleted: true }).deleted_at;
  expect(db.prepare('SELECT COUNT(*) n FROM journal_links WHERE deleted_at = ?').get(stamp).n).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM journal_tags WHERE deleted_at = ?').get(stamp).n).toBe(1);
  expect(db.prepare('SELECT COUNT(*) n FROM photos WHERE deleted_at = ?').get(stamp).n).toBe(1);
  expect((await s.h().delete(`/api/journal/${e.id}`)).status).toBe(404);
  res = await s.h().post(`/api/journal/${e.id}/restore`);
  expect(res.status).toBe(200);
  expect(res.body.links).toHaveLength(1);
  expect(res.body.tags).toEqual(['moon']);
  expect(res.body.photos).toHaveLength(1);
  expect((await s.h().post(`/api/journal/${e.id}/restore`)).status).toBe(404);
});

it('does not bring back tags that were replaced before the delete', async () => {
  const s = setup();
  const e = await s.make(s.ritual, 'A', '2026-10-10', { tags: ['old'] });
  await s.h().patch(`/api/journal/${e.id}`).send({ tags: ['new'] });
  await s.h().delete(`/api/journal/${e.id}`);
  expect((await s.h().post(`/api/journal/${e.id}/restore`)).body.tags).toEqual(['new']);
});

it('shows a deleted link target as not live', async () => {
  const s = setup();
  const e = await s.make(s.ritual, 'A', '2026-10-10', { links: [{ type: 'herb', id: s.herb.id }] });
  s.r.herbs.remove(s.herb.id);
  const res = await s.h().get(`/api/journal/${e.id}`);
  expect(res.body.links).toEqual([{ type: 'herb', id: s.herb.id, name: 'Mugwort', live: false }]);
});

it('stamps exact signs for a known date and time', async () => {
  const s = setup();
  const noon = await s.make(s.ritual, 'Noon', '2026-10-25');
  const night = await s.make(s.ritual, 'Night', '2026-10-25', { entry_time: '21:30' });
  expect(noon.sky.sign).toBe('Aries');
  expect(night.sky.sign).toBe('Taurus');
  expect(night.sky.phase).toBe('full');
});

it('re-stamps only when the date or time changes', async () => {
  const s = setup();
  const e = await s.make(s.ritual, 'A', '2026-10-25');
  t.ctx.db.prepare("UPDATE journal_entries SET sky_sign = 'Test' WHERE id = ?").run(e.id);
  let res = await s.h().patch(`/api/journal/${e.id}`).send({ title: 'B', body: 'x', tags: ['t'] });
  expect(res.body.sky.sign).toBe('Test');
  res = await s.h().patch(`/api/journal/${e.id}`).send({ entry_date: '2026-10-25' });
  expect(res.body.sky.sign).toBe('Test');
  res = await s.h().patch(`/api/journal/${e.id}`).send({ entry_time: '21:30' });
  expect(res.body.sky.sign).toBe('Taurus');
});

it('rejects huge page numbers and returns an empty list past the end', async () => {
  const s = setup();
  await s.make(s.ritual, 'A', '2026-10-10');
  expect((await s.h().get('/api/journal?page=1e21')).status).toBe(400);
  expect((await s.h().get('/api/journal?page=100001')).body.details.page).toBeTruthy();
  const res = await s.h().get('/api/journal?page=100000');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ entries: [], total: 1, page: 100000 });
});

it('leaves existing links alone when the tags are refused', async () => {
  const s = setup();
  const e = await s.make(s.ritual, 'A', '2026-10-10', { links: [{ type: 'herb', id: s.herb.id }], tags: ['keep'] });
  const res = await s.h().patch(`/api/journal/${e.id}`).send({ links: [], tags: [5] });
  expect(res.status).toBe(400);
  const after = (await s.h().get(`/api/journal/${e.id}`)).body;
  expect(after.links).toHaveLength(1);
  expect(after.tags).toEqual(['keep']);
});

it('lists a deleted type in the type view while live entries still use it', async () => {
  const s = setup();
  await s.make(s.ritual, 'A', '2026-10-10');
  s.r.journalTypes.remove(s.ritual.id);
  const res = await s.h().get('/api/journal?view=type');
  expect(res.body.types.map(x => [x.name, x.count])).toEqual([['Ritual', 1]].concat([['Dream', 0]]));
});

it('searches for a backslash literally', async () => {
  const s = setup();
  const slash = String.fromCharCode(92);
  const a = await s.make(s.ritual, 'Path', '2026-10-01', { body: `a${slash}b` });
  await s.make(s.ritual, 'Other', '2026-10-02', { body: 'ab' });
  const res = await s.h().get(`/api/journal?q=${encodeURIComponent(slash)}`);
  expect(res.body.entries.map(e => e.id)).toEqual([a.id]);
});

it('keeps the first-line indent and trailing blank lines of the writing', async () => {
  const s = setup();
  const body = '    indented first line\n  second\n\n\n';
  const e = await s.make(s.ritual, 'Indented', '2026-10-10', { body });
  const got = await s.h().get(`/api/journal/${e.id}`);
  expect(got.body.body).toBe(body);
  const upd = await s.h().patch(`/api/journal/${e.id}`).send({ body: '  \n ' });
  expect(upd.status).toBe(200);
  expect((await s.h().get(`/api/journal/${e.id}`)).body.body).toBeNull();
});
