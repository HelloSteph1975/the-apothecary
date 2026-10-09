# The Apothecary, Stage 3A: Recipe Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Recipe book drawer works. Recipe types are her own records, with 22 starters she can edit or delete. Each recipe has a type, yield, ingredients (grimoire herbs or free text), steps, wait time, shelf life, intention, timing notes, notes and photos. A recipe can be scaled by a factor or to a target yield. Each recipe page shows the cautions of its grimoire herbs first, plus a patch-test reminder for topical types.

**Architecture:** Migration 4 adds `recipe_types`, `recipes` and `recipe_ingredients`. Starter types live in `server/data/recipe-types.json` and are seeded once (settings marker `recipe_types_seed_version`) at start and after a restore, alongside the grimoire steps. Server logic goes in `server/services/recipeTypes.js`, `server/services/recipes.js` and a pure `server/lib/scale.js`, which Stage 3B batches will reuse. The server does the scaling (`GET /api/recipes/:id?scale=` or `?yield=`), so client and batches share one rule. The client adds the Recipe book list, a recipe types manager, a recipe page and a recipe form with an ingredients editor. The herb page gets a "Recipes with this herb" panel.

**Tech Stack:** Same as Stages 1 to 2B. Icons for recipe types come from `lucide-react` (already a dependency, ISC licence).

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, section "Recipe book". Stage 3 split approved in chat on 2026-10-09: 3A Recipe book, then 3B Batch journal ("Make this recipe", jars drawn down, due steps, record sheets). Nothing about batches is built here.

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 4, appended to `server/db/migrations.js`. Never edit migrations 1 to 3.
- Soft deletes and undo as in Stages 2A and 2B (`crudRouter` or the same shape, `restore` URLs, photos cascade with the delete stamp).
- Starter content is seeded once and never overwrites her edits or re-adds a type she deleted (same rules as `seedGrimoire`).
- Safety: the recipe page shows "Before you make it" first, holding each linked herb's cautions, the type's label caution, and the patch-test reminder for topical types. The same not-medical-advice line as the grimoire appears on the recipe page. Timing notes are her own text; no sky suggestions in this stage.
- Plain, warm wording, no em dashes. Shared `Field` components, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`, `useDeleteWithUndo` (with `onUndo`), `useLeaveGuard`, `safeUrl`, `formatAmount`. Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA.
- Branch `feat/stage-3-recipes-batches` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-3`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Starter recipe types (`server/data/recipe-types.json`)

All editable and deletable. `wait_days` is the default time before it's ready (null = ready when made). `shelf_life_days` is a conservative default. `label_caution` is short, original text. `is_topical` drives the patch-test reminder (the spec's six topical types). `icon` is a key from `RECIPE_ICONS`.

| name | description | wait_days | shelf_life_days | label_caution | is_topical | icon |
|---|---|---|---|---|---|---|
| tincture | Herbs steeped in alcohol, then strained. | 42 | 1095 | Contains alcohol. Keep away from children. | 0 | flask |
| glycerite | Herbs steeped in vegetable glycerin, an alcohol-free extract. | 28 | 365 | Store cool and dark. | 0 | flask |
| tea blend | Dried herbs mixed for steeping. | null | 365 | Check each herb's cautions before drinking. | 0 | cup |
| infusion | Herbs steeped in hot or cold water, drunk the same day. | null | 1 | Keep refrigerated and use within a day. | 0 | cup |
| decoction | Roots, bark or seeds simmered in water. | null | 2 | Keep refrigerated and use within two days. | 0 | pot |
| infused oil | Dried herbs steeped in a carrier oil, then strained. | 28 | 365 | Use dried herbs only. Throw it out if it turns cloudy or smells off. | 0 | droplet |
| salve | Infused oil set with wax, for the skin. | null | 365 | For external use only. | 1 | jar |
| balm | A softer or richer salve, often with butters. | null | 365 | For external use only. | 1 | jar |
| serum | A light blend of oils for the face or hair. | null | 180 | For external use only. | 1 | droplet |
| face oil | Oils chosen for the face. | null | 180 | For external use only. | 1 | droplet |
| lotion | Oil and water blended together. | null | 90 | Contains water. Keep cool and use within its date. | 1 | droplet |
| syrup | A strong tea sweetened with honey or sugar. | null | 90 | Keep refrigerated. Never give honey to a child under one year old. | 0 | pot |
| oxymel | Herbs steeped in honey and vinegar. | 14 | 180 | Never give honey to a child under one year old. | 0 | flask |
| vinegar | Herbs steeped in vinegar. | 28 | 365 | Store cool and dark. | 0 | flask |
| bath salts | Salts blended with herbs or oils. | null | 365 | For external use only. | 0 | bath |
| bath blend | Herbs bundled or bagged for the bath. | null | 365 | For external use only. | 0 | bath |
| ritual oil | An oil blended for ritual or anointing. | null | 365 | For external use only. | 1 | sparkles |
| loose incense | Resins and herbs for burning on charcoal. | null | 730 | Burn in an airy room, away from children and pets. | 0 | flame |
| smoke-free herb bundle | Herbs bundled to hang or keep, not to burn. | null | 365 | Not for burning. | 0 | leaf |
| sachet | Herbs sewn or tied in cloth. | null | 365 | Not for eating. | 0 | package |
| moon water | Water left under the moon. | 1 | 7 | Don't drink it unless it began as clean drinking water and was kept covered. | 0 | moon |
| other | Anything else you make. | null | null | null | 0 | sprout |

