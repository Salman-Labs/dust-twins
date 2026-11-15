# Dust Twins

**Where on Earth does the sky carry dust the way it does at a Mars landing site, and in which months?**

**Live app: https://dust-twins.vercel.app** · story mode: https://dust-twins.vercel.app/?story=1

NASA Space Apps Challenge 2026 · Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars* · Islamabad

Dust on its solar panels ended NASA's InSight lander in 2022, and a planet-wide dust storm ended the Opportunity rover in 2018. Dust Twins compares 13 Mars years of orbital dust records with 24 years of NASA's Earth dust record and finds the places on Earth whose dust *behaves* most like each landing site's, then turns each match into a month-by-month test calendar.

These are **atmospheric dust-behaviour analogues** and **candidate test windows**. They are hypotheses to check on site. They are not predictions of dust settling or of solar power loss.

## What the app does

- **Pick a Mars site** (InSight, Opportunity, Spirit, Perseverance, Curiosity). Earth lights up with its twin map and ten best regions.
- **Dust Ring.** One year of dust drawn as a ring. Two rings overlaid show a match; turning the Earth ring shows the season shift.
- **Test Card and Test Calendar.** For each twin: which Earth months line up with which Mars season, how well, what matches, and what can never match.
- **Dust regimes.** A second map layer: every cell on both planets grouped by the shape of its dust year.
- **Evidence.** Seven method checks, published whichever way they came out.
- **Argue against this twin.** An SI model reads one twin's figures and gives the strongest reasons the match could fail.
- **Ask a planning question.** An SI model looks the answer up in the app's data, points the globes at it and states a caveat.
- **Story mode.** The InSight story in five beats, two of them hands-on. Add `?story=1` to the URL.

## Method

Every cell on both planets gets the same four-number fingerprint, on 12 bins per year (Earth calendar months; Mars 30° bins of solar longitude):

1. **Seasonal shape**: the yearly cycle divided by the cell's own average.
2. **Storminess**: share of months more than 1.5 times their own normal.
3. **Usual haze**: the cell's rank against the rest of its own planet.
4. **Year-to-year swing**: how far months stray from their usual level.

All four are ratios or ranks. A constant factor between the two measurements (Mars is infrared absorption, Earth is visible extinction; the usual conversion is ×2.6) cancels out and cannot change a result.

Matching: seasonal similarity is the best circular correlation over all 12 shifts, scaled by how similar the size of the cycle is; the winning shift builds the calendar. The score is a weighted mean (season 0.4, the other three 0.2 each). Earth cells must be land, ice-free and carry a measurable dust signal (2,230 cells).

Two further analyses run on the same data:

- **Dust regimes (unsupervised).** k-means on a shift-invariant description of each cell's dust year (the size of its first five seasonal harmonics, plus storminess and swing), with Mars and Earth cells in one space. The number of regimes is the fewest whose silhouette is within 0.03 of the best (5; silhouette 0.31, so the regimes shade into each other).
- **Storm-year detector.** For each year, the largest share of the planet sitting above twice its own median for that time of year. Years are flagged when they sit above the widest gap in those shares and that gap is wider than the spread of the years below it.

## Results (InSight, Elysium Planitia)

- Top twins: Bechar (Algeria), Yendi (Ghana), Dakhla (Western Sahara), Khairpur (Sindh, Pakistan), Ghat (Libya).
- Best score 0.89; the best 1% of shuffled-season matches score 0.73. All ten top twins clear that line.
- None of the ten is one of the famous analog sites the challenge asks teams to look beyond. Those sites do not keep a Mars dust year under this method: Atacama's 3 scored cells fall below the scrambled-seasons line for all five Mars sites, and Iceland, Hawaii and Antarctica have too little dust in the air, or are mostly ocean or ice at this grid size, to be scored at all (`pipeline/famous_check.py`).
- Southern Pakistan is the top twin for Opportunity (Vihari, Punjab) and Spirit (Diplo, Sindh), with candidate test months around March to July. Neither falls in the same dust regime as its Mars site, so treat them as matches on timing more than on character.

Full numbers for every site are in [`web/public/data/evidence.json`](web/public/data/evidence.json).

## Evidence, including what is weak

| Check | What it asks | Result across the five sites |
| --- | --- | --- |
| Shuffle baseline | Do real matches beat matches with scrambled months? | Top score 0.88 to 0.91 against a baseline of 0.73 to 0.76 |
| Rover ground truth | Does the orbital record agree with what the rover saw in its own sky? | Correlation 0.94 (InSight), 0.79 (Opportunity), 0.97 (Spirit) |
| Mars-to-Mars self test | Do a site's own neighbours rank top on Mars? | Above 99% of the planet |
| Pressure choice | Does using the 610 Pa product change the ranking? | Rank agreement 0.96 to 0.995 |
| Split years | Do odd and even years give the same twins? | **Moderate: rank agreement 0.56 to 0.75.** Spirit is below our 0.6 line |
| Weight robustness | Do twins stay in the top 50 under random weights? | **No twin reaches our 90% bar**; the best per site are 74 to 88% |
| Storm-year detector | With no list of storms, does it find the known global Mars storms? | Flags MY25, MY28 and MY34 (2001, 2007, 2018) and no Earth year. Our first rule found only one of the three; we replaced it and report both |
| Dust regimes | Do the twins share the Mars site's dust regime? | **Only 2 to 5 of each site's top 10 do.** All five landing sites sit in a regime that covers 46% of Mars and 3% of Earth's dusty land |
| Pre-registration | Did we write expectations before running? | **No.** The panel in the app says so |

