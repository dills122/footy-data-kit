# English Football Statistics Data & Scripts

[![CI](https://github.com/dills122/footy-data-kit/actions/workflows/ci-workflow.yml/badge.svg)](https://github.com/dills122/footy-data-kit/actions/workflows/ci-workflow.yml)
[![Wikipedia Integration Check](https://github.com/dills122/footy-data-kit/actions/workflows/wiki-integration.yml/badge.svg)](https://github.com/dills122/footy-data-kit/actions/workflows/wiki-integration.yml)

This repo scrapes, normalises, and validates historic English league tables from Wikipedia so the resulting JSON can be embedded in other projects or visualisations.

- A supported Wikipedia scraping workflow that can resume after interruptions.
- Utilities to merge overlapping sources, verify season integrity, and minify the resulting datasets.
- Jest unit + integration tests focused on the active Wikipedia pipeline.

## Supported Scope

- `wikipedia/` is the actively supported ingestion path.
- `rsssf/`, `scripts/csv-data/`, and older reference exports should be treated as legacy tooling unless you are intentionally doing archive work.
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

## Quick Start

1. **Generate Wikipedia data**
   ```bash
   # Primary maintained flow: overview parser across the full supported range
   node wikipedia/cli/index.js overview --start 1888 --end 2024 --output ./data-output --include-war-placeholders
   ```
2. **Merge and normalise**
   ```bash
   node wikipedia/data/combine-output-files.js --output ./data-output/all-seasons.json \
     ./data-output/wiki_overview_tables_by_season.json
   ```
3. **Validate and test**
   ```bash
   node wikipedia/data/verify-football-data.js --fail-on-issues ./data-output
   pnpm test:integration
   ```
4. **Minify for distribution (optional)**
   ```bash
   node scripts/minify-json.js ./data-output/all-seasons.json
   ```

All commands are resumable. If you stop a scraper with `Ctrl+C`, progress written to `data-output` stays intact.

### Detailed workflow

The default maintained dataset workflow now uses the overview parser end to end. The promotion scraper is still useful for legacy comparison work and fixture repair, but it is no longer the main checked-in data path.

```bash
# Setup Repo, Install Deps
pnpm i
# Generate Data
node wikipedia/cli/index.js overview --start 1888 --end 2024 --output ./data-output --force-update --include-war-placeholders
# Combine data into all-seasons file
node wikipedia/data/combine-output-files.js --output ./data-output/all-seasons.json ./data-output/wiki_overview_tables_by_season.json
# Verify the generated data
node wikipedia/data/verify-football-data.js --fail-on-issues ./data-output
pnpm test:integration
# If all is good, finally minify data ready for external use
node scripts/minify-json.js ./data-output/all-seasons.json
node scripts/minify-json.js ./data-output/wiki_overview_tables_by_season.json
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

- `data/` – raw reference files and one-off exports.
- `data-output/` – canonical JSON outputs grouped by source (e.g. `data-output/rsssf`).
- `scripts/` – helper utilities such as `minify-json.js` plus older one-off generators.
- `wikipedia/` – the main scraper, parsers, and FootballData models.
- `rsssf/` – legacy RSSSF parsing experiments.
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

## RSSSF CLI (`rsssf-scraper`)

`node rsssf/cli.js scrape [options]` converts RSSSF HTML into the same FootballData schema. This path is kept for legacy/archive work and is not the primary maintained workflow.

| Option                                    | Description                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `-u, --url <url>`                         | One or more RSSSF page URLs to fetch. Repeat for multiple seasons.                                                                           |
| `-f, --from-file <file>`                  | Parse saved HTML instead of fetching over the network (repeatable).                                                                          |
| `-s, --start <year>` / `-e, --end <year>` | Generate season URLs using the default template (`https://www.rsssf.org/engpaul/FLA/{seasonSlug}.html`). Requires both flags to be provided. |
| `--url-template <template>`               | Custom season URL template – supports `{seasonSlug}`, `{startYear}`, `{endYear}`, `{seasonSlugUnderscore}`, etc.                             |
| `-o, --output <path>`                     | JSON output path. Multiple sources treat this as a directory; range scraping writes an aggregate file under `data-output/rsssf`.             |
| `--pretty`                                | Pretty-print instead of minified JSON.                                                                                                       |
| `--save-html <path>`                      | Persist the raw HTML alongside the JSON (single file or directory depending on the context).                                                 |

Range mode continually updates `data-output/rsssf/rsssf_promotion_relegations_by_season.json` and guards against partial data loss by saving after each season (even when interrupted).

### Example invocations

```bash
# Pretty-print one season to stdout-style JSON
node rsssf/cli.js scrape --url https://www.rsssf.org/engpaul/FLA/1908-09.html --pretty

# Fetch several seasons, write each JSON into data-output/rsssf, and persist HTML copies
node rsssf/cli.js scrape --start 1950 --end 1952 --output ./data-output/rsssf --save-html ./data-output/rsssf/html

# Parse existing HTML exports (useful for offline work)
node rsssf/cli.js scrape --from-file ./rsssf-cache/1960-61.html --from-file ./rsssf-cache/1961-62.html
```

## JSON Utilities

- `wikipedia/data/combine-output-files.js` – merge multiple FootballData JSON files, drop war-year placeholders, prefer the richest tier record for each season, and show a grouped “missing seasons” summary. Use `--include-empty` to keep placeholder entries, `--compact` for minified JSON, and repeat `--club-metadata <file>` to merge sidecar club metadata.
- `wikipedia/data/generate-club-metadata-seed.js` – derive the layer-1 club metadata sidecar from an existing FootballData JSON file.
- `wikipedia/data/compare-football-data.js` – compare two FootballData JSON files and report season, tier, table, outcome-list, and metadata changes between releases. Pass `--json` for machine-readable output.
  Pass `--markdown` for a release-note-friendly summary.
- `scripts/minify-json.js` – shrink JSON files in place or alongside (`foo.min.json`) so they are ready for publishing.
- `wikipedia/data/verify-football-data.js` – lint FootballData exports for empty tiers, duplicate teams, stat mismatches, or promotion/relegation inconsistencies. Pass `--fail-on-issues` to exit non-zero when anomalies exist.

## Exported Data Shape

- The final contract is the merged file: `data-output/all-seasons.json`.
- Every FootballData export may include a top-level `metadata` object with release provenance:
  - `schemaVersion`
  - `generator`
  - `generatedAt`
  - `gitSha`
  - `sourceFiles`
  - `buildOptions`
- Every FootballData export may also include an optional top-level `clubs` map keyed by canonical club key. Club records are split into consumer-facing identity/status fields, source-backed `history`, and generated `derived` observations:
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
node wikipedia/data/combine-output-files.js --output ./data-output/all-seasons.json \
  ./data-output/wiki_overview_tables_by_season.json

# Build all-seasons and merge sidecar club metadata
node wikipedia/data/generate-club-metadata-seed.js ./data-output/all-seasons.json \
  --output ./data/club-metadata.json
node wikipedia/data/combine-output-files.js --output ./data-output/all-seasons.json \
  --club-metadata ./data/club-metadata.json \
  ./data-output/wiki_overview_tables_by_season.json

# Run the data lint pass on every JSON file under ./data-output
node wikipedia/data/verify-football-data.js --fail-on-issues ./data-output

# Report club continuity gaps from the club metadata sidecar
node wikipedia/data/verify-club-continuity.js

# Compare a previous release file against a freshly generated one
node wikipedia/data/compare-football-data.js ./releases/all-seasons-prev.json ./data-output/all-seasons.json

# Generate a markdown release summary
node wikipedia/data/compare-football-data.js --markdown ./releases/all-seasons-prev.json ./data-output/all-seasons.json

# Minify the merged dataset next to its original (writes all-seasons.min.json)
node scripts/minify-json.js ./data-output/all-seasons.json
```

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

Coverage is available via:

```bash
pnpm test:coverage
```

Every script sets `NODE_OPTIONS=--experimental-vm-modules` automatically so Jest can execute the ESM codebase without extra configuration.

## Additional Notes

- Keep output directories around; the CLIs skip existing seasons unless `--force-update` is provided, which significantly cuts rerun time.
- `club_names.json` contains canonical spellings that the scrapers rely on when reconciling seasonal data – update it before running the cleaners if you expect new clubs to appear.
- Extend `wikipedia/builders/parse-season-pages.js` or `wikipedia/builders/parse-ext-season-overview-pages.js` if you need extra metadata (attendance, form, etc.); the FootballData schema is intentionally flexible.
