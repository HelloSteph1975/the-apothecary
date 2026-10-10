# The Apothecary, Stage 5: Calendar and To-do Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Calendar and To-do drawers work.
- **Tasks.** A task has a title, notes, an optional due date, a repeat, a priority, a related record and photos.
  - Repeats can be daily, weekly on chosen days, monthly, every new moon, every full moon, or each festival.
  - The app makes automatic tasks for batch steps due, jars to restock and jars nearing expiry. She can edit, snooze or dismiss them, and a dismissed one stays away until its cause changes.
- **To-do views:** today, upcoming, by area, and done.
- **Calendar.** It has month, week and agenda views. Each day shows its moon phase glyph and sign, with festivals and new and full moons marked. Batch steps, tasks and jar expiry dates appear on it, and filters show or hide each kind. A day page shows that day's sky, suggestions and everything due, with buttons to add a task or start a batch on that day.
- **Today** gets a Tasks card for what's due today and overdue.

**Architecture:**
- Migration 7 adds `tasks` and `task_dismissals`.
- `server/lib/repeat.js` works out the next due date for every repeat kind. It uses `server/lib/sky.js` for moons and festivals.
- `server/services/tasks.js` handles create, edit, complete (spawning the next repeat), snooze, dismiss and the four views. Its `syncAutoTasks` makes and clears automatic tasks from batch steps and jars each time tasks are read.
- `server/services/calendar.js` builds a date range of days (lean sky facts and markers) and events (batch steps, tasks, jar expiry).
- The client adds `/todo`, a task page, `/calendar` with three views and filters, `/calendar/:day`, and the Today card.

**Tech Stack:** Same as Stages 1 to 4.

**Spec:** `docs/superpowers/specs/2026-10-08-the-apothecary-design.md`, sections "Calendar", "To-do list", "Today", "Photos".

**Later stages:**
- Journal entries on the calendar, and the journal button on the day page: Stage 6.
- Garden plantings, expected harvests, harvest tasks and the garden button: Stage 7.

The calendar's event list and the day page's buttons are built so those kinds slot in. This stage shows no placeholder buttons for them.

## Global Constraints

- Node 24+. App port 4197 (installed and running; never touch it), demo 4201, browser tests 4203, temporary screenshot demo 4205. Tests use temp folders only. Never touch `Documents\The Apothecary Data` or the real demo folder.
- Database changes only through migration 7, appended to `server/db/migrations.js`. Never edit migrations 1 to 6.
- Days are local days, as in Stage 4. Tests that depend on days pin `process.env.TZ` the way `tests/server/sky.test.js` does, or use the app's own local-today helper. Never hard-code "today" in a test.
- **Everything stays inside the app.** No calendar sync, no export to Google or other services, and no notifications outside the app.
- Route handlers read `ctx.db` inside each request.
- Soft deletes and undo as before. Photos cascade with the delete stamp (`PHOTO_OWNERS.task`).
- Folk timing suggestions on the day page follow Stage 4's rules: the "Folk tradition" label, never inside a caution panel, and hidden when `sky_suggestions` is off.
- Plain, warm wording, no em dashes.
- Use the shared components and hooks:
  - `Field`, `ParchmentCard`, `PageHeader`, `WaxSeal`/`WaxSealLink`;
  - `useDeleteWithUndo` (with `onUndo`), `useLeaveGuard`;
  - keyed route wrappers, a save guard, and an error with Try again;
  - dialogs that stay mounted, with inline `role="alert"` errors.
- Focus via `outline` with `--focus-color`; never `outline: none`. WCAG AA. The calendar grid is a real table with labelled cells, and you can move through days with the arrow keys.
- Branch `feat/stage-5-calendar-todo` in `C:\Users\S_Lip\dev\worktrees\the-apothecary-stage-5`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Repeat rules (`server/lib/repeat.js`)

`nextDue(task, fromDay, { hemisphere }) -> 'YYYY-MM-DD' | null`. It returns the first date strictly after `fromDay`, where `fromDay` is the task's due date, or today when the task has none.

