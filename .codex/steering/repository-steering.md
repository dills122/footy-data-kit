# Repository Scope And Priorities

This repository builds structured football season datasets from semi-structured web sources.

Primary deliverable:

- FootballData-style JSON in `data-output/`

Core priorities:

- deterministic parsing
- resumable scraping
- stable JSON schemas
- incremental dataset construction
- reproducible builds

## Active Ingestion Path

The actively maintained ingestion pipeline is `wikipedia/`.

This area contains:

- scraping logic
- HTML parsers
- CLI tooling
- tests
- dataset validators

Prefer changes here unless the task explicitly targets legacy tooling.

## Legacy Tooling

Treat `rsssf/` as legacy archival tooling.

Rules:

- prefer Wikipedia as the primary source
- avoid new architecture in RSSSF
- limit RSSSF changes to bug fixes or compatibility work unless explicitly instructed

## Output Expectations

All generated datasets live in `data-output/`.

Rules:

- do not hand-edit output JSON except for fixture repair
- change parser or generator logic instead of patching generated data
- preserve existing output directory structure unless explicitly asked to change it

## Safe Refactor Boundaries

Do not refactor these without explicit instruction:

- CLI command signatures
- dataset schema
- output directory structure

Safe default changes:

- parser fixes
- focused normalization improvements
- config cleanup
- targeted test additions
