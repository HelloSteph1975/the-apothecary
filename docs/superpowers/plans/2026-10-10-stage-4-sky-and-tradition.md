# The Apothecary, Stage 4: Sky and Tradition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app knows the sky. For any date at her location it gives the moon phase (eight names), illumination, exact new and full moon times, the moon's tropical sign and when it changes, the day's planetary ruler, and the eight Wheel of the Year festivals (with a Southern Hemisphere flip). A timing rules file, written originally for this repo and editable in Settings, turns that into folk-tradition suggestions on Today and into suggested start dates when she starts a batch. Batches show the sky on their start date.

**Architecture:** `astronomy-engine` (MIT, no dependencies) does the astronomy. A thin pure module `server/lib/sky.js` wraps it with the app's rules (local day boundaries, phase names, sign changes, festivals). Migration 6 adds `timing_rules`. Starter rules live in `server/data/timing-rules.json` and are seeded once, like the grimoire and recipe types. `server/services/timing.js` matches rules to a day, picks Today's suggestions and scores start dates for a recipe. The client adds a sky line and a suggestions card on Today, a sky section in Settings (suggestions on or off, rules manager), the sky on batch pages and record sheets, and suggested start dates on the new batch page.

**Tech Stack:** Same as Stages 1 to 3B, plus `astronomy-engine@2.1.19` (MIT; add it to NOTICE).

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, sections "Sky and tradition", "Today", "Settings", "Batch journal" (moon phase, moon sign and day ruler for the start date).

