# The Apothecary, Stage 8: Labels and Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The last two drawers work, and the app is complete.

- **Shopping list.**
  - Jars at or below their low-stock threshold appear on the list by themselves, with their last supplier and price. They leave the list when restocked.
  - She adds her own items, edits them, checks them off, deletes them, and clears the checked ones.
  - The list groups by cabinet section or by supplier.
  - "Restock" on a low jar opens the restock dialog. "Bought" on her own item opens a new-jar form filled in with the supplier and price from last time, and checks the item off when the jar is saved.
- **Labels.**
  - She picks jars and batches, a size (small round, medium rectangle, large rectangle), how many copies of each, and where on the sheet to start.
  - Each label shows the name, Latin name, the date made with that day's moon glyph, the expiry, the ingredients, and a short caution line when an ingredient has one. She can adjust the text of each label before printing.
  - "Print" uses the browser's print view. "Save as PDF" writes the same sheet into the `labels\` folder in the data folder, and the Labels page lists the saved files.
  - Jar and batch pages get "Print a label".

**Architecture:**

- Migration 10 adds `shopping_items` (her own items) and `shopping_checks` (checked-off low jars, keyed so a restock brings them back fresh).
- `server/services/shopping.js` builds the list: low jars from `listItems(db, { status: 'low' })` plus her own items, each with its last supplier and price, grouped by section or supplier.
- `server/services/labels.js` builds label data from jars and batches, and `server/services/labelPdf.js` renders a sheet to PDF with **pdfkit** (MIT), using the app's own EB Garamond and Cormorant Garamond font files from `@fontsource`. The label sizes live in one server module and reach the client through `GET /api/labels/sizes`, so the print view and the PDF share one layout.
- The client adds `/shopping` and `/labels`, a `?shopping=` prefill on the new-jar form, "Add to shopping list" on the jar page, and "Print a label" on jar and batch pages.

**Tech Stack:** Same as Stages 1 to 7, plus `pdfkit` (MIT, pure JavaScript).

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, sections "Labels", "Shopping list", "Herb cabinet", "Data".

