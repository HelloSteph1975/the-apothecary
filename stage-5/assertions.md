# Evidence: Apothecary stage 5 (calendar and to-do)

Headless Chromium 1400x900 against a throwaway server (port 4203, empty data folder C:\ap-evidence-5). 12/12 passed.

| # | Check | Result | Elapsed | Screenshot |
|---|---|---|---|---|
| 1 | /todo shows Today tab empty state | PASS | 1.4 s | 01-todo-empty-passed.png |
| 2 | Add weekly high-priority task; shows on Today with High badge and repeat text (Every Tuesday and Saturday) | PASS | 1.5 s | 02-weekly-task-added-passed.png |
| 3 | Check done: toast shows Next: date; Upcoming lists next copy on right date (Next Oct 13, 2026; row: Evidence weekly watering Oct 13 Every Tuesday and Saturday High) | PASS | 1.6 s | 03-checked-done-next-passed.png |
| 4 | Low jar makes Restock task (Automatic badge, screenshot 04); dismiss with confirm text (04b) and it is gone (asserted count 0; same page as step 1); restock + lower returns it | PASS | 7.3 s | 04-restock-cycle-passed.png |
| 5 | Task repeating every full moon reads "Every full moon" | PASS | 1.1 s | 05-full-moon-task-passed.png |
| 6 | Month view: today outlined, moon glyphs+signs, next full moon, tasks shown (outline: solid 3px / border 1px none; 35 glyphs; full moon (this month): Sunday, October 25: full moon in Aries; 4 task entries) | PASS | 2.0 s | 06-calendar-month-tasks-passed.png |
| 7 | Unchecking Tasks filter hides tasks | PASS | 1.0 s | 07-tasks-filter-off-passed.png |
| 8 | Keyboard: ArrowRight on a focused day moves focus to next day (focus 2026-10-10 to 2026-10-11) | PASS | 1.0 s | 08-keyboard-arrow-passed.png |
| 9 | Day page: sky, Folk tradition, Due this day; add task prefills date and appears (day 2026-10-10) | PASS | 4.0 s | 09-day-page-add-task-passed.png |
| 10 | Week view | PASS | 1.2 s | 10-week-view-passed.png |
| 11 | Agenda view | PASS | 1.4 s | 11-agenda-view-passed.png |
| 12 | Today shows Tasks card listing the tasks due today | PASS | 1.6 s | 12-today-tasks-card-passed.png |
