process.env.TZ = 'America/Mexico_City';

import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { skyFacts } from '../../server/lib/sky.js';
import { addDays } from '../../server/lib/dates.js';
import { GARDEN_TASKS } from '../../server/schemas.js';
import { gardenDayTasks } from '../../server/services/garden.js';
import { getSettings } from '../../server/services/settings.js';
import { listTimingRules, seedTimingRules } from '../../server/services/timing.js';

let t;
afterEach(() => t?.cleanup());

const get = q => t.http().get(`/api/garden/suggestions${q}`);

it('gives the best days for each task in a 28-day window, a full moon first for harvesting above ground', async () => {
  t = makeTestContext();
  seedTimingRules(t.ctx.db);
  const res = await get('?from=2026-10-10');
  expect(res.status).toBe(200);
  expect(res.body.off).toBe(false);
  const order = res.body.tasks.map(x => x.task);
  expect(order).toEqual(GARDEN_TASKS.filter(k => order.includes(k)));
  const above = res.body.tasks.find(x => x.task === 'harvest-above');
  expect(above.days.length).toBeLessThanOrEqual(5);
  expect(above.days[0]).toMatchObject({ day: '2026-10-25', sky: { phase: 'full' } });
  expect(above.days[0].score).toBeGreaterThanOrEqual(3);
  const f = skyFacts('2026-10-25');
  expect(above.days[0].sky).toEqual({ phase: 'full', sign: f.moon.sign, ruler: f.ruler });
  expect(above.days[0].reasons.length).toBeGreaterThan(0);
  for (const task of res.body.tasks) {
    const scores = task.days.map(d => d.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const d of task.days) expect(d.day >= '2026-10-10' && d.day <= addDays('2026-10-10', 27)).toBe(true);
  }
});

it('uses today when from is left out, and bounds the number of days', async () => {
  t = makeTestContext();
  seedTimingRules(t.ctx.db);
  expect((await get('')).status).toBe(200);
  expect((await get('?days=1')).status).toBe(200);
  expect((await get('?days=42')).status).toBe(200);
  for (const bad of ['0', '43', 'x', '2.5']) {
    const res = await get(`?days=${bad}`);
    expect(res.status, bad).toBe(400);
    expect(res.body.details.days).toBeTruthy();
  }
  expect((await get('?from=2026-13-01')).status).toBe(400);
  const one = (await get('?from=2026-10-25&days=1')).body;
  expect(one.tasks.every(x => x.days.length === 1 && x.days[0].day === '2026-10-25')).toBe(true);
});

it('is off when suggestions are off', async () => {
  t = makeTestContext();
  seedTimingRules(t.ctx.db);
  await t.http().put('/api/settings').send({ sky_suggestions: 'off' });
  expect((await get('?from=2026-10-10')).body).toEqual({ off: true, tasks: [] });
  expect(gardenDayTasks(t.ctx.db, '2026-10-25', getSettings(t.ctx.db))).toEqual([]);
});

it('lists the tasks for one day with their reasons', () => {
  t = makeTestContext();
  seedTimingRules(t.ctx.db);
  const tasks = gardenDayTasks(t.ctx.db, '2026-10-25', getSettings(t.ctx.db));
  expect(tasks.map(x => x.task)).toContain('harvest-above');
  const above = tasks.find(x => x.task === 'harvest-above');
  const fullRule = listTimingRules(t.ctx.db).find(r => r.slug === 'garden-full-gather');
  expect(above.reasons).toContain(fullRule.text);
  expect(Object.keys(above).sort()).toEqual(['reasons', 'task']);
});

it('leaves out a rule she deleted', async () => {
  t = makeTestContext();
  seedTimingRules(t.ctx.db);
  const rules = listTimingRules(t.ctx.db).filter(r => r.garden_tasks.includes('harvest-above'));
  for (const r of rules) await t.http().delete(`/api/timing-rules/${r.id}`);
  const res = (await get('?from=2026-10-10')).body;
  expect(res.tasks.find(x => x.task === 'harvest-above')).toBeUndefined();
});
