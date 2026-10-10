# The Apothecary, Stage 3B: Batch Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Batch journal drawer works. "Make this recipe" (or a free-form batch) picks a scale and start date, matches each ingredient to jars in the cabinet, converts units where it can, flags what it can't, and draws the amounts down. Each batch has steps due later (for example "Strain and bottle" after the recipe's wait time), journal fields, photos and a finish step that can add the result to the cabinet as a new jar. Due steps show on Today. Each batch prints as a one-page record sheet.

**Architecture:** Migration 5 adds `batches`, `batch_ingredients` and `batch_steps`. A pure `server/lib/units.js` converts between units in the same family. `server/services/batches.js` plans a batch from a recipe (reusing `getRecipeDetail` scaling), creates it with stock draws in one transaction, and handles steps, finishing and deletes. The client adds the Batch journal list, a "new batch" page, a batch page with a finish dialog, a printable record sheet, a "Make this recipe" button on recipe pages, and real data in Today's "Batches due" card.

**Tech Stack:** Same as Stages 1 to 3A.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, section "Batch journal" (and "Error handling": stock never goes below zero without the user confirming). Stage 3 split approved in chat on 2026-10-09; Stage 3A shipped as PR 4.

**Moved to later stages (spec items that need them):**
- Moon phase, moon sign and day ruler for the start date, and suggested start dates, need Stage 4's sky calculations. They're computed from `start_date`, so Stage 4 can show them for every batch, old ones included. No columns for them here.
- Due steps on the calendar and to-do list come with Stage 5. This stage shows them on Today and the batch pages.

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 5, appended to `server/db/migrations.js`. Never edit migrations 1 to 4.
- Soft deletes and undo as in earlier stages; photos cascade with the delete stamp.
- **Stock:** a jar's amount never goes below zero without the user confirming. When confirmed, the amount is set to 0 (never negative). Unit mismatches the app can't convert are flagged for her to adjust by hand, never guessed. Deleting a batch does not put amounts back in jars (the herbs were really used); the delete confirmation says so.
- Plain, warm wording, no em dashes. Shared `Field` components, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`, `useDeleteWithUndo` (with `onUndo`), `useLeaveGuard`, `formatAmount`, `formatDay`, keyed route wrappers, save guard against double submit, error with Try again on failed loads. Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA.
- Branch `feat/stage-3b-batch-journal` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-3b`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Units

`server/lib/units.js` (and the same table on the client only if a task needs it; prefer server answers):

| family | units and their size in the base unit |
|---|---|
| mass (base g) | g 1, kg 1000, oz 28.3495, lb 453.592 |
| volume (base ml) | ml 1, l 1000, fl oz 29.5735, tsp 4.92892, tbsp 14.7868, cup 236.588 (US) |
| none | count, drops, parts: convert only to the same unit |

- `convert(amount, from, to) -> number | null`: same unit returns the amount; same family converts and rounds with `roundAmount(n, to)` from `server/lib/scale.js`; anything else returns null.
- Mass and volume never convert into each other (no density guesses).

## File map

```
server/db/migrations.js            + migration 5 (batches, batch_ingredients, batch_steps)
server/db/repos.js                 + batches, batchIngredients, batchSteps
server/schemas.js                  + batchSchema, batchLineSchema, batchStepSchema, finishSchema
server/lib/units.js                convert, unitFamily (pure)
server/services/batches.js         planBatch, createBatch (with draws), getBatchDetail, listBatches,
                                   updateBatch, steps, finishBatch, delete/restore, dueSteps
server/services/today.js           batchesDue from dueSteps
server/services/photos.js          PHOTO_OWNERS += batch
server/services/purge.js           + batches, lines, steps, batch photos
server/routes/batches.js           /api/batches, /api/batches/plan, steps, finish
server/demo/seed.js                SEED_VERSION '5', one batch steeping and one finished
client/src/lib/batches.js          status text, step helpers
client/src/screens/batches/BatchJournal.jsx, NewBatch.jsx, DrawLines.jsx, BatchPage.jsx,
                                   FinishDialog.jsx, StepsEditor.jsx, RecordSheet.jsx
client/src/screens/recipes/RecipePage.jsx   "Make this recipe"
client/src/screens/Today.jsx       Batches due card; Log a batch -> /batches/new
client/src/App.jsx                 routes; /batches leaves the "being built" list
tests/server/units.test.js, batches*.test.js, tests/client/batch*.test.jsx, e2e/batches.spec.js
```

