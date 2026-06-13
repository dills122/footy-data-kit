#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKIPEDIA_GENERATORS } from '../config.js';
import {
  CLUB_RELATIONSHIP_RULES,
  getCanonicalClubName,
  getClubIdentitySourceRefs,
  TEMPORAL_CLUB_IDENTITY_RULES,
} from './club-identity-config.js';
import { canonicalizeTeamName, normalizeTeamNameText } from './data-quality-config.js';
import { buildDatasetMetadata, loadFootballData, normaliseClubsMap } from './generate-output-files.js';
import { getTierKeys, getTierTable, sortSeasonKeys } from './season-rules.js';

const DEFAULT_INPUT_FILE = './data-output/all-seasons.json';
const DEFAULT_OUTPUT_FILE = './data/club-metadata.json';
const DERIVED_SOURCE_ID = 'football-data-output';
const OFFICIAL_COMPETITION_PAUSED_REASON = 'official-competition-paused';
const OUTSIDE_TRACKED_COVERAGE_REASON = 'outside-tracked-coverage';
const SEASON_METADATA_BASIS = 'season-metadata';
const TABLE_NOTE_BASIS = 'table-note';

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

function slugifyClubId(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function incrementMapValue(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function createAccumulator(clubKey, teamName) {
  return {
    clubKey,
    canonicalName: getCanonicalClubName(clubKey, teamName),
    latestSeenSeason: null,
    aliasCounts: new Map(),
    aliasSeasons: new Map(),
    aliasTiers: new Map(),
    identitySources: new Map(),
    relationships: new Map(),
    rowObservations: [],
    seasonsSeen: new Set(),
    tiersSeen: new Set(),
    tierSeasons: new Map(),
  };
}

function relationshipDirectionForSource(relationship) {
  if (relationship === 'merger') return 'mergedInto';
  if (relationship === 'relocation') return 'relocatedTo';
  if (relationship === 'supporterPhoenix') return 'supporterFounded';
  return 'successor';
}

function relationshipDirectionForTarget(relationship) {
  if (relationship === 'merger') return 'formedFrom';
  if (relationship === 'relocation') return 'relocatedFrom';
  if (relationship === 'supporterPhoenix') return 'formedBySupportersOf';
  return 'predecessor';
}

function addClubRelationship(accumulator, relationship) {
  const dedupeKey = `${relationship.clubKey}:${relationship.relationship}:${relationship.direction}`;
  accumulator.relationships.set(dedupeKey, relationship);
}

function addIdentitySourceRefs(accumulator, sourceRefs) {
  for (const sourceRef of sourceRefs || []) {
    if (!sourceRef?.sourceUrl) continue;
    accumulator.identitySources.set(
      `${sourceRef.type || 'source'}:${sourceRef.sourceUrl}`,
      sourceRef
    );
  }
}

function addAliasSeason(accumulator, teamName, seasonNumber) {
  incrementMapValue(accumulator.aliasCounts, teamName);
  if (!accumulator.aliasSeasons.has(teamName)) {
    accumulator.aliasSeasons.set(teamName, new Set());
  }
  accumulator.aliasSeasons.get(teamName).add(seasonNumber);
}

function addAliasTier(accumulator, teamName, tierKey) {
  if (!accumulator.aliasTiers.has(teamName)) {
    accumulator.aliasTiers.set(teamName, new Set());
  }
  accumulator.aliasTiers.get(teamName).add(tierKey);
}

function addTierSeason(accumulator, tierKey, seasonNumber) {
  accumulator.tiersSeen.add(tierKey);
  if (!accumulator.tierSeasons.has(tierKey)) {
    accumulator.tierSeasons.set(tierKey, new Set());
  }
  accumulator.tierSeasons.get(tierKey).add(seasonNumber);
}

function normalizeNoteText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeNoteText(entry))
      .filter(Boolean)
      .join('; ');
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function buildTierSourceRefs(tierValue, tierKey, seasonNumber) {
  const metadata = tierValue && typeof tierValue === 'object' ? tierValue.metadata || {} : {};
  if (!metadata.sourceUrl) return [];

  const title = metadata.title || tierKey;
  const seasonLabel = metadata.seasonSlug || seasonNumber;
  return [
    {
      type: 'wikipedia-season-page',
      sourceUrl: metadata.sourceUrl,
      notes: `${title} table in ${seasonLabel}`,
    },
  ];
}

function addRowObservation(accumulator, { seasonNumber, tierKey, teamName, row, tierValue }) {
  accumulator.rowObservations.push({
    seasonNumber,
    tierKey,
    teamName,
    notes: normalizeNoteText(row.notes),
    sourceRefs: buildTierSourceRefs(tierValue, tierKey, seasonNumber),
  });
}

function maybeUpdateCanonicalName(accumulator, teamName, seasonNumber) {
  if (getCanonicalClubName(accumulator.clubKey, null)) return;
  if (accumulator.latestSeenSeason == null || seasonNumber >= accumulator.latestSeenSeason) {
    accumulator.canonicalName = teamName;
    accumulator.latestSeenSeason = seasonNumber;
  }
}

function resolveClubKey(teamName, seasonNumber) {
  for (const rule of TEMPORAL_CLUB_IDENTITY_RULES) {
    if (teamName !== rule.name) continue;
    if (rule.startSeason != null && seasonNumber < rule.startSeason) continue;
    if (rule.endSeason != null && seasonNumber > rule.endSeason) continue;
    return { clubKey: rule.clubKey, sourceRefs: rule.sourceRefs || [] };
  }

  const clubKey = canonicalizeTeamName(teamName);
  return { clubKey, sourceRefs: getClubIdentitySourceRefs(clubKey) };
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

export function classifyClubTableNoteForContinuity(note) {
  const noteText = normalizeNoteText(note);
  if (!noteText) return null;

  const outsideTrackedSignal = {
    absenceReason: OUTSIDE_TRACKED_COVERAGE_REASON,
    basis: TABLE_NOTE_BASIS,
    description: noteText,
  };

  if (/failed re-?election/i.test(noteText)) {
    return {
      ...outsideTrackedSignal,
      eventType: 'not-re-elected',
    };
  }

  if (/resigned from (?:the )?league/i.test(noteText)) {
    return {
      ...outsideTrackedSignal,
      eventType: 'resigned-from-league',
    };
  }

  const outsideTrackedLeaguePattern =
    /(?:relegat(?:ion|ed) to|demoted to)\s+(?:\d{4}[–-]\d{2}\s+)?(?:the\s+)?(?:football conference|conference national|national league(?: north| south)?|conference north|conference south|southern league|northern premier league|isthmian league)/i;
  if (outsideTrackedLeaguePattern.test(noteText)) {
    return {
      ...outsideTrackedSignal,
      eventType: /demoted to/i.test(noteText)
        ? 'demoted-outside-tracked-coverage'
        : 'relegated-outside-tracked-coverage',
    };
  }

  return null;
}

function isFullSeasonRangeCovered(startSeason, endSeason, seasonSet) {
  for (let season = startSeason; season <= endSeason; season += 1) {
    if (!seasonSet.has(season)) return false;
  }
  return true;
}

function findPreviousObservation(rowObservations, gap) {
  return [...rowObservations]
    .sort((a, b) => b.seasonNumber - a.seasonNumber)
    .find((row) => row.seasonNumber < gap.startSeason);
}

function buildTableNoteLifecycleEvents(coverageGaps, rowObservations) {
  const events = [];
  const seen = new Set();

  for (const gap of coverageGaps) {
    const previousObservation = findPreviousObservation(rowObservations, gap);
    const signal = classifyClubTableNoteForContinuity(previousObservation?.notes);
    if (!previousObservation || !signal) continue;

    const event = {
      type: signal.eventType,
      season: previousObservation.seasonNumber,
      description: signal.description,
      sourceRefs: previousObservation.sourceRefs,
    };
    const dedupeKey = JSON.stringify(event);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    events.push(event);
  }

  return events.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.type.localeCompare(b.type);
  });
}

