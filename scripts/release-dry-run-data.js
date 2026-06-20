#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_DIR = path.join(os.tmpdir(), 'footy-data-kit-release-dry-run');
const DEFAULT_MIN_CLUB_COUNT = 1;
const LOWER_TIER_START_SEASON = 1979;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseInteger(value) {
  const normalized = String(value).trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function computeExpectedSeasonCount(start, end) {
  const startSeason = parseInteger(start);
  const endSeason = parseInteger(end);
  if (startSeason == null || endSeason == null || endSeason < startSeason) return 0;
  return endSeason - startSeason + 1;
}

function parseNonNegativeInteger(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = parseInteger(value);
  if (parsed == null || parsed < 0) {
    throw new Error(`Expected a non-negative integer, got ${value}`);
  }
  return parsed;
}

export function buildReleaseDryRunCompletenessSummary({
  allSeasonsFile,
  clubMetadataFile,
  minSeasonCount,
  minClubCount,
}) {
  const allSeasons = readJson(allSeasonsFile);
  const clubMetadata = readJson(clubMetadataFile);
  const seasonCount = Object.keys(allSeasons?.seasons || {}).length;
  const clubCount = Object.keys(clubMetadata?.clubs || {}).length;
  const normalizedMinSeasonCount = parseNonNegativeInteger(minSeasonCount, 0);
  const normalizedMinClubCount = parseNonNegativeInteger(minClubCount, 0);

  return {
    seasonCount,
    clubCount,
    minSeasonCount: normalizedMinSeasonCount,
    minClubCount: normalizedMinClubCount,
    issues: [
      ...(seasonCount < normalizedMinSeasonCount
        ? [
            `expected at least ${normalizedMinSeasonCount} season record(s), generated ${seasonCount}`,
          ]
        : []),
      ...(clubCount < normalizedMinClubCount
        ? [
            `expected at least ${normalizedMinClubCount} club metadata record(s), generated ${clubCount}`,
          ]
        : []),
    ],
  };
}

export function assertReleaseDryRunCompleteness(options) {
  const summary = buildReleaseDryRunCompletenessSummary(options);
  if (summary.issues.length) {
    throw new Error(`Release dry-run output is incomplete: ${summary.issues.join('; ')}`);
  }
  return summary;
}

export function buildLowerTierDryRunRange(start, end) {
  const startSeason = parseInteger(start);
  const endSeason = parseInteger(end);
  if (endSeason == null || endSeason < LOWER_TIER_START_SEASON) return null;

  return {
    start: Math.max(startSeason ?? LOWER_TIER_START_SEASON, LOWER_TIER_START_SEASON),
    end: endSeason,
  };
}

function run(command, args, options = {}) {
  const display = [command, ...args].join(' ');
  console.log(`\n$ ${display}`);
  execFileSync(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    ...options,
  });
}

export function runReleaseDryRun({
  start = '1888',
  end = '2025',
  output = DEFAULT_OUTPUT_DIR,
  skipClean = false,
  minSeasonCount = computeExpectedSeasonCount(start, end),
  minClubCount = DEFAULT_MIN_CLUB_COUNT,
} = {}) {
  const outputDir = path.resolve(output);
  const overviewFile = path.join(outputDir, 'wiki_overview_tables_by_season.json');
  const allSeasonsFile = path.join(outputDir, 'all-seasons.json');
  const allSeasonsMinFile = path.join(outputDir, 'all-seasons.min.json');
  const overviewMinFile = path.join(outputDir, 'wiki_overview_tables_by_season.min.json');
  const clubMetadataFile = path.join(outputDir, 'club-metadata.json');
  const clubMetadataReviewFile = path.join(outputDir, 'club-metadata-review.json');
  const lowerTierRange = buildLowerTierDryRunRange(start, end);

  if (!skipClean) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  run('node', [
    'wikipedia/cli/index.js',
    'overview',
    '--start',
    String(start),
    '--end',
    String(end),
    '--output',
    outputDir,
    '--force-update',
    '--include-war-placeholders',
  ]);
  if (lowerTierRange) {
    run('node', [
      'wikipedia/cli/index.js',
      'lower-tiers',
      '--start',
      String(lowerTierRange.start),
      '--end',
      String(lowerTierRange.end),
      '--output',
      outputDir,
      '--force-update',
    ]);
  } else {
    console.log('\n⏭️ Skipping lower-tier supplements; dry-run range ends before 1979.');
  }
  run('node', ['wikipedia/data/combine-output-files.js', '--output', allSeasonsFile, overviewFile]);
  run('node', [
    'wikipedia/data/generate-club-metadata-seed.js',
    allSeasonsFile,
    '--output',
    clubMetadataFile,
    '--review-output',
    clubMetadataReviewFile,
  ]);
  const completeness = assertReleaseDryRunCompleteness({
    allSeasonsFile,
    clubMetadataFile,
    minSeasonCount: parseNonNegativeInteger(minSeasonCount, computeExpectedSeasonCount(start, end)),
    minClubCount: parseNonNegativeInteger(minClubCount, DEFAULT_MIN_CLUB_COUNT),
  });
  console.log(
    `\nRelease dry-run completeness: ${completeness.seasonCount} season(s), ${completeness.clubCount} club metadata record(s)`
  );
  run('node', ['scripts/minify-json.js', allSeasonsFile]);
  run('node', ['scripts/minify-json.js', overviewFile]);
  run('node', ['wikipedia/data/verify-football-data.js', '--fail-on-issues', outputDir]);
  run('node', [
    'wikipedia/data/verify-club-continuity.js',
    '--dataset',
    allSeasonsFile,
    '--club-metadata',
    clubMetadataFile,
    '--check-historical-reasons',
    '--fail-on-issues',
  ]);
  run('node', [
    'wikipedia/data/verify-json-schemas.js',
    '--target',
    `football-data.schema.json:${allSeasonsFile}`,
    '--target',
    `football-data.schema.json:${allSeasonsMinFile}`,
    '--target',
    `football-data.schema.json:${overviewFile}`,
    '--target',
    `football-data.schema.json:${overviewMinFile}`,
    '--target',
    `club-metadata.schema.json:${clubMetadataFile}`,
  ]);

  console.log(`\nRelease dry-run data verified in ${outputDir}`);
}

export function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name('release-dry-run-data')
    .description('Rebuild release data into a temporary directory and run release verification.')
    .option('--start <year>', 'First season year', '1888')
    .option('--end <year>', 'Final season year', '2025')
    .option('--output <dir>', 'Temporary output directory', DEFAULT_OUTPUT_DIR)
    .option('--skip-clean', 'Do not delete the output directory before running', false)
    .option(
      '--min-season-count <count>',
      'Fail if the dry-run output contains fewer season records than this count'
    )
    .option(
      '--min-club-count <count>',
      'Fail if the dry-run output contains fewer club metadata records than this count',
      String(DEFAULT_MIN_CLUB_COUNT)
    );

  program.parse(argv);
  const options = program.opts();
  runReleaseDryRun({
    ...options,
    minSeasonCount:
      options.minSeasonCount == null
        ? computeExpectedSeasonCount(options.start, options.end)
        : options.minSeasonCount,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv);
}

export default {
  assertReleaseDryRunCompleteness,
  buildLowerTierDryRunRange,
  buildReleaseDryRunCompletenessSummary,
  runReleaseDryRun,
  runCli,
};
