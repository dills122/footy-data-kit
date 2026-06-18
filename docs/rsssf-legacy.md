# RSSSF Legacy Tooling

The RSSSF scraper is kept for archive work and historical comparison. It is not the primary maintained data path for releases; use the Wikipedia overview workflow for checked-in release data.

## RSSSF CLI

`node rsssf/cli.js scrape [options]` converts RSSSF HTML into the FootballData schema.

| Option                                    | Description                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `-u, --url <url>`                         | One or more RSSSF page URLs to fetch. Repeat for multiple seasons.                                                                           |
| `-f, --from-file <file>`                  | Parse saved HTML instead of fetching over the network. Repeat for multiple files.                                                            |
| `-s, --start <year>` / `-e, --end <year>` | Generate season URLs using the default template (`https://www.rsssf.org/engpaul/FLA/{seasonSlug}.html`). Requires both flags to be provided. |
| `--url-template <template>`               | Custom season URL template. Supports `{seasonSlug}`, `{startYear}`, `{endYear}`, `{seasonSlugUnderscore}`, and related placeholders.         |
| `-o, --output <path>`                     | JSON output path. Multiple sources treat this as a directory; range scraping writes an aggregate file under `data-output/rsssf`.             |
| `--pretty`                                | Pretty-print instead of minified JSON.                                                                                                       |
| `--save-html <path>`                      | Persist the raw HTML alongside the JSON. The path can be a file or directory depending on the scrape mode.                                   |

Range mode continually updates `data-output/rsssf/rsssf_promotion_relegations_by_season.json` and saves after each season, including interrupted runs.

## Examples

```bash
# Pretty-print one season
node rsssf/cli.js scrape --url https://www.rsssf.org/engpaul/FLA/1908-09.html --pretty

# Fetch several seasons, write JSON into data-output/rsssf, and persist HTML copies
node rsssf/cli.js scrape --start 1950 --end 1952 --output ./data-output/rsssf --save-html ./data-output/rsssf/html

# Parse existing HTML exports for offline work
node rsssf/cli.js scrape --from-file ./rsssf-cache/1960-61.html --from-file ./rsssf-cache/1961-62.html
```
