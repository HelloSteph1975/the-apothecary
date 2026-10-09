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