---

### Task 1: Data layer and unit conversion

**Files:** Modify `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/services/photos.js`, `server/services/purge.js`. Create `server/lib/units.js`. Tests: `tests/server/units.test.js`, `tests/server/batches-db.test.js`; extend `tests/server/purge.test.js`.

**Interfaces produced:**
- Migration 5:

```sql
CREATE TABLE batches (id INTEGER PRIMARY KEY, recipe_id INTEGER REFERENCES recipes(id), type_id INTEGER REFERENCES recipe_types(id),
  name TEXT NOT NULL, start_date TEXT NOT NULL, factor REAL CHECK (factor IS NULL OR factor > 0),
  base TEXT, intention TEXT, method TEXT, noticed TEXT, would_change TEXT, label_notes TEXT, notes TEXT,
  finished_on TEXT, yield_amount REAL CHECK (yield_amount IS NULL OR yield_amount > 0), yield_unit TEXT,
  expires_on TEXT, item_id INTEGER REFERENCES items(id), ${TS});
CREATE INDEX idx_batches_recipe ON batches(recipe_id);
CREATE INDEX idx_batches_start ON batches(start_date);
CREATE TABLE batch_ingredients (id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES batches(id),
  herb_id INTEGER REFERENCES herbs(id), name TEXT NOT NULL, amount REAL CHECK (amount IS NULL OR amount >= 0), unit TEXT,
  item_id INTEGER REFERENCES items(id), drawn_amount REAL CHECK (drawn_amount IS NULL OR drawn_amount >= 0), drawn_unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE INDEX idx_batch_ingredients_batch ON batch_ingredients(batch_id);
CREATE INDEX idx_batch_ingredients_item ON batch_ingredients(item_id);
CREATE TABLE batch_steps (id INTEGER PRIMARY KEY, batch_id INTEGER NOT NULL REFERENCES batches(id), title TEXT NOT NULL,
  due_on TEXT, done_on TEXT, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE INDEX idx_batch_steps_batch ON batch_steps(batch_id);
CREATE INDEX idx_batch_steps_due ON batch_steps(due_on) WHERE done_on IS NULL;
```

- Field meanings (they map to the record sheet): `intention` = "Why I made it", `method` = "How I prepared it", `noticed` = "What I noticed", `would_change` = "What I would change", `base` = the base used (oil, alcohol, vinegar, honey, ...), `label_notes` = "Label and shelf-life notes".
- `server/schemas.js`: `batchSchema = { name: 'string!', recipe_id: 'int', type_id: 'int', start_date: 'date!', factor: { type: 'number', min: 0.01, max: 100 }, base: 'string', intention: 'string', method: 'string', noticed: 'string', would_change: 'string', label_notes: 'string', notes: 'string' }`; `batchLineSchema = { herb_id: 'int', name: 'string', amount: { type: 'number', min: 0 }, unit: RECIPE_UNITS, item_id: 'int', drawn_amount: { type: 'number', min: 0 } }`; `batchStepSchema = { title: 'string!', due_on: 'date', done_on: 'date', sort_order: { type: 'int', nullable: false } }`; `finishSchema = { finished_on: 'date!', yield_amount: { type: 'number', min: 0 }, yield_unit: RECIPE_UNITS, expires_on: 'date' }`. Match the existing schema style exactly (check `validate.js`).
- Repos `batches` (`orderBy: 'start_date DESC, id DESC'`), `batchIngredients` and `batchSteps` (`orderBy: 'sort_order, id'`).
- `PHOTO_OWNERS.batch = 'batches'`.
- `server/lib/units.js`: `UNIT_FAMILIES`, `unitFamily(unit) -> 'mass' | 'volume' | null`, `convert(amount, from, to)` (rules in "Units").
- Purge: photos of old-deleted batches; lines and steps of old-deleted batches or old-deleted rows; old-deleted batches. Before purging old-deleted items, set `batches.item_id` and `batch_ingredients.item_id` to NULL for them (the line keeps its name and drawn amount). Before purging old-deleted recipes, set `batches.recipe_id` to NULL for them (the batch keeps its name). The Stage 3A purge rule that keeps a type while a recipe references it also counts batches referencing it.

