# Grimoire safety check

Every caution in the 30 starter herbs was checked against its cited sources by an agent that did not write the entry. Each section says what was confirmed, what changed and why, and any keep-or-swap note. Sources are paraphrased, not quoted.


Verifier 1 checked chamomile, lavender, calendula, peppermint, lemon balm, elderberry, elderflower, echinacea, ginger and garlic. I opened every source marked `safety` and read the EMA monographs' sections 4.2 to 4.8 (and 5.3 where relevant) from the PDF text. All cited URLs loaded and matched the named source. No `uses` text read as a medical claim, so none was changed. `ahpa_class`, `element` and `gender` stay null. The planets match Culpeper (I checked lavender, Mercury, in the Gutenberg text).

## Chamomile

Changed:
- Medications: the sedative point now says "in theory". NCCIH calls it a theoretical interaction.
- Conditions: added nausea and dizziness as uncommon side effects, from NCCIH's side-effect list.

Checked and kept: the warfarin and liver-enzyme notes (NCCIH; the EMA's report of CYP450 interactions in kidney transplant patients on high doses for about two months), the tea-versus-extract pregnancy split and the nipple-cleaning advice (EMA 4.6), the daisy-family allergy and anaphylaxis (both sources), and the bath contraindications (EMA 4.3).

## Lavender

OK. Every statement matches NCCIH (food amounts likely safe, short-term oral use, theoretical sedative interaction, the unclear breast-swelling reports in children, skin allergy), the EMA (pregnancy not recommended, no interactions reported, may impair driving, not established under 12), or Culpeper (use only a few drops of the strong distilled oil).

## Calendula

Changed:
- Duration: "Long-term safety hasn't been studied" became "None of our sources describes long-term use". The EMA doesn't make that claim; it only gives the one-week see-a-doctor point.

Checked and kept: the Asteraceae contraindication, the age limits (6 for skin, 12 for mouth rinse), the skin sensitization of unknown frequency, and pregnancy not recommended (all EMA). The only safety source is the EMA, since NCCIH has no calendula page. It covers skin and mouth use well, so keep the entry.

## Peppermint

Changed:
- Medications: added a new source, Memorial Sloan Kettering's "About Herbs" page on peppermint (2023). In rats, peppermint oil raised cyclosporine levels. One kidney transplant patient's level fell after a tea containing peppermint. In lab studies the oil slowed several drug-clearing liver enzymes. MSK says the clinical relevance isn't known, and the text says the same.
- Pregnancy: added NCCIH's nursing advice to apply the oil after a feed and wipe it off before the next.
- Conditions: added hiatal hernia and "check with a doctor". MSK advises people with gallbladder disease, hiatal hernia or reflux to consult a physician first. The EMA's reflux and gallstone warnings were already there.

## Lemon balm

Changed:
- Conditions: added a thyroid caution. It comes from the EMA monograph the entry already cites (section 5.3). Lab and animal data suggest the water extract may block thyroid-stimulating hormone, and the EMA says the clinical relevance isn't known. The text says it is uncertain and advises asking a doctor if you have a thyroid condition or take thyroid medicine. No new source was needed.

Checked and kept: no interaction data, possible drowsiness affecting driving, not established under 12, pregnancy not recommended (EMA). The only safety source is the EMA. Keep the entry.

## Elderberry

Changed:
- Conditions: added an autoimmune caution with a new source: Faden et al., ACR Open Rheumatology 2024 (free on PMC). In this single-center, retrospective study, disease flares often followed elderberry use in people with dermatomyositis or skin lupus. The authors say the design can't show cause. The text says the same and advises people with autoimmune conditions or on immune-suppressing medicine to talk with their doctor. NCCIH doesn't address this.

Checked and kept: the cyanide risk in raw or unripe berries, leaves and stems, plus "cook the berries" (NCCIH); the poisonous leaves, stems, roots and seeds (NC State); the COVID-19 caveat and "little is known" for pregnancy (NCCIH). There is no EMA safety guidance for the berry. NCCIH and the new study give it enough support to keep.

## Elderflower

OK. The cautions match the EMA flower monograph: allergy contraindication, not established under 12, see a doctor for breathlessness, fever or discolored phlegm, one-week duration, no interactions reported, and pregnancy not recommended. The poisonous-parts warning matches NCCIH and NC State.

## Echinacea

Changed:
- Medications: added that the EMA advises against echinacea when the immune system is suppressed, which covers immune-suppressing drugs. NCCIH calls the interaction only theoretical, and both points are now given.
- Conditions: added the EMA's note that a link with autoimmune disease can't be ruled out (section 4.8).

Checked and kept: the Asteraceae allergy and severe reactions, the higher risk for people with atopic conditions, the autoimmune and immune-disorder warnings, not recommended under 12, the 10-day oral and one-week skin limits, and the breast-skin rule when nursing (EMA). Also checked: up to 7 days in the first trimester is possibly safe, mixed evidence on liver enzymes, and rashes in children (NCCIH).

## Ginger

Changed:
- Medications: added that an observational study linked ginger with more bleeding in people on blood thinners. The 2019 case report summarizes that study and notes it found no link to high INR. The "evidence is mixed" framing stays, because the 2005 healthy-volunteer study found no effect on warfarin.
- Topical: replaced "warms and reddens the skin", which no safety source supports. The new text gives NCCIH's view that skin use may be safe and the EMA's report of hypersensitivity.
- Sources: moved journal names out of `author` into `title` for the two PMC articles.

Checked and kept: the NCCIH and EMA pregnancy positions (EMA: 300 to 1,000 pregnancy outcomes, avoid as a precaution), nursing not established, side effects, under-18 limits, and duration points.

## Garlic

Changed:
- Pregnancy: added the EMA's note that animal studies showed effects on fertility.
- Conditions: the children's line now says medicinal use isn't established under 18 (under 12 for colds). This matches the EMA's two age limits; the old text gave only 12.

Checked and kept: the bleeding risk with anticoagulants and anti-platelet drugs including aspirin, the saquinavir/ritonavir contraindication, stopping 7 days before surgery, the side effects and allergy list (EMA), safe use in studies up to 7 years, and the raw-garlic chemical burns (NCCIH).

## Keep or swap

Keep all ten. Calendula and lemon balm rest on the EMA alone, but it's a strong agency source. Elderberry has no EMA monograph, and NCCIH plus the 2024 study cover it.


Verifier 2 checked these 10 entries against every source marked `safety`: rosemary, thyme, sage, nettle, holy basil, hibiscus, rose, yarrow, plantain and dandelion. EMA monographs were read as downloaded PDFs (sections 4.1 to 4.9). LactMed records were read through the Europe PMC API, because NCBI shows a CAPTCHA to automated readers. All other pages were opened directly.

## Rosemary

URLs load and match the named EMA leaf and oil monographs. Changed:
- `caution_conditions`: added "don't use if allergic" (both monographs list hypersensitivity as a contraindication). Added that the oil rubs aren't recommended under 18 (the oil monograph says use under 18 isn't established). Added heart or kidney failure and leg ulcers to the see-a-doctor list (both monographs list these warnings for bath and skin use).
- `caution_topical`: added allergic asthma from the oil (listed among the oil monograph's side effects, frequency unknown).

Everything else matched: pregnancy and nursing not recommended, no interactions reported, bile-duct and liver warning for oral use, 2-week and 4-week limits, contact dermatitis, no broken skin, keep away from eyes and mucous membranes.

## Thyme

URLs load and match the EMA herb and oil monographs and Grieve's "Thyme, Garden" page. Changed:
- `caution_conditions`: completed the hot-bath list with large skin injuries, acute skin disease and serious circulation problems (the oil monograph's bath contraindications). Added that thyme by mouth can upset the stomach (the herb monograph's only listed side effect).

Everything else matched: Lamiaceae allergy, pregnancy and nursing not recommended, no interactions, age limits (the herb allows some liquid extracts from age 4, so "most" under 12 is accurate), 1-week limit, laryngospasm warning for under-2s, skin irritation and allergy from the oil. Grieve does describe thymol as irritating skin and mucous membranes.

## Sage

URLs load and match NCCIH (April 2025), the EMA leaf monograph and LactMed. Changed:
- `caution_topical` (flagged as thin): rewrote it. The EMA covers a sage infusion on mildly inflamed skin and in the mouth, lists no known side effects, makes allergy a contraindication and says use under 18 isn't established; the entry now says all of that. No source covers sage essential oil on the skin, so the entry says not enough is known and to avoid it. "Never take the oil by mouth" was softened to match the source: the EMA's overdose section reports seizures, a racing heart and dizziness from oil amounts matching more than about 15 g of leaf.

Everything else matched. Thujone and pregnancy (NCCIH), not recommended in pregnancy or nursing (EMA), no data for nursing babies and use to slow milk (LactMed), side effects (LactMed), thujone and camphor toxic to nerves at high doses (LactMed), food amounts likely safe with study use up to 8 weeks (NCCIH). No source names an interaction or an epilepsy contraindication, so neither was added.

## Nettle

URLs load and match the EMA herb and root monographs (both 2025), MSK (December 2021), LactMed and NC State. Changed:
- `caution_pregnancy`: the EMA herb monograph advises against use in breastfeeding too, not only pregnancy; added that, plus "not enough is known; avoid medicinal amounts".
- `caution_medications`: the diuretic caution was described as coming from animal studies. MSK calls it theoretical (based on nettle's water-pill effect); only the blood pressure and CYP450 cautions rest on animal data. Reworded to match.
- `caution_conditions`: the EMA herb monograph sets 18 as the lower age for several preparations, not only 12; added that. Added "don't use if allergic" (EMA contraindication). Completed the side effects with vomiting, heartburn, bloating and hives (EMA herb and root monographs).
- `caution_topical`: NC State flags children as the group most at risk from the sting; added a line to keep them away from fresh plants.
- Lithium: not added. The only sources found that mention a nettle and lithium interaction are subscription databases (Natural Medicines) and commercial sites relaying them, which rate it theoretical. None of the free sources (EMA, MSK, LactMed) mentions it.

## Holy basil

URLs load and match the MSD Manual page (Laura Shane-McWhorter, reviewed July 2025) and MSK (September 2026). Cautions OK: fertility and pregnancy warning from animal data, breastfeeding not studied, thyroid medicine and thyroxine, bleeding and anti-platelet or blood-thinning drugs, surgery, barbiturates (animal data), 8-week limit and longer use unstudied, side effects (nausea, diarrhea from MSD; headache, agitation from MSK). The blood-sugar line is correctly framed as a precaution based on MSD's small studies, not a documented interaction. Changed:
- Sources: moved the journal name out of Cohen's `author` into `title`.
- Lithium: not added. Neither MSD nor MSK mentions it, and no free reputable source was found.

## Dandelion

URLs load and match NCCIH (November 2024), both EMA monographs, MSK (February 2023), LactMed and UW-Madison Extension (September 2026). Changed:
- `caution_conditions`: added the EMA's warning to see a doctor if fever, painful urination, cramping or blood in the urine appears during use (in both monographs, missing from the entry).
- Lithium: not added; NCCIH, the EMA, MSK and LactMed don't mention it.

Everything else matched: Asteraceae contraindication (EMA) with NCCIH's note that cross-reaction evidence is mixed; bile-duct, gallbladder, liver and active ulcer contraindications; potassium warning for kidney failure, diabetes and heart failure; theoretical interactions (NCCIH) and the MSK diuretic, blood sugar, liver-enzyme and transplant points; the oxalate case (MSK); eczema allergy (NCCIH); sap dermatitis (UW); contact dermatitis more common in children (MSK); LactMed's view that nursing use is unlikely to harm the baby.

## Rose

OK. The URL loads and matches the EMA rose flower monograph (2014). Every caution matches it: allergy contraindication, no side effects known, no interactions, not recommended in pregnancy or nursing, use under 12 not established, see a doctor after 1 week. The monograph covers only mouth rinse and skin use, and the entry correctly avoids calling rose safe to drink in medicinal amounts.

## Yarrow

The URL loads and matches the EMA yarrow herb monograph (2020). NC State's yarrow page also loads; it tags yarrow as a problem for cats, dogs and horses and for contact dermatitis. Changed:
- `caution_topical`: the EMA reports allergic skin reactions in general; the "contact dermatitis" and gloves advice come from NC State, which tags yarrow for contact dermatitis and says to wear gloves. Reworded so each part names the right source.

Everything else matched: Asteraceae contraindication, not recommended in pregnancy or nursing, no interactions, under 12 not established, 2-week limit for appetite and digestion, 1-week limit for cramps and wounds, see a doctor if a wound looks infected. Blood thinners, sedatives and thujone weren't added: the cited sources don't mention them and no free agency source was found that does.

## Plantain

URLs load and match the EMA ribwort plantain (Plantago lanceolata) leaf monograph (2025), Grieve's "Plantain, Common" and NC State's Plantago major page. Changed:
- `caution_conditions`: the age line was wrong. The entry said most ribwort products aren't recommended under 12, but the EMA allows most cough forms from age 3, rules out only some forms under 6 or 12, and rules out mouth and oral use under 3. Rewritten to match. The pollen contraindication is the EMA's for ribwort pollen, so the text now says so. Added "take care if your blood pressure runs low" to NC State's note that large amounts can drop blood pressure.

Everything else matched: ribwort-based pregnancy and nursing advice and "no interactions", with the related-species disclosure; no side effects known for ribwort; 1-week limit; Grieve's statement that the leaves don't help internal bleeding.

**Keep or swap: keep, with the disclosure.** Reasons:
- No free agency or clinical source covers Plantago major's safety. The EMA monograph is for a close relative, and the entry says so in each caution that relies on it.
- Neither plant has a reported serious risk. The EMA lists no known side effects and no interactions for ribwort, and the entry already advises avoiding it in pregnancy and nursing.
- Broadleaf plantain is the plant people actually forage in North America, so it suits the grimoire.

If the controller wants every caution to rest on the herb itself, the cleanest fix is to change this entry to ribwort plantain (Plantago lanceolata), which the EMA covers in full (I didn't check whether Culpeper and Grieve have usable ribwort entries), rather than swapping in an unrelated herb.

## Hibiscus

URLs load and match the Hashmi review (2020, abstract), the Ndu animal study (2011, abstract) and LactMed. Changed:
- `uses`: "a use now tested in clinical trials" framed the blood pressure use as tested efficacy. Reworded as folk practice ("popularly taken to help keep blood pressure down").
- Sources: moved the journal names out of `author` and into `title` for Hashmi and Ndu.
- Sources added for thin safety coverage: Almajid et al., a 2023 open-access review of human studies (Cureus, PMC10676230); de Arruda et al. 2016, a rat study (Drug and Chemical Toxicology, PubMed 25682722); and Iyare and Adegoke 2008, a rat study (Nigerian Journal of Physiological Sciences, PubMed 19434218).
- `caution_pregnancy`: no human data exist. The two rat studies found that extract given to mothers during pregnancy or nursing changed how the offspring developed (later puberty in females, lower sperm counts in males). The text now says so, without claiming a proven human risk, and still advises avoiding more than ordinary drink amounts.
- `caution_medications`: added the Almajid review's point that hibiscus acts somewhat like an ACE inhibitor, so its use with drugs such as ramipril needs more study. The same review describes mixed results on blood sugar, so the text adds a diabetes-medicine precaution, framed as a precaution rather than a documented interaction.
- `caution_conditions`: added that few side effects were reported in studies, with one study noting mild stomach upset in the first week (Almajid). Kept the rat liver and uric acid finding (Hashmi).

Not added: the chloroquine, acetaminophen, diclofenac and simvastatin interactions appear only in subscription or blocked drug references (Drugs.com, Natural Medicines), which I couldn't read.

**Keep or swap: keep.** Safety now rests on two reviews, LactMed, and three animal studies, with the gaps stated plainly. The weak spot is still pregnancy: there is no agency monograph or human data, only animal studies. If the controller wants an agency-level safety source for every herb, hibiscus is the first candidate to swap.


Verifier 3 checked these 10 entries against every source marked `safety`: burdock, marshmallow root, licorice root, cinnamon, turmeric, fennel, oat straw, raspberry leaf, mullein, mugwort. All safety URLs loaded and were the sources named, except the two LactMed pages on ncbi.nlm.nih.gov, which showed a browser check. Those two were read through the Europe PMC record instead. The grimoire is for learning and isn't medical advice.

## Burdock

Changed:
- `caution_medications`: the blood sugar advice now reads clearly as a precaution. It says no interaction with diabetes medicines is documented, and that the advice rests on animal studies and one small human study (MSK). The EMA assessment report adds that the antidiabetic effects were seen with plant parts other than the root, which fits this lighter wording.

Checked and kept: diuretics (EMA monograph 4.4), Asteraceae allergy and anaphylaxis (monograph 4.3 and 4.8), chrysanthemum cross-sensitivity, the liver injury case and allergic contact dermatitis (MSK), belladonna contamination and mix-ups with comfrey and dock (EMA assessment report 5.3), pregnancy (both views: MSK says avoid, and the assessment report found no human reports backing the uterine claim), duration limits (monograph 4.2), and the bur warning (NC State and the assessment report). `uses` reads as tradition.

## Marshmallow root

Changed:
- `caution_medications`: the blood sugar advice is now clearly a precaution. The EMA assessment report's only support is two studies in non-diabetic mice, one using root polysaccharide injected into the abdomen; no human data or drug interaction is described.
- `caution_conditions`: added the monograph's note (4.4) that the tea for stomach complaints isn't established for children under 12.

Checked and kept: the half-hour-to-an-hour gap from other medicines and the note that it is unconfirmed (monograph 4.4; assessment report says no human or animal tests confirm slowed absorption), pregnancy and nursing (4.6), the cough warning signs (4.4), no known side effects (4.8), and the duration limits (4.2). Lithium isn't in either EMA document, so it stays out. `uses` reads as tradition.

## Licorice root

Changed:
- `caution_conditions`: "Do not use it" with high blood pressure, low potassium, heart, kidney or liver disease was stronger than the EMA monograph, which says licorice medicine is not recommended for these people because they are more sensitive (4.4). Reworded to match, and the "even small amounts" line now names only the groups NCCIH names (heavy salt use, high blood pressure, heart or kidney conditions).
- `caution_conditions`: added the warning signs of too much licorice that NC State's toolbox lists (headache from raised blood pressure, swelling of face and ankles, muscle cramps, irregular heartbeat), since that page is cited for safety.

Checked and kept: the medicine list (diuretics, cardiac glycosides, corticosteroids, stimulant laxatives, potassium-lowering drugs, blood pressure medicines, CYP3A4; monograph 4.4 and 4.5), avoiding other licorice products while taking licorice medicine, pregnancy and nursing (EMA 4.6 and NCCIH's birth-before-38-weeks finding), the 4-week limit and overdose from long use (4.2, 4.9), DGL up to 4 months and skin irritation (NCCIH). Blood pressure, potassium and duration are all covered. `uses` reads as tradition.

## Cinnamon

Changed:
- `caution_conditions`: the cassia coumarin wording now follows NCCIH's framing. NCCIH says coumarin in cassia has been linked to liver effects, that typical use usually doesn't add enough to cause significant problems, that some cassia products are high in it, and that long use could matter for sensitive people such as those with liver disease. The old text ("can contain enough coumarin to harm the liver") read as a general risk. "Has only traces" became "may hold only a trace", matching NCCIH.
- `caution_medications`: the blood sugar advice is now worded as a precaution (no proven interaction; MSK calls the blood sugar evidence mixed). The statin line now says "case reports link", matching MSK's basis. Added NCCIH's note that some cinnamon compounds might in theory interact with a cancer medicine or nicotine.
- `caution_topical`: the toothpaste and chewing gum line now matches its source. MSK reports gum inflammation (plasma cell gingivitis) and mouth inflammation (stomatitis) after oral products such as herbal toothpaste and chewing gum. NCCIH doesn't mention it.

Checked and kept: pregnancy and nursing (NCCIH: food amounts seem fine, larger amounts of Ceylon unsafe in pregnancy, little known for nursing; EMA 4.6 not recommended), Peru balsam allergy (EMA 4.3), the cinnamon-challenge warning and stomach upset and allergy with larger or long use (NCCIH), skin irritation and contact dermatitis (NCCIH), and the duration and diarrhea advice (EMA 4.2 and 4.4). `uses` reads as tradition.

## Turmeric

Changed:
- `caution_conditions`: "Do not use it" with bile duct, gallbladder or liver disease was stronger than the EMA monograph, which says not recommended because turmeric may stimulate bile (4.4). Reworded to match.
- `caution_conditions`: the liver damage line said "especially" absorption-boosted products. NCCIH ties its reports to those products, but MSK also reports liver injury with low-dose curcumin products, so the line now names both.
- `caution_pregnancy`: removed "Liver injury in pregnancy has been reported with high turmeric intake." Its only support was a reference title in MSK's list, not anything the page itself says (controller ruling). The general pregnancy caution stays: NCCIH says supplements may be unsafe, the EMA doesn't recommend it (4.6), and the line about cooking amounts not being the concern is unchanged.
- `caution_duration`: NCCIH's 2-to-3-month figure applies only to standard products not modified for better absorption. Added that limit and that longer use isn't covered.

Checked and kept: blood thinners and anti-platelet drugs (MSK, from lab studies and a case report), tacrolimus and the kidney case, chemotherapy and CYP effects (MSK), pregnancy (NCCIH says supplements may be unsafe; EMA 4.6 not recommended), the liver warning signs (NCCIH), kidney stones (MSK), side effects (NCCIH and EMA 4.8), and hives, itching and dermatitis on skin (NCCIH and MSK). `uses` reads as tradition.

## Fennel

Changed:
- `caution_pregnancy`: "newborns have been poisoned by an herbal tea" overstated what LactMed says. It describes two breastfed newborns whose signs fit anethole poisoning after their mothers drank too much of a tea with fennel, anise and other herbs. Reworded to match. Moved LactMed's reports of diarrhea, an enlarged liver and raised liver enzymes here and named the setting: nursing mothers taking fennel in mixed milk-supply products.
- `caution_conditions`: removed the loose "other reported problems" line (moved as above) and tied sun sensitivity to LactMed's framing, where it is a kind of allergic reaction.
- `caution_topical`: same sun-sensitivity framing, plus LactMed's advice to avoid strong sun or UV light while using fennel.
- Sources: LactMed `year` changed from 2006 to 2026. The Europe PMC record for this LactMed entry is dated 15 July 2026, the current revision.

Checked and kept: the mugwort pollen cross-reaction has a matching source. Both EMA fennel monographs list mugwort pollen allergy as a contraindication (4.3) because it cross-reacts with fennel, and the Apiaceae allergy comes from the same section. Also kept: estragole and the mouse liver tumors (bitter fennel monograph 5.3), anethole in breast milk (4.6), the 2-week and 1-week limits and the under-4 advice (4.2, 4.4), no known interactions (4.5), and skin or breathing allergies (4.8). `uses` reads as tradition.

## Oat straw

Changed:
- Sources: added a second EMA source, the assessment report on oat herb and oat fruit (2008). It gives the safety review behind the monograph. It finds no significant safety concerns for the herb outside oat allergy, urges caution in coeliac disease because protein data are missing, and covers skin tolerance. Oat straw now has two medicinal safety sources, both from the EMA.
- `caution_conditions`: "may make you drowsy enough to affect driving" added a cause the monograph doesn't state. The monograph (4.7) says only that it may impair driving and that affected people shouldn't drive. Reworded to match.
- `caution_topical`: "None of our sources reports skin problems" was no longer true with the assessment report cited. The report says oat skin products are usually well tolerated, that skin reactions may occur in people with contact dermatitis, and that one researcher warned against skin use in atopic children. Reworded to say so.

Checked and kept: pregnancy and nursing (monograph 4.6), no known interactions (4.5), coeliac caution (monograph 4.4; the Celiac Disease Foundation page confirms oats are often cross-contaminated and that some people with coeliac disease react even to gluten-free oats), the under-12 advice and allergy (4.3, 4.4), and Grieve's caution on oat gruel with stomach acidity. `uses` reads as tradition.

Keep or swap: keep. Safety evidence is still thin (no NCCIH or MSK page), but the EMA monograph and assessment report together are a fair agency basis.

## Raspberry leaf

This was the closest check, reading the EMA assessment report's clinical safety sections (5.1 to 5.6) and conclusions in full.

Changed:
- `caution_pregnancy`, rewritten to match the assessment report more closely:
  - "Small studies of women taking it from 32 weeks found no harm" was too strong and too narrow. The report describes a retrospective study and a randomized trial (with tablets from 32 weeks to labor), about 150 exposed pregnancies in all. They found no clear differences in outcomes, but the EMA stresses they were short and small and can't confirm safety. Now says so.
  - "One woman reported more practice contractions" wasn't what the report says. It says participants in the retrospective study reported diarrhea and more frequent Braxton Hicks contractions. Reworded.
  - Added the EMA's conclusion that the small benefit doesn't outweigh the possible risks to the baby, which is why labor use was left out of the monograph.
  - The seizure case is now described as a single report to the WHO drug-safety monitoring center (via the UK), about a 2-day-old boy. The rat finding (early puberty in female offspring) is kept.
  - The report says pregnant women should preferably avoid it, and if it is used, it should be under medical supervision and not as self-medication. The entry now says don't take it on your own, only with your midwife's or doctor's advice and oversight.
  - Nursing: LactMed says no data exist on safety for nursing mothers or babies, and the EMA doesn't recommend it. Added "avoid while breastfeeding", as the brief requires when safety is unknown.
- Sources: LactMed `year` changed from 2006 to 2024. The Europe PMC record for this entry is dated 15 August 2024, the current revision.

Checked and kept: pregnancy timing (tradition is late pregnancy; the report also mentions handbook advice to limit it to the last two trimesters, not repeated as advice), no known interactions (monograph 4.5), the under-18 advice (4.4), no known side effects (4.8), and the duration limits (4.2). `uses` already says the research behind the labor belief is thin and reads as tradition.

## Mullein

Changed:
- Sources: added the Ohio State University weed guide page on common mullein (CFAES/OARDC, undated, read 2026). It is a university source stating that the hairy leaves and stems can cause contact dermatitis, and that the foliage and seeds are mildly narcotic and may cause sleep if eaten in large amounts.
- `caution_topical`: the skin caution no longer rests only on Grieve and an herbalist's blog. It now leads with the Ohio State statement. Henriette Kress's own post (not just a reader comment) says the leaves itch on tender skin, so "herbalists report" is kept for that part.
- `caution_conditions`: added Ohio State's note on the seeds and foliage alongside Grieve's poachers.

Checked and kept: the throat and membrane caution and the advice to filter finely. Grieve says flower tea must always be strained through fine muslin or the hairs cause severe itching in the mouth, and Kress says a coffee filter is needed. The EMA monograph's pregnancy, under-12, cough warning signs, 1-week limit, no interactions and no known side effects (4.2 to 4.8) are also kept. UW-Madison Extension (cited for garden and uses) has no safety content. `uses` reads as tradition.

Keep or swap: keep. The EMA covers internal use; the hair caution now has a university source as well as Grieve and a practicing herbalist.

## Mugwort

Changed:
- `caution_medications`: the blood sugar advice is now clearly a precaution. It rests on one line in Ekiert's review (mugwort may raise blood glucose, so take care in diabetes), and no drug interaction is documented. NCCIH names none.
- `caution_conditions`: the herb list named basil, which the Wagner study doesn't single out. Its strongest links in mugwort-allergic adults were anise, caraway and thyme, with mint among others. It also grouped mugwort with birch and grass pollen and measured skin-test sensitization, not reactions. Reworded to say "in skin tests" and to list herbs the study names. The food list was shortened so it doesn't mirror Ekiert's long list.
- `caution_conditions`: added Ekiert's (EFSA's) note that the thujone and camphor concern comes mostly from research on the concentrated oil.

Checked and kept: pregnancy (NCCIH says it should not be used; Ekiert says large amounts may cause miscarriage), breastfeeding unknown (NCCIH), Asteraceae and pollen allergy, anaphylaxis from swallowed pollen, dermatitis and hives (Ekiert; NC State lists contact dermatitis), nausea, vomiting, nerve damage and reported high blood pressure with large amounts (Ekiert), and "not enough is known" for oral, skin and long-term use (NCCIH). `uses` frames moxibustion and period use as tradition.

The Asteraceae (daisy family) allergy warning is present, as the brief asks for mugwort.

