import { Router } from 'express';
import { HttpError } from '../http.js';
import { addDays } from '../lib/dates.js';
import { queryDates } from './sky.js';
import { calendar, calendarDay } from '../services/calendar.js';

const MAX_RANGE_DAYS = 62;
const FIX = 'Please fix the highlighted fields.';

export function calendarRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const { from, to } = queryDates(req.query, ['from', 'to'], true);
    if (to < from) throw new HttpError(400, FIX, { to: 'The end date must not be before the start date.' });
    if (addDays(from, MAX_RANGE_DAYS) <= to) throw new HttpError(400, FIX, { to: `Ask for at most ${MAX_RANGE_DAYS} days at a time.` });
    res.json(calendar(ctx.db, from, to));
  });
  r.get('/day/:day', (req, res) => {
    const { day } = queryDates({ day: req.params.day }, ['day'], true);
    res.json(calendarDay(ctx.db, day));
  });
  return r;
}
