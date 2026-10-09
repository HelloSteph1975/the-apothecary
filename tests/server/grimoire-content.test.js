import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTER_ORDER } from '../../server/data/grimoire/index.js';
import { PLANT_PARTS, RECIPE_TYPES, SOURCE_COVERS, AHPA_CLASSES, PLANETS, ELEMENTS, GENDERS } from '../../server/schemas.js';

// Checks every starter grimoire entry present in server/data/grimoire (not all 30 need to exist yet).
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../server/data/grimoire');
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();

const CAUTIONS = ['caution_pregnancy', 'caution_medications', 'caution_conditions', 'caution_duration', 'caution_topical'];
const BANNED_IN_USES = /\b(cure|cures|treats|heals|dose|dosage|mg)\b/i;
// An en dash is only allowed between two digits (a number range); anywhere else it is being used as a dash.
const DASH_EN = /(?<!\d)–|–(?!\d)/;

function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k));
  return [];
}

it('finds the entry files', () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(files)('%s', (file) => {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  let entry;

  it('parses as JSON', () => {
    entry = JSON.parse(raw);
    expect(entry && typeof entry).toBe('object');
  });

  const e = () => entry ?? JSON.parse(raw);

  it('has a slug that matches the file name and the starter list', () => {
    expect(e().slug).toBe(file.replace(/\.json$/, ''));
    expect(STARTER_ORDER).toContain(e().slug);
  });

  it('has the required fields', () => {
    const h = e();
    for (const f of ['common_name', 'latin_name', 'family', 'uses']) {
      expect(typeof h[f], f).toBe('string');
      expect(h[f].trim().length, f).toBeGreaterThan(0);
    }
    expect(Array.isArray(h.parts_used)).toBe(true);
    expect(h.parts_used.length).toBeGreaterThan(0);
    for (const f of CAUTIONS) {
      expect(typeof h[f], f).toBe('string');
      expect(h[f].trim().length, f).toBeGreaterThan(0);
    }
  });

  it('keeps list and choice values within the allowed lists', () => {
    const h = e();
    for (const p of h.parts_used) expect(PLANT_PARTS, 'parts_used').toContain(p);
    for (const p of h.preparations ?? []) expect(RECIPE_TYPES, 'preparations').toContain(p);
    for (const f of ['other_names', 'zodiac', 'associations', 'garden_companions', 'preparations']) {
      if (h[f] == null) continue;
      expect(Array.isArray(h[f]), f).toBe(true);
      for (const v of h[f]) expect(typeof v, f).toBe('string');
    }
    if (h.garden_harvest_part != null) expect(PLANT_PARTS).toContain(h.garden_harvest_part);
    expect([...AHPA_CLASSES, null]).toContain(h.ahpa_class ?? null);
    expect([...PLANETS, null]).toContain(h.planet ?? null);
    expect([...ELEMENTS, null]).toContain(h.element ?? null);
    expect([...GENDERS, null]).toContain(h.gender ?? null);
  });

  it('cites at least two sources, one covering safety, each with title, author, year and URL', () => {
    const { sources } = e();
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.some(s => (s.covers ?? []).includes('safety'))).toBe(true);
    for (const s of sources) {
      expect(typeof s.title).toBe('string');
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(typeof s.author).toBe('string');
      expect(s.author.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(s.year)).toBe(true);
      expect(Array.isArray(s.covers)).toBe(true);
      for (const c of s.covers) expect(SOURCE_COVERS).toContain(c);
      expect(s.url).toMatch(/^https?:\/\/\S+$/);
    }
  });

  it('uses no em dashes or en dashes as dashes', () => {
    for (const [at, text] of strings(e())) {
      expect(text.includes('—'), `em dash in ${at}`).toBe(false);
      expect(DASH_EN.test(text), `en dash in ${at}`).toBe(false);
    }
  });

  it('frames uses as tradition, without cure claims or dosages', () => {
    expect(e().uses).not.toMatch(BANNED_IN_USES);
  });

  it('keeps every text field to 900 characters or fewer', () => {
    for (const [at, text] of strings(e())) expect(text.length, at).toBeLessThanOrEqual(900);
  });
});
