process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';
import { PHOTO_OWNERS } from '../../server/services/photos.js';

let t;
afterEach(() => t?.cleanup());

// created_at is stored in UTC, as SQLite stamps it.
function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const section = r.sections.create({ name: 'Herbs', kind: 'herb' });
  const rt = r.recipeTypes.create({ name: 'Tea' });
  const jt = r.journalTypes.create({ name: 'Note' });
  const owners = {
    item: r.items.create({ section_id: section.id, name: 'Lavender jar', unit: 'g', amount: 5 }),
    supplier: r.suppliers.create({ name: 'Herb Shop' }),
    herb: r.herbs.create({ common_name: 'Mugwort' }),
    recipe: r.recipes.create({ name: 'Dream tea', type_id: rt.id }),
    batch: r.batches.create({ name: 'Autumn oil', start_date: '2026-10-01' }),
    task: r.tasks.create({ title: 'Water sage' }),
    journal: r.journalEntries.create({ type_id: jt.id, title: 'Full moon', entry_date: '2026-10-25' }),
  };
  let n = 0;
  const add = (kind, created_at, extra = {}) => {
    const p = r.photos.create({ owner_type: kind, owner_id: owners[kind].id, filename: `${++n}-aaaaaaaa.jpg`, caption: extra.caption ?? null });
    t.ctx.db.prepare('UPDATE photos SET created_at = ? WHERE id = ?').run(created_at, p.id);
    return p;
  };
  return { h: t.http, r, owners, add };
}

it('lists every kind with the owner name and link, newest first', async () => {
  const { h, owners, add } = setup();
  const kinds = Object.keys(PHOTO_OWNERS);
  kinds.forEach((k, i) => add(k, `2026-10-0${i + 1} 18:00:00`));
  const res = await h().get('/api/gallery');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ total: 7, page: 1 });
  expect(res.body.photos.map(p => p.owner.kind)).toEqual([...kinds].reverse());
  const by = Object.fromEntries(res.body.photos.map(p => [p.owner.kind, p.owner]));
  expect(by.item).toEqual({ kind: 'item', id: owners.item.id, name: 'Lavender jar', link: `/cabinet/items/${owners.item.id}` });
  expect(by.supplier).toMatchObject({ name: 'Herb Shop', link: `/cabinet/suppliers/${owners.supplier.id}` });
  expect(by.herb).toMatchObject({ name: 'Mugwort', link: `/grimoire/${owners.herb.id}` });
  expect(by.recipe).toMatchObject({ name: 'Dream tea', link: `/recipes/${owners.recipe.id}` });
  expect(by.batch).toMatchObject({ name: 'Autumn oil', link: `/batches/${owners.batch.id}` });
  expect(by.task).toMatchObject({ name: 'Water sage', link: `/todo/${owners.task.id}` });
  expect(by.journal).toMatchObject({ name: 'Full moon', link: `/journal/${owners.journal.id}` });
  expect(Object.keys(res.body.photos[0]).sort()).toEqual(['caption', 'created_at', 'filename', 'id', 'owner']);
});

it('filters by kind and by local day, and validates the query', async () => {
  const { h, add } = setup();
  add('herb', '2026-10-05 05:59:59'); // 23:59 on the 4th in Mexico City
  const a = add('herb', '2026-10-05 06:00:00'); // midnight on the 5th
  const b = add('recipe', '2026-10-06 05:59:59'); // 23:59 on the 5th
  add('herb', '2026-10-06 06:00:00'); // the 6th
  let res = await h().get('/api/gallery?from=2026-10-05&to=2026-10-05');
  expect(res.body.photos.map(p => p.id).sort()).toEqual([a.id, b.id].sort());
  res = await h().get('/api/gallery?kind=recipe');
  expect(res.body.photos.map(p => p.id)).toEqual([b.id]);
  res = await h().get('/api/gallery?kind=herb&from=2026-10-06');
  expect(res.body.total).toBe(1);
  expect((await h().get('/api/gallery?kind=bogus')).body.details.kind).toBeTruthy();
  expect((await h().get('/api/gallery?from=nope')).status).toBe(400);
  expect((await h().get('/api/gallery?to=1800-01-01')).status).toBe(400);
  expect((await h().get('/api/gallery?page=0')).status).toBe(400);
});

it('pages 48 at a time', async () => {
  const { h, add } = setup();
  for (let i = 0; i < 50; i++) add('herb', `2026-10-01 10:${String(i).padStart(2, '0')}:00`);
  let res = await h().get('/api/gallery');
  expect(res.body.total).toBe(50);
  expect(res.body.photos).toHaveLength(48);
  const first = res.body.photos[0].id;
  res = await h().get('/api/gallery?page=2');
  expect(res.body.photos).toHaveLength(2);
  expect(res.body.page).toBe(2);
  expect(res.body.photos.map(p => p.id)).not.toContain(first);
});

it('leaves out deleted photos and photos whose owner is deleted', async () => {
  const { h, r, owners, add } = setup();
  const keep = add('herb', '2026-10-01 10:00:00');
  const gone = add('herb', '2026-10-01 11:00:00');
  r.photos.remove(gone.id);
  add('recipe', '2026-10-01 12:00:00');
  r.recipes.remove(owners.recipe.id);
  const orphan = t.ctx.db.prepare("INSERT INTO photos (owner_type, owner_id, filename) VALUES ('task', 9999, 'x-bbbbbbbb.jpg')").run();
  expect(orphan.changes).toBe(1);
  const res = await h().get('/api/gallery');
  expect(res.body.photos.map(p => p.id)).toEqual([keep.id]);
  expect(res.body.total).toBe(1);
});

it('lists the kinds that have photos, with counts', async () => {
  const { h, add } = setup();
  add('journal', '2026-10-01 10:00:00'); add('herb', '2026-10-01 10:00:00'); add('herb', '2026-10-02 10:00:00');
  const res = await h().get('/api/gallery/kinds');
  expect(res.body).toEqual([{ kind: 'herb', count: 2 }, { kind: 'journal', count: 1 }]);
});

it('rejects huge page numbers and returns an empty list past the end', async () => {
  const { h, add } = setup();
  add('herb', '2026-10-01 10:00:00');
  expect((await h().get('/api/gallery?page=1e21')).status).toBe(400);
  expect((await h().get('/api/gallery?page=100001')).body.details.page).toBeTruthy();
  const res = await h().get('/api/gallery?page=100000');
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ photos: [], total: 1, page: 100000 });
});
