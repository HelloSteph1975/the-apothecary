# Evidence: Apothecary stage 3b (batch journal)

Headless Chromium 1400x900 against a throwaway server (port 4203, empty data folder C:\ap-evidence-3b). 10/10 passed.

| # | Check | Result | Elapsed | Screenshot |
|---|---|---|---|---|
| 1 | Empty steeping state on /batches; Today says nothing is due | PASS | 2.6 s | 01-empty-batches-passed.png, 01b-today-nothing-due-passed.png |
| 2 | Set up jar "Evidence calendula" and recipe "Evidence calendula oil" through the UI | PASS | 2.9 s | 02-setup-recipe-passed.png |
| 3 | Make this recipe at Double: jar picked, draw 60 g, not-enough note, olive oil no-jar note | PASS | 1.9 s | 03-new-batch-double-passed.png |
| 4 | Start batch: short-stock dialog lists jar (has 50 g, drawing 60 g); confirm | PASS | 1.6 s | 04-short-stock-dialog-passed.png |
| 5 | Batch page: Steeping, Strain and bottle due +28 days, jar link with 50 g drawn | PASS | 1.1 s | 05-batch-page-passed.png |
| 6 | Cabinet jar is now used up | PASS | 1.1 s | 06-jar-used-up-passed.png |
| 7 | Today shows nothing due; add "Shake the jar" due today; Today lists it | PASS | 3.7 s | 07a-today-nothing-due-passed.png, 07-today-due-passed.png |
| 8 | Both steps done, Ready to finish; finish with 400 ml and add Oils and butters jar; Finished panel shows jar link | PASS | 6.2 s | 08a-ready-to-finish-passed.png, 08b-finish-dialog-passed.png, 08-finished-passed.png |
| 9 | Record sheet has every field label; print-media screenshot | PASS | 0.8 s | 09-record-sheet-print-passed.png |
| 10 | Delete batch (confirm mentions amounts stay drawn), toast, Undo restores it | PASS | 3.3 s | 10a-delete-confirm-passed.png, 10-undo-restored-passed.png |
