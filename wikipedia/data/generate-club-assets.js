#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildClubAssetReviewIssues,
  discoverClubCrestBundle,
} from './assets/club-assets.js';
import { buildDatasetMetadata, normaliseClubsMap } from './generate-output-files.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_INPUT_FILE = './data/club-metadata.json';
const DEFAULT_OUTPUT_FILE = './data/club-metadata.json';
const DEFAULT_REVIEW_OUTPUT_FILE = './data/club-assets-review.json';
const GENERATOR_ID = 'club-assets';
const REVIEW_GENERATOR_ID = 'club-assets-review';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, spacing) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, spacing)}\n`);
}

function unwrapClubMetadata(value) {
  if (value?.clubs && typeof value.clubs === 'object') return value.clubs;
  return value;
}

function readAssetCache(cachePath) {
  if (!cachePath || !fs.existsSync(cachePath)) return {};
  const cache = readJson(cachePath);
  return cache?.clubs && typeof cache.clubs === 'object' ? cache.clubs : {};
}

function writeAssetCache(cachePath, clubs, spacing) {
  if (!cachePath) return;
  writeJson(
    cachePath,
    {
      metadata: buildDatasetMetadata({
        generator: `${GENERATOR_ID}-cache`,
        sourceFiles: [],
        buildOptions: {},
      }),
      clubs,
    },
    spacing
  );
}

function buildReviewReport(clubs, { sourceFiles, input, output }) {
  const issues = [];
  for (const [clubKey, club] of Object.entries(clubs || {})) {
    issues.push(...buildClubAssetReviewIssues(clubKey, club, club?.assets?.crest));
  }
  issues.sort((left, right) => {
    if (left.type !== right.type) return left.type.localeCompare(right.type);
    if (left.clubKey !== right.clubKey) return left.clubKey.localeCompare(right.clubKey);
    return String(left.assetId || '').localeCompare(String(right.assetId || ''));
  });

  return {
    metadata: buildDatasetMetadata({
      generator: REVIEW_GENERATOR_ID,
      sourceFiles,
      buildOptions: { input, output },
    }),
    clubCount: Object.keys(clubs || {}).length,
    issueCount: issues.length,
    issueCounts: issues.reduce((counts, issue) => {
      counts[issue.type] = (counts[issue.type] || 0) + 1;
      return counts;
    }, {}),
    issues,
  };
}

export async function generateClubAssets({
  input = DEFAULT_INPUT_FILE,
  output = DEFAULT_OUTPUT_FILE,
  reviewOutput = DEFAULT_REVIEW_OUTPUT_FILE,
  compact = false,
  limit = 5,
  clubLimit = null,
  cache = null,
  refreshAssets = false,
  requestDelayMs = 100,
  cwd = ROOT_DIR,
} = {}) {
  const inputPath = path.resolve(cwd, input);
  const outputPath = path.resolve(cwd, output);
  const reviewOutputPath = reviewOutput ? path.resolve(cwd, reviewOutput) : null;
  const cachePath = cache ? path.resolve(cwd, cache) : null;
  const inputData = readJson(inputPath);
  const sourceClubs = normaliseClubsMap(unwrapClubMetadata(inputData)) || {};
  const entries = Object.entries(sourceClubs);
  const selectedEntries = Number.isInteger(clubLimit) ? entries.slice(0, clubLimit) : entries;
  const enrichedClubs = { ...sourceClubs };
  const cachedAssets = readAssetCache(cachePath);

  for (const [index, [clubKey, club]] of selectedEntries.entries()) {
    const cachedCrest = cachedAssets[clubKey]?.crest;
    const crest =
      cachedCrest && !refreshAssets ? cachedCrest : await discoverClubCrestBundle(club, { limit });
    enrichedClubs[clubKey] = {
      ...club,
      assets: {
        ...(club.assets || {}),
        crest,
      },
    };
    cachedAssets[clubKey] = {
      ...(cachedAssets[clubKey] || {}),
      crest,
    };
    writeAssetCache(cachePath, cachedAssets, compact ? 0 : 2);
    if (requestDelayMs > 0 && index < selectedEntries.length - 1) {
      await sleep(requestDelayMs);
    }
  }

  const spacing = compact ? 0 : 2;
  const outputData = {
    metadata: buildDatasetMetadata({
      generator: GENERATOR_ID,
      sourceFiles: [inputPath],
      buildOptions: { input, limit, clubLimit, cache, refreshAssets, requestDelayMs },
    }),
    clubs: enrichedClubs,
  };
  writeJson(outputPath, outputData, spacing);

  const reviewClubs = Number.isInteger(clubLimit)
    ? Object.fromEntries(selectedEntries.map(([clubKey]) => [clubKey, enrichedClubs[clubKey]]))
    : enrichedClubs;
  const reviewReport = reviewOutputPath
    ? buildReviewReport(reviewClubs, {
        sourceFiles: [inputPath],
        input,
        output,
      })
    : null;
  if (reviewOutputPath && reviewReport) {
    writeJson(reviewOutputPath, reviewReport, spacing);
  }

  return {
    inputPath,
    outputPath,
    reviewOutputPath,
    clubCount: Object.keys(enrichedClubs).length,
    processedClubCount: selectedEntries.length,
    reviewReport,
  };
}

export async function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name('generate-club-assets')
    .description('Discover and verify club crest assets for club metadata records.')
    .argument('[input]', 'Path to club-metadata.json', DEFAULT_INPUT_FILE)
    .option('-o, --output <file>', 'Path to write enriched club metadata', DEFAULT_OUTPUT_FILE)
    .option('--review-output <file>', 'Path to write asset review report', DEFAULT_REVIEW_OUTPUT_FILE)
    .option('--limit <count>', 'Maximum candidates per asset kind', (value) => Number.parseInt(value, 10), 5)
    .option(
      '--club-limit <count>',
      'Process only the first N clubs; useful for smoke tests',
      (value) => Number.parseInt(value, 10),
      null
    )
    .option('--cache <file>', 'Path to a resumable asset discovery cache')
    .option('--refresh-assets', 'Ignore cached asset bundles and refresh source lookups', false)
    .option(
      '--request-delay-ms <count>',
      'Delay between club lookups to avoid source rate limits',
      (value) => Number.parseInt(value, 10),
      100
    )
    .option('--compact', 'Write compact JSON', false);

  program.parse(argv);
  const options = program.opts();
  const result = await generateClubAssets({
    input: program.args[0] || DEFAULT_INPUT_FILE,
    output: options.output,
    reviewOutput: options.reviewOutput,
    limit: options.limit,
    clubLimit: Number.isInteger(options.clubLimit) ? options.clubLimit : null,
    cache: options.cache || null,
    refreshAssets: options.refreshAssets,
    requestDelayMs: Number.isInteger(options.requestDelayMs) ? options.requestDelayMs : 100,
    compact: options.compact,
  });

  console.log(
    `Generated crest assets for ${result.processedClubCount}/${result.clubCount} clubs -> ${result.outputPath}`
  );
  if (result.reviewOutputPath && result.reviewReport) {
    console.log(
      `Generated ${result.reviewReport.issueCount} club asset review issues -> ${result.reviewOutputPath}`
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
