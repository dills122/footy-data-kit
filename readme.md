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

There are two main scripts in the `wikipedia/` directory:

### 1. `generate-wiki.js`

This module contains the main logic for generating Wikipedia-based data. It can be imported and used programmatically or invoked via the CLI.

**Example (programmatic use):**

```js
import { generateWikiData } from './wikipedia/generate-wiki.js';

await generateWikiData({
  league: 'premier-league',
  season: '2020-21',
  outputDir: './data-output',
});
```

### 2. `cli.js`

This script acts as a command-line interface wrapper around `generate-wiki.js`, allowing you to run Wikipedia generation tasks directly from the terminal.

**Example CLI usage:**

```bash
pnpm cli --league premier-league --season 2020-21 --output ./data-output
```

**Available options:**

| Flag        | Description                  | Required | Example          |
| ----------- | ---------------------------- | -------- | ---------------- |
| `--league`  | The league name to scrape    | ✅       | `premier-league` |
| `--season`  | The season to process        | ✅       | `2020-21`        |
| `--output`  | Directory for processed data | ❌       | `./data-output`  |
| `--verbose` | Enable detailed logging      | ❌       | `--verbose`      |

### Example full workflow

```bash
# Install dependencies
pnpm i

# Run Wikipedia data generation for Premier League 2020–21
pnpm cli --league premier-league --season 2020-21 --output ./data-output

# Process and clean data using additional scripts in /scripts
pnpm run clean-data
```

---

📘 **Notes:**

- Make sure your Node.js version supports ES modules (v18+ recommended).
- Output files will be placed under `/data-output` unless otherwise specified.
- You can modify or extend `generate-wiki.js` to include new data sources or scraping patterns.
