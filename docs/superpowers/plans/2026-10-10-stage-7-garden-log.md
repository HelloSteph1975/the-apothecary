# The Apothecary, Stage 7: Garden Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Garden log drawer works.

- **Plants.** She keeps a list of what grows in her garden. Each plant has:
  - a grimoire herb or a free-text name, and where it grows;
  - the date planted, the expected harvest date, and an optional date it ended (pulled up, died, given away);
  - notes and photos.
- **Entries.** She logs what she did: planted, sowed, transplanted, pruned, harvested, foraged or observed. Each entry has a date, a plant (one of hers, or a free-text name for foraging), a place, an amount, the weather, notes and photos. The moon phase and sign are stamped automatically.
- **To the cabinet.** A harvest or foraging entry can be sent to the cabinet as a new jar, with the date, source and herb filled in.
- **Foraging reminder.** Foraging entries always show a reminder to identify plants with certainty and to forage only where it's allowed.
- **Garden correspondences.** A plant page shows its herb's garden notes (part harvested, harvest timing, sun, water, companions).
- **Moon gardening.** New starter timing rules give gardening-by-the-moon suggestions (sowing, transplanting, pruning, weeding, harvesting), labelled as folk tradition. The garden page shows the best days in the next four weeks for each kind of work, and the calendar marks garden days.
- **Harvest reminders.** A plant whose expected harvest date is a week away or less gets an automatic "Harvest <plant>" task.
- **Everywhere else.** Garden entries appear on the calendar, on the herb's grimoire page, and can be linked from journal entries. Photos of plants and entries show in the gallery.

**Architecture:**

- Migration 9 adds `garden_plants` and `garden_entries`, adds `garden_tasks` to `timing_rules`, and rebuilds `journal_links` and `tasks` so their CHECK lists accept `garden_entry` and `garden_plant`.
- `server/services/garden.js` handles plants and entries (CRUD, sky stamp, undo, the jar prefill) and the garden suggestions. It reuses `stampSky` from `journal.js` and `skyFacts` and the rule matching from `timing.js`.
- Garden rules are ordinary timing rules with a non-empty `garden_tasks` list. Ten new starter rules ship in `timing-rules.json` with `"since": 2`, and `TIMING_RULES_SEED_VERSION` goes to 2.
- `syncAutoTasks` gains `harvest:<plantId>:<expected_harvest_on>` keys. The calendar gains `garden` and `harvest` event kinds and a per-day `garden` list.
- The client adds `/garden` (plants and moon garden), `/garden/log`, the plant and entry pages and forms, and small additions to the calendar, day page, grimoire herb page, item form, journal entry form and the timing rules screen.

**Tech Stack:** Same as Stages 1 to 6.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, sections "Garden log", "Timing suggestions", "Grimoire", "Journal", "Photos".

**Left out on purpose:** no planting maps or bed layouts, no weather lookups (weather is a text field), no plant-care schedules beyond the harvest reminder.

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 9, appended to `server/db/migrations.js`. Never edit migrations 1 to 8.
- Days are local days. Tests that depend on days or times pin `process.env.TZ`, or use the app's local-today helper. Never hard-code "today".
- Route handlers read `ctx.db` inside each request.
- Soft deletes and undo work as before. Photos cascade with the delete stamp (`PHOTO_OWNERS.garden_plant = 'garden_plants'`, `PHOTO_OWNERS.garden_entry = 'garden_entries'`).
- Every garden suggestion is labelled as folk tradition, never appears in a safety box, and disappears when suggestions are turned off in Settings. Suggestion text is written fresh for this repo; it names no book or almanac.
- Plain, warm wording, no em dashes.
- Use the shared components and hooks:
  - `Field`, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`, `PhotoGallery`;
  - `useDeleteWithUndo` (with `onUndo`), `useLeaveGuard` (and call `markSaved` before navigating after a save);
  - keyed route wrappers, a save guard, and an error with Try again;
  - dialogs that stay mounted, with inline `role="alert"` errors.
- Client test mocks must return the real API shapes (Stage 6 hid a crash behind a mock that returned the wrong shape).
- Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA.
- Foreground test runs only; leave nothing running. Never force-add `.superpowers` files.
- Branch `feat/stage-7-garden` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-7`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Changing a plant's expected harvest date** removes the old harvest task and makes one for the new date. Ending or deleting the plant removes it, and undo brings it back. A harvested entry for the plant on or after 14 days before the expected date counts as done. (Task 2 tests.)
2. **Sending an entry to the cabinet twice** fails with a plain 409, and the entry page then shows the jar instead of the button. If that jar is later deleted, the entry offers "Send to the cabinet" again. (Tasks 2 and 5 tests.)
3. **Garden rules never crowd out the making suggestions on Today.** A garden-only rule (non-empty `garden_tasks`, empty recipe types, planets and elements) is left out of `daySuggestions` and `startDates`. With suggestions off, the garden page, calendar marks and day page show no garden suggestions. (Task 2 tests.)
4. **An existing install on seed version 1** gets the ten garden rules once. A garden rule she deletes is not re-added on the next start, and her edits to the 19 older rules are untouched. (Task 1 tests.)
5. **Migration 9's table rebuilds** keep every `tasks` and `journal_links` row with its id, keep the unique `auto_key` index and the other indexes, and leave `PRAGMA foreign_key_check` clean. (Task 1 tests.)