- [ ] Tests first:
  - units: every pair in each family, round trips, mass to volume is null, count/drops/parts only to themselves, rounding by target unit;
  - migration 5 creates the three tables;
  - `PHOTO_OWNERS.batch`;
  - purge removes old batches with lines, steps and photos; unlinks purged items and recipes from live batches; keeps a type a batch references.
- [ ] See them fail. Implement. Full vitest. Commit "Add the batch tables and unit conversion".

### Task 2: Batch service and routes

**Files:** Create `server/services/batches.js`, `server/routes/batches.js`. Modify `server/routes/index.js`, `server/services/today.js`, `server/services/cabinet.js` (a small exported `drawFromItem` helper). Tests: `tests/server/batches.test.js`, extend `tests/server/today.test.js` and `tests/server/cabinet.test.js`.

**Interfaces produced:**
- `drawFromItem(db, itemId, amount)` in cabinet.js: subtracts from a live item inside the caller's transaction and returns the new amount. Never goes below 0 (clamps), and sets `used_up_at` when the result is 0. The caller is responsible for asking first.
- `POST /api/batches/plan` body `{ recipe_id, scale?, yield?, start_date? }` returns:
  - `{ recipe: { id, name, type_id, type_name }, factor, start_date, name }`, where `name` defaults to "<recipe name>, <Month D>" and `start_date` to today.
  - `lines[]`, one per recipe ingredient (scaled through `getRecipeDetail`): `{ herb_id, name, amount, unit, candidates[], suggested_item_id, suggested_draw, flag }`.
  - `candidates[]` are live, not-used-up items that match: same `herb_id` when the ingredient is linked, otherwise a case-insensitive name match on the item name. Each is `{ id, name, amount, unit, expires_on, convertible }`, sorted by convertible first, then enough stock, then earliest `expires_on`, then name.
  - `suggested_draw` is the amount converted into the suggested item's unit (null when it can't convert).
  - `flag` is one of `null`, `'no_jar'` (no candidates), `'no_conversion'` (the best candidate's unit can't convert), `'not_enough'` (the suggested jar holds less than the draw), or `'no_amount'` (the ingredient has no amount).
  - `steps[]`: when the recipe's effective wait is above 0, one step `{ title: 'Strain and bottle', due_on: start_date + wait_days }`. Otherwise none.
  - `prefill`:
    - `{ intention: recipe.intention, method: recipe.steps }`;
    - `base`: the names of non-herb ingredients joined with ", ";
    - `label_notes`: the type's label caution plus " Keeps about <shelf text>." when there is a shelf life (write `shelfText` in server terms: days, weeks, years, same rules as the client's).
  - Bad scale or yield gives a 400 the same way the recipe route does.
