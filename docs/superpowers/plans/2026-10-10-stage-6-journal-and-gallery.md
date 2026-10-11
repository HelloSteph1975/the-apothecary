# The Apothecary, Stage 6: Journal and Photo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Journal drawer works.

- **Entry types.** She manages her own entry types. There are 8 starters: ritual, moon observance, festival, dream, garden, foraging walk, reflection and note.
- **Entries.** Each entry has:
  - a title, a date and time, a type and the body text;
  - an optional mood;
  - related herbs, recipes and batches;
  - tags and photos.

  The moon phase, moon sign, day ruler and festival are stamped automatically from the entry's date and time.
- **Views.** A list view, plus views by type, by tag and by moon phase, and search across titles and text. Entries also appear on the calendar, and the day page can add one.
- **Gallery.** A Photos view in the Journal drawer shows every photo in the app. It can be filtered by kind of record and by date, and each photo links back to its record.

**Architecture:**

- Migration 8 adds `journal_types`, `journal_entries`, `journal_links` and `journal_tags`.
- Starter types are seeded once from `server/data/journal-types.json`, like the recipe types.
- `server/services/journal.js` handles:
  - create and update, with links and tags replaced in one transaction;
  - the sky stamp, using `skyFacts`, plus the moon sign at the entry's exact time;
  - list views, search and types.
- `server/services/gallery.js` lists photos across all owners, with the owner's name and link.
- The calendar adds a `journal` event kind, and the day page gets an "Add a journal entry" button.
- The client adds `/journal` (list and views), `/journal/new`, `/journal/:id`, `/journal/:id/edit`, `/journal/types` and `/journal/photos`.

**Tech Stack:** Same as Stages 1 to 5.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, sections "Journal", "Photos", "Calendar".

**Later stages:** Links to garden entries come with Stage 7, which adds `garden_entry` to the allowed link types. Small preview copies of photos are left out: the gallery loads the stored photos lazily, and they are already resized to 1600 px on upload.

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 8, appended to `server/db/migrations.js`. Never edit migrations 1 to 7.
- Days are local days. Tests that depend on days or times pin `process.env.TZ`, or use the app's local-today helper. Never hard-code "today".
- Route handlers read `ctx.db` inside each request.
- Soft deletes and undo work as before. Photos cascade with the delete stamp (`PHOTO_OWNERS.journal = 'journal_entries'`).
- The journal is hers: plain, private and kept on her computer only. The sky stamp is labelled "The sky that day" and uses no folk suggestions.
- Plain, warm wording, no em dashes.
- Use the shared components and hooks:
  - `Field`, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`;
  - `useDeleteWithUndo` (with `onUndo`), `useLeaveGuard` (and call `markSaved` before navigating after a save);
  - keyed route wrappers, a save guard, and an error with Try again;
  - dialogs that stay mounted, with inline `role="alert"` errors.
- Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA.
- Branch `feat/stage-6-journal` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-6`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Starter journal types (`server/data/journal-types.json`)

| slug | name | description | icon |
|---|---|---|---|
| ritual | Ritual | A working, a spell or a small ceremony. | sparkles |
| moon-observance | Moon observance | Watching or marking the moon. | moon |
| festival | Festival | A turn of the wheel and how you kept it. | sun |
| dream | Dream | What you dreamed and what it stirred. | cloud |
| garden | Garden | Notes from the garden. | sprout |
| foraging-walk | Foraging walk | What you found and where. | leaf |
| reflection | Reflection | Thoughts worth keeping. | feather |
| note | Note | Anything else. | pen |

`JOURNAL_ICONS = ['sparkles','moon','sun','cloud','sprout','leaf','feather','pen','flame','flower','star','book']`, mapped on the client to lucide icons: `Sparkles, Moon, Sun, Cloud, Sprout, Leaf, Feather, PenLine, Flame, Flower2, Star, BookOpen`.

`MOODS = ['joyful','calm','grateful','hopeful','tired','unsettled','sad','curious']` is optional. The labels are capitalised words with no emoji.

