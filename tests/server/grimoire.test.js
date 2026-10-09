import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { seedGrimoire, linkItemsOnce } from '../../server/services/grimoire.js';

let t;
afterEach(() => t?.cleanup());
const TODAY = '2026-10-08';

const entries = [
  {
    slug: 'calendula', common_name: 'Calendula', other_names: ['Pot marigold'], latin_name: 'Calendula officinalis',
    parts_used: ['flower'], uses: 'Used in salves. Also in teas.', associations: ['the sun'], planet: 'Sun', element: 'Fire',
    caution_pregnancy: 'Ask first.', ahpa_class: '1', sources: [{ title: 'Source A', covers: ['uses'] }],
  },
  {
    slug: 'chamomile', common_name: 'Chamomile', other_names: [], latin_name: 'Matricaria chamomilla',
    parts_used: ['flower', 'leaf'], uses: 'Calming tea', associations: ['peace'], planet: 'Moon', element: 'Water', sources: [],
  },
  {
    slug: 'mint', common_name: 'Peppermint', other_names: [], latin_name: 'Mentha × piperita', parts_used: ['leaf'],
    planet: 'Mercury', element: 'Air', caution_topical: 'Keep off the face of small children.', sources: [],
  },
];

function setup() {
  t = makeTestContext();
  seedGrimoire(t.ctx.db, entries);
  const byName = n => repos(t.ctx.db).herbs.list().find(h => h.common_name === n);
  return { h: t.http, byName };
}

it('lists herbs by common name with summary fields', async () => {
  const { h } = setup();
  const res = await h().get('/api/herbs');
  expect(res.status).toBe(200);
  expect(res.body.map(x => x.common_name)).toEqual(['Calendula', 'Chamomile', 'Peppermint']);
  expect(res.body[0]).toMatchObject({
    slug: 'calendula', parts_used: ['flower'], planet: 'Sun', element: 'Fire', ahpa_class: '1', has_cautions: true, jar_count: 0, cover: null,
  });
  expect(res.body[1].has_cautions).toBe(false);
});

it('filters and searches the list', async () => {
  const { h, byName } = setup();
  const names = async qs => (await h().get(`/api/herbs?${qs}`)).body.map(x => x.common_name);
  expect(await names('q=marigold')).toEqual(['Calendula']);
  expect(await names('q=matricaria')).toEqual(['Chamomile']);
  expect(await names('q=peace')).toEqual(['Chamomile']);
  expect(await names('q=cal')).toEqual(['Calendula']);
  expect(await names('part=leaf')).toEqual(['Chamomile', 'Peppermint']);
  expect(await names('planet=Moon')).toEqual(['Chamomile']);
  expect(await names('element=Air')).toEqual(['Peppermint']);
  expect(await names('caution=pregnancy')).toEqual(['Calendula']);
  expect(await names('caution=topical')).toEqual(['Peppermint']);
  repos(t.ctx.db).items.create({ section_id: 1, name: 'Chamomile', herb_id: byName('Chamomile').id });
  expect(await names('has_jars=1')).toEqual(['Chamomile']);
  expect((await h().get('/api/herbs?has_jars=1')).body[0].jar_count).toBe(1);
});

it('ignores non-string query values', async () => {
  const { h } = setup();
  const res = await h().get('/api/herbs?q[a]=1&planet[]=Sun&part[x]=leaf&caution[]=pregnancy&has_jars[]=1');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(3);
});

it('returns a detail with parsed lists, sources and jars', async () => {
  const { h, byName } = setup();
  const cal = byName('Calendula');
  const items = repos(t.ctx.db).items;
  items.create({ section_id: 1, name: 'Calendula jar', herb_id: cal.id, amount: 5, unit: 'g', low_threshold: 10, size_label: 'Pint' });
  const gone = items.create({ section_id: 1, name: 'Old jar', herb_id: cal.id, amount: 1, unit: 'g' });
  items.remove(gone.id);
  const res = await h().get(`/api/herbs/${cal.id}?today=${TODAY}`);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ common_name: 'Calendula', other_names: ['Pot marigold'], parts_used: ['flower'], zodiac: [], garden_companions: [] });
  expect(res.body.sources).toHaveLength(1);
  expect(res.body.sources[0]).toMatchObject({ title: 'Source A', covers: ['uses'] });
  expect(res.body.photos).toEqual([]);
  expect(res.body.jars).toHaveLength(1);
  expect(res.body.jars[0]).toMatchObject({ name: 'Calendula jar', amount: 5, unit: 'g', size_label: 'Pint', status: { low: true, expiring: false, expired: false } });
  expect((await h().get('/api/herbs/9999')).status).toBe(404);
});

