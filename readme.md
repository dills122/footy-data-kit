# English Football Statistics Data & Scripts

[![CI](https://github.com/dills122/footy-data-kit/actions/workflows/ci-workflow.yml/badge.svg)](https://github.com/dills122/footy-data-kit/actions/workflows/ci-workflow.yml)
[![Wikipedia Integration Check](https://github.com/dills122/footy-data-kit/actions/workflows/wiki-integration.yml/badge.svg)](https://github.com/dills122/footy-data-kit/actions/workflows/wiki-integration.yml)

This repo scrapes, normalises, and validates historic English league tables (Football League, Premier League era, and lower tiers) so the resulting JSON can be embedded in other projects or visualisations.

- Scrapers for both Wikipedia and RSSSF that can resume after interruptions.
- Utilities to merge overlapping sources, verify season integrity, and minify the resulting datasets.
- Jest unit + integration tests to guard the scraping logic and data shapers.

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
   # Promotion/relegation parser handles pre-Premier League seasons best
   node wikipedia/cli.js build --start 1888 --end 1990 --output ./data-output
   # Overview parser is more reliable for 1991 onward
   node wikipedia/cli.js overview --start 1991 --end 2024 --output ./data-output
   ```
2. **Merge and normalise**
   ```bash
   node wikipedia/combine-output-files.js --output ./data-output/all-seasons.json \
     ./data-output/wiki_overview_tables_by_season.json \
     ./data-output/wiki_promotion_relegations_by_season.json
   ```
3. **Validate and test**
   ```bash
   node scripts/verify-football-data.js --fail-on-issues ./data-output
   pnpm test:integration
   ```
4. **Minify for distribution (optional)**
   ```bash
   node scripts/minify-json.js ./data-output/all-seasons.json
   ```

All commands are resumable. If you stop a scraper with `Ctrl+C`, progress written to `data-output` stays intact.

### Detailed workflow

The exact sequence we use for fresh data pulls is below. It runs both Wikipedia commands (promotion data for 1888–1990, overview tables for 1991 onwards) because the promotion scraper starts to miss Premier League-era tables while the overview parser continues to work reliably.

```bash
# Setup Repo, Install Deps
pnpm i
# Generate Data
node wikipedia/cli.js build --start 1888 --end 1990 --output ./data-output
node wikipedia/cli.js overview --start 1991 --end 2024 --output ./data-output
# Combine data into all-seasons file
node wikipedia/combine-output-files.js --output ./data-output/all-seasons.json \
  ./data-output/wiki_overview_tables_by_season.json \
  ./data-output/wiki_promotion_relegations_by_season.json
# Verify the generated data
node scripts/verify-football-data.js --fail-on-issues ./data-output
pnpm test:integration
# If all is good, finally minify data ready for external use
node scripts/minify-json.js ./data-output/all-seasons.json
node scripts/minify-json.js ./data-output/wiki_overview_tables_by_season.json
node scripts/minify-json.js ./data-output/wiki_promotion_relegations_by_season.json
```

## Project Structure

- `data/` – raw reference files and one-off exports.
- `data-output/` – canonical JSON outputs grouped by source (e.g. `data-output/rsssf`).
- `scripts/` – helper utilities such as `minify-json.js` and `verify-football-data.js`.
- `wikipedia/` – the main scraper, parsers, and FootballData models.
- `rsssf/` – RSSSF HTML parser + CLI for structured JSON output.
- `utils.js`, `club_names.json` – shared helpers and canonicalised club naming.

## Wikipedia CLI (`wiki-league`)

Run `node wikipedia/cli.js <command> [options]` to build FootballData-format JSON directly from Wikipedia tables.

| Command    | Purpose                                                                                                               | Default output                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `build`    | Deep scrape promotion/relegation tables for every tier inside “English Football League” pages.                        | `data-output/wiki_promotion_relegations_by_season.json`  |
| `overview` | Parse overview pages (e.g. “2015–16 in English football”) and capture every league table it lists.                    | `data-output/wiki_overview_tables_by_season.json`        |
| `combined` | Run the promotion scraper first, then fill in any missing seasons using the overview parser (best one to start with). | Both files above, reusing the same `--output` directory. |

Common flags across commands:

| Flag                 | Default         | Description                                     |
| -------------------- | --------------- | ----------------------------------------------- |
| `-s, --start <year>` | varies          | First season (inclusive).                       |
| `-e, --end <year>`   | varies          | Final season (inclusive).                       |
| `-o, --output <dir>` | `./data-output` | Directory that will contain the JSON file(s).   |
| `-u, --update-only`  | `false`         | Skip seasons that already contain data on disk. |
| `-f, --force-update` | `false`         | Ignore cached entries and rebuild everything.   |
| `--ignore-war-years` | `false`         | Skip WWI/WWII suspension years entirely.        |

Each run saves season-by-season progress immediately, so reruns are fast. The `combined` command automatically calls `overview` when a season is missing Tier 1 data, mirroring the manual fallback we used while cleaning the dataset.

> Tip: in practice we run `build` for 1888–1990 and `overview` for 1991 onwards because the promotion scraper becomes unreliable for modern Premier League formats while the overview parser continues to capture every table.

## RSSSF CLI (`rsssf-scraper`)

`node rsssf/cli.js scrape [options]` converts RSSSF HTML into the same FootballData schema so you can compare or fill gaps.

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

- `wikipedia/combine-output-files.js` – merge multiple FootballData JSON files, drop war-year placeholders, keep the richest tier record for each season, and show a grouped “missing seasons” summary. Use `--include-empty` to keep placeholder entries and `--compact` for minified JSON.
- `scripts/minify-json.js` – shrink JSON files in place or alongside (`foo.min.json`) so they are ready for publishing.
- `scripts/verify-football-data.js` – lint FootballData exports for empty tiers, duplicate teams, stat mismatches, or promotion/relegation inconsistencies. Pass `--fail-on-issues` to exit non-zero when anomalies exist.

### Utility examples

```bash
# Combine overview + promotion data and inspect which seasons still lack tables
node wikipedia/combine-output-files.js --output ./data-output/all-seasons.json \
  ./data-output/wiki_overview_tables_by_season.json \
  ./data-output/wiki_promotion_relegations_by_season.json

# Run the data lint pass on every JSON file under ./data-output
node scripts/verify-football-data.js --fail-on-issues ./data-output

# Minify the merged dataset next to its original (writes all-seasons.min.json)
node scripts/minify-json.js ./data-output/all-seasons.json
```

## Testing

Run the full Jest suite (unit + lightweight parsing checks):

```bash
pnpm test
```

Target just the integration suite (which exercises the Wikipedia scrapers end-to-end) when validating new data runs:

```bash
pnpm test:integration
pnpm test:integration:promotion   # promotion/relegation fixtures only
pnpm test:integration:overview    # overview fixtures only
```

Coverage is available via:

```bash
pnpm test:coverage
```

Every script sets `NODE_OPTIONS=--experimental-vm-modules` automatically so Jest can execute the ESM codebase without extra configuration.

## Additional Notes

- Keep output directories around; the CLIs skip existing seasons unless `--force-update` is provided, which significantly cuts rerun time.
- `club_names.json` contains canonical spellings that the scrapers rely on when reconciling seasonal data – update it before running the cleaners if you expect new clubs to appear.
- Extend `wikipedia/parse-season-pages.js` or `wikipedia/parse-ext-season-overview-pages.js` if you need extra metadata (attendance, form, etc.); the FootballData schema is intentionally flexible.
