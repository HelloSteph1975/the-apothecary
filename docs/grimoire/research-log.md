# Grimoire research log

How the starter entries in `server/data/grimoire/` were researched. One section per herb: the sources read, what was uncertain, and what was left out and why. The grimoire is for learning and isn't medical advice.

## Notes that apply to every entry

- **Safety sources.** Cautions come from the NCCIH "Herbs at a Glance" fact sheets where one exists and from the European Medicines Agency (EMA) Committee on Herbal Medicinal Products monographs (sections 4.2 to 4.8: duration, contraindications, warnings, interactions, pregnancy and lactation, side effects). Where the two differ, the entry gives both and keeps the more careful reading.
- **AHPA class.** The AHPA *Botanical Safety Handbook* isn't free to read, and no free source we cite states a class number for these herbs, so `ahpa_class` is null for all of them.
- **Planets.** Taken only from Culpeper's *Complete Herbal* (Project Gutenberg ebook 49513, an expanded later edition of his 1653 work). Where Culpeper assigns no planet, `planet` is null.
- **Element and gender.** Neither Culpeper nor Grieve gives these, and we found no accessible, citable source that states them for these herbs. By the controller's ruling (fix round 1) they are null in every entry rather than filled in from unsourced modern tradition.
- **Associations.** Kept short and drawn from folklore Grieve or Culpeper actually records on the pages cited.
- **Undated web pages.** NC State Extension Plant Toolbox pages show no date; their `year` is the year we read them (2026).
- **Dosages** are left out everywhere by design, even where a source gives them.

## Chamomile (Matricaria chamomilla)

Sources read:
- NCCIH, Chamomile: Usefulness and Safety (updated Nov 2024): https://www.nccih.nih.gov/health/chamomile
- EMA, EU herbal monograph on Matricaria recutita L., flos (7 July 2015): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-matricaria-recutita-l-flos-first-version_en.pdf
- Culpeper, The Complete Herbal, "Camomile" and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Chamomiles": https://www.botanical.com/botanical/mgmh/c/chammo49.html
- UW-Madison Extension, German Chamomile (revised May 2026): https://hort.extension.wisc.edu/articles/chamomile-matricaria-chamomilla/

Uncertain:
- The two safety sources differ on pregnancy. NCCIH says little is known; the EMA says safety is established for the plain flower as a tea (its preparation a) but not for extracts. The entry gives both.
- Culpeper writes about Roman chamomile (Chamaemelum) and gives no planet of his own; he only reports that the Egyptians dedicated it to the Sun. `planet` is null, and the Sun story is kept in `notes`, credited to Culpeper.

Left out:
- Culpeper's and Grieve's claims about stones, agues, jaundice and infant convulsions: outdated medical claims.
- The EMA's long list of age limits per extract type, summed up as "not for babies under 6 months as a tea".

## Lavender (Lavandula angustifolia)

Sources read:
- NCCIH, Lavender: Usefulness and Safety (updated Feb 2025): https://www.nccih.nih.gov/health/lavender
- EMA, Community herbal monograph on Lavandula angustifolia P. Mill., flos (27 March 2012): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-lavandula-angustifolia-p-mill-flos_en.pdf
- Culpeper, The Complete Herbal, "Lavender" (Mercury) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Lavender": https://www.botanical.com/botanical/mgmh/l/lavend13.html
- NC State Extension Plant Toolbox, Lavandula angustifolia (undated): https://plants.ces.ncsu.edu/plants/lavandula-angustifolia/

Uncertain:
- The breast-swelling reports in children: NCCIH says the cause is unclear. The entry says the same and doesn't suggest a hormonal mechanism.
- The "Latin for washing" origin of the name is given by NCCIH; it's the usual account but not certain, so the entry says "usually traced".

Left out:
- Culpeper's claims for apoplexy, palsy and "falling-sickness", and his note that it expels the afterbirth: outdated and unsafe to repeat as uses.
- Any essential-oil dilution ratios: none of our sources gives them, and they would be dosage-like.

## Calendula (Calendula officinalis)

Sources read:
- EMA, EU herbal monograph on Calendula officinalis L., flos, Revision 1 (27 March 2018): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-calendula-officinalis-l-flos-revision-1_en.pdf
- Culpeper, The Complete Herbal, "Marigolds" (Sun, Leo) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Marigold": https://www.botanical.com/botanical/mgmh/m/marigo16.html
- UW-Madison Extension, Calendula (revised Aug 2025): https://hort.extension.wisc.edu/articles/calendula-calendula-officinalis/

Uncertain:
- NCCIH has no calendula fact sheet, so the EMA monograph is the only safety source. It is careful and specific (Asteraceae contraindication, skin sensitization, pregnancy not recommended), but it covers skin and mouth use only. Oral use beyond food is therefore described as "little is known".
- "Associations": Grieve records the Virgin Mary link and the belief that it blooms every month. "Constancy of bloom" is our short label for the second.

Left out:
- Grieve's long list of historical internal uses (fevers, eyesight, smallpox): outdated medical claims.
- The EMA posology tables: dosage.

## Peppermint (Mentha × piperita)

Sources read:
- NCCIH, Peppermint Oil: Usefulness and Safety (updated May 2025; also covers the leaf): https://www.nccih.nih.gov/health/peppermint-oil
- EMA, EU herbal monograph on Mentha x piperita L., folium, Revision 1 (15 January 2020): https://www.ema.europa.eu/en/documents/herbal-monograph/european-union-herbal-monograph-mentha-x-piperita-l-folium-revision-1_en.pdf
- Culpeper, The Complete Herbal, "Mint" (Venus) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Mints", Peppermint section: https://www.botanical.com/botanical/mgmh/m/mints-39.html
- NC State Extension Plant Toolbox, Mentha x piperita (undated): https://plants.ces.ncsu.edu/plants/mentha-x-piperita/

Uncertain:
- Planet: Culpeper's entry covers mints generally and describes spear mint. We used his Venus. Many modern magical herbals place peppermint under Mercury; we didn't cite one, so we kept Culpeper and said so in `notes`.
- Element and gender are null: no source we read states them for peppermint.
- Interactions: neither safety source names one. We didn't add the commonly repeated antacid and enteric-capsule warning because no source we read states it.

Left out:
- NCCIH's clinical findings on IBS, nausea and headaches: these are research results, not tradition, and the uses field is kept to tradition.
- Grieve's teething and sleep uses for children: conflicts with the modern warnings about menthol near small children.

## Lemon balm (Melissa officinalis)

Sources read:
- EMA, Community herbal monograph on Melissa officinalis L., folium (14 May 2013): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-melissa-officinalis-l-folium_en.pdf
- EMA product page (confirms the 2013 monograph is current; a periodic review opened in 2024): https://www.ema.europa.eu/en/medicines/herbal/melissae-folium
- Culpeper, The Complete Herbal, "Balm" (Jupiter, Cancer) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Balm": https://www.botanical.com/botanical/mgmh/b/balm--02.html
- UW-Madison Extension, Lemon Balm (revised May 2026): https://hort.extension.wisc.edu/articles/lemon-balm-melissa-officinalis/

