import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import testPages from '../wikipedia/__integration_tests__/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_DATASET_PATH = path.join(repoRoot, 'data-output', 'all-seasons.json');

function sortNumericStrings(values) {
  return [...values].sort((a, b) => Number(a) - Number(b));
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function mapToSortedObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right))
  );
}

function buildPercentage(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

export function buildIntegrationCoverageReport({ pages, dataset }) {
  const seasonKeys = sortNumericStrings(Object.keys(dataset?.seasons || {}));
  const coveredSeasons = new Set();
  const sourceCounts = new Map();
  const assertedTierCounts = new Map();
  const tagSeasonMap = new Map();
  let rowAssertionCount = 0;
  let metadataAssertionCount = 0;
  let seasonInfoAssertionCount = 0;
  let transitionAssertionCount = 0;

  for (const page of pages) {
    coveredSeasons.add(String(page.season));
    increment(sourceCounts, page.source || 'promotion');

    if (Array.isArray(page.tests?.promoted)) {
      transitionAssertionCount += page.tests.promoted.length;
    }
    if (Array.isArray(page.tests?.relegated)) {
      transitionAssertionCount += page.tests.relegated.length;
    }
    if (page.tests?.seasonInfo) {
      seasonInfoAssertionCount += Object.keys(page.tests.seasonInfo).length;
    }

    for (const entry of page.tests?.tableEntries || []) {
      rowAssertionCount += 1;
      increment(assertedTierCounts, entry.tier);
    }

    for (const entry of page.tests?.tierMetadataEntries || []) {
      metadataAssertionCount += 1;
      increment(assertedTierCounts, entry.tier);
    }

    for (const tag of page.coverage || []) {
      if (!tagSeasonMap.has(tag)) tagSeasonMap.set(tag, new Set());
      tagSeasonMap.get(tag).add(String(page.season));
    }
  }

  const coveredSeasonKeys = sortNumericStrings(coveredSeasons);
  const totalSeasonCount = seasonKeys.length;
  const coveredSeasonCount = coveredSeasonKeys.length;
  const coverageTags = Object.fromEntries(
    [...tagSeasonMap.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([tag, seasons]) => [tag, sortNumericStrings(seasons)])
  );

  return {
    totalSeasonCount,
    coveredSeasonCount,
    seasonCoveragePercent: buildPercentage(coveredSeasonCount, totalSeasonCount),
    fixturePageCount: pages.length,
    coveredSeasons: coveredSeasonKeys,
    sourceCounts: mapToSortedObject(sourceCounts),
    assertedTierCounts: mapToSortedObject(assertedTierCounts),
    assertionCounts: {
      transitionTeams: transitionAssertionCount,
      tableRows: rowAssertionCount,
      tierMetadata: metadataAssertionCount,
      seasonInfoFields: seasonInfoAssertionCount,
    },
    coverageTags,
  };
}

export function formatIntegrationCoverageReport(report) {
  const assertedTiers = Object.entries(report.assertedTierCounts)
    .map(([tier, count]) => `${tier} (${count})`)
    .join(', ');
  const sourceSummary = Object.entries(report.sourceCounts)
    .map(([source, count]) => `${source}: ${count}`)
    .join(', ');
  const assertionSummary = Object.entries(report.assertionCounts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
  const tagLines = Object.entries(report.coverageTags).map(
    ([tag, seasons]) => `- ${tag}: ${seasons.length} season(s) (${seasons.join(', ')})`
  );

  return [
    'Integration Coverage',
    `- Season fixtures: ${report.coveredSeasonCount}/${report.totalSeasonCount} (${report.seasonCoveragePercent}%)`,
    `- Fixture pages: ${report.fixturePageCount}`,
    `- Source modes: ${sourceSummary || 'none'}`,
    `- Asserted tiers: ${assertedTiers || 'none'}`,
    `- Assertion counts: ${assertionSummary}`,
    '',
    'Scenario Tags',
    ...(tagLines.length ? tagLines : ['- none']),
  ].join('\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseArgs(argv) {
  const args = {
    datasetPath: DEFAULT_DATASET_PATH,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg === '--dataset') {
      args.datasetPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

export function runIntegrationCoverageReport(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const dataset = readJson(args.datasetPath);
  const report = buildIntegrationCoverageReport({ pages: testPages, dataset });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatIntegrationCoverageReport(report));
}

if (process.argv[1] === __filename) {
  runIntegrationCoverageReport();
}
