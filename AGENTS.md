# Codex Steering

This repository keeps its repo-specific Codex guidance in [`.codex/steering/README.md`](/Users/dsteele/repos/footy-data-kit/.codex/steering/README.md).

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
