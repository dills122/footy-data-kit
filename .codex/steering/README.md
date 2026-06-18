# Steering Index

Use these steering files together. They are split by concern so repo guidance stays specific without repeating itself.

## Files

- `repository-steering.md`: repository scope, active pipeline, legacy boundaries, output expectations, and safe refactor limits
- `data-contracts-steering.md`: dataset invariants, canonical source identifiers, normalization rules, and semantics that must stay stable
- `pipeline-testing-steering.md`: parser workflow, resumable scraping expectations, CLI workflow, and testing/verification guidance
- `javascript-steering.md`: ESM, CLI boundaries, state management, naming, and general JavaScript implementation rules
- `javascript-esm-steering.md`: shared AI Central ESM guidance, when local links have been refreshed
- `testing-quality-gates-steering.md`: shared AI Central verification guidance, when local links have been refreshed
- `frontend-design-steering.md`: shared AI Central frontend guidance for docs site or web UI work, when local links have been refreshed

## Usage Notes

- Prefer `wikipedia/` for active ingestion work
- Treat `rsssf/` as legacy unless a task explicitly targets it
- Change generators, parsers, or config before editing generated output
- When behavior changes, update the nearest focused Jest coverage
- Refresh local AI Central links with `pnpm codex:links` when shared steering or skills are needed
