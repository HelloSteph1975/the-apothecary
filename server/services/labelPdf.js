import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { HttpError } from '../http.js';
import { isDate } from '../lib/dates.js';
import { sizeByKey } from './labelSizes.js';
import { phaseFor } from './labels.js';

const PT = 72;
export const MAX_LABELS = 60;
export const MAX_PRINTED = 500;
const MAX_TEXT = 300;
const TEXT_FIELDS = ['name', 'latin_name', 'ingredients', 'caution'];
const DATE_FIELDS = ['made_on', 'expires_on'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INK = '#2b2118';
const LIGHT = '#f6edd2';
const DARK = '#4a3a2c';
const GUIDE = '#8a7a68';

const require = createRequire(import.meta.url);
const fontFile = (pkg, file) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);
const FONTS = {
  name: fontFile('@fontsource/cormorant-garamond', 'cormorant-garamond-latin-600-normal.woff'),
  body: fontFile('@fontsource/eb-garamond', 'eb-garamond-latin-400-normal.woff'),
  italic: fontFile('@fontsource/eb-garamond', 'eb-garamond-latin-400-italic.woff'),
};

// Type size and line allowance for each block, by label size. Which blocks appear comes from the size's `fields`.
const LAYOUT = {
  'small-round': { pad: 0.28, gap: 2, name: [12, 2], made: 8.5, expiry: 8.5 },
  'medium-rect': { pad: 0.13, gap: 2.5, name: [14, 1], latin: [9, 1], made: 9, expiry: 9, ingredients: [8.5, 2], caution: [8, 1] },
  'large-rect': { pad: 0.16, gap: 3.5, name: [18, 2], latin: [11, 1], made: 10, expiry: 10, ingredients: [9.5, 4], caution: [9, 2] },
};

const fail = details => { throw new HttpError(400, 'Please fix the highlighted fields.', details); };
const textOrNull = v => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

function dateOk(v) {
  if (!isDate(v)) return false;
  const year = Number(v.slice(0, 4));
  return year >= 1900 && year <= 2100;
}

export function validateLabelRequest(body) {
  const errors = {};
  const src = body && typeof body === 'object' ? body : {};
  const size = typeof src.size === 'string' ? sizeByKey(src.size) : null;
  if (!size) errors.size = 'Pick a label size';
  let start = 1;
  if (src.start !== undefined && src.start !== null) {
    start = src.start;
    if (!Number.isInteger(start) || start < 1 || (size && start > size.perSheet)) {
      errors.start = size ? `Must be a whole number from 1 to ${size.perSheet}` : 'Must be a whole number';
    }
  }
  const labels = [];
  let printed = 0;
  if (!Array.isArray(src.labels) || src.labels.length < 1) errors.labels = 'Add at least one label';
  else if (src.labels.length > MAX_LABELS) errors.labels = `At most ${MAX_LABELS} labels at a time`;
  else {
    src.labels.forEach((raw, i) => {
      const at = f => `labels.${i}.${f}`;
      const l = raw && typeof raw === 'object' ? raw : {};
      const out = {};
      for (const f of TEXT_FIELDS) {
        const v = l[f];
        if (v === undefined || v === null || v === '') { out[f] = null; continue; }
        if (typeof v !== 'string') errors[at(f)] = 'Must be text';
        else if (v.length > MAX_TEXT) errors[at(f)] = `Must be ${MAX_TEXT} characters or fewer`;
        else out[f] = textOrNull(v);
      }
      if (!out.name && !errors[at('name')]) errors[at('name')] = 'Required';
      for (const f of DATE_FIELDS) {
        const v = l[f];
        if (v === undefined || v === null || v === '') out[f] = null;
        else if (typeof v !== 'string' || !dateOk(v)) errors[at(f)] = 'Must be a date from 1900 to 2100 (YYYY-MM-DD)';
        else out[f] = v;
      }
      const copies = l.copies === undefined || l.copies === null ? 1 : l.copies;
      if (!Number.isInteger(copies) || copies < 1 || copies > 99) errors[at('copies')] = 'Must be a whole number from 1 to 99';
      else printed += copies;
      out.copies = copies;
      out.show_moon = l.show_moon === undefined ? true : l.show_moon === true;
      labels.push(out);
    });
    if (!errors.labels && printed > MAX_PRINTED) errors.labels = `At most ${MAX_PRINTED} printed labels at a time`;
  }
  if (Object.keys(errors).length) fail(errors);
  return { size: size.key, start, labels, printed };
}

