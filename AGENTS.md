# Codex Steering

This repository keeps its repo-specific Codex guidance in [`.codex/steering/README.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/README.md).

Local links under [`.codex/skills/`](/Users/dsteele/repos/footy-data-kit/.codex/skills) and selected shared steering files under [`.codex/steering/`](/Users/dsteele/repos/footy-data-kit/.codex/steering) are generated from AI Central. They are local integration links, not source files. Refresh them with `pnpm codex:links`.

## Default Rules

- Prefer `wikipedia/` for active ingestion work
- Treat `rsssf/` as legacy unless explicitly asked to work there
- Keep output semantics stable and do not hand-edit generated `data-output/` files except fixture repair
- Reuse shared config constants instead of introducing repeated literals
- Preserve resumable scraping and thin ESM CLI boundaries
- Update focused Jest coverage when parser behavior or shared metadata changes

## Steering Files

- [`.codex/steering/repository-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/repository-steering.md)
- [`.codex/steering/data-contracts-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/data-contracts-steering.md)
- [`.codex/steering/pipeline-testing-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/pipeline-testing-steering.md)
- [`.codex/steering/javascript-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/javascript-steering.md)
- [`.codex/steering/javascript-esm-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/javascript-esm-steering.md) when present
- [`.codex/steering/testing-quality-gates-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/testing-quality-gates-steering.md) when present
- [`.codex/steering/frontend-design-steering.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/frontend-design-steering.md) when present
