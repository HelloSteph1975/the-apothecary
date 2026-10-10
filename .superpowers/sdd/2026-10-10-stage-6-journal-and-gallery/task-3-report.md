# Task 3 report: Journal list, views, entry types

Done: lib/journal.jsx (TypeIcon, JOURNAL_ICONS, MOODS, skyStampText(sky, day), entryWhen), screens/journal/Journal.jsx (All, By type, By tag, By moon; ?view= in URL; debounced search; More entries paging; empty states), JournalTypes.jsx (types manager copied from RecipeTypes pattern), routes /journal and /journal/types, CSS (chip, chip-row). cabinet.test.jsx "being built" check now uses /labels.

Notes: skyStampText takes the entry date as a second argument for the weekday (sky has no day); without it the weekday is left out. By moon fetches each non-empty group's entries separately (view=moon&phase_group=g) so all four groups show entries. /journal/photos, /journal/new and /journal/:id links are not built yet (later tasks).

RED: with App.jsx reverted to HEAD, 15 of the new tests failed. GREEN: new tests plus cabinet test 20 passed. Full `npx vitest run`: 72 files, 991 tests passed. `npm run build` ok (existing chunk-size warning only).
Note: code was written before the tests in this run, RED was produced by reverting the routes.
