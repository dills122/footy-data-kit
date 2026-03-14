#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWikipediaWarSuspensionLabel, WIKIPEDIA_GENERATORS } from '../config.js';
import {
  buildDatasetMetadata,
  createFootballData,
  loadFootballData,
  saveFootballData,
} from './generate-output-files.js';
import {
  getSeasonCompetitionStatus,
  normaliseGoalDifference,
  parseSeasonNumber,
  reconcileSeasonInfoContinuity,
  isHistoricalPlaceholderSeason,
  isWarSuspensionSeason,
  seasonHasData,
  mergeSeasonRecords,
} from './season-rules.js';

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
          includeEmpty,
          seasonKey
        );
      }
    } catch (error) {
      throw new Error(`Failed to load ${input}: ${/** @type {Error} */ (error).message}`);
    }
  }

  const mergedSeasonEntries = Object.entries(combinedDataset.seasons);
  const { filteredSeasonEntries, excludedSeasonEntries, removedWarSeasons } =
    splitSeasonEntriesForOutput({
      seasonEntries: mergedSeasonEntries,
      includeEmpty,
    });
  const excludedCount = excludedSeasonEntries.length;
  const finalDataset = createFootballData({
    seasons: Object.fromEntries(filteredSeasonEntries),
  });

  reconcileSeasonInfoContinuity(finalDataset);
  normaliseGoalDifference(finalDataset);
  saveFootballData(resolvedOutput, finalDataset, {
    pretty,
    metadata: buildDatasetMetadata({
      generator: WIKIPEDIA_GENERATORS.combined,
      sourceFiles: inputs.map((input) => path.resolve(cwd, input)),
      buildOptions: {
        includeEmpty,
        compact,
      },
    }),
  });

  const missingSeasonNumbers = excludedSeasonEntries
    .map(([seasonKey]) => parseSeasonNumber(seasonKey))
    .filter((value) => value != null);

  const nonNumericMissing = excludedSeasonEntries
    .map(([seasonKey]) => seasonKey)
    .filter((seasonKey) => parseSeasonNumber(seasonKey) == null);

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
      const groupedMissing = groupMissingSeasons(missingSeasonNumbers);

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

export function splitSeasonEntriesForOutput({ seasonEntries, includeEmpty }) {
  const nonWarSeasonEntries = seasonEntries.filter(
    ([seasonKey, seasonValue]) =>
      !isWarSuspensionSeason(seasonKey) || isHistoricalPlaceholderSeason(seasonValue, seasonKey)
  );
  const filteredSeasonEntries = includeEmpty
    ? nonWarSeasonEntries
    : nonWarSeasonEntries.filter(([, seasonValue]) => seasonHasData(seasonValue));
  const filteredSeasonKeys = new Set(filteredSeasonEntries.map(([seasonKey]) => seasonKey));
  const excludedSeasonEntries = nonWarSeasonEntries.filter(
    ([seasonKey]) => !filteredSeasonKeys.has(seasonKey)
  );

  return {
    filteredSeasonEntries,
    excludedSeasonEntries,
    removedWarSeasons: seasonEntries.length - nonWarSeasonEntries.length,
  };
}

export function groupMissingSeasons(missingSeasonNumbers) {
  const groupedMissing = {
    ww1: [],
    ww2: [],
    other: [],
  };

  for (const seasonNumber of [...missingSeasonNumbers].sort((a, b) => a - b)) {
    const warLabel = getWikipediaWarSuspensionLabel(seasonNumber);
    if (warLabel === 'ww1') {
      groupedMissing.ww1.push(seasonNumber);
    } else if (warLabel === 'ww2') {
      groupedMissing.ww2.push(seasonNumber);
    } else {
      groupedMissing.other.push(seasonNumber);
    }
  }

  return groupedMissing;
}

export function describeSeasonExclusion(seasonKey, seasonValue) {
  const status = getSeasonCompetitionStatus(seasonValue, seasonKey);
  return status ? `${seasonKey} (${status})` : seasonKey;
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