## File map

```
server/db/migrations.js            + migration 8
server/db/repos.js, server/schemas.js   + journalTypes, journalEntries, entry schemas, JOURNAL_ICONS, MOODS, JOURNAL_LINK_TYPES
server/data/journal-types.json     8 starter types
server/services/journalTypes.js    seed once, list with counts, delete with move (reuse groups.js), reorder
server/services/journal.js         entries CRUD with links/tags/sky stamp, views, search, tag list
server/services/gallery.js         photos across owners with owner name and link
server/services/content.js         + seed journal types step
server/services/calendar.js        + journal events
server/services/photos.js, purge.js   PHOTO_OWNERS.journal; purge entries, links, tags, types
server/routes/journal.js, server/routes/gallery.js
server/demo/seed.js                SEED_VERSION '7', three entries
client/src/lib/journal.jsx         icons, moods, sky stamp text
client/src/screens/journal/Journal.jsx, EntryPage.jsx, EntryForm.jsx, JournalTypes.jsx, Gallery.jsx
client/src/screens/calendar/*      journal kind + filter; DayPage "Add a journal entry"
client/src/App.jsx                 routes; /journal leaves the "being built" list
tests/server/journal*.test.js, gallery.test.js, tests/client/journal*, gallery, e2e/journal.spec.js
```

---

### Task 1: Data layer, starter types and seeding

**Files:** Modify `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/services/photos.js`, `server/services/purge.js` and `server/services/content.js`. Create `server/data/journal-types.json` and `server/services/journalTypes.js` (the seed part only). Tests: `tests/server/journal-db.test.js`; extend `purge.test.js` and `maintenance.test.js`.

**Interfaces produced:**
- Migration 8:

```sql
CREATE TABLE journal_types (id INTEGER PRIMARY KEY, slug TEXT, name TEXT NOT NULL, description TEXT, icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0, is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE UNIQUE INDEX idx_journal_types_slug ON journal_types(slug) WHERE slug IS NOT NULL;
CREATE TABLE journal_entries (id INTEGER PRIMARY KEY, type_id INTEGER NOT NULL REFERENCES journal_types(id),
  title TEXT NOT NULL, entry_date TEXT NOT NULL, entry_time TEXT, body TEXT, mood TEXT,
  sky_phase TEXT, sky_phase_group TEXT, sky_sign TEXT, sky_ruler TEXT, sky_festival TEXT, ${TS});
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_type ON journal_entries(type_id);
CREATE TABLE journal_links (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
  link_type TEXT NOT NULL CHECK (link_type IN ('herb','recipe','batch')), link_id INTEGER NOT NULL, ${TS});
CREATE INDEX idx_journal_links_entry ON journal_links(entry_id);
CREATE INDEX idx_journal_links_target ON journal_links(link_type, link_id);
CREATE TABLE journal_tags (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
  tag TEXT NOT NULL, ${TS});
CREATE INDEX idx_journal_tags_entry ON journal_tags(entry_id);
CREATE INDEX idx_journal_tags_tag ON journal_tags(tag);
```

  Stage 7 widens `link_type` in its own migration by rebuilding the table, and its plan will say so. `entry_time` is `HH:MM` local and optional. Tags are stored trimmed and lowercased, up to 40 characters each.
- **Schemas:** `JOURNAL_ICONS`, `MOODS` and `JOURNAL_LINK_TYPES = ['herb','recipe','batch']`.
  - `journalTypeSchema = { name: 'string!', description: 'string', icon: JOURNAL_ICONS, sort_order: { type: 'int', nullable: false } }`.
  - `journalEntrySchema = { type_id: 'int!', title: 'string!', entry_date: 'date!', entry_time: 'string', body: 'string', mood: MOODS }`.
  - The service validates `entry_time` against `^([01]\d|2[0-3]):[0-5]\d$`.