`RECIPE_ICONS` (server and client): `flask, droplet, cup, pot, jar, bath, sparkles, flame, leaf, package, moon, sprout, flower, wind`. The client maps them to lucide `FlaskConical, Droplet, CupSoda, CookingPot, Amphora, Bath, Sparkles, Flame, Leaf, Package, Moon, Sprout, Flower2, Wind`.

## Units and scaling rules

- `RECIPE_UNITS = ['g', 'kg', 'oz', 'lb', 'ml', 'l', 'fl oz', 'count', 'drops', 'tsp', 'tbsp', 'cup', 'parts']`. Jars keep the shorter `UNITS`. Unit conversion between jars and recipes is Stage 3B.
- `scaleAmount(amount, factor, unit)`: null stays null. Otherwise `n = amount * factor`, then `roundAmount(n, unit)`.
- `roundAmount(n, unit)`: for `drops` and `count`, `Math.max(1, Math.round(n))` when `n > 0`. Otherwise round to whole when `n >= 100`, one decimal when `n >= 10`, two decimals below that. Return a number (no trailing zeros).
- `factorFor(recipe, { scale, yield })`: `scale` must be a number from 0.01 to 100. `yield` needs `recipe.yield_amount > 0` and gives `yield / recipe.yield_amount`, also within 0.01 to 100. Neither means 1. Bad input gives a 400 with `details.scale` or `details.yield`.

## File map

```
server/db/migrations.js            + migration 4 (recipe_types, recipes, recipe_ingredients)
server/db/repos.js                 + recipeTypes, recipes, recipeIngredients
server/schemas.js                  + RECIPE_UNITS, RECIPE_ICONS, recipeTypeSchema, recipeSchema, recipeIngredientSchema
server/data/recipe-types.json      22 starter types (table above)
server/lib/scale.js                roundAmount, scaleAmount, factorFor (pure)
server/services/recipeTypes.js     load/seed starter types, list with counts, delete with move, reorder
server/services/recipes.js         list, detail (scaled, cautions), create/update with ingredients
server/services/grimoire.js        getHerbDetail adds recipes[]
server/services/maintenance.js     startup content steps: grimoire + recipe types
server/services/backup.js          restore runs the same content steps
server/services/photos.js          PHOTO_OWNERS += recipe
server/services/purge.js           + recipes, ingredients, types, recipe photos
server/routes/recipes.js           /api/recipe-types, /api/recipes
server/demo/seed.js                SEED_VERSION '4', three demo recipes
client/src/lib/recipes.js          option lists, icon map, effective wait/shelf text
client/src/screens/recipes/RecipeBook.jsx, RecipeTypes.jsx, RecipePage.jsx, RecipeForm.jsx, IngredientsEditor.jsx
client/src/screens/grimoire/HerbPage.jsx   "Recipes with this herb" panel
client/src/App.jsx                 routes; /recipes leaves the "being built" list
tests/server/recipes*.test.js, tests/server/scale.test.js, tests/client/recipe*.test.jsx, e2e/recipes.spec.js
```

