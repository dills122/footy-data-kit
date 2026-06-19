# Lower-Tier Coverage Analysis

This note tracks current generated coverage and follow-up research for extending lower English football tiers through the maintained Wikipedia pipeline.

## Current Generated Coverage Snapshot

Source checked:

- `data-output/all-seasons.json`

Current coverage by level area:

| Level area   | Current coverage              | Main issue                                                        |
| ------------ | ----------------------------- | ----------------------------------------------------------------- |
| Tier 1       | 1888-2025, excluding war gaps | Mature coverage                                                   |
| Tier 2       | 1890-2025, excluding war gaps | Mature coverage                                                   |
| Tier 3       | 1920-2025, excluding WWII gap | Good coverage; 1921-1957 uses `tier3.divisions[]` for North/South |
| Tier 4       | 1958-2025, excluding WWII gap | True level 4 starts with the 1958 Fourth Division                 |
| Tier 5       | 2012-2025 only                | Missing 1979-2011 Alliance/Conference/National tier               |
| Level 6      | 2021-2025 only                | Missing 2004-2020 National League North/South                     |
| True level 7 | Not really parsed             | Configured but not currently emitted as a v1 coverage target      |

Important modeling rule:

- `tierN` represents the actual pyramid level.
- From 1921-1957, Third Division North and Third Division South are stored under `tier3.divisions[]`.
- From 2021-2025, National League North and National League South are stored under `tier6.divisions[]`.

Recommended lower-tier slice order from the coverage snapshot:

1. Keep the parallel-league contract stable so parser, verifier, and downstream logic treat `tierN` as the actual level.
2. Backfill level 6 for 2012-2020 after the modern parallel-league model is stable.
3. Backfill tier 5 for 2004-2011, plus level 6 National League North/South for the same range.
4. Backfill tier 5 for 1979-2003.
5. Defer true level 7 until level 5 and level 6 are stable, because level 7 has multiple parallel feeder leagues.

Post-v1 phase 0-3 branch scope:

- Add tests and typed contracts for the slice order above before regenerating checked-in output.
- Keep `data-output/` unchanged while parser and builder behavior is being locked.
- Treat generated output refresh as a separate review step after dry-run diffs are understood.
- Use the phase plan in [post-v1-phase-0-3-plan.md](./post-v1-phase-0-3-plan.md) as the active branch checklist.
- Distinguish parser readiness from source availability: representative dry runs show some yearly overview pages do not expose the missing lower-tier tables.

Prep decision:

- Before broad parser changes, patch the known domain facts into shared config and output normalization.
- Keep this as a quick-win slice: league identity names, season boundary ranges, parallel-league metadata, and administrative special cases.
- Use those shared facts as the base for later parser work instead of embedding one-off checks in table extraction code.

## Tier 3 And Tier 4 Historical Timeline

This section focuses on the third and fourth levels because those are the nearest lower-tier boundaries already present in generated data.

### Level 3

| Seasons      | League shape                                                                       | Generated representation              | Notes                                                                      |
| ------------ | ---------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| 1920-1921    | Football League Third Division                                                     | `tier3`, `leagueLevel: 3`             | First third-tier season; no fourth tier                                    |
| 1921-1958    | Third Division North and Third Division South, parallel regional level-3 divisions | `tier3.divisions[]`, `leagueLevel: 3` | No true level-4 table exists before 1958                                   |
| 1958-1992    | National Football League Third Division                                            | `tier3`, `leagueLevel: 3`             | Fourth Division begins in 1958, so `tier4` becomes a true level-4 division |
| 1992-2004    | Football League Second Division                                                    | `tier3`, `leagueLevel: 3`             | Premier League breakaway shifted Football League names down one level      |
| 2004-present | Football League One / EFL League One                                               | `tier3`, `leagueLevel: 3`             | Rebrand from the old Football League Second Division                       |

### Level 4

| Seasons      | League shape                               | Generated representation  | Notes                                                            |
| ------------ | ------------------------------------------ | ------------------------- | ---------------------------------------------------------------- |
| 1920-1958    | No true fourth tier in the Football League | No true level-4 table     | Third Division South is represented under `tier3.divisions[]`    |
| 1958-1992    | Football League Fourth Division            | `tier4`, `leagueLevel: 4` | Created from the regional Third Division North/South restructure |
| 1992-2004    | Football League Third Division             | `tier4`, `leagueLevel: 4` | Old Fourth Division renamed after Premier League formation       |
| 2004-present | Football League Two / EFL League Two       | `tier4`, `leagueLevel: 4` | Rebrand from the old Football League Third Division              |

