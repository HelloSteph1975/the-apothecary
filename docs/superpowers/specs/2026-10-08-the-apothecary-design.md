# The Apothecary: design

Date: 2026-10-08
Status: approved in chat, waiting for review of this written spec

## What it is

A witchy home apothecary keeper that runs on the user's own computer: herb cabinet, herb reference (grimoire), recipe book, batch journal, general journal, calendar, to-do list, jar labels, shopping list, and garden and foraging log, with moon and sky timing and traditional correspondences throughout. It is for a home apothecary only. Selling (catalog, orders, customers, sales labels) is out of scope and may become a separate app later.

Every kind of record (jars, herbs, recipes, recipe types, batches, journal entries, tasks, garden entries, shopping items) can be added, edited, saved and deleted. Deleting asks for confirmation. Deleting something other records use (for example a recipe type that recipes use) first says what it affects and offers a replacement.

Photos can be attached to every kind of record (see Photos).

## Foundation

The app is built on the same foundation as Hearth & Larder (`C:\Users\S_Lip\dev\hearth-and-larder`), copied into a new repository and adapted, not shared as a library:

- Node 24+, Express 5, the built-in `node:sqlite` database, React 19 with React Router, built with Vite. Tests with Vitest, Supertest, Testing Library and Playwright.
- Same layout: `server/` (config, db, routes, services, demo), `client/src/` (screens, components, lib, theme), `scripts/` (setup, stop, icon), `windows/` (start, stop, launch `.vbs` files and install/uninstall scripts).
- Actions in routes and screens stay thin. Shared mechanics (stock changes, backups, photos, PDF output, sky calculations, task generation) live in `server/services/`.
- Moon and planet positions come from `astronomy-engine` (MIT license), computed locally with no network calls.

### Where things live

