Headless Chromium 1400x900 against a throwaway server (port 4203, empty data folder C:\ap-evidence-8). 8/8 passed.

| # | Check | Result | Elapsed | Screenshot |
|---|---|---|---|---|
| 01 | Low jar is on the shopping list with its last supplier and price, grouped by section then supplier | PASS | 4.6s | 01a-list-by-supplier.png |
| 02 | Add your own item, check it, Bought opens the new-jar form prefilled; save and it shows checked | PASS | 16.3s | 02-item-still-checked-passed.png |
| 03 | Clear checked removes the item; Undo brings it back | PASS | 2.5s | 03-brought-back-passed.png |
| 04 | Restock the low jar above its threshold and it leaves the list | PASS | 2.3s | 04-low-jar-gone-passed.png |
| 05 | Print a label from a jar page: jar picked, add a batch, Medium rectangle, 2 copies, start at 9, two sheets | PASS | 3.5s | 05-labels-two-sheets-passed.png |
| 06 | Edit the caution text; preview shows it; print view shows only the sheets | PASS | 2.4s | 06a-print-view.png |
| 07 | Save as PDF: toast names the file, Saved PDFs lists it, the file is a real PDF | PASS | 4.1s | 07-pdf-saved-passed.png |
| 08 | Small round and Large rectangle sizes each render in the preview | PASS | 3.1s | 08-large-rect-passed.png |