## Garden tasks and starter garden rules

`GARDEN_TASKS` (in `server/schemas.js`, mirrored in `client/src/lib/garden.js` with labels):

| key | label |
|---|---|
| sow-above | Sow leafy and flowering plants |
| sow-root | Sow roots and bulbs |
| transplant | Transplant |
| prune | Prune |
| weed | Weed and tend |
| harvest-above | Gather leaves and flowers |
| harvest-root | Dig roots |

New entries in `server/data/timing-rules.json`, each with `"since": 2`, empty `recipe_types`, `planets` and `elements`, and the `garden_tasks` shown:

| slug | kind | value | garden_tasks | weight | text |
|---|---|---|---|---|---|
| garden-waxing-sow | phase_group | waxing | sow-above, transplant | 2 | A growing moon: in folk gardening, the time to sow leafy greens and flowers, which are said to rise with it. |
| garden-waning-roots | phase_group | waning | sow-root, harvest-root | 2 | A shrinking moon: old garden lore saves this for sowing roots and bulbs and for digging roots to dry. |
| garden-full-gather | phase | full | harvest-above | 3 | Full moon: traditionally a good time to gather leaves and flowers, in the morning once the dew has dried. |
| garden-new-rest | phase | new | weed | 1 | New moon: in folk practice a resting time for the beds, good for weeding and planning. |
| garden-waning-prune | phase_group | waning | prune | 1 | A shrinking moon: pruning now is said to slow regrowth. |
| garden-water-fruitful | moon_element | Water | sow-above, sow-root, transplant | 2 | Moon in a water sign: counted among the most fruitful days for sowing and planting out. |
| garden-earth-roots | moon_element | Earth | sow-root, transplant | 1 | Moon in an earth sign: said to favour roots and settling young plants into the ground. |
| garden-fire-dry | moon_element | Fire | weed, prune, harvest-root | 2 | Moon in a fire sign: a dry, barren time in garden lore, kept for weeding, pruning and harvests meant to store. |
| garden-air-flowers | moon_element | Air | harvest-above, weed | 1 | Moon in an air sign: traditionally kind to flowers, and another dry spell for weeding. |
| garden-friday-flowers | day_ruler | Venus | harvest-above | 1 | Friday, under Venus: a traditional day for gathering roses and other flowers. |

The JSON test checks: 29 entries, unique slugs, valid kinds and values, valid `garden_tasks`, no em or en dashes.

## File map

```
server/db/migrations.js            + migration 9
server/db/repos.js, server/schemas.js   + gardenPlants, gardenEntries, schemas, GARDEN_KINDS, GARDEN_TASKS; timing rule garden_tasks
server/data/timing-rules.json      + 10 garden rules (since 2)
server/services/timing.js          seed version 2, garden_tasks in rules, garden-only rules left out of making suggestions
server/services/garden.js          plants and entries CRUD, stamp, undo, jar prefill, garden suggestions
server/services/tasks.js           + harvest auto tasks; related type garden_plant
server/services/calendar.js        + garden and harvest events, per-day garden list
server/services/cabinet.js         createItem accepts garden_entry_id
server/services/journal.js         + garden_entry link type
server/services/grimoire.js        herb detail lists plants and entries
server/services/gallery.js         + garden owners (name expressions)
server/services/photos.js, purge.js   PHOTO_OWNERS; purge rules
server/routes/garden.js, server/routes/index.js
server/lib/repeat.js               RELATED_TYPES + garden_plant
server/demo/seed.js                SEED_VERSION '8'
client/src/lib/garden.js           kinds, tasks, labels, entry title, harvest part to task
client/src/screens/garden/Garden.jsx, GardenLog.jsx, PlantPage.jsx, PlantForm.jsx, EntryPage.jsx, EntryForm.jsx, MoonGarden.jsx
client/src/screens/calendar/*, grimoire/HerbPage.jsx, cabinet/ItemForm.jsx, journal/EntryForm.jsx, journal/EntryPage.jsx, settings/TimingRules.jsx, lib/tasks.js
client/src/App.jsx                 routes; /garden leaves the "being built" list
tests/server/garden*.test.js, tests/client/garden*, plantpage, plantform, gardenentry*, moongarden, e2e/garden.spec.js
```

