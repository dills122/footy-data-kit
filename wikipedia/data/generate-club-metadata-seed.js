#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKIPEDIA_GENERATORS } from '../config.js';
import { canonicalizeTeamName } from './data-quality-config.js';
import { buildDatasetMetadata, loadFootballData, normaliseClubsMap } from './generate-output-files.js';
import { getTierKeys, getTierTable, sortSeasonKeys } from './season-rules.js';

const DEFAULT_INPUT_FILE = './data-output/all-seasons.json';
const DEFAULT_OUTPUT_FILE = './data/club-metadata.json';
const DERIVED_SOURCE_ID = 'football-data-output';

function parseSeasonKey(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortTierKeys(keys) {
  return [...keys].sort((a, b) => {
    const left = Number.parseInt(a.replace(/^tier/i, ''), 10);
    const right = Number.parseInt(b.replace(/^tier/i, ''), 10);
    if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
    return a.localeCompare(b);
  });
}

function sortedNumbers(values) {
  return [...values].sort((a, b) => a - b);
}

function sortedStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function incrementMapValue(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function createAccumulator(clubKey, teamName) {
  return {
    clubKey,
    canonicalName: teamName,
    latestSeenSeason: null,
    aliasCounts: new Map(),
    aliasSeasons: new Map(),
    seasonsSeen: new Set(),
    tiersSeen: new Set(),
    tierSeasons: new Map(),
  };
}

function addAliasSeason(accumulator, teamName, seasonNumber) {
  incrementMapValue(accumulator.aliasCounts, teamName);
  if (!accumulator.aliasSeasons.has(teamName)) {
    accumulator.aliasSeasons.set(teamName, new Set());
  }
  accumulator.aliasSeasons.get(teamName).add(seasonNumber);
}

function addTierSeason(accumulator, tierKey, seasonNumber) {
  accumulator.tiersSeen.add(tierKey);
  if (!accumulator.tierSeasons.has(tierKey)) {
    accumulator.tierSeasons.set(tierKey, new Set());
  }
  accumulator.tierSeasons.get(tierKey).add(seasonNumber);
}

function maybeUpdateCanonicalName(accumulator, teamName, seasonNumber) {
  if (accumulator.latestSeenSeason == null || seasonNumber >= accumulator.latestSeenSeason) {
    accumulator.canonicalName = teamName;
    accumulator.latestSeenSeason = seasonNumber;
  }
}

function buildObservedNamePeriods(aliasSeasons) {
  const periods = [];

  for (const [name, seasons] of aliasSeasons) {
    const sortedSeasons = sortedNumbers(seasons);
    let startSeason = null;
    let previousSeason = null;

    for (const season of sortedSeasons) {
      if (startSeason == null) {
        startSeason = season;
        previousSeason = season;
        continue;
      }

      if (season === previousSeason + 1) {
        previousSeason = season;
        continue;
      }

      periods.push({ name, startSeason, endSeason: previousSeason });
      startSeason = season;
      previousSeason = season;
    }

    if (startSeason != null && previousSeason != null) {
      periods.push({ name, startSeason, endSeason: previousSeason });
    }
  }

  return periods.sort((a, b) => a.startSeason - b.startSeason || a.name.localeCompare(b.name));
}

function buildCoverageGaps(seasonsSeen) {
  const seasons = sortedNumbers(seasonsSeen);
  const gaps = [];

  for (let index = 1; index < seasons.length; index += 1) {
    const previousSeason = seasons[index - 1];
    const season = seasons[index];
    if (season <= previousSeason + 1) continue;
    gaps.push({
      startSeason: previousSeason + 1,
      endSeason: season - 1,
      length: season - previousSeason - 1,
    });
  }

  return gaps;
}

function buildTierSeasons(tierSeasons) {
  return sortTierKeys(tierSeasons.keys()).map((tierKey) => ({
    tierKey,
    seasons: sortedNumbers(tierSeasons.get(tierKey)),
  }));
}

function buildClubMetadataRecord(accumulator) {
  const seasonsSeen = sortedNumbers(accumulator.seasonsSeen);

  return {
    canonicalName: accumulator.canonicalName,
    derived: {
      source: DERIVED_SOURCE_ID,
      aliases: sortedStrings(accumulator.aliasCounts.keys()),
      observedNamePeriods: buildObservedNamePeriods(accumulator.aliasSeasons),
      firstSeenSeason: seasonsSeen[0] ?? null,
      lastSeenSeason: seasonsSeen[seasonsSeen.length - 1] ?? null,
      seasonsSeen,
      totalSeasonsSeen: seasonsSeen.length,
      tiersSeen: sortTierKeys(accumulator.tiersSeen),
      tierSeasons: buildTierSeasons(accumulator.tierSeasons),
      coverageGaps: buildCoverageGaps(accumulator.seasonsSeen),
    },
  };
}

/**
 * @param {import('./models/output-file').FootballData} dataset
 * @returns {import('./models/output-file').ClubsMap}
 */
export function buildClubMetadataSeed(dataset) {
  const clubs = new Map();
  const seasonKeys = sortSeasonKeys(Object.keys(dataset?.seasons || {}));

  for (const seasonKey of seasonKeys) {
    const seasonNumber = parseSeasonKey(seasonKey);
    if (seasonNumber == null) continue;

    const seasonRecord = dataset.seasons[seasonKey];
    for (const tierKey of getTierKeys(seasonRecord)) {
      for (const row of getTierTable(seasonRecord[tierKey])) {
        if (!row || typeof row !== 'object' || typeof row.team !== 'string') continue;
        const teamName = row.team.trim();
        if (!teamName) continue;

        const clubKey = canonicalizeTeamName(teamName);
        if (!clubs.has(clubKey)) {
          clubs.set(clubKey, createAccumulator(clubKey, teamName));
        }

        const accumulator = clubs.get(clubKey);
        accumulator.seasonsSeen.add(seasonNumber);
        addAliasSeason(accumulator, teamName, seasonNumber);
        addTierSeason(accumulator, tierKey, seasonNumber);
        maybeUpdateCanonicalName(accumulator, teamName, seasonNumber);
      }
    }
  }

  const entries = [...clubs.entries()]
    .map(([clubKey, accumulator]) => [clubKey, buildClubMetadataRecord(accumulator)])
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return normaliseClubsMap(Object.fromEntries(entries)) || {};
}

export function buildClubMetadataSeedDataset(inputFile, options = {}) {
  const dataset = loadFootballData(inputFile);
  const clubs = buildClubMetadataSeed(dataset);

  return {
    metadata: buildDatasetMetadata({
      generator: WIKIPEDIA_GENERATORS.clubMetadataSeed,
      sourceFiles: [path.resolve(options.cwd || process.cwd(), inputFile)],
      buildOptions: {
        input: inputFile,
      },
    }),
    clubs,
  };
}

export function writeClubMetadataSeedFile({ input, output, compact = false, cwd = process.cwd() }) {
  const resolvedInput = path.resolve(cwd, input);
  const resolvedOutput = path.resolve(cwd, output);
  const seedDataset = buildClubMetadataSeedDataset(resolvedInput, { cwd });
  const spacing = compact ? 0 : 2;

  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, JSON.stringify(seedDataset, null, spacing));

  return {
    outputPath: resolvedOutput,
    clubCount: Object.keys(seedDataset.clubs).length,
    dataset: seedDataset,
  };
}

export function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name('generate-club-metadata-seed')
    .description('Generate derived club metadata from a FootballData JSON file.')
    .argument('[input]', 'FootballData JSON input file', DEFAULT_INPUT_FILE)
    .option('-o, --output <file>', 'Path to write the club metadata sidecar file', DEFAULT_OUTPUT_FILE)
    .option('--compact', 'Write the output without indentation', false);

  program.parse(argv);

  const input = program.args[0] || DEFAULT_INPUT_FILE;
  const { output, compact } = program.opts();
  const result = writeClubMetadataSeedFile({
    input,
    output,
    compact,
    cwd: process.cwd(),
  });

  console.log(`Generated ${result.clubCount} club metadata records -> ${result.outputPath}`);
  return result;
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}

export default {
  buildClubMetadataSeed,
  buildClubMetadataSeedDataset,
  writeClubMetadataSeedFile,
  runCli,
};