| repeat_kind | next due |
|---|---|
| none | null |
| daily | fromDay + 1 day |
| weekly | the next day after fromDay whose weekday (0 Sunday to 6 Saturday) is in `repeat_days`. An empty or missing list means the same weekday next week. |
| monthly | the same day of month in the next month. When that month is shorter, use its last day. The day of month comes from the task's original `repeat_anchor_day`, so the 31st stays the 31st where the month allows it. |
| new_moon | the local day of the next exact new moon after the end of fromDay |
| full_moon | the local day of the next exact full moon after the end of fromDay |
| festival | the day of the next festival after fromDay, using her hemisphere |

## Automatic tasks

The `auto_key` holds the cause, so when the cause changes, a new key appears and a dismissed task can come back.

| source | auto_key | title | due_on | related | made when | cleared when |
|---|---|---|---|---|---|---|
| batch step | `step:<stepId>:<due_on>` | "<step title>: <batch name>" | step due_on | batch | open step on a live, unfinished batch, due within 7 days or overdue | step done, deleted, due date changed, batch finished or deleted |
| restock | `restock:<itemId>:<purchaseCount>` | "Restock <item name>" | today, on the day it's made | item | live, not used up, `low_threshold` set and `amount <= low_threshold` | amount above threshold, item used up or deleted |
| expiry | `expiry:<itemId>:<expires_on>` | "Use or replace <item name>" | `expires_on` | item | live, not used up, expires within 30 days or already expired | expiry changed, item used up or deleted |

- **Sync.** `syncAutoTasks(db, today)` runs in one transaction at the start of every task list, Today and calendar read.
  - It inserts missing auto tasks (`kind = 'auto'`), unless a dismissal row exists for that key.
  - It hard-deletes open auto tasks whose cause is gone. These are app-made rows, so nothing of hers is lost.
  - It never touches done auto tasks, so her history stays.
- **Completing.** Completing a step task also marks that batch step done (`done_on` = today). Completing a restock or expiry task just marks it done. If the cause is still true later, the same key is not recreated, because a done row with that key exists.
- **Dismissing.** Dismissing writes `task_dismissals(auto_key)` and deletes the task. The task returns only when the key changes: a new step due date, a restock (purchase count goes up), or a new expiry date.
- **Editing.** She can edit an auto task's title, notes, priority and snooze, but not its due date or related record.

## File map

```
server/db/migrations.js            + migration 7 (tasks, task_dismissals)
server/db/repos.js, server/schemas.js   + tasks, taskSchema, REPEAT_KINDS, PRIORITIES, RELATED_TYPES
server/lib/repeat.js               nextDue
server/services/tasks.js           create/update/complete/uncomplete/snooze/dismiss, views, syncAutoTasks
server/services/calendar.js        range days + events
server/services/today.js           + tasks (due today and overdue)
server/services/photos.js          PHOTO_OWNERS += task
server/services/purge.js           + tasks, dismissals for dead keys, task photos
server/routes/tasks.js, server/routes/calendar.js
server/demo/seed.js                SEED_VERSION '6', a few tasks
client/src/lib/tasks.js, client/src/lib/moonGlyph.jsx   repeat text, priority text, small SVG moon phase glyphs (original)
client/src/screens/todo/Todo.jsx, TaskForm.jsx, TaskPage.jsx
client/src/screens/calendar/Calendar.jsx, MonthView.jsx, WeekView.jsx, AgendaView.jsx, DayPage.jsx
client/src/screens/Today.jsx       Tasks card
client/src/App.jsx                 routes; /calendar and /todo leave the "being built" list
tests/server/repeat.test.js, tasks*.test.js, calendar.test.js, tests/client/todo*, calendar*, daypage, e2e/calendar-todo.spec.js
```

---

### Task 1: Data layer and repeat rules

**Files:** `server/db/migrations.js`, `server/db/repos.js`, `server/schemas.js`, `server/services/photos.js`, `server/services/purge.js`, and create `server/lib/repeat.js`. Tests: `tests/server/repeat.test.js` and `tests/server/tasks-db.test.js`; extend `purge.test.js`.