---

### Task 1: Data layer, garden rules and seeding

**Files:** Modify `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/lib/repeat.js`, `server/services/photos.js`, `server/services/purge.js`, `server/services/timing.js` and `server/data/timing-rules.json`. Tests: `tests/server/garden-db.test.js`; extend `purge.test.js`, `timing` tests (wherever `seedTimingRules` is tested today; find it with grep) and `maintenance.test.js`.

**Interfaces produced:**
- Migration 9. The rebuilds run inside the migration's transaction, so they use the plain create, copy, drop, rename steps (no table references `tasks` or `journal_links`, which the test confirms with `PRAGMA foreign_key_list` on every table):

```sql
CREATE TABLE garden_plants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, herb_id INTEGER REFERENCES herbs(id),
  place TEXT, planted_on TEXT, expected_harvest_on TEXT, ended_on TEXT, notes TEXT, ${TS});
CREATE INDEX idx_garden_plants_herb ON garden_plants(herb_id);
CREATE TABLE garden_entries (id INTEGER PRIMARY KEY, entry_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('planted','sowed','transplanted','pruned','harvested','foraged','observed')),
  plant_id INTEGER REFERENCES garden_plants(id), herb_id INTEGER REFERENCES herbs(id), plant_name TEXT NOT NULL,
  place TEXT, amount REAL CHECK (amount IS NULL OR amount >= 0),
  unit TEXT CHECK (unit IS NULL OR unit IN ('g','kg','oz','lb','ml','l','fl oz','count')),
  weather TEXT, notes TEXT, item_id INTEGER REFERENCES items(id),
  sky_phase TEXT, sky_phase_group TEXT, sky_sign TEXT, ${TS});
CREATE INDEX idx_garden_entries_date ON garden_entries(entry_date);
CREATE INDEX idx_garden_entries_plant ON garden_entries(plant_id);
CREATE INDEX idx_garden_entries_herb ON garden_entries(herb_id);
ALTER TABLE timing_rules ADD COLUMN garden_tasks TEXT NOT NULL DEFAULT '[]';

CREATE TABLE journal_links_new (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
  link_type TEXT NOT NULL CHECK (link_type IN ('herb','recipe','batch','garden_entry')), link_id INTEGER NOT NULL, ${TS});
INSERT INTO journal_links_new SELECT id, entry_id, link_type, link_id, created_at, updated_at, deleted_at FROM journal_links;
DROP TABLE journal_links;
ALTER TABLE journal_links_new RENAME TO journal_links;
CREATE INDEX idx_journal_links_entry ON journal_links(entry_id);
CREATE INDEX idx_journal_links_target ON journal_links(link_type, link_id);
```

  `tasks` is rebuilt the same way: copy its migration 7 definition exactly (with the `spawned_id` column), change only the `related_type` CHECK to `('item','recipe','batch','herb','garden_plant')`, copy every column by name, then recreate `idx_tasks_auto_key` and `idx_tasks_due` exactly as in migration 7. Read migration 7 for the column list; do not guess it.
- **Schemas:**
  - `GARDEN_KINDS = ['planted','sowed','transplanted','pruned','harvested','foraged','observed']`.
  - `GARDEN_TASKS` as in the table above.
  - `gardenPlantSchema = { name: 'string!', herb_id: 'int', place: 'string', planted_on: 'date', expected_harvest_on: 'date', ended_on: 'date', notes: 'string' }`.
  - `gardenEntrySchema = { entry_date: 'date!', kind: { type: GARDEN_KINDS, required: true }, plant_id: 'int', herb_id: 'int', plant_name: 'string', place: 'string', amount: { type: 'number', min: 0 }, unit: UNITS, weather: 'string', notes: 'string' }`. `plant_name` is required by the service unless `plant_id` is given (see Task 2).