function buildAutoAbsenceExplanations(coverageGaps, officialPausedSeasons, rowObservations) {
  return coverageGaps.map((gap) => {
    if (isFullSeasonRangeCovered(gap.startSeason, gap.endSeason, officialPausedSeasons)) {
      return {
        fromSeason: gap.startSeason,
        toSeason: gap.endSeason,
        reason: OFFICIAL_COMPETITION_PAUSED_REASON,
        basis: SEASON_METADATA_BASIS,
      };
    }

    const previousObservation = findPreviousObservation(rowObservations, gap);
    const signal = classifyClubTableNoteForContinuity(previousObservation?.notes);
    if (previousObservation && signal) {
      return {
        fromSeason: gap.startSeason,
        toSeason: gap.endSeason,
        reason: signal.absenceReason,
        linkedEventType: signal.eventType,
        basis: signal.basis,
        notes: signal.description,
        sourceRefs: previousObservation.sourceRefs,
      };
    }

    return null;
  }).filter(Boolean);
}

function buildTrackedMembership(seasonsSeen, tiersSeen, latestSeason) {
  if (!seasonsSeen.length) return [];
  const firstSeenSeason = seasonsSeen[0];
  const lastSeenSeason = seasonsSeen[seasonsSeen.length - 1];
  return [
    {
      fromSeason: firstSeenSeason,
      toSeason: lastSeenSeason === latestSeason ? null : lastSeenSeason,
      tiers: sortTierKeys(tiersSeen),
      basis: 'observed',
    },
  ];
}