## Generated Tier 3 And Tier 4 Data Observations

Generated overview rows currently match the major structural boundaries:

- `tier3` exists from 1920 onward except WWII suspension years.
- `tier4` exists from 1958 onward as the true fourth level.
- `tier3` row counts are expected at 22 in 1920; from 1921-1957 each regional division has its own row count under `tier3.divisions[]`; then the national tier is usually 24 from 1958 onward except special cases.
- `tier4` row counts are expected at 24 for most true Fourth Division / League Two seasons, and lower during the early 1990s disruption.

Static CSV coverage:

| File                     | Season range | Gaps      | Notes                                                        |
| ------------------------ | ------------ | --------- | ------------------------------------------------------------ |
| `data/england_tier3.csv` | 1920-2021    | 1939-1945 | Includes regional North/South era as one tier-3 match corpus |
| `data/england_tier4.csv` | 1958-2021    | none      | Starts only when the real fourth tier begins                 |

Metadata/title cleanup candidates:

- v0.9.1 replaces known generic `League tables` overview titles with canonical
  season/level labels in generated tier metadata while preserving source
  `leagueId` values.
- Several 1990s/2000s overview pages use variant IDs such as `Division_Two_2`, `Football_League_Division_Two`, and `Football_League_Second_Division`; these are acceptable source IDs but need canonical comparison helpers if downstream code groups leagues by identity.

## Tier 3 And Tier 4 Attention Points

### 1921-1957 parallel level 3

This is the most important tier semantics boundary already in the data.

- Third Division North and Third Division South are parallel level-3 divisions.
- Current output stores them under `tier3.divisions[]`.
- Any logic that needs all level-3 clubs should flatten the division tables for those seasons.
- Parser, verifier, and downstream analysis should treat `metadata.structure: "parallel-leagues"` as the signal to read divisions.

Target seasons:

- 1920: first single Third Division season.
- 1921: first North/South split.
- 1923: Third Division North expands from 20 to 22 clubs.
- 1950: North/South divisions expand to 24 clubs.
- 1957 and 1958: final North/South season and first national Third/Fourth Division season.

### 1957-1958 restructure into true tiers 3 and 4

The 1957-58 North/South season is a special movement case. Bottom-half North/South clubs moved into the new Fourth Division for 1958-59 by restructure placement, not by ordinary relegation.

Current contract:

- `1957.tier3` remains a parallel level-3 parent with North/South divisions.
- No true `1957.tier4` table exists.
- Fourth Division placement rows keep their source notes but set `wasRelegated: false`.
- `1957.tier3.relegated` and the division-level `relegated` arrays exclude Fourth Division placement rows.
- `seasonInfo.leagueStructureSpecialCases` carries the `restructure-placement` annotation across the 1957-58 to 1958-59 boundary.

### 1986-1987 playoff and Conference boundary

The late 1980s introduce two important level-4 changes:

- Football League play-offs start in 1987.
- Automatic relegation from the Fourth Division to the Football Conference starts in the same period.

Target seasons:

- 1986: last pre-playoff style season.
- 1987: first playoff season and early automatic Conference relegation boundary.

### 1991-1994 reduced fourth-tier sizes

Generated `tier4` row counts drop during the early 1990s:

- 1991: 23 rows.
- 1992: 23 rows.
- 1993: 22 rows.
- 1994: 22 rows.

These align with Football League disruption around Aldershot folding in 1991-92, Maidstone leaving in 1992, and the Premier League-era restructuring. Treat them as expected historical anomalies, not parser row-count failures.

Target seasons:

- 1991: Aldershot record/void handling.
- 1992: first Premier League season; `tier3` becomes Second Division and `tier4` becomes Third Division.
- 1994 and 1995: confirm transition back toward normal 24-team level-4 shape.

### 2004 rebrand

The 2004-05 season is the clean branding boundary:

- level 3: Football League Second Division becomes Football League One.
- level 4: Football League Third Division becomes Football League Two.

Target season:

- 2004: assert league titles, IDs, levels, and promoted/relegated extraction for both tiers.

### 2019-2020 COVID and Bury/Macclesfield handling

The 2019-20 season is not a normal row/status season.

