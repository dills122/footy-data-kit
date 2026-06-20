# Pre-2004 Tier 6 Source Spike

Date: 2026-06-20

This spike checks whether Wikipedia has reliable, parseable source pages for
backfilling the level directly below the Alliance Premier League / Football
Conference from `1979-80` through `2003-04`.

## Goal

Determine whether the pre-2004 feeder layer can be generated into the existing
`tierN = actual pyramid level` contract as:

```text
1979-2003 tier6.divisions[]
```

The candidate feeder competitions are:

- Northern Premier League
- Southern Football League
- Isthmian League

## Source Availability Result

The spike fetched and parsed all 75 target Wikipedia season pages:

```text
25 seasons x 3 competitions = 75 pages
```

Result:

- Missing pages: `0`
- Missing target tables: `0`
- Unexpected target division counts: `0`
- Confirmed upstream Wikipedia defects: `0`

Any future row-level Wikipedia defects found while validating these pages should
be tracked in
[wikipedia-source-issues.md](/Users/dsteele/repos/footy-data-kit/docs/wikipedia-source-issues.md).

The pages use consistent season slugs:

```text
{season}_Northern_Premier_League
{season}_Southern_Football_League
{season}_Isthmian_League
```

Examples:

- `1979–80_Northern_Premier_League`
- `1979–80_Southern_Football_League`
- `1979–80_Isthmian_League`
- `2003–04_Northern_Premier_League`
- `2003–04_Southern_Football_League`
- `2003–04_Isthmian_League`

## Target Division Rules

The earlier three-division shorthand is close but incomplete. The Southern
Football League did not expose a Premier Division immediately after the Alliance
Premier League was formed.

Recommended target model:

| Seasons   | `tier6.divisions[]` targets                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1979-1981 | Northern Premier League table; Southern Football League Midland Division; Southern Football League Southern Division; Isthmian League Premier Division             |
| 1982-2003 | Northern Premier League top table / Premier Division; Southern Football League Premier Division; Isthmian League Premier Division                                  |

This means `tier6.divisions[]` should have four divisions for `1979-1981` and
three divisions for `1982-2003`.

## Row Count Findings

| Area                                      | Seasons   | Target table count | Row-count range |
| ----------------------------------------- | --------- | ------------------ | --------------- |
| Northern Premier League top table         | 1979-1986 | 8                  | 22              |
| Northern Premier League Premier Division  | 1987-2003 | 17                 | 22-23           |
| Southern Football League Midland Division | 1979-1981 | 3                  | 22              |
| Southern Football League Southern Division | 1979-1981 | 3                  | 24              |
| Southern Football League Premier Division | 1982-2003 | 22                 | 20-22           |
| Isthmian League Premier Division          | 1979-2003 | 25                 | 22-24           |

Season totals:

| Seasons   | Division count | Total target rows |
| --------- | -------------- | ----------------- |
| 1979-1981 | 4              | 90                |
| 1982-1985 | 3              | 64                |
| 1986-1995 | 3              | 66                |
| 1996      | 3              | 67                |
| 1997-1998 | 3              | 66                |
| 1999-2001 | 3              | 67                |
| 2002-2003 | 3              | 69                |

The row-count variation appears structural rather than a parser gap.

## Parser Implications

The current lower-tier supplement flow already fetches competition season pages
and writes parsed tier records into the overview dataset. The pre-2004 tier 6
backfill should extend that same flow rather than adding a separate ingestion
path.

Implementation needs:

- Add a `pre-2004-conference-feeders` parallel group.
- Extend lower-tier source config so a season can emit the tier 5 source plus
  multiple feeder source pages.
- Select only the target tables from feeder pages.
- Merge target tables from multiple source pages into one `tier6` parent record
  with `metadata.structure: "parallel-leagues"`.
- Preserve each division's source URL, source slug, title, league ID, row count,
  and division key.

Suggested division keys:

```text
northern-premier
southern-midland
southern-southern
southern-premier
isthmian-premier
```

## Implementation Recommendation

Build the next slice in two commits:

1. Config/tests/reporting
   - Add source profiles and target-table rules.
   - Add focused parser/builder tests for `1979`, `1981`, `1982`, `1986`, and
     `2003`.
   - Add a lower-tier source coverage report that fails on missing target pages
     or missing target tables.

2. Generated output refresh
   - Run lower-tier supplement generation for `1979-2003`.
   - Rebuild combined/minified output and club metadata.
   - Verify row counts, metadata, integration coverage, docs, and data schemas.

Do not backfill post-2004 step-three feeder leagues in this slice. After 2004
those competitions are level 7 in the current model and should remain a separate
future target.

## Source URLs Checked

- https://en.wikipedia.org/wiki/1979%E2%80%9380_Northern_Premier_League
- https://en.wikipedia.org/wiki/1979%E2%80%9380_Southern_Football_League
- https://en.wikipedia.org/wiki/1979%E2%80%9380_Isthmian_League
- https://en.wikipedia.org/wiki/2003%E2%80%9304_Northern_Premier_League
- https://en.wikipedia.org/wiki/2003%E2%80%9304_Southern_Football_League
- https://en.wikipedia.org/wiki/2003%E2%80%9304_Isthmian_League