- **Repos:** `gardenPlants` (`orderBy: 'name COLLATE NOCASE, id'`) and `gardenEntries` (`orderBy: 'entry_date DESC, id DESC'`). Add `garden_tasks` to the `timingRules` repo columns.
- `RELATED_TYPES` in `server/lib/repeat.js` gains `garden_plant`.
- `PHOTO_OWNERS.garden_plant = 'garden_plants'` and `PHOTO_OWNERS.garden_entry = 'garden_entries'`.
- **Timing rules:**
  - `parseRule` parses `garden_tasks` too, and the rule create and update paths accept it. Validation: an array of at most 7 `GARDEN_TASKS` keys, deduplicated (400 `details.garden_tasks`).
  - `TIMING_RULES_SEED_VERSION = 2`. With no stored version, seed every entry (as now, plus `garden_tasks`). With stored version 1, seed only entries whose `since` is 2, and only when their slug isn't already there. Store 2. A deleted garden rule is a soft-deleted row, so its slug is still there and it isn't re-added; once purged, the version is already 2, so it still isn't re-added.
  - `export const isGardenOnly = rule => rule.garden_tasks.length > 0 && !rule.recipe_types.length && !rule.planets.length && !rule.elements.length`. `daySuggestions` and `startDates` skip garden-only rules.
- **Purge** (in this order, inside the existing transaction):
  - photos of old-deleted plants and entries;
  - `UPDATE garden_entries SET plant_id = NULL` where the plant is old-deleted, then delete old-deleted entries, then old-deleted plants;
  - journal links of type `garden_entry` pointing at purged entries;
  - `UPDATE garden_entries SET item_id = NULL` before items are purged;
  - `UPDATE garden_plants SET herb_id = NULL` and the same for `garden_entries` before herbs are purged (next to the existing `items` line);
  - tasks whose `related_type = 'garden_plant'` points at a purged plant get `related_type = NULL, related_id = NULL`.

- [ ] Tests first:
  - Migration 9 creates the tables and column. A database built at version 8 with tasks (including an auto task with `auto_key`), task dismissals and journal links keeps every row and id after migrating; both CHECK lists accept the new types and still reject `'nope'`; the indexes exist (`PRAGMA index_list`); `PRAGMA foreign_key_check` returns nothing.
  - The JSON: 29 entries, valid, `since` only on the ten garden rules.
  - Seeding: fresh gives 29. A version 1 database with one older rule edited and one deleted gets exactly the ten garden rules, keeps the edit, doesn't re-add the deleted one. Deleting a garden rule and seeding again adds nothing.
  - `garden_tasks` validation on create and update.
  - `daySuggestions` on a full moon Friday returns no garden-only rule; `startDates` ignores them.
  - `PHOTO_OWNERS` has both garden kinds. Purge covers each rule above.
- [ ] See them fail. Implement. Full vitest. Commit "Add the garden tables and moon gardening rules".

### Task 2: Garden services, routes, harvest tasks and calendar

**Files:** Create `server/services/garden.js` and `server/routes/garden.js`. Modify `server/routes/index.js`, `server/services/tasks.js`, `server/services/calendar.js`, `server/services/cabinet.js`, `server/services/journal.js`, `server/services/grimoire.js` and `server/services/gallery.js`. Tests: `tests/server/garden.test.js`, `garden-suggestions.test.js`; extend `auto-tasks.test.js`, `calendar.test.js`, `cabinet.test.js`, `journal.test.js`, `grimoire.test.js` and `gallery.test.js`.

