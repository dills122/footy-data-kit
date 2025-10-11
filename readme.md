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

The `wiki-league` CLI (located at `wikipedia/cli.js`) builds a promotions and relegations dataset for the English Football League by scraping Wikipedia season pages.

Run it directly with Node or execute the script file:

```bash
node wikipedia/cli.js build --start 1888 --end 2000 --output ./data-output
# or, if the file is executable:
./wikipedia/cli.js build --start 1888 --end 2000 --output ./data-output
```

**Command:** `wiki-league build`

| Flag                  | Default         | Description                               |
| --------------------- | --------------- | ----------------------------------------- |
| `-s, --start <year>`  | `1888`          | First season to include (inclusive).      |
| `-e, --end <year>`    | `2000`          | Final season to include (inclusive).      |
| `-o, --output <path>` | `./data-output` | Directory to write the JSON results file. |

The CLI writes a file named `wiki_promotion_relegations_by_season.json` in the chosen output directory. The directory is created if it does not exist.

### Example workflow

```bash
pnpm i
node wikipedia/cli.js build --start 1888 --end 2023 --output ./data-output
```

Interrupting the script with `Ctrl+C` will stop the run after saving any data collected up to that point.

---

📘 **Notes:**

- Use Node.js 20+ (the project is configured for ES modules).
- Ensure the output directory exists or let the CLI create it.
- Extend the logic in `wikipedia/parse-season-pages.js` if you need to capture additional league details.

## 🧪 Testing

Install dependencies with `pnpm i`, then run the Jest suite:

```bash
pnpm test
```

Set `NODE_OPTIONS=--experimental-vm-modules` (added automatically via the `test` script) to enable ESM support in Jest.