Uncertain:
- NCCIH has no lemon balm fact sheet, and the MedlinePlus herb pages we hoped to check were withdrawn in July 2025. The EMA monograph is the only safety source. It says no interaction data exist. The entry's advice about sleep aids and sedatives is a precaution based on the EMA's drowsiness warning, not a documented interaction.
- Other references often mention a thyroid caution for lemon balm. We couldn't find it in a free source we could read, so it isn't stated. A verifier with access to a fuller reference may want to add it.
- Planet: Culpeper says Jupiter. Modern magical herbals often say Moon; we kept Culpeper.

Left out:
- Grieve's tea recipe quantities: dosage.

## Elderberry (Sambucus nigra, fruit)

Sources read:
- NCCIH, Elderberry: Usefulness and Safety (updated Nov 2024): https://www.nccih.nih.gov/health/elderberry
- EMA, Public statement on Sambucus nigra L., fructus (28 January 2014): https://www.ema.europa.eu/en/documents/public-statement/final-public-statement-sambucus-nigra-l-fructus_en.pdf
- Culpeper, The Complete Herbal, "The Elder Tree" (Venus): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Elder": https://www.botanical.com/botanical/mgmh/e/elder-04.html
- NC State Extension Plant Toolbox, Sambucus nigra (undated): https://plants.ces.ncsu.edu/plants/sambucus-nigra/

Uncertain:
- Family: elder used to sit in Caprifoliaceae and now sits in Adoxaceae (some newer treatments say Viburnaceae). We used Adoxaceae.
- NCCIH names raw or unripe berries, leaves and stems as cyanide-producing; NC State lists leaves, stems, roots and seeds as poisonous. Grieve calls the bark and leaves strongly purgative. The entry combines these into one plain warning and adds "always cook the berries", which NCCIH says removes the toxin.
- The EMA declined to write a monograph for the berry (incomplete traditional-use data), so there is no EMA safety guidance; the public statement is cited for that fact only.
- Energetics left null: none of our sources gives a clear traditional quality for the berry.

Left out:
- Grieve's "blood purifier" and similar claims; NCCIH's note on supplement regulation.

## Elderflower (Sambucus nigra, flower)

Sources read:
- EMA, EU herbal monograph on Sambucus nigra L., flos, Revision 1 (27 March 2018): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-sambucus-nigra-l-flos-revision-1_en.pdf
- NCCIH, Elderberry: Usefulness and Safety (for the poisonous leaves and stems): https://www.nccih.nih.gov/health/elderberry
- Culpeper, The Complete Herbal, "The Elder Tree" (Venus): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Elder": https://www.botanical.com/botanical/mgmh/e/elder-04.html
- NC State Extension Plant Toolbox, Sambucus nigra (undated): https://plants.ces.ncsu.edu/plants/sambucus-nigra/

Uncertain:
- NCCIH has no elderflower fact sheet and its elderberry sheet doesn't discuss the flowers, so the EMA monograph is the main safety source. It reports no side effects or interactions but doesn't recommend use in pregnancy, nursing or under 12.
- Grieve mentions the fresh flowers' odor as unpleasant to some and says the flowers are harmful to turkeys; neither is relevant to people and both are left out.

Left out:
- Grieve's spring "blood purifier" claim: outdated.
- Fritters and other recipes we couldn't tie to a source we read.

## Echinacea (Echinacea purpurea)

Sources read:
- NCCIH, Echinacea: Usefulness and Safety (updated Nov 2024): https://www.nccih.nih.gov/health/echinacea
- EMA, EU herbal monograph on Echinacea purpurea (L.) Moench, herba recens (24 November 2015): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-echinacea-purpurea-l-moench-herba-recens_en.pdf
- Grieve, A Modern Herbal, "Echinacea": https://www.botanical.com/botanical/mgmh/e/echina01.html
- Missouri Department of Conservation field guide, Purple Coneflower (undated; year is when read): https://mdc.mo.gov/discover-nature/field-guide/purple-coneflower
- NC State Extension Plant Toolbox, Echinacea purpurea (undated): https://plants.ces.ncsu.edu/plants/echinacea-purpurea/

Uncertain:
- The EMA monograph covers the fresh flowering herb of E. purpurea (pressed juice by mouth, and skin use), not the root. Its duration limits (10 days by mouth, 1 week on skin) are applied to the herb as a whole here as a careful reading.
- Grieve writes mainly about E. angustifolia root and lists outdated uses (septicaemia, syphilis, diphtheria). Only her description of the taste is used.
- No root-harvest timing is given because none of our sources states one.

Left out on purpose:
- Planet, element, gender and associations: echinacea is a North American plant that Culpeper never described, and we found no well-established folk correspondence for it. All left null or empty rather than invented.
- The Native American uses are given as NCCIH states them, without detail we couldn't source.

## Ginger (Zingiber officinale)

Sources read:
- NCCIH, Ginger: Usefulness and Safety (updated Feb 2025): https://www.nccih.nih.gov/health/ginger
- EMA, EU herbal monograph on Zingiber officinale Roscoe, rhizoma, Revision 1 (dated 7 May 2025): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-zingiber-officinale-roscoe-rhizoma-revision-1_en.pdf
- Rubin, Patel, Dietrich, "Effects of Oral Ginger Supplementation on the INR", Case Reports in Medicine 2019: https://pmc.ncbi.nlm.nih.gov/articles/PMC6594244/
- Jiang et al., "Effect of ginkgo and ginger on ... warfarin in healthy subjects", Br J Clin Pharmacol 2005: https://pmc.ncbi.nlm.nih.gov/articles/PMC1884814/
- Culpeper, The Complete Herbal, simples list ("Zingiberis", hot and dry in the second degree): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Ginger": https://www.botanical.com/botanical/mgmh/g/ginger13.html
- UW-Madison Extension, Ginger (revised Sept 2026): https://hort.extension.wisc.edu/articles/ginger-zingiber-officinale/
- UF/IFAS, Ginger, Galangal, and Turmeric Production in Florida (page shows 2024; no explicit publication year): https://ask.ifas.ufl.edu/publication/EP638

Uncertain:
- Blood thinners: neither NCCIH nor the EMA mentions them (the EMA says "none known"). The warning rests on the 2019 case report, which also summarizes two earlier case reports and an observational study linking ginger with bleeding in anticoagulated patients, balanced against the 2005 healthy-volunteer study that found no effect. The entry states that evidence is mixed and still advises talking to the prescriber. We didn't weaken this to match the EMA.
- Pregnancy: NCCIH ("may be safe, ask a provider") and the EMA ("preferable to avoid as a precaution") lean different ways. Both are given.