- League One operated with 23 active teams after Bury was expelled, but overview output still has 24 rows because Bury is represented.
- League One and League Two were curtailed and final positions were decided on points per game.
- Administrative outcomes are represented with row-level `outcomeStatus` values while ordinary `relegated` arrays stay limited to final relegation outcomes.

Current contract:

- `2019.tier3.relegated` excludes Bury; Bury is represented with `outcomeStatus: "expelled"` and `wasRelegated: false`.
- `2019.tier4.relegated` includes Macclesfield Town only.
- Stevenage is represented with `outcomeStatus: "reprieved"`, `wasReprieved: true`, and `wasRelegated: false`.
- Macclesfield Town is represented with `outcomeStatus: "relegated-after-points-deduction"` and remains the final League Two relegation outcome.
- Earlier administrative exits such as failed re-election, resignation, folding, expulsion, and demotion also publish `outcomeStatus` where source notes identify them.

## Research Sources

- Football League Third Division: https://en.wikipedia.org/wiki/Football_League_Third_Division
- Football League Third Division North: https://en.wikipedia.org/wiki/Football_League_Third_Division_North
- Football League Third Division South: https://en.wikipedia.org/wiki/Football_League_Third_Division_South
- Football League Fourth Division: https://en.wikipedia.org/wiki/Football_League_Fourth_Division
- English Football League division renaming history: https://en.wikipedia.org/wiki/English_Football_League
- EFL League One: https://en.wikipedia.org/wiki/EFL_League_One
- EFL League Two: https://en.wikipedia.org/wiki/EFL_League_Two
- English Football League play-offs: https://en.wikipedia.org/wiki/English_Football_League_play-offs
- 2019-20 EFL League One: https://en.wikipedia.org/wiki/2019%E2%80%9320_EFL_League_One
- 2019-20 EFL League Two: https://en.wikipedia.org/wiki/2019%E2%80%9320_EFL_League_Two

## Post-V1 Backfill Dry Runs

Use temporary output directories before any checked-in data refresh.

### Representative Findings

The phase 0-3 branch tested representative yearly overview pages against the live Wikipedia source.

| Season | Source page                   | Tables found | Generated depth | Finding                                                                             |
| ------ | ----------------------------- | ------------ | --------------- | ----------------------------------------------------------------------------------- |
| 1979   | `1979–80_in_English_football` | 4            | `tier1`-`tier4` | The yearly overview page does not expose the Alliance Premier League table.         |
| 2004   | `2004–05_in_English_football` | 4            | `tier1`-`tier4` | The yearly overview page does not expose Conference National/North/South tables.    |
| 2012   | `2012–13_in_English_football` | 5            | `tier1`-`tier5` | The yearly overview page exposes Conference Premier but not Conference North/South. |

Conclusion:

- The existing overview parser and builder can represent tier 5 and level 6 when parsed tables are present.
- Missing historical tier 5 and level 6 coverage cannot be completed from these representative yearly overview pages alone.
- The next implementation slice should add alternate source-page support for lower-tier competitions, likely per-competition season pages, then merge those parsed tables into the same `tierN` output contract.

### Overview Dry-Run Commands

These commands are still useful for checking what a yearly overview page contributes, but they should not be treated as complete backfill commands for missing lower tiers.

Level 6 check where tier 5 already exists in generated data:

```sh
node wikipedia/cli/index.js overview --start 2012 --end 2020 --output /tmp/footy-lower-tier-phase3 --force-update --include-war-placeholders
```

Tier 5 plus level 6 source-availability check after the 2004 National League System restructure:

```sh
node wikipedia/cli/index.js overview --start 2004 --end 2011 --output /tmp/footy-lower-tier-phase3 --force-update --include-war-placeholders
```

Historical tier 5 source-availability check from the Alliance Premier League / Football Conference era:

```sh
node wikipedia/cli/index.js overview --start 1979 --end 2003 --output /tmp/footy-lower-tier-phase3 --force-update --include-war-placeholders
```

Dry-run review checklist:

- Confirm `tier5` and `tier6` metadata uses actual pyramid levels.
- Confirm `tier6` parent records use `metadata.structure: "parallel-leagues"` and `divisions[]`.
- Confirm sibling non-target competitions are not numbered into `tierN`.
- Compare row counts, `promoted`, `relegated`, source titles, league IDs, and table indexes against representative source pages.
- Record whether the yearly overview page contains the target lower-tier tables or whether a competition-specific source page is required.
- Regenerate checked-in `data-output/` only after parser/build diffs are understood.
