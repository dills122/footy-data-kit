# JavaScript And ESM Rules

This repository uses modern ESM JavaScript executed by Node.js CLI tools.

## ESM Compatibility

The repository uses `"type": "module"`.

Rules:

- Keep all new code ESM compatible
- Use `import` and `export`
- Do not introduce `require()` or `module.exports`
- Prefer `import.meta.url` based path handling instead of `__dirname` patterns

## Built-In Imports

Use explicit `node:` imports for built-ins.

Examples:

```js
import fs from 'node:fs';
import path from 'node:path';
```

Stay consistent across CLI code, parsers, tests, and utilities.

## CLI Boundaries

CLI entry points should remain thin wrappers.

CLI responsibilities:

- parse arguments
- call importable business logic
- write outputs
- set exit codes at the edge

Core modules should not call `process.exit()`.

## Function Design

Prefer small helpers with clear names over dense inline conditionals.

Preferred style:

- `extractTables`
- `parseLeagueTable`
- `normalizeTeamName`
- `buildTierRecord`

Avoid generic names such as `processData` or `handleTable`.

## State Management

Default to `const`.

Use `let` only when mutation is required.

Avoid top-level mutable state unless it is an intentional narrow cache.

Allowed example:

```js
const teamCache = new Map();
```

Avoid:

- cross-module mutable state
- implicit globals
- mutating function inputs

## Data Transformations

Normalize parsed input at the boundary and keep downstream object shapes stable.

Preferred:

- explicit mapping
- explicit field conversion
- one-time normalization near parsing

Avoid passing raw scraped strings deep into the pipeline.

## Error Handling

Reusable modules should throw structured errors or return structured results.

The CLI layer decides whether to retry, skip, or abort.

## Dependencies And Abstractions

Prefer straightforward modern JavaScript.

Avoid:

- heavy frameworks
- framework-like utility layers
- clever abstractions for one-off parser heuristics

Share logic only when it is genuinely reused.