**Interfaces produced:**
- Migration 7:

```sql
CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, notes TEXT, due_on TEXT,
  repeat_kind TEXT NOT NULL DEFAULT 'none' CHECK (repeat_kind IN ('none','daily','weekly','monthly','new_moon','full_moon','festival')),
  repeat_days TEXT NOT NULL DEFAULT '[]', repeat_anchor_day INTEGER CHECK (repeat_anchor_day IS NULL OR repeat_anchor_day BETWEEN 1 AND 31),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  related_type TEXT CHECK (related_type IS NULL OR related_type IN ('item','recipe','batch','herb')), related_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','auto')), auto_key TEXT,
  snoozed_until TEXT, done_on TEXT, spawned_id INTEGER, ${TS});
CREATE UNIQUE INDEX idx_tasks_auto_key ON tasks(auto_key) WHERE auto_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_tasks_due ON tasks(due_on) WHERE done_on IS NULL AND deleted_at IS NULL;
CREATE TABLE task_dismissals (auto_key TEXT PRIMARY KEY, dismissed_on TEXT NOT NULL);
```

- `REPEAT_KINDS`, `PRIORITIES = ['low','normal','high']` and `RELATED_TYPES = ['item','recipe','batch','herb']`.
- `taskSchema = { title: 'string!', notes: 'string', due_on: 'date', repeat_kind: { type: REPEAT_KINDS, nullable: false }, priority: { type: PRIORITIES, nullable: false }, related_type: RELATED_TYPES, related_id: 'int', snoozed_until: 'date' }`. The service checks `repeat_days` as an array of distinct integers 0 to 6. Match the existing schema style.
- Repo `tasks` (`orderBy: 'due_on IS NULL, due_on, id'`).
- `PHOTO_OWNERS.task = 'tasks'`.
- `nextDue` follows the repeat rules table.
- Purge:
  - photos of old-deleted tasks, then the old-deleted tasks themselves;
  - dismissal rows whose cause can never recur: steps or items that no longer exist at all;
  - when items, recipes, batches or herbs are purged, null `related_type` and `related_id` on tasks pointing at them.

- [ ] Tests first:
  - `nextDue` for each kind:
    - weekly across a week end, and weekly with no days;
    - monthly from Jan 31 to Feb 28 (and Feb 29 in 2028), then back to Mar 31;
    - new and full moon against Stage 4's known 2024 dates (TZ pinned);
    - a festival across the year end in both hemispheres.
  - The migration creates the tables, and the unique auto_key index allows a second key only once the first is deleted.
  - `PHOTO_OWNERS.task` exists.
  - Purge unlinks related records and keeps dismissals for live causes.
- [ ] See them fail. Implement. Full vitest. Commit "Add the task tables and repeat rules".

### Task 2: Task service, automatic tasks and routes

**Files:** Create `server/services/tasks.js` and `server/routes/tasks.js`. Modify `server/routes/index.js`, `server/services/today.js` and `server/services/batches.js` (export what the step sync needs; no behaviour change). Tests: `tests/server/tasks.test.js`, `tests/server/auto-tasks.test.js`; extend `today.test.js`.

**Interfaces produced:**
- `syncAutoTasks(db, today)` follows the "Automatic tasks" section.
- `GET /api/tasks?view=today|upcoming|area|done&today=YYYY-MM-DD` runs the sync first, then lists by view:
  - `today`: open, not snoozed past today, due on or before today. Overdue first, then high priority first, then title.
  - `upcoming`: open and due after today, or with no due date. Due date first (no-date tasks last), then priority. Snoozed tasks show with their snooze date.
  - `area`: open tasks grouped `{ item: [], recipe: [], batch: [], herb: [], none: [] }`.
  - `done`: the 100 most recently done, newest first.
  - Each row is `{ id, title, notes, due_on, repeat_kind, repeat_days, priority, related: { type, id, name, live } | null, kind, auto_key, snoozed_until, done_on, overdue, cover }`.
