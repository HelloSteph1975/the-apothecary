process.env.TZ = 'America/Mexico_City';

import fs from 'node:fs';
import path from 'node:path';
import { it, expect, afterEach, describe, vi } from 'vitest';
import { makeTestContext } from './helpers.js';
import { renderLabelPdf } from '../../server/services/labelPdf.js';

// The first render in a busy run loads the fonts and can be slow.
vi.setConfig({ testTimeout: 30000 });

let t;
afterEach(() => t?.cleanup());

const label = (over = {}) => ({ name: 'Sage jar', latin_name: 'Salvia officinalis', made_on: '2026-10-11', expires_on: '2027-04-11',
  ingredients: 'Sage, mint', caution: 'Check cautions for Sage before use.', show_moon: true, copies: 1, ...over });
const pdfPages = buf => (buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;
const post = body => t.http().post('/api/labels/pdf').send(body);
const labelsDir = () => path.join(t.dataDir, 'labels');
const PER = { 'small-round': 12, 'medium-rect': 10, 'large-rect': 6 };

describe('renderLabelPdf', () => {
  it('returns PDF bytes and the page count', async () => {
    const out = await renderLabelPdf({ size: 'medium-rect', start: 1, labels: [label()] });
    expect(out.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(out.pages).toBe(1);
    expect(out.printed).toBe(1);
    expect(pdfPages(out.buffer)).toBe(1);
  });

  it('starts at the given slot on the first page only', async () => {
    const one = await renderLabelPdf({ size: 'medium-rect', start: 10, labels: [label()] });
    expect(one.pages).toBe(1);
    const two = await renderLabelPdf({ size: 'medium-rect', start: 10, labels: [label({ copies: 2 })] });
    expect(two.pages).toBe(2);
    expect(pdfPages(two.buffer)).toBe(2);
    const full = await renderLabelPdf({ size: 'medium-rect', start: 10, labels: [label({ copies: 11 })] });
    expect(full.pages).toBe(2);
    const over = await renderLabelPdf({ size: 'medium-rect', start: 10, labels: [label({ copies: 12 })] });
    expect(over.pages).toBe(3);
    expect(pdfPages(over.buffer)).toBe(3);
  });

  it.each(Object.entries(PER))('fills exactly one page of %s', async (size, per) => {
    const out = await renderLabelPdf({ size, start: 1, labels: [label({ copies: per })] });
    expect(out.pages).toBe(1);
    expect(pdfPages(out.buffer)).toBe(1);
    const more = await renderLabelPdf({ size, start: 1, labels: [label({ copies: per + 1 })] });
    expect(more.pages).toBe(2);
  });

  it.each(Object.entries(PER))('keeps very long text inside its label on %s', async (size, per) => {
    const ingredients = Array.from({ length: 400 }, (_, i) => `Herb${i}`).join(', ').slice(0, 2000);
    const long = label({ name: 'N'.repeat(300), latin_name: 'L'.repeat(300), ingredients, caution: 'C '.repeat(1000), copies: per });
    const out = await renderLabelPdf({ size, start: 1, labels: [long] });
    expect(out.pages).toBe(1);
    expect(pdfPages(out.buffer)).toBe(1);
  });

  it('copes with labels that have no optional fields', async () => {
    const out = await renderLabelPdf({ size: 'large-rect', start: 1, labels: [label({ latin_name: null, made_on: null, expires_on: null, ingredients: null, caution: null })] });
    expect(out.pages).toBe(1);
  });
});

describe('POST /api/labels/pdf', () => {
  it('saves a PDF in the labels folder and says where', async () => {
    t = makeTestContext();
    const res = await post({ size: 'medium-rect', start: 3, labels: [label(), label({ name: 'Mint', copies: 2 })] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ pages: 1, labels: 3 });
    expect(res.body.file).toMatch(/^labels-\d{4}-\d{2}-\d{2}-\d{6}\.pdf$/);
    const bytes = fs.readFileSync(path.join(labelsDir(), res.body.file));
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdfPages(bytes)).toBe(1);
  });

  it('counts pages across the start slot and copies', async () => {
    t = makeTestContext();
    const res = await post({ size: 'small-round', start: 12, labels: [label({ copies: 13 })] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ pages: 2, labels: 13 });
    expect(pdfPages(fs.readFileSync(path.join(labelsDir(), res.body.file)))).toBe(2);
  });

  it('adds -2 and -3 when the name is taken in the same second', async () => {
    t = makeTestContext();
    const p = n => String(n).padStart(2, '0');
    const d = new Date();
    const base = `labels-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    // A clash is only certain when the clock does not tick between this setup and the request, so take over the clock.
    const RealDate = Date;
    const fixed = new RealDate(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    globalThis.Date = class extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fixed.getTime()])); }
      static now() { return fixed.getTime(); }
    };
    try {
      fs.writeFileSync(path.join(labelsDir(), `${base}.pdf`), '%PDF-old');
      const res = await post({ size: 'small-round', start: 1, labels: [label()] });
      expect(res.body.file).toBe(`${base}-2.pdf`);
      const res2 = await post({ size: 'small-round', start: 1, labels: [label()] });
      expect(res2.body.file).toBe(`${base}-3.pdf`);
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('recomputes the phase from the date and never takes a file name from the request', async () => {
    t = makeTestContext();
    const res = await post({ size: 'small-round', start: 1, file: '../evil.pdf', labels: [{ ...label(), phase: 'full' }] });
    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(t.dataDir, 'evil.pdf'))).toBe(false);
    expect(fs.readdirSync(labelsDir())).toEqual([res.body.file]);
  });

  describe('validation', () => {
    const bad = async (body, field) => {
      t = makeTestContext();
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.details).toBeTruthy();
      if (field) expect(Object.keys(res.body.details).join(' ')).toContain(field);
      expect(fs.readdirSync(labelsDir())).toEqual([]);
    };
    const ok = { size: 'medium-rect', start: 1, labels: [label()] };

    it('rejects a size that is not a key', () => bad({ ...ok, size: 'huge' }, 'size'));
    it('rejects a missing size', () => bad({ start: 1, labels: [label()] }, 'size'));
    it('rejects start below 1', () => bad({ ...ok, start: 0 }, 'start'));
    it('rejects start past the sheet', () => bad({ ...ok, start: 11 }, 'start'));
    it('rejects a start that is not a whole number', () => bad({ ...ok, start: 1.5 }, 'start'));
    it('rejects no labels', () => bad({ ...ok, labels: [] }, 'labels'));
    it('rejects labels that are not a list', () => bad({ ...ok, labels: 'x' }, 'labels'));
    it('rejects more than 60 labels', () => bad({ ...ok, labels: Array.from({ length: 61 }, () => label()) }, 'labels'));
    it('rejects copies below 1', () => bad({ ...ok, labels: [label({ copies: 0 })] }, 'copies'));
    it('rejects copies above 99', () => bad({ ...ok, labels: [label({ copies: 100 })] }, 'copies'));
    it('rejects more than 500 printed labels', () => bad({ ...ok, labels: Array.from({ length: 6 }, () => label({ copies: 99 })) }, 'labels'));
    it('rejects a missing name', () => bad({ ...ok, labels: [label({ name: '' })] }, 'name'));
    it('rejects a name over 300 characters', () => bad({ ...ok, labels: [label({ name: 'x'.repeat(301) })] }, 'name'));
    it('rejects a latin name over 300 characters', () => bad({ ...ok, labels: [label({ latin_name: 'x'.repeat(301) })] }, 'latin_name'));
    it('rejects ingredients over 2000 characters', () => bad({ ...ok, labels: [label({ ingredients: 'x'.repeat(2001) })] }, 'ingredients'));
    it('rejects a caution over 2000 characters', () => bad({ ...ok, labels: [label({ caution: 'x'.repeat(2001) })] }, 'caution'));
    it('rejects 61 labels with real label objects', () => bad({ size: 'small-round', start: 1, labels: Array.from({ length: 61 }, (_, i) => label({ name: `L${i}` })) }, 'labels'));
    it('rejects text that is not a string', () => bad({ ...ok, labels: [label({ caution: 5 })] }, 'caution'));
    it('rejects an impossible date', () => bad({ ...ok, labels: [label({ made_on: '2026-02-30' })] }, 'made_on'));
    it('rejects a date outside 1900 to 2100', () => bad({ ...ok, labels: [label({ expires_on: '2101-01-01' })] }, 'expires_on'));
    it('rejects an early date', () => bad({ ...ok, labels: [label({ made_on: '1899-12-31' })] }, 'made_on'));

    it('allows 60 real labels, 300 and 2000 character fields, and the edge dates', async () => {
      t = makeTestContext();
      const sixty = Array.from({ length: 60 }, (_, i) => label({ name: `L${i}` }));
      sixty[0] = label({ name: 'x'.repeat(300), latin_name: 'y'.repeat(300), ingredients: 'i'.repeat(2000), caution: 'c'.repeat(2000), made_on: '1900-01-01', expires_on: '2100-12-31' });
      const res = await post({ size: 'small-round', start: 1, labels: sixty });
      expect(res.status).toBe(200);
      expect(res.body.labels).toBe(60);
    }, 30000);

    it('allows exactly 500 printed labels', async () => {
      t = makeTestContext();
      const res = await post({ size: 'small-round', start: 12, labels: [...Array.from({ length: 5 }, () => label({ copies: 99 })), label({ copies: 5 })] });
      expect(res.status).toBe(200);
      expect(res.body.labels).toBe(500);
    }, 30000);
  });

  it('answers 500 with a plain message when the labels folder cannot be written', async () => {
    t = makeTestContext();
    fs.rmSync(labelsDir(), { recursive: true });
    fs.writeFileSync(labelsDir(), 'not a folder');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let res;
    try { res = await post({ size: 'medium-rect', start: 1, labels: [label()] }); } finally { var calls = spy.mock.calls.length; spy.mockRestore(); }
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Couldn't save the PDF in the labels folder.");
    expect(calls).toBe(1);
  });
});

describe('saved files', () => {
  it('lists labels PDFs newest first, with size and saved time', async () => {
    t = makeTestContext();
    expect((await t.http().get('/api/labels/files')).body).toEqual([]);
    const a = path.join(labelsDir(), 'labels-2026-10-10-090000.pdf');
    const b = path.join(labelsDir(), 'labels-2026-10-11-090000.pdf');
    fs.writeFileSync(a, '%PDF-a');
    fs.writeFileSync(b, '%PDF-bb');
    fs.writeFileSync(path.join(labelsDir(), 'notes.txt'), 'x');
    fs.utimesSync(a, new Date('2026-10-10T15:00:00Z'), new Date('2026-10-10T15:00:00Z'));
    fs.utimesSync(b, new Date('2026-10-11T15:00:00Z'), new Date('2026-10-11T15:00:00Z'));
    const res = await t.http().get('/api/labels/files');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { name: 'labels-2026-10-11-090000.pdf', size: 7, saved_at: '2026-10-11T15:00:00.000Z' },
      { name: 'labels-2026-10-10-090000.pdf', size: 6, saved_at: '2026-10-10T15:00:00.000Z' },
    ]);
  });

  it('serves a saved file inline as a PDF', async () => {
    t = makeTestContext();
    const made = (await post({ size: 'small-round', start: 1, labels: [label()] })).body;
    const res = await t.http().get(`/api/labels/files/${made.file}`).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^inline/);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('answers 404 when a matching name is a directory', async () => {
    t = makeTestContext();
    fs.mkdirSync(path.join(t.dataDir, 'labels', 'labels-2026-10-11-090000.pdf'), { recursive: true });
    expect((await t.http().get('/api/labels/files/labels-2026-10-11-090000.pdf')).status).toBe(404);
  });

  it('answers 404 for a missing file, a bad name or a traversal', async () => {
    t = makeTestContext();
    fs.writeFileSync(path.join(t.dataDir, 'secret.pdf'), '%PDF');
    for (const name of ['labels-2026-10-11-090000.pdf', 'notes.txt', '..%2Fsecret.pdf', '..%5Csecret.pdf', 'labels-x.pdf']) {
      expect((await t.http().get(`/api/labels/files/${name}`)).status).toBe(404);
    }
  });
});
