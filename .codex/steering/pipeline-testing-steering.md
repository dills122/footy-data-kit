# Pipeline, Parser, And Testing Workflow

Keep the ingestion pipeline deterministic, resumable, and easy to verify.

## Parser Design

Prefer staged parsing:

`fetch -> extract -> normalize -> transform -> validate -> write`

Guidelines:

- prefer structured extraction over whole-page regex scanning
- keep fetch/parsing/output concerns separated
- expose importable helpers so parser behavior can be unit tested directly
- avoid one-off abstractions unless logic is genuinely reused

Preferred parsing shape:

`table -> rows -> columns -> structured objects`

## Resumable Scraping

Scrapers should remain interruption-safe.

Requirements:

- incremental progress writing
- resumable runs
- no destructive overwrites by default

Do not collapse the workflow into a monolithic long-running job.

## CLI Workflow

Common commands:

```bash
node wikipedia/cli/index.js build
node wikipedia/cli/index.js overview
node wikipedia/data/combine-output-files.js
node wikipedia/data/verify-football-data.js
```

Use `build` for classic seasons and `overview` for broader or more modern coverage.

## Testing Expectations

Prefer deterministic unit tests over live-network behavior.

Primary test locations:

- `wikipedia/__tests__/`
- `wikipedia/__integration_tests__/`

Guidelines:

- update the nearest focused Jest suite for behavior changes
- mock network responses in unit tests where practical
- use integration tests selectively for real-page coverage and saved fixtures

## Verification Expectations

After dataset-affecting changes, run the relevant focused tests first.

When output generation changes, verify with:

```bash
node wikipedia/data/combine-output-files.js
node wikipedia/data/verify-football-data.js
```

These checks should protect:

- schema structure
- tier consistency
- promotion and relegation logic