Left out:
- Planet: Culpeper lists ginger only among his simples and doesn't assign a planet, so `planet` is null. Element and gender are null for lack of a source (see the general note).
- Associations: none found in a source we read.
- The EMA's motion-sickness amounts: dosage.

## Garlic (Allium sativum)

Sources read:
- NCCIH, Garlic: Usefulness and Safety (updated Feb 2025): https://www.nccih.nih.gov/health/garlic
- EMA, EU herbal monograph on Allium sativum L., bulbus (18 July 2017): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-allium-sativum-l-bulbus_en.pdf
- Culpeper, The Complete Herbal, "Garlick" (Mars) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Garlic": https://www.botanical.com/botanical/mgmh/g/garlic06.html
- UW-Madison Extension, Garlic (revised Oct 2023): https://hort.extension.wisc.edu/articles/garlic-allium-sativum/

Uncertain:
- `parts_used`: "bulb". The grimoire's part list gained "bulb" in Stage 2B batch 2 for this entry; it was first filed under "root". The jar plant-part list is unchanged.
- Family: Amaryllidaceae (APG IV); older books put garlic in Liliaceae or Alliaceae.
- The saquinavir/ritonavir contraindication comes from the EMA monograph. NCCIH's current sheet names only anticoagulants and aspirin.
- Grieve's Odyssey story: she calls the protective herb a yellow garlic; scholars dispute what Homer's "moly" was, so the entry says "a garlic-like herb".

Left out:
- Culpeper's and Grieve's claims for worms, plague sores, dropsy and scrofula: outdated.
- Grieve's syrup recipe amounts: dosage.
- "Four Thieves vinegar" is described as said to guard against plague, framed as folklore only.

## Rosemary (Salvia rosmarinus)

Sources read:
- EMA, EU herbal monograph on Rosmarinus officinalis L., folium, Revision 1 (29 May 2024): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rosmarinus-officinalis-l-folium-revision-1_en.pdf
- EMA, EU herbal monograph on Rosmarinus officinalis L., aetheroleum, Revision 1 (29 May 2024): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-rosmarinus-officinalis-l-aetheroleum-revision-1_en.pdf
- Culpeper, The Complete Herbal, "Rosemary" (Sun, "the celestial Ram") and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Rosemary": https://www.botanical.com/botanical/mgmh/r/rosema17.html
- NC State Extension Plant Toolbox, Salvia rosmarinus (undated): https://plants.ces.ncsu.edu/plants/salvia-rosmarinus/

Uncertain:
- NCCIH has no rosemary fact sheet, so the two EMA monographs are the safety sources. Both say safety in pregnancy and nursing isn't established and don't recommend use then. Neither discusses food amounts, so the entry says the advice is about medicinal preparations rather than claiming food amounts are safe.
- The bile-duct and liver warning is in the EMA's special warnings for oral use ("conditions that require medical supervision"), so the entry says "without medical supervision" rather than "never".
- `zodiac`: Culpeper says "under the celestial Ram", which is Aries.

Left out:
- Culpeper's claims for jaundice, palsy, "falling-sickness" and plague, and his advice to take drops of the oil by mouth: outdated and unsafe.
- Grieve's rosemary wine for a weak heart and dropsy: outdated medical claims.
- EMA bath and tea amounts: dosage.

## Thyme (Thymus vulgaris)

Sources read:
- EMA, Community herbal monograph on Thymus vulgaris L. and Thymus zygis L., herba (12 November 2013): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-thymus-vulgaris-l-and-thymus-zygis-l-herba_en.pdf
- EMA, EU herbal monograph on Thymus vulgaris L. and Thymus zygis L., aetheroleum, Revision 1 (8 July 2020): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-thymus-vulgaris-l-thymus-zygis-l-aetheroleum-revision-1_en.pdf
- Culpeper, The Complete Herbal, "Thyme" ("a notable herb of Venus"), "Wild Thyme" (Venus, Aries) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Thyme, Garden": https://www.botanical.com/botanical/mgmh/t/thygar16.html
- NC State Extension Plant Toolbox, Thymus vulgaris (undated): https://plants.ces.ncsu.edu/plants/thymus-vulgaris/

Uncertain:
- Planet: Culpeper's garden-thyme entry gives no formal "under the dominion of" line but calls it "a notable herb of Venus", so `planet` is Venus. His Aries placement is for wild thyme only, so `zodiac` is empty and the Aries note sits in `notes`.
- The Lamiaceae allergy contraindication is in the herb monograph; the oil monograph says only "hypersensitivity". The entry applies the wider warning to both as the careful reading.
- Age limits differ by preparation (under 4 or under 12 for the herb; under 18 by mouth and under 3 in baths for the oil). The entry summarizes them as "most" rather than listing each.

Left out:
- Culpeper's claims that thyme brings on periods, eases labor and "brings away the after birth": not repeated as uses. They are mentioned only in the pregnancy caution as a reason for care.
- Grieve's use of thymol against worms and as a surgical antiseptic: outdated medical claims, and dosage-like.

## Sage (Salvia officinalis)

Sources read:
- NCCIH, Sage: Usefulness and Safety (updated April 2025): https://www.nccih.nih.gov/health/sage
- EMA, EU herbal monograph on Salvia officinalis L., folium, Revision 1 (20 September 2016): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-salvia-officinalis-l-folium-revision-1_en.pdf
- NICHD, LactMed: Sage (revised 2025; read through the Europe PMC record because NCBI blocks automated reading): https://www.ncbi.nlm.nih.gov/books/NBK501816/
- Culpeper, The Complete Herbal, "Sage" (Jupiter) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Sages": https://www.botanical.com/botanical/mgmh/s/sages-05.html
- UW-Madison Extension, Sage (revised May 2026): https://hort.extension.wisc.edu/articles/sage-salvia-officinalis/

Uncertain:
- Seizures: the EMA reports convulsions, a racing heart, dizziness and a feeling of heat from sage oil taken in amounts equal to more than about 15 g of leaf; LactMed calls thujone and camphor neurotoxic at high doses. No source we read says people with epilepsy must avoid sage, so the entry states the seizure risk plainly but doesn't add an epilepsy contraindication. A verifier with a fuller reference may want to.
- Interactions: neither safety source names one. The blood-sugar and anticonvulsant interactions sometimes listed elsewhere aren't in our sources, so they aren't stated. NCCIH says evidence on blood sugar is too thin to judge.
- The EMA says long-term use for sweating is possible, while NCCIH warns that long or high use may be unsafe. The entry gives the more careful reading.

Left out:
- Culpeper's claims that sage expels a dead child, stays abortion and causes fruitfulness: unsafe to repeat as uses.
- Grieve's nine-mornings cure for ague and her drop doses of the oil.
- NCCIH's research findings on hot flashes, memory and cholesterol: research results, not tradition.

## Nettle (Urtica dioica)

