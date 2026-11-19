# Indoor Rating Studio

A colorful offline indoor-soccer rating app built with ordinary HTML, CSS, and JavaScript. No Electron, npm, server, installation, or internet connection required.

## Start

1. Unzip the `MATCH RATING APP` folder.
2. Keep all five application files **together**: `index.html`, `style.css`, `ratings.js`, `storage.js`, and `script.js`.
3. Double-click **index.html** in Chrome, Edge, Firefox, or Safari.
4. Enter match details, record actions, and choose **Save & view report**.

## Import and export

- **Data & settings → Export complete JSON backup** exports every saved match, all 40 statistics per match (including zeros), historical weights, and current rating weights. Recommended for restoration.
- **Data & settings → Export library CSV** creates a spreadsheet-ready library with one match per row and every stat/weight as a column. This CSV is also importable by the app.
- **Data & settings → Choose JSON / CSV to import** restores either of the preceding files. **Merge** matches by ID; **Replace** overwrites the current match library (after confirmation).
- **Match library → Report** opens a detailed report with all 40 event rows, counts, saved weights, position factors, contributions, and the final match rating. From there, export a per-match JSON, export its detailed CSV, or **Print / PDF** (select “Save as PDF” in your print dialog).
- A *per-match report CSV* is designed for viewing and sharing; use a *library CSV* or JSON for importing performances.

## Your data

The app attempts to save records and the current draft to browser `localStorage`. Because browsers vary in how they treat files opened from `file://`, **keep regular JSON backups**. Reopening from a different path or browser may show a different set of saved data; import your backup when needed.

The rating model is an independent illustrative formula inspired by event-based match grading, **not** official SofaScore/FotMob weights. Match ratings start at 6.5 and are clamped to 3.0–10.0. Position multipliers are defined in `ratings.js`. Settings let you change individual event weights; saved match reports keep a snapshot of their original weights.

## Files

- `index.html` — pages, layout and report dialog
- `style.css` — responsive, colorful, dark visual styling and print/PDF styles
- `ratings.js` — event definitions, weight defaults, rating calculations
- `storage.js` — normalization, local persistence, JSON/CSV import/export
- `script.js` — interactive UI, saving, library, analytics, and reports


## V3 Beta — Legacy weight correction

- **Active default weights**: goal +0.700, assist +0.47727, shots on target +0.075, regular miss −0.025, blocked shot 0, big miss −0.230 and exceptional miss −0.300. Other original weights remain scaled by 0.70/1.10.
- When upgrading from an earlier browser version, old default weights may have persisted in `localStorage`. This release recognizes a legacy *default* weight set and updates matching defaults to the V3 Beta indoor values while leaving independently customized weights intact. The updated settings are saved on launch.
- Historical saved matches preserve their original weight snapshots and ratings, including imported older match reports. Use **Data & settings → Restore defaults** to manually choose the current V3 Beta calibration at any time.

## V3 Beta — Reordered Methodology and mixed positions

- The Methodology page now presents **How the score is calculated → Complete Event Glossary → Automatic metrics**. The standalone Tracking Rules section was removed; individual event definitions retain their concrete tracking guidance.
- Match setup includes **Mixed positions**. Allocate playing-time shares across Forward, Midfielder, Defender and Goalkeeper; shares must total **100%** to save or preview a report. The app displays a live percentage allocation bar and estimated minutes per role.
- Category position factors are weighted averages, e.g. **60% Forward + 40% Defender**: attacking factor `0.60 × 1.12 + 0.40 × 0.95 = 1.052`; defensive factor `0.60 × 0.90 + 0.40 × 1.13 = 0.992`. No duplicate full-position bonuses.
- Split allocation travels with JSON backups and library CSV exports/imports, and is included in match reports and per-event factor columns. Older single-position matches retain their exact historical factors and ratings.

## V3 Beta — Methodology guide and simplified tracking layout

