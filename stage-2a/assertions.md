# Evidence: Apothecary stage 2a (herb cabinet)

Headless Chromium 1400x900 against a throwaway server (port 4203, empty data folder C:\ap-evidence-2a). 12/12 passed.

| # | Check | Result | Elapsed | Screenshot |
|---|---|---|---|---|
| 1 | Precondition: Today shows "Nothing here yet" and "Stock the cabinet" for the empty cabinet | passed | 2.4s | 01-today-empty-passed.png |
| 2 | Suppliers tab starts empty ("No suppliers yet") | passed | 4.7s | 02-suppliers-empty-passed.png |
| 3 | Add supplier Moonvale Botanicals (rating 5, website https://example.com); it appears in the list | passed | 6.1s | 03-supplier-listed-passed.png |
| 4 | Add Calendula: form fills; Date bought defaults to today and Use by gets a suggested date | passed | 10.4s | 04-calendula-form-passed.png |
| 5 | Save Calendula: item page opens and shows "Running low" (40 g is at or below 50) | passed | 15.7s | 05-calendula-running-low-passed.png |
| 6 | Restock 100 g at 7.50: amount shows 140 g, purchases table has 2 rows, Running low gone | passed | 17.3s | 07-restocked-passed.png |
| 7 | Add supply "30 ml amber dropper bottle" (Containers, 24 Count, low 6, Gifted or traded, from Rowan) | passed | 21.7s | 08-dropper-saved-passed.png |
| 8 | Shelves shows the dropper bottle with "Gifted by Rowan" and an "Empty shelves" card listing other sections | passed | 26.9s | 09-shelves-passed.png |
| 9 | Upload a PNG on Calendula's page; it shows as the cover thumbnail on Shelves | passed | 28.2s | 11-shelves-cover-passed.png |
| 10 | Today: Calendula (140 g, above 50) is not listed as running low; nothing is past its best | passed | 32.5s | 12-today-stocked-passed.png |
| 11 | Delete the dropper bottle: focus starts on "Keep it", then Delete confirms | passed | 33.8s | 14-deleted-toast-passed.png |
| 12 | Undo from the toast brings the dropper bottle back on Shelves | passed | 37.2s | 15-undo-restored-passed.png |
