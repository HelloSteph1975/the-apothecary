import { formatDay } from './cabinet.js';

export const madeText = made_on => `Made ${formatDay(made_on)}`;
export const useByText = expires_on => `Use by ${formatDay(expires_on)}`;

// The zero-based slot the first sheet starts at.
export const startSlot = (size, start) => Math.min(Math.max(1, Math.trunc(Number(start)) || 1), size.perSheet) - 1;

// Which sheet and slot each label copy lands on. The same rule as the PDF in server/services/labelPdf.js:
// slots fill left to right, top to bottom, `start` applies to the first sheet only, and a label's copies sit in a row.
// Returns one array per sheet with perSheet entries: { slot, label } or null for an empty slot.
export function layoutSheets(size, start, labels) {
  const copies = labels.flatMap(label => Array.from({ length: Math.max(1, label.copies ?? 1) }, () => label));
  if (copies.length === 0) return [];
  const first = startSlot(size, start);
  const pages = Math.ceil((first + copies.length) / size.perSheet);
  const sheets = Array.from({ length: pages }, () => Array(size.perSheet).fill(null));
  copies.forEach((label, i) => {
    const n = first + i;
    const slot = n % size.perSheet;
    sheets[Math.floor(n / size.perSheet)][slot] = { slot, label };
  });
  return sheets;
}

// Type size (pt), line allowance and padding (inches) for each block, matching the PDF.
export const CARD_LAYOUT = {
  'small-round': { pad: 0.28, gap: 2, name: [12, 2], made: 8.5, expiry: 8.5 },
  'medium-rect': { pad: 0.13, gap: 2.5, name: [14, 1], latin: [9, 1], made: 9, expiry: 9, ingredients: [8.5, 2], caution: [8, 1] },
  'large-rect': { pad: 0.16, gap: 3.5, name: [18, 2], latin: [11, 1], made: 10, expiry: 10, ingredients: [9.5, 4], caution: [9, 2] },
};