- `GET /api/tasks/:id` returns the row plus `photos`.
- `POST` and `PATCH /:id`:
  - Repeats need a due date. If `repeat_kind` isn't `none` and `due_on` is empty, the server sets `due_on` to today.
  - `repeat_anchor_day` is set from `due_on` when a monthly repeat is saved.
  - The related record must exist and be live: 400 `details.related_id`.
  - For an auto task, only title, notes, priority and snoozed_until can be changed (400 for anything else).
- `POST /api/tasks/:id/complete { today }`:
  - It marks the task done. For a repeat, it also creates the next task (a copy with `due_on = nextDue`, `done_on` null, and the photos not copied).
  - For a step auto task, it marks the batch step done.
  - It returns `{ task, next }`.
- `POST /api/tasks/:id/uncomplete`:
  - It clears `done_on`.
  - When a repeat's spawned next task is still open and untouched (same title, due date and notes, and not done), it soft-deletes that next task. The completed task records the spawned task in `spawned_id` (a column in migration 7) so it can find it.
- `POST /api/tasks/:id/snooze { until }`: the date must be after today.
- `POST /api/tasks/:id/dismiss` is for auto tasks only (400 for manual ones). It writes the dismissal and deletes the task.
- `DELETE /:id` (soft, with photos) and `POST /:id/restore`.
- Today: `todaySummary` adds `tasks` (the today view, capped at 8) and `counts.tasks`.

- [ ] Tests first:
  - Each view's contents and order, and the snooze filtering.
  - Creating with a repeat sets a due date, and monthly gets its anchor day.
  - Completing a repeat spawns the next task. Uncompleting removes it (or leaves it alone once she has edited it).
  - The related record check.
  - Auto tasks:
    - each source is made and cleared;
    - a dismissed one stays away until its key changes (a restock, or a new expiry date);
    - completing a step task marks the step done;
    - editing an auto task's due date gives a 400.
  - Today tasks.
- [ ] See them fail. Implement. Full vitest. Commit "Add tasks, repeats and automatic tasks to the API".

### Task 3: The To-do drawer

**Files:** Create `client/src/lib/tasks.js`, `client/src/screens/todo/Todo.jsx`, `TaskForm.jsx` and `TaskPage.jsx`. Modify `client/src/App.jsx` and CSS. Tests: `tests/client/todo.test.jsx`, `taskform.test.jsx` and `taskpage.test.jsx`. Update the "being built" check in `tests/client/cabinet.test.jsx` so it uses `/journal`.

- **`lib/tasks.js`:**
  - `repeatText(task)` gives "Every day", "Every Monday and Thursday", "Every month on the 31st", "Every new moon", "Every full moon" or "Each festival".
  - `priorityText`.
  - `relatedLink(related)` gives the route for each type.
- **`/todo`:**
  - `PageHeader` "To-do", subtitle "What needs doing, and when".
  - The "Add a task" action opens the task form.
  - Tabs Today, Upcoming, By area and Done, kept in the URL as `?view=`.
- **Each task row:**
  - A checkbox labelled with its own name ("Done: <title>"). Checking it calls complete and shows "Next: <date>" in a toast when a repeat spawns.
  - The title links to `/todo/:id`.
  - The due date shows as "Today", "Tomorrow", "Overdue since Oct 3" (in oxblood) or a plain date, with the repeat text, a priority badge for high, the related record link, and an "Automatic" badge for auto tasks.
  - Each row has a menu with:
    - Snooze (1 day, 3 days, 1 week, or pick a date);
    - Dismiss (auto tasks only, with the confirm text "Dismiss this? It comes back only if things change.");
    - Delete (manual tasks only, with undo).
- **Done tab:** unchecking calls uncomplete.
- **By area:** groups for Jars, Recipes, Batches, Herbs and Other.
- **Empty states:**
  - Today: "Nothing due today. Enjoy the quiet."
  - Upcoming: "Nothing planned yet."
  - Done: "Nothing done yet."
