import { it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestContext } from './helpers.js';
import { loadConfig } from '../../server/config.js';

let t;
const tmpDirs = [];
afterEach(() => {
  t?.cleanup();
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
});

it('refuses system calls from another site and requests that name another host', async () => {
  t = makeTestContext();
  const h = t.http;
  expect((await h().post('/api/backups').set('Origin', 'https://evil.example')).status).toBe(403);
  expect((await h().post('/api/backups').set('Origin', 'null')).status).toBe(403);
  expect((await h().get('/api/health').set('Host', 'evil.example')).status).toBe(403);
  expect((await h().get('/photos/1-abcdef12.jpg').set('Host', 'evil.example:4197')).status).toBe(403);
  expect((await h().get('/api/health').set('Host', 'localhost:4197')).status).toBe(200);
  expect((await h().post('/api/backups').set('Origin', 'http://localhost:4197')).status).toBe(201);
});

it('serves only app-named photo files, with nosniff', async () => {
  t = makeTestContext();
  const h = t.http;
  const dir = path.join(t.dataDir, 'photos');
  fs.writeFileSync(path.join(dir, '1700000000000-abcdef12.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const ok = await h().get('/photos/1700000000000-abcdef12.jpg');
  expect(ok.status).toBe(200);
  expect(ok.headers['x-content-type-options']).toBe('nosniff');
  fs.writeFileSync(path.join(dir, 'notes.html'), '<script>alert(1)</script>');
  fs.writeFileSync(path.join(dir, '1-abcdef12.svg'), '<svg/>');
  fs.writeFileSync(path.join(dir, '_trash', '1700000000000-abcdef12.jpg'), 'x');
  for (const p of ['notes.html', '1-abcdef12.svg', '_trash/1700000000000-abcdef12.jpg', '%5Ftrash/1700000000000-abcdef12.jpg', '1-abcdef12.jpg']) {
    expect((await h().get(`/photos/${p}`)).status, p).toBe(404);
  }
});

it('explains a broken config.json and a bad port', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-cfg-'));
  tmpDirs.push(root);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "dataDir": "D:\\Apothecary Data" }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/config\.json.*double backslashes in Windows paths \(\\\\\)/s);
  fs.writeFileSync(path.join(root, 'config.json'), '{ "port": "abc" }');
  expect(() => loadConfig({ env: {}, root })).toThrow(/1 to 65535/);
  expect(() => loadConfig({ env: { APOTHECARY_PORT: '0' }, root })).toThrow(/APOTHECARY_PORT/);
  expect(() => loadConfig({ env: { APOTHECARY_DEMO_PORT: 'x' }, root, demo: true })).toThrow(/APOTHECARY_DEMO_PORT/);
});