**Left out on purpose:** no barcode or QR codes, no custom label sizes, no deleting saved PDFs from the app (they're plain files in `labels\`), no shopping list on Today (restock tasks already show there).

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 10, appended to `server/db/migrations.js`. Never edit migrations 1 to 9.
- Days are local days. Tests that depend on days or times pin `process.env.TZ`, or use the app's local-today helper. Never hard-code "today".
- Route handlers read `ctx.db` inside each request.
- Soft deletes and undo work as before (one stamp, restore route).
- New dependency: `pdfkit` only, pinned to an exact version published at least two weeks ago, with a line in `NOTICE.md`. No other new dependencies.
- PDFs are written only inside `<dataDir>\labels\`. File names are made by the server, never taken from the request. Served files are matched against a strict name pattern.
- Caution lines never claim safety. They point her to the cautions ("Check cautions before use") or repeat her own recipe type's label caution.
- Plain, warm wording, no em dashes.
- Use the shared components and hooks: `Field`, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`, `useDeleteWithUndo` (with `onUndo`), `useLeaveGuard` (with `markSaved` before navigating), keyed route wrappers, a save guard, an error with Try again, dialogs that stay mounted with inline `role="alert"` errors.
- Client test mocks must return the real API shapes.
- Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA.
- Foreground test runs only; leave nothing running. Never force-add `.superpowers` files.
- Branch `feat/stage-8-labels-shopping` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-8`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Long text on a label** (a 60-character name, twenty ingredients) is cut to fit its label with an ellipsis, in both the print view and the PDF, and never spills onto the next label. (Tasks 2 and 4 tests.)
2. **Copies and a start position that run past one sheet** continue on a second page in the right order, in both the print view and the PDF. (Tasks 2 and 4 tests.)
3. **A low jar that's restocked** leaves the list if it's no longer low. If it's still low, it comes back unchecked. (Task 1 tests.)
4. **A shopping item linked to a jar, herb, section or supplier that was later deleted** still shows with its own name, and the "Bought" prefill leaves out the missing links instead of failing. (Tasks 1 and 3 tests.)
5. **Saving a PDF when the labels folder can't be written** returns a plain 500 message ("Couldn't save the PDF in the labels folder.") and the page shows it inline. Two saves in the same second get different file names. (Tasks 2 and 4 tests.)

## Label sizes (`server/services/labelSizes.js`)

All measurements in inches on US letter (8.5 x 11). PDF points are inches x 72.

| key | name | shape | width | height | cols | rows | left | top | pitch x | pitch y | per sheet | shows |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| small-round | Small round | circle | 2 | 2 | 3 | 4 | 0.75 | 0.5 | 2.5 | 2.5 | 12 | name, date and moon, expiry |
| medium-rect | Medium rectangle | rect | 3.5 | 2 | 2 | 5 | 0.5 | 0.5 | 4 | 2 | 10 | name, Latin name, date and moon, expiry, ingredients (2 lines), caution (1 line) |
| large-rect | Large rectangle | rect | 4 | 3.33 | 2 | 3 | 0.25 | 0.5 | 4 | 3.33 | 6 | everything; ingredients up to 4 lines, caution up to 2 lines |

`GET /api/labels/sizes` returns this table as `[{ key, name, shape, width, height, cols, rows, left, top, pitchX, pitchY, perSheet, fields: [...] }]`.

## File map

```
server/db/migrations.js            + migration 10
server/db/repos.js, server/schemas.js   + shoppingItems, shoppingItemSchema
server/services/shopping.js        the list, her items CRUD, checks, clear, jar prefill
server/services/cabinet.js         createItem accepts shopping_item_id
server/services/labelSizes.js      the size table
server/services/labels.js          label data for jars and batches
server/services/labelPdf.js        pdfkit sheet renderer, saved file list
server/services/purge.js           shopping rows and checks
server/routes/shopping.js, server/routes/labels.js, server/routes/index.js
server/demo/seed.js                SEED_VERSION '9'
client/src/lib/labels.js           sheet layout (pages, slots), text fitting helpers
client/src/screens/shopping/ShoppingList.jsx, ShoppingItemDialog.jsx
client/src/screens/labels/Labels.jsx, LabelSheet.jsx, LabelCard.jsx
client/src/screens/cabinet/ItemForm.jsx, ItemDetail.jsx, RestockDialog.jsx (reused), batches/BatchPage.jsx
client/src/App.jsx                 routes; DrawerSoon goes away
tests/server/shopping*.test.js, labels*.test.js, tests/client/shopping*, labels*, e2e/labels-shopping.spec.js
```

---

### Task 1: Shopping list data and API

**Files:** Modify `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/services/cabinet.js`, `server/services/purge.js`, `server/routes/index.js`. Create `server/services/shopping.js` and `server/routes/shopping.js`. Tests: `tests/server/shopping.test.js`; extend `purge.test.js`, `cabinet.test.js` and `db.test.js` (or wherever migrations are checked).

**Interfaces produced:**
- Migration 10:

```sql
CREATE TABLE shopping_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, quantity TEXT,
  section_id INTEGER REFERENCES cabinet_sections(id), supplier_id INTEGER REFERENCES suppliers(id),
  herb_id INTEGER REFERENCES herbs(id), item_id INTEGER REFERENCES items(id),
  notes TEXT, checked_on TEXT, ${TS});