**Later stages:** the calendar's sky markings and planning on the calendar (Stage 5), gardening-by-the-moon suggestions (Stage 7). This stage's API is built so they can reuse it.

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 6, appended to `server/db/migrations.js`. Never edit migrations 1 to 5.
- **Days are local days.** "A date" means the calendar day in the computer's local time zone (the server runs on her laptop). Exact event times are returned as ISO UTC strings and shown in local time by the client.
- **Folk tradition, always labelled.** Every suggestion shows the label "Folk tradition". Suggestions never appear inside a safety or caution panel and never change or hide a caution. When suggestions are off (setting `sky_suggestions` = `'off'`), no suggestion text appears anywhere; the plain sky facts (phase, sign, ruler, festival) still show.
- **Original wording.** Rule texts are written fresh for this repo (no copied phrases), plain and warm, no em dashes.
- Seeded once: starter rules never overwrite her edits or bring back a rule she deleted (same pattern as `seedRecipeTypes`).
- Plain, warm wording, no em dashes. Shared `Field` components, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`, `useDeleteWithUndo`, `useLeaveGuard`, keyed route wrappers, save guard, error with Try again, dialogs that stay mounted with inline `role="alert"` errors. Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA.
- Branch `feat/stage-4-sky` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-4`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Sky rules (the app's definitions)

- **Phase angle** = `Astronomy.MoonPhase(date)` (0 new, 90 first quarter, 180 full, 270 last quarter).
- **Phase name for a local day:** if an exact principal phase (new, first quarter, full, last quarter) falls inside that local day, the day takes that name (`new`, `first quarter`, `full`, `last quarter`). Otherwise use the angle at local noon: 0-90 `waxing crescent`, 90-180 `waxing gibbous`, 180-270 `waning gibbous`, 270-360 `waning crescent`.
- **Phase group:** `waxing` (waxing crescent, first quarter, waxing gibbous), `full`, `waning` (waning gibbous, last quarter, waning crescent), `new`.
- **Illumination:** `Astronomy.Illumination(Body.Moon, noon).phase_fraction`, as a whole percent.
- **Moon sign:** tropical, from the Moon's geocentric ecliptic longitude of date (`Astronomy.EclipticGeoMoon`), 30 degrees per sign starting at Aries 0. The day's sign is the sign at local noon; the response also lists any sign changes inside the day with their exact time.
- **Sign change search:** step through the range in 6-hour steps; when the sign index changes between steps, bisect to within 1 minute.
- **Signs and elements:** Aries Fire, Taurus Earth, Gemini Air, Cancer Water, Leo Fire, Virgo Earth, Libra Air, Scorpio Water, Sagittarius Fire, Capricorn Earth, Aquarius Air, Pisces Water.
- **Day ruler:** Sunday Sun, Monday Moon, Tuesday Mars, Wednesday Mercury, Thursday Jupiter, Friday Venus, Saturday Saturn (local weekday).
- **Principal phases in a range:** `Astronomy.SearchMoonQuarter` / `NextMoonQuarter`.
- **Festivals** (`Astronomy.Seasons(year)` for solstices and equinoxes; local date of the exact moment):

| festival | Northern Hemisphere | Southern Hemisphere |
|---|---|---|
| Imbolc | Feb 1 | Aug 1 |
| Ostara | March equinox | September equinox |
| Beltane | May 1 | Oct 31 |
| Litha | June solstice | December solstice |
| Lughnasadh | Aug 1 | Feb 1 |
| Mabon | September equinox | March equinox |
| Samhain | Oct 31 | May 1 |
| Yule | December solstice | June solstice |

## Starter timing rules (`server/data/timing-rules.json`)

Each rule: `{ slug, kind, value, text, recipe_types: [type slugs], planets: [], elements: [], weight }`. `kind` is one of `phase_group`, `phase`, `moon_element`, `moon_sign`, `day_ruler`, `festival`. A rule matches a day when the day's value for that kind equals `value`. `recipe_types`, `planets` and `elements` say what the rule favours when scoring start dates (an empty list favours nothing in that dimension). `weight` 1 to 3.

| slug | kind | value | text | recipe_types | planets | elements | weight |
|---|---|---|---|---|---|---|---|
| waxing-build | phase_group | waxing | A growing moon: in folk practice, a time to start tinctures, infusions and anything meant to build. | tincture, glycerite, infused-oil, oxymel, vinegar, syrup | | | 2 |
| full-moon-water | phase | full | Full moon: traditionally a night for moon water, charging oils and gathering leaves and flowers. | moon-water, ritual-oil, infused-oil | Moon | | 3 |
| waning-clear | phase_group | waning | A shrinking moon: in folk practice, a time for clearing and cleansing blends, and for digging roots. | bath-salts, bath-blend, loose-incense, smoke-free-herb-bundle, decoction | Saturn | | 2 |
| new-moon-begin | phase | new | New moon: traditionally a quiet time to set an intention and plan what you'll make. | ritual-oil, sachet | | | 1 |
| earth-roots | moon_element | Earth | Moon in an earth sign: said to suit root work, salves and balms. | salve, balm, decoction | Saturn, Venus | Earth | 2 |
| water-steeping | moon_element | Water | Moon in a water sign: said to suit infusions, tinctures and baths. | infusion, tincture, glycerite, bath-blend, bath-salts | Moon | Water | 2 |
| fire-warming | moon_element | Fire | Moon in a fire sign: said to suit warming and drying preparations. | oxymel, syrup, vinegar | Sun, Mars | Fire | 2 |
| air-aromatics | moon_element | Air | Moon in an air sign: said to suit incense, flowers and fragrant blends. | loose-incense, sachet, tea-blend | Mercury, Jupiter | Air | 2 |
| sunday-sun | day_ruler | Sun | Sunday, under the Sun: traditionally a day for vitality and solar herbs like calendula. | | Sun | | 1 |
| monday-moon | day_ruler | Moon | Monday, under the Moon: traditionally a day for sleep and dream blends. | tea-blend, sachet, moon-water | Moon | | 1 |
| tuesday-mars | day_ruler | Mars | Tuesday, under Mars: traditionally a day for protective and warming work. | | Mars | | 1 |
| wednesday-mercury | day_ruler | Mercury | Wednesday, under Mercury: traditionally a day for blends of the mind and the breath. | tea-blend | Mercury | | 1 |
| thursday-jupiter | day_ruler | Jupiter | Thursday, under Jupiter: traditionally a day for abundance and generous batches. | | Jupiter | | 1 |
| friday-venus | day_ruler | Venus | Friday, under Venus: traditionally a day for beauty, love and skin preparations, and rose work. | face-oil, serum, lotion, balm, salve | Venus | | 2 |
| saturday-saturn | day_ruler | Saturn | Saturday, under Saturn: traditionally a day for boundaries, banishing and long, slow steeps. | tincture, loose-incense | Saturn | | 1 |
| samhain | festival | Samhain | Samhain: traditionally a time to honour ancestors and make protective blends. | loose-incense, ritual-oil | | | 2 |
| yule | festival | Yule | Yule: the return of the light, traditionally kept with evergreens and warming syrups. | syrup, loose-incense | Sun | | 2 |
| beltane | festival | Beltane | Beltane: traditionally a time for flowers, fertility and love blends. | ritual-oil, bath-blend | Venus | | 2 |
| litha | festival | Litha | Litha: midsummer, traditionally the strongest day for gathering herbs. | infused-oil | Sun | | 2 |

(Recipe type slugs are the Stage 3A starter slugs: spaces become hyphens. A rule that names a type she deleted still matches the day; it just favours nothing for that type.)

## File map

```
package.json                       + astronomy-engine 2.1.19
NOTICE.md                          + astronomy-engine (MIT)
server/lib/sky.js                  localDay, phaseOn, moonSignAt, signChanges, principalPhases, dayRuler, festivals, skyForDay
server/db/migrations.js            + migration 6 (timing_rules)
server/db/repos.js, server/schemas.js   + timingRules, timingRuleSchema
server/data/timing-rules.json      19 starter rules (table above)
server/services/timing.js          load/seed rules, rulesForDay, todaySuggestions, startDates
server/services/content.js         + seed timing rules step
server/services/settings.js        + sky_suggestions ('on' | 'off')
server/services/batches.js         detail adds sky (start date)
server/services/today.js           + sky and suggestions; batchesDue window 7 days (spec)
server/routes/sky.js               /api/sky, /api/sky/range, /api/timing-rules, /api/recipes/:id/start-dates
client/src/lib/sky.js              labels, glyph-free text helpers
client/src/screens/Today.jsx       sky line under the greeting, "The sky today" card
client/src/screens/Settings.jsx    sky section: suggestions toggle, link to rules
client/src/screens/settings/TimingRules.jsx   rules manager (route /settings/timing-rules)
client/src/screens/batches/BatchPage.jsx, RecordSheet.jsx, NewBatch.jsx   sky on start date; suggested start dates
tests/server/sky.test.js, timing*.test.js, tests/client/*sky*, timingrules, e2e/sky.spec.js
```

---

### Task 1: The sky library

**Files:** `package.json` (add `astronomy-engine` 2.1.19 exactly, `npm install`), `NOTICE.md`, create `server/lib/sky.js`. Test `tests/server/sky.test.js`.

**Interfaces produced** (all pure; `date` strings are `YYYY-MM-DD` local days; times are ISO UTC strings):
- `localNoon(day) -> Date`, `localDayBounds(day) -> { start: Date, end: Date }`.
- `phaseOn(day) -> { name, group, angle, illumination }` (rules above).
- `moonSignAt(date: Date) -> { sign, element, longitude }`.
- `signChanges(from: Date, to: Date) -> [{ at, sign }]` (sign entered at that moment).
- `principalPhases(from: Date, to: Date) -> [{ name: 'new' | 'first quarter' | 'full' | 'last quarter', at }]`.
- `dayRuler(day) -> planet`.
- `festivals(year, hemisphere) -> [{ name, day }]` in date order, `nextFestival(day, hemisphere) -> { name, day, in_days }`.
- `skyForDay(day, { hemisphere }) -> { day, phase: { name, group, illumination }, moon: { sign, element, changes: [{ at, sign }] }, ruler, festival: name | null, next_new: at, next_full: at, next_festival: { name, day, in_days } }`.
- `SIGNS`, `SIGN_ELEMENTS`, `PHASE_NAMES`, `PHASE_GROUPS`, `RULERS`, `FESTIVALS` constants exported for validation.

- [ ] **Tests first**, against published values (allow 10 minutes for event times, since sources round):
  - new moon 2024-01-11 11:57 UTC; full moon 2024-01-25 17:54 UTC; full moon 2024-09-18 02:34 UTC; new moon 2024-10-02 18:49 UTC (a solar eclipse day);
  - March equinox 2024-03-20 03:06 UTC; June solstice 2024-06-20 20:51 UTC; December solstice 2024-12-21 09:20 UTC;
  - the full moon of 2024-01-25 is in Leo (the Sun is in Aquarius); the new moon of 2024-10-02 is in Libra;
  - day names: the local day containing an exact full moon is `full`; a day 3 days after new is `waxing crescent`; a day 3 days after full is `waning gibbous`;
  - day ruler of 2026-10-09 (a Friday) is Venus;
  - festivals for 2026 north: Imbolc 2026-02-01, Beltane 2026-05-01, Lughnasadh 2026-08-01, Samhain 2026-10-31, and Ostara on the equinox's local date; south flips per the table;
  - `signChanges` over a 3-day window finds at least one change, and the sign just after it differs from just before;
  - tests set `process.env.TZ = 'America/Mexico_City'` at the top of the file (before importing) so local days are stable; note this in a comment.
- [ ] See them fail. Implement. Full vitest. Commit "Add the sky calculations".

### Task 2: Timing rules, settings and the sky API

**Files:** `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, create `server/data/timing-rules.json`, `server/services/timing.js`, `server/routes/sky.js`; modify `server/routes/index.js`, `server/services/content.js`, `server/services/settings.js`, `server/services/today.js`, `server/services/batches.js`, `server/services/purge.js`. Tests: `tests/server/timing.test.js`, `tests/server/sky-api.test.js`; extend `today`, `batches`, `settings`, `maintenance`, `purge` tests.

**Interfaces produced:**
- Migration 6:

```sql
CREATE TABLE timing_rules (id INTEGER PRIMARY KEY, slug TEXT, kind TEXT NOT NULL
  CHECK (kind IN ('phase_group','phase','moon_element','moon_sign','day_ruler','festival')),
  value TEXT NOT NULL, text TEXT NOT NULL, recipe_types TEXT NOT NULL DEFAULT '[]', planets TEXT NOT NULL DEFAULT '[]',
  elements TEXT NOT NULL DEFAULT '[]', weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
  sort_order INTEGER NOT NULL DEFAULT 0, is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE UNIQUE INDEX idx_timing_rules_slug ON timing_rules(slug) WHERE slug IS NOT NULL;
```

- `timingRuleSchema = { kind: [...6 kinds], value: 'string!', text: 'string!', weight: { type: 'int', min: 1, max: 3, nullable: false }, sort_order: { type: 'int', nullable: false } }`; list fields (`recipe_types`, `planets`, `elements`) are validated by the service as arrays of strings (planets from `PLANETS`, elements from `ELEMENTS`, recipe types any non-empty slug strings up to 40 chars, at most 20 each). `value` must be valid for its kind (phase names, groups, elements, signs, planets, festival names from sky.js constants): 400 `details.value` otherwise. `text` up to 300 chars.
- `seedTimingRules(db, entries = loadStarterRules())` with settings key `timing_rules_seed_version` hidden from `getSettings`; added as a fourth step to `contentMaintenance`.
- Settings: `sky_suggestions` default `'on'`, rule `v => ['on','off'].includes(v)`.
- `rulesForDay(db, sky) -> rule[]` (live rules whose kind/value match the day's sky; `moon_sign` uses the noon sign; `festival` uses the festival on that day).
- `todaySuggestions(db, day, settings) -> { sky, suggestions: [{ id, text }] }`: the two highest-weight matching rules (ties by sort order); `suggestions` is `[]` when `sky_suggestions` is `'off'`.
- `startDates(db, recipeId, { from, days = 28 }, settings) -> [{ day, score, sky: { phase, sign, ruler }, reasons: [text] }]`: for each day from `from` (default today) for `days` days, score = sum of weights of matching rules that favour the recipe (its type slug is in `recipe_types`, or any linked herb's planet is in `planets`, or element in `elements`; each rule counts once). Return the top 5 days with score > 0, best first, ties by earliest. Returns `[]` when suggestions are off. 404 for a missing recipe.
- Routes:
  - `GET /api/sky?date=YYYY-MM-DD` (default today) → `skyForDay` with her hemisphere.
  - `GET /api/sky/range?from&to` (at most 62 days) → `[skyForDay]` (for the Stage 5 calendar; cheap enough).
  - `GET /api/timing-rules` (live, ordered), `POST`, `PATCH /:id`, `DELETE /:id` (soft) and `POST /:id/restore` via `crudRouter`-style handlers that read `ctx.db` per request.
  - `GET /api/recipes/:id/start-dates?from` → `startDates`.
- Today: `todaySummary` adds `sky` (skyForDay) and `suggestions`; `batchesDue` window becomes 7 days (spec: today and the next 7 days).
- Batch detail adds `sky: { phase, sign, ruler }` for its `start_date`.
- Purge: old-deleted timing rules.
- All handlers read `ctx.db` inside the request (never capture it at router creation).

- [ ] Tests first: seeding (19 rules, once, edits survive, deleted not re-added), JSON file checks (19 entries, unique slugs, valid kinds and values, no em or en dashes, texts ≤ 300 chars), rule validation errors per field, `rulesForDay` matching each kind, today suggestions (two, by weight; none when off), start dates (a tincture recipe on waxing water-sign days scores higher; Venus herbs favour Fridays; empty when off; top 5 order), sky API responses and bad dates, range cap, batch detail sky, settings toggle, purge, maintenance step, batchesDue window 7.
- [ ] See them fail. Implement. Full vitest. Commit "Add timing rules and the sky API".

### Task 3: Today and Settings

**Files:** create `client/src/lib/sky.js`, `client/src/screens/settings/TimingRules.jsx`; modify `client/src/screens/Today.jsx`, `client/src/screens/Settings.jsx`, `client/src/App.jsx`, CSS. Tests: extend `tests/client/today.test.jsx`, `tests/client/settings.test.jsx`; create `tests/client/timingrules.test.jsx`.

- `lib/sky.js`: `phaseText(phase)` ("Waxing gibbous, 78% lit"), `skyLine(sky)` ("Waxing gibbous in Taurus, Friday under Venus"), `moonTime(iso)` (local "Sat, Oct 17, 2:31 PM"), `FOLK_LABEL = 'Folk tradition'`, option lists for kinds and their values (mirroring the server constants; keep them in one file).
- Today header: under the date, the sky line, then "Next full moon <moonTime>", or "Next new moon" whichever is sooner, and "<Festival> in N days" (or "Today is <Festival>"). Sign changes today show as "Moon enters Gemini at 3:12 PM". Plain text, no emoji.
- Card "The sky today" (subtitle "folk timing, for what you're making"): up to two suggestion texts, each with the small "Folk tradition" label; a link "Timing rules" to `/settings/timing-rules`. When suggestions are off the card shows only the sky facts and "Suggestions are off. Turn them on in Settings."
- Batches due card: copy stays; the server now returns 7 days.
- Settings "You and your sky" card: add "Timing suggestions" on/off (a checkbox "Show folk timing suggestions") saved with the existing save; a link "Edit timing rules".
- `/settings/timing-rules`: list in order (kind and value as text, e.g. "Moon in a water sign", the rule text, weight as "Strong / Medium / Light", what it favours), Add, Edit, Delete with undo, Move up/down (PATCH sort_order). Add/Edit dialog: Kind (select), Value (select whose options depend on kind), Text (textarea, 300 max with a counter), Weight, Favours: recipe types (checkboxes of live recipe types by slug name), planets, elements. Dialog stays mounted, errors inside with `role="alert"`.
- [ ] Tests first: sky line and next-event text, sign-change line, festival text, suggestions with labels, suggestions off text, settings toggle saves, rules list text, add/edit body, value options follow kind, delete with undo, reorder.
- [ ] See them fail. Implement. Full vitest and build. Commit "Show the sky on Today and add timing rules to Settings".

### Task 4: Batches and the sky

**Files:** `client/src/screens/batches/BatchPage.jsx`, `RecordSheet.jsx`, `NewBatch.jsx` (and a small `StartDates.jsx`). Tests: extend `batchpage`, `recordsheet`, `newbatch` tests.

- Batch page subtitle adds the sky on its start date: "started Oct 9, waxing crescent in Scorpio, Friday under Venus".
- Record sheet "Date" field: "Started Oct 9, 2026 (waxing crescent in Scorpio, Friday under Venus), finished …".
- New batch page, for a recipe batch: a "Good days to start" panel beside the start date showing up to five days from `/api/recipes/:id/start-dates?from=<today>` as buttons ("Fri, Oct 16: waxing gibbous in Taurus") with their reasons under each in muted text, the "Folk tradition" label, and choosing one sets the start date (which re-plans as before). Hidden when suggestions are off or there are none; shows nothing for free-form batches. Never inside the draw lines' notes.
- [ ] Tests first: page subtitle and sheet date text, start-date buttons set the date and re-plan, folk label present, hidden when off/empty/free-form.
- [ ] See them fail. Implement. Full vitest and build. Commit "Show the sky on batches and suggest start dates".

### Task 5: Demo, browser walk-through, docs and ship

- [ ] Demo: no new rows needed (rules seed through content maintenance). Confirm the demo shows suggestions; no `SEED_VERSION` bump unless demo data changes.
- [ ] `e2e/sky.spec.js` (4203): Today shows a sky line and the sky card with a "Folk tradition" label; Settings: turn suggestions off, Today shows "Suggestions are off"; turn them on; add a timing rule "Moon in Cancer" (moon_sign Cancer) with a short text, see it in the list, delete and undo; start a batch from a recipe and pick a suggested start date, see the start date change. Screenshot `test-results/today-sky.png`.
- [ ] README: stage line Stage 4 of 8; a Sky and tradition bullet; refresh `docs/screenshots/today.jpg` from a temporary stocked demo (`APOTHECARY_DEMO_DATA_DIR=C:\ap-shot-4`, port 4205), JPEG under 400 KB. NOTICE: astronomy-engine, MIT, Don Cross. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence (headless, `C:\ap-evidence-4`), pushed to `evidence/stage-4/`, no duplicate screenshots. PR, greploop to 5/5 with zero open threads.
- [ ] **(ask)** Merge; back up (or confirm the nightly backup if the app is stopped), `npm run stop`, pull, `npm run setup`, start the task, check `/api/sky` and `/api/timing-rules` (19).
