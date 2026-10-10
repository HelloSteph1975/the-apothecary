import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('returns defaults set for Mexico City', async () => {
  t = makeTestContext();
  const res = await t.http().get('/api/settings');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({
    keeper_name: '', location_name: 'Mexico City', latitude: '19.4326', longitude: '-99.1332',
    hemisphere: 'north', units: 'metric', sky_suggestions: 'on',
    expiry_dried_leaf: '12', expiry_dried_flower: '12', expiry_root: '24', expiry_bark: '24', expiry_seed: '24',
    expiry_resin: '36', expiry_powder: '6', expiry_tincture: '60', expiry_oil: '12',
  });
});

it('saves good values and trims them', async () => {
  t = makeTestContext();
  const res = await t.http().put('/api/settings').send({ keeper_name: '  Stephanie ', latitude: 40.7, longitude: '-74', hemisphere: 'south', units: 'us' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ keeper_name: 'Stephanie', latitude: '40.7', longitude: '-74', hemisphere: 'south', units: 'us' });
  expect((await t.http().get('/api/settings')).body.keeper_name).toBe('Stephanie');
});

it('turns sky suggestions on or off and rejects anything else', async () => {
  t = makeTestContext();
  let res = await t.http().put('/api/settings').send({ sky_suggestions: 'off' });
  expect(res.body.sky_suggestions).toBe('off');
  res = await t.http().put('/api/settings').send({ sky_suggestions: 'maybe' });
  expect(res.status).toBe(400);
  expect(res.body.details.sky_suggestions).toBeTruthy();
  expect((await t.http().get('/api/settings')).body.sky_suggestions).toBe('off');
});

it('rejects bad values and unknown keys, saving nothing', async () => {
  t = makeTestContext();
  const res = await t.http().put('/api/settings').send({ keeper_name: 'Ok', latitude: '91', longitude: 'east', hemisphere: 'up', units: 'stone', colour: 'red', ['__proto__']: 'x' });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.details).sort()).toEqual(['__proto__', 'colour', 'hemisphere', 'latitude', 'longitude', 'units'].sort());
  expect((await t.http().get('/api/settings')).body.keeper_name).toBe('');
});
