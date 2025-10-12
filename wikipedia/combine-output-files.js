#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { createFootballData, loadFootballData, saveFootballData } from './generate-output-files.js';

function seasonHasData(seasonRecord) {
  if (!seasonRecord || typeof seasonRecord !== 'object') return false;

  return Object.values(seasonRecord).some((tierValue) => {
    if (Array.isArray(tierValue)) {
      return tierValue.length > 0;
    }

    if (!tierValue || typeof tierValue !== 'object') {
      return false;
    }

    const table = Array.isArray(tierValue.table) ? tierValue.table : [];
    const promoted = Array.isArray(tierValue.promoted) ? tierValue.promoted : [];
    const relegated = Array.isArray(tierValue.relegated) ? tierValue.relegated : [];

    if (table.length || promoted.length || relegated.length) {
      return true;
    }

    const metadata = tierValue.seasonMetadata;
    return Boolean(metadata && typeof metadata === 'object' && Object.keys(metadata).length);
  });
}

const program = new Command();

program
  .name('combine-output-files')
  .description('Combine multiple FootballData JSON files into a single dataset.')
  .argument('<inputs...>', 'Paths to FootballData JSON files to merge')
  .requiredOption('-o, --output <file>', 'Path to write the merged FootballData JSON file')
  .option('--include-empty', 'Keep seasons that have no table/promoted/relegated entries', false)
  .option('--compact', 'Write the output without indentation', false)
  .parse(process.argv);

const inputFiles = program.args;
const { output, includeEmpty, compact } = program.opts();

if (!inputFiles.length) {
  program.error('At least one input file must be provided.');
}

const resolvedOutput = path.resolve(process.cwd(), output);
const pretty = compact ? false : 2;

const combinedDataset = createFootballData();
let totalInputSeasons = 0;

for (const input of inputFiles) {
  const resolvedInput = path.resolve(process.cwd(), input);

  if (!fs.existsSync(resolvedInput)) {
    program.error(`Input file not found: ${input}`);
  }

  try {
    const incoming = loadFootballData(resolvedInput);
    totalInputSeasons += Object.keys(incoming.seasons).length;
    for (const [seasonKey, seasonValue] of Object.entries(incoming.seasons)) {
      const incomingHasData = seasonHasData(seasonValue);
      const existingRecord = combinedDataset.seasons[seasonKey];
      const existingHasData = seasonHasData(existingRecord);

      if (!includeEmpty && !incomingHasData && existingHasData) {
        // Skip replacing richer data with an empty placeholder.
        continue;
      }

      combinedDataset.seasons[seasonKey] = seasonValue;
    }
  } catch (error) {
    program.error(`Failed to load ${input}: ${/** @type {Error} */ (error).message}`);
  }
}

const mergedSeasonEntries = Object.entries(combinedDataset.seasons);
const filteredSeasonEntries = includeEmpty
  ? mergedSeasonEntries
  : mergedSeasonEntries.filter(([, seasonValue]) => seasonHasData(seasonValue));
const filteredSeasonKeys = new Set(filteredSeasonEntries.map(([seasonKey]) => seasonKey));
const excludedSeasonEntries = mergedSeasonEntries.filter(
  ([seasonKey]) => !filteredSeasonKeys.has(seasonKey)
);
const excludedCount = excludedSeasonEntries.length;
const finalDataset = createFootballData({
  seasons: Object.fromEntries(filteredSeasonEntries),
});

saveFootballData(resolvedOutput, finalDataset, { pretty });

console.log(
  [
    `Merged ${filteredSeasonEntries.length} seasons`,
    `from ${inputFiles.length} file${inputFiles.length === 1 ? '' : 's'}`,
    excludedCount ? `(skipped ${excludedCount} empty season${excludedCount === 1 ? '' : 's'})` : '',
    `→ ${resolvedOutput}`,
  ]
    .filter(Boolean)
    .join(' ')
);
console.log(`Total seasons encountered across inputs: ${totalInputSeasons}`);

const parseSeasonKey = (seasonKey) => {
  const numeric = Number.parseInt(String(seasonKey), 10);
  return Number.isFinite(numeric) ? numeric : null;
};

const missingSeasonNumbers = excludedSeasonEntries
  .map(([seasonKey]) => parseSeasonKey(seasonKey))
  .filter((value) => value != null);

if (missingSeasonNumbers.length) {
  const groupedMissing = {
    ww1: [],
    ww2: [],
    other: [],
  };

  for (const seasonNumber of missingSeasonNumbers.sort((a, b) => a - b)) {
    // Heuristic: seasons paused during WW1 (1915-1919) or WW2 (1940-1946) are expected gaps.
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

  const nonNumericMissing = excludedSeasonEntries
    .map(([seasonKey]) => seasonKey)
    .filter((seasonKey) => parseSeasonKey(seasonKey) == null);

  if (nonNumericMissing.length) {
    console.log(`  Unparsed season keys: ${nonNumericMissing.join(', ')}`);
  }
} else {
  console.log('\nAll encountered seasons were included in the merged output.');
}
