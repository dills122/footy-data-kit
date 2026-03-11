# Codex Steering

## Project focus

- This repo's actively maintained ingestion path is `wikipedia/`.
- Treat `rsssf/` as legacy/archive tooling unless the task is explicitly about RSSSF.
- The core deliverable is FootballData-style JSON under `data-output/`.

## Working rules

- Prefer small, targeted changes over broad parser rewrites.
- Keep ESM compatibility intact. The repo uses `"type": "module"`.
- Reuse constants from `wikipedia/config.js` and `rsssf/config.js` instead of reintroducing repeated literals.
- Preserve resumable CLI behavior. Scrapers write progress incrementally and should stay interruption-safe.
- Do not silently change dataset semantics. If a season-boundary or league-tier rule changes, add or update tests.

## ESM CLI best practices

- Keep CLI entry points thin. Put parsing and business logic in importable functions, then call them from the command handler.
- Use explicit `node:` imports for built-ins and stay consistent with ESM path handling.
- Prefer exported helpers over side-effect-driven modules so unit tests can target behavior directly.
- Avoid top-level mutable state unless it is an intentional cache with a narrow scope.
- Treat `process.exit()` as a CLI edge concern. Core logic should throw errors or return structured results instead.
- Keep command defaults and output filenames centralized rather than duplicated across CLI, parser, tests, and docs.

## JavaScript quality

- Prefer clear function names and small helpers over dense inline conditionals.
- Default to `const`; use `let` only when mutation is required.
- Validate external or parsed input at the boundary and normalize once.
- Keep object shapes stable across the pipeline, especially `seasonInfo`, `tierN`, and `metadata`.
- Avoid clever abstractions for one-off parser heuristics; share logic only when it is genuinely reused.
- When changing behavior, update the nearest focused Jest suite instead of relying on a broad end-to-end test.

## Wikipedia workflow

- For classic seasons, use `node wikipedia/cli.js build`.
- For broader/more modern coverage, use `node wikipedia/cli.js overview`.
- Merge outputs with `node wikipedia/combine-output-files.js`.
- Validate exports with `node wikipedia/verify-football-data.js`.

## Testing expectations

- Prefer deterministic unit tests over live-network behavior.
- Use existing Jest coverage in `wikipedia/__tests__/` first.
- Integration tests in `wikipedia/__integration_tests__/` depend on live Wikipedia access and saved fixtures.
- When changing parser boundaries or shared metadata, run the focused affected suites before broader smoke tests.

## Data and schema notes

- `seasonInfo.promoted` and `seasonInfo.relegated` describe top-flight movement for the following season.
- `tierN` blocks should keep `season`, `table`, `promoted`, `relegated`, and `metadata` consistent.
- `wikipedia-overview` and `wikipedia-promotion` are canonical source identifiers. Use shared config, not ad hoc strings.

## Practical defaults

- Search with `rg`.
- Prefer editing source generators/config over hand-editing large output JSON files unless the task is fixture repair.
- Keep README examples aligned with actual CLI defaults and output filenames.
- Prefer straightforward, modern JavaScript over framework-like utility layers in this repo.
