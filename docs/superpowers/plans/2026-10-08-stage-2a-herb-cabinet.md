# The Apothecary, Stage 2A: Herb Cabinet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Herb cabinet drawer works: herbs and every other supply (bottles, tins, droppers, waxes, oils and more) can be added, edited, restocked and deleted, each with where it came from; suppliers have their own pages with purchase history; photos attach to items and suppliers; Today's "Running low" and "Nearing expiry" cards show real data.

**Architecture:** One `items` table holds every physical container (one row per jar, bottle, bag or box; bulk containers are one row with a count). `cabinet_sections` group items and are user-managed. `purchases` record each buy (initial or restock) against a supplier. Server logic lives in `server/services/cabinet.js`, `suppliers.js`, `photos.js` and `today.js`; routes stay thin, reusing H&L's generic `crudRouter` and `createRepo`. The client adds a Shelves page, item and supplier pages, and wires Today to `/api/today`.

**Tech Stack:** Same as Stage 1 (Node 24, Express 5, `node:sqlite`, React 19, React Router 7, Vite, Vitest, Supertest, Testing Library, Playwright). `multer` is already a dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md` (sections "Herb cabinet", "Suppliers", "Photos", "Today"). Stage 2A design approved in chat on 2026-10-08:
1. One row per container; bulk is one row with a count; Restock adds to it and logs a purchase.
2. 15 user-managed sections; Herbs section items get form, plant part and harvest date.
3. Source: bought (supplier, price, quantity, date, note), grown, foraged (place), made, gifted (from whom). Links to garden plants and batches arrive in later stages.
4. Expiry suggested from form, defaults editable in Settings; containers and tools have none.
5. Today: Running low, Nearing expiry (30 days) and Expired; Batches due stays empty until Stage 3.
6. Photos on items and suppliers, drag in, cover photo.
7. Units g, kg, oz, lb, ml, L, fl oz, count. No conversion.
8. Shopping list arrives in Stage 8.
9. Demo gets sample herbs, supplies and two suppliers.

**Source to copy from:** `C:\Users\S_Lip\dev\hearth-and-larder` (H&L). Read-only.

## Global Constraints

- Node 24+. App port 4197, demo 4201, browser tests 4203. Never touch `Documents\The Apothecary Data` or the demo folder in tests; tests use temp folders.
- Database changes only through a new entry appended to `migrations` in `server/db/migrations.js`. Never edit migration 1.
- Every table except `settings` has `created_at`, `updated_at`, `deleted_at`; deletes are soft and undoable through `POST <url>/:id/restore`.
- Units allowed: `g`, `kg`, `oz`, `lb`, `ml`, `l`, `fl oz`, `count`. Display `l` as "L".
- Forms allowed: `dried leaf`, `dried flower`, `root`, `bark`, `seed`, `resin`, `powder`, `fresh`, `tincture`, `oil`, `other`.
- Plant parts allowed: `leaf`, `flower`, `root`, `bark`, `seed`, `berry`, `resin`, `whole herb`.
- Source kinds allowed: `bought`, `grown`, `foraged`, `made`, `gifted`.
- Dates are `YYYY-MM-DD` strings in the user's local calendar. The client always sends `today`; the server never reads the clock for date logic.
- "Nearing expiry" means `today <= expires_on <= today + 30 days`. "Expired" means `expires_on < today`. "Running low" means `low_threshold IS NOT NULL AND amount <= low_threshold`. Used-up and deleted items are never in these lists.
- UI: use the shared `Field`, `TextInput`, `NumberInput`, `DateInput`, `TextArea`, `Select` from `client/src/components/Field.jsx`; `ParchmentCard`, `PageHeader`, `WaxSeal`, `Button`; focus indicators use `outline` with `--focus-color`; never add `outline: none`. Text meets WCAG AA. Plain, warm wording, no em dashes. Danger confirms focus "Keep it".
- Work on branch `feat/stage-2a-herb-cabinet` in a worktree under `C:\Users\S_Lip\dev\worktrees\`, never on `main`. Commit after every task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

```
server/db/repo.js, server/db/repos.js          generic soft-delete repo (copied from H&L) and the repo set
server/db/migrations.js                         + migration 2 (sections, suppliers, items, purchases)
server/routes/crud.js                           generic CRUD router (copied from H&L)
server/schemas.js                               value lists and request schemas
server/lib/dates.js                             addDays, addMonths on YYYY-MM-DD
server/services/cabinet.js                      list/detail/create/restock items, status, expiry suggestion, sections
server/services/suppliers.js                    supplier list with totals, supplier detail with history
server/services/photos.js                       + owner registry, cover, generic cascade
server/services/today.js                        Today summary
server/services/settings.js                     + expiry default months
server/services/purge.js                        + items, purchases, suppliers, sections
server/routes/cabinet.js                        /api/sections, /api/items, /api/purchases
server/routes/suppliers.js                      /api/suppliers
server/routes/photos.js                         /api/photos
server/routes/today.js                          /api/today
server/demo/seed.js                             + sample cabinet
client/src/lib/cabinet.js                       option lists, labels, formatAmount, status text
client/src/lib/image.js                         resizeImage (copied)
client/src/components/useDeleteWithUndo.jsx     (copied)
client/src/components/PhotoGallery.jsx          photos with captions and cover
client/src/components/CabinetTabs.jsx           Shelves | Suppliers tabs
client/src/screens/cabinet/Shelves.jsx          grouped list, search, filters, section manager
client/src/screens/cabinet/SectionManager.jsx   rename, reorder, add, delete sections
client/src/screens/cabinet/ItemForm.jsx         add and edit an item
client/src/screens/cabinet/ItemDetail.jsx       details, restock, purchases, photos
client/src/screens/cabinet/RestockDialog.jsx
client/src/screens/cabinet/Suppliers.jsx        supplier list
client/src/screens/cabinet/SupplierForm.jsx
client/src/screens/cabinet/SupplierDetail.jsx
client/src/screens/Today.jsx                    wired to /api/today
client/src/screens/Settings.jsx                 + expiry defaults card
client/src/App.jsx                              routes
tests/server/*.test.js, tests/client/*.test.jsx, e2e/cabinet.spec.js
```

---

### Task 1: Data layer (migration 2, repos, CRUD router, schemas, dates)

**Files:**
- Create (copied verbatim): `server/db/repo.js`, `server/routes/crud.js`
- Create: `server/db/repos.js`, `server/schemas.js`, `server/lib/dates.js`
- Modify: `server/db/migrations.js`
- Test: `tests/server/cabinet-db.test.js`, `tests/server/dates.test.js`

**Interfaces:**
- Produces: `repos(db)` with `sections`, `suppliers`, `items`, `purchases`, `photos` (each `{ get, list, create, update, remove, restore }`); `crudRouter(ctx, { repo, schema, filters, list, beforeDelete, onDelete, onRestore, prepareCreate, prepareUpdate, validateRow })`; `UNITS`, `FORMS`, `PLANT_PARTS`, `SOURCE_KINDS`, `SECTION_KINDS`; `sectionSchema`, `supplierSchema`, `itemSchema`, `purchaseSchema`, `restockSchema`, `photoSchema`; `addDays(date, n)`, `addMonths(date, n)`, `isDate(s)`.

- [ ] **Step 1: Copy the generic repo and CRUD router**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
cp $H/server/db/repo.js server/db/repo.js
cp $H/server/routes/crud.js server/routes/crud.js
```

- [ ] **Step 2: Write the failing tests**

`tests/server/dates.test.js`:

```js
import { it, expect } from 'vitest';
import { addDays, addMonths, isDate } from '../../server/lib/dates.js';

it('adds days across month and year ends', () => {
  expect(addDays('2026-10-08', 30)).toBe('2026-11-07');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

it('adds months and clamps to the last day of short months', () => {
  expect(addMonths('2026-10-08', 12)).toBe('2027-10-08');
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  expect(addMonths('2026-08-15', 6)).toBe('2027-02-15');
});

it('recognises real dates only', () => {
  expect(isDate('2026-02-28')).toBe(true);
  expect(isDate('2026-02-30')).toBe(false);
  expect(isDate('26-2-3')).toBe(false);
});
```

`tests/server/cabinet-db.test.js`:

```js
import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';
import { repos } from '../../server/db/repos.js';

let t;
afterEach(() => t?.cleanup());

it('seeds the fifteen starter sections in order, Herbs first', () => {
  t = makeTestContext();
  const rows = repos(t.ctx.db).sections.list();
  expect(rows.map(r => r.name)).toEqual([
    'Herbs', 'Oils and butters', 'Waxes', 'Alcohol and vinegars', 'Honey and sweeteners', 'Essential oils',
    'Salts and minerals', 'Resins and incense', 'Candles', 'Crystals and stones', 'Containers',
    'Labels and packaging', 'Cloth and bags', 'Tools and equipment', 'Other',
  ]);
  expect(rows[0].kind).toBe('herb');
  expect(rows.slice(1).every(r => r.kind === 'supply')).toBe(true);
});

it('stores an item, a supplier and a purchase, and soft-deletes', () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  const sup = r.suppliers.create({ name: 'Moonvale Botanicals', rating: 5 });
  const item = r.items.create({ section_id: 11, name: 'Amber dropper bottle', size_label: '30 ml', amount: 24, unit: 'count', low_threshold: 6 });
  r.purchases.create({ item_id: item.id, supplier_id: sup.id, purchased_on: '2026-10-01', quantity: 24, unit: 'count', price: 18.5 });
  expect(r.purchases.list({ item_id: item.id })).toHaveLength(1);
  expect(r.items.remove(item.id)).toBe(true);
  expect(r.items.get(item.id)).toBeNull();
  expect(r.items.restore(item.id)).toBe(true);
  expect(r.items.get(item.id).name).toBe('Amber dropper bottle');
});

it('rejects values outside the allowed lists at the database level', () => {
  t = makeTestContext();
  const r = repos(t.ctx.db);
  expect(() => r.items.create({ section_id: 1, name: 'X', unit: 'cups' })).toThrow();
  expect(() => r.items.create({ section_id: 1, name: 'X', form: 'liquid' })).toThrow();
  expect(() => r.items.create({ section_id: 1, name: 'X', source_kind: 'stolen' })).toThrow();
  expect(() => r.suppliers.create({ name: 'Y', rating: 6 })).toThrow();
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run tests/server/dates.test.js tests/server/cabinet-db.test.js`
Expected: FAIL (modules not found).

- [ ] **Step 4: Write `server/lib/dates.js`**

```js
// Calendar arithmetic on YYYY-MM-DD strings, done in UTC so time zones never shift the day.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const fmt = dt => dt.toISOString().slice(0, 10);

export function isDate(s) {
  if (typeof s !== 'string' || !DATE.test(s)) return false;
  const { y, m, d } = parse(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(s, n) {
  const { y, m, d } = parse(s);
  return fmt(new Date(Date.UTC(y, m - 1, d + n)));
}

export function addMonths(s, n) {
  const { y, m, d } = parse(s);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))));
}
```

- [ ] **Step 5: Append migration 2 to `server/db/migrations.js`**

Add this entry after migration 1 inside the `migrations` array:

```js
  // 2: the herb cabinet. One item row per physical container; purchases log each buy.
  `
  CREATE TABLE cabinet_sections (id INTEGER PRIMARY KEY, name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'supply' CHECK (kind IN ('herb','supply')), sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
  CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, website TEXT, contact TEXT, good_for TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5), notes TEXT, ${TS});
  CREATE TABLE items (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES cabinet_sections(id),
    name TEXT NOT NULL, latin_name TEXT, herb_id INTEGER,
    form TEXT CHECK (form IN ('dried leaf','dried flower','root','bark','seed','resin','powder','fresh','tincture','oil','other')),
    plant_part TEXT CHECK (plant_part IN ('leaf','flower','root','bark','seed','berry','resin','whole herb')),
    size_label TEXT, amount REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'g' CHECK (unit IN ('g','kg','oz','lb','ml','l','fl oz','count')),
    low_threshold REAL, acquired_on TEXT, expires_on TEXT, storage_spot TEXT,
    source_kind TEXT CHECK (source_kind IN ('bought','grown','foraged','made','gifted')),
    source_place TEXT, source_from TEXT, notes TEXT, used_up_at TEXT, ${TS});
  CREATE TABLE purchases (id INTEGER PRIMARY KEY, item_id INTEGER NOT NULL REFERENCES items(id),
    supplier_id INTEGER REFERENCES suppliers(id), purchased_on TEXT NOT NULL, quantity REAL NOT NULL,
    unit TEXT NOT NULL, price REAL, order_note TEXT, ${TS});
  CREATE INDEX idx_items_section ON items(section_id);
  CREATE INDEX idx_purchases_item ON purchases(item_id);
  CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
  INSERT INTO cabinet_sections (name, kind, sort_order) VALUES
    ('Herbs','herb',0), ('Oils and butters','supply',1), ('Waxes','supply',2), ('Alcohol and vinegars','supply',3),
    ('Honey and sweeteners','supply',4), ('Essential oils','supply',5), ('Salts and minerals','supply',6),
    ('Resins and incense','supply',7), ('Candles','supply',8), ('Crystals and stones','supply',9),
    ('Containers','supply',10), ('Labels and packaging','supply',11), ('Cloth and bags','supply',12),
    ('Tools and equipment','supply',13), ('Other','supply',14);
  `,
```

`herb_id` has no foreign key yet; Stage 2B adds the `herbs` table and links it.

- [ ] **Step 6: Write `server/schemas.js`**

```js
export const UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'fl oz', 'count'];
export const FORMS = ['dried leaf', 'dried flower', 'root', 'bark', 'seed', 'resin', 'powder', 'fresh', 'tincture', 'oil', 'other'];
export const PLANT_PARTS = ['leaf', 'flower', 'root', 'bark', 'seed', 'berry', 'resin', 'whole herb'];
export const SOURCE_KINDS = ['bought', 'grown', 'foraged', 'made', 'gifted'];
export const SECTION_KINDS = ['herb', 'supply'];

export const sectionSchema = { name: 'string!', kind: { type: SECTION_KINDS, nullable: false }, sort_order: { type: 'int', nullable: false } };
export const supplierSchema = {
  name: 'string!', website: 'string', contact: 'string', good_for: 'string',
  rating: { type: 'int', min: 1, max: 5 }, notes: 'string',
};
export const itemSchema = {
  section_id: 'int!', name: 'string!', latin_name: 'string', form: FORMS, plant_part: PLANT_PARTS, size_label: 'string',
  amount: { type: 'number', min: 0, nullable: false }, unit: { type: UNITS, nullable: false },
  low_threshold: { type: 'number', min: 0 }, acquired_on: 'date', expires_on: 'date', storage_spot: 'string',
  source_kind: SOURCE_KINDS, source_place: 'string', source_from: 'string', notes: 'string',
  used_up: { type: 'bool', nullable: false },
};
export const purchaseSchema = {
  supplier_id: 'int', purchased_on: 'date!', quantity: { type: 'number', min: 0, required: true },
  price: { type: 'number', min: 0 }, order_note: 'string',
};
export const restockSchema = { ...purchaseSchema, expires_on: 'date' };
export const photoSchema = { caption: 'string', sort_order: { type: 'int', nullable: false }, is_cover: { type: 'bool', nullable: false } };
```

`used_up` is a request-only flag; the cabinet service turns it into `used_up_at`.

- [ ] **Step 7: Write `server/db/repos.js`**

```js
import { createRepo } from './repo.js';

const cache = new WeakMap();

export function repos(db) {
  let r = cache.get(db);
  if (!r) {
    r = {
      sections: createRepo(db, 'cabinet_sections', ['name', 'kind', 'sort_order'], { orderBy: 'sort_order, id' }),
      suppliers: createRepo(db, 'suppliers', ['name', 'website', 'contact', 'good_for', 'rating', 'notes'], { orderBy: 'name COLLATE NOCASE' }),
      items: createRepo(db, 'items', ['section_id', 'name', 'latin_name', 'herb_id', 'form', 'plant_part', 'size_label', 'amount', 'unit',
        'low_threshold', 'acquired_on', 'expires_on', 'storage_spot', 'source_kind', 'source_place', 'source_from', 'notes', 'used_up_at'],
        { orderBy: 'name COLLATE NOCASE' }),
      purchases: createRepo(db, 'purchases', ['item_id', 'supplier_id', 'purchased_on', 'quantity', 'unit', 'price', 'order_note'],
        { orderBy: 'purchased_on DESC, id DESC' }),
      photos: createRepo(db, 'photos', ['owner_type', 'owner_id', 'filename', 'caption', 'is_cover', 'sort_order'], { orderBy: 'is_cover DESC, sort_order, id' }),
    };
    cache.set(db, r);
  }
  return r;
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run --project server`
Expected: all pass, including `db.test.js` (it checks `user_version === migrations.length`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add the herb cabinet tables, repos and schemas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cabinet service and routes (sections, items, purchases, restock)

**Files:**
- Create: `server/services/cabinet.js`, `server/routes/cabinet.js`
- Modify: `server/services/settings.js` (expiry defaults), `server/routes/index.js`
- Test: `tests/server/cabinet.test.js`, `tests/server/settings.test.js` (update defaults)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `EXPIRY_KEYS` map form to settings key, e.g. `{ 'dried leaf': 'expiry_dried_leaf', ... }`.
  - `suggestExpiry(form, acquiredOn, settings) -> 'YYYY-MM-DD' | null`
  - `itemStatus(row, today) -> { low, expiring, expired }`
  - `listItems(db, filters, today) -> rows` with `section_name`, `section_kind`, `cover`, `last_purchased_on`, `last_price`, `last_quantity`, `last_supplier_id`, `last_supplier_name`, and `status`
  - `getItemDetail(db, id, today) -> item with section, purchases[], photos[], status`
  - `createItem(db, body) -> item`, `updateItem(db, id, body) -> item`, `restockItem(db, id, body) -> item`
  - Routes: `GET/POST /api/sections`, `PATCH/DELETE /api/sections/:id` (`DELETE ?move_to=ID`), `POST /api/sections/:id/restore`, `PUT /api/sections/order` (`{ ids: [] }`); `GET /api/items?today&section_id&q&status&source_kind&form&plant_part&storage_spot&supplier_id&include_used_up`, `GET /api/items/:id?today`, `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id`, `POST /api/items/:id/restore`, `POST /api/items/:id/restock`, `GET /api/expiry-suggestion?form&acquired_on`; `PATCH/DELETE /api/purchases/:id`, `POST /api/purchases/:id/restore`; `GET /api/storage-spots` (distinct spots for the form's suggestions).

- [ ] **Step 1: Write the failing test `tests/server/cabinet.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());
const TODAY = '2026-10-08';

async function supplier(h, name = 'Moonvale Botanicals') {
  return (await h().post('/api/suppliers').send({ name })).body;
}

it('creates a bought herb with its first purchase and lists it with status', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const res = await h().post('/api/items').send({
    section_id: 1, name: 'Calendula', latin_name: 'Calendula officinalis', form: 'dried flower', plant_part: 'flower',
    amount: 40, unit: 'g', low_threshold: 50, acquired_on: '2026-09-01', expires_on: '2026-10-20', storage_spot: 'Top shelf',
    source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: '2026-09-01', price: 9.5 },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const list = (await h().get(`/api/items?today=${TODAY}`)).body;
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({
    name: 'Calendula', section_name: 'Herbs', last_supplier_name: 'Moonvale Botanicals', last_price: 9.5, last_quantity: 40,
    status: { low: true, expiring: true, expired: false },
  });
});

it('restock adds to the amount, logs the purchase and can set a new expiry', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const item = (await h().post('/api/items').send({ section_id: 11, name: 'Amber dropper bottle', size_label: '30 ml', amount: 4, unit: 'count', low_threshold: 6 })).body;
  const res = await h().post(`/api/items/${item.id}/restock`).send({ quantity: 24, supplier_id: sup.id, purchased_on: '2026-10-05', price: 18 });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.body).toMatchObject({ amount: 28, source_kind: 'bought' });
  const detail = (await h().get(`/api/items/${item.id}?today=${TODAY}`)).body;
  expect(detail.purchases).toHaveLength(1);
  expect(detail.purchases[0]).toMatchObject({ quantity: 24, unit: 'count', supplier_name: 'Moonvale Botanicals', price: 18 });
  expect(detail.status.low).toBe(false);
});

it('filters by section, search, status, source and supplier', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  await h().post('/api/items').send({ section_id: 1, name: 'Lavender', latin_name: 'Lavandula angustifolia', amount: 100, unit: 'g', expires_on: '2026-09-01', source_kind: 'grown' });
  await h().post('/api/items').send({ section_id: 3, name: 'Beeswax pastilles', amount: 20, unit: 'g', low_threshold: 50, source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: '2026-08-01' } });
  await h().post('/api/items').send({ section_id: 11, name: '2 oz tin', amount: 10, unit: 'count', source_kind: 'gifted', source_from: 'Rowan' });
  const names = async qs => (await h().get(`/api/items?today=${TODAY}&${qs}`)).body.map(i => i.name);
  expect(await names('section_id=1')).toEqual(['Lavender']);
  expect(await names('q=lavandula')).toEqual(['Lavender']);
  expect(await names('status=expired')).toEqual(['Lavender']);
  expect(await names('status=low')).toEqual(['Beeswax pastilles']);
  expect(await names('source_kind=gifted')).toEqual(['2 oz tin']);
  expect(await names(`supplier_id=${sup.id}`)).toEqual(['Beeswax pastilles']);
});

it('marks an item used up and hides it unless asked', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Nettle', amount: 0, unit: 'g' })).body;
  const res = await h().patch(`/api/items/${item.id}`).send({ used_up: true });
  expect(res.body.used_up_at).toBeTruthy();
  expect((await h().get(`/api/items?today=${TODAY}`)).body).toHaveLength(0);
  expect((await h().get(`/api/items?today=${TODAY}&include_used_up=1`)).body).toHaveLength(1);
  expect((await h().patch(`/api/items/${item.id}`).send({ used_up: false })).body.used_up_at).toBeNull();
});

it('rejects bad items and unknown sections with field errors', async () => {
  t = makeTestContext();
  const h = t.http;
  const bad = await h().post('/api/items').send({ section_id: 1, name: '', amount: -1, unit: 'cups' });
  expect(bad.status).toBe(400);
  expect(Object.keys(bad.body.details).sort()).toEqual(['amount', 'name', 'unit']);
  const noSection = await h().post('/api/items').send({ section_id: 999, name: 'Rose', amount: 1, unit: 'g' });
  expect(noSection.status).toBe(400);
  expect(noSection.body.details).toHaveProperty('section_id');
  const noSupplier = await h().post('/api/items').send({ section_id: 1, name: 'Rose', amount: 1, unit: 'g', source_kind: 'bought', purchase: { supplier_id: 999, purchased_on: TODAY } });
  expect(noSupplier.status).toBe(400);
});

it('deletes and restores an item, its purchases staying with it', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const item = (await h().post('/api/items').send({ section_id: 2, name: 'Jojoba oil', amount: 250, unit: 'ml', source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: TODAY, price: 14 } })).body;
  const del = await h().delete(`/api/items/${item.id}`);
  expect((await h().get(`/api/items?today=${TODAY}`)).body).toHaveLength(0);
  expect((await h().get(`/api/suppliers/${sup.id}`)).body.purchases).toHaveLength(0);
  await h().post(del.body.restore);
  expect((await h().get(`/api/suppliers/${sup.id}`)).body.purchases).toHaveLength(1);
});

it('suggests expiry from the form using the settings defaults', async () => {
  t = makeTestContext();
  const h = t.http;
  expect((await h().get('/api/expiry-suggestion?form=dried%20leaf&acquired_on=2026-10-08')).body).toEqual({ expires_on: '2027-10-08' });
  expect((await h().get('/api/expiry-suggestion?form=powder&acquired_on=2026-10-08')).body).toEqual({ expires_on: '2027-04-08' });
  expect((await h().get('/api/expiry-suggestion?form=fresh&acquired_on=2026-10-08')).body).toEqual({ expires_on: null });
  await h().put('/api/settings').send({ expiry_dried_leaf: '18' });
  expect((await h().get('/api/expiry-suggestion?form=dried%20leaf&acquired_on=2026-10-08')).body).toEqual({ expires_on: '2028-04-08' });
});

it('manages sections: add, rename, reorder, and delete only after moving items', async () => {
  t = makeTestContext();
  const h = t.http;
  const added = (await h().post('/api/sections').send({ name: 'Ritual tools' })).body;
  expect(added).toMatchObject({ name: 'Ritual tools', kind: 'supply', sort_order: 15 });
  await h().patch(`/api/sections/${added.id}`).send({ name: 'Altar tools' });
  const ids = (await h().get('/api/sections')).body.map(s => s.id);
  const reordered = [added.id, ...ids.filter(id => id !== added.id)];
  expect((await h().put('/api/sections/order').send({ ids: reordered })).body.map(s => s.name)[0]).toBe('Altar tools');
  await h().post('/api/items').send({ section_id: added.id, name: 'Athame', amount: 1, unit: 'count' });
  const blocked = await h().delete(`/api/sections/${added.id}`);
  expect(blocked.status).toBe(409);
  expect(blocked.body.details).toEqual({ items: 1 });
  const moved = await h().delete(`/api/sections/${added.id}?move_to=14`);
  expect(moved.status).toBe(200);
  expect((await h().get(`/api/items?today=${TODAY}&section_id=14`)).body.map(i => i.name)).toEqual(['Athame']);
  await h().post(moved.body.restore);
  expect((await h().get('/api/sections')).body.some(s => s.name === 'Altar tools')).toBe(true);
});

it('edits and deletes a purchase without touching the amount', async () => {
  t = makeTestContext();
  const h = t.http;
  const sup = await supplier(h);
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Rose petals', amount: 30, unit: 'g', source_kind: 'bought', purchase: { supplier_id: sup.id, purchased_on: TODAY, price: 7 } })).body;
  const p = (await h().get(`/api/items/${item.id}?today=${TODAY}`)).body.purchases[0];
  expect((await h().patch(`/api/purchases/${p.id}`).send({ price: 6.5 })).body.price).toBe(6.5);
  await h().delete(`/api/purchases/${p.id}`);
  const after = (await h().get(`/api/items/${item.id}?today=${TODAY}`)).body;
  expect(after.purchases).toHaveLength(0);
  expect(after.amount).toBe(30);
});

it('requires today on list and detail', async () => {
  t = makeTestContext();
  expect((await t.http().get('/api/items')).status).toBe(400);
});
```

Also update `tests/server/settings.test.js` "returns defaults" to expect the new keys from Step 4 (`expiry_dried_leaf: '12'` and the rest).

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/cabinet.test.js`
Expected: FAIL with 404s.

- [ ] **Step 3: Write `server/services/cabinet.js`**

```js
import { HttpError, notFound } from '../http.js';
import { check } from '../validate.js';
import { transaction } from '../db/connection.js';
import { repos } from '../db/repos.js';
import { itemSchema, purchaseSchema, restockSchema } from '../schemas.js';
import { addDays, addMonths, isDate } from '../lib/dates.js';

export const EXPIRY_KEYS = {
  'dried leaf': 'expiry_dried_leaf', 'dried flower': 'expiry_dried_flower', root: 'expiry_root', bark: 'expiry_bark',
  seed: 'expiry_seed', resin: 'expiry_resin', powder: 'expiry_powder', tincture: 'expiry_tincture', oil: 'expiry_oil',
};

// Months until a form is past its best; 0 or a missing key means "no suggestion".
export function suggestExpiry(form, acquiredOn, settings) {
  const key = EXPIRY_KEYS[form];
  const months = key ? Number(settings[key]) : 0;
  if (!months || !isDate(acquiredOn)) return null;
  return addMonths(acquiredOn, months);
}

export function itemStatus(row, today) {
  const live = !row.used_up_at;
  return {
    low: live && row.low_threshold != null && row.amount <= row.low_threshold,
    expiring: live && row.expires_on != null && row.expires_on >= today && row.expires_on <= addDays(today, 30),
    expired: live && row.expires_on != null && row.expires_on < today,
  };
}

const LIST_SQL = `
  SELECT i.*, s.name AS section_name, s.kind AS section_kind, s.sort_order AS section_order,
    (SELECT filename FROM photos p WHERE p.owner_type = 'item' AND p.owner_id = i.id AND p.deleted_at IS NULL
      ORDER BY p.is_cover DESC, p.sort_order, p.id LIMIT 1) AS cover,
    lp.purchased_on AS last_purchased_on, lp.price AS last_price, lp.quantity AS last_quantity,
    lp.supplier_id AS last_supplier_id, sup.name AS last_supplier_name
  FROM items i
  JOIN cabinet_sections s ON s.id = i.section_id
  LEFT JOIN purchases lp ON lp.id = (SELECT id FROM purchases WHERE item_id = i.id AND deleted_at IS NULL ORDER BY purchased_on DESC, id DESC LIMIT 1)
  LEFT JOIN suppliers sup ON sup.id = lp.supplier_id
  WHERE i.deleted_at IS NULL`;

export function listItems(db, f, today) {
  const where = [];
  const args = [];
  if (!f.include_used_up) where.push('i.used_up_at IS NULL');
  for (const key of ['section_id', 'source_kind', 'form', 'plant_part', 'storage_spot']) {
    if (f[key] != null && f[key] !== '') { where.push(`i.${key} = ?`); args.push(f[key]); }
  }
  if (f.q) { where.push('(i.name LIKE ? OR i.latin_name LIKE ?)'); args.push(`%${f.q}%`, `%${f.q}%`); }
  if (f.supplier_id) {
    where.push('EXISTS (SELECT 1 FROM purchases px WHERE px.item_id = i.id AND px.deleted_at IS NULL AND px.supplier_id = ?)');
    args.push(Number(f.supplier_id));
  }
  if (f.status === 'low') where.push('i.low_threshold IS NOT NULL AND i.amount <= i.low_threshold');
  if (f.status === 'expiring') { where.push('i.expires_on >= ? AND i.expires_on <= ?'); args.push(today, addDays(today, 30)); }
  if (f.status === 'expired') { where.push('i.expires_on < ?'); args.push(today); }
  const sql = `${LIST_SQL}${where.map(w => ` AND ${w}`).join('')} ORDER BY s.sort_order, s.id, i.name COLLATE NOCASE`;
  return db.prepare(sql).all(...args).map(r => ({ ...r, status: itemStatus(r, today) }));
}

export function getItemDetail(db, id, today) {
  const row = db.prepare(`${LIST_SQL} AND i.id = ?`).get(id);
  if (!row) throw notFound('That item is not in the cabinet.');
  const purchases = db.prepare(`SELECT p.*, s.name AS supplier_name, s.deleted_at AS supplier_deleted_at
    FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.item_id = ? AND p.deleted_at IS NULL ORDER BY p.purchased_on DESC, p.id DESC`).all(id);
  const photos = repos(db).photos.list({ owner_type: 'item', owner_id: id });
  return { ...row, status: itemStatus(row, today), purchases, photos };
}

function assertLive(db, table, id, field, label) {
  if (id == null) return;
  if (!db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id)) {
    throw new HttpError(400, 'Please fix the highlighted fields.', { [field]: `That ${label} doesn't exist` });
  }
}

function itemData(input, { partial }) {
  const { used_up, ...data } = check(itemSchema, input, { partial });
  if (used_up !== undefined) data.used_up_at = used_up ? new Date().toISOString() : null;
  return data;
}

export function createItem(db, body) {
  const data = itemData(body, { partial: false });
  assertLive(db, 'cabinet_sections', data.section_id, 'section_id', 'section');
  const purchase = body?.purchase && data.source_kind === 'bought' ? check(purchaseSchema, { quantity: data.amount, ...body.purchase }) : null;
  if (purchase) assertLive(db, 'suppliers', purchase.supplier_id, 'supplier_id', 'supplier');
  return transaction(db, () => {
    const r = repos(db);
    const item = r.items.create(data);
    if (purchase) r.purchases.create({ ...purchase, item_id: item.id, unit: item.unit });
    return item;
  });
}

export function updateItem(db, id, body) {
  const r = repos(db);
  if (!r.items.get(id)) throw notFound('That item is not in the cabinet.');
  const data = itemData(body, { partial: true });
  assertLive(db, 'cabinet_sections', data.section_id, 'section_id', 'section');
  return r.items.update(id, data);
}

export function restockItem(db, id, body) {
  const r = repos(db);
  const item = r.items.get(id);
  if (!item) throw notFound('That item is not in the cabinet.');
  const { expires_on, ...purchase } = check(restockSchema, body);
  assertLive(db, 'suppliers', purchase.supplier_id, 'supplier_id', 'supplier');
  return transaction(db, () => {
    r.purchases.create({ ...purchase, item_id: id, unit: item.unit });
    const changes = { amount: item.amount + purchase.quantity, used_up_at: null };
    if (!item.source_kind) changes.source_kind = 'bought';
    if (expires_on !== undefined) changes.expires_on = expires_on;
    return r.items.update(id, changes);
  });
}

export function storageSpots(db) {
  return db.prepare(`SELECT DISTINCT storage_spot FROM items WHERE deleted_at IS NULL AND storage_spot IS NOT NULL
    ORDER BY storage_spot COLLATE NOCASE`).all().map(r => r.storage_spot);
}

// Sections ---------------------------------------------------------------

export function deleteSection(db, id, moveTo, stamp) {
  const r = repos(db);
  const section = r.sections.get(id);
  if (!section) throw notFound('That section is gone.');
  const count = db.prepare('SELECT COUNT(*) n FROM items WHERE section_id = ? AND deleted_at IS NULL').get(id).n;
  if (count && !moveTo) throw new HttpError(409, 'Move what is in this section first.', { items: count });
  if (moveTo) {
    if (Number(moveTo) === id) throw new HttpError(400, 'Pick a different section to move things into.');
    assertLive(db, 'cabinet_sections', Number(moveTo), 'move_to', 'section');
  }
  transaction(db, () => {
    if (moveTo) db.prepare("UPDATE items SET section_id = ?, updated_at = datetime('now') WHERE section_id = ? AND deleted_at IS NULL").run(Number(moveTo), id);
    r.sections.remove(id, stamp);
  });
}

export function reorderSections(db, ids) {
  if (!Array.isArray(ids) || !ids.every(n => Number.isInteger(n))) throw new HttpError(400, 'Send the section ids in their new order.');
  const r = repos(db);
  transaction(db, () => ids.forEach((id, i) => r.sections.update(id, { sort_order: i })));
  return r.sections.list();
}
```

- [ ] **Step 4: Add expiry defaults to `server/services/settings.js`**

Add to `DEFAULT_SETTINGS`:

```js
  expiry_dried_leaf: '12', expiry_dried_flower: '12', expiry_root: '24', expiry_bark: '24', expiry_seed: '24',
  expiry_resin: '36', expiry_powder: '6', expiry_tincture: '60', expiry_oil: '12',
```

and to `RULES`, one rule per key (whole months from 0 to 120):

```js
const MONTHS = v => /^\d+$/.test(v) && Number(v) <= 120;
// ...inside RULES:
  expiry_dried_leaf: MONTHS, expiry_dried_flower: MONTHS, expiry_root: MONTHS, expiry_bark: MONTHS, expiry_seed: MONTHS,
  expiry_resin: MONTHS, expiry_powder: MONTHS, expiry_tincture: MONTHS, expiry_oil: MONTHS,
```

- [ ] **Step 5: Write `server/routes/cabinet.js`**

```js
import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { check } from '../validate.js';
import { HttpError, idParam } from '../http.js';
import { sectionSchema, purchaseSchema } from '../schemas.js';
import { getSettings } from '../services/settings.js';
import {
  listItems, getItemDetail, createItem, updateItem, restockItem, suggestExpiry, storageSpots,
  deleteSection, reorderSections,
} from '../services/cabinet.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

const today = req => check({ today: 'date!' }, { today: req.query.today }).today;

export function sectionsRouter(ctx) {
  const r = Router();
  r.put('/order', (req, res) => res.json(reorderSections(ctx.db, req.body?.ids)));
  r.delete('/:id', (req, res) => {
    const id = idParam(req);
    const stamp = new Date().toISOString();
    deleteSection(ctx.db, id, req.query.move_to, stamp);
    res.json({ ok: true, restore: `${req.baseUrl}/${id}/restore` });
  });
  r.use(crudRouter(ctx, {
    repo: db => repos(db).sections,
    schema: sectionSchema,
    prepareCreate: data => ({
      kind: 'supply',
      sort_order: ctx.db.prepare('SELECT COALESCE(MAX(sort_order) + 1, 0) n FROM cabinet_sections WHERE deleted_at IS NULL').get().n,
      ...data,
    }),
  }));
  return r;
}

export function itemsRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listItems(ctx.db, { ...req.query, include_used_up: req.query.include_used_up === '1' }, today(req))));
  r.get('/:id', (req, res) => res.json(getItemDetail(ctx.db, idParam(req), today(req))));
  r.post('/', (req, res) => res.status(201).json(createItem(ctx.db, req.body)));
  r.patch('/:id', (req, res) => res.json(updateItem(ctx.db, idParam(req), req.body)));
  r.post('/:id/restock', (req, res) => res.json(restockItem(ctx.db, idParam(req), req.body)));
  r.use(crudRouter(ctx, {
    repo: db => repos(db).items,
    schema: {},
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'item', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'item', row.id, row.deleted_at),
  }));
  return r;
}

export function purchasesRouter(ctx) {
  return crudRouter(ctx, {
    repo: db => repos(db).purchases,
    schema: purchaseSchema,
    validateRow: (ctx, row) => {
      if (row.supplier_id != null && !ctx.db.prepare('SELECT 1 FROM suppliers WHERE id = ?').get(row.supplier_id)) {
        throw new HttpError(400, 'Please fix the highlighted fields.', { supplier_id: "That supplier doesn't exist" });
      }
    },
  });
}

export function expirySuggestionRoute(ctx) {
  return (req, res) => {
    const { form, acquired_on } = check({ form: 'string', acquired_on: 'date!' }, req.query);
    res.json({ expires_on: suggestExpiry(form, acquired_on, getSettings(ctx.db)) });
  };
}

export const storageSpotsRoute = ctx => (req, res) => res.json(storageSpots(ctx.db));
```

The items `crudRouter` only serves `DELETE /:id` and `POST /:id/restore` here, because the routes above it answer `GET`, `POST` and `PATCH` first.

- [ ] **Step 6: Mount the routes in `server/routes/index.js`**

```js
import { sectionsRouter, itemsRouter, purchasesRouter, expirySuggestionRoute, storageSpotsRoute } from './cabinet.js';
// ...after the settings route:
  r.use('/sections', sectionsRouter(ctx));
  r.use('/items', itemsRouter(ctx));
  r.use('/purchases', purchasesRouter(ctx));
  r.get('/expiry-suggestion', expirySuggestionRoute(ctx));
  r.get('/storage-spots', storageSpotsRoute(ctx));
```

`cabinet.test.js` also calls `/api/suppliers`; that route comes in Task 3. Until then, run only the tests that don't use suppliers, or do Task 3 Step 3-4 first. The full file must pass at the end of Task 3.

- [ ] **Step 7: Add the cascade helpers to `server/services/photos.js`** (Task 4 builds on them)

```js
const OWNER_CASCADE = 'UPDATE photos SET deleted_at = ? WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL';

export function cascadeDeletePhotos(ctx, ownerType, ownerId, stamp) {
  const rows = ctx.db.prepare('SELECT filename FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL').all(ownerType, ownerId);
  ctx.db.prepare(OWNER_CASCADE).run(stamp, ownerType, ownerId);
  for (const p of rows) trashPhotoFile(ctx.config.dataDir, p.filename);
}

// Brings back only the photos removed together with the owner (same stamp), not ones deleted earlier on their own.
export function cascadeRestorePhotos(ctx, ownerType, ownerId, stamp) {
  const rows = ctx.db.prepare('SELECT filename FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at = ?').all(ownerType, ownerId, stamp);
  ctx.db.prepare('UPDATE photos SET deleted_at = NULL WHERE owner_type = ? AND owner_id = ? AND deleted_at = ?').run(ownerType, ownerId, stamp);
  for (const p of rows) restorePhotoFile(ctx.config.dataDir, p.filename);
}
```

`crudRouter`'s `onRestore` receives the row as it was before restore, so `row.deleted_at` is the stamp.

- [ ] **Step 8: Run the server tests and commit**

Run: `npx vitest run --project server`

```bash
git add -A
git commit -m "Add cabinet items, sections, purchases and restock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Suppliers service and routes

**Files:**
- Create: `server/services/suppliers.js`, `server/routes/suppliers.js`
- Modify: `server/routes/index.js`
- Test: `tests/server/suppliers.test.js`

**Interfaces:**
- Produces: `listSuppliers(db) -> rows` with `purchase_count`, `total_spent`, `last_purchased_on`, `cover`; `getSupplierDetail(db, id) -> supplier with purchases[] (item_name, item_unit, item_deleted)`, `photos[]`; routes `GET/POST /api/suppliers`, `GET/PATCH/DELETE /api/suppliers/:id`, `POST /api/suppliers/:id/restore`.

- [ ] **Step 1: Write the failing test `tests/server/suppliers.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('lists suppliers with totals and shows purchase history', async () => {
  t = makeTestContext();
  const h = t.http;
  const a = (await h().post('/api/suppliers').send({ name: 'Moonvale Botanicals', website: 'https://example.com', rating: 5, good_for: 'Dried herbs' })).body;
  await h().post('/api/suppliers').send({ name: 'Tin & Glass Co' });
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Chamomile', amount: 50, unit: 'g', source_kind: 'bought', purchase: { supplier_id: a.id, purchased_on: '2026-09-01', price: 8 } })).body;
  await h().post(`/api/items/${item.id}/restock`).send({ quantity: 50, supplier_id: a.id, purchased_on: '2026-10-01', price: 7.5 });
  const list = (await h().get('/api/suppliers')).body;
  expect(list.map(s => s.name)).toEqual(['Moonvale Botanicals', 'Tin & Glass Co']);
  expect(list[0]).toMatchObject({ purchase_count: 2, total_spent: 15.5, last_purchased_on: '2026-10-01' });
  expect(list[1]).toMatchObject({ purchase_count: 0, total_spent: 0, last_purchased_on: null });
  const detail = (await h().get(`/api/suppliers/${a.id}`)).body;
  expect(detail.purchases.map(p => [p.item_name, p.purchased_on, p.price])).toEqual([['Chamomile', '2026-10-01', 7.5], ['Chamomile', '2026-09-01', 8]]);
});

it('validates rating and name', async () => {
  t = makeTestContext();
  const res = await t.http().post('/api/suppliers').send({ name: '', rating: 9 });
  expect(res.status).toBe(400);
  expect(Object.keys(res.body.details).sort()).toEqual(['name', 'rating']);
});

it('deleting a supplier keeps item history readable and undo brings it back', async () => {
  t = makeTestContext();
  const h = t.http;
  const s = (await h().post('/api/suppliers').send({ name: 'Old Shop' })).body;
  const item = (await h().post('/api/items').send({ section_id: 3, name: 'Candelilla wax', amount: 100, unit: 'g', source_kind: 'bought', purchase: { supplier_id: s.id, purchased_on: '2026-08-01' } })).body;
  const del = await h().delete(`/api/suppliers/${s.id}`);
  expect((await h().get('/api/suppliers')).body).toHaveLength(0);
  const p = (await h().get(`/api/items/${item.id}?today=2026-10-08`)).body.purchases[0];
  expect(p).toMatchObject({ supplier_name: 'Old Shop' });
  expect(p.supplier_deleted_at).toBeTruthy();
  await h().post(del.body.restore);
  expect((await h().get('/api/suppliers')).body).toHaveLength(1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/suppliers.test.js`
Expected: FAIL with 404.

- [ ] **Step 3: Write `server/services/suppliers.js`**

```js
import { notFound } from '../http.js';
import { repos } from '../db/repos.js';

export function listSuppliers(db) {
  return db.prepare(`SELECT s.*,
      (SELECT COUNT(*) FROM purchases p JOIN items i ON i.id = p.item_id
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND i.deleted_at IS NULL) AS purchase_count,
      (SELECT COALESCE(SUM(p.price), 0) FROM purchases p JOIN items i ON i.id = p.item_id
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND i.deleted_at IS NULL) AS total_spent,
      (SELECT MAX(p.purchased_on) FROM purchases p JOIN items i ON i.id = p.item_id
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND i.deleted_at IS NULL) AS last_purchased_on,
      (SELECT filename FROM photos ph WHERE ph.owner_type = 'supplier' AND ph.owner_id = s.id AND ph.deleted_at IS NULL
        ORDER BY ph.is_cover DESC, ph.sort_order, ph.id LIMIT 1) AS cover
    FROM suppliers s WHERE s.deleted_at IS NULL ORDER BY s.name COLLATE NOCASE`).all();
}

export function getSupplierDetail(db, id) {
  const s = repos(db).suppliers.get(id);
  if (!s) throw notFound('That supplier is gone.');
  const purchases = db.prepare(`SELECT p.*, i.name AS item_name, i.unit AS item_unit, i.size_label AS item_size
    FROM purchases p JOIN items i ON i.id = p.item_id
    WHERE p.supplier_id = ? AND p.deleted_at IS NULL AND i.deleted_at IS NULL
    ORDER BY p.purchased_on DESC, p.id DESC`).all(id);
  const photos = repos(db).photos.list({ owner_type: 'supplier', owner_id: id });
  return { ...s, purchases, photos };
}
```

- [ ] **Step 4: Write `server/routes/suppliers.js` and mount it at `/suppliers`**

```js
import { Router } from 'express';
import { crudRouter } from './crud.js';
import { repos } from '../db/repos.js';
import { idParam } from '../http.js';
import { supplierSchema } from '../schemas.js';
import { listSuppliers, getSupplierDetail } from '../services/suppliers.js';
import { cascadeDeletePhotos, cascadeRestorePhotos } from '../services/photos.js';

export function suppliersRouter(ctx) {
  const r = Router();
  r.get('/', (req, res) => res.json(listSuppliers(ctx.db)));
  r.get('/:id', (req, res) => res.json(getSupplierDetail(ctx.db, idParam(req))));
  r.use(crudRouter(ctx, {
    repo: db => repos(db).suppliers,
    schema: supplierSchema,
    onDelete: (ctx, row, stamp) => cascadeDeletePhotos(ctx, 'supplier', row.id, stamp),
    onRestore: (ctx, row) => cascadeRestorePhotos(ctx, 'supplier', row.id, row.deleted_at),
  }));
  return r;
}
```

In `server/routes/index.js`: `import { suppliersRouter } from './suppliers.js';` and `r.use('/suppliers', suppliersRouter(ctx));` next to the cabinet routes.

- [ ] **Step 5: Run the server tests (including `cabinet.test.js` in full) and commit**

Run: `npx vitest run --project server`
Expected: all pass.

```bash
git add -A
git commit -m "Add suppliers with totals and purchase history" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Photos route, cover photo, and purge

**Files:**
- Create: `server/routes/photos.js`
- Modify: `server/services/photos.js`, `server/services/purge.js`, `server/routes/index.js`
- Test: `tests/server/photos.test.js`, `tests/server/purge.test.js` (extend)

**Interfaces:**
- Consumes: Tasks 1-3 (`repos(db).photos`, `cascadeDeletePhotos`).
- Produces: `PHOTO_OWNERS = { item: 'items', supplier: 'suppliers' }` (later stages add keys); `POST /api/photos` (multipart: `owner_type`, `owner_id`, `caption`, `file`), `GET /api/photos?owner_type&owner_id`, `PATCH /api/photos/:id` (`caption`, `sort_order`, `is_cover`; setting `is_cover` true clears the others for that owner), `DELETE /api/photos/:id`, `POST /api/photos/:id/restore`. The first photo of an owner becomes its cover.

- [ ] **Step 1: Copy H&L's photo tests as the starting point and adapt**

```bash
cp /c/Users/S_Lip/dev/hearth-and-larder/tests/server/photos.test.js tests/server/photos.test.js
```

Edit it: replace every `h().post('/api/items').send({ store_id: 1, name: 'Jam' })` with `h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })`; replace the `purgeTrash` test (it already exists in `purge.test.js`) by deleting it; keep the trash-path tests. Then add:

```js
it('makes the first photo the cover and lets another take over', async () => {
  t = makeTestContext();
  const h = t.http;
  const item = (await h().post('/api/items').send({ section_id: 1, name: 'Calendula', amount: 10, unit: 'g' })).body;
  const a = await upload(h, 'item', item.id);
  const b = await upload(h, 'item', item.id);
  expect(a.is_cover).toBe(1);
  expect(b.is_cover).toBe(0);
  await h().patch(`/api/photos/${b.id}`).send({ is_cover: true });
  const list = (await h().get(`/api/photos?owner_type=item&owner_id=${item.id}`)).body;
  expect(list.map(p => [p.id, p.is_cover])).toEqual([[b.id, 1], [a.id, 0]]);
  const cabinet = (await h().get('/api/items?today=2026-10-08')).body;
  expect(cabinet[0].cover).toBe(b.filename);
});

it('accepts supplier photos and refuses unknown owner types', async () => {
  t = makeTestContext();
  const h = t.http;
  const s = (await h().post('/api/suppliers').send({ name: 'Moonvale' })).body;
  await upload(h, 'supplier', s.id);
  const bad = await h().post('/api/photos').field('owner_type', 'constructor').field('owner_id', '1')
    .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  expect(bad.status).toBe(400);
});

it('deleting a supplier trashes its photos and undo restores them', async () => {
  t = makeTestContext();
  const h = t.http;
  const s = (await h().post('/api/suppliers').send({ name: 'Moonvale' })).body;
  const photo = await upload(h, 'supplier', s.id);
  const del = await h().delete(`/api/suppliers/${s.id}`);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', '_trash', photo.filename))).toBe(true);
  await h().post(del.body.restore);
  expect(fs.existsSync(path.join(t.dataDir, 'photos', photo.filename))).toBe(true);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/server/photos.test.js`
Expected: FAIL (no `/api/photos` route).

- [ ] **Step 3: Add the owner registry and cover helper to `server/services/photos.js`**

```js
// Kinds of record a photo can belong to, and their tables. Later stages add more.
export const PHOTO_OWNERS = { item: 'items', supplier: 'suppliers' };

export function setCover(db, photo) {
  db.prepare('UPDATE photos SET is_cover = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL')
    .run(photo.id, photo.owner_type, photo.owner_id);
}
```

- [ ] **Step 4: Write `server/routes/photos.js`**

Copy H&L's `server/routes/photos.js`, then change it:
- Replace the `OWNER_TABLE` constant with `PHOTO_OWNERS` from the photos service (`Object.hasOwn(PHOTO_OWNERS, owner_type)` guards `constructor` and friends).
- On upload, set `is_cover: count === 0 ? 1 : 0` where `count` is the owner's existing live photos (already computed as `sort_order`).
- Add `prepareUpdate` and an after-update hook for covers. Since `crudRouter` has no after-update hook, add a dedicated route before `r.use(crudRouter(...))`:

```js
  r.patch('/:id', (req, res, next) => {
    if (req.body?.is_cover !== true && req.body?.is_cover !== 1 && req.body?.is_cover !== 'true') return next();
    const photo = repos(ctx.db).photos.get(idParam(req));
    if (!photo) throw notFound();
    transaction(ctx.db, () => {
      setCover(ctx.db, photo);
      const { is_cover, ...rest } = check(photoSchema, req.body, { partial: true });
      if (Object.keys(rest).length) repos(ctx.db).photos.update(photo.id, rest);
    });
    res.json(repos(ctx.db).photos.get(photo.id));
  });
```

- Keep `onDelete`/`onRestore` moving the file to and from `_trash`. When the deleted photo was the cover, make the next live photo of that owner the cover inside `onDelete`:

```js
    onDelete: (ctx, row) => {
      trashPhotoFile(ctx.config.dataDir, row.filename);
      if (row.is_cover) {
        const next = ctx.db.prepare('SELECT * FROM photos WHERE owner_type = ? AND owner_id = ? AND deleted_at IS NULL ORDER BY sort_order, id LIMIT 1').get(row.owner_type, row.owner_id);
        if (next) setCover(ctx.db, next);
      }
    },
```

Mount it in `server/routes/index.js` at `/photos`.

- [ ] **Step 5: Extend `server/services/purge.js`**

Inside the transaction, before the existing photo delete, collect and remove rows in this order (children before parents), each limited to rows deleted before the cutoff:

```js
    const old = table => `SELECT id FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < '${cutoff}'`;
    files = db.prepare(`SELECT filename FROM photos WHERE (deleted_at IS NOT NULL AND deleted_at < ?)
      OR (owner_type = 'item' AND owner_id IN (${old('items')}))
      OR (owner_type = 'supplier' AND owner_id IN (${old('suppliers')}))`).all(cutoff).map(r => r.filename);
    counts.photos = db.prepare(`DELETE FROM photos WHERE (deleted_at IS NOT NULL AND deleted_at < ?)
      OR (owner_type = 'item' AND owner_id IN (${old('items')}))
      OR (owner_type = 'supplier' AND owner_id IN (${old('suppliers')}))`).run(cutoff).changes;
    counts.purchases = db.prepare(`DELETE FROM purchases WHERE id IN (${old('purchases')}) OR item_id IN (${old('items')})`).run().changes;
    counts.items = db.prepare(`DELETE FROM items WHERE id IN (${old('items')})`).run().changes;
    db.prepare(`UPDATE purchases SET supplier_id = NULL WHERE supplier_id IN (${old('suppliers')})`).run();
    counts.suppliers = db.prepare(`DELETE FROM suppliers WHERE id IN (${old('suppliers')})`).run().changes;
    counts.cabinet_sections = db.prepare(`DELETE FROM cabinet_sections WHERE id IN (${old('cabinet_sections')})
      AND id NOT IN (SELECT section_id FROM items)`).run().changes;
```

Replace the old two-statement body with this, returning `counts`. Add a test to `tests/server/purge.test.js`: an item deleted 40 days ago with one purchase and one photo row is purged along with both; a supplier deleted 40 days ago is purged and a live item's purchase keeps its row with `supplier_id` set to NULL; a section deleted 40 days ago that still has a deleted-but-not-yet-purged item stays. Use `UPDATE ... SET deleted_at = ?` with an old stamp to age rows.

- [ ] **Step 6: Run the server tests and commit**

Run: `npx vitest run --project server`

```bash
git add -A
git commit -m "Add photos for items and suppliers, with covers and purging" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Today summary API

**Files:**
- Create: `server/services/today.js`, `server/routes/today.js`
- Modify: `server/routes/index.js`
- Test: `tests/server/today.test.js`

**Interfaces:**
- Produces: `GET /api/today?today=YYYY-MM-DD` returning `{ runningLow: Item[], nearingExpiry: Item[], expired: Item[], batchesDue: [] }`, each item `{ id, name, size_label, amount, unit, low_threshold, expires_on, section_name, cover }`, sorted (low: by `amount / low_threshold` ascending then name; nearing: by `expires_on` then name; expired: by `expires_on` then name), each list capped at 8, plus `counts: { runningLow, nearingExpiry, expired }` with the full totals.

- [ ] **Step 1: Write the failing test `tests/server/today.test.js`**

```js
import { it, expect, afterEach } from 'vitest';
import { makeTestContext } from './helpers.js';

let t;
afterEach(() => t?.cleanup());

it('summarises low, nearing and expired items and leaves batches empty', async () => {
  t = makeTestContext();
  const h = t.http;
  const add = body => h().post('/api/items').send({ section_id: 1, unit: 'g', ...body });
  await add({ name: 'Mullein', amount: 5, low_threshold: 20 });
  await add({ name: 'Yarrow', amount: 18, low_threshold: 20 });
  await add({ name: 'Rose', amount: 100, expires_on: '2026-10-20' });
  await add({ name: 'Elderberry', amount: 100, expires_on: '2026-11-07' });
  await add({ name: 'Hibiscus', amount: 100, expires_on: '2026-11-08' });
  await add({ name: 'Old sage', amount: 100, expires_on: '2026-10-07' });
  const used = (await add({ name: 'Gone', amount: 0, low_threshold: 5 })).body;
  await h().patch(`/api/items/${used.id}`).send({ used_up: true });
  const res = await h().get('/api/today?today=2026-10-08');
  expect(res.status).toBe(200);
  expect(res.body.runningLow.map(i => i.name)).toEqual(['Mullein', 'Yarrow']);
  expect(res.body.nearingExpiry.map(i => i.name)).toEqual(['Rose', 'Elderberry']);
  expect(res.body.expired.map(i => i.name)).toEqual(['Old sage']);
  expect(res.body.batchesDue).toEqual([]);
  expect(res.body.counts).toEqual({ runningLow: 2, nearingExpiry: 2, expired: 1 });
});

it('caps each list at eight but counts them all', async () => {
  t = makeTestContext();
  for (let i = 0; i < 10; i++) await t.http().post('/api/items').send({ section_id: 11, name: `Tin ${i}`, amount: 0, unit: 'count', low_threshold: 2 });
  const res = await t.http().get('/api/today?today=2026-10-08');
  expect(res.body.runningLow).toHaveLength(8);
  expect(res.body.counts.runningLow).toBe(10);
});

it('needs a date', async () => {
  t = makeTestContext();
  expect((await t.http().get('/api/today')).status).toBe(400);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/server/today.test.js`
Expected: FAIL with 404.

- [ ] **Step 3: Write `server/services/today.js` and `server/routes/today.js`**

```js
// server/services/today.js
import { listItems } from './cabinet.js';

const CAP = 8;
const pick = ({ id, name, size_label, amount, unit, low_threshold, expires_on, section_name, cover }) =>
  ({ id, name, size_label, amount, unit, low_threshold, expires_on, section_name, cover });
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const ratio = i => (i.low_threshold > 0 ? i.amount / i.low_threshold : 0);

export function todaySummary(db, today) {
  const low = listItems(db, { status: 'low' }, today).sort((a, b) => ratio(a) - ratio(b) || byName(a, b));
  const soon = listItems(db, { status: 'expiring' }, today).sort((a, b) => a.expires_on.localeCompare(b.expires_on) || byName(a, b));
  const gone = listItems(db, { status: 'expired' }, today).sort((a, b) => a.expires_on.localeCompare(b.expires_on) || byName(a, b));
  return {
    runningLow: low.slice(0, CAP).map(pick),
    nearingExpiry: soon.slice(0, CAP).map(pick),
    expired: gone.slice(0, CAP).map(pick),
    batchesDue: [],
    counts: { runningLow: low.length, nearingExpiry: soon.length, expired: gone.length },
  };
}
```

```js
// server/routes/today.js
import { check } from '../validate.js';
import { todaySummary } from '../services/today.js';

export const todayRoute = ctx => (req, res) => {
  const { today } = check({ today: 'date!' }, req.query);
  res.json(todaySummary(ctx.db, today));
};
```

Mount with `r.get('/today', todayRoute(ctx));` in `server/routes/index.js`.

- [ ] **Step 4: Run the server tests and commit**

```bash
npx vitest run --project server
git add -A
git commit -m "Add the Today summary for low, nearing and expired items" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Client foundations (option lists, photo gallery, delete with undo, tabs, routes)

**Files:**
- Create: `client/src/lib/cabinet.js`, `client/src/lib/today.js`, `client/src/components/PhotoGallery.jsx`, `client/src/components/CabinetTabs.jsx`
- Create (copied): `client/src/lib/image.js`, `client/src/components/useDeleteWithUndo.jsx`
- Modify: `client/src/App.jsx`, `client/src/theme/global.css`
- Test: `tests/client/cabinet-lib.test.jsx`, `tests/client/photogallery.test.jsx`

**Interfaces:**
- Produces:
  - `UNITS`, `FORMS`, `PLANT_PARTS`, `SOURCE_KINDS` option arrays `{ value, label }` (labels sentence case; `l` labelled `L`)
  - `formatAmount(amount, unit) -> '24 count' | '1.5 L' | '250 ml'` (whole numbers without decimals, others up to 2 places, `count` shown as just the number with "count" only when `unit === 'count'` gives e.g. `24` + ` count`)
  - `formatMoney(n) -> '$18.00'` (Intl, en-US, USD)
  - `statusBadges(status) -> [{ key, label, tone }]` (`low` → "Running low", oxblood; `expiring` → "Use soon", brass; `expired` → "Past its best", oxblood)
  - `sourceText(item) -> 'Bought from Moonvale Botanicals' | 'Grown' | 'Foraged at the river path' | 'Made' | 'Gifted by Rowan' | ''`
  - `todayString(date = new Date()) -> 'YYYY-MM-DD'` in local time (in `lib/today.js`)
  - `<PhotoGallery ownerType ownerId photos onChange />` with captions, delete with undo, and "Make cover" on non-cover photos
  - `<CabinetTabs />` with two NavLinks: Shelves (`/cabinet`, end) and Suppliers (`/cabinet/suppliers`)
  - Routes in `App.jsx`: `cabinet` (Shelves), `cabinet/new`, `cabinet/items/:id`, `cabinet/items/:id/edit`, `cabinet/suppliers`, `cabinet/suppliers/new`, `cabinet/suppliers/:id`, `cabinet/suppliers/:id/edit`. Remove `/cabinet` from the "being built" list.

- [ ] **Step 1: Copy helpers**

```bash
H=/c/Users/S_Lip/dev/hearth-and-larder
cp $H/client/src/lib/image.js client/src/lib/image.js
cp $H/client/src/components/useDeleteWithUndo.jsx client/src/components/useDeleteWithUndo.jsx
```

- [ ] **Step 2: Write the failing test `tests/client/cabinet-lib.test.jsx`**

```jsx
import { it, expect } from 'vitest';
import { formatAmount, formatMoney, statusBadges, sourceText, UNITS } from '../../client/src/lib/cabinet.js';
import { todayString } from '../../client/src/lib/today.js';

it('formats amounts and money', () => {
  expect(formatAmount(24, 'count')).toBe('24');
  expect(formatAmount(1.5, 'l')).toBe('1.5 L');
  expect(formatAmount(250, 'ml')).toBe('250 ml');
  expect(formatAmount(2.3333, 'oz')).toBe('2.33 oz');
  expect(formatMoney(18)).toBe('$18.00');
  expect(UNITS.find(u => u.value === 'l').label).toBe('L');
});

it('describes status and source in plain words', () => {
  expect(statusBadges({ low: true, expiring: false, expired: true }).map(b => b.label)).toEqual(['Running low', 'Past its best']);
  expect(sourceText({ source_kind: 'bought', last_supplier_name: 'Moonvale' })).toBe('Bought from Moonvale');
  expect(sourceText({ source_kind: 'bought' })).toBe('Bought');
  expect(sourceText({ source_kind: 'foraged', source_place: 'the river path' })).toBe('Foraged at the river path');
  expect(sourceText({ source_kind: 'gifted', source_from: 'Rowan' })).toBe('Gifted by Rowan');
  expect(sourceText({ source_kind: null })).toBe('');
});

it('gives today in local time', () => {
  expect(todayString(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
});
```

- [ ] **Step 3: Write `client/src/lib/today.js` and `client/src/lib/cabinet.js`**

```js
// client/src/lib/today.js
const pad = n => String(n).padStart(2, '0');
export const todayString = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
```

```js
// client/src/lib/cabinet.js
const opt = (value, label = value.charAt(0).toUpperCase() + value.slice(1)) => ({ value, label });

export const UNITS = [opt('g'), opt('kg'), opt('oz'), opt('lb'), opt('ml'), opt('l', 'L'), opt('fl oz'), opt('count', 'Count')]
  .map(u => (u.value === 'g' || u.value === 'kg' || u.value === 'oz' || u.value === 'lb' || u.value === 'ml' || u.value === 'fl oz' ? { ...u, label: u.value } : u));
export const FORMS = ['dried leaf', 'dried flower', 'root', 'bark', 'seed', 'resin', 'powder', 'fresh', 'tincture', 'oil', 'other'].map(v => opt(v));
export const PLANT_PARTS = ['leaf', 'flower', 'root', 'bark', 'seed', 'berry', 'resin', 'whole herb'].map(v => opt(v));
export const SOURCE_KINDS = [opt('bought'), opt('grown'), opt('foraged'), opt('made'), opt('gifted', 'Gifted or traded')];

const unitLabel = unit => (unit === 'l' ? 'L' : unit);
const num = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function formatAmount(amount, unit) {
  if (amount == null) return '';
  return unit === 'count' ? num(amount) : `${num(amount)} ${unitLabel(unit)}`;
}

export const formatMoney = n => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n));

export function statusBadges(status = {}) {
  const out = [];
  if (status.low) out.push({ key: 'low', label: 'Running low', tone: 'oxblood' });
  if (status.expiring) out.push({ key: 'expiring', label: 'Use soon', tone: 'brass' });
  if (status.expired) out.push({ key: 'expired', label: 'Past its best', tone: 'oxblood' });
  return out;
}

export function sourceText(item) {
  switch (item.source_kind) {
    case 'bought': return item.last_supplier_name ? `Bought from ${item.last_supplier_name}` : 'Bought';
    case 'grown': return 'Grown';
    case 'foraged': return item.source_place ? `Foraged at ${item.source_place}` : 'Foraged';
    case 'made': return 'Made';
    case 'gifted': return item.source_from ? `Gifted by ${item.source_from}` : 'Gifted';
    default: return '';
  }
}
```

Simplify the `UNITS` line if you like, as long as the labels are `g, kg, oz, lb, ml, L, fl oz, Count`.

- [ ] **Step 4: Write `client/src/components/PhotoGallery.jsx`**

Copy H&L's `PhotoGallery.jsx` and add a "Make cover" button. The cover shows a small brass "Cover" tag instead. Full component:

```jsx
import { useState } from 'react';
import { ImagePlus, Trash2, Star } from 'lucide-react';
import { api } from '../lib/api.js';
import { resizeImage } from '../lib/image.js';
import { useDeleteWithUndo } from './useDeleteWithUndo.jsx';
import { useToast } from './ToastProvider.jsx';

export async function uploadPhoto(ownerType, ownerId, file, caption = '') {
  const blob = await resizeImage(file);
  const fd = new FormData();
  fd.append('owner_type', ownerType);
  fd.append('owner_id', String(ownerId));
  fd.append('caption', caption);
  fd.append('file', blob, 'photo.jpg');
  return api.upload('/api/photos', fd);
}

export function PhotoGallery({ ownerType, ownerId, photos, onChange }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const del = useDeleteWithUndo();
  const toast = useToast();
  async function add(files) {
    const images = files.filter(f => f.type.startsWith('image/'));
    const skipped = files.length - images.length;
    setBusy(true);
    try { for (const f of images) await uploadPhoto(ownerType, ownerId, f); }
    catch (err) { toast.show({ message: err.message, duration: 6000 }); }
    finally { setBusy(false); onChange(); }
    if (skipped) toast.show({ message: `${skipped} file${skipped > 1 ? 's were' : ' was'} not a photo, so I left ${skipped > 1 ? 'them' : 'it'} out.`, duration: 6000 });
  }
  async function patch(p, body) {
    try { await api.patch(`/api/photos/${p.id}`, body); onChange(); }
    catch (err) { toast.show({ message: err.message, duration: 6000 }); }
  }
  return (
    <div className="gallery">
      {photos.map(p => (
        <figure key={p.id} className="gallery-item">
          <img src={`/photos/${p.filename}`} alt={p.caption || 'Photo'} loading="lazy" />
          <figcaption>
            <input className="caption-input" defaultValue={p.caption ?? ''} placeholder="Add a caption" aria-label="Photo caption"
              onBlur={e => { if (e.target.value !== (p.caption ?? '')) patch(p, { caption: e.target.value }); }} />
            {p.is_cover
              ? <span className="cover-tag">Cover</span>
              : <button type="button" className="icon-btn" aria-label="Make this the cover photo" onClick={() => patch(p, { is_cover: true })}><Star size={16} /></button>}
            <button type="button" className="icon-btn" aria-label="Delete photo" onClick={() => del({ url: `/api/photos/${p.id}`, label: 'photo', onChange })}>
              <Trash2 size={16} />
            </button>
          </figcaption>
        </figure>
      ))}
      <label className={`gallery-drop ${over ? 'is-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}>
        <ImagePlus size={28} aria-hidden="true" />
        <span>{busy ? 'Adding…' : 'Drop photos here or click to choose'}</span>
        <input type="file" accept="image/*" multiple className="visually-hidden"
          onChange={e => { const files = [...e.target.files]; e.target.value = ''; add(files); }} />
      </label>
    </div>
  );
}
```

- [ ] **Step 5: Write `client/src/components/CabinetTabs.jsx`**

```jsx
import { NavLink } from 'react-router-dom';

export function CabinetTabs() {
  return (
    <nav className="tabs" aria-label="Herb cabinet">
      <NavLink to="/cabinet" end className="tab">Shelves</NavLink>
      <NavLink to="/cabinet/suppliers" className="tab">Suppliers</NavLink>
    </nav>
  );
}
```

- [ ] **Step 6: Add CSS to `client/src/theme/global.css`**

Add rules in the panel style for: `.tabs` (row of two links under the page header, underline in `--ink-green` on `[aria-current='page']`), `.gallery` (grid of `minmax(min(160px, 100%), 1fr)`), `.gallery-item img` (aspect-ratio 1, object-fit cover, 1px `--rule` border), `.gallery-drop` (dashed `--rule` border, `.is-over` ink-green border), `.caption-input`, `.cover-tag` (small caps, brass-dark text on `#f3e7c9`, check AA), `.badge` with `.badge-oxblood` (oxblood text on `--oxblood-wash`) and `.badge-brass` (`--brass-dark` on `#f3e7c9`, check AA; darken if under 4.5:1), `.shelf` (a section group with an `h2` in small caps and a thin rule), `.item-row` (grid: thumbnail 48px, name and latin, amount, badges, source; wraps on narrow screens), `.toolbar` (search and filter controls in a wrapping row), `.dl-grid` (definition list two columns, one column under 640px), `.purchase-table` (simple table with `--rule` borders, horizontally scrollable wrapper on narrow screens). No `outline: none`.

- [ ] **Step 7: Write the failing test `tests/client/photogallery.test.jsx`**

```jsx
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoGallery } from '../../client/src/components/PhotoGallery.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

const photos = [
  { id: 1, filename: '1-aaaaaaaa.jpg', caption: 'Shelf', is_cover: 1 },
  { id: 2, filename: '2-bbbbbbbb.jpg', caption: null, is_cover: 0 },
];

it('marks the cover and makes another photo the cover', async () => {
  const calls = [];
  global.fetch = vi.fn(async (url, opts = {}) => { calls.push([opts.method, url, opts.body]); return new Response('{}', { status: 200 }); });
  const onChange = vi.fn();
  render(<ToastProvider><ConfirmProvider><PhotoGallery ownerType="item" ownerId={5} photos={photos} onChange={onChange} /></ConfirmProvider></ToastProvider>);
  expect(screen.getByText('Cover')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Make this the cover photo' }));
  expect(calls[0]).toEqual(['PATCH', '/api/photos/2', JSON.stringify({ is_cover: true })]);
  expect(onChange).toHaveBeenCalled();
});
```

- [ ] **Step 8: Wire routes in `client/src/App.jsx`**

Import the screens from Tasks 7-9 and add, before the `...soon` entries, the eight `cabinet` routes listed under Interfaces. Change `soon` to skip `/cabinet` too: `DRAWERS.filter(d => d.to !== '/' && d.to !== '/cabinet')`. Until Tasks 7-9 land, create each screen file as a one-line placeholder export (`export function Shelves() { return <h1>Herb cabinet</h1>; }`, and so on for `ItemForm`, `ItemDetail`, `Suppliers`, `SupplierForm`, `SupplierDetail`) so the app builds; the later tasks replace them.

- [ ] **Step 9: Run client tests and build, then commit**

```bash
npx vitest run --project client
npm run build
git add -A
git commit -m "Add cabinet helpers, photo gallery with covers, tabs and routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Shelves page and section manager

**Files:**
- Create: `client/src/screens/cabinet/Shelves.jsx`, `client/src/screens/cabinet/SectionManager.jsx`
- Test: `tests/client/shelves.test.jsx`

**Interfaces:**
- Consumes: `/api/sections`, `/api/items?today=...&...filters`, `/api/suppliers`, `/api/storage-spots`; `CabinetTabs`, `statusBadges`, `formatAmount`, `sourceText`, `todayString`.
- Produces: `Shelves` (route `/cabinet`) and `SectionManager` (dialog).

Behavior:
- `PageHeader` title "Herb cabinet", subtitle "Herbs and supplies, jar by jar", action `WaxSeal` "Add to the cabinet" linking to `/cabinet/new`. Then `CabinetTabs`.
- Toolbar: search box (label "Search", placeholder "Calendula, beeswax, dropper…"), Section select ("All sections" + sections), Show select (`all` "Everything", `low` "Running low", `expiring` "Use soon", `expired` "Past its best"), Source select ("Any source" + SOURCE_KINDS), Supplier select ("Any supplier" + suppliers), Storage select ("Anywhere" + storage spots), and a "Show used up" checkbox. Filters are kept in the URL search params so Back works and links can deep-link (`/cabinet?status=low`). Search is debounced 250 ms.
- Results are grouped by section in section order. Each group is a `ParchmentCard` titled with the section name and a count ("Herbs · 12" style is fine without the middle dot: use "Herbs (12)"). Empty sections are hidden while any filter is active; with no filters, empty sections show "Nothing on this shelf yet." with an "Add" link to `/cabinet/new?section=ID`.
- Each item row is a link to `/cabinet/items/:id` containing: cover thumbnail (or a small jar SVG placeholder, `aria-hidden`), name (and Latin name in italics when present), size label, amount via `formatAmount`, badges, and `sourceText`. Used-up rows show a "Used up" badge.
- With no items at all and no filters: a single `ParchmentCard` "Your cabinet is empty" with "Add your first jar" linking to `/cabinet/new`.
- A "Manage sections" button opens `SectionManager`: a `Dialog` listing sections with a name input each (save on blur, `PATCH`), Move up / Move down buttons (`PUT /api/sections/order`), a delete button per section, and an "Add a section" input + button (`POST`). Delete: `DELETE /api/sections/:id`; on 409, ask (in the dialog) "Move its N items to:" with a section select, then `DELETE ...?move_to=ID`; afterwards toast "Deleted <name>" with Undo (`POST restore`). Refresh the Shelves list after any change.
- Loading shows "Opening the cabinet…"; an API error shows the message and a "Try again" button.

- [ ] **Step 1: Write the failing test `tests/client/shelves.test.jsx`**

```jsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../../client/src/App.jsx';
import { ToastProvider } from '../../client/src/components/ToastProvider.jsx';
import { ConfirmProvider } from '../../client/src/components/ConfirmProvider.jsx';

HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function () { this.removeAttribute('open'); };

const SECTIONS = [{ id: 1, name: 'Herbs', kind: 'herb', sort_order: 0 }, { id: 11, name: 'Containers', kind: 'supply', sort_order: 10 }, { id: 3, name: 'Waxes', kind: 'supply', sort_order: 2 }];
const ITEMS = [
  { id: 7, section_id: 1, section_name: 'Herbs', name: 'Calendula', latin_name: 'Calendula officinalis', amount: 40, unit: 'g', status: { low: true, expiring: false, expired: false }, source_kind: 'bought', last_supplier_name: 'Moonvale', cover: null },
  { id: 8, section_id: 11, section_name: 'Containers', name: 'Amber dropper bottle', size_label: '30 ml', amount: 24, unit: 'count', status: {}, source_kind: 'gifted', source_from: 'Rowan', cover: null },
];
let requests;
beforeEach(() => {
  requests = [];
  global.fetch = vi.fn(async url => {
    requests.push(url);
    const json = b => new Response(JSON.stringify(b), { status: 200 });
    if (url === '/api/health') return json({ ok: true, demo: false });
    if (url === '/api/settings') return json({ keeper_name: '' });
    if (url === '/api/sections') return json(SECTIONS);
    if (url === '/api/suppliers') return json([{ id: 2, name: 'Moonvale' }]);
    if (url === '/api/storage-spots') return json(['Top shelf']);
    if (url.startsWith('/api/items')) {
      const u = new URL(url, 'http://x');
      return json(u.searchParams.get('status') === 'low' ? ITEMS.slice(0, 1) : ITEMS);
    }
    return json({});
  });
});
const open = (path = '/cabinet') => render(<ToastProvider><ConfirmProvider><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></ConfirmProvider></ToastProvider>);

it('groups items by section with amounts, badges and sources', async () => {
  open();
  const herbs = await screen.findByRole('region', { name: /Herbs/ });
  expect(within(herbs).getByRole('link', { name: /Calendula/ })).toHaveAttribute('href', '/cabinet/items/7');
  expect(within(herbs).getByText('Running low')).toBeInTheDocument();
  expect(within(herbs).getByText('Bought from Moonvale')).toBeInTheDocument();
  const containers = screen.getByRole('region', { name: /Containers/ });
  expect(within(containers).getByText('24')).toBeInTheDocument();
  expect(within(containers).getByText('Gifted by Rowan')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: /Waxes/ })).toHaveTextContent('Nothing on this shelf yet.');
});

it('filters from the URL and the Show menu, hiding empty shelves', async () => {
  const user = userEvent.setup();
  open('/cabinet?status=low');
  await screen.findByRole('link', { name: /Calendula/ });
  expect(requests.some(u => u.startsWith('/api/items') && u.includes('status=low'))).toBe(true);
  expect(screen.queryByRole('region', { name: /Waxes/ })).toBeNull();
  await user.selectOptions(screen.getByLabelText('Show'), 'all');
  await waitFor(() => expect(screen.getByRole('link', { name: /Amber dropper bottle/ })).toBeInTheDocument());
});

it('has an add button and the shelves and suppliers tabs', async () => {
  open();
  expect(await screen.findByRole('link', { name: 'Shelves' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Suppliers' })).toHaveAttribute('href', '/cabinet/suppliers');
  expect(screen.getByRole('link', { name: /Add to the cabinet/ })).toHaveAttribute('href', '/cabinet/new');
});
```

`WaxSeal` renders a `button`; for a link, render `<Link className="wax-seal" to="/cabinet/new">` with the same sprig icon (export the sprig from `WaxSeal.jsx` as `WaxSealLink` taking `to`) and the test's `getByRole('link', ...)` matches.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/client/shelves.test.jsx`
Expected: FAIL (placeholder screen).

- [ ] **Step 3: Implement `Shelves.jsx`, `SectionManager.jsx` and `WaxSealLink`** to the behavior above. Use `useApi` for sections, suppliers and storage spots, and for items with a URL built from the search params plus `today=${todayString()}`. Use `useSearchParams` for filters. Use the shared `Field`, `TextInput`, `Select`, `Checkbox`.

- [ ] **Step 4: Add a SectionManager test** to `shelves.test.jsx`: open "Manage sections", delete "Waxes" with the fetch mock returning 409 `{ error: 'Move what is in this section first.', details: { items: 2 } }` for the first DELETE and 200 `{ ok: true, restore: '/api/sections/3/restore' }` for the one with `move_to`; assert the dialog asks "Move its 2 items to:", choose "Herbs", confirm, and that the second request URL is `/api/sections/3?move_to=1`.

- [ ] **Step 5: Run client tests and build, then commit**

```bash
npx vitest run --project client && npm run build
git add -A
git commit -m "Add the Shelves page with filters and section management" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Item form, item page and restock

**Files:**
- Create: `client/src/screens/cabinet/ItemForm.jsx`, `client/src/screens/cabinet/ItemDetail.jsx`, `client/src/screens/cabinet/RestockDialog.jsx`
- Test: `tests/client/itemform.test.jsx`, `tests/client/itemdetail.test.jsx`

**Interfaces:**
- Consumes: `/api/sections`, `/api/suppliers`, `/api/storage-spots`, `/api/expiry-suggestion`, `POST/PATCH /api/items`, `GET /api/items/:id?today`, `POST /api/items/:id/restock`, `PATCH/DELETE /api/purchases/:id`, `DELETE /api/items/:id`; `PhotoGallery`.
- Produces: routes `/cabinet/new` (optional `?section=ID`), `/cabinet/items/:id/edit`, `/cabinet/items/:id`.

ItemForm behavior:
- Title "Add to the cabinet" or "Edit <name>". Fields in two `ParchmentCard`s:
  - **What it is:** Section (select, required; preselect from `?section`), Name (required), Size or capacity (hint "For example 30 ml amber dropper, 2 oz tin"), Amount (required number) and Unit (select), Low when at or below (number, hint "Leave empty if you don't want a reminder"), Storage spot (text with a `datalist` of existing spots), Notes.
  - Only when the chosen section's `kind === 'herb'`: Latin name, Form (select with empty "Not set"), Plant part (select with empty "Not set").
  - **Where it came from:** Source (select: Not recorded, Bought, Grown, Foraged, Made, Gifted or traded). Bought shows Supplier (select of suppliers plus "Add a supplier…" which opens a small inline name field that `POST /api/suppliers` and selects the new one), Price, Order date, Order note; the purchase quantity is the amount. Foraged shows Place. Gifted shows From whom. Bought, grown, foraged, made and gifted all show Date (label "Date bought" when bought, else "Date harvested or made"); it maps to `acquired_on`, and for bought also to `purchase.purchased_on`.
  - **Expiry:** Use by (date). When Form and Date are set and Use by is empty or was filled by a previous suggestion, fetch `/api/expiry-suggestion` and fill it, showing the hint "Suggested from the form. Change it if you like." Never overwrite a date the user typed.
- On edit, the purchase fields are hidden (purchases are managed on the item page); Source can still change.
- Save with `WaxSeal type="submit"` "Save"; server field errors show under each field via `Field error`; success navigates to `/cabinet/items/:id` and toasts "Saved". A Cancel link goes back.
- Unsaved changes: block in-app navigation with the router's `useBlocker` and ask "Leave without saving?" through `useConfirm` (Keep editing / Leave).

ItemDetail behavior:
- Header: name, subtitle Latin name or section, actions: Restock (WaxSeal), Edit (link button), Mark used up / Put back (PATCH `used_up`), Delete (useDeleteWithUndo; after delete navigate to `/cabinet`).
- Card "In the jar": `formatAmount`, size, low reminder ("Reminds you at 50 g"), use by date with badges, storage spot, form and plant part for herbs, source text, notes.
- Card "Purchases": table Date, Supplier (link to supplier page; "(removed)" after a deleted supplier's name), Quantity, Price, Note, with Edit (inline price/note/date) and Delete per row (useDeleteWithUndo). Empty state: "No purchases recorded."
- Card "Photos": `PhotoGallery ownerType="item"`.
- RestockDialog: Quantity (required, unit shown beside), Supplier (select, defaults to last supplier), Price, Date (defaults to today), New use by (optional; prefilled from the expiry suggestion when the item has a form), Order note. Submit posts `/restock`, closes, refreshes, toasts "Restocked".

- [ ] **Step 1: Write the failing tests**

`tests/client/itemform.test.jsx` must cover:
1. Choosing the Herbs section shows Latin name, Form and Plant part; choosing Containers hides them.
2. Choosing Bought shows Supplier, Price and Date bought; Foraged shows Place; Gifted shows From whom.
3. Picking Form "dried leaf" with Date "2026-10-08" calls `/api/expiry-suggestion?form=dried%20leaf&acquired_on=2026-10-08` and fills Use by with the mocked `2027-10-08`; typing a different Use by and then changing Form does not overwrite it.
4. Submitting a new bought item posts `/api/items` with body containing `section_id`, `name`, `amount` (number), `unit`, `source_kind: 'bought'`, `acquired_on`, and `purchase: { supplier_id, purchased_on, price }`; a 400 with `details: { name: 'Required' }` shows "Required" under Name and `aria-invalid="true"` on it.

`tests/client/itemdetail.test.jsx` must cover:
1. Detail shows amount, badges, source and a purchases row linking to `/cabinet/suppliers/2`, with "(removed)" when `supplier_deleted_at` is set.
2. Restock: open the dialog, enter Quantity 24, submit; assert the POST to `/api/items/7/restock` with `{ quantity: 24, supplier_id: 2, purchased_on: <today>, ... }` and that the page refetches.
3. Mark used up sends `PATCH /api/items/7` with `{ used_up: true }`.
4. Delete asks first with focus on "Keep it", then deletes and navigates to `/cabinet`.

Write them in the same style as `tests/client/settings.test.jsx`: a routed render with `ToastProvider` and `ConfirmProvider`, a `fetch` mock keyed by method and URL that records calls, `userEvent`, and the `HTMLDialogElement` polyfills.

- [ ] **Step 2: Run them to see them fail**, then **Step 3: implement** `ItemForm.jsx`, `ItemDetail.jsx`, `RestockDialog.jsx` to the behavior above, **Step 4: run** `npx vitest run --project client && npm run build`, **Step 5: commit**:

```bash
git add -A
git commit -m "Add the item form, item page and restock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Supplier pages

**Files:**
- Create: `client/src/screens/cabinet/Suppliers.jsx`, `client/src/screens/cabinet/SupplierForm.jsx`, `client/src/screens/cabinet/SupplierDetail.jsx`
- Test: `tests/client/suppliers.test.jsx`

**Interfaces:**
- Consumes: `/api/suppliers`, `/api/suppliers/:id`, `POST/PATCH/DELETE /api/suppliers`, `PhotoGallery`, `CabinetTabs`, `formatMoney`, `formatAmount`.
- Produces: routes `/cabinet/suppliers`, `/cabinet/suppliers/new`, `/cabinet/suppliers/:id`, `/cabinet/suppliers/:id/edit`.

Behavior:
- Suppliers list: header "Herb cabinet" with `CabinetTabs` (Suppliers current), WaxSeal link "Add a supplier". One `ParchmentCard` per supplier in a `card-grid`: name as a link, rating shown as filled and empty stars with text alternative "Rated 4 out of 5", good for, "N purchases, $X spent, last on <date>" (or "No purchases yet."), website link (`rel="noopener noreferrer" target="_blank"`, opens in a new window, label "Website"). Empty state: "No suppliers yet" with the add link.
- SupplierForm: Name (required), Website (hint "Starts with https://"; client accepts empty or a URL starting `http://` or `https://`, otherwise shows "Enter a web address starting with https://"), Contact notes, Good for, Rating (select: Not rated, 1 to 5), Notes. Same save, errors and unsaved-changes guard as ItemForm.
- SupplierDetail: header with Edit and Delete (useDeleteWithUndo, then go to `/cabinet/suppliers`); card with the fields; card "Bought here" table Date, Item (link to item), Quantity (`formatAmount` with the item unit), Price, total spent at the bottom; "Show only these items on the shelves" link to `/cabinet?supplier_id=ID`; Photos card.

- [ ] **Step 1: Write the failing test `tests/client/suppliers.test.jsx`** covering: list shows totals text "2 purchases, $15.50 spent, last on Oct 1, 2026" (format dates with `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` from a `YYYY-MM-DD` parsed as local date); rating text alternative; website link attributes; the form rejects `example.com` with the hint message and posts a valid one; detail shows history rows and the total.

- [ ] **Step 2-5:** fail, implement, run `npx vitest run --project client && npm run build`, commit:

```bash
git add -A
git commit -m "Add supplier pages with ratings and purchase history" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Today cards and expiry defaults in Settings

**Files:**
- Modify: `client/src/screens/Today.jsx`, `client/src/screens/Settings.jsx`
- Test: `tests/client/today.test.jsx`, `tests/client/settings.test.jsx`

**Interfaces:**
- Consumes: `GET /api/today?today=YYYY-MM-DD`, settings keys `expiry_*`.

Today behavior:
- Fetch `/api/today?today=${todayString(now)}` (refetch when the date changes, using the existing `useNow`).
- "Running low": each item as a link to `/cabinet/items/:id`, "Calendula, 40 g left" (use `formatAmount`; for count "6 left"). If `counts.runningLow > 8`, a link "See all N" to `/cabinet?status=low`. Empty: "Nothing is running low."
- "Nearing expiry": items from `expired` first with "past its best since Oct 7", then `nearingExpiry` with "use by Oct 20"; "See all" links to `/cabinet?status=expiring` and `/cabinet?status=expired` when capped. Empty: "Nothing is close to its date."
- "Batches due" keeps its current text but changes to "Batches arrive in a later stage." (no promise of a date).
- While the cabinet is completely empty (all three counts 0 and no items exist), keep the old gentle note under Running low and Nearing expiry: "Nothing here yet. This fills in once the herb cabinet is stocked." with a link "Stock the cabinet" to `/cabinet/new`. Detect "no items" with `GET /api/items?today=...` length 0 only when all counts are 0.
- Errors: show "Couldn't read the cabinet." with "Try again".

Settings behavior:
- New `ParchmentCard` "Shelf life" with one `NumberInput` per form ("Dried leaf", "Dried flower", "Root", "Bark", "Seed", "Resin", "Powder", "Tincture", "Infused oil") in months, hint on the card: "Used to suggest a use-by date when you add an herb. 0 means no suggestion." Saved with the same Save settings button (they're part of the same form state) or its own "Save shelf life" button; either is fine, but errors must show per field.

- [ ] **Step 1:** Update `tests/client/today.test.jsx`: the fetch mock answers `/api/today?today=...` with a summary; assert running-low and nearing rows, the "past its best" text, "See all 10" when `counts.runningLow` is 10, and the empty-cabinet note when counts are 0 and `/api/items` returns `[]`. Keep the greeting tests.
- [ ] **Step 2:** Update `tests/client/settings.test.jsx` defaults in the mock to include the `expiry_*` keys; add a test that changing "Powder" to 9 and saving sends `expiry_powder: '9'` (strings are fine; the server accepts numbers or strings).
- [ ] **Step 3-5:** fail, implement, run `npx vitest run && npm run build`, commit:

```bash
git add -A
git commit -m "Show running low and nearing expiry on Today, and shelf life in Settings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Demo cabinet, browser walk-through and docs

**Files:**
- Modify: `server/demo/seed.js`, `README.md`, `AGENTS.md` (only if commands changed), `e2e/drawers.spec.js`
- Create: `e2e/cabinet.spec.js`
- Test: `tests/server/demo.test.js`

**Interfaces:**
- Consumes: `createItem`, `restockItem`, `repos`.

- [ ] **Step 1: Extend `seedDemo`** (inside its transaction, only when seeding) with two suppliers ("Moonvale Botanicals", rating 5, good for "Dried herbs and resins"; "Tin & Glass Co", rating 4, good for "Bottles, tins and droppers") and about twelve items spread over Herbs, Oils and butters, Waxes, Essential oils, Containers, Labels and packaging, and Tools and equipment. Use dates relative to the real current date (compute `today` with the same local-date logic as the client, in the seed) so the demo always shows two running-low items, two nearing expiry and one past its best. Include at least: Calendula (dried flower, bought, low), Chamomile (dried flower, bought), Lavender (dried flower, grown), Mugwort (dried leaf, foraged at "the meadow by the old mill"), Rose petals (dried flower, gifted by "Rowan", nearing expiry), Jojoba oil (250 ml), Beeswax pastilles (low), Lavender essential oil (15 ml), 30 ml amber dropper bottles (24 count, Tin & Glass), 2 oz tins (12 count), Kraft jar labels (60 count), and a Digital scale (1 count, tool). Every bought item has a purchase with a price.
- [ ] **Step 2: Update `tests/server/demo.test.js`**: after seeding, `/api/items?today=<seed today>` has at least 12 rows, `/api/suppliers` has 2, and `/api/today` has at least one entry in each of the three lists. Reset still restores the demo.
- [ ] **Step 3: Update `e2e/drawers.spec.js`** so it no longer expects the Herb cabinet drawer to be "being built" (the cabinet now shows the Shelves page). Its loop can check the h1 is "Herb cabinet" for that drawer.
- [ ] **Step 4: Write `e2e/cabinet.spec.js`** against the empty throwaway data folder: add a supplier "Moonvale Botanicals"; add Calendula (Herbs, dried flower, 40 g, low at 50, bought from Moonvale, price 9.50, date today) and see the suggested use-by filled; see it on Shelves with "Running low"; open it, restock 100 g, see 140 g and two purchases; add a supply "30 ml amber dropper bottle" (Containers, 24 count); go to Today and see Calendula is no longer running low and nothing breaks; upload a photo (use a small PNG fixture written in the test with `fs` to `test-results/`), see it as the cover on the Shelves row; delete the dropper bottle and undo it. Save a full-page screenshot of Shelves to `test-results/shelves.png` and of the item page to `test-results/item.png`.
- [ ] **Step 5: README:** move the cabinet from "coming" to "what works", in two or three plain sentences (supplies, where it came from, suppliers, photos, Today cards). Copy `test-results/shelves.png` to `docs/screenshots/shelves.png` and show it. Run `/unslop` on the changed README text.
- [ ] **Step 6: Run everything and commit**

```bash
npx vitest run && npm run test:e2e && npm run build
git add -A
git commit -m "Stock the demo cabinet, walk through it in the browser, update the README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Ship Stage 2A

Ask Stephanie before each step marked **(ask)**.

- [ ] **Step 1:** Final whole-branch review (most capable model), one fix wave, scoped re-review.
- [ ] **Step 2:** Evidence: a headless Playwright recording against a throwaway data folder whose path contains no personal names (for example `C:\ap-evidence`), covering add supplier, add herb with suggested expiry, restock, add supply, photo cover, Today cards, delete with undo. Push the PNGs, MP4 and `assertions.md` to the `evidence` branch under `stage-2a/`.
- [ ] **Step 3:** Open the PR against `main` with the evidence table, run `/unslop` on title and body, then `/greploop` until 5/5 with no open comments.
- [ ] **Step 4 (ask):** Merge, then update the installed app: `npm run stop`, `git pull`, `npm run setup`, start the task, check `/api/health`. The database upgrades itself on start. Don't rerun `install-windows`.
