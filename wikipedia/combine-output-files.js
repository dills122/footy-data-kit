#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFootballData, loadFootballData, saveFootballData } from './generate-output-files.js';

const TIER_KEY_PATTERN = /^tier/i;
const WAR_YEAR_SPANS = [
  [1915, 1918],
  [1940, 1945],
];

const parseSeasonKey = (seasonKey) => {
  const numeric = Number.parseInt(String(seasonKey), 10);
  return Number.isFinite(numeric) ? numeric : null;
};

function isWarSuspensionSeason(seasonKey) {
  const numeric = parseSeasonKey(seasonKey);
  if (numeric == null) return false;
  return WAR_YEAR_SPANS.some(([start, end]) => numeric >= start && numeric <= end);
}

function blockHasData(block) {
  if (!block) return false;
  if (Array.isArray(block)) {
    return block.length > 0;
  }

  if (typeof block !== 'object') {
    return false;
  }

  const table = Array.isArray(block.table) ? block.table : [];
  const promoted = Array.isArray(block.promoted) ? block.promoted : [];
  const relegated = Array.isArray(block.relegated) ? block.relegated : [];

  if (table.length || promoted.length || relegated.length) {
    return true;
  }

  const metadata = block.seasonMetadata;
  return Boolean(metadata && typeof metadata === 'object' && Object.keys(metadata).length);
}

function seasonHasData(seasonRecord) {
  if (!seasonRecord || typeof seasonRecord !== 'object') return false;
  return Object.values(seasonRecord).some((value) => blockHasData(value));
}

function tierHasData(tierValue) {
  return blockHasData(tierValue);
}

function mergeTier(existingTier, incomingTier, includeEmpty) {
  if (!existingTier) {
    return incomingTier;
  }

  if (!incomingTier) {
    return includeEmpty ? incomingTier : existingTier;
  }

  const existingHasData = tierHasData(existingTier);
  const incomingHasData = tierHasData(incomingTier);

  if (!existingHasData && incomingHasData) {
    return incomingTier;
  }

  if (!incomingHasData) {
    return includeEmpty ? incomingTier : existingTier;
  }

  // Prefer whichever tier was loaded first when both contain data.
  return existingTier;
}

function mergeSeasonRecords(currentRecord, incomingRecord, includeEmpty) {
  if (!currentRecord || typeof currentRecord !== 'object') {
    return incomingRecord;
  }
  if (!incomingRecord || typeof incomingRecord !== 'object') {
    return currentRecord;
  }

  const merged = { ...currentRecord };

  for (const [key, incomingValue] of Object.entries(incomingRecord)) {
    if (TIER_KEY_PATTERN.test(key)) {
      merged[key] = mergeTier(merged[key], incomingValue, includeEmpty);
      continue;
    }

    if (!(key in merged) || merged[key] == null) {
      merged[key] = incomingValue;
    }
  }

  return merged;
}

function normaliseGoalDifferences(dataset) {
  if (!dataset || !dataset.seasons) return;
  for (const seasonRecord of Object.values(dataset.seasons)) {
    if (!seasonRecord || typeof seasonRecord !== 'object') continue;

    for (const tierValue of Object.values(seasonRecord)) {
      const table = Array.isArray(tierValue)
        ? tierValue
        : tierValue && typeof tierValue === 'object'
        ? tierValue.table
        : null;
      if (!Array.isArray(table)) continue;

      for (const row of table) {
        if (!row || typeof row !== 'object') continue;

        const gf = Number.isFinite(row.goalsFor) ? row.goalsFor : null;
        const ga = Number.isFinite(row.goalsAgainst) ? row.goalsAgainst : null;
        if (gf == null || ga == null) continue;

        const expected = gf - ga;
        if (row.goalDifference !== expected) {
          row.goalDifference = expected;
        }
      }
    }
  }
}