it('creates a herb with sources, never taking a slug from the client', async () => {
  const { h } = setup();
  const res = await h().post('/api/herbs').send({
    common_name: 'Lemon balm', slug: 'calendula', parts_used: ['leaf'], preparations: ['tea blend'], other_names: ['Melissa'],
    sources: [{ title: 'My book', author: 'Me', year: 2020, url: 'https://example.com/x', covers: ['uses', 'garden'] }, { title: 'Second' }],
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  expect(res.body).toMatchObject({ common_name: 'Lemon balm', slug: null, is_starter: 0, parts_used: ['leaf'], other_names: ['Melissa'] });
  expect(res.body.sources.map(s => s.title)).toEqual(['My book', 'Second']);
  expect(res.body.sources[0].covers).toEqual(['uses', 'garden']);
  expect(res.body.sources[1].covers).toEqual([]);
});

it('update replaces sources; undoing a herb delete restores its photos but not replaced sources', async () => {
  const { h, byName } = setup();
  const cal = byName('Calendula');
  const r = repos(t.ctx.db);
  const photo = r.photos.create({ owner_type: 'herb', owner_id: cal.id, filename: '1-aaaaaaaa.jpg' });
  fs.writeFileSync(path.join(t.dataDir, 'photos', '1-aaaaaaaa.jpg'), 'x');
  const patched = await h().patch(`/api/herbs/${cal.id}`).send({ uses: 'New words.', sources: [{ title: 'Replacement' }] });
  expect(patched.status, JSON.stringify(patched.body)).toBe(200);
  expect(patched.body.uses).toBe('New words.');
  expect(patched.body.sources.map(s => s.title)).toEqual(['Replacement']);
  expect(r.herbSources.list({ herb_id: cal.id })).toHaveLength(1);
  const untouched = await h().patch(`/api/herbs/${cal.id}`).send({ notes: 'hi' });
  expect(untouched.body.sources.map(s => s.title)).toEqual(['Replacement']);

  const item = r.items.create({ section_id: 1, name: 'Calendula', herb_id: cal.id });
  const del = await h().delete(`/api/herbs/${cal.id}`);
  expect(del.body.restore).toBe(`/api/herbs/${cal.id}/restore`);
  expect(r.items.get(item.id).herb_id).toBe(cal.id);
  expect((await h().get(`/api/herbs/${cal.id}`)).status).toBe(404);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', '1-aaaaaaaa.jpg'))).toBe(true);

  const back = await h().post(`/api/herbs/${cal.id}/restore`);
  expect(back.status).toBe(200);
  expect(back.body.photos.map(p => p.id)).toEqual([photo.id]);
  expect(back.body.sources.map(s => s.title)).toEqual(['Replacement']);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '1-aaaaaaaa.jpg'))).toBe(true);
  expect((await h().post(`/api/herbs/${cal.id}/restore`)).status).toBe(404);
});

const bad = async (body, field) => {
  const res = await t.http().post('/api/herbs').send({ common_name: 'Test', ...body });
  expect(res.status, JSON.stringify(res.body)).toBe(400);
  expect(res.body.details, JSON.stringify(res.body)).toHaveProperty(field);
};

it('validates list fields', async () => {
  setup();
  await bad({ common_name: '' }, 'common_name');
  await bad({ other_names: 'Pot marigold' }, 'other_names');
  await bad({ zodiac: ['Leo', ''] }, 'zodiac');
  await bad({ associations: [3] }, 'associations');
  await bad({ garden_companions: Array(31).fill('a') }, 'garden_companions');
  await bad({ other_names: ['x'.repeat(81)] }, 'other_names');
  await bad({ parts_used: ['petal'] }, 'parts_used');
  await bad({ preparations: ['potion'] }, 'preparations');
  await bad({ planet: 'Pluto' }, 'planet');
});

it('accepts bulb as a herb part, but not as a jar plant part', async () => {
  setup();
  const ok = await t.http().post('/api/herbs').send({ common_name: 'Onion', parts_used: ['bulb'] });
  expect(ok.status, JSON.stringify(ok.body)).toBe(201);
  expect(ok.body.parts_used).toEqual(['bulb']);
  const jar = await t.http().post('/api/items').send({ section_id: 1, name: 'Onion', plant_part: 'bulb' });
  expect(jar.status, JSON.stringify(jar.body)).toBe(400);
  expect(jar.body.details).toHaveProperty('plant_part');
});

it('validates sources, keyed by position', async () => {
  setup();
  await bad({ sources: 'nope' }, 'sources');
  await bad({ sources: [{ title: 'ok' }, { title: '' }] }, 'sources.1.title');
  await bad({ sources: [{ title: 'a', url: 'ftp://x.com' }] }, 'sources.0.url');
  await bad({ sources: [{ title: 'a', url: 'https://' }] }, 'sources.0.url');
  await bad({ sources: [{ title: 'a', url: 'https:// x' }] }, 'sources.0.url');
  await bad({ sources: [{ title: 'a', covers: ['gossip'] }] }, 'sources.0.covers');
  await bad({ sources: [{ title: 'a', year: 'soon' }] }, 'sources.0.year');
  const ok = await t.http().post('/api/herbs').send({ common_name: 'Fine', sources: [{ title: 'a', url: '' }, { title: 'b', url: 'http://x.org/p' }] });
  expect(ok.status).toBe(201);
  expect(ok.body.sources[0].url).toBeNull();
});