Sources read:
- EMA, EU herbal monograph on Urtica dioica L.; Urtica urens L., herba, Revision 1 (22 January 2025): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-urtica-dioica-l-urtica-urens-l-herba-revision-1_en.pdf
- EMA, EU herbal monograph on Urtica dioica L.; Urtica urens L., radix, Revision 1 (22 January 2025): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-urtica-dioica-l-urtica-urens-l-radix-revision-1_en.pdf
- EMA, Community herbal monograph on Urtica dioica L., Urtica urens L., folium (14 January 2010; read for comparison, not cited): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-urtica-dioica-l-urtica-urens-l-folium_en.pdf
- Memorial Sloan Kettering, About Herbs: Nettle (updated 7 December 2021): https://www.mskcc.org/cancer-care/integrative-medicine/herbs/nettle
- NICHD, LactMed: Stinging Nettle (revised 2026; read through the Europe PMC record): https://www.ncbi.nlm.nih.gov/books/NBK501777/
- Culpeper, The Complete Herbal, "Nettles" (Mars) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Nettles": https://www.botanical.com/botanical/mgmh/n/nettle03.html
- NC State Extension Plant Toolbox, Urtica dioica (undated): https://plants.ces.ncsu.edu/plants/urtica-dioica/

Uncertain:
- NCCIH has no nettle fact sheet. Interactions come from MSK, which bases the diuretic, blood-pressure and CYP450 cautions on animal or theoretical data and says clinical relevance isn't known; the entry says so. The blood-sugar caution rests on MSK's report of improved glucose control in a diabetes study and a case of low blood sugar.
- Lithium: some references warn about diuretic herbs and lithium. None of our sources mentions it for nettle, so it isn't stated. A verifier with a fuller reference may want to add it.
- Pregnancy: the herb monograph says not recommended; the root monograph says "not relevant" because it covers prostate use only. The entry follows the herb monograph.
- `taste` is null: no source we read describes it.

Left out:
- Culpeper's claims for stones, mad-dog bites and poison antidotes, and Grieve's "blood purifier" and diabetes anecdote: outdated or unsupported.
- Deliberate stinging (urtication) for rheumatism, which Grieve describes: not something to suggest.
- The EMA root dose: dosage.

## Holy basil (Ocimum tenuiflorum)