- **Repos:** `journalTypes` (`orderBy: 'sort_order, id'`), `journalEntries` (`orderBy: 'entry_date DESC, entry_time DESC, id DESC'`), `journalLinks` and `journalTags`.
- `PHOTO_OWNERS.journal = 'journal_entries'`.
- **Seed:** `seedJournalTypes(db)` uses the hidden settings key `journal_types_seed_version` and the same pattern as `seedRecipeTypes`. It is added as the fifth `contentMaintenance` step.
- **Purge:**
  - photos of old-deleted entries;
  - links and tags of old-deleted entries, or ones that are themselves old-deleted;
  - old-deleted entries;
  - old-deleted types that no entry row references;
  - links pointing at purged herbs, recipes or batches are deleted (a link without its target means nothing).

- [ ] Tests first:
  - Migration 8 creates the tables.
  - The seed adds 8 types once, keeps her edits, and doesn't re-add a deleted type.
  - The JSON is valid: 8 entries, unique slugs, valid icons, no em or en dashes.
  - `PHOTO_OWNERS.journal` exists.
  - The maintenance step runs.
  - Purge covers each rule.
- [ ] See them fail. Implement. Full vitest. Commit "Add the journal tables and starter entry types".

### Task 2: Journal services and routes

**Files:** Create `server/services/journal.js`, `server/routes/journal.js`, `server/services/gallery.js` and `server/routes/gallery.js`. Extend `server/services/journalTypes.js`, `server/routes/index.js` and `server/services/calendar.js`. Tests: `tests/server/journal.test.js`, `journal-types.test.js` and `gallery.test.js`; extend `calendar.test.js`.

**Interfaces produced:**
- **Sky stamp** (`stampSky(entry_date, entry_time, hemisphere)`):
  - `skyFacts(entry_date)` gives the phase name and group, the ruler and the festival.
  - The sign comes from `moonSignAt` at the entry's local date and time (noon when there's no time).
  - It's stored on create, and again on update whenever the date or time changes.
- **Types** (`/api/journal-types`):
  - list with `entry_count`;
  - POST and PATCH with names unique among live types (400 `details.name`);
  - DELETE with `move_to` (409 `details.entries` when entries use the type), reusing `server/services/groups.js`;
  - restore, which rechecks the name;
  - `PUT /order`.
- **Entries** (`/api/journal`):
  - `GET /?view=list|type|tag|moon&q&type_id&tag&phase_group&from&to&page`:
    - `list` (default) is newest first, 30 per page, with `{ entries, total, page }`.
    - `type` groups the counts by type, plus entries for the chosen `type_id`.
    - `tag` returns all tags with counts, plus entries for the chosen `tag`.
    - `moon` groups by phase group (new, waxing, full, waning), with entries for the chosen `phase_group`.
    - `q` searches the title, body and tags, case-insensitively, with LIKE escaping.
    - Rows are `{ id, title, entry_date, entry_time, type: { id, name, icon }, mood, excerpt (first 160 chars of body), tags[], sky: { phase, sign, ruler, festival }, cover }`.
  - `GET /:id` returns the full entry plus `links: [{ type, id, name, live }]`, `tags` and `photos`.
  - `POST` and `PATCH /:id` take the entry fields plus `links: [{ type, id }]` (at most 30, each a live target, 400 `details['links.N']`) and `tags: [string]` (at most 20, deduplicated). Both replace the old lists in one transaction.
  - `DELETE /:id` is a soft delete with links, tags and photos sharing the stamp. `POST /:id/restore` brings them back.
  - `GET /tags` lists live tags with counts, for the tag picker.
- **Gallery:**
  - `GET /api/gallery?kind&from&to&page` lists live photos whose owner is also live. They're ordered by the photo's created date, newest first, 48 per page.
  - `kind` is one of the `PHOTO_OWNERS` keys. `from` and `to` filter the photo's created date (local days, validated like the sky routes).
  - Rows are `{ id, filename, caption, created_at, owner: { kind, id, name, link } }`. The name comes from each owner table's name or title column, with one helper mapping `kind` to table, name column and link pattern.
  - `GET /api/gallery/kinds` returns the kinds that have photos, with their counts.