---

### Task 1: Data layer, starter types and startup seeding

**Files:** Modify `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/services/photos.js`, `server/services/maintenance.js`, `server/services/backup.js`, `server/services/purge.js`. Create `server/data/recipe-types.json`, `server/services/recipeTypes.js` (seed part only). Tests: `tests/server/recipes-db.test.js`; extend `tests/server/maintenance.test.js` and `tests/server/purge.test.js`.

**Interfaces produced:**
- Migration 4:

```sql
CREATE TABLE recipe_types (id INTEGER PRIMARY KEY, slug TEXT, name TEXT NOT NULL, description TEXT,
  wait_days INTEGER CHECK (wait_days IS NULL OR wait_days >= 0),
  shelf_life_days INTEGER CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
  label_caution TEXT, is_topical INTEGER NOT NULL DEFAULT 0, icon TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  is_starter INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE UNIQUE INDEX idx_recipe_types_slug ON recipe_types(slug) WHERE slug IS NOT NULL;
CREATE TABLE recipes (id INTEGER PRIMARY KEY, name TEXT NOT NULL, type_id INTEGER NOT NULL REFERENCES recipe_types(id),
  yield_amount REAL CHECK (yield_amount IS NULL OR yield_amount > 0), yield_unit TEXT, steps TEXT,
  wait_days INTEGER CHECK (wait_days IS NULL OR wait_days >= 0),
  shelf_life_days INTEGER CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
  intention TEXT, timing_notes TEXT, notes TEXT, ${TS});
CREATE INDEX idx_recipes_type ON recipes(type_id);
CREATE TABLE recipe_ingredients (id INTEGER PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipes(id),
  herb_id INTEGER REFERENCES herbs(id), name TEXT NOT NULL, amount REAL CHECK (amount IS NULL OR amount >= 0),
  unit TEXT, form TEXT, plant_part TEXT, note TEXT, sort_order INTEGER NOT NULL DEFAULT 0, ${TS});
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_herb ON recipe_ingredients(herb_id);
```

  `yield_unit` and `unit` are free text checked by the service against `RECIPE_UNITS` (so the list can grow without a migration). `slug` is the starter type's name with spaces as hyphens; user types get null.
- `server/schemas.js`: `RECIPE_UNITS`, `RECIPE_ICONS` (lists above). `recipeTypeSchema = { name: 'string!', description: 'string', wait_days: { type: 'int', min: 0, max: 3650 }, shelf_life_days: { type: 'int', min: 0, max: 3650 }, label_caution: 'string', is_topical: { type: 'bool', nullable: false }, icon: RECIPE_ICONS, sort_order: { type: 'int', nullable: false } }`. `recipeSchema = { name: 'string!', type_id: 'int!', yield_amount: { type: 'number', min: 0 }, yield_unit: RECIPE_UNITS, steps: 'string', wait_days: { type: 'int', min: 0, max: 3650 }, shelf_life_days: { type: 'int', min: 0, max: 3650 }, intention: 'string', timing_notes: 'string', notes: 'string' }`. `recipeIngredientSchema = { herb_id: 'int', name: 'string', amount: { type: 'number', min: 0 }, unit: RECIPE_UNITS, form: FORMS, plant_part: PLANT_PARTS, note: 'string' }`. Check how `check` handles an enum array and a `bool` before writing these; match the existing schema style exactly.
- Repos: `recipeTypes` (`orderBy: 'sort_order, id'`), `recipes` (`orderBy: 'name COLLATE NOCASE'`), `recipeIngredients` (`orderBy: 'sort_order, id'`).
- `PHOTO_OWNERS.recipe = 'recipes'`.
- `server/services/recipeTypes.js`: `RECIPE_TYPES_SEED_VERSION = 1`; `loadStarterTypes() -> entry[]` (reads the JSON, in file order); `seedRecipeTypes(db, entries = loadStarterTypes()) -> { added }`. Uses a raw settings row `recipe_types_seed_version`, hidden from `getSettings` the same way as the grimoire keys. Inserts every entry whose slug isn't present (live or deleted), with `sort_order` = file index and `is_starter = 1`, in one transaction, then records the version. Never updates existing rows.
- Startup content steps: rename `grimoireMaintenance` to `contentMaintenance(db, steps)` in `maintenance.js`. It runs seed grimoire, link jars once, then seed recipe types, each in its own try/catch that logs. `runMaintenance` and `restoreBackup` both call it. Keep the injectable steps for tests, and update the existing maintenance tests to the new name.
- Purge: photos of old-deleted recipes; `recipe_ingredients` of old-deleted recipes or old-deleted ingredients; old-deleted recipes; old-deleted recipe types only when no recipe row (live or deleted) still references them. Herb purge: before deleting old herbs, set `recipe_ingredients.herb_id = NULL` for them (name text stays).

