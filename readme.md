# English Football Statistics Data & Scripts

[![CI](https://github.com/dills122/footy-data-kit/actions/workflows/ci-workflow.yml/badge.svg)](https://github.com/dills122/footy-data-kit/actions/workflows/ci-workflow.yml)
[![Wikipedia Integration Check](https://github.com/dills122/footy-data-kit/actions/workflows/wiki-integration.yml/badge.svg)](https://github.com/dills122/footy-data-kit/actions/workflows/wiki-integration.yml)

This repo scrapes, normalises, and validates historic English league tables from Wikipedia so the resulting JSON can be embedded in other projects or visualisations.

- A supported Wikipedia scraping workflow that can resume after interruptions.
- Utilities to merge overlapping sources, verify season integrity, and minify the resulting datasets.
- Source-backed club identity metadata for active, historical, defunct, merged, relocated, and phoenix/successor cases.
- Jest unit + integration tests focused on the active Wikipedia pipeline.

## Supported Scope

- `wikipedia/` is the actively supported ingestion path.
- `rsssf/`, `scripts/csv-data/`, and older reference exports should be treated as legacy tooling unless you are intentionally doing archive work. See [RSSSF legacy tooling](docs/rsssf-legacy.md).
- The overview scraper (`node wikipedia/cli/index.js overview`) is now the primary maintained Wikipedia dataset flow across the full historical range.
- The promotion/relegation scraper (`node wikipedia/cli/index.js build`) remains available as a legacy/historical fallback for classic Football League season pages.

## Requirements

- Node.js `>= 20`
- `pnpm >= 8` (declared via `packageManager`)
- macOS/Linux shell or Windows WSL for the scraping scripts

Install dependencies once:

```bash
pnpm i
```

## AI Central Context

This repo keeps footy-data-kit-specific Codex guidance in tracked steering files and uses local AI Central symlinks for shared skills and reusable steering.

Tracked files:

- `AGENTS.md`
- `.codex/steering/README.md`
- `.codex/steering/repository-steering.md`
- `.codex/steering/data-contracts-steering.md`
- `.codex/steering/pipeline-testing-steering.md`
- `.codex/steering/javascript-steering.md`

Ignored local links:

- `.codex/skills/`
- `.codex/steering/frontend-design-steering.md`
- `.codex/steering/javascript-esm-steering.md`
- `.codex/steering/testing-quality-gates-steering.md`

Refresh local AI Central links with:

```bash
pnpm codex:links
```

By default the script looks for AI Central at `../ai-central/templates`. Set `AI_CENTRAL_HOME` if your checkout lives elsewhere.

## Quick Start

1. **Generate Wikipedia data**
   ```bash
   # Primary maintained flow: overview parser across the full supported range
   pnpm -s wiki:build:overview
   ```
2. **Merge and normalise**
   ```bash
   pnpm -s wiki:build:combined
   pnpm -s wiki:club-seed
   ```
3. **Validate and test**
   ```bash
   pnpm -s verify:data
   pnpm test:integration
   ```
4. **Minify for distribution (optional)**
   ```bash
   pnpm -s wiki:minify:combined
   pnpm -s wiki:minify:overview
   ```

All commands are resumable. If you stop a scraper with `Ctrl+C`, progress written to `data-output` stays intact.

### Detailed workflow

The default maintained dataset workflow now uses the overview parser end to end. The promotion scraper is still useful for legacy comparison work and fixture repair, but it is no longer the main checked-in data path.

```bash
# Setup Repo, Install Deps
pnpm i
# Generate Data
pnpm -s wiki:build:overview
# Combine data into all-seasons file and regenerate club metadata
pnpm -s wiki:build:combined
pnpm -s wiki:club-seed
# Verify generated data plus club historical-reason metadata
pnpm -s verify:data
pnpm test:integration
# If all is good, finally minify data ready for external use
pnpm -s wiki:minify:combined
pnpm -s wiki:minify:overview
```

### Legacy promotion fixture rebuild flow

When `data-output/wiki_promotion_relegations_by_season.json` needs to be refreshed for historical comparison or legacy fixture coverage, rebuild it from code instead of patching individual seasons by hand:

```bash
pnpm wiki:build:promotion
pnpm wiki:minify:promotion
pnpm test:integration:promotion
```

For a single-season repair while preserving the checked-in dataset shape, use the same command with a narrow range and keep `--ignore-war-years` enabled. Example for the 1919-20 edge season:

```bash
node wikipedia/cli/index.js build --start 1919 --end 1919 --output ./data-output --force-update --ignore-war-years
node scripts/minify-json.js ./data-output/wiki_promotion_relegations_by_season.json
pnpm test:integration:promotion
```

## Project Structure

- `data/` – generated sidecar club metadata, review artifacts, raw reference files, and one-off exports.
- `data-output/` – canonical Wikipedia JSON outputs grouped by source.
- `docs/roadmap.md` – current release roadmap, v1 definition of done, and post-v1 feature plan.
- `schemas/` – JSON Schema Draft-07 contracts for the published season dataset and club metadata sidecar.
- `scripts/` – helper utilities such as `minify-json.js` plus older one-off generators.
- `wikipedia/` – the main scraper, parsers, and FootballData models.
- `rsssf/` – legacy RSSSF parsing experiments. See [RSSSF legacy tooling](docs/rsssf-legacy.md).
- `shared/`, `club_names.json` – shared helpers and canonicalised club naming.
- `data/club-metadata.json` – generated sidecar club metadata derived from the FootballData season outputs.

## Wikipedia CLI (`wiki-league`)

Run `node wikipedia/cli/index.js <command> [options]` to build FootballData-format JSON directly from Wikipedia tables.

| Command    | Purpose                                                                                                             | Default output                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `build`    | Legacy/historical promotion-relegation scraper for classic Football League season pages, mainly Tier 1 and Tier 2.  | `data-output/wiki_promotion_relegations_by_season.json`  |
| `overview` | Primary maintained parser. Reads overview pages (e.g. “2015–16 in English football”) and captures all listed tiers. | `data-output/wiki_overview_tables_by_season.json`        |
| `combined` | Legacy bridge command: run `build` first, then backfill missing seasons with `overview`.                            | Both files above, reusing the same `--output` directory. |

Common flags across commands:

| Flag                         | Default         | Description                                                        |
| ---------------------------- | --------------- | ------------------------------------------------------------------ |
| `-s, --start <year>`         | varies          | First season (inclusive).                                          |
| `-e, --end <year>`           | varies          | Final season (inclusive).                                          |
| `-o, --output <dir>`         | `./data-output` | Directory that will contain the JSON file(s).                      |
| `-u, --update-only`          | `false`         | Skip seasons that already contain data on disk.                    |
| `-f, --force-update`         | `false`         | Ignore cached entries and rebuild everything.                      |
| `--ignore-war-years`         | `false`         | Skip WWI/WWII suspension years entirely.                           |
| `--include-war-placeholders` | `false`         | Emit metadata-only wartime placeholder seasons in overview output. |

Each run saves season-by-season progress immediately, so reruns are fast. The `combined` command exists for legacy mixed-source rebuilds, but the checked-in maintained path is now `overview`.

> Tip: for the checked-in overview dataset we now run `overview` across the full supported range. Keep `build` around for legacy comparisons, targeted fixture repair, and classic-season parser regressions.

## JSON Utilities

- `wikipedia/data/combine-output-files.js` – merge multiple FootballData JSON files, drop war-year placeholders, prefer the richest tier record for each season, and show a grouped “missing seasons” summary. Use `--include-empty` to keep placeholder entries, `--compact` for minified JSON, and repeat `--club-metadata <file>` to merge sidecar club metadata.
- `wikipedia/data/generate-club-metadata-seed.js` – derive the club metadata sidecar from an existing FootballData JSON file plus curated source-backed lifecycle rules.
- `wikipedia/data/verify-club-continuity.js` – verify club metadata continuity and historical status reasons. Use `pnpm -s wiki:club-historical-audit` to write the repo review artifact at `data/club-historical-reason-audit.json`; use `pnpm -s wiki:club-historical-audit:check` or `pnpm -s verify:data` for fail-on-issues checks.
- `wikipedia/data/compare-football-data.js` – compare two FootballData JSON files and report season, tier, table, outcome-list, and metadata changes between releases. Pass `--json` for machine-readable output.
  Pass `--markdown` for a release-note-friendly summary.
- `wikipedia/data/build-release-notes.js` – combine a curated note from `docs/release-notes/vX.Y.Z.md` with generated dataset counts, club metadata counts, validation notes, and the release diff. The release workflow publishes this as `release-notes.md` and uses it as the GitHub release body.
- `wikipedia/data/verify-json-schemas.js` – validate generated data files against the JSON Schema contracts in `schemas/`. Run with `pnpm -s schema:verify`; this is also included in `pnpm -s verify:data`.
- `scripts/minify-json.js` – shrink JSON files in place or alongside (`foo.min.json`) so they are ready for publishing.
- `wikipedia/data/verify-football-data.js` – lint FootballData exports for empty tiers, duplicate teams, stat mismatches, or promotion/relegation inconsistencies. Pass `--fail-on-issues` to exit non-zero when anomalies exist.

## Exported Data Shape

- The main season contract is the merged file: `data-output/all-seasons.json`.
- Club identity data is published separately as the sidecar file `data/club-metadata.json`.
- JSON Schema contracts live in `schemas/` and are rendered into the docs site under `docs/schema/`.
- Every FootballData export may include a top-level `metadata` object with release provenance:
  - `schemaVersion`
  - `generator`
  - `generatedAt`
  - `gitSha`
  - `sourceFiles`
  - `buildOptions`
- The club metadata sidecar has a top-level `clubs` map keyed by canonical club key. Club records are split into consumer-facing identity/status fields, source-backed `history`, and generated `derived` observations:
  - `clubId` – URL-safe unique slug for the club identity, such as `manchester-united`
  - `canonicalName`
  - `status.current` – small status label such as `active` or `unknown`
  - `status.trackedFromSeason`
  - `status.trackedToSeason`
  - `status.hasUnexplainedGaps`
  - `history.nameHistory[]` for source-backed name periods
  - `history.lifecycleEvents[]` for events such as `renamed`, `merged`, `dissolved`, `not-re-elected`, or `phoenix`
  - `history.trackedMembership[]` for the season span where the club is expected in the tracked dataset
  - `history.absenceExplanations[]` for expected absences using broad reason codes such as `official-competition-paused`, `outside-tracked-coverage`, `club-inactive`, `club-dissolved`, `club-reformed`, or `unknown`
  - `derived.aliases`
  - `derived.identitySources[]` with source URLs for curated identity/rename decisions
  - `derived.relationships[]` for sourced non-alias links such as phoenix clubs, mergers, relocations, and supporter-founded clubs
  - `derived.observedNames[]` with exact `rawName`, cleaned `normalizedName`, observed seasons, and observed tiers
  - `derived.observedNamePeriods`
  - `derived.firstSeenSeason`
  - `derived.lastSeenSeason`
  - `derived.seasonsSeen`
  - `derived.tiersSeen`
  - `derived.tierSeasons`
  - `derived.coverageGaps`
- `derived.coverageGaps` means gaps in this dataset's observed league-table coverage, not confirmed inactivity or a financial interruption.
- `history` is reserved for source-backed facts and explanations. Generated observations should stay under `derived`.
- `clubId` is additive; season table rows still expose the scraped/canonical `team` text and do not yet embed `clubId`.
- Each season contains a `seasonInfo` summary object plus one or more `tierN` objects.
- `seasonInfo` is not a league table. It is a season-level summary that currently stores:
  - `season`
  - `promoted`
  - `relegated`
  - source metadata such as `seasonSlug`, `sourceUrl`, or `tableCount`
- `seasonInfo.promoted` means clubs moving into the top flight for the following season.
- `seasonInfo.relegated` means clubs leaving the top flight at the end of that season.
- Every `tierN` entry is an object with `season`, `table`, `promoted`, and `relegated`.
- Every `tierN` entry now carries a single `metadata` object:
  - `source`
  - `sourceUrl`
  - `seasonSlug`
  - `leagueId`
  - `title`
  - `tableIndex`
  - `tableCount`
  - `tierKey`

### Utility examples

```bash
# Build the maintained merged dataset from the overview export
pnpm -s wiki:build:combined

# Build sidecar club metadata
pnpm -s wiki:club-seed

# Run the data lint pass and historical club-reason check
pnpm -s verify:data

# Run only the JSON Schema drift check
pnpm -s schema:verify

# Write the historical club-reason audit review artifact
pnpm -s wiki:club-historical-audit

# Compare a previous release file against a freshly generated one
node wikipedia/data/compare-football-data.js ./releases/all-seasons-prev.json ./data-output/all-seasons.json

# Generate a markdown release summary
node wikipedia/data/compare-football-data.js --markdown ./releases/all-seasons-prev.json ./data-output/all-seasons.json

# Build the final user-facing release notes body
node wikipedia/data/build-release-notes.js \
  --tag v0.8.2 \
  --diff ./data-output/release-diff.json \
  --current ./data-output/all-seasons.json \
  --club-metadata ./data/club-metadata.json \
  --manual ./docs/release-notes/v0.8.2.md \
  --output ./data-output/release-notes.md

# Minify the merged dataset next to its original (writes all-seasons.min.json)
node scripts/minify-json.js ./data-output/all-seasons.json
```

## Release Notes

Each release can include a short curated note at `docs/release-notes/vX.Y.Z.md`. Keep that file focused on user-facing changes: what improved, whether schemas changed, and anything consumers should watch for.

The GitHub release body is generated from that curated note plus release facts from the rebuilt data files. The generated body includes coverage counts, club metadata counts, validation checks, published asset names, and the compact data diff. The raw diff remains attached as `release-diff.json` and `release-diff.md`.

## Testing

Run the full Jest suite (unit + lightweight parsing checks):

```bash
pnpm test
```

Target just the integration suite (which exercises the supported Wikipedia scrapers end-to-end) when validating new data runs:

```bash
pnpm test:integration
pnpm test:integration:overview    # primary maintained Wikipedia fixtures
pnpm test:integration:promotion   # legacy promotion/relegation fixtures
```

Estimate integration fixture breadth and tagged scenario coverage without fetching live pages:

```bash
pnpm integration:coverage
```

Coverage is available via:

```bash
pnpm test:coverage
```

Every script sets `NODE_OPTIONS=--experimental-vm-modules` automatically so Jest can execute the ESM codebase without extra configuration.

## Additional Notes

- Keep output directories around; the CLIs skip existing seasons unless `--force-update` is provided, which significantly cuts rerun time.
- `club_names.json` contains canonical spellings that the scrapers rely on when reconciling seasonal data – update it before running the cleaners if you expect new clubs to appear.
- Extend `wikipedia/builders/parse-season-pages.js` or `wikipedia/builders/parse-ext-season-overview-pages.js` if you need extra metadata (attendance, form, etc.); the FootballData schema is intentionally flexible.