Sources read:
- MSD Manual Professional Version, Holy Basil (full review July 2025, by Laura Shane-McWhorter): https://www.msdmanuals.com/professional/special-subjects/dietary-supplements/holy-basil
- Memorial Sloan Kettering, About Herbs: Holy Basil (updated 21 September 2026): https://www.mskcc.org/cancer-care/integrative-medicine/herbs/holy-basil-01
- Cohen, "Tulsi - Ocimum sanctum: A herb for all reasons", J Ayurveda Integr Med 2014 (open access; read through Europe PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC4296439/
- NC State Extension Plant Toolbox, Ocimum tenuiflorum (undated): https://plants.ces.ncsu.edu/plants/ocimum-tenuiflorum/
- Checked and not used: NCCIH and the EMA have no holy basil pages; LactMed's "Basil" record covers sweet basil only; Culpeper and Grieve describe sweet basil, not tulsi.

Uncertain:
- The MSD Manual is the main safety source. It gives the fertility and pregnancy warning (from animal studies), the thyroid, bleeding and barbiturate cautions, and the 8-week limit. MSK adds side effects only.
- Blood sugar: no source names a diabetes-drug interaction outright. The MSD Manual reports small studies where holy basil lowered blood sugar, including one where it was added to glibenclamide, so the entry advises asking the prescriber and watching for lows. This is a precaution based on that effect, not a documented interaction.
- Cohen's review is enthusiastic about health benefits. It is cited only for tradition (Ayurvedic names, taste and qualities, household worship), not for safety or effects.
- `common_name` follows the plan's table ("Holy basil (tulsi)"); "Holy basil" is also listed in `other_names` so jars labeled that way link.
- No harvest timing: none of our sources gives one.

Left out:
- Planet, element, gender and zodiac: tulsi isn't in Culpeper, and we found no citable source for Western correspondences.
- MSK's and Cohen's laboratory and small clinical findings (stress, cancer, mouth health): research, not tradition.

## Hibiscus (Hibiscus sabdariffa)

Sources read:
- Hashmi, Zidan, Khudadad, Hashmi, "A review and update on the use of Hibiscus sabdariffa (karkadeh) in the treatment of essential hypertension", Family Medicine & Primary Care Review 2020 (abstract read on the publisher's page): https://doi.org/10.5114/fmpcr.2020.98253
- Ndu et al., "Herb-drug interaction between the extract of Hibiscus sabdariffa L. and hydrochlorothiazide in experimental animals", J Med Food 2011 (abstract read through Europe PMC): https://pubmed.ncbi.nlm.nih.gov/21480802/
- NICHD, LactMed: Hibiscus (revised 2025; read through the Europe PMC record): https://www.ncbi.nlm.nih.gov/books/NBK501882/
- UF/IFAS Gardening Solutions, Roselle (undated): https://gardeningsolutions.ifas.ufl.edu/plants/edibles/vegetables/roselle/
- NC State Extension Plant Toolbox, Sabdariffa gossypiifolia, previously Hibiscus sabdariffa (undated): https://plants.ces.ncsu.edu/plants/sabdariffa-gossypiifolia/
- Checked and not used: NCCIH, the EMA, MSK and the MSD Manual have no hibiscus page; Culpeper and Grieve don't describe roselle. The Drugs.com monograph blocked automated reading, so we didn't cite it.

Uncertain:
- This is the thinnest entry in the batch. There is no government fact sheet or EMA monograph, so safety rests on one review abstract, one animal study and LactMed.
- Pregnancy: no source we could read addresses it directly. The caution says so plainly ("no source we read establishes that it is safe") and advises avoiding medicinal amounts, instead of claiming a documented risk. A verifier with access to a fuller reference should check this one.
- Blood pressure medicines: the review shows a real blood-pressure-lowering effect and says interactions at normal amounts are few; the hydrochlorothiazide finding is from rats and rabbits only. The entry gives both and advises asking the prescriber.
- Other interactions (chloroquine, acetaminophen, diclofenac, simvastatin) appear in drug references we couldn't read, so they aren't stated.
- Name: NC State now lists the plant as Sabdariffa gossypiifolia. The entry keeps Hibiscus sabdariffa, the name used by every other source, and mentions the new name in `notes`.
- `parts_used` is "flower": the calyx is part of the flower, and the allowed list has no closer term.

Left out:
- Planet, element, gender, zodiac: no Culpeper entry and no citable correspondence.
- The review's blood-pressure numbers and any trial amounts: research results and dosage.

## Rose (Rosa gallica, R. damascena)

Sources read:
- EMA, Community herbal monograph on Rosa gallica L., Rosa centifolia L., Rosa damascena Mill., flos (1 July 2014): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-rosa-gallica-l-rosa-centifolia-l-rosa-damascena-mill-flos_en.pdf
- Culpeper, The Complete Herbal, "Roses" and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Roses": https://www.botanical.com/botanical/mgmh/r/roses-18.html
- NC State Extension Plant Toolbox, Rosa (genus page, undated): https://plants.ces.ncsu.edu/plants/rosa/

Uncertain:
- Planet: Culpeper assigns red roses to Jupiter, damask to Venus and white to the Moon. This entry covers both red and damask, so `planet` is null and his scheme is given in `notes` rather than picking one.
- NCCIH has no rose page, so the EMA monograph is the only safety source. It reports no side effects or interactions and covers only mouth and skin use. Drinking rose preparations in medicinal amounts is therefore not described as safe.
- Garden notes come from NC State's general rose page because it has no page for either species. They are general rose care, not specific to these two.

Left out:
- Culpeper's purging electuary amounts and his claims for fevers, jaundice and "St. Anthony's fire": dosage and outdated claims.
- Grieve's acid preparations made with sulfuric acid: unsafe to suggest.
- Rose hips: Grieve discusses hips under the dog rose, a different species, so they aren't covered here.

## Yarrow (Achillea millefolium)

Sources read:
- EMA, EU herbal monograph on Achillea millefolium L., herba, Revision 1 (23 September 2020; EMA files it under "herbal-opinion" in the URL): https://www.ema.europa.eu/en/documents/herbal-opinion/final-european-union-herbal-monograph-achillea-millefolium-l-herba-revision-1_en.pdf
- EMA, Community herbal monograph on Achillea millefolium L., flos (read for comparison, not cited): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-achillea-millefolium-l-flos_en.pdf
- Culpeper, The Complete Herbal, "Yarrow, called Nose-bleed, Milfoil and Thousand-leal" (Venus) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Yarrow": https://www.botanical.com/botanical/mgmh/y/yarrow02.html
- NC State Extension Plant Toolbox, Achillea millefolium (undated): https://plants.ces.ncsu.edu/plants/achillea-millefolium/

Uncertain:
- NCCIH has no yarrow fact sheet, so the EMA monograph is the safety source. It names the Asteraceae allergy and "not recommended" in pregnancy and nursing, and reports no interactions. Some references also warn about blood thinners or sedatives with yarrow; none of our sources does, so it isn't stated.
- Some references mention thujone in yarrow oil. Our sources don't, so it isn't stated.
- NC State tags yarrow as a "problem" for cats, dogs and horses without detail; the entry repeats only that.

Left out:
- Grieve's tea amounts: dosage.
- Culpeper's claims for gonorrhea, baldness and incontinence: outdated.

## Plantain (Plantago major)

Sources read:
- EMA, EU herbal monograph on Plantago lanceolata L., folium, Revision 1 (9 July 2025), for ribwort plantain: https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-plantaginis-lanceolatae-folium-revision-1_en.pdf
- Culpeper, The Complete Herbal, "Plantain" (Venus) and the simples list: https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Plantain, Common" (Plantago major): https://www.botanical.com/botanical/mgmh/p/placom43.html
- NC State Extension Plant Toolbox, Plantago major (undated): https://plants.ces.ncsu.edu/plants/plantago-major/
- Checked and not used: a 2023 open-access review of Plantago major's biomedical properties (PMC10458736) has no safety data; NCCIH, MSK, the MSD Manual and LactMed have no plantain page.

Uncertain:
- The biggest gap in the batch. No free safety source covers broadleaf plantain itself. The EMA monograph is for ribwort plantain (Plantago lanceolata), a close relative. Every caution that comes from it says so in the text ("the closely related ribwort plantain"). The verifier should decide whether that is enough or whether plantain should be swapped for another herb.
- The blood-pressure drop from large amounts comes from NC State's edibility note, with no detail.
- Planet: Culpeper says most astrologers called it Mars but he places it under Venus. `planet` is Venus and his note is in `notes`.

Left out:
- Culpeper's claims for consumption, dropsy, jaundice and agues, and Grieve's rattlesnake story: outdated or unsupported.
- Psyllium (seed husk of other Plantago species): a different product with its own cautions.

## Dandelion (Taraxacum officinale)

Sources read:
- NCCIH, Dandelion: Usefulness and Safety (updated Nov 2024): https://www.nccih.nih.gov/health/dandelion
- EMA, Community herbal monograph on Taraxacum officinale Weber ex Wigg., radix cum herba (12 November 2009; corrigendum dated 20 November 2019): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-taraxacum-officinale-weber-ex-wigg-radix-cum-herba_en.pdf
- EMA, Community herbal monograph on Taraxacum officinale Weber ex Wigg., folium (12 November 2009): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-taraxacum-officinale-weber-ex-wigg-folium_en.pdf
- Memorial Sloan Kettering, About Herbs: Dandelion (updated 8 February 2023): https://www.mskcc.org/cancer-care/integrative-medicine/herbs/dandelion
- NICHD, LactMed: Dandelion (revised 2024; read through the Europe PMC record): https://www.ncbi.nlm.nih.gov/books/NBK501872/
- Culpeper, The Complete Herbal, "Dandelion, vulgarly called Piss-a-beds" (Jupiter): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Dandelion": https://www.botanical.com/botanical/mgmh/d/dandel08.html
- UW-Madison Extension, Dandelion (revised Sept 2026): https://hort.extension.wisc.edu/articles/dandelion-taraxacum-officinale/

Uncertain:
- Asteraceae allergy: the EMA makes it a contraindication; NCCIH says evidence on cross-reactions is conflicting. The entry keeps the contraindication and mentions that the evidence is mixed.
- Interactions: MSK bases the diuretic and blood-sugar cautions on animal and human studies, and the drug-enzyme caution on lab and animal data plus one transplant case. NCCIH calls its list (diabetes drugs, anticoagulants, antiplatelets, water pills) theoretical. The entry gives them without overstating.
- Lithium: some references warn about it with diuretic herbs. None of our sources mentions it for dandelion, so it isn't stated. A verifier with a fuller reference may want to add it.
- The kidney failure, diabetes and heart failure warning (hyperkalemia risk) is from the EMA's special warnings.

Left out:
- Culpeper's claims for jaundice, consumption and "pestilential fevers": outdated.
- MSK's laboratory cancer findings and the estrogen-like effects in rats: preclinical, not tradition. The hemorrhagic cystitis and liver-injury case reports involved multi-ingredient products and are left out as not clearly due to dandelion.

## Burdock (Arctium lappa)

Sources read:
- EMA, Community herbal monograph on Arctium lappa L., radix (16 September 2010): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-arctium-lappa-l-radix_en.pdf
- EMA, Assessment report on Arctium lappa L., radix (16 September 2010): https://www.ema.europa.eu/en/documents/herbal-report/final-assessment-report-arctium-lappa-l-radix_en.pdf
- Memorial Sloan Kettering, About Herbs: Burdock (updated 13 March 2023): https://www.mskcc.org/cancer-care/integrative-medicine/herbs/burdock
- Culpeper, The Complete Herbal, "The Burdock" (Venus) and the simples list ("Bardana"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Burdock": https://www.botanical.com/botanical/mgmh/b/burdoc87.html
- NC State Extension Plant Toolbox, Arctium lappa (undated, read in 2026): https://plants.ces.ncsu.edu/plants/arctium-lappa/
- Checked and not used: NCCIH has no burdock fact sheet (the URL returns 404), and we found no LactMed record for burdock.

Uncertain:
- Pregnancy: MSK says avoid because of uterine stimulation in animals; the EMA assessment report notes that no case reports or studies back this up, but the monograph still does not recommend use. The entry gives both and says avoid.
- Blood sugar: no source names a diabetes-drug interaction. MSK reports lower blood sugar in animals and better glucose control in a small study, so the entry advises asking the prescriber. This is a precaution from the effect, not a documented interaction.
- Look-alikes: the belladonna contamination and the mix-ups with comfrey and dock roots come from the EMA assessment report (citing older handbooks) and MSK's case report. They concern commercial root and foraging alike, so the entry warns about both.
- The liver injury case involved a multi-ingredient "detox" tea, so burdock may not be the cause; the entry says the tea "contained it".

Left out:
- Culpeper's womb-moving leaf charm, snakebite and mad-dog claims, and Grieve's "certain remedy" for skin disease and claims for kidney disease: outdated or unsupported.
- MSK's lab and small clinical findings (cancer, wrinkles, knee arthritis): research, not tradition. Burdock's place in Essiac, a cancer tea, isn't mentioned as a use.
- Grieve's and the EMA's amounts: dosage.

## Marshmallow root (Althaea officinalis)

Sources read:
- EMA, EU herbal monograph on Althaea officinalis L., radix (12 July 2016): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-althaea-officinalis-l-radix_en.pdf
- EMA, Assessment report on Althaea officinalis L., radix (12 July 2016): https://www.ema.europa.eu/en/documents/herbal-report/final-assessment-report-althaea-officinalis-l-radix_en.pdf
- Royal College of Physicians, Medicinal Garden plant page, Althaea officinalis (undated, read in 2026): https://garden.rcp.ac.uk/viewPlant?plantId=80
- Culpeper, The Complete Herbal, "Mallows and Marshmallows" (Venus) and the simples list ("Althæa"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Mallow, Marsh" (the site's separate "Marshmallow" index link leads to a stub; the full entry is on the mallows page): https://www.botanical.com/botanical/mgmh/m/mallow07.html
- Checked and not used: NCCIH and MSK have no marshmallow page (MSK's URL returns 404); NC State's Plant Toolbox has no Althaea officinalis page; the Mount Sinai herb library page now redirects away. RxList's blood sugar and lithium warnings weren't used because we cite only the sources above.

Uncertain:
- Taking other medicines at the same time: the monograph's half-hour-to-an-hour gap is a precaution. The assessment report says the slowed absorption comes from handbooks and hasn't been confirmed in animals or people. The entry says so.
- Blood sugar: the only support is the assessment report's mouse studies (injected root polysaccharide). No diabetes-drug interaction is documented; the entry asks diabetes patients to check with their prescriber as a precaution.
- `taste` and `garden_sun` are null: no source we read gives them. Root harvest timing is left out for the same reason; Grieve's leaf timing is given instead.
- Lithium: some references warn about it. None of our sources mentions it, so it isn't stated. A verifier with a fuller reference may want to add it.

Left out:
- Grieve's claims for urinary bleeding, dysentery, gangrene ("mortification root") and kidney gravel: outdated.
- All amounts from the EMA and Grieve: dosage.

## Licorice root (Glycyrrhiza glabra)

Sources read:
- NCCIH, Licorice Root: Usefulness and Safety (updated April 2025): https://www.nccih.nih.gov/health/licorice-root
- EMA, EU herbal monograph on Glycyrrhiza glabra L. and/or G. inflata Bat. and/or G. uralensis Fisch., radix, Revision 1 (4 March 2026): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-glycyrrhiza-glabra-l-glycyrrhiza-inflata-bat-glycyrrhiza-uralensis-fisch-radix-revision-1_en.pdf
- Culpeper, The Complete Herbal, "Liquorice" (Mercury) and the roots list ("Glycyrrhizæ"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Liquorice": https://www.botanical.com/botanical/mgmh/l/liquor32.html
- NC State Extension Plant Toolbox, Glycyrrhiza glabra (undated, read in 2026): https://plants.ces.ncsu.edu/plants/glycyrrhiza-glabra/

Uncertain:
- Digoxin: the EMA says "cardiac glycosides"; the entry names digoxin as the common example.
- Pregnancy: NCCIH gives the risk of birth before 38 weeks for large amounts; the EMA adds animal reproductive harm and advises against use in pregnancy and for women who could become pregnant without contraception. The entry states the stricter EMA advice as the rule.
- Food versus medicine: NCCIH calls licorice generally safe as a food ingredient, but the EMA warns that people on licorice medicine should avoid other licorice products. The entry keeps the warning; it doesn't say how much licorice candy is safe because neither source gives a food limit we could state without a dosage.
- Sun and soil come from NC State; the climate and harvest notes come from Grieve.

Left out:
- Grieve's claim that licorice sugar is safe for diabetics: outdated and not supported by our safety sources.
- Culpeper's eye powder and kidney claims, and Grieve's consumption remedies: outdated.
- The EMA's CYP3A4 study amounts and all dosage tables: dosage.

## Cinnamon (Cinnamomum verum)

Sources read:
- NCCIH, Cinnamon: Usefulness and Safety (updated Nov 2024): https://www.nccih.nih.gov/health/cinnamon
- EMA, Community herbal monograph on Cinnamomum verum J.S. Presl, cortex (10 May 2011): https://www.ema.europa.eu/en/documents/herbal-monograph/community-herbal-monograph-cinnamomum-verum-js-presl-cortex_en.pdf
- Memorial Sloan Kettering, About Herbs: Cinnamon (updated 8 June 2021): https://www.mskcc.org/cancer-care/integrative-medicine/herbs/cinnamon
- Culpeper, The Complete Herbal, "Cinnamonum" in the list of barks (no planet given): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Cinnamon": https://www.botanical.com/botanical/mgmh/c/cinnam69.html
- Grieve, A Modern Herbal, "Cassia (Cinnamon)": https://www.botanical.com/botanical/mgmh/c/cassia31.html

Uncertain:
- Blood sugar medicines: NCCIH doesn't name diabetes drugs. MSK says cinnamon may lower blood sugar with mixed evidence and gives the pioglitazone finding from animal studies; the entry presents the advice as a precaution.
- The statin and hepatitis link rests on case reports in MSK; the liver enzyme effect is lab data with unknown clinical relevance. The entry says both.
- Ceylon versus cassia: the entry is for Ceylon cinnamon (the plan's Latin name) but warns about cassia because it is what most shops sell. Neither source gives a safe coumarin amount we could state without a dosage.
- `planet` is null: Culpeper lists cinnamon among barks without a planet.
- Garden fields are thin because cinnamon is a tropical tree; growing notes come from Grieve only.

Left out:
- Grieve's uterine bleeding uses and Culpeper's advice to give cinnamon in labor: unsafe to repeat.
- MSK's and NCCIH's research on diabetes, weight loss and hay fever: research, not tradition.
- All amounts: dosage.

## Turmeric (Curcuma longa)

Sources read:
- NCCIH, Turmeric: Usefulness and Safety (updated April 2025): https://www.nccih.nih.gov/health/turmeric
- EMA, EU herbal monograph on Curcuma longa L., rhizoma, Revision 1 (25 September 2018): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-curcuma-longa-l-rhizoma-revision-1_en.pdf
- Memorial Sloan Kettering, About Herbs: Turmeric (updated 9 June 2026): https://www.mskcc.org/cancer-care/integrative-medicine/herbs/turmeric
- Culpeper, The Complete Herbal, "Curcumæ" in the list of roots (no planet given): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Turmeric": https://www.botanical.com/botanical/mgmh/t/turmer30.html
- UF/IFAS Gardening Solutions, Turmeric (undated; footer 2026): https://gardeningsolutions.ifas.ufl.edu/plants/edibles/vegetables/turmeric/

Uncertain:
- Gallbladder and bile duct: from the EMA's special warnings. NCCIH doesn't mention them; MSK notes only that curcumin stimulates bile in lab studies.
- Blood thinners: MSK bases the bleeding risk on lab studies and a case report; the entry says so.
- Liver injury: NCCIH links it mainly to high-absorption curcumin products; MSK reports cases with low-dose products too. The entry covers supplements in general and names the warning signs NCCIH lists. A genetic risk factor (HLA type) is described elsewhere, but not in our sources, so it isn't stated.
- Pregnancy: NCCIH says supplements "may be unsafe"; the EMA says not recommended. The liver-injury-in-pregnancy case is only a reference title on MSK's page, so the entry mentions it briefly without detail.
- `parts_used` is "root" because the allowed list has no "rhizome"; the text says rhizome.
- `garden_water` gives soil only: UF/IFAS has no watering advice.

Left out:
- Grieve's "once a cure for jaundice": outdated claim.
- MSK's research findings (osteoarthritis, cancer) and its intravenous curcumin death: research, and an injected product outside home use.
- All amounts, including the EMA's tables and MSK's study doses: dosage.

## Fennel (Foeniculum vulgare)

Sources read:
- EMA, EU herbal monograph on Foeniculum vulgare Miller subsp. vulgare var. vulgare (bitter fennel), fructus, Revision 1 (31 January 2024): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-foeniculum-vulgare-miller-subsp-vulgare-var-vulgare-fructus-revision-1_en.pdf
- EMA, EU herbal monograph on Foeniculum vulgare Miller subsp. vulgare var. dulce (sweet fennel), fructus, Revision 1 (31 January 2024): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-foeniculum-vulgare-miller-subsp-vulgare-var-dulce-mill-batt-trab-fructus-revision-1_en.pdf
- NICHD, LactMed: Fennel (record first published 2006; NCBI showed a verification screen, so the summary was read through the Europe PMC record and the revision date couldn't be seen): https://www.ncbi.nlm.nih.gov/books/NBK501793/
- Culpeper, The Complete Herbal, "Fennel" (Mercury, under Virgo) and the roots list ("Fœniculi"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Fennel": https://www.botanical.com/botanical/mgmh/f/fennel01.html
- NC State Extension Plant Toolbox, Foeniculum vulgare (undated, read in 2026): https://plants.ces.ncsu.edu/plants/foeniculum-vulgare/
- Checked and not used: NCCIH has no fennel fact sheet.

Uncertain:
- Estragole: both EMA monographs explain the pregnancy, nursing and child limits partly by estragole, a genotoxic carcinogen in rodents. The entry names it without giving the EMA's intake limits, which are dosage.
- Nursing: LactMed considers usual amounts unlikely to harm the baby and describes fennel as a common milk-supply herb, but also reports newborn toxicity from a fennel-and-anise tea; the EMA says not recommended. The entry gives both and says avoid medicinal amounts.
- Hormone effects: LactMed calls anethole a plant estrogen, but no source names a drug interaction, so none is stated.
- The LactMed `year` is the record's first publication year because the revision date wasn't visible.
- Zodiac "Virgo" is Culpeper's own placement.

Left out:
- Culpeper's and Grieve's claims for stones, snakebite, poisonous mushrooms and eye films: outdated.
- Fennel for slimming is reported as tradition only; no source supports it.
- Gripe water's other ingredients and all amounts: dosage.

## Oat straw (Avena sativa)

Sources read:
- EMA, Community herbal monograph on Avena sativa L., herba (4 September 2008): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-avena-sativa-l-herba_en.pdf
- Celiac Disease Foundation, What is Gluten? (undated, read in 2026): https://celiac.org/live-gluten-free/glutenfreediet/what-is-gluten/
- Culpeper, The Complete Herbal, "Oats" (no planet given): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Oats": https://www.botanical.com/botanical/mgmh/o/oats--03.html
- NC State Extension Plant Toolbox, Avena sativa (undated, read in 2026): https://plants.ces.ncsu.edu/plants/avena-sativa/
- Checked and not used: NCCIH and MSK have no oat straw page; the EMA oat fruit (grain) monograph covers a different preparation. Beyond Celiac's oat straw answer refused automated reading (403).

Uncertain:
- "Oat straw" in herbal trade means the green aerial parts; the EMA's oat herb monograph defines its herb as aerial parts cut before flowering, so the entry follows that. Some sellers sell dried mature straw, which our sources don't cover.
- Coeliac: the EMA's caution is about unknown protein content; the cross-contact explanation comes from the Celiac Disease Foundation, which writes about oats in general, not oat straw tea specifically.
- Safety evidence is thin: the EMA lists no side effects or interactions, and that is the only medicinal safety source. The drowsiness and driving warning is the EMA's.
- `taste` and `energetics` are null: no source gives them.

Left out:
- Grieve's note on an alkaloid stimulating the muscles and the use of oat gruel in acid poisoning: outdated.
- Culpeper's claims for leprosy and fistulas: outdated.
- All amounts: dosage.

## Raspberry leaf (Rubus idaeus)

Sources read:
- EMA, Community herbal monograph on Rubus idaeus L., folium (28 January 2014): https://www.ema.europa.eu/en/documents/herbal-monograph/final-community-herbal-monograph-rubus-idaeus-l-folium_en.pdf
- EMA, Assessment report on Rubus idaeus L., folium (28 January 2014, Corr. 1): https://www.ema.europa.eu/en/documents/herbal-report/final-assessment-report-rubus-idaeus-l-folium_en.pdf
- NICHD, LactMed: Raspberry (record first published 2006; read through the Europe PMC record, revision date not visible): https://www.ncbi.nlm.nih.gov/books/NBK501785/
- Culpeper, The Complete Herbal, "Rubus Idæus" in the list of herbs (no planet; he knew "no great virtues in the leaves"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Raspberry": https://www.botanical.com/botanical/mgmh/r/raspbe05.html
- NC State Extension Plant Toolbox, Rubus idaeus (undated, read in 2026): https://plants.ces.ncsu.edu/plants/rubus-idaeus/
- Checked and not used: NCCIH has no raspberry leaf fact sheet.

Uncertain:
- Pregnancy timing: our sources describe the tradition as late pregnancy, and the trials gave it from 32 weeks. The EMA assessment report explains that the labor indication was left out of the monograph only because pregnancy safety data are lacking, so the monograph says not recommended. The entry states the tradition, the EMA position, the small reassuring studies, the single newborn seizure report (a pharmacovigilance case, cause not proven) and the rat finding, and tells readers to ask their midwife or doctor. This is the herb a verifier should check most closely.
- Grieve says the tea "should be taken freely" in labor; we didn't repeat that.
- LactMed says no data exist on safety for nursing mothers or babies.
- `taste` is null: no source describes the leaf's taste.

Left out:
- Grieve's claims for removing "proud flesh" and the leaf as a never-failing bowel remedy: overstated.
- Trial amounts and Grieve's tea strength: dosage.

## Mullein (Verbascum thapsus)

Sources read:
- EMA, EU herbal monograph on Verbascum thapsus L., V. densiflorum Bertol. (V. thapsiforme Schrad) and V. phlomoides L., flos (27 March 2018): https://www.ema.europa.eu/en/documents/herbal-monograph/final-european-union-herbal-monograph-verbascum-thapsus-l-v-densiflorum-bertol-v-thapsiforme-schrad-and-v-phlomoides-l-flos_en.pdf
- EMA, Assessment report on the same flowers (27 March 2018; read for hair and straining notes, found only the "strain" instruction in tea recipes, not cited): https://www.ema.europa.eu/en/documents/herbal-report/final-assessment-report-verbascum-thapsus-l-v-densiflorum-bertol-v-thapsiforme-schrad-and-v-phlomoides-l-flos_en.pdf
- Henriette Kress, "Herb of the week: Mullein" (blog post, 5 May 2012): https://henriettes-herb.com/blog/hotw-mullein.html
- Culpeper, The Complete Herbal, "Mullein" (Saturn) and the simples list ("Verbascum"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Mullein, Great": https://www.botanical.com/botanical/mgmh/m/mulgre63.html
- UW-Madison Extension, Common Mullein (revised 9 June 2025): https://hort.extension.wisc.edu/articles/common-mullein-verbascum-thapsus/
- NC State Extension Plant Toolbox, Verbascum thapsus (undated, read in 2026): https://plants.ces.ncsu.edu/plants/verbascum-thapsus/
- Checked and not used: NCCIH and MSK have no mullein page. Missouriplants.com also warns about the stellate hairs but names no author, so it isn't cited. A University of Ioannina plant database page didn't resolve.

Uncertain:
- The hair caution: no government or university source states it. Grieve says continental cooks strained flower tea "to separate the rough hairs", and Henriette Kress, a practicing herbalist, says the hairs irritate mucous membranes and that only a coffee filter removes them. Skin irritation rests on a reader comment on her post, so the entry words it as "herbalists report". A verifier may want a stronger source.
- `planet` Saturn is Culpeper's own.
- The EMA lists no side effects or interactions.

Left out:
- Mullein oil for earache and ear discharge, which Grieve describes: no safety source we cite covers putting oil in the ear, so it isn't offered as a use.
- Smoking the leaves for asthma and coughs: not something to suggest.
- Grieve's claims for consumption, bleeding of the lungs, migraine and gout: outdated.
- All amounts: dosage.

## Mugwort (Artemisia vulgaris)

Sources read:
- NCCIH, Mugwort: Usefulness and Safety (updated April 2025): https://www.nccih.nih.gov/health/mugwort
- Ekiert H et al., "Significance of Artemisia vulgaris L. (Common Mugwort) in the History of Medicine and Its Possible Contemporary Applications Substantiated by Phytochemical and Pharmacological Studies", Molecules 2020 (open access; read through Europe PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC7583039/
- Wagner W et al., "Higher Risk for Sensitization to Commonly Consumed Herbs among Adults and Youngsters Suffering from Birch, Mugwort or Grass Pollinosis", Int J Environ Res Public Health 2022 (abstract read through Europe PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC9820039/
- Culpeper, The Complete Herbal, "Mugwort" (Venus) and the simples list ("Artemisia"): https://www.gutenberg.org/ebooks/49513
- Grieve, A Modern Herbal, "Mugwort": https://www.botanical.com/botanical/mgmh/m/mugwor61.html
- NC State Extension Plant Toolbox, Artemisia vulgaris (undated, read in 2026): https://plants.ces.ncsu.edu/plants/artemisia-vulgaris/
- Checked and not used: the EMA has no mugwort monograph; MSK has no mugwort page (404). The EMA fennel monographs note that mugwort pollen cross-reacts with fennel, but they aren't cited here, so fennel isn't named in this entry's food list (the fennel entry carries that warning).

Uncertain:
- Pregnancy: the caution is explicit, as the plan requires. NCCIH says it should not be used in pregnancy; Ekiert's review says large amounts may cause miscarriage; Culpeper and Grieve record its traditional use to bring on periods and expel the afterbirth, which is why it is traditionally avoided.
- Thujone: Ekiert reports thujone and camphor in the essential oil and EFSA's view that they may be harmful, noting that the research mostly concerns the concentrated oil. The entry names thujone without numbers.
- Blood sugar: Ekiert says mugwort can raise blood glucose and should be used with caution in diabetes. No specific drug interaction is documented.
- Duration: no source gives a limit. The entry says so and advises against regular or long use, which follows from NCCIH's "not enough evidence" on safety.
- Zodiac: Culpeper names Taurus and Libra as Venus's signs, not as mugwort's own, so `zodiac` is empty.
- Moxibustion is described as tradition only; the entry doesn't suggest trying it.

Left out:
- Culpeper's and Grieve's uses for delivery, the afterbirth, opium overdose and epilepsy, and Grieve's emmenagogue amounts: unsafe or outdated.
- Smoking mugwort, which Ekiert mentions as mildly intoxicating: not something to suggest.
- Dream and divination lore common in modern books: not recorded in our sources.
