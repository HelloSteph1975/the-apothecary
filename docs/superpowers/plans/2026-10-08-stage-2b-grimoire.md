# The Apothecary, Stage 2B: Grimoire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Grimoire drawer works: one page per herb with practical information, safety cautions at the top, traditional correspondences, garden notes, sources and photos; 30 starter herbs written originally and safety-checked; herbs link to jars in the Herb cabinet; Today shows an herb of the day.

**Architecture:** A `herbs` table (scalar fields as columns, short lists as JSON text) and a `herb_sources` table. Starter content lives as one JSON file per herb in `server/data/grimoire/`, validated by a test, and is seeded once into the database (a settings marker records the seed version), so later edits are never overwritten. `items.herb_id` (already a column since migration 2) links jars to herbs; the service validates it. Server logic in `server/services/grimoire.js`; client adds Grimoire list, herb page and herb form, a herb picker on the item form, and a Today card.

**Tech Stack:** Same as Stages 1 and 2A.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md` (sections "Grimoire", "Correspondences", "Garden log" garden notes, "Today"). Stage 2B decisions approved in chat on 2026-10-08:
1. Herb pages with names, Latin name, family, parts used, traditional uses, preparations, taste and energetics, safety cautions (oxblood box at the top), correspondences, garden notes, sources, photos. Full add, edit, delete.
2. 30 starter herbs written originally, seeded once.
3. Jars link to grimoire herbs: herb pages list jars; the item form has a "Grimoire herb" picker; on upgrade, existing herb items whose name or Latin name matches are linked automatically.
4. Sources limited to ones free to use and cite: NCCIH herb fact sheets (US government) for uses and safety; Culpeper's *The English Physitian* (1652) and Grieve's *A Modern Herbal* (1931) for tradition and correspondences; AHPA safety class cited by class number only. Other reputable sources (for example MedlinePlus, NIH Office of Dietary Supplements, USDA PLANTS, university extension services) may be cited for facts, never copied.
5. Content check, option A: researchers write the entries; a separate verifier checks every caution against its cited sources; Stephanie spot-checks a few before merge.

## Global Constraints

- Node 24+. App port 4197 (the installed app is running there; never touch it), demo 4201, browser tests 4203. Tests use temp folders only. Never touch `Documents\The Apothecary Data`.
- Database changes only through migration 3 appended to `server/db/migrations.js`.
- Soft deletes and undo as in Stage 2A (`crudRouter`, `restore` URLs, cascade photos with the delete stamp).
- **Content rules (starter herbs):**
  - Written in our own words. No sentence or phrase longer than 10 words copied from any source. Paraphrase facts; never reproduce a source's structure or lists.
  - Uses are framed as tradition ("traditionally used for", "in folk practice"), never as cures or medical claims. No dosages.
  - Every herb has at least 2 sources, at least one of them covering safety, each with title, author or organization, year, and URL when one exists. Sources must be real and the URL must load; never invent a source.
  - Cautions cover: pregnancy and nursing, medication interactions, conditions, maximum duration, and topical or skin sensitivity where relevant. When a source says safety is unknown, say so ("Not enough is known about use during pregnancy; avoid.").
  - `ahpa_class` is one of `1`, `2a`, `2b`, `2c`, `2d`, `3`, `4`, or null when unverifiable. Never guess it.
  - Correspondences come from Culpeper (planet) and widely recorded folk tradition; mark them as tradition. Planets: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn. Elements: Fire, Water, Air, Earth.
- Plain, warm wording, no em dashes. UI uses the shared `Field` components, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`, `useDeleteWithUndo`, `useLeaveGuard`. Focus via `outline` with `--focus-color`. WCAG AA.
- Not medical advice: the Grimoire page, every herb page and the README say the grimoire is for learning and isn't medical advice.
- Branch `feat/stage-2b-grimoire` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-2b`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## The starter herbs

| slug | common name | Latin name |
|---|---|---|
| chamomile | Chamomile | Matricaria chamomilla |
| lavender | Lavender | Lavandula angustifolia |
| calendula | Calendula | Calendula officinalis |
| peppermint | Peppermint | Mentha × piperita |
| lemon-balm | Lemon balm | Melissa officinalis |
| elderberry | Elderberry | Sambucus nigra (fruit) |
| elderflower | Elderflower | Sambucus nigra (flower) |
| echinacea | Echinacea | Echinacea purpurea |
| ginger | Ginger | Zingiber officinale |
| garlic | Garlic | Allium sativum |
| rosemary | Rosemary | Salvia rosmarinus |
| thyme | Thyme | Thymus vulgaris |
| sage | Sage | Salvia officinalis |
| nettle | Nettle | Urtica dioica |
| holy-basil | Holy basil (tulsi) | Ocimum tenuiflorum |
| hibiscus | Hibiscus | Hibiscus sabdariffa |
| rose | Rose | Rosa spp. (R. gallica, R. damascena) |
| yarrow | Yarrow | Achillea millefolium |
| plantain | Plantain | Plantago major |
| dandelion | Dandelion | Taraxacum officinale |
| burdock | Burdock | Arctium lappa |
| marshmallow-root | Marshmallow root | Althaea officinalis |
| licorice-root | Licorice root | Glycyrrhiza glabra |
| cinnamon | Cinnamon | Cinnamomum verum |
| turmeric | Turmeric | Curcuma longa |
| fennel | Fennel | Foeniculum vulgare |
| oat-straw | Oat straw | Avena sativa |
| raspberry-leaf | Raspberry leaf | Rubus idaeus |
| mullein | Mullein | Verbascum thapsus |
| mugwort | Mugwort | Artemisia vulgaris |

If an herb can't be documented responsibly from free sources, the researcher stops and reports it; the controller swaps it for another common herb.

## Starter entry format (`server/data/grimoire/<slug>.json`)

```json
{
  "slug": "calendula",
  "common_name": "Calendula",
  "other_names": ["Pot marigold"],
  "latin_name": "Calendula officinalis",
  "family": "Asteraceae",
  "parts_used": ["flower"],
  "uses": "Two to five plain sentences on traditional and folk uses, framed as tradition.",
  "preparations": ["infused oil", "salve", "tea blend"],
  "taste": "Slightly bitter, resinous",
  "energetics": "Traditionally described as drying and cooling",
  "caution_pregnancy": "…",
  "caution_medications": "…",
  "caution_conditions": "…",
  "caution_duration": "…",
  "caution_topical": "…",
  "ahpa_class": "1",
  "planet": "Sun",
  "element": "Fire",
  "zodiac": ["Leo"],
  "gender": "masculine",
  "associations": ["protection", "the sun", "consecration"],
  "garden_harvest_part": "flower",
  "garden_harvest_timing": "Flower heads picked on dry mornings as they open, all summer.",
  "garden_sun": "Full sun",
  "garden_water": "Moderate",
  "garden_companions": ["tomato", "borage"],
  "notes": null,
  "sources": [
    { "title": "…", "author": "…", "year": 2020, "url": "https://…", "covers": ["uses", "safety"] },
    { "title": "The English Physitian", "author": "Nicholas Culpeper", "year": 1652, "url": "https://…", "covers": ["tradition"] }
  ]
}
```

Rules: `parts_used` values from `leaf, flower, root, bark, seed, berry, resin, whole herb`; `preparations` values from the spec's starter recipe types (`tincture, glycerite, tea blend, infusion, decoction, infused oil, salve, balm, serum, face oil, lotion, syrup, oxymel, vinegar, bath salts, bath blend, ritual oil, loose incense, smoke-free herb bundle, sachet, moon water`); `covers` values from `uses, safety, tradition, garden`; any caution may be null only when a cited safety source supports "no known concern" for that area, in which case write that as text instead of null. Other fields may be null when unknown.

## File map

```
server/db/migrations.js            + migration 3 (herbs, herb_sources)
server/db/repos.js                 + herbs, herbSources
server/schemas.js                  + HERB value lists, herbSchema, herbSourceSchema
server/data/grimoire/*.json        30 starter entries (content)
server/data/grimoire/index.js      loads and returns the entries in table order
server/services/grimoire.js        list, detail, create/update with sources, seed, auto-link, herb of the day
server/services/cabinet.js         validate herb_id; list/detail include herb_slug and herb_name
server/services/photos.js          PHOTO_OWNERS += herb
server/services/purge.js           + herbs, herb_sources, photos of herbs; unlink items
server/routes/grimoire.js          /api/herbs, /api/herbs/:id, /api/herb-of-the-day
server/index.js                    run grimoire seed and auto-link on start (after migrate)
server/demo/seed.js                link demo herb items to grimoire herbs
client/src/lib/grimoire.js         option lists, labels, caution list helper
client/src/screens/grimoire/Grimoire.jsx, HerbPage.jsx, HerbForm.jsx, SourcesEditor.jsx
client/src/screens/cabinet/ItemForm.jsx, ItemDetail.jsx    herb picker and link
client/src/screens/Today.jsx       herb of the day card
tests/server/grimoire*.test.js, tests/client/grimoire*.test.jsx, e2e/grimoire.spec.js
```

---

### Task 1: Data layer and seeding machinery

**Files:** Modify `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/services/photos.js`. Create `server/data/grimoire/index.js`, `server/data/grimoire/_example.json` (test fixture only, excluded from seeding by its leading underscore), `server/services/grimoire.js` (seed and link parts only). Modify `server/index.js`. Test `tests/server/grimoire-db.test.js`.

**Interfaces produced:**
- Tables:

```sql
CREATE TABLE herbs (id INTEGER PRIMARY KEY, slug TEXT, common_name TEXT NOT NULL, other_names TEXT NOT NULL DEFAULT '[]',
  latin_name TEXT, family TEXT, parts_used TEXT NOT NULL DEFAULT '[]', uses TEXT, preparations TEXT NOT NULL DEFAULT '[]',
  taste TEXT, energetics TEXT, caution_pregnancy TEXT, caution_medications TEXT, caution_conditions TEXT,
  caution_duration TEXT, caution_topical TEXT,
  ahpa_class TEXT CHECK (ahpa_class IN ('1','2a','2b','2c','2d','3','4')),
  planet TEXT CHECK (planet IN ('Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn')),
  element TEXT CHECK (element IN ('Fire','Water','Air','Earth')),
  zodiac TEXT NOT NULL DEFAULT '[]', gender TEXT CHECK (gender IN ('masculine','feminine')),
  associations TEXT NOT NULL DEFAULT '[]', garden_harvest_part TEXT, garden_harvest_timing TEXT, garden_sun TEXT,
  garden_water TEXT, garden_companions TEXT NOT NULL DEFAULT '[]', notes TEXT, is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE UNIQUE INDEX idx_herbs_slug ON herbs(slug) WHERE slug IS NOT NULL;
CREATE TABLE herb_sources (id INTEGER PRIMARY KEY, herb_id INTEGER NOT NULL REFERENCES herbs(id), title TEXT NOT NULL,
  author TEXT, year INTEGER, url TEXT, covers TEXT NOT NULL DEFAULT '[]', sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE INDEX idx_herb_sources_herb ON herb_sources(herb_id);
CREATE INDEX idx_items_herb ON items(herb_id);
```

- `server/schemas.js`: `AHPA_CLASSES`, `PLANETS`, `ELEMENTS`, `GENDERS`, `SOURCE_COVERS = ['uses','safety','tradition','garden']`, `RECIPE_TYPES` (the 21 names above), `herbSchema` (all scalar columns; list fields validated as arrays of strings by the service, not by `check`), `herbSourceSchema`.
- `repos(db).herbs` (columns: every herbs column except id and timestamps; `orderBy: 'common_name COLLATE NOCASE'`), `repos(db).herbSources` (`orderBy: 'sort_order, id'`).
- `PHOTO_OWNERS.herb = 'herbs'`.
- `loadStarterHerbs() -> entry[]` (reads `server/data/grimoire/*.json` except names starting with `_`, sorted by the table above using an exported `STARTER_ORDER` slug list).
- `seedGrimoire(db, entries = loadStarterHerbs()) -> { added }`: if setting `grimoire_seed_version` (stored as a raw settings row, not exposed by `getSettings`) is below `GRIMOIRE_SEED_VERSION = 1`, inserts every entry whose slug isn't already present (live or deleted), with its sources, `is_starter = 1`, in one transaction, then records the version. Never updates existing rows.
- `linkItemsToHerbs(db) -> { linked }`: for live items with `herb_id IS NULL` in a section of kind `herb`, set `herb_id` to the live herb whose `common_name`, any `other_names` entry, or `latin_name` matches the item's `name` or `latin_name` (case-insensitive, trimmed; for `Rosa gallica` style partial matches, compare the first two words of the Latin name). Only link when exactly one herb matches. Runs in a transaction.
- `server/index.js`: after `createContext` (migrations ran), call `seedGrimoire` then `linkItemsToHerbs` inside `runMaintenance`'s try/catch pattern (a failure logs and the app still starts).

- [ ] Steps: write `grimoire-db.test.js` covering: migration creates both tables; `seedGrimoire` with a two-entry fixture adds both with sources and `is_starter`, a second call adds nothing, and an entry whose slug was soft-deleted is not re-added; edits to a seeded herb survive a re-seed; `linkItemsToHerbs` links "Calendula" by name and "Pot marigold" by other name and `Rosa gallica` item to a herb with latin `Rosa spp. (R. gallica, R. damascena)` only if exactly one match, leaves ambiguous and supply-section items alone; `PHOTO_OWNERS.herb` exists. See it fail; implement; run `npx vitest run --project server`; commit "Add the grimoire tables, seeding and jar linking".

### Task 2: Grimoire service and routes

**Files:** `server/services/grimoire.js` (extend), `server/routes/grimoire.js`, `server/routes/index.js`, `server/services/cabinet.js`, `server/services/purge.js`. Tests `tests/server/grimoire.test.js`, extend `tests/server/cabinet.test.js`, `tests/server/purge.test.js`.

**Interfaces produced:**
- `GET /api/herbs?q&part&planet&element&has_jars&caution` → list rows `{ id, slug, common_name, latin_name, parts_used[], planet, element, ahpa_class, has_cautions (bool: any caution text present that isn't a "no known concern" line is still true; simply any non-null caution), jar_count, cover }` ordered by common name. `q` matches common name, other names, Latin name and associations. `caution=pregnancy` returns herbs with a pregnancy caution. Non-string query values are ignored.
- `GET /api/herbs/:id?today` → herb with list fields parsed to arrays, `sources[]`, `photos[]`, `jars[]` (live items with this `herb_id`: `{ id, name, amount, unit, size_label, expires_on, status }` using `itemStatus`).
- `POST /api/herbs`, `PATCH /api/herbs/:id`: body = herb fields plus optional `sources: [{ title, author, year, url, covers }]` which replaces the herb's sources (soft-delete old ones with the same stamp, insert new) in one transaction. Validate list fields are arrays of non-empty strings (≤ 30 items, each ≤ 80 chars); `parts_used` values from the plant-part list; `preparations` from `RECIPE_TYPES`; `covers` from `SOURCE_COVERS`; source `url` must be empty or start with `http://` or `https://` followed by a non-space; `slug` is never accepted from the client (server sets null for user-added herbs). 400 with `details` on bad input, keyed by field (`sources.0.url` style for sources).
- `DELETE /api/herbs/:id` (soft, cascades photos with the stamp; does **not** touch items, whose `herb_id` stays so undo restores the link), `POST /api/herbs/:id/restore`.
- `GET /api/herb-of-the-day?today=YYYY-MM-DD` → one live herb `{ id, common_name, latin_name, uses (first sentence only), planet, element, cover }`, chosen deterministically: live herbs ordered by id, index = days since 2000-01-01 modulo count. `null` when there are no herbs.
- Cabinet: `createItem`/`updateItem` accept `herb_id` (add to `itemSchema` as `'int'`); a non-null `herb_id` must reference a live herb (400 `details.herb_id`). `LIST_SQL` adds `h.slug AS herb_slug, h.common_name AS herb_name` via `LEFT JOIN herbs h ON h.id = i.herb_id AND h.deleted_at IS NULL`.
- Purge: photos of old-deleted herbs, `herb_sources` of old-deleted herbs or old-deleted sources, then `UPDATE items SET herb_id = NULL WHERE herb_id IN (old herbs)`, then the herbs.

- [ ] Steps: tests first (list filters and search, detail with jars and parsed lists, create with sources, update replaces sources and undo of a herb delete restores its photos but not replaced sources, validation errors for each list rule and bad source URL, herb_id validation on items, herb-of-the-day determinism and null, purge unlinks items); see them fail; implement; full vitest; commit "Add grimoire pages to the API".

### Task 3: Starter content, batch 1 (herbs 1-10)

**Files:** `server/data/grimoire/<slug>.json` for chamomile through ginger in the table order (10 files). Test `tests/server/grimoire-content.test.js` (created in this task, used by all batches).

This task is research and writing. It needs web access (WebFetch/WebSearch) and care.

- [ ] **Step 1: Write the content test** `tests/server/grimoire-content.test.js`. For every JSON file present (not all 30 need exist yet): parses; `slug` matches the file name and is in `STARTER_ORDER`; required fields present (`common_name`, `latin_name`, `family`, `parts_used` non-empty, `uses`, all five caution fields as strings); list values within the allowed lists; `ahpa_class` valid or null; planet/element valid or null; at least 2 sources, at least one with `covers` including `safety`; every source has `title` and `year`; URLs start with `https://` or `http://`; no text field contains an em dash (U+2014) or an en dash used as a dash; `uses` doesn't contain "cure", "cures", "treats", "heals", "dose", "dosage", "mg" (case-insensitive, whole words); no text field longer than 900 characters.
- [ ] **Step 2: Research and write each entry.** For each herb: read its NCCIH fact sheet if one exists (https://www.nccih.nih.gov/health/herbsataglance), its Culpeper entry, and its Grieve entry (botanical.com hosts Grieve), plus other reputable free sources as needed for safety. Write each field in your own words under the content rules. Record every source you used in `sources` with a working URL. Prefer saying less over saying something you can't support. Set `ahpa_class` only if a free source you cite states it; otherwise null.
- [ ] **Step 3: Self-check** each file against the content rules and the format; run the content test.
- [ ] **Step 4: Write a research log** `docs/grimoire/research-log.md` (append a section per herb: sources read with URLs, anything uncertain, anything left out and why). This file ships in the repo for transparency.
- [ ] **Step 5: Commit** "Write grimoire entries 1-10".

### Task 4: Starter content, batch 2 (herbs 11-20)

Same as Task 3 for garlic through yarrow. Commit "Write grimoire entries 11-20".

### Task 5: Starter content, batch 3 (herbs 21-30)

Same as Task 3 for plantain through mugwort. Mugwort's pregnancy caution must be explicit (traditionally avoided in pregnancy). Commit "Write grimoire entries 21-30".

### Task 6: Safety verification of all 30 entries

**Files:** may modify any `server/data/grimoire/*.json`; create `docs/grimoire/safety-check.md`.

Done by a different agent than the writers. For each herb, open every source marked `safety` and check each caution field: is it supported by the cited source? Is anything important in those sources missing (pregnancy, interactions such as blood thinners for garlic, ginger, turmeric; licorice and blood pressure, potassium and duration; raspberry leaf and pregnancy timing; hibiscus and blood pressure medicines; echinacea and allergies in the daisy family; chamomile, calendula, yarrow, echinacea and Asteraceae allergy)? Is any caution stated more strongly or weakly than the source supports? Do the URLs load? Fix the entry directly (in our own words), and record per herb in `safety-check.md`: OK, or what changed and why, with the source line it relied on (paraphrased). Also flag any `uses` sentence that reads as a medical claim. Run the content test. Commit "Check grimoire cautions against their sources".

Then the controller picks 3 herbs (one common, one with strong cautions such as licorice root or mugwort, one Stephanie chooses) and shows them to Stephanie for her spot-check before Task 11 ships. Her corrections go into the files.

### Task 7: Client foundations and the Grimoire list

**Files:** `client/src/lib/grimoire.js`, `client/src/screens/grimoire/Grimoire.jsx`, `client/src/App.jsx`, CSS. Test `tests/client/grimoire-list.test.jsx`.

- `lib/grimoire.js`: `PLANETS`, `ELEMENTS`, `AHPA_LABELS` (`'1'` → "Class 1: can be safely used when used appropriately", `'2a'` → "Class 2a: for external use only", `'2b'` → "Class 2b: not to be used during pregnancy", `'2c'` → "Class 2c: not to be used while nursing", `'2d'` → "Class 2d: other specific use restrictions", `'3'` → "Class 3: use only under expert supervision", `'4'` → "Class 4: not enough data to classify". Write these labels in our own words if those read as copied; the classes are AHPA's), `CAUTION_FIELDS = [['caution_pregnancy','Pregnancy and nursing'], ['caution_medications','Medicines'], ['caution_conditions','Health conditions'], ['caution_duration','How long to use'], ['caution_topical','On the skin']]`, `RECIPE_TYPES`, `SOURCE_COVERS`.
- Route `/grimoire` (remove from the "being built" drawers). `PageHeader` "Grimoire", subtitle "Herbs, their ways and their cautions", action `WaxSealLink` "Add an herb" → `/grimoire/new`. A short muted note under the header: "For learning and folk tradition. Not medical advice; check with a qualified practitioner, especially if you're pregnant, nursing or take medicines."
- Toolbar (URL params like Shelves): Search, Part used, Planet, Element, "Only herbs in my cabinet" checkbox, "Has a pregnancy caution" checkbox. Debounced search.
- Results as a grid of `ParchmentCard`s, each: cover or a botanical glyph, common name (link to `/grimoire/:id`), Latin name italic, planet and element glyph text ("☉ Sun · Fire" style without the middle dot: use "Sun, Fire"), a small oxblood "Cautions" badge when `has_cautions`, and "In your cabinet" badge with jar count when `jar_count > 0`.
- Empty: "No herbs match." / empty grimoire: "The grimoire is empty" with "Add an herb".
- [ ] Tests first (cards, links, badges, filters reach the API URL, empty states, the not-medical-advice note); fail; implement; full vitest and build; commit "Add the Grimoire list".

### Task 8: Herb page

**Files:** `client/src/screens/grimoire/HerbPage.jsx`. Test `tests/client/herbpage.test.jsx`.

- Header: common name, subtitle Latin name and family; actions Edit, Delete (useDeleteWithUndo with `onUndo` back to the page, navigate to `/grimoire` after delete).
- **Cautions first:** an oxblood-bordered panel titled "Before you use it" listing each non-empty caution with its label, plus the AHPA class label when set. Same not-medical-advice line. `role="region"` with that title.
- Then panels: "Uses in tradition" (uses, preparations as a list, taste, energetics), "Correspondences" (planet, element, zodiac, gender, associations; a muted "Folk tradition, not fact." line), "In the garden" (part harvested, timing, sun, water, companions), "In your cabinet" (jars with amount, badges, link to item; "Add a jar of this herb" → `/cabinet/new?section=<Herbs section id>&herb=<id>`; to get the Herbs section id, use `GET /api/sections` and pick the first `kind === 'herb'`), "Sources" (each: title, author, year, link via `safeUrl`, what it covers), "Photos" (`PhotoGallery ownerType="herb"`), "Notes".
- Empty panels are hidden, except Cautions which shows "No cautions recorded. That doesn't mean it's safe for everyone." when all are empty.
- [ ] Tests first (cautions panel appears before uses in the DOM, labels, AHPA label, hidden empty sections, jar list and add link with herb param, sources with safe links only, delete flow); fail; implement; commit "Add the herb page".

### Task 9: Herb form and sources editor

**Files:** `client/src/screens/grimoire/HerbForm.jsx`, `client/src/screens/grimoire/SourcesEditor.jsx`. Test `tests/client/herbform.test.jsx`.

- Routes `/grimoire/new`, `/grimoire/:id/edit`. Panels mirror the page: names (common name required, other names as comma-separated text), Latin name, family; Parts used (checkboxes), Uses (textarea), Preparations (checkboxes of recipe types), Taste, Energetics; Cautions (five textareas with hints); AHPA class (select with "Not known"); Correspondences (planet, element selects; zodiac and associations as comma-separated text; gender select); Garden (fields; companions comma-separated); Notes; Sources (SourcesEditor: rows with Title (required), Author, Year, Web address, Covers checkboxes; Add source, Remove, Move up/down; at least one source is not required for user-added herbs).
- Comma lists are trimmed and empty pieces dropped before sending arrays.
- Server errors map to fields, including `sources.N.field`.
- Leave guard with `useLeaveGuard`. Save → herb page, toast "Saved".
- Editing a starter herb shows a muted note "This is one of the starter herbs. Your changes are kept and won't be overwritten."
- [ ] Tests first (required name, arrays sent from comma text and checkboxes, sources add/remove/reorder sent in order, source URL error shows on that row, starter note, leave guard); fail; implement; commit "Add the herb form".

### Task 10: Cabinet links and Today's herb of the day

**Files:** `client/src/screens/cabinet/ItemForm.jsx`, `ItemDetail.jsx`, `ItemRow.jsx`, `client/src/screens/Today.jsx`, `server/demo/seed.js`. Tests: extend `itemform`, `itemdetail`, `shelves`, `today`, `demo` tests.

- ItemForm (herb sections only): a "Grimoire herb" select (empty "Not linked" + live herbs by common name). Choosing one fills Latin name if empty and the item name if empty. `?herb=ID` preselects it. Sends `herb_id`.
- ItemDetail: when `herb_name` is set, a line "In the grimoire: <link to /grimoire/:id>"; show the herb's pregnancy caution? No: keep it to the link (cautions live on the herb page).
- ItemRow: no change needed beyond tests still passing.
- Today: a fourth card "Herb of the day" (botanical "lavender" art reuse is fine) showing common name (link), Latin name, the first sentence of uses, and planet and element. Hidden when the API returns null. Fetches `/api/herb-of-the-day?today=…`.
- Demo seed: bump `SEED_VERSION` to `'3'`; after stocking (and for existing v2 demo folders), the server start runs `seedGrimoire` and `linkItemsToHerbs`, so demo herbs link automatically; the demo test asserts Calendula, Chamomile, Lavender, Mugwort and Rose petals are linked.
- [ ] Tests first; fail; implement; full vitest and build; commit "Link jars to the grimoire and show an herb of the day".

### Task 11: Browser walk-through, docs, and ship

- [ ] `e2e/grimoire.spec.js` (empty temp data folder, port 4203): the 30 starter herbs are listed; search "lavandula" finds Lavender; Lavender's page shows "Before you use it" above "Uses in tradition"; add a jar of Lavender from its page and see it under "In your cabinet"; add a new herb "Blue vervain" with one source and see its page; delete it and undo. Screenshots `test-results/grimoire.png` and `test-results/herb.png` at 1400x900 viewport (JPEG for docs).
- [ ] README: Grimoire paragraph with the not-medical-advice line and a pointer to `docs/grimoire/research-log.md` and `docs/grimoire/safety-check.md`; screenshot `docs/screenshots/grimoire.jpg` from the stocked demo (temp folder, port 4205) under 400 KB. Run unslop.
- [ ] `NOTICE.md`: add a "Grimoire sources" line saying the starter text is original and lists its sources per herb; Culpeper and Grieve are public domain; NCCIH content is US government work; AHPA classes are cited by number.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Stephanie's spot-check of 3 herbs (see Task 6) and her corrections.
- [ ] Evidence recording (headless, data folder `C:\ap-evidence-2b`), push to the `evidence` branch under `stage-2b/`; PR; greploop to 5/5.
- [ ] **(ask)** Merge; back up the installed app (`POST /api/backups`), `npm run stop`, pull, `npm run setup`, start the task, check `/api/herbs` lists 30 herbs and that her existing herb jars got linked.