- `POST /api/batches` body = batch fields plus `lines[]` (each line may carry `item_id` and `drawn_amount` in the item's unit) plus `steps[]` plus `confirm_short` (bool).
  - In one transaction:
    1. Validate every line. `item_id` must be a live item. `drawn_amount` must be ≥ 0. When `drawn_amount` is above the item's amount and `confirm_short` isn't true, return 409 `{ error: 'Some jars hold less than you are drawing.', details: { short: [{ line: N, item_id, name, has, wants, unit }] } }` and write nothing.
    2. Create the batch, its lines (with `drawn_unit` = the item's unit) and its steps.
    3. Call `drawFromItem` for each line with an item and a drawn amount.
  - Returns the detail.
  - Free-form batches: no `recipe_id`; lines are typed in.
- `GET /api/batches?status=active|finished&q&recipe_id`: `active` means `finished_on IS NULL`. `q` matches the name, recipe name and line names (LIKE escaped). Rows: `{ id, name, recipe_id, recipe_name, type_name, start_date, finished_on, next_step: { title, due_on } | null, open_steps, cover }`, active first by next due date, then finished by `finished_on` DESC.
- `GET /api/batches/:id` returns:
  - the batch, plus `recipe` `{ id, name }` (live or null), `type` `{ id, name }`, and `lines[]` with `item` `{ id, name, live }`;
  - `steps[]`, `photos[]`, and `made_item` `{ id, name }` (live or null);
  - `status`: `'steeping'` (open steps, not finished), `'ready'` (no open steps, not finished), or `'finished'`.
- `PATCH /api/batches/:id` edits the batch fields only (lines and draws are fixed once made, so they're not editable).
- Steps: `POST /api/batches/:id/steps`, `PATCH /api/batches/:id/steps/:stepId` (title, due_on, done_on), and `DELETE /api/batches/:id/steps/:stepId` (soft delete with restore URL).
- `POST /api/batches/:id/finish` body = `finishSchema` plus optional `add_to_cabinet: { section_id, name, amount, unit, form?, storage_spot? }`.
  - `expires_on` defaults to `finished_on` + the recipe's effective shelf life days (or the type's for free-form) when there is one.
  - In one transaction, it marks all open steps done on `finished_on`, sets the finish fields and, when `add_to_cabinet` is given, creates an item through `createItem` with `source_kind: 'made'`, `source_from` = the batch name, `acquired_on` = `finished_on`, `expires_on`, and sets `batches.item_id`.
  - The unit must be one of the cabinet's `UNITS` (400 `details['add_to_cabinet.unit']`).
  - A batch already finished gives a 409.
- `POST /api/batches/:id/unfinish` clears the finish fields. It leaves the made jar alone; her jar is real.
- `DELETE /api/batches/:id` is a soft delete that cascades lines, steps and photos with the stamp. It never touches item amounts or the made jar. `POST /api/batches/:id/restore` brings them back.
- `dueSteps(db, today, { days = 3 })` returns open steps on live, unfinished batches due on or before today + days: `{ step_id, title, due_on, batch_id, batch_name, overdue }`, ordered by due date. `todaySummary.batchesDue` uses it, capped like the other lists, with `counts.batchesDue`.

- [ ] Tests first:
  - plan:
    - candidates by herb and by name;
    - sort order;
    - conversion (g to oz, tbsp to ml);
    - each flag;
    - steps from wait days;
    - the prefill text;
    - scale and yield.
  - create:
    - draws reduce amounts;
    - converted draws;
    - a short draw gives a 409 with details and writes nothing;
    - with `confirm_short` it clamps to 0 and marks the jar used up;
    - a free-form batch;
    - a dead item gives a 400.
  - list and detail statuses, step add/edit/done/delete/undo.
  - finish:
    - the expiry default;
    - adding a jar to the cabinet;
    - a cabinet unit check;
    - a second finish gives a 409;
    - unfinish.
  - delete and undo leave jar amounts as they were.
  - Today's `batchesDue`.
- [ ] See them fail. Implement. Full vitest. Commit "Add batches to the API".

### Task 3: Batch journal list and the new batch page

**Files:** Create `client/src/lib/batches.js`, `client/src/screens/batches/BatchJournal.jsx`, `NewBatch.jsx`, `DrawLines.jsx`. Modify `client/src/App.jsx`, `client/src/screens/recipes/RecipePage.jsx`, CSS. Tests: `tests/client/batchjournal.test.jsx`, `tests/client/newbatch.test.jsx`; update the "being built" check in `tests/client/cabinet.test.jsx` (switch it to `/journal`).

- **Route `/batches`** (remove it from the "being built" drawers).
  - `PageHeader` "Batch journal", subtitle "What you've made, and what's still steeping". Action: `WaxSealLink` "Start a batch" → `/batches/new`.
  - Tabs or a toggle, "Steeping" (active) and "Finished", kept in the URL (`?status=`). Search.
  - Cards show the name linked to `/batches/:id`, the recipe and type, "Started <day>", and either the next step ("Strain and bottle, due Oct 30", marked "Overdue" in oxblood when past due) or "Finished <day>".
  - Empty states: "Nothing steeping. Start a batch from a recipe." and "No finished batches yet."
- **Recipe page:** a `WaxSealLink` "Make this recipe" in the header actions → `/batches/new?recipe=<id>`, carrying the current `scale` or `yield` param.
- **Route `/batches/new`** (`?recipe=`, `?scale=`, `?yield=`):
  - Step 1 is a "Recipe" select of live recipes plus "No recipe (free-form)", Scale (the same Half, As written, Double, Triple, Other control as the recipe page; reuse it by extracting `ScaleControl` from `RecipePage.jsx` into `client/src/screens/recipes/ScaleControl.jsx` if needed), and a "Start date" defaulting to today. Changing these calls `/api/batches/plan`, debounced 300 ms.
  - **DrawLines** shows a row per ingredient:
    - the recipe amount and name;
    - a "From jar" select of the candidates (each "Calendula (dried flower), 40 g left"), plus "Don't draw from a jar";
    - "Amount to draw" in the jar's unit, prefilled with `suggested_draw`.
    - Flags show as a muted note on the row:
      - `no_jar`: "No jar in the cabinet matches. You can still make it."
      - `no_conversion`: "Can't convert <unit> to <jar unit>. Enter the amount to draw by hand."
      - `not_enough`: "This jar holds only <has>."
      - `no_amount`: "No amount in the recipe."
    - Changing the jar recalculates the draw only when the plan offered a conversion for it. Otherwise the amount is cleared and the note asks her to enter it.
  - Free-form shows an "Add an ingredient" row editor (name, amount, unit, jar picker from all live items, amount to draw).
  - "Steps for later" lists the planned steps, editable (title, due date), with add and remove.
  - Journal fields:
    - "Name" (prefilled);
    - "Why I made it" (`intention`, prefilled);
    - "How I'm preparing it" (`method`, prefilled from the recipe steps);
    - "Base" (prefilled);
    - "Label and shelf-life notes" (prefilled);
    - "Notes".
  - Save posts the batch. On a 409 `short`, a confirm dialog lists each short jar ("Calendula: has 40 g, drawing 60 g"), with "Use what's there (set to 0)" and "Go back". Confirming re-posts with `confirm_short: true`.
  - Success goes to `/batches/:id` with the toast "Batch started".
  - Leave guard, save guard, and load error with Try again.
- [ ] Tests first:
  - list tabs and cards, and the overdue badge;
  - "Make this recipe" carries the scale;
  - the plan request on recipe or scale change;
  - draw rows with flags and their texts;
  - a jar change recalculates or clears;
  - free-form rows;
  - the steps edit;
  - the short-stock 409 dialog and re-post;
  - the save body shape;
  - the leave guard.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the batch journal and starting a batch".

### Task 4: Batch page, steps and finishing

**Files:** Create `client/src/screens/batches/BatchPage.jsx`, `StepsEditor.jsx`, `FinishDialog.jsx`. Modify `client/src/screens/Today.jsx`, `client/src/App.jsx`. Tests: `tests/client/batchpage.test.jsx`; extend `tests/client/today.test.jsx`.

- **Route `/batches/:id`** (keyed wrapper).
  - Header: the name, subtitle "<recipe name> (<type>), started <day>" and a status badge ("Steeping", "Ready to finish", "Finished <day>").
  - Actions: "Print record sheet" → `/batches/:id/sheet`, Edit (turns the journal panel into fields), and Delete. Delete uses `useDeleteWithUndo` with `onUndo`. The confirm text is "Delete this batch? The amounts drawn from your jars stay drawn."
- **Panels:**
  - "Steps": the StepsEditor. Each step has a checkbox "Done" (sets `done_on` today, and unchecking clears it), its title and due date. Edit and Delete with undo, plus "Add a step". Overdue steps are marked.
  - "What went in": lines showing the amount, the name (linked to the herb when linked), and "from <jar link> (<drawn> <unit>)", or "not drawn from a jar".
  - "Journal": why I made it, how I prepared it, base, what I noticed, what I would change, label and shelf-life notes, and notes. It's editable in place, with Save and Cancel and a leave guard.
  - "Finished": shown when finished. It has the finished date, yield, use by, and the made jar's link. An "Undo finishing" button calls unfinish.
  - "Photos": `PhotoGallery ownerType="batch"`.
- **Finish dialog** (from the "Finish this batch" button, shown when not finished):
  - Fields: Finished on (today), Yield amount and unit (prefilled from recipe yield × factor), and Use by (prefilled from the plan's shelf-life default, which the server computes when left blank).
  - A checkbox "Add it to the cabinet as a new jar" (checked by default). It reveals Section (any live section, defaulting to the first supply section), Name (the batch name), Amount (= yield), Unit (cabinet units only; when the yield unit isn't a cabinet unit, the unit is blank and a note says "Pick a cabinet unit for the jar"), and Storage spot.
  - Save posts finish. The dialog stays mounted and toggles `open`, and non-field errors show inside the dialog with `role="alert"`.
- **Today:** "Batches due" lists `batchesDue` (step title, batch name linking to the batch, due day, an "Overdue" badge), with "See all" → `/batches`. The empty text is "Nothing due in the next few days." "Log a batch" goes to `/batches/new`.
- [ ] Tests first:
  - the status badge;
  - the step check and uncheck PATCH bodies;
  - adding, editing, and deleting a step with undo;
  - the lines with jar links;
  - the journal edit and save;
  - the finish dialog prefill, the unit note, the add-to-cabinet body, and in-dialog errors;
  - undoing a finish;
  - the delete confirmation text;
  - the Today card list, empty state and link.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the batch page and finishing a batch".

### Task 5: Printable record sheet

**Files:** Create `client/src/screens/batches/RecordSheet.jsx`, print CSS in `client/src/theme/global.css` (or a `print.css` imported once). Modify `client/src/App.jsx`. Test: `tests/client/recordsheet.test.jsx`.

- **Route `/batches/:id/sheet`.** A one-page sheet in the parchment style, with a double-line frame and green-ink headings, rendered inside the app with a "Print" button (`window.print()`) and a "Back to the batch" link.
- **Fields, in this order:**
  1. Date (start, and finished when set);
  2. Recipe;
  3. Preparation type;
  4. Herbs used (herb lines with amounts);
  5. Base;
  6. Why I made it;
  7. How I prepared it;
  8. What I noticed;
  9. What I would change;
  10. Label and shelf-life notes, including the use-by date when set.

  An empty field prints writing lines (ruled lines) so she can fill it by hand.
- **`@media print`:** hide the cabinet side bar, the page header actions, toasts and the Print/Back controls; plain white background; dark ink; A4 and Letter safe (`@page { margin: 14mm }`); no page break inside a field; the sheet fits one page for a typical batch.
- [ ] Tests first:
  - every field label is in order;
  - values render;
  - an empty field renders ruled lines;
  - Print calls `window.print`;
  - a CSS test is not practical, so check by taking a headless screenshot with `page.emulateMedia({ media: 'print' })` in Task 6's e2e and looking at it.
- [ ] See them fail. Implement. Commit "Add printable batch record sheets".

### Task 6: Demo, browser walk-through, docs and ship

- [ ] **Demo:** `SEED_VERSION` '5'. Add one steeping batch: "Calendula skin salve" started 10 days ago, drawing from the demo calendula jar, with a "Strain and bottle" step due in 4 days. Add one finished batch: "Sleepy chamomile tea", finished last week, with its made jar. Reset clears and re-adds them (and their photos), children first. Existing v4 demo folders get them once, only when there are no batches. Tests mirror the 3A demo tests.
- [ ] **`e2e/batches.spec.js`** (shared 4203 server, unique names):
  1. Add a jar "Batch test calendula" (Herbs, 50 g, linked to Calendula) and a recipe "Batch test oil" (infused oil, Calendula 30 g, Olive oil 200 ml).
  2. From the recipe page, Make this recipe at Double. Calendula shows a not-enough note (60 g wanted, 50 g there). Olive oil shows no jar.
  3. Save. The short-stock dialog appears; confirm. The batch page shows "Strain and bottle" due in 28 days. The jar is now used up.
  4. Check the step done. Finish, adding a jar "Batch test oil" of 400 ml to "Oils and butters", and see the made jar link.
  5. Open the record sheet. Every label is present. Take a print-media screenshot to `test-results/sheet.png`.
  6. Delete the batch and undo.

  Also take screenshots `test-results/batches.png` and `test-results/batch.png`.
- [ ] **README:** change the stage line to Stage 3B. Add a Batch journal bullet in plain words, and add `![The batch journal](docs/screenshots/batches.jpg)` from a temporary stocked demo (`APOTHECARY_DEMO_DATA_DIR=C:\ap-shot-3b`, port 4205), a JPEG under 400 KB. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence recording (headless, data folder `C:\ap-evidence-3b`), pushed to the `evidence` branch under `stage-3b/`, with no duplicate screenshots. Open the PR. Run greploop to 5/5.
- [ ] **(ask)** Merge. Then back up the installed app, `npm run stop`, pull, `npm run setup`, start the task, and check that `/api/batches` answers.
