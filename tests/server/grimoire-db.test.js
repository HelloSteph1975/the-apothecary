import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';
import { seedGrimoire, linkItemsToHerbs, loadStarterHerbs, STARTER_ORDER } from '../../server/services/grimoire.js';

let t;
afterEach(() => t?.cleanup());

const calendula = {
  slug: 'calendula', common_name: 'Calendula', other_names: ['Pot marigold'], latin_name: 'Calendula officinalis',
  parts_used: ['flower'], uses: 'Traditionally used in salves.', preparations: ['salve'], zodiac: ['Leo'],
  associations: ['the sun'], garden_companions: ['tomato'], ahpa_class: '1', planet: 'Sun', element: 'Fire', gender: 'masculine',
  sources: [
    { title: 'Source A', author: 'Someone', year: 2020, url: 'https://example.com/a', covers: ['uses', 'safety'] },
    { title: 'Source B', author: 'Other', year: 1652, url: null, covers: ['tradition'] },
  ],
};
const rose = {
  slug: 'rose', common_name: 'Rose', other_names: [], latin_name: 'Rosa spp. (R. gallica, R. damascena)',
  sources: [{ title: 'Rose source', covers: ['uses'] }],
};
const fixture = [calendula, rose];

const addItem = (name, extra = {}) => repos(t.ctx.db).items.create({ section_id: 1, name, ...extra });

it('creates the herbs and herb_sources tables', () => {
  t = makeTestContext();
  const names = t.ctx.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  expect(names).toContain('herbs');
  expect(names).toContain('herb_sources');
});

it('seeds entries with sources once, flags them as starters', () => {
  t = makeTestContext();
  expect(seedGrimoire(t.ctx.db, fixture)).toEqual({ added: 2 });
  const r = repos(t.ctx.db);
  const herbs = r.herbs.list();
  expect(herbs.map(h => h.common_name)).toEqual(['Calendula', 'Rose']);
  expect(herbs.every(h => h.is_starter === 1)).toBe(true);
  const cal = herbs[0];
  expect(JSON.parse(cal.other_names)).toEqual(['Pot marigold']);
  expect(r.herbSources.list({ herb_id: cal.id }).map(s => s.title)).toEqual(['Source A', 'Source B']);
  expect(JSON.parse(r.herbSources.list({ herb_id: cal.id })[0].covers)).toEqual(['uses', 'safety']);
  expect(seedGrimoire(t.ctx.db, fixture)).toEqual({ added: 0 });
  expect(r.herbs.list()).toHaveLength(2);
});

it('does not re-add a soft-deleted entry or overwrite edits', () => {
  t = makeTestContext();
  seedGrimoire(t.ctx.db, fixture);
  const r = repos(t.ctx.db);
  const cal = r.herbs.list().find(h => h.slug === 'calendula');
  r.herbs.update(cal.id, { uses: 'My own words.' });
  const rs = r.herbs.list().find(h => h.slug === 'rose');
  r.herbs.remove(rs.id);
  t.ctx.db.prepare("DELETE FROM settings WHERE key = 'grimoire_seed_version'").run();
  expect(seedGrimoire(t.ctx.db, fixture)).toEqual({ added: 0 });
  expect(r.herbs.get(cal.id).uses).toBe('My own words.');
  expect(r.herbs.list()).toHaveLength(1);
});

it('links jars by name, other name and Latin name, only when exactly one herb matches', () => {
  t = makeTestContext();
  seedGrimoire(t.ctx.db, fixture);
  const r = repos(t.ctx.db);
  const a = addItem('Calendula');
  const b = addItem('Pot marigold');
  const c = addItem('Damask', { latin_name: 'Rosa gallica' });
  const d = addItem('Mystery', { latin_name: 'Rosa canina' });
  const supply = r.items.create({ section_id: 2, name: 'Calendula' });
  expect(linkItemsToHerbs(t.ctx.db)).toEqual({ linked: 3 });
  const cal = r.herbs.list().find(h => h.slug === 'calendula').id;
  const ros = r.herbs.list().find(h => h.slug === 'rose').id;
  expect(r.items.get(a.id).herb_id).toBe(cal);
  expect(r.items.get(b.id).herb_id).toBe(cal);
  expect(r.items.get(c.id).herb_id).toBe(ros);
  expect(r.items.get(d.id).herb_id).toBeNull();
  expect(r.items.get(supply.id).herb_id).toBeNull();
});

it('leaves ambiguous matches unlinked', () => {
  t = makeTestContext();
  seedGrimoire(t.ctx.db, [
    { slug: 'x1', common_name: 'Mint', other_names: [], sources: [] },
    { slug: 'x2', common_name: 'Peppermint', other_names: ['Mint'], sources: [] },
  ]);
  const i = addItem('mint');
  expect(linkItemsToHerbs(t.ctx.db)).toEqual({ linked: 0 });
  expect(repos(t.ctx.db).items.get(i.id).herb_id).toBeNull();
});

it('loads starter herbs without error and exposes the order', () => {
  expect(Array.isArray(loadStarterHerbs())).toBe(true);
  expect(STARTER_ORDER).toHaveLength(30);
  expect(STARTER_ORDER[0]).toBe('chamomile');
});

it('lets photos belong to herbs', () => {
  expect(PHOTO_OWNERS.herb).toBe('herbs');
});
