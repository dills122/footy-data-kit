Legacy CSV helpers (mostly unused today). These scripts were an early experiment around the `data/england.csv` dataset and remain for reference only. They expect to be run from the repo root and read/write under `data/` and `data-output/`:

- `generate-tier-files.js`: splits `data/england.csv` into tier-specific CSVs in `data/`.
- `group-by-season-from-tier-files.js`: chunks tier CSVs into 25-season groups under `data/season_groups/`.
- `generate-club-name-ids.js`: extracts unique club names from `data/england.csv` into `club_names.json` at the repo root.
- `tier1-league-tables-parser.js`: builds league tables from grouped season CSVs into `data-output/<tier>_league_tables.json`.
- `tier1-promotion-relegation-stats.js`: derives promotion/relegation counts from those league tables.

These scripts are not part of the main Wikipedia scraping flow and may need cleanup before reuse. They’re kept to document the original CSV-based approach.