- **Calendar:** events add `{ kind: 'journal', day: entry_date, title, link: /journal/:id, id }`.

- [ ] Tests first:
  - The stamp for a known date and time with TZ pinned, including the sign change inside a day.
  - Create and update with links and tags, and re-stamping when the date changes.
  - The checks: link targets, tags, time format and the type.
  - Each view and its grouping, search (including LIKE escaping) and paging.
  - Delete and undo.
  - Types: CRUD, delete with move, reorder and the restore name check.
  - Gallery: kinds, filters, paging, owner names and links, deleted owners left out.
  - Calendar journal events.
- [ ] See them fail. Implement. Full vitest. Commit "Add journal entries, types and the photo gallery to the API".

### Task 3: Journal list, views and entry types screen

**Files:** Create `client/src/lib/journal.jsx`, `client/src/screens/journal/Journal.jsx` and `JournalTypes.jsx`. Modify `App.jsx` and CSS. Tests: `tests/client/journal.test.jsx` and `journaltypes.test.jsx`. Update the "being built" check in `tests/client/cabinet.test.jsx` to use `/labels`.

- **`lib/journal.jsx`:** `TypeIcon`, `MOODS` options and `skyStampText(sky)` ("Waxing gibbous in Taurus, Friday under Venus", plus ", Samhain" when there's a festival).
- **`/journal`:**
  - `PageHeader` "Journal" with the subtitle "Rituals, moons, dreams and notes".
  - Actions: `WaxSealLink` "Write an entry" → `/journal/new`, plus links "Photos" → `/journal/photos` and "Entry types" → `/journal/types`.
  - Tabs All, By type, By tag and By moon, kept in the URL (`?view=`), and a debounced search.
  - **All:** cards with the icon and type name, the title linking to the entry, the date and time ("Oct 10, 9:30 PM"), the sky stamp text, the excerpt, tag chips and the cover. A "More entries" button loads the next page.
  - **By type:** type chips with counts, then that type's entries.
  - **By tag:** a tag cloud as plain chips with counts, then that tag's entries.
  - **By moon:** four groups (New moon, Waxing, Full moon, Waning), each showing its count and entries.
  - Empty states: "Your journal is empty. Write the first entry." and "No entries match."
- **`/journal/types`** works like the recipe types manager: a list in order with icon and count, Add and Edit in a dialog with name, description and icon picker, Move up and Move down, and Delete. Delete with entries asks where to move them. Undo is available.

- [ ] Tests first:
  - Cards and texts, tabs and the URL, search sent to the API, paging.
  - Each view's grouping, and the empty states.
  - The types manager: add, edit, reorder, delete with move, and the duplicate-name error.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the Journal list and entry types".

### Task 4: Entry page and entry form

**Files:** Create `client/src/screens/journal/EntryPage.jsx` and `EntryForm.jsx`. Modify `App.jsx`, `client/src/screens/calendar/DayPage.jsx` and the calendar filters. Tests: `tests/client/entrypage.test.jsx` and `entryform.test.jsx`; extend `daypage.test.jsx` and `calendar.test.jsx`.

- **`/journal/:id`** (keyed):
  - The header shows the title, with a subtitle of the type, date and time.
  - A "The sky that day" line shows the sky stamp text.
  - The body is shown with its line breaks kept, plus the mood when set and the tags as links to `/journal?view=tag&tag=`.
  - A "Linked" list shows herbs, recipes and batches, each with its link. A record that's gone is muted with "(no longer here)".
  - Photos use `PhotoGallery ownerType="journal"`.
  - Actions are Edit and Delete, with undo returning to the entry. After a delete it goes to `/journal`.
- **`/journal/new`** (`?date=`, `?type=`, `?herb=`, `?batch=`) and **`/journal/:id/edit`**, both keyed:
  - Fields: Title (required), Type (required, live types), Date (default today), Time (optional), Mood (optional select), Body (a large textarea), Tags (a text field with chips: Enter or comma adds a tag, each chip has a remove button, and existing tags are suggested through a `datalist`), and Linked records.
  - **Linked records:** a type select (Herb, Recipe or Batch), then a record select, then "Add". Each link shows as a removable chip.
  - Saving uses a save guard and a leave guard (`markSaved` before navigating), shows inline errors (including `links.N`), goes to the entry page and shows the toast "Saved".
  - A failed load of types or records shows an error with Try again.
- **Calendar:**
  - A "Journal entries" filter, and journal events in the month, week and agenda views.
  - The day page lists that day's entries.
  - The day page has an "Add a journal entry" button → `/journal/new?date=<day>`.

- [ ] Tests first:
  - Entry page fields, the sky line, links (including gone ones), tag links, and delete with undo.
  - Form: required fields, adding and removing tags (Enter, comma and the remove button), adding and removing links, the prefills, the body shape, inline errors, the double-submit guard, and no leave prompt after a save.
  - Calendar: the journal filter and events, and the day page button and list.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add journal entries and their form".

### Task 5: Photo gallery

**Files:** Create `client/src/screens/journal/Gallery.jsx`. Modify `App.jsx` and CSS. Test: `tests/client/gallery.test.jsx`.

- **`/journal/photos`:**
  - `PageHeader` "Photos" with the subtitle "Everything you've photographed".
  - Filters: Kind (a select of the kinds that have photos, with counts, e.g. "Jars (12)") and From and To dates. All three are kept in the URL.
  - **The grid:**
    - square tiles with `object-fit: cover`, lazy-loaded images, the caption as `alt` (or "<owner name> photo"), and the caption shown under each tile;
    - each tile is a link to the photo's record, with the owner's kind and name as small text.
  - "Load more" pages through results.
  - Opening a tile with Enter, or clicking it, shows a larger view in a dialog. The dialog has the full image, the caption, the owner link, the date, and Previous and Next buttons. Arrow keys move inside the dialog, and Escape closes it, returning focus to the tile.
  - Empty states: "No photos yet. Add them to jars, herbs, recipes, batches, tasks or journal entries." and "No photos match."

- [ ] Tests first:
  - Tiles and their links, alt text and captions.
  - Filters reaching the URL and the API, kind counts, Load more.
  - The dialog: open, Previous and Next, arrow keys, Escape with focus returning.
  - The empty states.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the photo gallery".

### Task 6: Demo, browser walk-through, docs and ship

- [ ] **Demo:** `SEED_VERSION` '7'. Three entries:
  - "Full moon water", a moon observance on the last full moon, tagged moon water, linked to the Calendula salve recipe;
  - "Dreamt of a lavender field", a dream;
  - "First calendula harvest", a garden entry linked to the Calendula herb.

  Reset clears them (links, tags and photos first). v6 folders get them once. Tests mirror the earlier demo tests.
- [ ] **`e2e/journal.spec.js`** (port 4203, unique names):
  1. Write an entry with two tags and a linked herb. The page shows the sky line and the tags. Search finds it.
  2. The By tag view lists it, and the By moon view puts it under the right group.
  3. Add an entry type, then delete it while it has an entry, moving the entry to Note.
  4. On the calendar, the journal entry shows on its day, and the day page's "Add a journal entry" prefills the date.
  5. Upload a photo to the entry. The gallery shows it with the entry's name, and opening it shows the dialog.

  Take screenshots `test-results/journal.png` and `test-results/gallery.png`.
- [ ] **README:** change the stage line to Stage 6. Add a Journal bullet and a Photos bullet, and add `![The journal](docs/screenshots/journal.jpg)` from a temporary stocked demo (`C:\ap-shot-6`, port 4205), as a JPEG under 400 KB. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence (headless, `C:\ap-evidence-6`), pushed to `evidence/stage-6/`, with no duplicate screenshots. Then the PR, and greploop to 5/5 with zero open threads.
- [ ] **(ask)** Merge. Then back up, `npm run stop`, pull, `npm run setup`, start the task, and check that `/api/journal-types` (8) and `/api/gallery` answer.
