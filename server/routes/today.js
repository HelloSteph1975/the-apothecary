// server/routes/today.js
import { check } from '../validate.js';
import { todaySummary } from '../services/today.js';

export const todayRoute = ctx => (req, res) => {
  const { today } = check({ today: 'date!' }, req.query);
  res.json(todaySummary(ctx.db, today));
};
