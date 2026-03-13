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

## Recommended Next Slices

### Slice 1: 1900–1905

Focus:

- election and re-election wording
- whether lower competitions appear as sibling sections after Football League tables
- whether any generic `League table` / `Tables` headings still need parent-title fallback tweaks

### Slice 2: 1919–1921

Focus:

- post-war restart pages
- confirmation that `The Football League` anchoring holds across restart-era pages
- verify no wartime or sibling leagues leak into `tierN`

### Slice 3: 1921–mid 1920s

Focus:

- Third Division North / South split
- ordering and tier assignment for parallel third-tier competitions
- page structures where multiple Football League sub-competitions sit under one top-level section

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