- [ ] Tests first:
  - Migration 4 creates the three tables.
  - `seedRecipeTypes` adds 22 types in order with `is_starter`. A second call adds nothing. A soft-deleted starter isn't re-added. An edited starter survives a re-seed.
  - The JSON file has 22 entries, unique slugs, icons from `RECIPE_ICONS`, no em or en dashes, and exactly the six topical types flagged.
  - `PHOTO_OWNERS.recipe` exists.
  - Restoring a user_version-3 backup gives 22 types.
  - `runMaintenance` with a throwing recipe-type seed still starts.
  - Purge removes old recipes with their ingredients and photos, unlinks ingredients from purged herbs, and keeps a purged-eligible type that a recipe still uses.
- [ ] See them fail. Implement. Run `npx vitest run --project server`, then the full suite. Commit "Add the recipe tables and starter recipe types".

### Task 2: Scaling helper and recipe services and routes

**Files:** Create `server/lib/scale.js`, `server/services/recipes.js`, `server/routes/recipes.js`. Extend `server/services/recipeTypes.js`, `server/routes/index.js`, `server/services/grimoire.js` (herb detail recipes). Tests: `tests/server/scale.test.js`, `tests/server/recipes.test.js`, `tests/server/recipe-types.test.js`; extend `tests/server/grimoire.test.js`.

**Interfaces produced:**
- `server/lib/scale.js`: `roundAmount(n, unit)`, `scaleAmount(amount, factor, unit)`, `factorFor(recipe, query) -> number`. Rules are in "Units and scaling rules" above. Throws `HttpError(400, 'Please fix the highlighted fields.', { scale | yield: message })`.
- Recipe types routes (`/api/recipe-types`):
  - `GET /` lists live types in order with `recipe_count` (live recipes).
  - `POST /` and `PATCH /:id` validate with `recipeTypeSchema`. Names must be unique among live types, case-insensitive (400 `details.name` "You already have a type with this name.").
  - `DELETE /:id?move_to=ID`: when live recipes use it and there's no `move_to`, 409 `{ error: 'Move its recipes to another type first.', details: { recipes: n } }`. `move_to` must be another live type. The move and the delete share one transaction and one stamp.
  - `POST /:id/restore` brings the type back. Moved recipes stay where they went, the same as sections.
  - `PUT /order` takes `{ ids: [...] }` and sets `sort_order`, like `reorderSections`.