const longDate = day => {
  const [y, m, d] = day.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

// The moon is drawn in a 24 x 24 box and scaled down, with the same shapes as client/src/lib/moonGlyph.jsx.
const WAXING = { 'waxing crescent': 'crescent', 'first quarter': 'half', 'waxing gibbous': 'gibbous' };
const WANING = { 'waning gibbous': 'gibbous', 'last quarter': 'half', 'waning crescent': 'crescent' };
const litPath = curve => (curve === 'half'
  ? 'M12 2 A10 10 0 0 1 12 22 Z'
  : `M12 2 A10 10 0 0 1 12 22 A5 10 0 0 ${curve === 'crescent' ? 0 : 1} 12 2 Z`);

function drawMoon(doc, phase, x, y, size) {
  doc.save();
  doc.translate(x, y).scale(size / 24);
  doc.circle(12, 12, 10).lineWidth(1.5).fillAndStroke(phase === 'full' ? LIGHT : DARK, DARK);
  const curve = WAXING[phase] ?? WANING[phase];
  if (curve) {
    if (WANING[phase]) doc.translate(24, 0).scale(-1, 1);
    doc.path(litPath(curve)).fill(LIGHT);
  }
  doc.restore();
}

// One block of wrapped text, cut with an ellipsis inside its allowed lines.
function block(doc, { text, font, size, lines, x, width, align }) {
  doc.font(font).fontSize(size);
  const lh = doc.currentLineHeight(true);
  return {
    height: lines * lh,
    draw(y) {
      doc.font(font).fontSize(size).fillColor(INK).text(text, x, y, { width, height: lines * lh + 1, ellipsis: true, align });
    },
  };
}

function dateRow(doc, { label, lay, x, width, round, phase }) {
  const text = `Made ${longDate(label.made_on)}`;
  const moon = label.show_moon && phase ? 0.18 * PT : 0;
  doc.font('body').fontSize(lay.made);
  const lh = doc.currentLineHeight(true);
  const textW = Math.min(doc.widthOfString(text), width - (moon ? moon + 4 : 0));
  const start = round ? x + (width - (textW + (moon ? 4 + moon : 0))) / 2 : x;
  const rowH = Math.max(lh, moon);
  return {
    height: rowH,
    draw(y) {
      doc.font('body').fontSize(lay.made).fillColor(INK)
        .text(text, start, y + (rowH - lh) / 2, { width: textW + 1, height: lh + 1, lineBreak: false, ellipsis: true });
      if (moon) drawMoon(doc, phase, start + textW + 4, y + (rowH - moon) / 2, moon);
    },
  };
}

function drawLabel(doc, size, lay, label, ox, oy) {
  const w = size.width * PT;
  const h = size.height * PT;
  const round = size.shape === 'circle';
  doc.save().lineWidth(0.5).strokeColor(GUIDE);
  if (round) doc.circle(ox + w / 2, oy + h / 2, w / 2).stroke();
  else doc.rect(ox, oy, w, h).stroke();
  doc.restore();

  const pad = lay.pad * PT;
  const x = ox + pad;
  const width = w - pad * 2;
  const align = round ? 'center' : 'left';
  const shows = new Set(size.fields);
  const items = [];
  const text = (key, value, font, [sz, lines]) => {
    if (value && shows.has(key)) items.push(block(doc, { text: value, font, size: sz, lines, x, width, align }));
  };
  text('name', label.name, 'name', lay.name);
  if (lay.latin) text('latin_name', label.latin_name, 'italic', lay.latin);
  if (label.made_on && shows.has('made_on')) {
    items.push(dateRow(doc, { label, lay, x, width, round, phase: phaseFor(label.made_on) }));
  }
  if (label.expires_on && shows.has('expires_on')) {
    items.push(block(doc, { text: `Use by ${longDate(label.expires_on)}`, font: 'body', size: lay.expiry, lines: 1, x, width, align }));
  }
  if (lay.ingredients) text('ingredients', label.ingredients, 'body', lay.ingredients);
  if (lay.caution) text('caution', label.caution, 'body', lay.caution);

  const inset = pad * (round ? 1 : 0.9);
  const top = oy + inset;
  const bottom = oy + h - inset;
  const total = items.reduce((n, b) => n + b.height, 0) + lay.gap * Math.max(0, items.length - 1);
  let y = round ? Math.max(top, oy + (h - total) / 2) : top;
  for (const item of items) {
    if (y + item.height > bottom + 0.5) break; // never draw outside the label
    item.draw(y);
    y += item.height + lay.gap;
  }
}

// Builds the sheets in memory. Slots fill left to right, top to bottom; the first page starts at `start`.
export function renderLabelPdf({ size: sizeKey, start = 1, labels }) {
  const size = sizeByKey(sizeKey);
  const lay = LAYOUT[size.key];
  const slots = labels.flatMap(l => Array.from({ length: l.copies ?? 1 }, () => l));
  const pages = Math.ceil((start - 1 + slots.length) / size.perSheet);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: false, info: { Title: 'Apothecary labels', Producer: 'The Apothecary' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), pages, printed: slots.length }));
    try {
      doc.registerFont('name', FONTS.name);
      doc.registerFont('body', FONTS.body);
      doc.registerFont('italic', FONTS.italic);
      slots.forEach((label, i) => {
        const n = start - 1 + i;
        if (i === 0 || n % size.perSheet === 0) doc.addPage();
        const slot = n % size.perSheet;
        const ox = (size.left + (slot % size.cols) * size.pitchX) * PT;
        const oy = (size.top + Math.floor(slot / size.cols) * size.pitchY) * PT;
        drawLabel(doc, size, lay, label, ox, oy);
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

const pad2 = n => String(n).padStart(2, '0');
export function stampName(d = new Date()) {
  return `labels-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export const SAVE_FAILED = "Couldn't save the PDF in the labels folder.";
export const LABEL_FILE = /^labels-\d{4}-\d{2}-\d{2}-\d{6}(-\d+)?\.pdf$/;
export const labelsDir = dataDir => path.join(dataDir, 'labels');

// Writes the PDF into <dataDir>/labels with a server-made name, adding -2, -3 and so on if the name is taken.
export function savePdf(dataDir, buffer) {
  const dir = labelsDir(dataDir);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const base = stampName();
    for (let n = 1; ; n++) {
      const name = n === 1 ? `${base}.pdf` : `${base}-${n}.pdf`;
      try {
        fs.writeFileSync(path.join(dir, name), buffer, { flag: 'wx' });
        return name;
      } catch (err) {
        if (err.code !== 'EEXIST' || n > 999) throw err;
      }
    }
  } catch {
    throw new Error(SAVE_FAILED);
  }
}

export function listSavedPdfs(dataDir) {
  let names;
  try { names = fs.readdirSync(labelsDir(dataDir)); } catch { return []; }
  return names.filter(n => LABEL_FILE.test(n)).flatMap(name => {
    try {
      const st = fs.statSync(path.join(labelsDir(dataDir), name));
      return st.isFile() ? [{ name, size: st.size, saved_at: st.mtime.toISOString(), at: st.mtimeMs }] : [];
    } catch { return []; }
  }).sort((a, b) => b.at - a.at || (a.name < b.name ? 1 : -1)).map(({ at, ...row }) => row);
}