function buildClubStatus(seasonsSeen, coverageGaps, absenceExplanations, latestSeason) {
  const firstSeenSeason = seasonsSeen[0] ?? null;
  const lastSeenSeason = seasonsSeen[seasonsSeen.length - 1] ?? null;
  const explainedGapKeys = new Set(
    absenceExplanations.map((entry) => `${entry.fromSeason}:${entry.toSeason}`)
  );
  const hasUnexplainedGaps = coverageGaps.some(
    (gap) => !explainedGapKeys.has(`${gap.startSeason}:${gap.endSeason}`)
  );

  return {
    current: lastSeenSeason === latestSeason ? 'active' : 'unknown',
    trackedFromSeason: firstSeenSeason,
    trackedToSeason: lastSeenSeason === latestSeason ? null : lastSeenSeason,
    hasUnexplainedGaps,
  };
}

function buildObservedNames(aliasSeasons, aliasTiers) {
  return [...aliasSeasons.entries()]
    .map(([rawName, seasons]) => {
      const seasonsSeen = sortedNumbers(seasons);
      return {
        rawName,
        normalizedName: normalizeTeamNameText(rawName),
        firstSeenSeason: seasonsSeen[0],
        lastSeenSeason: seasonsSeen[seasonsSeen.length - 1],
        seasonsSeen,
        tiersSeen: sortedStrings(aliasTiers.get(rawName) || []),
      };
    })
    .sort((a, b) => a.firstSeenSeason - b.firstSeenSeason || a.rawName.localeCompare(b.rawName));
}

function buildTierSeasons(tierSeasons) {
  return sortTierKeys(tierSeasons.keys()).map((tierKey) => ({
    tierKey,
    seasons: sortedNumbers(tierSeasons.get(tierKey)),
  }));
}

function buildIdentitySources(identitySources) {
  return [...identitySources.values()].sort((a, b) => {
    const leftType = a.type || '';
    const rightType = b.type || '';
    if (leftType !== rightType) return leftType.localeCompare(rightType);
    return String(a.sourceUrl || '').localeCompare(String(b.sourceUrl || ''));
  });
}

function buildRelationships(relationships) {
  return [...relationships.values()].sort((a, b) => {
    if (a.clubKey !== b.clubKey) return a.clubKey.localeCompare(b.clubKey);
    if (a.relationship !== b.relationship) return a.relationship.localeCompare(b.relationship);
    return a.direction.localeCompare(b.direction);
  });
}

function buildClubMetadataRecord(accumulator, { latestSeason, officialPausedSeasons } = {}) {
  const seasonsSeen = sortedNumbers(accumulator.seasonsSeen);
  const tiersSeen = sortTierKeys(accumulator.tiersSeen);
  const coverageGaps = buildCoverageGaps(accumulator.seasonsSeen);
  const absenceExplanations = buildAutoAbsenceExplanations(
    coverageGaps,
    officialPausedSeasons || new Set(),
    accumulator.rowObservations
  );
  const lifecycleEvents = buildTableNoteLifecycleEvents(coverageGaps, accumulator.rowObservations);
  const trackedMembership = buildTrackedMembership(seasonsSeen, tiersSeen, latestSeason);

  return {
    clubId: slugifyClubId(accumulator.clubKey),
    canonicalName: accumulator.canonicalName,
    status: buildClubStatus(seasonsSeen, coverageGaps, absenceExplanations, latestSeason),
    history: {
      nameHistory: [],
      lifecycleEvents,
      trackedMembership,
      absenceExplanations,
    },
    derived: {
      source: DERIVED_SOURCE_ID,
      aliases: sortedStrings(accumulator.aliasCounts.keys()),
      identitySources: buildIdentitySources(accumulator.identitySources),
      relationships: buildRelationships(accumulator.relationships),
      observedNames: buildObservedNames(accumulator.aliasSeasons, accumulator.aliasTiers),
      observedNamePeriods: buildObservedNamePeriods(accumulator.aliasSeasons),
      firstSeenSeason: seasonsSeen[0] ?? null,
      lastSeenSeason: seasonsSeen[seasonsSeen.length - 1] ?? null,
      seasonsSeen,
      totalSeasonsSeen: seasonsSeen.length,
      tiersSeen,
      tierSeasons: buildTierSeasons(accumulator.tierSeasons),
      coverageGaps,
    },
  };
}

