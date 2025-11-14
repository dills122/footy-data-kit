# English Football Statistics Data & Scripts

This project is to gather and clean English football historic data to be able to use within other apps I am building.

Currently (as of 10/2025) I have most of the English 1st & 2nd Division parsed and cleaned, along with the scripts to make it repeatable. Current WIP is the more modern Premier League Era, 2000-present (need to update scripts for these years).

## 🧱 Project Structure

- `data` - raw data gathered from various sources (unprocessed)
- `data-output` - processed data, may still need some cleaning
- `scripts` - general scripts for data generation and cleanup
- `wikipedia` - scripts for Wikipedia data scraping and generation

## ⚙️ Setup

Install dependencies:

```bash
pnpm i
```

## 🧾 Usage

### Wikipedia CLI (`wiki-league`)

The Wikipedia CLI lives at `wikipedia/cli.js`. Run it with Node (or mark it executable) to build JSON datasets extracted from Wikipedia.

```bash
node wikipedia/cli.js <command> [options]
```

#### `build`

Build the promotion/relegation dataset across Football League seasons.

| Flag                  | Default         | Description                               |
| --------------------- | --------------- | ----------------------------------------- |
| `-s, --start <year>`  | `1888`          | First season to include (inclusive).      |
| `-e, --end <year>`    | `2000`          | Final season to include (inclusive).      |
| `-o, --output <path>` | `./data-output` | Directory where the JSON file is written. |
| `-u, --update-only`   | `false`         | Skip seasons that already have tier data. |
| `-f, --force-update`  | `false`         | Rebuild seasons even if data exists.      |
| `--ignore-war-years`  | `false`         | Skip WWI/WWII suspension seasons.         |

Output file: `wiki_promotion_relegations_by_season.json`

#### `combined`

Run the promotion/relegation scraper and automatically fall back to overview tables for seasons where no league tables are found.

| Flag                  | Default         | Description                                 |
| --------------------- | --------------- | ------------------------------------------- |
| `-s, --start <year>`  | `1888`          | First season to include (inclusive).        |
| `-e, --end <year>`    | `2000`          | Final season to include (inclusive).        |
| `-o, --output <path>` | `./data-output` | Directory where the JSON files are written. |
| `-u, --update-only`   | `false`         | Skip seasons that already have tier data.   |
| `-f, --force-update`  | `false`         | Rebuild seasons even if data exists.        |
| `--ignore-war-years`  | `false`         | Skip WWI/WWII suspension seasons.           |

Output files: both `wiki_promotion_relegations_by_season.json` and `wiki_overview_tables_by_season.json`.

#### `overview`

Scrape season overview pages (e.g. “2008–09 in English football”) and gather the league tables listed there.

| Flag                  | Default         | Description                               |
| --------------------- | --------------- | ----------------------------------------- |
| `-s, --start <year>`  | `2008`          | First season overview to include.         |
| `-e, --end <year>`    | `2008`          | Final season overview to include.         |
| `-o, --output <path>` | `./data-output` | Directory where the JSON file is written. |
| `-u, --update-only`   | `false`         | Skip seasons that already have tier data. |
| `-f, --force-update`  | `false`         | Rebuild seasons even if data exists.      |
| `--ignore-war-years`  | `false`         | Skip WWI/WWII suspension seasons.         |

Output file: `wiki_overview_tables_by_season.json`

Both commands save progress after each season and can be interrupted with `Ctrl+C`; the most recent state will already be written to disk.

**Example workflow**

```bash
pnpm i
node wikipedia/cli.js build --start 1888 --end 2023 --output ./data-output
node wikipedia/cli.js overview --start 2008 --end 2010 --output ./data-output
node wikipedia/combine-output-files.js --output ./data-output/all-seasons.json \
  ./data-output/wiki_overview_tables_by_season.json \
  ./data-output/wiki_promotion_relegations_by_season.json
```

The `combine-output-files` script merges multiple FootballData JSON files, keeping the richest record for each season by default. Pass `--include-empty` to keep placeholder seasons and `--compact` to skip pretty-printing.

### RSSSF CLI (`rsssf-scraper`)

The RSSSF CLI at `rsssf/cli.js` fetches or parses RSSSF HTML pages into structured JSON.

```bash
node rsssf/cli.js scrape [options]
```

| Option                                    | Description                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `-u, --url <url>`                         | One or more RSSSF page URLs to fetch. Repeatable.                                                              |
| `-f, --from-file <file>`                  | Parse local HTML instead of fetching. Repeatable.                                                              |
| `-s, --start <year>` / `-e, --end <year>` | Generate and scrape a season range using the template below (inclusive). Both flags must be supplied together. |
| `--url-template <template>`               | Override the season URL template (default: `https://www.rsssf.org/engpaul/FLA/{seasonSlug}.html`).             |
| `-o, --output <file>`                     | Output path. With multiple sources this is treated as a directory; range mode saves an aggregate JSON file.    |
| `--pretty`                                | Pretty-print the generated JSON.                                                                               |
| `--save-html <file>`                      | Persist the raw HTML response(s) to disk.                                                                      |

`scrape` writes individual JSON files for each URL or file you provide. When using `--start/--end`, it also creates (and continually updates) an aggregate file named `rsssf_promotion_relegations_by_season.json` in `data-output/rsssf` unless you override `--output`.

**Example invocations**

```bash
# Fetch a single season from RSSSF and pretty-print the JSON
node rsssf/cli.js scrape --url https://www.rsssf.org/engpaul/FLA/1908-09.html --pretty

# Scrape multiple seasons using the default template and save outputs to data-output/rsssf
node rsssf/cli.js scrape --start 1950 --end 1952 --output ./data-output/rsssf

# Parse a local HTML file and save both JSON and HTML copies
node rsssf/cli.js scrape --from-file ./html-cache/1960-61.html --output ./data-output/rsssf --save-html ./data-output/rsssf/html
```

---

### JSON Utilities

- `wikipedia/combine-output-files.js` – merge one or more FootballData JSON files and optionally emit a list of missing seasons grouped by WW1, WW2, or “needs attention”.
- `scripts/minify-json.js` – minify JSON output in-place or alongside the originals.

**Examples**

```bash
# Combine overview + promotion/relegation data, keeping richer season records
node wikipedia/combine-output-files.js --output ./data-output/all-seasons.json \
  ./data-output/wiki_overview_tables_by_season.json \
  ./data-output/wiki_promotion_relegations_by_season.json

# Minify the merged dataset next to the original (writes all-seasons.min.json)
node scripts/minify-json.js ./data-output/all-seasons.json
```

📘 **Notes:**

- Use Node.js 20+ (the project is configured for ES modules).
- Ensure the output directory exists or let the CLI create it.
- Extend the logic in `wikipedia/parse-season-pages.js` if you need to capture additional league details.

## 🧪 Testing

Install dependencies with `pnpm i`, then run the Jest suite:

```bash
pnpm test
```

For coverage details, run:

```bash
pnpm run test:coverage
```

Set `NODE_OPTIONS=--experimental-vm-modules` (added automatically via the `test` script) to enable ESM support in Jest.