export function combineFootballDataFiles({
  inputs,
  output,
  includeEmpty = false,
  compact = false,
  cwd = process.cwd(),
} = {}) {
  if (!inputs || !inputs.length) {
    throw new Error('At least one input file must be provided.');
  }

  const resolvedOutput = path.resolve(cwd, output);
  const pretty = compact ? false : 2;
  const combinedDataset = createFootballData();
  let totalInputSeasons = 0;

  for (const input of inputs) {
    const resolvedInput = path.resolve(cwd, input);

    if (!fs.existsSync(resolvedInput)) {
      throw new Error(`Input file not found: ${input}`);
    }

    try {
      const incoming = loadFootballData(resolvedInput);
      totalInputSeasons += Object.keys(incoming.seasons).length;
      for (const [seasonKey, seasonValue] of Object.entries(incoming.seasons)) {
        const existingRecord = combinedDataset.seasons[seasonKey];
        if (!existingRecord) {
          combinedDataset.seasons[seasonKey] = seasonValue;
          continue;
        }

        combinedDataset.seasons[seasonKey] = mergeSeasonRecords(
          existingRecord,
          seasonValue,
          includeEmpty
        );
      }
    } catch (error) {
      throw new Error(`Failed to load ${input}: ${/** @type {Error} */ (error).message}`);
    }
  }

  const mergedSeasonEntries = Object.entries(combinedDataset.seasons);
  const nonWarSeasonEntries = mergedSeasonEntries.filter(
    ([seasonKey]) => !isWarSuspensionSeason(seasonKey)
  );
  const removedWarSeasons = mergedSeasonEntries.length - nonWarSeasonEntries.length;
  const filteredSeasonEntries = includeEmpty
    ? nonWarSeasonEntries
    : nonWarSeasonEntries.filter(([, seasonValue]) => seasonHasData(seasonValue));
  const filteredSeasonKeys = new Set(filteredSeasonEntries.map(([seasonKey]) => seasonKey));
  const excludedSeasonEntries = nonWarSeasonEntries.filter(
    ([seasonKey]) => !filteredSeasonKeys.has(seasonKey)
  );
  const excludedCount = excludedSeasonEntries.length;
  const finalDataset = createFootballData({
    seasons: Object.fromEntries(filteredSeasonEntries),
  });

  normaliseGoalDifferences(finalDataset);
  saveFootballData(resolvedOutput, finalDataset, { pretty });

  const missingSeasonNumbers = excludedSeasonEntries
    .map(([seasonKey]) => parseSeasonKey(seasonKey))
    .filter((value) => value != null);

  const nonNumericMissing = excludedSeasonEntries
    .map(([seasonKey]) => seasonKey)
    .filter((seasonKey) => parseSeasonKey(seasonKey) == null);

  return {
    dataset: finalDataset,
    outputPath: resolvedOutput,
    stats: {
      mergedSeasonCount: filteredSeasonEntries.length,
      inputCount: inputs.length,
      excludedCount,
      totalInputSeasons,
      removedWarSeasons,
      missingSeasonNumbers,
      nonNumericMissing,
    },
  };
}

export function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name('combine-output-files')
    .description('Combine multiple FootballData JSON files into a single dataset.')
    .argument('<inputs...>', 'Paths to FootballData JSON files to merge')
    .requiredOption('-o, --output <file>', 'Path to write the merged FootballData JSON file')
    .option('--include-empty', 'Keep seasons that have no table/promoted/relegated entries', false)
    .option('--compact', 'Write the output without indentation', false);

  program.parse(argv);

  const inputFiles = program.args;
  const { output, includeEmpty, compact } = program.opts();

  if (!inputFiles.length) {
    program.error('At least one input file must be provided.');
  }

  try {
    const result = combineFootballDataFiles({
      inputs: inputFiles,
      output,
      includeEmpty,
      compact,
      cwd: process.cwd(),
    });

    const { stats, outputPath } = result;
    const {
      mergedSeasonCount,
      inputCount,
      excludedCount,
      totalInputSeasons,
      removedWarSeasons,
      missingSeasonNumbers,
      nonNumericMissing,
    } = stats;

    if (removedWarSeasons) {
      console.log(
        `Removing ${removedWarSeasons} war suspension season${
          removedWarSeasons === 1 ? '' : 's'
        } from output`
      );
    }

    console.log(
      [
        `Merged ${mergedSeasonCount} seasons`,
        `from ${inputCount} file${inputCount === 1 ? '' : 's'}`,
        excludedCount
          ? `(skipped ${excludedCount} empty season${excludedCount === 1 ? '' : 's'})`
          : '',
        `→ ${outputPath}`,
      ]
        .filter(Boolean)
        .join(' ')
    );
    console.log(`Total seasons encountered across inputs: ${totalInputSeasons}`);

    if (missingSeasonNumbers.length) {
      const groupedMissing = {
        ww1: [],
        ww2: [],
        other: [],
      };

      for (const seasonNumber of missingSeasonNumbers.sort((a, b) => a - b)) {
        if (seasonNumber >= 1915 && seasonNumber <= 1919) {
          groupedMissing.ww1.push(seasonNumber);
        } else if (seasonNumber >= 1940 && seasonNumber <= 1946) {
          groupedMissing.ww2.push(seasonNumber);
        } else {
          groupedMissing.other.push(seasonNumber);
        }
      }

      console.log('\nMissing seasons (no table/promoted/relegated data in output):');
      if (groupedMissing.ww1.length) {
        console.log(`  WW1 suspensions: ${groupedMissing.ww1.join(', ')}`);
      }
      if (groupedMissing.ww2.length) {
        console.log(`  WW2 suspensions: ${groupedMissing.ww2.join(', ')}`);
      }
      if (groupedMissing.other.length) {
        console.log(`  Needs attention: ${groupedMissing.other.join(', ')}`);
      }

      if (nonNumericMissing.length) {
        console.log(`  Unparsed season keys: ${nonNumericMissing.join(', ')}`);
      }
    } else {
      console.log('\nAll encountered seasons were included in the merged output.');
    }

    return result;
  } catch (error) {
    program.error(error instanceof Error ? error.message : String(error));
  }
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}

export default {
  combineFootballDataFiles,
  runCli,
};