**Interfaces produced:**
- **Plants** (`/api/garden/plants`):
  - `GET /?status=growing|ended|all` (default `growing`, meaning `ended_on IS NULL`). Rows: `{ id, name, herb: { id, name, live } | null, place, planted_on, expected_harvest_on, ended_on, last_entry: { id, kind, entry_date } | null, cover }`.
  - `GET /:id` returns the plant plus `garden_notes` (the herb's `garden_harvest_part`, `garden_harvest_timing`, `garden_sun`, `garden_water`, `garden_companions` as a list, or null with no live herb), `entries` (newest first, at most 50) and `photos`.
  - `POST` and `PATCH /:id`. When `herb_id` is given and `name` is empty, the name is the herb's common name. Checks: the herb is live (400 `details.herb_id`); `ended_on` and `expected_harvest_on` are not before `planted_on` (400 on that field); dates validated 1900 to 2100.
  - `DELETE /:id` soft-deletes the plant and its photos with one stamp. Its entries stay (they are her history) and show the plant as gone. `POST /:id/restore` brings it back.
- **Entries** (`/api/garden/entries`):
  - `GET /?kind&plant_id&herb_id&from&to&page` lists newest first, 30 per page: `{ entries: [{ id, entry_date, kind, title, plant: { id, name, live } | null, plant_name, place, amount, unit, weather, sky: { phase, sign }, item: { id, name, live } | null, cover }], total, page }`. `title` is `entryTitle(kind, plant_name)`, e.g. "Harvested calendula", built by one exported helper `entryTitle` in `garden.js` and mirrored in `client/src/lib/garden.js`.
  - `GET /:id` returns the full entry plus `photos`.
  - `POST` and `PATCH /:id`. With `plant_id` (a live plant, 400 `details.plant_id`), `plant_name` and `herb_id` come from the plant, and `place` defaults to the plant's place when empty. Without it, `plant_name` is required (400 `details.plant_name`) and `herb_id` is optional (a live herb). The sky stamp is `stampSky(entry_date, null, hemisphere)` from `journal.js`, storing `sky_phase`, `sky_phase_group` and `sky_sign`; it is redone when the date changes.
  - `DELETE /:id` and `POST /:id/restore` with photos sharing the stamp.
  - `GET /:id/jar` returns the jar prefill for `harvested` and `foraged` entries (400 otherwise): `{ name: plant_name, herb_id, latin_name (from the herb), source_kind: 'grown' | 'foraged', source_place: place, acquired_on: entry_date, amount, unit, form: 'fresh', plant_part (from the herb's garden_harvest_part when it is one of PLANT_PARTS) }`. Null fields are left out.
- **Cabinet:** `createItem` accepts an optional `garden_entry_id`. Inside the same transaction it checks the entry is live, harvested or foraged, and has no live jar already (409 "That harvest is already in the cabinet."), then sets the entry's `item_id`. A jar that has been deleted doesn't count as live, so she can send it again.
- **Garden suggestions** (`GET /api/garden/suggestions?from&days`, days 1 to 42, default 28, `from` defaults to local today):
  - With suggestions off, `{ off: true, tasks: [] }`.
  - Otherwise `{ off: false, tasks: [{ task, days: [{ day, score, sky: { phase, sign, ruler }, reasons: [text] }] }] }`: for each `GARDEN_TASKS` key in order, the live rules listing it are matched against each day's `skyFacts`, scored by weight, and the top 5 days kept (score, then earliest). Tasks with no matching days are left out.
  - `gardenDayTasks(db, day, settings)` returns `[{ task, reasons }]` for one day. The calendar and day page use it.
- **Harvest tasks** in `wantedAutoTasks`: for each live plant with `ended_on IS NULL` and `expected_harvest_on <= today + 7`, and no live `harvested` entry for that plant dated on or after `expected_harvest_on - 14`, want `harvest:<id>:<expected_harvest_on>` with `{ title: 'Harvest <name>', due_on: expected_harvest_on, related_type: 'garden_plant', related_id: id }`. Task `shape` resolves the related name and live state for `garden_plant` from `garden_plants.name` (add it to `RELATED_TABLES`).
- **Calendar:**
  - Events add `{ kind: 'garden', day: entry_date, title: entryTitle(...), link: /garden/entries/:id, id }` and `{ kind: 'harvest', day: expected_harvest_on, title: 'Harvest <name>', link: /garden/plants/:id, done: false, overdue: false, id }` for live growing plants. Harvest auto tasks are left out of task events (like step and expiry tasks). Order: step, task, expiry, harvest, garden, journal.
  - `calendarDays` rows add `garden: [task keys]` from `gardenDayTasks` (empty when suggestions are off).
  - `calendarDay` adds `garden: [{ task, reasons }]`.
- **Journal:** `JOURNAL_LINK_TYPES` gains `garden_entry`. Its link name is the entry title, and its live state follows the entry. Extend `LINK_TABLES` to take a name expression, not just a column, and use it for `garden_entry`.
- **Grimoire:** `getHerbDetail` adds `garden_plants: [{ id, name, place, ended_on }]` (live plants for this herb) and `garden_entries: [{ id, entry_date, kind, title }]` (live entries for this herb, newest first, at most 10).
- **Gallery:** `OWNER_INFO` takes a name SQL expression per kind. `garden_plant`: `o.name`, link `/garden/plants/:id`. `garden_entry`: the same title as `entryTitle`, written in SQL (`upper(substr(o.kind,1,1)) || substr(o.kind,2) || ' ' || o.plant_name`), link `/garden/entries/:id`.

- [ ] Tests first:
  - Plants: CRUD, the herb name default, date order checks, the status filter, last entry, garden notes, delete and undo (entries stay and show the plant as gone).
  - Entries: CRUD from a plant and from free text, the place default, the stamp with TZ pinned and re-stamping on a date change, filters and paging, delete and undo.
  - The jar prefill for harvested and foraged entries, 400 for others. `createItem` with `garden_entry_id` links it, a second time gives 409, after the jar is deleted it works again.
  - Suggestions: a known 28-day window with TZ pinned gives the expected top day for `harvest-above` (a full moon); off gives `{ off: true }`; `days` bounds.
  - Harvest tasks: made at 7 days out and not at 8; a new expected date swaps the task; ending or deleting the plant removes it and undo brings it back; a harvested entry within the window stops it; a dismissed harvest task stays gone.
  - Calendar: garden and harvest events, no duplicate harvest task event, the per-day `garden` list, and the day's `garden` suggestions.
  - Journal: a `garden_entry` link saves, names itself and goes muted when the entry is deleted.
  - Grimoire herb detail lists plants and entries. Gallery lists garden photos with the right names and links.
- [ ] See them fail. Implement. Full vitest. Commit "Add the garden log, moon gardening days and harvest reminders to the API".

### Task 3: Garden page, plants and moon garden

**Files:** Create `client/src/lib/garden.js`, `client/src/screens/garden/Garden.jsx` and `MoonGarden.jsx`. Modify `App.jsx` and CSS. Tests: `tests/client/garden.test.jsx` and `moongarden.test.jsx`.

- **`lib/garden.js`:** `GARDEN_KINDS` with labels (Planted, Sowed, Transplanted, Pruned, Harvested, Foraged, Observed), `GARDEN_TASKS` with labels, `entryTitle(kind, plantName)`, `KIND_ICON` mapping planted and sowed to lucide `Sprout`, transplanted to `Shovel`, pruned to `Scissors`, harvested to `ShoppingBasket`, foraged to `Leaf` and observed to `Eye`, and `harvestTaskFor(part)` returning `harvest-root` for `root` and `harvest-above` otherwise.
- **`/garden`:**
  - `PageHeader` "Garden log" with the subtitle "What grows, what you gathered, and when".
  - Actions: `WaxSealLink` "Log something" → `/garden/entries/new`, a link "Add a plant" → `/garden/plants/new`, and a link "The whole log" → `/garden/log`.
  - Tabs Growing and Ended (`?status=`).
  - Plant cards: the cover, name (linking to the plant), herb name when it differs, place, "Planted Oct 1", "Harvest around Nov 2" (oxblood badge "Harvest due" within 7 days or past), and the last entry ("Pruned, Oct 8").
  - Empty states: "Nothing planted yet. Add the first plant." and "No ended plants."
  - Below the plants, the `MoonGarden` card.
- **`MoonGarden`** (`GET /api/garden/suggestions`):
  - `ParchmentCard` "By the moon, the next four weeks" with the note "Folk tradition, for interest. Your soil and weather know best."
  - One row per task: the task label, then up to 5 day chips ("Fri Oct 17, full moon in Aries"), each linking to `/calendar/<day>`. A chip's `title` holds the reasons.
  - When `off`, a short line: "Moon suggestions are turned off in Settings." with a link.
  - A failed load shows an error with Try again.

- [ ] Tests first: cards and badges with the real list shape, tabs and the URL, empty states, the moon garden rows, chips and links, the off state, the error and Try again.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the Garden page and moon gardening days".

### Task 4: Plant page and plant form

**Files:** Create `client/src/screens/garden/PlantPage.jsx` and `PlantForm.jsx`. Modify `App.jsx`, `client/src/lib/tasks.js` (route and area for `garden_plant`) and `client/src/screens/grimoire/HerbPage.jsx`. Tests: `tests/client/plantpage.test.jsx` and `plantform.test.jsx`; extend `herbpage.test.jsx` and `todo.test.jsx`.

- **`/garden/plants/:id`** (keyed):
  - Header: the name, with a subtitle of the place and "Planted Oct 1". A link to the herb page when there's a live herb.
  - "In the garden" card with the herb's garden notes (Part harvested, Harvest timing, Sun, Water, Grows well with), or "No grimoire notes for this plant." with no herb.
  - "Good days to harvest" card: the top days from `/api/garden/suggestions` for `harvestTaskFor(garden_harvest_part)`, labelled as folk tradition, hidden when suggestions are off.
  - The plant's entries as a short log (date, kind icon and label, amount, link) with "Log something" → `/garden/entries/new?plant=<id>`.
  - Photos use `PhotoGallery ownerType="garden_plant"`.
  - Actions: Edit, "Mark as ended" (a dialog with a date, default today, that PATCHes `ended_on`; "Growing again" clears it), and Delete with undo. After a delete it goes to `/garden`.
- **`/garden/plants/new`** (`?herb=`) and **`/garden/plants/:id/edit`**, both keyed: Herb (optional select of live herbs; picking one fills an empty name), Name (required), Place (with a `datalist` of places already used), Planted, Expected harvest, Ended (edit only), Notes. Save guard, leave guard, inline errors, toast "Saved", then the plant page.
- **Grimoire herb page:** the "In the garden" card adds "Growing here" (her live plants for this herb, linked) and "Garden log" (the last 10 entries, linked), and a link "Plant this" → `/garden/plants/new?herb=<id>`. The card shows when there are notes, plants or entries.
- **To-do:** `relatedLink` maps `garden_plant` to `/garden/plants`, and the area list gains `{ key: 'garden_plant', label: 'Garden' }` (check how areas are filtered on the server and add `garden_plant` there too if needed).

- [ ] Tests first: plant page fields, notes and the no-herb state, the harvest days card and the off state, the entries log, mark as ended and growing again, delete with undo; the form's herb fill, required name, date errors, double-submit guard, no leave prompt after a save; the herb page's garden lists and link; a harvest task links to the plant.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add garden plants".

### Task 5: Entries, the log and sending to the cabinet

**Files:** Create `client/src/screens/garden/GardenLog.jsx`, `EntryPage.jsx` and `EntryForm.jsx` (in `screens/garden/`; name the components `GardenEntryPage` and `GardenEntryForm` so they don't clash with the journal's). Modify `App.jsx`, `client/src/screens/cabinet/ItemForm.jsx`, `client/src/screens/journal/EntryForm.jsx` and `EntryPage.jsx`. Tests: `tests/client/gardenlog.test.jsx`, `gardenentry.test.jsx` and `gardenentryform.test.jsx`; extend `itemform.test.jsx`, `entryform.test.jsx` and `entrypage.test.jsx`.

- **`/garden/log`:** `PageHeader` "The whole log". Filters Kind and Plant (selects) and From and To, kept in the URL. Rows: date, kind icon and label, the title linking to the entry, place, amount, weather, the sky ("Waxing gibbous in Taurus") and the cover. "More entries" pages. Empty states: "The log is empty. Log the first thing you did." and "No entries match."
- **`/garden/entries/:id`** (keyed):
  - Header: the title, with a subtitle of the date. Lines for the plant (linked; muted "(no longer here)" when gone), place, amount, weather and "The moon that day: waxing gibbous in Taurus".
  - Foraging entries show a standing note box (not the oxblood safety box): "Only gather a plant you can identify with complete certainty, and only where foraging is allowed."
  - Harvested and foraged entries: with a live jar, "In the cabinet: <jar link>"; otherwise a button "Send to the cabinet" → `/cabinet/items/new?garden_entry=<id>`.
  - Photos use `PhotoGallery ownerType="garden_entry"`. Edit, and Delete with undo (back to `/garden/log`).
- **`/garden/entries/new`** (`?plant=`, `?date=`, `?kind=`) and **`/garden/entries/:id/edit`**, both keyed:
  - Fields: Date (default today), What you did (kind, required), Plant (a select of growing plants plus "Something else"; "Something else" shows Name and an optional grimoire Herb select), Place (defaults from the plant when left empty), Amount and Unit, Weather, Notes.
  - Picking Foraged shows the same foraging note above the fields.
  - Save guard, leave guard, inline errors (including `plant_name` and `plant_id`), toast "Saved", then the entry page.
- **Item form:** with `?garden_entry=<id>`, it loads `/api/garden/entries/<id>/jar`, fills the form from it (on an herb shelf when there's an herb, as the `?herb=` path does), shows "From your garden log" above the form, and sends `garden_entry_id` with the save. A 409 shows as a form error. After the save it goes to the new jar as usual. A failed prefill load shows an error with Try again.
- **Journal:** the linked records type select gains "Garden entry" (records from `/api/garden/entries`, named by title). The entry page links them to `/garden/entries/:id`.

- [ ] Tests first: the log rows, filters in the URL and the API, paging, empty states; the entry page lines, the foraging note, both cabinet states and the gone plant; the form with a plant and with "Something else", the prefills, the foraging note, inline errors, the double-submit guard, no leave prompt after a save; the item form prefill, `garden_entry_id` in the body and the 409; the journal's garden entry link.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add garden entries and send harvests to the cabinet".

### Task 6: Calendar, day page and timing rules screen

**Files:** Modify `client/src/screens/calendar/*` (Calendar filters, MonthView, WeekView, AgendaView, EventList, DayPage), `client/src/lib/calendar.js` and `client/src/screens/settings/TimingRules.jsx`. Tests: extend `calendar.test.jsx`, `daypage.test.jsx`, `calendarlib.test.jsx` and `timingrules.test.jsx`.

- **Calendar:**
  - Filters gain "Garden log" (garden events) and "Harvests" (harvest events), and a "Garden days" toggle for the marks.
  - Garden and harvest events show in the month, week and agenda views with their own small icon.
  - A month cell with garden tasks shows a small sprout mark whose accessible label lists them ("Good for: Gather leaves and flowers, Weed and tend").
- **Day page:**
  - An "In the garden" card under the suggestions lists each garden task and its reasons, with "Folk tradition" as its note. It's hidden when the list is empty.
  - The day's garden and harvest events list with the others.
  - A button "Log garden work" → `/garden/entries/new?date=<day>`.
- **Timing rules screen:** the rule dialog gains a "Garden work" set of checkboxes (the seven tasks). The rules list shows a "Garden" badge on rules with garden tasks. A "Making" and "Garden" filter above the list (all by default).

- [ ] Tests first: the new filters and event kinds in each view, the sprout mark and its label, the day page card, events and button; the rule dialog's checkboxes in the body, the badge and the filter.
- [ ] See them fail. Implement. Full vitest and build. Commit "Show the garden on the calendar and in the timing rules".

### Task 7: Demo, browser walk-through, docs and ship

- [ ] **Demo:** `SEED_VERSION` '8'. Two plants and three entries:
  - Calendula in "the raised bed", planted 6 weeks ago, expected harvest in 5 days (so a harvest task shows);
  - Lavender "by the front path", planted last spring;
  - "Sowed calendula" 6 weeks ago, "Harvested lavender" 10 days ago (40 g, sent to the cabinet as a jar of dried flowers), and "Foraged elderflower" 3 weeks ago at "the lane hedge".

  Reset clears them (photos and links first, and the demo jar's `garden_entry` link). v7 folders get them once. Tests mirror the earlier demo tests.
- [ ] **`e2e/garden.spec.js`** (port 4203, unique names):
  1. Add a plant from a grimoire herb; the name fills in, and the plant page shows the herb's garden notes.
  2. Log a harvest for it; the entry page shows the moon. Send it to the cabinet; the item form is prefilled, saving makes the jar, and the entry now links to it.
  3. Log a foraging entry with "Something else"; the foraging note shows.
  4. Set a plant's expected harvest to 3 days from now; a "Harvest" task appears on the to-do list and the harvest shows on the calendar.
  5. The Garden page's moon card shows day chips, and the calendar day page shows "In the garden".

  Take screenshots `test-results/garden.png` and `test-results/garden-entry.png`.
- [ ] **README:** change the stage line to Stage 7. Add a Garden log bullet, and add `![The garden log](docs/screenshots/garden.jpg)` from a temporary stocked demo (`C:\ap-shot-7`, port 4205), as a JPEG under 400 KB. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence (headless, `C:\ap-evidence-7`), pushed to `evidence/stage-7/`, with no duplicate screenshots. Then the PR, and greploop to 5/5 with zero open threads.
- [ ] **(ask)** Merge. Then back up, `npm run stop`, pull, `npm run setup`, start the task, and check that `/api/garden/plants` answers and `/api/timing-rules` lists 29 rules.
