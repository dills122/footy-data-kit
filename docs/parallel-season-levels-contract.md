# Parallel Season Levels Contract

This note defines the canonical output shape for seasons where one pyramid level contains parallel leagues.

## Rule

Top-level `tierN` keys represent actual English football pyramid levels, not storage slots.

For a single league at a level, the tier keeps the existing shape:

```json
{
  "tier4": {
    "season": 1958,
    "table": [],
    "promoted": [],
    "relegated": [],
    "metadata": {
      "structure": "single-league",
      "leagueLevel": 4,
      "tierKey": "tier4"
    }
  }
}
```

For parallel leagues at the same level, the parent tier has an empty `table` and stores league tables under `divisions`:

```json
{
  "tier3": {
    "season": 1921,
    "table": [],
    "promoted": [],
    "relegated": [],
    "metadata": {
      "structure": "parallel-leagues",
      "leagueLevel": 3,
      "parallelGroup": "third-division-north-south",
      "divisionCount": 2,
      "tierKey": "tier3"
    },
    "divisions": [
      {
        "season": 1921,
        "table": [],
        "promoted": [],
        "relegated": [],
        "metadata": {
          "structure": "single-league",
          "leagueLevel": 3,
          "parallelGroup": "third-division-north-south",
          "divisionKey": "north",
          "title": "Third Division North",
          "tierKey": "tier3"
        }
      }
    ]
  }
}
```

## Known Parallel Groups

- `third-division-north-south`: Third Division North and Third Division South, level 3, 1921-1957.
- `conference-north-south`: Conference North and Conference South, level 6, 2004-2014.
- `national-league-north-south`: National League North and National League South, level 6, 2015 onward.
- `step-three-premier-divisions`: level 7 parallel feeder leagues, configured but not currently a v1 supported coverage target.

## Breaking Change

Older generated output used the next free top-level tier slot for parallel leagues. For example, Third Division South appeared at `tier4` in 1921-1957 even though it was level 3.

The canonical shape moves those records under the actual level:

- Third Division North/South: `tier3.divisions[]`
- National League North/South: `tier6.divisions[]`

Consumers should read `metadata.structure` to distinguish a single-league tier from a parallel tier. Code that needs all clubs at a level can flatten `tierN.divisions[].table` when `structure` is `parallel-leagues`.