- **`TaskForm`** is a dialog that stays mounted and is used to add and edit.
  - Fields: Title (required), Notes, Due date, Repeat (select), weekday checkboxes (only for weekly, in a `fieldset` with a `legend`), Priority, and Related to (a type select, then a record select of live records of that type).
  - It accepts prefills (`?due=` from the calendar and `?related=type:id`).
  - Auto tasks show only the fields she can change, plus the line "Made by the app from <related name>".
  - Errors are inline. Saves are guarded against double clicks. The dialog has a leave guard.
- **`/todo/:id`:**
  - Shows the title, all the fields as text, and the related link.
  - Photos use `PhotoGallery ownerType="task"`.
  - It has Edit, Delete (manual tasks) or Dismiss (auto tasks), and Done/Undo done.

- [ ] Tests first:
  - Tabs and the URL.
  - Row texts (today, tomorrow, overdue, repeat, high priority, automatic).
  - Checking, the toast with the next date, and unchecking in Done.
  - Snooze choices send the right date.
  - The dismiss confirm text, and delete with undo.
  - Form: a required title, weekdays shown only for weekly, the body shape, prefills, the restricted auto task form, and an inline error.
  - Task page fields and photos.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the To-do drawer".

### Task 4: Calendar API and the month, week and agenda views

**Files:** Create `server/services/calendar.js`, `server/routes/calendar.js`, `client/src/lib/moonGlyph.jsx`, and `client/src/screens/calendar/Calendar.jsx`, `MonthView.jsx`, `WeekView.jsx` and `AgendaView.jsx`. Modify `server/routes/index.js` and `App.jsx`. Tests: `tests/server/calendar.test.js`, `tests/client/calendar.test.jsx`.

**Interfaces produced:**
- `GET /api/calendar?from&to` returns `{ days: [...], events: [...] }`.
  - It allows at most 62 days, in years 1900 to 2100, using the same validation helper as `/api/sky`.
  - It runs `syncAutoTasks` first.
  - **days** are `{ day, phase, sign, ruler, festival, marker: 'new' | 'full' | 'first quarter' | 'last quarter' | null }`. They use `skyFacts`, plus the phase name for the marker.
  - **events** are `{ kind: 'step' | 'task' | 'expiry', day, title, link, done, overdue, id }`.
    - `step`: open and done steps on live batches.
    - `task`: open and done manual tasks with a due date, plus auto tasks except step tasks, because those already show as steps.
    - `expiry`: live, not used up items with `expires_on` in range.
- **`moonGlyph.jsx`:** `MoonGlyph({ phase, size })` draws a small original SVG for each of the 8 phases, with `aria-hidden`. The day's text gives the phase name for screen readers.
- **`/calendar`:**
  - `PageHeader` "Calendar", subtitle "The moon, the wheel, and what's due".
  - A view switch Month / Week / Agenda, plus Previous, Today and Next buttons.
  - Filter checkboxes "Batch steps", "Tasks" and "Jars to use up". The view, date and filters are all kept in the URL (`?view&date&hide=`).
- **Month view:**
  - A `<table>` with weekday column headers, starting on Sunday. Each cell is a button-like link to `/calendar/:day`.
  - Each cell shows the day number, the moon glyph, the sign's name (short form "Leo"), and a festival name or "Full moon" / "New moon" marker. It lists up to 3 events, then "+N more".
  - Today's cell is outlined. Days outside the month are muted.
  - The arrow keys move focus between days, and Enter opens the day.
  - Each cell's accessible name is "Friday, October 9: waxing crescent in Scorpio, 2 things due".
- **Week view:** seven columns with the same day header, listing every event.
- **Agenda view:** the next 30 days from the chosen date, showing only days that have events or markers, each as a heading with its events.