CREATE INDEX idx_shopping_items_checked ON shopping_items(checked_on);
CREATE TABLE shopping_checks (auto_key TEXT PRIMARY KEY, checked_on TEXT NOT NULL);
```

- **Schema:** `shoppingItemSchema = { name: 'string!', quantity: 'string', section_id: 'int', supplier_id: 'int', herb_id: 'int', item_id: 'int', notes: 'string' }`. Linked records must be live when they change (400 on the field), and an unchanged link to a record deleted later is accepted, as in the garden.
- **Repo:** `shoppingItems` (`orderBy: 'name COLLATE NOCASE, id'`).
- **The list** (`GET /api/shopping?group=section|supplier&today=`; default `section`):
  - Low jars: `listItems(db, { status: 'low' }, today)`. Each becomes `{ key: 'low:<itemId>:<restock_count>', kind: 'low', name, amount, unit, low_threshold, item: { id, name, live: true }, section: { id, name }, last: { supplier: { id, name } | null, price, purchased_on, quantity, unit } | null, checked: bool }`. `checked` is true when `shopping_checks` holds that key.
  - Her items: `{ key: 'item:<id>', kind: 'manual', id, name, quantity, notes, section, supplier, herb, item (each `{ id, name, live }` or null), last, checked: checked_on != null }`. `last` comes from the linked jar's latest purchase, else the latest purchase of any jar with the linked herb, else null.
  - `{ group, groups: [{ key, name, rows }] }`. By section: the jar's section, or her item's section; rows without one go to "Other" at the end. By supplier: her item's supplier, else `last.supplier`; rows without one go to "No supplier yet" at the end. Groups sort by name, rows by unchecked first, then name.
  - `counts: { open, checked }`.
- **Her items:** `POST /api/shopping/items`, `PATCH /api/shopping/items/:id`, `DELETE /api/shopping/items/:id`, `POST /api/shopping/items/:id/restore`.
- **Checks:** `POST /api/shopping/check { key, checked: bool }`. For `item:<id>` it sets or clears `checked_on`. For `low:...` it inserts or deletes the `shopping_checks` row (only for a key the current list contains; 404 otherwise).
- **Clear:** `POST /api/shopping/clear` soft-deletes every checked live item with one stamp, deletes `shopping_checks` rows for keys no longer on the list, and returns `{ stamp, cleared }`. `POST /api/shopping/clear/undo { stamp }` restores them.
- **Jar prefill:** `GET /api/shopping/items/:id/jar` returns `{ name, latin_name, herb_id, section_id, source_kind: 'bought', purchase: { supplier_id, price } }` from her item and its `last`, leaving out any link that isn't live and any null field.
- **Cabinet:** `createItem` accepts `shopping_item_id`. Inside the same transaction it checks off that live item (sets `checked_on` to the jar's `acquired_on` or local today).
- **Purge:** old-deleted shopping items. Before purging sections, suppliers, herbs and jars, null the matching `shopping_items` columns. `shopping_checks` rows whose jar no longer exists are deleted.

- [ ] Tests first:
  - Migration 10 creates both tables.
  - The list has the low jars and her items with the right shapes, `last` for each kind of link, both groupings with their trailing groups, sorting and counts.
  - Restocking a checked low jar: if still low it comes back unchecked under the new key; if not, it's gone (Review Focus 3).
  - Item CRUD with link checks, an unchanged dead link accepted, delete and undo.
  - Checks for both kinds, and 404 for a stale low key.
  - Clear and undo.
  - The prefill with live and dead links (Review Focus 4).
  - `createItem` with `shopping_item_id` checks it off.
  - Purge covers each rule.
- [ ] See them fail. Implement. Full vitest. Commit "Add the shopping list to the API".

### Task 2: Label data, sizes and PDF

**Files:** Create `server/services/labelSizes.js`, `server/services/labels.js`, `server/services/labelPdf.js` and `server/routes/labels.js`. Modify `server/routes/index.js`, `package.json`, `package-lock.json`, `NOTICE.md`. Tests: `tests/server/labels.test.js` and `label-pdf.test.js`.

**Interfaces produced:**
- `npm install pdfkit@<exact version>` (see Global Constraints).
- `LABEL_SIZES` as in the table above, exported from `labelSizes.js`. `GET /api/labels/sizes` returns it.
- **Label data** (`GET /api/labels/data?items=1,2&batches=3`, at most 60 ids in all, 400 otherwise; unknown or deleted ids are left out):
  - A jar gives `{ source: { kind: 'item', id }, name, latin_name, made_on, phase, expires_on, ingredients, caution }`.
    - `made_on` is `acquired_on`. `phase` is `skyFacts(made_on).phase.name` when there is a date, else null.
    - `ingredients` is the ingredient names of the finished batch whose `item_id` is this jar, joined with ", ", else null.
    - `caution` follows the caution rule below, using that batch when there is one, else the jar's herb.
  - A batch gives the same shape with `source: { kind: 'batch', id }`, `name` (the batch name), `latin_name: null`, `made_on: start_date`, `expires_on`, and its ingredient names.
  - **Caution rule:** the parts, in order, joined with " ":
    1. the batch's recipe type `label_caution`, when set;
    2. when any linked live herb (the jar's herb, or the batch's ingredient herbs) has any `caution_*` field set: "Check cautions for <herb names, joined with ', '> before use.";
    3. null when neither applies.
  - Rows come back in the order the ids were given, jars first.
- **PDF** (`POST /api/labels/pdf`):
  - Body `{ size, start, labels: [{ name, latin_name, made_on, expires_on, ingredients, caution, show_moon, copies }] }`.
  - Checks: `size` is a key; `start` is 1 to perSheet; `copies` is 1 to 99; at most 60 labels and 500 printed labels in all; text fields are strings of at most 300 characters; dates are valid. 400 with `details` otherwise.
  - `phase` is recomputed from `made_on` on the server.
  - Slots fill left to right, top to bottom, starting at `start` on the first page and at slot 1 on later pages. Each label prints `copies` times in a row.
  - Each label draws its fields for its size (see "shows" in the table). Text that doesn't fit is cut with "…" inside the label's box (`height` and `ellipsis` options in pdfkit). The name uses Cormorant Garamond 600; the rest uses EB Garamond 400 (italic for the Latin name). Fonts load from the `.woff` files in `node_modules/@fontsource/*/files/` (latin subset).
  - The moon glyph is drawn with the same shapes as `client/src/lib/moonGlyph.jsx` (a disc and the lit path via `doc.path`), about 0.18 inches across, next to the date ("Made Oct 11, 2026").
  - Expiry reads "Use by Apr 11, 2027".
  - Small round labels center their lines inside the circle. Rectangles get a thin border; circles get a thin circle, as a cutting guide.
  - The file goes to `<dataDir>/labels/labels-YYYY-MM-DD-HHMMSS.pdf` (local time). The folder is created if missing. If the name exists, add `-2`, `-3` and so on. A write failure returns 500 "Couldn't save the PDF in the labels folder."
  - Response `{ file, pages, labels }`.
- **Saved files:** `GET /api/labels/files` lists `labels-*.pdf` in the folder, newest first, as `[{ name, size, saved_at }]`. `GET /api/labels/files/:name` serves one inline as `application/pdf` when the name matches `^labels-\d{4}-\d{2}-\d{2}-\d{6}(-\d+)?\.pdf$`, else 404.

- [ ] Tests first:
  - Sizes shape.
  - Label data for a herb jar, a jar from a finished batch, a batch with a type caution and cautioned herbs, a jar with no date, ordering, the 60-id cap, and deleted ids left out.
  - PDF: validation errors; a saved file that starts with `%PDF`; page counts for start and copies past one sheet (Review Focus 2, by counting `/Type /Page` objects or returning `pages`); a 300-character name and 40 ingredients still produce one page per sheet (Review Focus 1); the same-second suffix; an unwritable folder giving the 500 (Review Focus 5; point the data folder's `labels` at a file to force the failure).
  - Saved files: the list, serving a good name, 404 for a bad or traversal name.
- [ ] See them fail. Implement. Full vitest. Commit "Add label data and PDF sheets to the API".

### Task 3: Shopping list screen

**Files:** Create `client/src/screens/shopping/ShoppingList.jsx` and `ShoppingItemDialog.jsx`. Modify `App.jsx`, `client/src/screens/cabinet/ItemForm.jsx`, `ItemDetail.jsx` and CSS. Tests: `tests/client/shopping.test.jsx` and `shoppingdialog.test.jsx`; extend `itemform.test.jsx` and `itemdetail.test.jsx`.

- **`/shopping`:**
  - `PageHeader` "Shopping list" with the subtitle "What the cabinet is running low on".
  - Actions: `WaxSeal` "Add an item" (opens the dialog), and "Clear checked" (disabled with nothing checked; clears with an Undo toast).
  - A "Group by" toggle, Section or Supplier, kept in the URL (`?group=`).
  - Each group is a `ParchmentCard` with its name. Each row has:
    - a checkbox labelled with the row's name;
    - the name (her item's name, or the jar's name linking to the jar);
    - details: for a low jar "12 g left, low at 50 g"; for her item its quantity and notes;
    - "Last from Moonvale Herbs, $9.50 on Sep 2" when there is a `last`;
    - checked rows are muted with the name struck through.
  - Low jars get "Restock", which opens the existing `RestockDialog` for that jar (it already fills in the last supplier). After a restock the list reloads.
  - Her items get "Bought" → `/cabinet/new?shopping=<id>`, plus Edit and Delete (with undo).
  - Empty state: "Nothing to buy. Jars running low will show up here."
  - A failed load shows an error with Try again.
- **`ShoppingItemDialog`** (add and edit, stays mounted): Name (required), Quantity, Section, Supplier, Herb, Jar (selects of live records; a dead linked record shows as "<name> (no longer here)" and stays selected), Notes. Inline errors.
- **Item form:** with `?shopping=<id>`, load `/api/shopping/items/<id>/jar`, fill the form (source Bought, with supplier and price in the purchase fields), show "From your shopping list", and send `shopping_item_id` on save. A failed prefill load shows an error with Try again.
- **Jar page:** "Add to shopping list" creates her item linked to the jar (name and section from the jar), then shows a toast "Added to the shopping list" with a link. It's hidden while the jar is already low (the list has it) and for used-up jars.
- In `App.jsx`, `/shopping` leaves the "being built" list.

- [ ] Tests first: groups and rows with the real shapes, both groupings and the URL, checking both kinds of row, Restock opening the dialog and reloading, Bought linking to the prefill, Edit and Delete with undo, Clear checked with undo, the empty and error states, the dialog (required name, dead links), the item form prefill and `shopping_item_id`, and the jar page button with its hidden cases.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the shopping list".

### Task 4: Labels screen, print view and Save as PDF

**Files:** Create `client/src/lib/labels.js`, `client/src/screens/labels/Labels.jsx`, `LabelSheet.jsx` and `LabelCard.jsx`. Modify `App.jsx`, `client/src/screens/cabinet/ItemDetail.jsx`, `client/src/screens/batches/BatchPage.jsx` and CSS (including an `@media print` block). Tests: `tests/client/labels.test.jsx` and `labelslib.test.jsx`; extend `itemdetail.test.jsx` and `batchpage.test.jsx`.

- **`lib/labels.js`:** `layoutSheets(size, start, labels)` returns `[[{ slot, label } | null, ...per slot], ...pages]`, the same rules as the PDF (start on page 1, copies in a row). Plus `madeText(made_on)` ("Made Oct 11, 2026") and `useByText(expires_on)` ("Use by Apr 11, 2027").
- **`/labels`** (`?items=1,2&batches=3&size=`):
  - `PageHeader` "Labels" with the subtitle "Jars and batches, ready for the shelf".
  - **Pick:** two lists with checkboxes, Jars (live jars, not used up, grouped by section) and Batches (newest first), each with a filter box. The ids picked are kept in the URL.
  - **Set up:** Size (the three sizes, by name, with "12 per sheet" and so on), "Start at label" (1 to perSheet, with a note that this skips labels already used on a sheet), and for each picked label: Copies (1 to 99), "Show the moon", and editable Name, Latin name, Ingredients and Caution (prefilled from `/api/labels/data`; a "Reset" button restores them). Edits live only on this page. Leaving with edits asks first (leave guard).
  - **Preview:** `LabelSheet` draws the pages at a reduced scale with the real proportions from `/api/labels/sizes`. Each `LabelCard` is positioned in inches and shows only its size's fields, with CSS line clamps and `overflow: hidden` so text never spills (Review Focus 1). Empty slots before `start` are drawn faintly.
  - **Print:** prints through `window.print()`. The `@media print` CSS hides the app chrome and prints the sheets at full size on letter paper (`@page { size: letter; margin: 0 }`), one sheet per page.
  - **Save as PDF:** sends the current labels to `POST /api/labels/pdf` with a save guard. On success it shows the toast "Saved <file> in your labels folder." Errors show inline (`role="alert"`), including the 500 (Review Focus 5).
  - **Saved PDFs:** a card listing `/api/labels/files` (name, date, size), each linking to `/api/labels/files/<name>` in a new tab. "No saved label sheets yet." when empty.
  - Nothing picked: "Pick jars or batches to make labels."
  - Failed loads show an error with Try again.
- **Jar page and batch page:** "Print a label" → `/labels?items=<id>` or `/labels?batches=<id>`.
- In `App.jsx`, `/labels` leaves the "being built" list. With both drawers built, the `DrawerSoon` route list is empty: remove `DrawerSoon` and its test if nothing else uses it.

- [ ] Tests first: `layoutSheets` for start, copies, page breaks and every size (Review Focus 2); picking in the URL; the data prefill and Reset; edits reaching the PDF body; show-the-moon; the preview slots and clamps; Print calling `window.print`; Save as PDF success, inline 400 and 500 errors, and the double-submit guard; the saved list and its empty state; the leave prompt with edits; the buttons on the jar and batch pages.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the label maker".

### Task 5: Demo, browser walk-through, docs and ship

- [ ] **Demo:** `SEED_VERSION` '9'. Two of her items, "Amber dropper bottles, 30 ml" (quantity "6", section Containers) and "Shea butter" (quantity "250 g", section Oils and butters, supplier Moonvale Herbs). The demo's low jars (Calendula, Beeswax pastilles) already show on the list. Reset clears shopping items and checks. v8 folders get the items once. Tests mirror the earlier demo tests.
- [ ] **`e2e/labels-shopping.spec.js`** (port 4203, unique names):
  1. A jar set below its threshold shows on the shopping list with its last supplier. Restocking it above the threshold takes it off the list.
  2. Add an item, group by supplier, check it, then "Bought" opens the prefilled new-jar form. Saving makes the jar and the item shows as checked. Clear checked, then Undo.
  3. From a jar page, "Print a label" opens Labels with the jar picked. Pick a batch too, choose Medium rectangle, set copies to 2 and start at 9. The preview has two pages.
  4. Edit the caution text and Save as PDF. The toast names the file, and Saved PDFs lists it.

  Take screenshots `test-results/shopping.png` and `test-results/labels.png`.
- [ ] **README:** the app is complete. Replace the stage line with a sentence saying all eight drawers work. Add a Shopping list bullet and a Labels bullet, and add `![Labels](docs/screenshots/labels.jpg)` from a temporary stocked demo (`C:\ap-shot-8`, port 4205), as a JPEG under 400 KB. Update `AGENTS.md` if anything about the `labels\` folder changed. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence (headless, `C:\ap-evidence-8`), pushed to `evidence/stage-8/`, with no duplicate screenshots. Then the PR, and greploop to 5/5 with zero open threads.
- [ ] **(ask)** Merge. Then back up, `npm run stop`, pull, `npm run setup`, start the task, and check that `/api/shopping` and `/api/labels/sizes` answer.