function isOfficialCompetitionPausedSeason(seasonRecord) {
  const seasonInfo = seasonRecord?.seasonInfo || {};
  return (
    seasonInfo.officialLeagueTables === false ||
    seasonInfo.officialCompetitionsSuspended === true ||
    seasonInfo.officialCompetitionsAbandoned === true ||
    seasonInfo.regionalBridgeSeason === true ||
    ['wartime-special', 'abandoned-season', 'regional-bridge-season'].includes(
      String(seasonInfo.competitionStatus || '')
    )
  );
}

/**
 * @param {import('./models/output-file').FootballData} dataset
 * @returns {import('./models/output-file').ClubsMap}
 */
export function buildClubMetadataSeed(dataset) {
  const clubs = new Map();
  const seasonKeys = sortSeasonKeys(Object.keys(dataset?.seasons || {}));
  const seasonNumbers = seasonKeys.map(parseSeasonKey).filter(Number.isInteger);
  const latestSeason = seasonNumbers[seasonNumbers.length - 1] ?? null;
  const officialPausedSeasons = new Set();

  for (const seasonKey of seasonKeys) {
    const seasonNumber = parseSeasonKey(seasonKey);
    if (seasonNumber == null) continue;

    const seasonRecord = dataset.seasons[seasonKey];
    if (isOfficialCompetitionPausedSeason(seasonRecord)) {
      officialPausedSeasons.add(seasonNumber);
    }
    for (const tierKey of getTierKeys(seasonRecord)) {
      for (const row of getTierTable(seasonRecord[tierKey])) {
        if (!row || typeof row !== 'object' || typeof row.team !== 'string') continue;
        const teamName = row.team.trim();
        if (!teamName) continue;

        const { clubKey, sourceRefs } = resolveClubKey(teamName, seasonNumber);
        if (!clubs.has(clubKey)) {
          clubs.set(clubKey, createAccumulator(clubKey, teamName));
        }

        const accumulator = clubs.get(clubKey);
        addIdentitySourceRefs(accumulator, sourceRefs);
        accumulator.seasonsSeen.add(seasonNumber);
        addAliasSeason(accumulator, teamName, seasonNumber);
        addAliasTier(accumulator, teamName, tierKey);
        addTierSeason(accumulator, tierKey, seasonNumber);
        addRowObservation(accumulator, { seasonNumber, tierKey, teamName, row, tierValue: seasonRecord[tierKey] });
        maybeUpdateCanonicalName(accumulator, teamName, seasonNumber);
      }
    }
  }

  applyClubRelationshipRules(clubs);

  const entries = [...clubs.entries()]
    .map(([clubKey, accumulator]) => [
      clubKey,
      buildClubMetadataRecord(accumulator, { latestSeason, officialPausedSeasons }),
    ])
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return normaliseClubsMap(Object.fromEntries(entries)) || {};
}

function applyClubRelationshipRules(clubs) {
  for (const rule of CLUB_RELATIONSHIP_RULES) {
    const fromClub = clubs.get(rule.fromClubKey);
    const toClub = clubs.get(rule.toClubKey);
    if (fromClub) {
      addClubRelationship(fromClub, {
        clubKey: rule.toClubKey,
        relationship: rule.relationship,
        direction: relationshipDirectionForSource(rule.relationship),
        sourceRefs: rule.sourceRefs || [],
      });
    }
    if (toClub) {
      addClubRelationship(toClub, {
        clubKey: rule.fromClubKey,
        relationship: rule.relationship,
        direction: relationshipDirectionForTarget(rule.relationship),
        sourceRefs: rule.sourceRefs || [],
      });
    }
  }
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
