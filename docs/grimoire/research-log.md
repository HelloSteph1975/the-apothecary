# Grimoire research log

How the starter entries in `server/data/grimoire/` were researched. One section per herb: the sources read, what was uncertain, and what was left out and why. The grimoire is for learning and isn't medical advice.

## Notes that apply to every entry

- **Safety sources.** Cautions come from the NCCIH "Herbs at a Glance" fact sheets where one exists and from the European Medicines Agency (EMA) Committee on Herbal Medicinal Products monographs (sections 4.2 to 4.8: duration, contraindications, warnings, interactions, pregnancy and lactation, side effects). Where the two differ, the entry gives both and keeps the more careful reading.
- **AHPA class.** The AHPA *Botanical Safety Handbook* isn't free to read, and no free source we cite states a class number for these herbs, so `ahpa_class` is null for all of them.
- **Planets.** Taken only from Culpeper's *Complete Herbal* (Project Gutenberg ebook 49513, an expanded later edition of his 1653 work). Where Culpeper assigns no planet, `planet` is null.
- **Element and gender.** Culpeper doesn't give these. They follow the widely repeated modern magical-herbal correspondences, marked in the app as tradition. We didn't read a specific source for them, so no source is cited for them. A reviewer may want to null them out if that standard is too loose.
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
- Culpeper writes about Roman chamomile (Chamaemelum) and gives no planet of his own; he reports that the Egyptians dedicated it to the Sun. `planet: Sun` rests on that remark and on wide later tradition. A reviewer may prefer null.

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
- Element and gender (Fire, masculine) follow modern magical tradition, which sits oddly beside a Venus planet. Flagged for review.
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
- Planet: Culpeper lists ginger only among his simples and doesn't assign a planet, so `planet` is null. Element and gender follow modern tradition (see the general note).
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
- `parts_used`: the allowed list has no "bulb", so the bulb is filed under "root" and `notes` says so. A later stage could add "bulb" to the plant-part list.
- Family: Amaryllidaceae (APG IV); older books put garlic in Liliaceae or Alliaceae.
- The saquinavir/ritonavir contraindication comes from the EMA monograph. NCCIH's current sheet names only anticoagulants and aspirin.
- Grieve's Odyssey story: she calls the protective herb a yellow garlic; scholars dispute what Homer's "moly" was, so the entry says "a garlic-like herb".

Left out:
- Culpeper's and Grieve's claims for worms, plague sores, dropsy and scrofula: outdated.
- Grieve's syrup recipe amounts: dosage.
- "Four Thieves vinegar" is described as said to guard against plague, framed as folklore only.
