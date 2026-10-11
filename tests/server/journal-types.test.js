import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';

let t;
afterEach(() => t?.cleanup());

function setup() {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const ritual = r.journalTypes.create({ name: 'Ritual', icon: 'sparkles', sort_order: 0 });
  const dream = r.journalTypes.create({ name: 'Dream', icon: 'cloud', sort_order: 1 });
  const note = r.journalTypes.create({ name: 'Note', sort_order: 2 });
  const entry = (type, title) => r.journalEntries.create({ type_id: type.id, title, entry_date: '2026-10-10' });
  return { h: t.http, r, ritual, dream, note, entry };
}

it('lists live types in order with a count of live entries', async () => {
  const { h, r, ritual, dream, entry } = setup();
  entry(ritual, 'A'); entry(ritual, 'B');
  r.journalEntries.remove(entry(dream, 'Gone').id);
  const res = await h().get('/api/journal-types');
  expect(res.status).toBe(200);
  expect(res.body.map(x => [x.name, x.entry_count])).toEqual([['Ritual', 2], ['Dream', 0], ['Note', 0]]);
});

it('creates and edits types with unique names among live types', async () => {
  const { h, r, note } = setup();
  let res = await h().post('/api/journal-types').send({ name: 'Walk', icon: 'leaf' });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: 'Walk', icon: 'leaf', is_starter: 0, slug: null, sort_order: 3 });
  res = await h().post('/api/journal-types').send({ name: 'ritual' });
  expect(res.status).toBe(400);
  expect(res.body.details.name).toBe('You already have a type with this name.');
  res = await h().patch(`/api/journal-types/${note.id}`).send({ name: ' DREAM ' });
  expect(res.status).toBe(400);
  expect(res.body.details.name).toBeTruthy();
  res = await h().patch(`/api/journal-types/${note.id}`).send({ name: 'Notes', description: 'Loose ends' });
  expect(res.body).toMatchObject({ name: 'Notes', description: 'Loose ends' });
  r.journalTypes.remove(note.id);
  expect((await h().post('/api/journal-types').send({ name: 'notes' })).status).toBe(201);
  expect((await h().post('/api/journal-types').send({ name: 'x', icon: 'rocket' })).body.details.icon).toBeTruthy();
});

it('asks for a move before deleting a type in use, then moves, deletes and undoes', async () => {
  const { h, r, ritual, dream, note, entry } = setup();
  const e = entry(ritual, 'A');
  let res = await h().delete(`/api/journal-types/${ritual.id}`);
  expect(res.status).toBe(409);
  expect(res.body).toEqual({ error: 'Move its entries to another type first.', details: { entries: 1 } });
  expect((await h().delete(`/api/journal-types/${ritual.id}?move_to=${ritual.id}`)).status).toBe(400);
  r.journalTypes.remove(note.id);
  res = await h().delete(`/api/journal-types/${ritual.id}?move_to=${note.id}`);
  expect(res.status).toBe(400);
  expect(res.body.details.move_to).toBeTruthy();
  res = await h().delete(`/api/journal-types/${ritual.id}?move_to=${dream.id}`);
  expect(res.status).toBe(200);
  expect(res.body.restore).toBe(`/api/journal-types/${ritual.id}/restore`);
  expect(r.journalEntries.get(e.id).type_id).toBe(dream.id);
  res = await h().post(`/api/journal-types/${ritual.id}/restore`);
  expect(res.status).toBe(200);
  expect(r.journalEntries.get(e.id).type_id).toBe(dream.id);
});

it('deletes an unused type straight away and reorders types', async () => {
  const { h, ritual, dream, note } = setup();
  expect((await h().delete(`/api/journal-types/${note.id}`)).status).toBe(200);
  const res = await h().put('/api/journal-types/order').send({ ids: [dream.id, ritual.id] });
  expect(res.body.map(x => x.name)).toEqual(['Dream', 'Ritual']);
  expect((await h().put('/api/journal-types/order').send({ ids: 'nope' })).status).toBe(400);
});

it('will not undo a type delete when a live type now has its name', async () => {
  const { h, r, note } = setup();
  await h().delete(`/api/journal-types/${note.id}`);
  await h().post('/api/journal-types').send({ name: 'Note' });
  const res = await h().post(`/api/journal-types/${note.id}/restore`);
  expect(res.status).toBe(400);
  expect(res.body.details.name).toBe('You already have a type with this name.');
  expect(r.journalTypes.get(note.id)).toBeNull();
});

it('restores a type whose own name is unchanged', async () => {
  const { h, dream } = setup();
  await h().delete(`/api/journal-types/${dream.id}`);
  const res = await h().post(`/api/journal-types/${dream.id}/restore`);
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Dream');
});
