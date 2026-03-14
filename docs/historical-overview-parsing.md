# Historical Overview Parsing Notes

This note captures the current state of the Wikipedia `overview` parser for pre-modern seasons, the structural findings from manual page inspection, and the recommended follow-up slices.

The active maintained ingestion path is still `wikipedia/`. The goal here is to extend the existing overview flow carefully, not to redesign it.

## Scope Covered So Far

The current branch work has already added support for the first historical edge cases:

- `1888–89` single-table `The Football League` overview pages
- `1890–91` and `1891–92` `Football Alliance` second-tier handling
- election-era movement such as `Elected to the Football League` and `Not re-elected`
- `1919–20`-style page structure where `The Football League` is a top-level section and sibling competitions such as `Southern League` should not be numbered into FootballData `tierN` output

Related code paths:

- [wikipedia/builders/parse-ext-season-overview-pages.js](/Users/dsteele/repos/footy-data-kit/wikipedia/builders/parse-ext-season-overview-pages.js)
- [wikipedia/parser-core/wiki-overview-parser.js](/Users/dsteele/repos/footy-data-kit/wikipedia/parser-core/wiki-overview-parser.js)
- [wikipedia/config.js](/Users/dsteele/repos/footy-data-kit/wikipedia/config.js)

## Early-Season Findings

### 1888–1889

Representative page:

- [1888–89 in English football](https://en.wikipedia.org/wiki/1888%E2%80%9389_in_English_football)

Observed structure:

- no modern `League tables` root
- `The Football League` appears as the competition section
- child heading is often a generic `League table`

Parser implication:

- fallback heading traversal is required
- generic child headings must inherit the parent competition title

### 1890–1892

Representative pages:

- [1890–91 in English football](https://en.wikipedia.org/wiki/1890%E2%80%9391_in_English_football)
- [1891–92 in English football](https://en.wikipedia.org/wiki/1891%E2%80%9392_in_English_football)
- [1892–93 in English football](https://en.wikipedia.org/wiki/1892%E2%80%9393_in_English_football)

Observed structure:

- `Football Alliance` appears as the practical second tier before the Football League Second Division era settles in
- movement is sometimes described through election and re-election wording instead of explicit `Promoted` / `Relegated`

Parser implication:

- `Football Alliance` must infer as tier 2 through `1891`
- election-era notes must influence `seasonInfo.promoted` / `seasonInfo.relegated`
- election to the `Second Division` should not be counted as top-flight promotion

## First 1900s Slice Findings

Representative restart-era page shape:

- [1919–20 in English football](https://en.wikipedia.org/wiki/1919%E2%80%9320_in_English_football)

Observed structure:

- `The Football League` can appear as a top-level overview section
- sibling sections such as `Southern League` may follow on the same page

Parser implication:

- when `The Football League` exists as the root section, parsing should anchor there
- sibling non-Football-League competitions should not be assigned to `tier3+`
- generic child headings within the anchored Football League section still need parent-title fallback

## WWI Wartime Findings

Inspected pages:

- [1914–15 in English football](https://en.wikipedia.org/wiki/1914%E2%80%9315_in_English_football)
- [1915–16 in English football](https://en.wikipedia.org/wiki/1915%E2%80%9316_in_English_football)
- [1916–17 in English football](https://en.wikipedia.org/wiki/1916%E2%80%9317_in_English_football)
- [1917–18 in English football](https://en.wikipedia.org/wiki/1917%E2%80%9318_in_English_football)
- [1918–19 in English football](https://en.wikipedia.org/wiki/1918%E2%80%9319_in_English_football)
- [1919–20 in English football](https://en.wikipedia.org/wiki/1919%E2%80%9320_in_English_football)

Observed behavior:

- `1914–15` is still a normal pre-suspension season
- `1915–16` through `1918–19` explicitly describe competitive football as suspended
- wartime pages describe regional substitute competitions rather than canonical Football League tables
- `1919–20` resumes normal Football League structure

Current repo behavior:

- `1915` through `1918` are modeled as WWI suspension years
- those seasons are skipped whenever `--ignore-war-years` is enabled
- no special wartime metadata-only season record exists yet

Important conclusion:

- wartime pages should not be coerced into canonical FootballData `tier1` / `tier2` output
- the pages themselves frame those seasons as suspended official competition with substitute regional leagues

## Recommended Wartime Integration Model

Keep the canonical export unchanged by default, but allow an optional metadata-only historical mode.

### Canonical mode

- continue skipping war suspension seasons from saved output
- preserve existing `ignoreWarYears` behavior
- keep FootballData semantics stable

### Historical wartime metadata mode

Optional future behavior for `1915–1918`:

- write `seasonInfo` only
- do not emit `tier1`, `tier2`, or other canonical tiers
- keep `promoted` and `relegated` empty
- attach metadata that explains why the season is non-canonical

Suggested `seasonInfo` metadata fields:

- `competitionStatus: "wartime-special"`
- `warSuspensionLabel: "ww1"`
- `officialLeagueTables: false`
- `officialCompetitionsSuspended: true`
- `specialCompetitions: [...]`
- `notes: "Football League and FA Cup suspended; regional wartime competitions excluded from canonical records."`

This should only be added behind an explicit option. It should not silently change the default dataset.

## WWII Wartime Findings

Inspected pages:

- [1939–40 in English football](https://en.wikipedia.org/wiki/1939%E2%80%9340_in_English_football)
- [1940–41 in English football](https://en.wikipedia.org/wiki/1940%E2%80%9341_in_English_football)
- [1945–46 in English football](https://en.wikipedia.org/wiki/1945%E2%80%9346_in_English_football)
- [1946–47 in English football](https://en.wikipedia.org/wiki/1946%E2%80%9347_in_English_football)

Observed behavior:

- `1939–40` is an abandoned canonical season, not just a fully skipped wartime placeholder
- the page explicitly says the Football League, Second Division, and FA Cup were abandoned shortly after the outbreak of war
- the same page then lists regional wartime leagues and a War Cup under `Honours` and `League tables`
- `1940–41` is already fully in special wartime mode: Football League and FA Cup are marked `not held`, and the page only documents regional wartime leagues and cups
- `1945–46` is still not a normal Football League season: it uses `Football League North` and `Football League South`, explicitly without promotion or relegation from the previous peacetime season
- `1946–47` is the real return to a full four-division Football League programme and already matches the current overview assumptions well

Important distinction from WWI:

- `1939–40` is a cut-short canonical season with an abandoned official programme plus wartime substitutes
- `1940–41` through `1944–45` are wartime substitute-competition seasons
- `1945–46` is a peacetime bridge season with regional Football League competition, still non-canonical for normal promotion/relegation semantics
- `1946–47` resumes standard canonical structure

Recommended handling model:

### Default canonical mode

- continue skipping fully wartime substitute seasons
- do not parse regional wartime leagues into canonical `tier1` / `tier2` / `tier3` / `tier4`
- treat `1946–47` onward as normal overview seasons

### Metadata-only historical mode

Use one optional historical-only model with subtypes:

- `competitionStatus: "abandoned-season"` for `1939–40`
- `competitionStatus: "wartime-special"` for `1940–41` through `1944–45`
- `competitionStatus: "regional-bridge-season"` for `1945–46`

Suggested metadata for `1939–40`:

- `warSuspensionLabel: "ww2"`
- `officialLeagueTables: false`
- `officialCompetitionsAbandoned: true`
- `abandonmentPhase: "early-season"`
- `specialCompetitions: [...]`

Suggested metadata for `1945–46`:

- `warSuspensionLabel: "ww2"`
- `officialLeagueTables: false`
- `regionalBridgeSeason: true`
- `promotionRelegationApplies: false`
- `specialCompetitions: ["Football League North", "Football League South"]`

Open implementation question:

- whether `1939–40` should remain entirely excluded from canonical output, or be represented as a metadata-only placeholder because it was an officially started but abandoned season

## Progress Snapshot

The overview flow is now in decent shape through the early `1920s`.

Covered with implemented parser behavior and focused tests:

- `1888–89` single-table start of the Football League
- `1890–91` through `1891–92` Football Alliance second-tier era
- `1892+` First Division / Second Division structure
- `1900–1905` pages where `Football League` appears after `League changes`
- `1919–20` restart-era pages where `Southern League` and other sibling sections must be excluded
- `1921+` Third Division North / Third Division South seasons, with shared `leagueLevel` metadata even when stored as `tier3` and `tier4`

Not yet implemented end-to-end:

- metadata-only optional handling for wartime substitute seasons
- saved overview dataset regeneration for the newly supported historical years
- integration fixtures for early overview seasons after dataset regeneration
- later-era historical sampling beyond the early `1920s`

## Remaining Work To Reach Broad Historical Coverage

### Phase 1: Finish the `1920s`

Goal:

- confirm the overview flow is stable from `1921–22` through the end of the decade

Main checks:

- `Third Division North` / `Third Division South` stay represented as parallel level-3 leagues
- promotion and election wording for North/South winners are captured correctly
- no non-Football-League sections are pulled into `tierN`
- table heading variations such as `Tables`, `Final standings`, or generic child headings still inherit the correct parent competition

Deliverables:

- add representative tests for `1921–22`, `1924–25`, `1927–28`, and `1929–30`
- confirm whether any decade-specific heading tweaks are needed
- update this note with any new patterns found

### Phase 2: `1930s`

Goal:

- verify the parser continues to work before WWII without hidden structural drift

Main checks:

- whether `League tables` returns as the dominant root or `Football League` remains common
- whether North/South split pages keep consistent league labels and ids
- whether promotion/relegation wording shifts toward plainer `Promoted` / `Relegated` notes
- whether the verifier and continuity rules remain correct for pre-war seasons with four stored overview tiers

Deliverables:

- representative tests across early, mid, and late `1930s`
- one smoke fixture that includes a North/South split season from this era

### Phase 3: WWII Handling (`1939–40` through `1945–46`)

Goal:

- decide on final treatment of WWII interruption seasons before broad overview regeneration

Main checks:

- whether `1939–40` should be modeled as an abandoned canonical season placeholder
- whether `1940–41` through `1944–45` can reuse the wartime metadata-only pattern cleanly
- whether `1945–46` needs a dedicated `regional-bridge-season` metadata shape
- confirm that `1946–47` is the clean restart boundary for canonical overview output

Recommended implementation shape:

- keep canonical output unchanged by default
- optionally write metadata-only season records for abandoned, wartime-special, or bridge-season years
- make the option explicit so canonical exports remain stable

Deliverables:

- season-status rules for `1939–40` through `1945–46`
- option design and tests if wartime metadata-only support is implemented

### Phase 4: Post-war to pre-Premier-League normalization (`1946–1991`)

Goal:

- make the overview flow viable across the full post-war Football League era, even if the promotion flow remains canonical for much of it

Main checks:

- regional third-tier pages continue to map cleanly
- division naming remains consistent through restructures
- top-flight movement still comes only from the actual feeder tier for that season
- page templates from the `1950s`, `1960s`, `1970s`, and `1980s` do not introduce heading regressions

Suggested sampling:

- `1946–47`
- `1950–51`
- `1960–61`
- `1973–74`
- `1986–87`
- `1990–91`

Deliverables:

- targeted tests for one representative season per structural sub-era
- overview smoke coverage for at least one North/South era and one late pre-Premier-League era

### Phase 5: Saved Dataset and Integration Coverage

Goal:

- move from parser support to checked-in dataset confidence

Main checks:

- regenerate `data-output/wiki_overview_tables_by_season.json` for the newly supported early years
- verify combined output still preserves canonical behavior
- add curated overview integration fixtures once the saved dataset includes those seasons

Deliverables:

- regenerate saved overview dataset in controlled slices
- add early overview entries to [wikipedia/**integration_tests**/config.js](/Users/dsteele/repos/footy-data-kit/wikipedia/__integration_tests__/config.js)
- keep integration pages representative rather than exhaustive

### Phase 6: Decide Whether Overview Becomes the Default Historical Backbone

Goal:

- decide whether the overview flow should remain a supplemental path or become the main parser for all historical seasons

Decision criteria:

- coverage quality for `1888–1991`
- stability of `seasonInfo.promoted` / `seasonInfo.relegated`
- amount of era-specific patching still required
- whether the overview pages consistently expose enough canonical league-table detail

Possible outcomes:

- keep current split: `build` for older canonical seasons, `overview` for modern seasons and selected fallback
- switch to overview-first for broad historical ranges, with promotion flow kept for verification or legacy recovery
- maintain both and combine them using richer metadata-based precedence rules

## Open Questions

- Should `1939–40` be modeled as a wartime suspension year, an abandoned canonical season, or a metadata-only special case?
- Do any `1920s` or `1930s` pages promote North/South winners using wording that bypasses current promotion flag logic?
- Should `leagueLevel` also be added to `seasonInfo` summary metadata when a season contains parallel regional tiers?
- If wartime metadata-only seasons are added, should the combiner strip them by default from canonical outputs or preserve them when present?

## Recommended Execution Order From Here

1. Finish representative `1920s` sampling and add any missing tests.
2. Inspect `1930s` pages for structural drift.
3. Inspect WWII pages and decide on the metadata-only wartime design.
4. Sample `1946–1991` by decade and add targeted tests only where behavior differs.
5. Regenerate the saved overview dataset for supported early years.
6. Add integration fixtures once saved data exists for those seasons.

## Guardrails

- do not hand-edit `data-output/` JSON unless repairing a fixture intentionally
- do not broaden the parser to absorb every competition listed on the page
- do not change canonical dataset semantics without focused tests
- prefer metadata-only treatment for wartime substitute seasons over synthetic tier mapping

## Existing Test Coverage Added

Focused tests now cover:

- early single-table overview pages
- `Football Alliance` as second tier
- election-era movement
- scoping overview parsing to Football League sections when sibling competitions exist

Relevant test files:

- [wikipedia/**tests**/parse-ext-season-overview-pages.test.js](/Users/dsteele/repos/footy-data-kit/wikipedia/__tests__/parse-ext-season-overview-pages.test.js)
- [wikipedia/**tests**/wiki-overview-parser.test.js](/Users/dsteele/repos/footy-data-kit/wikipedia/__tests__/wiki-overview-parser.test.js)
- [wikipedia/**tests**/wikipedia-pipeline-smoke.test.js](/Users/dsteele/repos/footy-data-kit/wikipedia/__tests__/wikipedia-pipeline-smoke.test.js)
