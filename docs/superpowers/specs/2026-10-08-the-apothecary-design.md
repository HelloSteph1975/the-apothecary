# The Apothecary: design

Date: 2026-10-08
Status: approved in chat, waiting for review of this written spec

## What it is

A home apothecary keeper that runs on the user's own computer: herb cabinet, herb reference (grimoire), recipe book, batch journal, jar labels, shopping list, and garden and foraging log. It is for a home apothecary only. Selling (catalog, orders, customers, sales labels) is out of scope and may become a separate app later.

## Foundation

The app is built on the same foundation as Hearth & Larder (`C:\Users\S_Lip\dev\hearth-and-larder`), copied into a new repository and adapted, not shared as a library:

- Node 24+, Express 5, the built-in `node:sqlite` database, React 19 with React Router, built with Vite. Tests with Vitest, Supertest, Testing Library and Playwright.
- Same layout: `server/` (config, db, routes, services, demo), `client/src/` (screens, components, lib, theme), `scripts/` (setup, stop, icon), `windows/` (start, stop, launch `.vbs` files and install/uninstall scripts).
- Actions in routes and screens stay thin. Shared mechanics (stock changes, backups, PDF output) live in `server/services/`.

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
- Side bar shaped like an apothecary cabinet: eight stacked wooden drawers, each with a brass label plate and a round brass knob. The active drawer is oxblood and pulled out slightly.
- Content on aged parchment cards with soft torn edges, a thin inner rule and brass corner pieces.
- Accents: oxblood for attention (due, low, cautions), forest green for good states (ready, in stock), brass for details and the moon-phase mark.
- Headings in an old-style serif, body in a readable book serif. Candidates: Cormorant Garamond and EB Garamond (both SIL Open Font License, bundled through `@fontsource`).
- Small touches: moon-phase mark next to the greeting (computed locally, no network), botanical ink line drawings in card margins, wax-seal style primary buttons.
- All textures are made in CSS or SVG in this repo. All botanical drawings are drawn originally as SVG for this repo. No third-party images.
- Body text on parchment must meet WCAG AA contrast. Respect `prefers-reduced-motion`.

## Screens

### Today (home)

Greeting with date and moon phase, then cards for: batches due (today and next 7 days), herbs running low, jars nearing expiry (next 30 days) or expired, and an herb of the day from the grimoire. Primary button: "Log a batch".

### Herb cabinet

One row per jar.

- Fields: herb (linked to a grimoire entry, or free text), form (dried leaf, dried flower, root, bark, seed, powder, fresh, tincture, oil, other), amount and unit (g, oz, ml, fl oz, count), low-stock threshold, source (supplier name or "my garden" / "foraged"), date bought or harvested, expiry date, storage spot, notes, photo.
- Expiry is suggested from the form (for example: dried leaf and flower 1 year, root and bark 2 years, powder 6 months, tincture 5 years, infused oil 1 year) and can be changed.
- Filters: low, nearing expiry, expired, by form, by storage spot. Search by common or Latin name.

### Grimoire

One page per herb.

- Fields: common names, Latin name, family, parts used, traditional uses, common preparations, taste and energetics (optional), safety cautions (pregnancy and nursing, medication interactions, conditions, maximum duration), AHPA safety class where one exists, sources (title, author or organization, year, link), notes.
- The cautions sit at the top of the page in an oxblood box.
- The page lists the jars in the cabinet and the recipes that use this herb.
- Ships with about 30 common herbs (starter list below). Each entry is written originally for this repo, cites real sources, and never copies text from them. The user can edit, add and delete entries.
- A short note on the grimoire and in the README says it is for learning and is not medical advice.

Starter herbs: chamomile, lavender, calendula, peppermint, lemon balm, elderberry, elderflower, echinacea, ginger, garlic, rosemary, thyme, sage, nettle, holy basil (tulsi), hibiscus, rose, yarrow, plantain, dandelion, burdock, marshmallow root, licorice root, cinnamon, turmeric, fennel, oat straw, raspberry leaf, mullein, valerian. Sources should be checked as they are written; any herb that can't be documented responsibly gets swapped for another common one.

### Recipe book

- Fields: name, type (tincture, tea blend, salve, infused oil, syrup, oxymel, bath blend, other), yield, ingredients (grimoire herb or free text, amount, unit, form), steps, steep or wait time in days, shelf life, notes, photo.
- Scale the whole recipe by a factor or to a target yield.
- Any caution from an ingredient's grimoire page shows on the recipe.

### Batch journal

- "Make this recipe" (or a free-form batch): pick the recipe and scale, confirm which jars to draw from, and the cabinet amounts go down. Unit mismatches the app can't convert are flagged for the user to adjust by hand rather than guessed.
- A batch has: recipe, start date, jars used, amounts, steps to do later with due dates (for example "strain" after the recipe's wait time), finished date, yield, expiry, notes, photos.
- Finishing a batch can add the result to the cabinet as a new jar (for example the finished tincture).
- Due steps appear on Today.

### Labels

- Pick jars or batches and print labels in the app's style: name, Latin name, date made, expiry, ingredients, and a short caution line when an ingredient has one.
- A few sizes (small round, medium rectangle, large rectangle) laid out on letter paper. Printing uses the browser's print view. "Save as PDF" writes into the `labels\` folder in the data folder.

### Shopping list

- Jars at or below their threshold are added automatically and removed when restocked.
- Manual items can be added, checked off and cleared.
- "Bought" on an item can open a prefilled new-jar form.

### Garden and foraging log

- Entries: date, kind (planted, harvested, foraged), plant (grimoire link or free text), place, amount, weather, notes, photos.
- A harvest or foraging entry can be sent to the cabinet as a new jar with the date and source filled in.
- Foraging entries show a standing reminder to identify plants with certainty and to forage only where it's allowed.

### Settings

Back up now, restore (makes a safety copy first), data folder location (read-only display), units preference (metric or US), low-stock and expiry defaults.

## Data

SQLite tables (names indicative): `herbs` (grimoire), `herb_sources`, `jars`, `recipes`, `recipe_ingredients`, `batches`, `batch_ingredients`, `batch_steps`, `shopping_items`, `garden_entries`, `photos`, `settings`, plus a migrations table. Database upgrades run on start, as in Hearth & Larder. Starter grimoire content is seeded once on first run from a JSON file in the repo, so later edits by the user are never overwritten.

## Error handling

- `config.json` errors name the file and the bad line and stop, as in Hearth & Larder.
- Port in use: say the app is probably already running and exit.
- Input is validated on the server; the client shows plain-language errors next to the field.
- Stock never goes below zero without the user confirming.
- Backups and restore keep a safety copy and never delete the data folder.

## Testing

- Unit and API tests for each service and route (stock changes, scaling, unit conversion, expiry suggestions, due dates, shopping list rules, seeding, backups).
- Client component tests for the main screens.
- One Playwright run that walks through every drawer on port 4203 with a throwaway data folder.
- Evidence for the PR: screen-recorded proof and before/after screenshots, per the user's build workflow. Then Greptile review until 5/5.

## Docs

`README.md` for people, `AGENTS.md` for coding assistants (install, update, uninstall, troubleshooting, golden rules about the data folder), `CLAUDE.md` pointing at `AGENTS.md`, MIT license, and a license note for the fonts.

## Out of scope

Selling, inventory valuation, multi-user accounts, phone app, syncing to the cloud, dosage calculators.