| What | Where |
| --- | --- |
| Code | `C:\Users\S_Lip\dev\the-apothecary`, public GitHub repo `HelloSteph1975/the-apothecary` |
| Data | `Documents\The Apothecary Data` (`apothecary.db`, `photos\`, `labels\`, `backups\`), overridable by `dataDir` in `config.json` or `APOTHECARY_DATA_DIR` |
| App port | 4197 (`APOTHECARY_PORT` overrides) |
| Demo port | 4201, with its own sample data folder |
| Browser test port | 4203, throwaway data folder |

Hearth & Larder's browser tests already use 4199, so the demo skips it. The global port list in `~/.claude/CLAUDE.md` gets updated when the app is installed (next free after this: 4205).

### Daily rhythm (Windows)

- Scheduled task `The Apothecary - Start Morning`: daily 5:30 AM, runs `windows\start-server.vbs`, StartWhenAvailable, ExecutionTimeLimit PT72H, allowed on battery.
- Scheduled task `The Apothecary - Stop 9-30 PM`: daily 9:30 PM, runs `windows\stop-server.vbs`, which runs `node scripts/stop.js`. That asks the server to back up and shut down through `POST /api/shutdown`. No PowerShell stop script.
- Desktop shortcut `The Apothecary Dashboard.lnk` runs `windows\Launch The Apothecary.vbs` through wscript, with an `.ico` kept in `windows\`.
- `npm run install-windows` and `npm run uninstall-windows` create and remove these, and never touch the data folder.

## Look and feel

Target image: `docs/design/today-reference.jpg`. It is a guide, not a pixel spec. Colors and textures can change where that helps readability.

- Dark walnut wood background fading to ink black at the edges, warm candlelit lighting.
- Side bar shaped like an apothecary cabinet of stacked wooden drawers, each with a brass label plate and a round brass knob. The active drawer is oxblood and pulled out slightly. Drawers: Today, Calendar, To-do, Herb cabinet, Grimoire, Recipe book, Batch journal, Journal, Labels, Shopping list, Garden log, with Settings as a small brass key at the bottom.
- Content on aged parchment cards with soft torn edges, a thin inner rule and brass corner pieces.
- Accents: oxblood for attention (due, low, cautions), forest green for good states (ready, in stock), brass for details and the moon-phase mark.
- Headings in an old-style serif, body in a readable book serif. Candidates: Cormorant Garamond and EB Garamond (both SIL Open Font License, bundled through `@fontsource`).
- Small touches: moon-phase mark next to the greeting, zodiac and planet glyphs, botanical ink line drawings in card margins, wax-seal style primary buttons.
- All textures are made in CSS or SVG in this repo. All botanical drawings and glyph art are drawn originally as SVG for this repo. No third-party images.
- Body text on parchment must meet WCAG AA contrast. Respect `prefers-reduced-motion`.

## Sky and tradition

### What the app calculates

For any date, at the user's location (set once in Settings; default Mexico City, changeable):

- Moon phase (new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent), illumination, and the exact time of new and full moons.
- Moon sign (tropical zodiac) and the times it changes sign. Void-of-course moon is out of scope for the first version.
- Planetary ruler of the day (Sunday Sun, Monday Moon, Tuesday Mars, Wednesday Mercury, Thursday Jupiter, Friday Venus, Saturday Saturn). Planetary hours are out of scope for the first version.
- The eight Wheel of the Year festivals. Solstices and equinoxes are calculated; the cross-quarter days use their traditional dates (Imbolc Feb 1, Beltane May 1, Lughnasadh Aug 1, Samhain Oct 31). A Southern Hemisphere option flips the wheel.

### Timing suggestions

A rules file in the repo (`server/data/timing-rules.json`) maps sky conditions to suggestions, written originally for this repo. Examples:

- Waxing moon: a traditional time to start tinctures, infusions and anything meant to build.
- Full moon: traditional for moon water, charging oils, and harvesting leaves and flowers.
- Waning moon: traditional for clearing, cleansing blends, and harvesting roots.
- Moon in an earth sign: said to suit root work and salves. Water sign: infusions, tinctures, baths. Fire sign: warming and drying preparations. Air sign: incense, flowers, aromatics.
- Day rulers: for example Friday (Venus) for beauty, love and skin preparations; Monday (Moon) for sleep and dream blends.

Where suggestions appear:

- Today: one or two lines for the day ("Waxing gibbous in Taurus, Friday under Venus: a traditional day for face oils and rose work").
- Starting a batch or planning one on the calendar: the app lists good start dates in the next four weeks for that recipe, based on its type, its herbs' correspondences, and the rules. The user can ignore them.
- Garden log: gardening-by-the-moon suggestions (see Garden log).

Every suggestion is labeled as folk tradition. Suggestions never appear inside safety boxes, and they never override safety cautions. Users can edit the rules in Settings (add, edit, delete), and turn suggestions off.

### Correspondences

Each grimoire herb carries traditional correspondences next to its practical information: ruling planet, element, zodiac signs where tradition gives one, gender (as traditionally assigned), and folk associations (for example protection, sleep, love). Sources are cited per herb. Nicholas Culpeper's *The English Physitian* (1652, public domain) is the main historical source for planetary rulers. Wording is written fresh, not copied.

## Screens

### Today (home)

Greeting with date, moon phase and moon sign, the day's ruler, and the next festival. Cards for: tasks due today and overdue, batch steps due (today and next 7 days), herbs running low, jars nearing expiry (next 30 days) or expired, the day's timing suggestions, and an herb of the day from the grimoire. Primary button: "Log a batch".

### Calendar

- Month view with a week view and an agenda list. Each day shows the moon phase glyph and moon sign; festivals and new and full moons are marked.
- Shows everything with a date: batch steps, tasks, jar expiry dates, garden plantings and expected harvests, journal entries.
- Filters to show or hide each kind.
- Clicking a day opens a day page: its sky details, suggestions, and everything due, with buttons to add a task, journal entry, batch or garden entry for that day.
- Everything stays inside the app. No Google Calendar or other sync.

### To-do list

- Tasks: title, notes, due date (optional), repeat (daily, weekly on chosen days, monthly, every new moon, every full moon, each festival), priority, related record (jar, recipe, batch, herb, garden entry), done, photo.
- Automatic tasks, made and cleared by the app: batch steps due, restock when a jar is at or below its threshold, use or replace a jar nearing expiry, harvest when a planting's expected harvest date arrives. Automatic tasks can be edited, snoozed or dismissed; dismissing one keeps it from coming back until the cause changes.
- Views: today, upcoming, by related area, done.

### Herb cabinet

One row per jar.

- Fields: herb (linked to a grimoire entry, or free text), form (dried leaf, dried flower, root, bark, seed, resin, powder, fresh, tincture, oil, other), amount and unit (g, oz, ml, fl oz, count), low-stock threshold, source (supplier name or "my garden" / "foraged"), date bought or harvested, expiry date, storage spot, notes, photos.
- Expiry is suggested from the form (for example: dried leaf and flower 1 year, root and bark 2 years, powder 6 months, tincture 5 years, infused oil 1 year) and can be changed. The suggested durations are editable in Settings.
- Filters: low, nearing expiry, expired, by form, by storage spot, by plant part. Search by common or Latin name.

### Grimoire

One page per herb.

- Practical fields: common names, Latin name, family, parts used (leaf, flower, root, bark, seed, berry, resin, whole herb), traditional uses, common preparations, taste and energetics (optional), safety cautions (pregnancy and nursing, medication interactions, conditions, maximum duration, skin sensitivity for topical use), AHPA safety class where one exists, sources (title, author or organization, year, link), notes, photos.
- Tradition fields: see Correspondences. Garden notes: see Garden log.
- The cautions sit at the top of the page in an oxblood box.
- The page lists the jars in the cabinet, the recipes that use this herb, and garden entries for it.
- Ships with about 30 common herbs (starter list below). Each entry is written originally for this repo, cites real sources, and never copies text from them. The user can add, edit and delete entries.
- A short note on the grimoire and in the README says it is for learning and is not medical advice.

Starter herbs: chamomile, lavender, calendula, peppermint, lemon balm, elderberry, elderflower, echinacea, ginger, garlic, rosemary, thyme, sage, nettle, holy basil (tulsi), hibiscus, rose, yarrow, plantain, dandelion, burdock, marshmallow root, licorice root, cinnamon, turmeric, fennel, oat straw, raspberry leaf, mullein, mugwort. Sources should be checked as they are written; any herb that can't be documented responsibly gets swapped for another common one.

### Recipe book

- Recipe types are user-managed records: add, edit, save, delete. Each type has a name, a short description, an optional default wait time (for example tincture 6 weeks), default shelf life, default label caution, and an icon picked from the app's own SVG set.
- Starter types (all editable and deletable): tincture, glycerite, tea blend, infusion, decoction, infused oil, salve, balm, serum, face oil, lotion, syrup, oxymel, vinegar, bath salts, bath blend, ritual oil, loose incense, smoke-free herb bundle, sachet, moon water, other.
- Recipe fields: name, type, yield, ingredients (grimoire herb or free text such as beeswax or carrier oil, amount, unit, form, plant part), steps, wait time in days (defaults from the type), shelf life, intention or purpose (optional), best timing notes (optional), notes, photos.
- Scale the whole recipe by a factor or to a target yield.
- Any caution from an ingredient's grimoire page shows on the recipe. Topical recipes (serum, face oil, salve, balm, lotion, ritual oil) show a patch-test reminder.

### Batch journal

- "Make this recipe" (or a free-form batch): pick the recipe and scale, see suggested start dates, confirm which jars to draw from, and the cabinet amounts go down. Unit mismatches the app can't convert are flagged for the user to adjust by hand rather than guessed.
- A batch has: recipe, start date (with the moon phase, moon sign and day ruler recorded automatically), jars used, amounts, steps to do later with due dates (for example "strain" after the recipe's wait time), finished date, yield, expiry, notes, photos.
- Finishing a batch can add the result to the cabinet as a new jar (for example the finished tincture).
- Due steps appear on Today, the calendar and the to-do list.

### Journal

A general journal, separate from the batch journal, for anything else: rituals, moon observances, festivals, dreams, garden walks, readings, notes.

- Entry types are user-managed (add, edit, delete). Starter types: ritual, moon observance, festival, dream, garden, foraging walk, reflection, note.
- Fields: title, date and time, type, body text, mood (optional), related records (herbs, recipes, batches, garden entries), tags, photos. The moon phase, moon sign and day ruler are stamped automatically.
- Views: list, by type, by tag, by moon phase, and on the calendar. Search across titles and text.

### Labels

- Pick jars or batches and print labels in the app's style: name, Latin name, date made with its moon phase glyph, expiry, ingredients, and a short caution line when an ingredient has one.
- A few sizes (small round, medium rectangle, large rectangle) laid out on letter paper. Printing uses the browser's print view. "Save as PDF" writes into the `labels\` folder in the data folder.

### Shopping list

- Jars at or below their threshold are added automatically and removed when restocked.
- Manual items can be added, edited, checked off, deleted and cleared.
- "Bought" on an item can open a prefilled new-jar form.

### Garden log

- Plants in the garden: plant (grimoire link or free text), where it grows, date planted, expected harvest date, notes, photos.
- Entries: date, kind (planted, sowed, transplanted, pruned, harvested, foraged, observed), plant, place, amount, weather, notes, photos. The moon phase and sign are stamped automatically.
- A harvest or foraging entry can be sent to the cabinet as a new jar with the date and source filled in.
- Foraging entries show a standing reminder to identify plants with certainty and to forage only where it's allowed.

Garden correspondences:

- Each grimoire herb has garden notes: plant part harvested, traditional best harvest timing (for example leaves and flowers on a waxing or full moon in the morning after the dew dries; roots on a waning moon), sun and water needs, and companion plants.
- Gardening-by-the-moon suggestions from the timing rules: for example sowing leafy and flowering plants on a waxing moon, roots on a waning moon, and traditional sign groups for sowing, pruning and harvesting. Labeled as folk tradition.
- The garden page and calendar show these suggestions for the coming weeks.

### Settings

Back up now, restore (makes a safety copy first), data folder location (read-only display), location for sky calculations, hemisphere for the Wheel of the Year, units preference (metric or US), low-stock and expiry defaults, timing rules (add, edit, delete, turn off), recipe types and journal entry types (also managed in their own screens).

## Photos

- Any record can hold several photos: jars, herbs, recipes, batches, journal entries, tasks, garden plants and garden entries.
- Add by choosing files or dragging them in. Each photo gets an optional caption. One photo per record can be the cover, shown on cards and lists.
- Stored in `photos\` in the data folder with a small preview copy for lists. Large photos are resized on upload; the original is kept unless it is over a size limit set in Settings.
- Photos can be removed from a record or deleted. Deleting a record asks whether to keep or delete its photos.
- A Photos view in the Journal drawer shows all photos as a gallery, filterable by kind of record and by date.

## Data

SQLite tables (names indicative): `herbs` (grimoire, including correspondences and garden notes), `herb_sources`, `jars`, `recipe_types`, `recipes`, `recipe_ingredients`, `batches`, `batch_ingredients`, `batch_steps`, `journal_types`, `journal_entries`, `journal_links`, `tasks`, `task_dismissals`, `shopping_items`, `garden_plants`, `garden_entries`, `photos` (linked to any record by kind and id), `timing_rules`, `settings`, plus a migrations table. Database upgrades run on start, as in Hearth & Larder. Starter content (grimoire herbs, recipe types, journal types, timing rules) is seeded once on first run from JSON files in the repo, so later edits by the user are never overwritten.

## Error handling

- `config.json` errors name the file and the bad line and stop, as in Hearth & Larder.
- Port in use: say the app is probably already running and exit.
- Input is validated on the server; the client shows plain-language errors next to the field.
- Stock never goes below zero without the user confirming.
- Photo uploads reject non-image files and show which file failed.
- Backups and restore keep a safety copy and never delete the data folder. Backups include photos.

## Testing

- Unit and API tests for each service and route: stock changes, scaling, unit conversion, expiry suggestions, due dates, repeating and automatic tasks, shopping list rules, seeding, backups, photos, and sky calculations checked against known dates (published new and full moon times, moon sign changes, solstices).
- Client component tests for the main screens.
- One Playwright run that walks through every drawer on port 4203 with a throwaway data folder.
- Evidence for the PR: screen-recorded proof and before/after screenshots, per the user's build workflow. Then Greptile review until 5/5.

## Build order

The app is large, so it ships in stages, each its own pull request:

1. Foundation and look: server, database, backups, Windows tasks and shortcut, the cabinet side bar, parchment theme, Today shell, Settings, photos service.
2. Grimoire (with the 30 starter herbs and correspondences) and Herb cabinet.
3. Recipe book with recipe types, and Batch journal.
4. Sky and tradition: calculations, timing rules, suggestions.
5. Calendar and To-do list.
6. Journal and photo gallery.
7. Garden log with garden correspondences.
8. Labels and Shopping list.

## Docs

`README.md` for people, `AGENTS.md` for coding assistants (install, update, uninstall, troubleshooting, golden rules about the data folder), `CLAUDE.md` pointing at `AGENTS.md`, MIT license, and license notes for the fonts and `astronomy-engine`.

## Out of scope

Selling, inventory valuation, multi-user accounts, phone app, syncing to the cloud or Google Calendar, dosage calculators, void-of-course moon, planetary hours, natal charts.
