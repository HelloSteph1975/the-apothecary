# Evidence: Apothecary stage 3a (recipe book)

Headless Chromium 1400x900 against a throwaway server (port 4203, empty data folder C:\ap-evidence-3a). 10/10 passed.

| # | Check | Result | Elapsed | Screenshot |
|---|---|---|---|---|
| 1 | Empty recipe book at /recipes; 22 starter types at /recipes/types | PASS | 2.3 s | 01-preconditions-passed.png |
| 2 | Add type "Hair rinse" (For the skin, Leaf); appears in list | PASS | 2.5 s | 02-add-type-passed.png |
| 3 | Add "Rosemary hair rinse" with 2 ingredients and 2 steps; saved | PASS | 4.4 s | 03-add-recipe-passed.png |
| 4 | "Before you make it" above ingredients with patch-test reminder and Rosemary cautions | PASS | 1.1 s | 04-before-you-make-it-passed.png |
| 5 | Choose Double: status says scaled; vinegar shows 500 ml | PASS | 2.0 s | 05-scale-double-passed.png |
| 6 | Rosemary grimoire page lists the recipe under "Recipes with this herb" | PASS | 2.4 s | 06-herb-backlink-passed.png |
| 7 | Recipe card on list; filter by type Hair rinse narrows to it | PASS | 1.5 s | 07-list-and-filter-passed.png |
| 8 | Delete recipe: toast with Undo; Undo brings it back | PASS | 3.4 s | 08-delete-undo-passed.png |
| 9 | Delete "Hair rinse" type: dialog moves 1 recipe to "other"; recipe shows type other | PASS | 4.6 s | 09-delete-type-move-passed.png |
| 10 | New recipe with no name shows the field error | PASS | 2.0 s | 10-form-error-passed.png |
