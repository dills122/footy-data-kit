#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_DATA_PATH = path.resolve(
  process.cwd(),
  'data-output/wiki_overview_tables_by_season.json'
);

function normalizeTeamName(name) {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function describeTierKey(key) {
  const match = key.match(/^tier(\d+)$/);
  return match ? `tier ${match[1]}` : key;
}

export function verifyOverviewDataset(dataset) {
  const seasons = dataset && typeof dataset === 'object' ? dataset.seasons : null;
  const results = {
    totalSeasons: seasons ? Object.keys(seasons).length : 0,
    seasons: [],
    totalWarnings: 0,
    totalErrors: 0,
  };

  if (!seasons || typeof seasons !== 'object') {
    results.totalErrors += 1;
    results.seasons.push({
      seasonKey: '<all>',
      errors: ['Missing top-level "seasons" object'],
      warnings: [],
    });
    return results;
  }

  for (const [seasonKey, seasonRecord] of Object.entries(seasons)) {
    const seasonInfo = seasonRecord?.seasonInfo || null;
    const seasonWarnings = [];
    const seasonErrors = [];

    if (!seasonInfo) {
      seasonErrors.push('Missing seasonInfo block');
    }

    const tierEntries = Object.entries(seasonRecord || {}).filter(([key]) => /^tier\d+$/.test(key));
    tierEntries.sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)));

    if (!tierEntries.length) {
      seasonWarnings.push('No tier entries discovered for season');
    }

    const declaredTableCount = seasonInfo?.tableCount ?? null;
    const actualTableCount = tierEntries.length;

    if (declaredTableCount != null && declaredTableCount !== actualTableCount) {
      seasonWarnings.push(
        `Table count mismatch: seasonInfo.tableCount=${declaredTableCount}, actual=${actualTableCount}`
      );
    }

    const tierNumbers = tierEntries.map(([key]) => Number(key.slice(4)));
    const expectedSequence = Array.from({ length: actualTableCount }, (_, i) => i + 1);
    const hasSequentialTiers =
      tierNumbers.length === expectedSequence.length &&
      tierNumbers.every((value, index) => value === expectedSequence[index]);

    if (!hasSequentialTiers) {
      seasonWarnings.push(
        `Tier keys are non-sequential: found [${tierEntries.map(([key]) => key).join(', ')}]`
      );
    }

    tierEntries.forEach(([tierKey, tierValue], index) => {
      const tierTitle = tierValue?.title || '(untitled league)';
      const tierLabel = `${describeTierKey(tierKey)} (${tierTitle})`;
      const tableRows = Array.isArray(tierValue?.table) ? tierValue.table : null;
      const seasonMeta = tierValue?.seasonMetadata || {};

      if (!tableRows) {
        seasonErrors.push(`${tierLabel}: table is missing or not an array`);
        return;
      }

      if (!tableRows.length) {
        seasonWarnings.push(`${tierLabel}: table is empty`);
      }

      const tableIndex = seasonMeta.tableIndex;
      if (tableIndex != null && tableIndex !== index) {
        seasonWarnings.push(
          `${tierLabel}: seasonMetadata.tableIndex=${tableIndex} but expected ${index}`
        );
      }

      if (seasonMeta.tableCount != null && seasonMeta.tableCount !== actualTableCount) {
        seasonWarnings.push(
          `${tierLabel}: seasonMetadata.tableCount=${seasonMeta.tableCount} but season has ${actualTableCount} tiers`
        );
      }

      const seenPositions = new Map();
      const seenTeams = new Map();

      tableRows.forEach((row, rowIndex) => {
        const rowLabel = `${tierLabel} row ${rowIndex + 1}`;
        const teamName = typeof row?.team === 'string' ? row.team.trim() : '';
        const normalizedTeam = normalizeTeamName(teamName);
        const position = row?.pos;

        if (!teamName) {
          seasonErrors.push(`${rowLabel}: missing team name`);
        }

        if (position == null || Number.isNaN(Number(position))) {
          seasonErrors.push(`${rowLabel}: missing or invalid pos value`);
        } else if (!Number.isInteger(Number(position))) {
          seasonWarnings.push(`${rowLabel}: pos is not an integer (${position})`);
        } else {
          const numericPos = Number(position);
          if (seenPositions.has(numericPos)) {
            const firstRow = seenPositions.get(numericPos);
            seasonErrors.push(
              `${tierLabel}: duplicate position ${numericPos} (rows ${firstRow + 1} and ${
                rowIndex + 1
              })`
            );
          } else {
            seenPositions.set(numericPos, rowIndex);
          }
        }

        if (normalizedTeam) {
          if (seenTeams.has(normalizedTeam)) {
            const firstRow = seenTeams.get(normalizedTeam);
            seasonWarnings.push(
              `${tierLabel}: duplicate team name "${teamName}" (rows ${firstRow + 1} and ${
                rowIndex + 1
              })`
            );
          } else {
            seenTeams.set(normalizedTeam, rowIndex);
          }
        }
      });
    });

    results.seasons.push({
      seasonKey,
      seasonSlug: seasonInfo?.seasonSlug ?? null,
      warnings: seasonWarnings,
      errors: seasonErrors,
    });
    results.totalWarnings += seasonWarnings.length;
    results.totalErrors += seasonErrors.length;
  }

  return results;
}

function formatSeasonSummary(summary) {
  const lines = [];
  const seasonLabel = summary.seasonSlug
    ? `${summary.seasonKey} (${summary.seasonSlug})`
    : summary.seasonKey;
  if (summary.errors.length) {
    lines.push(`❌ ${seasonLabel}`);
    summary.errors.forEach((msg) => {
      lines.push(`   - ERROR: ${msg}`);
    });
  }
  if (summary.warnings.length) {
    if (!summary.errors.length) {
      lines.push(`⚠️ ${seasonLabel}`);
    }
    summary.warnings.forEach((msg) => {
      lines.push(`   - WARN: ${msg}`);
    });
  }
  return lines.join('\n');
}

async function readDatasetFromFile(filePath) {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${resolved}: ${err.message}`);
  }
}

async function runCli() {
  const args = process.argv.slice(2);
  let filePath = DEFAULT_DATA_PATH;
  let jsonLiteral = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '-f') {
      filePath = args[i + 1];
      i += 1;
    } else if (arg === '--json' || arg === '-j') {
      jsonLiteral = args[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: node scripts/verify-overview-data.js [--file path] [--json rawJson]',
          '',
          '  --file / -f   Path to overview JSON file (defaults to current dataset output)',
          '  --json / -j   Raw JSON string to validate instead of reading from disk',
        ].join('\n')
      );
      return;
    } else {
      console.warn(`Ignoring unknown argument: ${arg}`);
    }
  }

  let dataset;
  try {
    if (jsonLiteral) {
      dataset = JSON.parse(jsonLiteral);
    } else {
      dataset = await readDatasetFromFile(filePath);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const results = verifyOverviewDataset(dataset);
  results.seasons.forEach((season) => {
    const summaryText = formatSeasonSummary(season);
    if (summaryText) {
      console.log(summaryText);
    }
  });

  const summaryLine = [
    `Checked ${results.totalSeasons} seasons`,
    `${results.totalErrors} error${results.totalErrors === 1 ? '' : 's'}`,
    `${results.totalWarnings} warning${results.totalWarnings === 1 ? '' : 's'}`,
  ].join(' · ');
  console.log(`\n${summaryLine}`);

  if (results.totalErrors > 0) {
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  runCli();
}