- Recipes routes (`/api/recipes`):
  - `GET /?q&type_id&herb_id&topical`: `q` matches name, intention and ingredient names (case-insensitive; escape `%` and `_` for LIKE, with `ESCAPE '\'`). Non-string query values are ignored. Rows: `{ id, name, type_id, type_name, type_icon, is_topical, yield_amount, yield_unit, ingredient_count, herb_names[] (live herbs, by name), cover }` ordered by name.
  - `GET /:id?scale&yield` returns the recipe plus:
    - `type`: the full live-or-deleted type row, so a recipe whose type was just deleted still shows.
    - `effective_wait_days` and `effective_shelf_life_days`: the recipe's own value, else the type's.
    - `factor`, plus `scaled_yield_amount` = `roundAmount(yield_amount * factor, yield_unit)` (null when there's no yield).
    - `ingredients[]`: `{ id, herb_id, herb_name (live herb or null), herb_deleted (bool), name, amount (scaled), base_amount, unit, form, plant_part, note }` in sort order.
    - `cautions[]`: one entry per distinct live linked herb that has caution text, `{ herb_id, common_name, items: [{ field, text }] }`, in ingredient order. `field` is one of the five caution columns; empty cautions are skipped.
    - `label_caution`, `needs_patch_test` (= `type.is_topical`), and `photos[]`.
  - `POST /` and `PATCH /:id`: body = recipe fields plus optional `ingredients: [...]`, which replaces the list (soft-delete the old rows with one stamp, insert the new ones with `sort_order` = index) in one transaction with the recipe write. Each ingredient needs a `name` or a live `herb_id`. When `herb_id` is set and `name` is empty, the server fills `name` from the herb's common name. `type_id` must be a live type (400 `details.type_id`). `yield_unit` is required when `yield_amount` is set (400 `details.yield_unit`). At most 60 ingredients. Errors are keyed `ingredients.N.field`. Responses return the detail at factor 1.
  - `DELETE /:id` is a soft delete: ingredients and photos cascade with the stamp. `POST /:id/restore` brings back the ingredients and photos with that stamp.
- `getHerbDetail` adds `recipes: [{ id, name, type_name }]`: live recipes with a live ingredient linked to this herb, distinct, by name.

- [ ] Tests first:
  - scale: rounding per unit, null amounts, factor bounds, and yield needing a recipe yield.
  - types: list counts, unique names, delete 409 then move and delete, restore, reorder.
  - recipes:
    - list filters and LIKE escaping (`q=%` matches nothing extra);
    - detail effective wait and shelf life from the type;
    - scale by factor and by yield;
    - cautions grouped per herb, with deleted herbs excluded;
    - patch-test flag;
    - create with ingredients; herb-only ingredient gets the herb's name;
    - update replaces ingredients;
    - delete and undo bring back the ingredients and photos but not replaced ingredients;
    - validation errors for each rule.
  - grimoire: herb detail lists recipes.
- [ ] See them fail. Implement. Run the full vitest suite. Commit "Add recipes and recipe types to the API".

### Task 3: Client foundations, the Recipe book list and the types manager

**Files:** Create `client/src/lib/recipes.js`, `client/src/screens/recipes/RecipeBook.jsx`, `client/src/screens/recipes/RecipeTypes.jsx`. Modify `client/src/App.jsx`, CSS. Tests: `tests/client/recipebook.test.jsx`, `tests/client/recipetypes.test.jsx`. Update the "being built" check in `tests/client/cabinet.test.jsx` (it uses `/recipes`; switch it to `/batches` or whichever drawer is still unbuilt).

- `lib/recipes.js`:
  - `RECIPE_UNITS` (option list) and `RECIPE_ICONS`.
  - `TypeIcon({ icon, size })`, mapping the key to the lucide component (fallback `Sprout`) with `aria-hidden`.
  - `daysText(n)`: null → "", 0 → "Ready when made", 1 → "1 day", 7 → "1 week", multiples of 7 → "N weeks", otherwise "N days".
  - `shelfText(n)`: the same rules, plus 365 → "1 year" and multiples of 365 → "N years".
- Route `/recipes` (remove it from the "being built" drawers). `PageHeader` "Recipe book", subtitle "Your recipes, ready to make". Actions: `WaxSealLink` "Add a recipe" → `/recipes/new`, and a plain link "Recipe types" → `/recipes/types`.
- Toolbar (URL params, like Shelves): Search, Type (select), Herb (select of live herbs), "Only skin recipes" checkbox (`topical=1`). Debounced search.
- Results: a grid of `ParchmentCard`s. Each shows the cover or the type icon, the name linking to `/recipes/:id`, the type name, the yield (`formatAmount`-style), and up to three herb names, plus "and N more" when there are more.
- Empty states: "No recipes match." when filtered. With no recipes at all: "Your recipe book is empty", with "Add a recipe".
- `RecipeTypes.jsx` at `/recipes/types`, following `SectionManager`'s patterns:
  - The list in order with icon, name, description, wait (`daysText`), shelf life (`shelfText`) and a "For the skin" badge when topical. Each row has Edit, Move up and Move down (saves the order with `PUT /order`), and Delete.
  - Delete with recipes opens a dialog: "Move its N recipes to" a select of other types, then "Move and delete". Undo comes from the toast.
  - Add and Edit open a dialog form with fields name, description, wait in days, shelf life in days, label caution, "For the skin (shows a patch-test reminder)" checkbox, and an icon picker. The picker is a radio group of the 14 icons, each with a visible label.
  - Server errors show next to their fields.
- [ ] Tests first:
  - Cards, links and herb names.
  - Filters reach the API URL.
  - Both empty states.
  - The types list shows days text and the skin badge.
  - Reorder sends the ids.
  - Delete with recipes asks for a move and sends `move_to`.
  - The add form sends the right body and shows a duplicate-name error.
  - The icon picker is reachable by keyboard.
- [ ] See them fail. Implement. Run the full vitest suite and the build. Commit "Add the Recipe book list and recipe types".

### Task 4: Recipe page

**Files:** Create `client/src/screens/recipes/RecipePage.jsx`. Test: `tests/client/recipepage.test.jsx`.

- Header: the recipe name, with subtitle type name and yield. Actions are Edit and Delete. Delete uses `useDeleteWithUndo` with `onUndo` back to the page, and navigates to `/recipes` after.
- **Before you make it** comes first, as a full-width oxblood panel (reuse the herb page's `panel-caution panel-wide` classes) with `role="region"` and that title. It shows:
  - A patch-test reminder when `needs_patch_test`: "Patch test first: dab a little on the inside of your arm and wait a day before using it more widely."
  - The type's label caution.
  - Each herb's cautions under the herb's name (linking to `/grimoire/:id`), using `CAUTION_FIELDS` labels.
  - The line "For learning and folk tradition. Not medical advice; check with a qualified practitioner, especially if you're pregnant, nursing or take medicines."
  - When there are no cautions, no reminder and no label caution: "No cautions recorded for these ingredients. Check each herb before you make it."
- **Scale** control (a small panel above the ingredients):
  - "Make" with a select of 1/2×, 1×, 2×, 3× and "Other", which reveals a number field for the factor. When the recipe has a yield, add "or make" with a number field for the target yield in the recipe's yield unit.
  - Changing it refetches `/api/recipes/:id?scale=` or `?yield=` (debounced 300 ms). It shows "Scaled to 2×: makes 200 ml" and offers a Reset.
  - Errors from the server show by the field.
  - The scale lives in the URL (`?scale=` or `?yield=`), so a reload keeps it.
- **Ingredients**: a list with the amount (`formatAmount` on the scaled amount, or blank when null), the name (linked to the herb page when `herb_name` is set), then form, plant part and note muted. A deleted herb shows the name with a muted "(no longer in the grimoire)".
- **Steps**: the `steps` text split on new lines, empty lines dropped, as an ordered list.
- **About**: wait (`daysText(effective_wait_days)`) and shelf life (`shelfText`). Below them come the intention, timing notes ("Best timing", her own notes) and notes. Empty items are hidden.
- **Photos**: `PhotoGallery ownerType="recipe"`.
- [ ] Tests first:
  - The caution panel comes before the ingredients in the DOM.
  - The patch-test line appears only for topical types.
  - Cautions are grouped under herb names with links.
  - The empty-caution text shows when there are none.
  - Scaling sends `?scale=2` and shows the scaled amounts.
  - The target yield sends `?yield=`.
  - A server error shows by the field.
  - Steps render as a list.
  - The deleted-herb note shows.
  - Delete and undo work (check the DELETE URL, the navigation, and the restore POST).
- [ ] See them fail. Implement. Commit "Add the recipe page".

### Task 5: Recipe form and ingredients editor

**Files:** Create `client/src/screens/recipes/RecipeForm.jsx` and `client/src/screens/recipes/IngredientsEditor.jsx`. Modify `client/src/App.jsx` (a keyed route wrapper, as for `HerbForm`). Test: `tests/client/recipeform.test.jsx`.

- Routes `/recipes/new` (optional `?type=ID` and `?herb=ID` to preselect a type or a first herb ingredient) and `/recipes/:id/edit`, keyed by id.
- Fields:
  - Name (required) and Type (required select of live types).
  - Yield amount and Yield unit.
  - Wait in days and Shelf life in days. Their hints show the type's defaults, e.g. "Leave blank to use the type's 6 weeks".
  - Intention, Best timing (her notes), Steps (a textarea with the hint "One step per line"), and Notes.
- IngredientsEditor rows:
  - "Grimoire herb" (a select with "Not an herb" plus live herbs). Picking one fills the name when it's empty.
  - Name (required unless an herb is picked), Amount, Unit (`RECIPE_UNITS`), Form, Plant part and Note.
  - Each row has Move up, Move down and Remove, and the list has "Add an ingredient".
  - Each row is a `<fieldset>` with a `<legend>` "Ingredient N". Inputs are labelled so screen readers hear "Ingredient 2 amount".
- Errors: any change to the ingredient list clears every `ingredients.*` error key. Amounts are sent as numbers. A blank amount becomes null. Server errors map to their fields, including `ingredients.N.field` and the list-level `ingredients`.
- A Save guard keeps double clicks from sending twice, and the button is disabled while saving. The leave guard uses `useLeaveGuard`. Save goes to the recipe page with the toast "Saved".
- If `/api/herbs` or `/api/recipe-types` fails, show an error with Try again instead of the form.
- [ ] Tests first:
  - The required fields.
  - The type default hints.
  - The herb pick fills the name.
  - Rows add, remove and reorder, and go out in order.
  - A blank amount is sent as null.
  - A row error shows on its row and clears on a list change.
  - `?type=` and `?herb=` preselect.
  - A double submit gives one POST.
  - The leave guard.
  - The keyed form re-seeds when the id changes.
- [ ] See them fail. Implement. Run the full vitest suite and the build. Commit "Add the recipe form".

### Task 6: Herb page link and demo recipes

**Files:** `client/src/screens/grimoire/HerbPage.jsx`, `server/demo/seed.js`. Tests: extend `tests/client/herbpage.test.jsx` and `tests/server/demo.test.js`.

- Herb page: a "Recipes with this herb" panel (hidden when there are none) that lists recipe links with their type name. It also gets a link "Write a recipe with this herb" → `/recipes/new?herb=<id>`, shown always.
- Demo: `SEED_VERSION` '4'. After stocking and seeding the grimoire, the demo seeds recipe types and adds three demo recipes:
  - "Calendula skin salve" (salve): calendula-infused olive oil plus beeswax, with steps.
  - "Sleepy chamomile tea" (tea blend): chamomile, lavender and lemon balm in parts.
  - "Rose face serum" (serum): rose petals as an herb, plus jojoba oil.

  The recipes link to grimoire herbs by slug. A reset clears and re-adds the demo recipes (along with their photos) but never touches recipe types. Existing v3 demo folders get the recipes once.
- [ ] Tests first:
  - Herb page panel shows the recipes and the link.
  - The demo has the three recipes, with the herbs linked.
  - The salve shows the patch-test flag.
  - Running the demo seed again is a no-op.
  - A v3 demo folder gets the recipes.
- [ ] See them fail. Implement. Commit "Link herbs to recipes and add demo recipes".

### Task 7: Browser walk-through, docs, and ship

- [ ] `e2e/recipes.spec.js` (shared 4203 server; use unique names):
  1. Add a recipe type "Hair rinse" (topical, icon leaf).
  2. Add a recipe "Rosemary hair rinse" of that type: yield 250 ml, one herb ingredient (Rosemary, 2 tbsp) and one free-text ingredient (Apple cider vinegar, 250 ml), two steps.
  3. On its page:
     - "Before you make it" sits above the ingredients and shows the patch-test reminder and Rosemary's cautions.
     - Scale to 2×: the vinegar shows 500 ml.
     - Rosemary's herb page lists the recipe.
  4. Delete the recipe and undo.
  5. Delete "Hair rinse" while it has the recipe, moving it to "other".

  Screenshots: `test-results/recipes.png` and `test-results/recipe.png`.
- [ ] README: change the stage line to Stage 3A. Add a Recipe book bullet in plain words, and add `![The recipe book](docs/screenshots/recipes.jpg)` from a temporary stocked demo (`APOTHECARY_DEMO_DATA_DIR=C:\ap-shot-3a`, port 4205), JPEG under 400 KB, then shut it down and delete the folder. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence recording (headless, data folder `C:\ap-evidence-3a`), pushed to the `evidence` branch under `stage-3a/`. Check that no two screenshots are identical. Open the PR and run greploop to 5/5.
- [ ] **(ask)** Merge. Then back up the installed app (`POST /api/backups`), `npm run stop`, pull, `npm run setup`, and start the task. Check that `/api/recipe-types` lists 22 types.