- [ ] Tests first:
  - Server: days and markers for a known month (pinned TZ), events from each source, done and overdue flags, range validation, the sync running, and step auto tasks not duplicated.
  - Client:
    - month grid structure and cell names;
    - arrow key focus moves;
    - filters hide kinds and update the URL;
    - Prev and Next change the month;
    - the week and agenda contents;
    - the "+N more" text.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add the calendar".

### Task 5: Day page and the Today tasks card

**Files:** Create `client/src/screens/calendar/DayPage.jsx`. Modify `server/services/timing.js` (export `daySuggestions(db, day, settings)`, the same as `todaySuggestions` for any day), `server/routes/calendar.js` (`GET /api/calendar/day/:day`), `client/src/screens/Today.jsx` and `App.jsx`. Tests: `tests/server/calendar.test.js` (day endpoint), `tests/client/daypage.test.jsx`, extend `today.test.jsx`.

- `GET /api/calendar/day/:day` returns `{ sky: skyForDay(day, { hemisphere }), suggestions, events }`. Suggestions are `[]` when off. For today it passes `now` as in Stage 4.
- **`/calendar/:day`:**
  - `PageHeader` with the long date, and the sky line as its subtitle.
  - A "Sky" card: phase and how much is lit, the sign and any sign changes, the ruler, and the festival.
  - A "Folk timing" card with suggestions and their label. It's hidden when suggestions are off.
  - A "Due this day" list of events with links and checkboxes for tasks. Checking one completes it.
  - Buttons:
    - "Add a task for this day" opens the task form with `?due=`.
    - "Start a batch on this day" goes to `/batches/new?start=<day>`. The new batch page must read `start`. Add that small change and a test in the newbatch tests.
  - Previous and next day links.
- **Today:** a "Tasks" card (subtitle "due today and overdue") listing the tasks with a done checkbox each, "See all" to `/todo`, and the empty text "Nothing due today."
  - Card order: Tasks, The sky today, Batches due, Running low, Nearing expiry, Herb of the day.

- [ ] Tests first:
  - The day endpoint's shape, and suggestions off.
  - Day page sections, the add-task prefill, the start-batch link, the completion checkbox, and prev/next.
  - The new batch page reads `?start=`.
  - The Today card, its empty state and completion.
- [ ] See them fail. Implement. Full vitest and build. Commit "Add day pages and the Today tasks card".

### Task 6: Demo, browser walk-through, docs and ship

- [ ] **Demo:** `SEED_VERSION` '6'. Add three manual tasks:
  - "Water the rosemary" (weekly on Mon and Thu);
  - "Make moon water" (every full moon);
  - "Label the new tinctures" (due in 2 days, high priority, related to the calendula batch).

  Automatic tasks come from the demo jars and steps. Reset clears tasks and dismissals, children first. v5 folders get the tasks once, only when they have none. The tests mirror the earlier demo tests.
- [ ] **`e2e/calendar-todo.spec.js`** (port 4203, unique names):
  1. Add a weekly task due today, check it done, and see the next date in the toast and on Upcoming.
  2. A jar at its low threshold shows an automatic Restock task. Dismiss it and it's gone. Restock the jar, then lower it again, and the task comes back.
  3. On the calendar month view, the day cell names are present and the full moon marker shows. Open a day page and add a task for that day, and it appears there.
  4. On Today, the Tasks card lists it.

  Take screenshots `test-results/calendar.png` and `test-results/todo.png`.
- [ ] **README:** change the stage line to Stage 5. Add Calendar and To-do bullets, and add `![The calendar](docs/screenshots/calendar.jpg)` from a temporary stocked demo (`C:\ap-shot-5`, port 4205), as a JPEG under 400 KB. Run unslop.
- [ ] Final whole-branch review, one fix wave, scoped re-review.
- [ ] Evidence (headless, `C:\ap-evidence-5`), pushed to `evidence/stage-5/`, with no duplicate screenshots. Then the PR, and greploop to 5/5 with zero open threads.
- [ ] **(ask)** Merge. Then back up (or confirm the nightly backup), `npm run stop`, pull, `npm run setup`, start the task, and check that `/api/tasks?view=today` and `/api/calendar` answer.