it('rejects a bad patch without changing anything', async () => {
  const { h, byName } = setup();
  const cal = byName('Calendula');
  const res = await h().patch(`/api/herbs/${cal.id}`).send({ uses: 'Changed', sources: [{ title: 'a', url: 'nope' }] });
  expect(res.status).toBe(400);
  expect(res.body.details).toHaveProperty(['sources.0.url']);
  expect(repos(t.ctx.db).herbs.get(cal.id).uses).toBe('Used in salves. Also in teas.');
  expect(repos(t.ctx.db).herbSources.list({ herb_id: cal.id })).toHaveLength(1);
});

it('picks the herb of the day deterministically, with the first sentence of its uses', async () => {
  const { h } = setup();
  const days = Math.round((Date.UTC(2026, 9, 8) - Date.UTC(2000, 0, 1)) / 86400000);
  const ids = repos(t.ctx.db).herbs.list().map(x => x.id).sort((a, b) => a - b);
  const expected = ids[days % 3];
  const a = await h().get(`/api/herb-of-the-day?today=${TODAY}`);
  const b = await h().get(`/api/herb-of-the-day?today=${TODAY}`);
  expect(a.body).toEqual(b.body);
  expect(a.body.id).toBe(expected);
  expect(Object.keys(a.body).sort()).toEqual(['common_name', 'cover', 'element', 'id', 'latin_name', 'planet', 'uses']);
  const next = await h().get('/api/herb-of-the-day?today=2026-10-09');
  expect(next.body.id).toBe(ids[(days + 1) % 3]);
  const cal = repos(t.ctx.db).herbs.list().find(x => x.slug === 'calendula');
  for (const d of [0, 1, 2]) {
    const res = await h().get(`/api/herb-of-the-day?today=2026-10-${String(8 + d).padStart(2, '0')}`);
    if (res.body.id === cal.id) expect(res.body.uses).toBe('Used in salves.');
  }
  expect((await h().get('/api/herb-of-the-day')).status).toBe(400);
});

it('returns null for the herb of the day when there are no herbs', async () => {
  t = makeTestContext();
  const res = await t.http().get(`/api/herb-of-the-day?today=${TODAY}`);
  expect(res.status).toBe(200);
  expect(res.body).toBeNull();
});

it('links jars only once per seed version, so a hand-unlinked jar stays unlinked', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  const r = repos(db);
  const jar = r.items.create({ section_id: 1, name: 'Calendula' });
  expect(linkItemsOnce(db)).toEqual({ linked: 0 }); // nothing seeded yet, so nothing is recorded
  seedGrimoire(db, entries);
  expect(linkItemsOnce(db)).toEqual({ linked: 1 });
  expect(r.items.get(jar.id).herb_id).not.toBeNull();
  r.items.update(jar.id, { herb_id: null });
  expect(linkItemsOnce(db)).toEqual({ linked: 0 });
  expect(r.items.get(jar.id).herb_id).toBeNull();
  expect(db.prepare("SELECT value FROM settings WHERE key = 'grimoire_link_version'").get().value).toBe('1');
});

it('does not link a hybrid or spp. Latin name by its first two words', () => {
  t = makeTestContext();
  const db = t.ctx.db;
  seedGrimoire(db, entries);
  const r = repos(db);
  const gracilis = r.items.create({ section_id: 1, name: 'Ginger mint', latin_name: 'Mentha × gracilis' });
  const x = r.items.create({ section_id: 1, name: 'Another', latin_name: 'Mentha x gracilis' });
  const exact = r.items.create({ section_id: 1, name: 'Mint', latin_name: 'Mentha × piperita' });
  linkItemsOnce(db);
  expect(r.items.get(gracilis.id).herb_id).toBeNull();
  expect(r.items.get(x.id).herb_id).toBeNull();
  expect(r.items.get(exact.id).herb_id).not.toBeNull();
});

it('does not count or show used-up jars', async () => {
  const { h, byName } = setup();
  const items = repos(t.ctx.db).items;
  const cal = byName('Calendula');
  const cham = byName('Chamomile');
  items.create({ section_id: 1, name: 'Live', herb_id: cal.id });
  items.create({ section_id: 1, name: 'Empty', herb_id: cal.id, used_up_at: '2026-09-01T00:00:00.000Z' });
  items.create({ section_id: 1, name: 'Only empty', herb_id: cham.id, used_up_at: '2026-09-01T00:00:00.000Z' });
  const list = (await h().get('/api/herbs?has_jars=1')).body;
  expect(list.map(x => x.common_name)).toEqual(['Calendula']);
  expect(list[0].jar_count).toBe(1);
  const all = (await h().get('/api/herbs')).body;
  expect(all.find(x => x.common_name === 'Chamomile').jar_count).toBe(0);
  expect((await h().get(`/api/herbs/${cal.id}?today=${TODAY}`)).body.jars.map(j => j.name)).toEqual(['Live']);
});

it('searches list values, not their JSON punctuation', async () => {
  const { h } = setup();
  const names = async q => (await h().get(`/api/herbs?q=${encodeURIComponent(q)}`)).body.map(x => x.common_name);
  expect(await names('"')).toEqual([]);
  expect(await names('pot marig')).toEqual(['Calendula']);
});
