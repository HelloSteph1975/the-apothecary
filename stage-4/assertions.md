# Evidence: Apothecary stage 4 (sky and tradition)

Headless Chromium 1400x900 against a throwaway server (port 4203, empty data folder C:\ap-evidence-4). 8/8 passed.

| # | Check | Result | Elapsed | Screenshot |
|---|---|---|---|---|
| 1 | Today shows sky line, next moon line, festival line; matches GET /api/sky - API: New in Libra, ruler Saturn, next festival Samhain | PASS | 1.1s | 01-today-sky-passed.png |
| 2 | The sky today card shows suggestions with Folk tradition label - 2 suggestion(s) | PASS | 1.1s | 02-sky-card-passed.png |
| 3 | Suggestions off then on - turned back on, suggestions return | PASS | 2.5s | 03-suggestions-off-passed.png |
| 4 | Timing rules manager: 19 starter rules, add, move up, delete + Undo - 19 starter rules; moved position 20 to 19, focus stayed on Move up button; delete and Undo restored it | PASS | 3.3s | 04-timing-rules-passed.png |
| 5 | Add recipe, Make this recipe: Good days to start, pick first day - 10 reason line(s); picked "Sun, Oct 11: waxing crescent in Scorpio"; start date 2026-10-10 -> 2026-10-11; plan re-ran: yes | PASS | 2.5s | 05-start-dates-passed.png |
| 6 | Start the batch; subtitle shows sky on start date - subtitle: Evidence moon tincture (tincture), started Oct 11, 2026, waxing crescent in Scorpio, Sunday under Sun Steeping | PASS | 0.6s | 06-batch-page-passed.png |
| 7 | Record sheet Date field shows the sky in parentheses (print media) - Date: Started Oct 11, 2026 (waxing crescent in Scorpio, Sunday under Sun) | PASS | 0.3s | 07-record-sheet-passed.png |
| 8 | GET /api/sky?date=1800-01-01 returns 400 - status 400, body {"error":"Please fix the highlighted fields.","details":{"date":"Pick a date between 1900 and 2100"}} | PASS | 0.4s | 08-sky-400-passed.png |
