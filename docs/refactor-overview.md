# Refactor Overview

This note outlines a low-risk refactor direction for the maintained Wikipedia pipeline.

The goal is not to redesign the scraper. The goal is to make the current behavior easier to understand, test, and extend without drifting builder, combiner, verifier, and fixture-generation logic apart.

## Why Refactor

The active `wikipedia/` flow works, but several files currently mix together concerns that are easier to reason about separately:

- fetching remote HTML
- locating and parsing league tables
- normalizing rows and metadata into FootballData shape
- applying season-era rules such as war-year handling or tier inference
- loading and saving JSON datasets

That makes targeted changes more expensive than they need to be. A parser fix can easily turn into a builder change, a validator change, and a fixture repair.

## Refactor Direction

### 1. Separate pipeline layers

Split the maintained Wikipedia flow into clearer layers:

- `fetch`
  - remote HTML retrieval
  - backoff, delay, user-agent handling
- `parse`
  - heading discovery
  - table extraction
  - legend handling
  - row parsing
- `normalize`
  - map parsed rows into FootballData-compatible `seasonInfo` and `tierN` blocks
  - attach stable metadata
- `persist`
  - load existing dataset
  - merge or replace season records
  - save final JSON and metadata

This keeps CLI entry points thin and makes parser logic importable without dragging file I/O into every test.

### 2. Create shared Wikipedia parser primitives

The promotion and overview paths should stay separate, but they already share real behavior:

- Wikipedia URL building
- season slug and season-year helpers
- heading traversal
- legend parsing
- team-status inference from notes
- season-era tier inference

That shared behavior should live in a small internal parser core instead of being repeated across:

- [parse-season-pages.js](/Users/dsteele/repos/footy-data-kit/wikipedia/parse-season-pages.js)
- [parse-ext-season-overview-pages.js](/Users/dsteele/repos/footy-data-kit/wikipedia/parse-ext-season-overview-pages.js)
- [parse-division-table.js](/Users/dsteele/repos/footy-data-kit/wikipedia/parse-division-table.js)

The main rule is to extract only genuinely shared logic. One-off heuristics should remain near the parser that owns them.

### 3. Centralize season and era rules

A few domain rules are fundamental and should have one source of truth:

- war-year suspension seasons
- promotion continuity boundary before the Premier League era
- Premier League-era tier interpretation
- expected tier depth by season range
- canonical source identifiers and dataset filenames

Some of this has already started moving into shared config. The next step is to expose those rules through a small domain API so builder, combiner, verifier, and tests all use the same behavior.

### 4. Isolate dataset persistence

Dataset generation should not depend on ad hoc load/mutate/save patterns spread across builders.

A small persistence layer should own:

- reading FootballData exports
- updating a season record
- preserving top-level metadata
- saving atomically
- supporting targeted single-season rebuilds without hand editing fixtures

This is especially important for checked-in fixture exports like:

- `data-output/wiki_promotion_relegations_by_season.json`
- `data-output/wiki_overview_tables_by_season.json`

## Suggested Slice Order

### Slice 1: Parser core extraction

Extract shared helpers for:

- article URL helpers
- tier inference
- heading and legend utilities
- common row normalization support

Keep behavior identical. The first pass should be mostly movement, not logic changes.

### Slice 2: Build orchestration cleanup

Refactor the promotion and overview builders so they:

- fetch
- parse
- normalize
- persist

in distinct steps with small helper boundaries.

### Slice 3: Dataset persistence API

Introduce a small persistence module used by:

- promotion build
- overview build
- one-season rebuilds
- future fixture refresh commands

### Slice 4: Validator and combiner alignment

Move remaining duplicated season-rule logic out of:

- [combine-output-files.js](/Users/dsteele/repos/footy-data-kit/wikipedia/combine-output-files.js)
- [verify-football-data.js](/Users/dsteele/repos/footy-data-kit/wikipedia/verify-football-data.js)

and onto the shared season-rules layer.

## Expected Benefits

- smaller parser changes
- less duplicated season-rule logic
- easier fixture regeneration
- easier data-integrity testing
- clearer separation between parser bugs and dataset-writing bugs

## Guardrails

- do not replace the current curated integration model
- do not hide parser behavior behind overly generic abstractions
- do not mix refactor-only changes with broad data rewrites unless regeneration is intentional
- require focused tests for any movement of season-boundary or tier-inference logic
