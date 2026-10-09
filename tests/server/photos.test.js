import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

async function upload(h, ownerType, ownerId) {
  const res = await h().post('/api/photos').field('owner_type', ownerType).field('owner_id', String(ownerId))
    .field('caption', 'Shelf shot').attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

it('uploads, serves, captions, deletes and restores a photo', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const photo = await upload(h, 'item', item.id);
  const file = path.join(t.dataDir, 'photos', photo.filename);
  expect(fs.existsSync(file)).toBe(true);
  expect((await h().get(`/photos/${photo.filename}`)).status).toBe(200);
  expect((await h().patch(`/api/photos/${photo.id}`).send({ caption: 'New' })).body.caption).toBe('New');
  const del = await h().delete(`/api/photos/${photo.id}`);
  expect(fs.existsSync(file)).toBe(false);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', photo.filename))).toBe(true);
  await h().post(del.body.restore);
  expect(fs.existsSync(file)).toBe(true);
});

it('rejects non-images and unknown owners', async () => {
  t = makeTestContext();
  const h = t.http;
  const bad = await h().post('/api/photos').field('owner_type', 'item').field('owner_id', '1')
    .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
  expect(bad.status).toBe(400);
  const res = await h().post('/api/photos').field('owner_type', 'item').field('owner_id', '999')
    .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(400);
});

it('deleting an item trashes its photos and undo brings them back', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const photo = await upload(h, 'item', item.id);
  const del = await h().delete(`/api/items/${item.id}`);
  expect((await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body).toHaveLength(0);
  await h().post(del.body.restore);
  const back = (await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body;
  expect(back.map(p => p.id)).toEqual([photo.id]);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', photo.filename))).toBe(true);
});

it('does not serve trashed files, even with an encoded path', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const photo = await upload(h, 'item', item.id);
  await h().delete(`/api/photos/${photo.id}`);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', photo.filename))).toBe(true);
  expect((await h().get(`/photos/_trash/${photo.filename}`)).status).toBe(404);
  expect((await h().get(`/photos/%5Ftrash/${photo.filename}`)).status).toBe(404);
  expect((await h().get(`/photos/%5ftrash/${photo.filename}`)).status).toBe(404);
});

it('blocks trash paths with doubled, backslash and encoded-slash tricks', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const photo = await upload(h, 'item', item.id);
  await h().delete(`/api/photos/${photo.id}`);
  for (const p of ['//_trash/', '/%5C_trash/', '/%2F_trash/', '/%5Ftrash/', '/_TRASH/', '/./_trash/', '/_trash./', '/_trash /']) {
    const res = await h().get(`/photos${p}${photo.filename}`);
    expect(res.status, p).toBe(404);
  }
});

it('rejects a non-multipart upload with 400', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/photos').send({ owner_type: 'item', owner_id: 1 });
  expect(res.status).toBe(400);
});

it('maps multer errors to 413 and 400', async () => {
  const { uploadErrors } = await import('../../server/routes/photos.js');
  const run = err => { let out; uploadErrors(err, {}, {}, e => { out = e; }); return out; };
  const big = Object.assign(new Error('x'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' });
  expect(run(big).status).toBe(413);
  expect(run(Object.assign(new Error('x'), { name: 'MulterError', code: 'LIMIT_UNEXPECTED_FILE' })).status).toBe(400);
});

it('makes the first photo the cover and lets another take over', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const a = await upload(h, 'item', item.id);
  const b = await upload(h, 'item', item.id);
  expect(a.is_cover).toBe(1);
  expect(b.is_cover).toBe(0);
  await h().patch(`/api/photos/${b.id}`).send({ is_cover: true });
  const list = (await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body;
  expect(list.map(p => [p.id, p.is_cover])).toEqual([[b.id, 1], [a.id, 0]]);
  const cabinet = (await h().get('/api/items?today=2026-10-08')).body;
  expect(cabinet[0].cover).toBe(b.filename);
});

it('accepts supplier photos and refuses unknown owner types', async () => {
  t = makeTestContext();
  const h = t.http;
  const s = (await h().post('/api/suppliers').send({ name: 'Moonvale' })).body;
  await upload(h, 'supplier', s.id);
  const bad = await h().post('/api/photos').field('owner_type', 'constructor').field('owner_id', '1')
    .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(bad.status).toBe(400);
});

it('deleting a supplier trashes its photos and undo restores them', async () => {
  t = makeTestContext();
  const h = t.http;
  const s = (await h().post('/api/suppliers').send({ name: 'Moonvale' })).body;
  const photo = await upload(h, 'supplier', s.id);
  const del = await h().delete(`/api/suppliers/${s.id}`);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', photo.filename))).toBe(true);
  await h().post(del.body.restore);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', photo.filename))).toBe(true);
});

it('hands the cover on when the cover is deleted, and keeps one cover after undo', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const a = await upload(h, 'item', item.id);
  const b = await upload(h, 'item', item.id);
  const del = await h().delete(`/api/photos/${a.id}`);
  expect((await h().get(`/api/photos/${b.id}`)).body.is_cover).toBe(1);
  await h().post(del.body.restore);
  const list = (await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body;
  expect(list.map(p => [p.id, p.is_cover])).toEqual([[b.id, 1], [a.id, 0]]);
});

it('restoring the only photo makes it the cover again', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const a = await upload(h, 'item', item.id);
  const del = await h().delete(`/api/photos/${a.id}`);
  expect((await h().post(del.body.restore)).body.is_cover).toBe(1);
});

it('deleting and restoring an item keeps the same single cover', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  await upload(h, 'item', item.id);
  const b = await upload(h, 'item', item.id);
  await h().patch(`/api/photos/${b.id}`).send({ is_cover: true });
  const del = await h().delete(`/api/items/${item.id}`);
  await h().post(del.body.restore);
  const list = (await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body;
  expect(list.filter(p => p.is_cover).map(p => p.id)).toEqual([b.id]);
});

it('refuses a non-string owner type', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/photos').field('owner_type', 'item').field('owner_type', 'item').field('owner_id', '1')
    .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(res.status).toBe(400);
});

it('ignores is_cover false so an owner never loses its cover', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const a = await upload(h, 'item', item.id);
  const res = await h().patch(`/api/photos/${a.id}`).send({ is_cover: false, caption: 'Hi' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ is_cover: 1, caption: 'Hi' });
});