The top ten scores for a site sit close together (about 0.85 to 0.89). Read the result as a set of similar regions, not one winner.

## Limits

- **Earth cannot copy Mars.** Thin air, 38% gravity, static-charged dust, finer iron-rich particles, and no rain or dew. Every Test Card lists these.
- **Dust in the sky is not dust on a panel.** On Mars, wind cleaning mattered as much as dust loading: Spirit and Opportunity were cleaned by gusts, InSight was not. We show a wind tag per twin from MERRA-2 surface wind; it is context, not part of the score.
- **Monthly resolution.** Storminess is measured on monthly means, so short storms are smoothed out.
- **Coarse grids.** Mars cells are 3°; Earth cells are 2.5° × 2° and subsampled, not area-averaged. Match regions, not spots.
- **MERRA-2 is a reanalysis**, part model and part observation.
- **Demand is unproven.** The Mars dust hardware tests we found ran in lab chambers. We did not find a field site picked for its dust climate, but we did not survey every field campaign, so treat this as a lead, not a proven gap.

## Data

| Data | Source | Use |
| --- | --- | --- |
| Mars column dust optical depth, Mars Years 24 to 36 | Montabone et al. dust climatology, LMD (built from NASA TES, THEMIS and MCS). CC BY-SA 3.0 | Mars fingerprints |
| MERRA-2 dust optical depth (`M2TMNXAER`, `DUEXTTAU`), 1999 to 2022 | NASA GES DISC | Earth fingerprints |
| MERRA-2 surface wind speed (`M2TMNXFLX`), land fraction (`M2C0NXASM`) | NASA GES DISC | Wind tag, land mask |
| Rover atmospheric opacity: Opportunity and Spirit Pancam, InSight | NASA PDS Geosciences Node; Lemmon et al. (Mendeley Data, CC BY 4.0) | Ground truth |
| Earth imagery, InSight final selfie (PIA25287) | NASA Earth Observatory; NASA/JPL-Caltech | Globe texture, story |
| Mars texture | Solar System Scope, CC BY 4.0 | Globe texture |

Cite: Montabone et al. (2015), *Icarus* 251, 65-95; Montabone et al. (2020), *JGR Planets*, doi:10.1029/2019JE006111.

## Related work

[OwenSolis03/Space_Apps_2026_Analogos_Luna_Marte](https://github.com/OwenSolis03/Space_Apps_2026_Analogos_Luna_Marte) also uses the Montabone climatology, as one of seven dimensions in a general analog matcher. Dust Twins looks only at dust and goes further on that one process: storminess, year-to-year swing, wind, rover ground truth and a test calendar.

## Use of Super Intelligence (SI)

SI tools (Claude) were used for background research, for proposing and writing the pipeline and web code, including the regime clustering, the storm-year detector and the two in-app SI features, and for drafting this README. Files written with SI assistance say so in their header comments. All numbers in the app come from the pipeline run on the data above; none were generated by an SI tool. No SI-generated images are used.

**In the app.** Two features call an SI model (Google Gemini) at run time: *Argue against this twin* and *Ask a planning question*. The model only receives figures produced by the pipeline. Every number it writes is checked against those figures afterwards: a reason that cites an untraceable number is dropped and the count is shown, and an answer that does is flagged. Both are labelled as SI-written in the interface. When the shared key is unavailable the app replays saved runs, labelled as such, and a visitor can use their own key, which stays in their browser.

The story-mode narration (`web/public/audio/story-*.mp3`) is SI-generated speech, made with ElevenLabs text-to-speech from a script in `pipeline/narrate.py`. Each file carries that statement in its metadata.

## Run it

```bash
python3 -m venv .venv && .venv/bin/pip install earthaccess xarray netCDF4 numpy scipy pillow reverse_geocoder pycountry
.venv/bin/python pipeline/earth_fetch.py        # needs a free NASA Earthdata login
.venv/bin/python pipeline/earth_fetch.py wind
# download the 13 dustscenario_MY*.nc files and the three rover tables into data/raw/ (URLs in pipeline/build.py docstring and above)
.venv/bin/python pipeline/build.py              # writes web/public/data/
cd web && pnpm install && pnpm dev
```

## Licence

Code: MIT. Derived data in `web/public/data/`: CC BY-SA 3.0, as required by the Mars dust climatology.