- **Methodology** is a new fifth sidebar destination, with source context, scoring formula, position multipliers, all six calculated metrics, and searchable/expandable definitions for **all 40 tracked events**. Each definition includes a concrete instruction for when to count it and how to avoid accidental overlapping records.
- MASL is a **frequency benchmark**, not the origin of the proprietary event weights. 2025–26 regular-season total is 1,150 goals in 96 matches (11.98 per game, both teams), from the official April 2026 stat pack. The reference links in the app open externally only when online.
- The lower **Attack** and **Passing** completion panels were removed because the live meters already appear in the top KPI row. Thin colored progress bars were added under the top Shot accuracy / Pass completion / Dribble completion KPIs. **Other** still contains the derived total possession-lost explanation.
- All scoring defaults, match storage keys, imports/exports, report contents, and historical saved weights are unchanged. This is still **V3 Beta**.
- Counting nuance: shot outcomes are mutually exclusive; passes that qualify for a specialty subset count once in Passes completed but receive the appropriate key/long/through/cross bonus; a failed dribble is not also a dispossession; GK exceptional/penalty saves intentionally stack an ordinary-save base and extra bonus.

## V3 Beta — Shooting accuracy and dispossessions

- **Branding:** The application displays **V3 BETA** in the main heading, sidebar and footer. No Electron or local server required.
- **Shot accuracy:** (goals + saved/on-target shots) / (goals + saved/on-target shots + ordinary off-target shots + attempted shots blocked by defenders + big-chance misses + exceptional misses). Shown as a live progress meter alongside dribble completion, in the main dashboard and in full reports; JSON and CSV retain all underlying event counts.
- **Mutually exclusive shot categories:** Log each attempt once, as a goal, saved/on-target shot, ordinary off-target shot, defender-blocked attempted shot, big off-target missed chance, or exceptional off-target missed chance. Big and exceptional misses are **alternatives**, not separate penalties added on top of ordinary off-target shots. This keeps shot attempts and shooting penalties consistent. A big chance saved by the keeper is recorded under saved/on-target shots, not under the off-target missed categories.
- **Shooting default weights:** goal **+0.700**, saved/on-target non-goal **+0.075**, ordinary off-target **−0.025**, attempted shot blocked by defender **0.000**, big off-target miss **−0.230**, exceptional off-target miss **−0.300**. All are independent, user-editable values; not MASL's official rating formula.
- **Renamed event:** “Other possession lost” is now **Dispossessed** (opponent takes the ball directly off a player in possession). The underlying `posLost` field name stays the same on disk and in backups so that older saves remain importable. Record turnovers in one category only: inaccurate pass, failed dribble, poor touch, or dispossessed.
- **Legacy import note:** Previously saved matches preserve their original rating weights. Older matches that logged “Big chances missed” *in addition to* an off-target shot may count that attempt twice in the new shot-accuracy meter; review those individual matches before using the new efficiency percentage as a historical benchmark. The existing rating impact in a saved match still uses its stored event weights.
- **Upgrading:** Before deleting an earlier version, export **Data & settings → Export complete JSON backup**. Files opened at a different local path can use different browser storage. Existing settings may retain older weights; choose **Restore defaults** to load the V3 Beta shooting values.

## V1.2 — MASL-informed proportional indoor calibration

**League reference (official MASL stat pack, April 19, 2026):** 2025–26 regular season: 8 teams × 24 games = 96 matches, 1,150 goals total; 11.98 goals per match including both teams and 5.99 per team. Source: https://digitalshift-assets.sfo2.cdn.digitaloceanspaces.com/pw/52a4447e-3bb2-40af-b051-2d68f227347e/f-3e469c5c-ad3a-4fbc-8cb6-164f93903061/MASL%20STAT%20PACK%20419.pdf

