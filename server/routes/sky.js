import { Router } from 'express';
import { idParam, HttpError } from '../http.js';
import { check } from '../validate.js';
import { transaction } from '../db/connection.js';
import { addDays } from '../lib/dates.js';
import { skyForDay } from '../lib/sky.js';
import { getSettings } from '../services/settings.js';
import {
  listTimingRules, getTimingRule, localToday, createTimingRule, updateTimingRule, reorderTimingRules, deleteTimingRule, restoreTimingRule,
} from '../services/timing.js';

const MAX_RANGE_DAYS = 62;
const FIX = 'Please fix the highlighted fields.';
const RANGE_MSG = 'Pick a date between 1900 and 2100';

// Reads one date from the query string. A repeated parameter is a 400, and years outside 1900-2100 are refused.
export function queryDates(query, fields, required = false) {
  const raw = {};
  const problems = {};
  for (const f of fields) {
    const v = query[f];
    if (Array.isArray(v)) problems[f] = 'Send one date only';
    else raw[f] = typeof v === 'string' && v !== '' ? v : undefined;
  }
  if (Object.keys(problems).length) throw new HttpError(400, FIX, problems);
  const spec = Object.fromEntries(fields.map(f => [f, required ? 'date!' : 'date']));
  const data = check(spec, raw);
  for (const f of fields) {
    const year = data[f] ? Number(data[f].slice(0, 4)) : null;
    if (year !== null && (year < 1900 || year > 2100)) problems[f] = RANGE_MSG;
  }
  if (Object.keys(problems).length) throw new HttpError(400, FIX, problems);
  return data;
}

export function skyRouter(ctx) {
  const r = Router();
  r.get('/range', (req, res) => {
    const { from, to } = queryDates(req.query, ['from', 'to'], true);
    if (to < from) throw new HttpError(400, 'Please fix the highlighted fields.', { to: 'The end date must not be before the start date.' });
    if (addDays(from, MAX_RANGE_DAYS) <= to) {
      throw new HttpError(400, 'Please fix the highlighted fields.', { to: `Ask for at most ${MAX_RANGE_DAYS} days at a time.` });
    }
    const { hemisphere } = getSettings(ctx.db);
    const out = [];
    for (let day = from; day <= to; day = addDays(day, 1)) out.push(skyForDay(day, { hemisphere }));
    res.json(out);
  });
  r.get('/', (req, res) => {
    const { date } = queryDates(req.query, ['date']);
    const { hemisphere } = getSettings(ctx.db);
    res.json(date ? skyForDay(date, { hemisphere }) : skyForDay(localToday(), { hemisphere, now: new Date() }));
  });
  return r;
}

export function timingRulesRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listTimingRules(ctx.db)));
  r.post('/', (req, res) => res.status(201).json(createTimingRule(ctx.db, req.body)));
  r.put('/order', (req, res) => res.json(reorderTimingRules(ctx.db, req.body?.ids)));
  r.patch('/:id', (req, res) => res.json(updateTimingRule(ctx.db, idParam(req), req.body)));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    deleteTimingRule(ctx.db, id);
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.post('/:id/restore', (req, res) => {
    const id = idParam(req);
    transaction(ctx.db, () => restoreTimingRule(ctx.db, id));
    res.json(getTimingRule(ctx.db, id));
  });
  return r;
}
