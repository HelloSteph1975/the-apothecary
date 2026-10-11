import { localDayBounds } from '../lib/sky.js';
import { PHOTO_OWNERS } from './photos.js';

const PAGE_SIZE = 48;

// Where each kind of owner lives: its name column and the client page that shows it.
const OWNER_INFO = {
  item: { name: 'name', link: id => `/cabinet/items/${id}` },
  supplier: { name: 'name', link: id => `/cabinet/suppliers/${id}` },
  herb: { name: 'common_name', link: id => `/grimoire/${id}` },
  recipe: { name: 'name', link: id => `/recipes/${id}` },
  batch: { name: 'name', link: id => `/batches/${id}` },
  task: { name: 'title', link: id => `/todo/${id}` },
  journal: { name: 'title', link: id => `/journal/${id}` },
};

export const GALLERY_KINDS = Object.keys(PHOTO_OWNERS);

// Photos are stamped in UTC (datetime('now')); a local day is the span between its two midnights.
const utc = d => d.toISOString().slice(0, 19).replace('T', ' ');

// A live photo whose owner is also live. Each kind joins its own table, so a deleted or purged owner drops out.
function liveSql(kinds) {
  return kinds.map(k => `SELECT p.id, p.filename, p.caption, p.created_at, p.owner_type AS kind, p.owner_id,
      o.${OWNER_INFO[k].name} AS owner_name
    FROM photos p JOIN ${PHOTO_OWNERS[k]} o ON o.id = p.owner_id AND o.deleted_at IS NULL
    WHERE p.owner_type = '${k}' AND p.deleted_at IS NULL`).join('\nUNION ALL\n');
}

export function listGallery(db, { kind, from, to, page } = {}) {
  const kinds = kind ? [kind] : GALLERY_KINDS;
  const where = [];
  const args = [];
  if (from) { where.push('created_at >= ?'); args.push(utc(localDayBounds(from).start)); }
  if (to) { where.push('created_at < ?'); args.push(utc(localDayBounds(to).end)); }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const base = `(${liveSql(kinds)})${clause}`;
  const total = db.prepare(`SELECT COUNT(*) n FROM ${base}`).get(...args).n;
  const n = Number(page);
  const pageNo = Number.isInteger(n) && n >= 1 ? n : 1;
  const photos = db.prepare(`SELECT * FROM ${base} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, PAGE_SIZE, (pageNo - 1) * PAGE_SIZE)
    .map(p => ({
      id: p.id, filename: p.filename, caption: p.caption, created_at: p.created_at,
      owner: { kind: p.kind, id: p.owner_id, name: p.owner_name, link: OWNER_INFO[p.kind].link(p.owner_id) },
    }));
  return { photos, total, page: pageNo };
}

export function galleryKinds(db) {
  const counts = new Map(db.prepare(`SELECT kind, COUNT(*) n FROM (${liveSql(GALLERY_KINDS)}) GROUP BY kind`).all().map(r => [r.kind, r.n]));
  return GALLERY_KINDS.filter(k => counts.has(k)).map(k => ({ kind: k, count: counts.get(k) }));
}