- The user-established indoor goal value is **+0.70**. The intended outdoor anchor is **+1.10**, giving a **0.6363636×** factor. All other v1.1 event weights are uniformly reduced using that same factor, keeping their relative priorities intact. The v1.1 goal default in code was +1.15 even though +1.10 had been discussed; v1.2 corrects that discrepancy before scaling.
- An existing position factor still applies: midfielder +0.70, forward +0.784, defender +0.665 before other contributions. These factors were present in v1.1.
- **Not a MASL rating formula**: MASL public data does not report passes completed, dribbles, ball recoveries or their rating contributions. The MASL league sample establishes a goal-frequency sanity check, while the individual weights remain editable hypotheses.
- **Important comparability limitation:** MASL uses four 15-minute stop-clock quarters (60 regulation minutes), while this app targets 50-minute recreational matches. Do **not** use MASL rates as rigid expected local-game totals. Compare and calibrate to your actual league after recording at least 15–30 complete performances with team scores.
- Existing saved matches retain their exact historical weights. If you used v1.1 before, enter **Data & settings → Restore defaults** to activate the new v1.2 weights for your draft. This also updates the active weights used for future matches, without rewriting saved reports. Always export a JSON backup before updating.

## V1.1 — Passing, dribbles and possession

- The main rating banner shows a professional **PLAYER PERFORMANCE** heading above the player’s name.
- Passing shows **Passes completed**, **Inaccurate passes**, **Key passes**, and **Long passes completed**. Through balls and crosses remain accessible under **Additional passing events** to preserve old data.
- **Pass completion** = completed passes ÷ (completed + inaccurate passes). Key passes and long passes completed are included within completed passes; logging them does not add new pass attempts.
- **Dribble completion** = dribbles completed ÷ (completed + unsuccessful dribbles).
- **Total possession lost** = inaccurate passes + unsuccessful dribbles + unsuccessful touches + other possession lost. Enter each failed possession action in only one relevant field. This is a derived summary, **not a second rating penalty**. Other possession losses do not affect dribble completion unless the loss was an unsuccessful dribble.
- Live completion percentage progress bars appear in **Passing** and **Attack**; the derived turnover total appears in **Other**. The header displays both completion rates and total possession lost.
- Full match reports and their CSV exports include all recorded events and newly calculated efficiency figures. Library CSV exports add derived metric columns while maintaining compatibility with earlier import files.
- New matches use slightly stronger indoor penalties for inaccurate passes and failed dribbles. Historical reports keep their recorded weight snapshots.


## V3 Beta — GitHub Pages / PWA add-on (same application)

This packaging adds PWA support without changing `ratings.js`, `storage.js`, `script.js`, or `style.css`. The only changes to `index.html` are references to the manifest, home-screen icon, mobile browser metadata, and a lightweight service-worker registration script. Match calculations, reports, UI, weights, and imports/exports remain unchanged.

### Publish using GitHub Pages

1. Create a GitHub repository, such as `indoor-rating-studio`.
2. Upload **the files inside the `MATCH RATING APP` folder**, including `index.html`, `manifest.webmanifest`, `pwa.js`, `service-worker.js`, and the entire `icons` folder. They must be at the repository root, not inside an extra `MATCH RATING APP` subfolder.
3. In repository **Settings → Pages**, set **Deploy from a branch**, `main`, `/(root)`, then Save. The published address will be similar to `https://YOUR_USERNAME.github.io/indoor-rating-studio/`.
4. Open the published address in Safari on iPhone (Share → Add to Home Screen) or Chrome on Android (menu → Install app / Add to Home screen). The app supports offline opening after its first successful online load and installation.

**Important:** GitHub Pages hosts public static source files. **Do not upload real player data or JSON/CSV backups to a public repository.** Saved matches stay in each device's browser storage. Data does **not** sync automatically; use the existing JSON export/import to move match history between devices. Browser data may be cleared by browser cleanup, private browsing, or OS storage policies; maintain independent backup files.

### Local desktop use remains unchanged

Double-click `index.html` to use the application just as before. Service workers require HTTPS (or localhost), so offline installation is only enabled on GitHub Pages or a local web server. Normal `file://` use is unchanged.

### Updating a published PWA

Upload the new files to GitHub and keep the repository path the same so browser storage remains associated with the same site. Online loads prefer fresh files; offline loads use cached files. If new assets are added or file paths change, increment `CACHE_NAME` in `service-worker.js` to refresh the offline package.
