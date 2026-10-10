import { formatShortDay } from './cabinet.js';

// "Strain and bottle, due Oct 30"
export function nextStepText(step) {
  if (!step) return '';
  return step.due_on ? `${step.title}, due ${formatShortDay(step.due_on)}` : step.title;
}

export const isOverdue = (step, today) => Boolean(step?.due_on) && step.due_on < today;
