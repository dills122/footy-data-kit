# Tier 3 And Tier 4 Parser Readiness Plan

This plan turns the lower-tier coverage findings into an implementation path for making the maintained Wikipedia parser ready to pull in tier 3 and tier 4 data more consistently.

The evidence log lives in [lower-tier-coverage-analysis.md](./lower-tier-coverage-analysis.md). This file is the execution plan.

## Scope

Primary goal:

- make the overview parser, generation flow, metadata model, and verifier trustworthy for English tier 3 and tier 4 coverage across the full Football League timeline

Non-goals for this slice:

- do not backfill tier 5, level 6, or true level 7 data yet
- do not hand-edit generated output JSON shape outside the parser/generator flow
- do not hand-edit generated `data-output/` files
- do not make the overview parser absorb non-Football-League competitions just because they appear on the same page

Important model distinction:

- `tierN` is the actual football pyramid level
- `metadata.structure` tells consumers whether a tier is a single league or a parallel-league parent

That distinction is required for historical parallel leagues. From 1921 through 1957, Third Division North and Third Division South are represented under `tier3.divisions[]`. Modern National League North and South are represented under `tier6.divisions[]`.

## Current State

Already in place:

- shared config knows the major lower-tier league names, level ranges, and special seasons
- overview generation can attach `leagueStructureSpecialCases` into `seasonInfo`
- output normalization preserves that special-case metadata
- verifier logic understands `divisions[]` for known parallel-league levels
- focused tests cover the current config and verifier behavior
- current generated output passes verification with the new metadata rules

Known parser limitation:

- multiple tables under a generic page heading can inherit the same broad title and only differ by `tableIndex`
- that is tolerable for current output, but not ideal for systematic lower-tier parsing because identity, level inference, and special-case handling become too dependent on fallback order

## Architecture Decisions

Keep the canonical output contract:

- continue writing `tier1`, `tier2`, `tier3`, `tier4`, and later levels as top-level season record properties
- represent historical parallel leagues with `metadata.structure: "parallel-leagues"` and child `divisions[]`
- attach source-specific context in metadata rather than changing the top-level shape

Centralize domain facts:

- use `wikipedia/config.js` helpers for league level ranges and special seasons
- do not add one-off historical checks directly inside row parsing unless there is no reusable rule
- keep naming aliases and structural exceptions near the existing Wikipedia config

Separate parser identity from output level:

- parser output should preserve the source table title/id
- generation should decide the output level and whether to group parallel divisions
- metadata should carry canonical or inferred identity when source labels are ambiguous

Regenerate only after parser behavior is locked:

- tests and temporary dry runs come before checked-in generated data changes
- generated JSON changes should be reviewed as data diffs, not mixed into unrelated parser refactors

## Dependency Map

Work should land in this order:

1. Config and metadata model are stable.
2. Parser table identity becomes reliable for tier 3 and tier 4 page shapes.
3. Builder maps parsed tables into stable levels and parallel division groups.
4. Verifier and comparison tooling understand expected historical anomalies.
5. Boundary fixtures cover the major structural seasons.
6. Temporary regeneration confirms the data diff.
7. Checked-in generated output is refreshed in a dedicated slice.

## Phase 1: Lock The Existing Tier 3 And Tier 4 Contract

Goal:

- make the current expected semantics explicit before changing parser behavior

Tasks:

- add or expand parser tests for representative tier 3 and tier 4 table structures
- add builder tests that assert `tierN`, `metadata.leagueLevel`, and `divisions[]` separately
- add verifier tests for known historical anomalies rather than relying on broad tolerances

Representative seasons:

- `1920`: first single Third Division season
- `1921`: first Third Division North and South split
- `1923`: early North/South expansion period
- `1957`: final regional Third Division season
- `1958`: first national Third Division and Fourth Division season
- `1992`: Premier League naming shift
- `2004`: League One and League Two rebrand
- `2019`: COVID, Bury, Macclesfield, and points-per-game handling

Acceptance criteria:

- tests prove no `tier4` exists before the true fourth level begins in 1958
- tests prove true level 4 starts in 1958
- tests prove 1992 and 2004 name changes do not alter stored level semantics
- verifier treats documented low row counts and parallel divisions as expected, not as parser failures

Checkpoint:

```sh
pnpm test -- --runTestsByPath wikipedia/__tests__/wiki-overview-parser.test.js wikipedia/__tests__/parse-ext-season-overview-pages.test.js wikipedia/__tests__/season-rules.test.js wikipedia/__tests__/verify-football-data.test.js
pnpm typecheck
pnpm lint
```

## Phase 2: Improve Parser Table Identity

Goal:

- make ambiguous overview tables carry enough identity for deterministic level inference

Tasks:

- improve title/id resolution when several `wikitable` elements appear under one generic heading
- make generic headings such as `League tables`, `Tables`, and `Final standings` inherit the nearest useful competition heading
- preserve source labels while also exposing an inferred or canonical league identity when needed
- ensure the parser stays anchored to Football League sections and does not pull in sibling competitions such as Southern League or cup sections

Likely files:

- `wikipedia/parser-core/wiki-overview-parser.js`
- `wikipedia/builders/parse-ext-season-overview-pages.js`
- `wikipedia/config.js`
- `wikipedia/__tests__/wiki-overview-parser.test.js`
- `wikipedia/__tests__/parse-ext-season-overview-pages.test.js`

Acceptance criteria:

- Third Division North and South tables infer as separate source identities and shared level 3
- 1958 Fourth Division tables infer as true level 4
- generic 2012 and 2013 `League tables` style labels no longer hide the intended league identity where the page exposes enough nearby context
- 2021 and later National League North/South tables can be distinguished without depending only on `tableIndex`

Checkpoint:

```sh
pnpm test -- --runTestsByPath wikipedia/__tests__/wiki-overview-parser.test.js wikipedia/__tests__/parse-ext-season-overview-pages.test.js
pnpm wiki:verify
```

## Phase 3: Add Boundary Fixtures

Goal:

- protect the structural boundaries that are most likely to regress when parser coverage expands

Tasks:

- add compact fixture-style tests for target seasons instead of exhaustive year-by-year coverage
- include row count, title/id, output slot, `leagueLevel`, promoted, and relegated assertions where the page supports them
- keep fixtures representative and small enough to maintain

Priority fixtures:

- `1920`, `1921`, `1923`, `1950`, `1957`, `1958`
- `1986`, `1987`
- `1991`, `1992`, `1994`
- `2004`
- `2019`

Acceptance criteria:

- boundary seasons document the expected league structure in tests
- tests fail clearly when a parser change swaps source identity, output slot, or pyramid level
- fixture updates are not required for unrelated generated-data churn

## Phase 4: Dry-Run Regeneration And Data Diff Review

Goal:

- prove parser changes produce expected data before touching checked-in generated JSON

Tasks:

- run targeted overview builds into temporary output directories for representative seasons
- compare temporary output with current checked-in data
- review row counts, movement arrays, table titles, league ids, and metadata levels
- only then regenerate checked-in output in a separate, reviewable step

Suggested dry-run command shape:

```sh
node wikipedia/cli/index.js overview --start 1921 --end 1923 --output /tmp/footy-tier34-dry-run --force-update --include-war-placeholders
node wikipedia/cli/index.js overview --start 1957 --end 1958 --output /tmp/footy-tier34-dry-run --force-update --include-war-placeholders
node wikipedia/cli/index.js overview --start 2019 --end 2021 --output /tmp/footy-tier34-dry-run --force-update --include-war-placeholders
```

Acceptance criteria:

- temporary output reflects known tier 3 and tier 4 structure
- no sibling non-Football-League competitions are numbered into `tierN`
- generated changes can be explained by parser improvements or documented historical special cases

## Phase 5: Regenerate Checked-In Data

Goal:

- update generated overview and combined data after parser behavior is verified

Tasks:

- regenerate overview output
- regenerate combined output
- minify generated JSON if that is part of the existing checked-in format
- run data verification and schema verification
- review generated diffs before commit

Commands:

```sh
pnpm wiki:build:overview
pnpm wiki:build:combined
pnpm wiki:minify:overview
pnpm wiki:minify:combined
pnpm wiki:verify
pnpm schema:verify
```

Acceptance criteria:

- generated files contain the intended tier 3 and tier 4 metadata
- `all-seasons.json` remains internally consistent
- verifier passes without new broad exemptions
- any unresolved data oddities are documented in `lower-tier-coverage-analysis.md`

## Phase 6: Decide Remaining Semantic Corrections

Goal:

- separate parser readiness from historical interpretation decisions that could change dataset meaning

Resolved semantic decision:

- 1957-58 bottom-half movement into the new Fourth Division is represented as restructure placement, not ordinary relegation

Open decisions:

- whether 2019-20 relegation fields should represent table markers, final administrative outcomes, or both
- whether to add a stable `canonicalLeagueId` or `leagueGroup` metadata field for variant source titles
- whether generic source titles from pages such as 2012 and 2013 should be normalized in output or preserved with only supplemental metadata

Acceptance criteria:

- semantic corrections are made in dedicated commits with tests
- parser mechanics do not silently decide historical policy
- downstream users can distinguish single-league tiers, parallel-league tiers, and administrative exceptions

## Verification Plan

For parser-only slices:

```sh
pnpm test -- --runTestsByPath wikipedia/__tests__/wiki-overview-parser.test.js wikipedia/__tests__/parse-ext-season-overview-pages.test.js
pnpm typecheck
pnpm lint
```

For builder, normalizer, verifier, or config slices:

```sh
pnpm test -- --runTestsByPath wikipedia/__tests__/wiki-overview-parser.test.js wikipedia/__tests__/parse-ext-season-overview-pages.test.js wikipedia/__tests__/season-rules.test.js wikipedia/__tests__/generate-output-files.test.js wikipedia/__tests__/verify-football-data.test.js
pnpm wiki:verify
pnpm typecheck
pnpm lint
```

For generated-data slices:

```sh
pnpm wiki:verify
pnpm schema:verify
pnpm test
pnpm typecheck
pnpm lint
```

## Definition Of Ready For Parser Work

The next parser implementation slice is ready when:

- existing config rules for tier 3 and tier 4 are committed
- this plan and the coverage analysis are committed
- target seasons for the slice are named up front
- expected level and `divisions[]` behavior is written down before regeneration

## Definition Of Done For The First Parser Slice

The first parser-readiness implementation slice is done when:

- ambiguous tier 3 and tier 4 tables have reliable titles, ids, or canonical metadata
- representative boundary tests pass
- current generated output still verifies
- no checked-in generated data changes are included unless the slice explicitly targets regeneration
- follow-up data regeneration work is documented with the exact seasons and commands to run
