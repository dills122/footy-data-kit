#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKIPEDIA_DATA_SOURCES } from '../config.js';
import { canonicalizeTeamName } from './data-quality-config.js';
import { loadFootballData } from './generate-output-files.ts';
import {
  compareSeasonKeys,
  getExpectedMinimumTierCount,
  inferLeagueTierFromMetadata,
  isHistoricalPlaceholderSeason,
  parseSeasonNumber,
  isTierKey,
  shouldIgnoreMissingSeasonData,
  shouldSkipContinuityForSeason,
} from './season-rules.js';

const LEGACY_TIER_METADATA_FIELDS = ['seasonSlug', 'sourceUrl', 'tier', 'title', 'seasonMetadata'];
const REQUIRED_TIER_METADATA_FIELDS = ['source', 'seasonSlug', 'tierKey'];
const REQUIRED_OVERVIEW_METADATA_FIELDS = ['title', 'leagueId', 'tableIndex', 'tableCount'];
const REQUIRED_DATASET_METADATA_FIELDS = ['schemaVersion', 'generator', 'generatedAt'];
const POINTS_ORDER_EXEMPTIONS = new Set([
  '2019:tier3',
  '2019:tier4',
  '2019:tier5',
]);
const CONTINUITY_CONFIG = {
  topFlightTierKey: 'tier1',
  seasonPromotedPath: 'promoted',
  seasonRelegatedPath: 'relegated',
};

/**
 * @param {string[]} targets
 */
export function expandTargets(targets) {
  /** @type {string[]} */
  const files = [];
  const seen = new Set();

  const visit = (resolved, originalTarget) => {
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(resolved)) {
        const child = path.join(resolved, entry);
        visit(child, originalTarget);
      }
      return;
    }

    if (stats.isFile() && resolved.toLowerCase().endsWith('.json')) {
      if (!seen.has(resolved)) {
        files.push(resolved);
        seen.add(resolved);
      }
    }
  };

  for (const target of targets) {
    const resolved = path.resolve(process.cwd(), target);
    if (!fs.existsSync(resolved)) {
      console.warn(`Skipping missing path: ${target}`);
      continue;
    }

    visit(resolved, target);
  }

  return files.sort();
}

/**
 * @param {string} filePath
 */
export function analyzeFile(filePath) {
  const dataset = loadFootballData(filePath);
  const issues = analyzeDataset(dataset, { profile: detectDatasetProfile(dataset) });
  const seasonEntries = Object.entries(dataset.seasons);

  issues.sort((a, b) => {
    const seasonCompare = compareSeasonKeys(a.season, b.season);
    if (seasonCompare !== 0) return seasonCompare;
    if (a.tier && b.tier) return a.tier.localeCompare(b.tier);
    if (a.tier) return -1;
    if (b.tier) return 1;
    return a.type.localeCompare(b.type);
  });

  return {
    filePath,
    seasonCount: seasonEntries.length,
    issues,
  };
}

/**
 * @param {import('../models/output-file.ts').FootballData} dataset
 * @param {{ profile?: DatasetProfile }} [options]
 * @returns {Issue[]}
 */
export function analyzeDataset(dataset, options = {}) {
  const seasonEntries = Object.entries(dataset.seasons || {});
  /** @type {Array<Issue>} */
  const issues = [];
  const profile = options.profile || detectDatasetProfile(dataset);

  issues.push(...analyzeDatasetContract(dataset, profile));

  for (const [seasonKey, seasonValue] of seasonEntries) {
    if (isHistoricalPlaceholderSeason(seasonValue, seasonKey)) {
      issues.push(...analyzeSeasonContract(seasonKey, seasonValue));
      continue;
    }

    const tierEntries = Object.entries(seasonValue).filter(([key]) => isTierKey(key));
    /** @type {Array<TierAnalysis>} */
    const tierAnalyses = tierEntries.map(([tierKey, tierValue]) =>
      analyzeTier(seasonKey, tierKey, tierValue)
    );

    const seasonHasContent = tierAnalyses.some((entry) => entry.hasContent);
    if (!tierEntries.length || !seasonHasContent) {
      if (!shouldIgnoreMissingSeasonData(profile, seasonKey)) {
        issues.push({
          type: 'missing-season-data',
          season: seasonKey,
          message: 'No tier table/promoted/relegated data detected for this season',
        });
      }
      continue;
    }

    issues.push(...analyzeSeasonContract(seasonKey, seasonValue));
    issues.push(...analyzeSeasonTierCoverage(seasonKey, seasonValue, profile));
    issues.push(...analyzeSeasonLeagueOrdering(seasonKey, seasonValue));
    for (const tierAnalysis of tierAnalyses) {
      issues.push(...tierAnalysis.issues);
    }
  }

  issues.push(...analyzeSeasonContinuity(dataset, profile));
  return issues;
}

/**
 * @param {import('../models/output-file.ts').FootballData} dataset
 * @param {DatasetProfile} profile
 * @returns {Issue[]}
 */
function analyzeDatasetContract(dataset, profile) {
  /** @type {Issue[]} */
  const issues = [];

  if (profile.kind !== 'promotion-only') {
    const metadata =
      dataset &&
      typeof dataset === 'object' &&
      dataset.metadata &&
      typeof dataset.metadata === 'object'
        ? dataset.metadata
        : null;

    if (!metadata || Array.isArray(metadata)) {
      issues.push(
        createIssue({
          type: 'missing-dataset-metadata',
          season: 'dataset',
          message: 'FootballData export is missing the top-level metadata object',
        })
      );
      return issues;
    }

    const missingFields = REQUIRED_DATASET_METADATA_FIELDS.filter(
      (field) => metadata[field] == null
    );
    if (missingFields.length) {
      issues.push(
        createIssue({
          type: 'incomplete-dataset-metadata',
          season: 'dataset',
          message: `Dataset metadata missing required fields: ${missingFields.join(', ')}`,
        })
      );
    }
  }

  return issues;
}

/**
 * @param {string} seasonKey
 * @param {string} tierKey
 * @param {import('../models/output-file.ts').TierData | import('../models/output-file.ts').LeagueTableEntry[]} tierValue
 * @returns {TierAnalysis}
 */
function analyzeTier(seasonKey, tierKey, tierValue) {
  const tierMeta = extractTierMeta(tierValue, seasonKey);
  const tierIssues = [];
  const tierNumberMatch = tierKey.match(/^tier(\d+)$/i);
  const tierNumber = tierNumberMatch ? Number.parseInt(tierNumberMatch[1], 10) : null;

  if (!tierMeta.hasContent) {
    tierIssues.push(
      createIssue({
        type: 'empty-tier',
        season: seasonKey,
        tier: tierKey,
        message: 'Tier has no table rows or outcome lists',
      })
    );
  }

  if (
    tierMeta.seasonNumber != null &&
    tierMeta.seasonNumber !== tierMeta.normalisedSeasonKey &&
    tierMeta.normalisedSeasonKey != null
  ) {
    tierIssues.push(
      createIssue({
        type: 'season-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Tier season (${tierMeta.seasonNumber}) does not match key ${tierMeta.normalisedSeasonKey}`,
      })
    );
  }

  const duplicateTeams = findDuplicates(
    tierMeta.table.map((row) => row.team),
    normalizeName
  );
  if (duplicateTeams.length) {
    tierIssues.push(
      createIssue({
        type: 'duplicate-teams',
        season: seasonKey,
        tier: tierKey,
        message: `Duplicate teams detected: ${duplicateTeams.join(', ')}`,
      })
    );
  }

  const duplicatePositions = findDuplicates(
    tierMeta.table.map((row) => row.pos).filter((pos) => Number.isFinite(pos))
  );
  if (duplicatePositions.length) {
    tierIssues.push(
      createIssue({
        type: 'duplicate-positions',
        season: seasonKey,
        tier: tierKey,
        message: `Duplicate position values detected: ${duplicatePositions.join(', ')}`,
      })
    );
  }

  const missingPositions = findMissingPositions(
    tierMeta.table.map((row) => row.pos).filter((pos) => Number.isFinite(pos))
  );
  if (missingPositions.length) {
    tierIssues.push(
      createIssue({
        type: 'position-gap',
        season: seasonKey,
        tier: tierKey,
        message: `Missing position values detected: ${missingPositions.join(', ')}`,
      })
    );
  }

  if (!isPointsOrderExempt(seasonKey, tierKey)) {
    const tableOrderMismatches = findTableOrderMismatches(tierMeta.table);
    if (tableOrderMismatches.length) {
      tierIssues.push(
        createIssue({
          type: 'table-order-mismatch',
          season: seasonKey,
          tier: tierKey,
          message: `Table rows are not sorted by points: ${tableOrderMismatches.join('; ')}`,
        })
      );
    }
  }

  const statMismatchRows = tierMeta.table
    .filter((row) => Number.isFinite(row.played))
    .filter((row) => row.played !== row.won + row.drawn + row.lost)
    .map((row) => row.team);

  if (statMismatchRows.length) {
    tierIssues.push(
      createIssue({
        type: 'match-count-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Played totals do not equal won+drawn+lost for: ${statMismatchRows.join(', ')}`,
      })
    );
  }

  const goalDiffMismatch = tierMeta.table
    .filter((row) => row.goalDifference != null)
    .filter((row) => row.goalDifference !== row.goalsFor - row.goalsAgainst)
    .map((row) => row.team);

  if (goalDiffMismatch.length) {
    tierIssues.push(
      createIssue({
        type: 'goal-diff-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Goal difference does not equal GF-GA for: ${goalDiffMismatch.join(', ')}`,
      })
    );
  }

  if (tierMeta.hasExplicitPromotedList) {
    const flaggedPromoted = tierMeta.table.filter((row) => row.wasPromoted).map((row) => row.team);
    const missingPromoted = flaggedPromoted.filter(
      (team) => !tierMeta.promoted.some((listed) => namesMatch(listed, team))
    );
    const unknownPromoted = tierMeta.promoted.filter(
      (team) => !tierMeta.table.some((row) => namesMatch(row.team, team))
    );

    if (missingPromoted.length) {
      tierIssues.push(
        createIssue({
          type: 'promoted-mismatch',
          season: seasonKey,
          tier: tierKey,
          message: `Promoted list missing flagged teams: ${missingPromoted.join(', ')}`,
        })
      );
    }
    if (unknownPromoted.length) {
      tierIssues.push(
        createIssue({
          type: 'promoted-unknown',
          season: seasonKey,
          tier: tierKey,
          message: `Promoted list includes teams not in table: ${unknownPromoted.join(', ')}`,
        })
      );
    }
  }

  if (tierMeta.hasExplicitRelegatedList) {
    const flaggedRelegated = tierMeta.table
      .filter((row) => row.wasRelegated)
      .map((row) => row.team);
    const missingRelegated = flaggedRelegated.filter(
      (team) => !tierMeta.relegated.some((listed) => namesMatch(listed, team))
    );
    const unknownRelegated = tierMeta.relegated.filter(
      (team) => !tierMeta.table.some((row) => namesMatch(row.team, team))
    );

    if (missingRelegated.length) {
      tierIssues.push(
        createIssue({
          type: 'relegated-mismatch',
          season: seasonKey,
          tier: tierKey,
          message: `Relegated list missing flagged teams: ${missingRelegated.join(', ')}`,
        })
      );
    }
    if (unknownRelegated.length) {
      tierIssues.push(
        createIssue({
          type: 'relegated-unknown',
          season: seasonKey,
          tier: tierKey,
          message: `Relegated list includes teams not in table: ${unknownRelegated.join(', ')}`,
        })
      );
    }
  }

  if (tierNumber === 1) {
    const promotedFlags = tierMeta.table.filter((row) => row.wasPromoted).map((row) => row.team);
    if (promotedFlags.length) {
      tierIssues.push(
        createIssue({
          type: 'unexpected-top-flight-promotion-flag',
          season: seasonKey,
          tier: tierKey,
          message: `Top-flight rows should not be marked as promoted: ${promotedFlags.join(', ')}`,
        })
      );
    }

    if (tierMeta.promoted.length) {
      tierIssues.push(
        createIssue({
          type: 'unexpected-top-flight-promoted-list',
          season: seasonKey,
          tier: tierKey,
          message: `Top-flight tier should not include promoted teams: ${tierMeta.promoted.join(
            ', '
          )}`,
        })
      );
    }
  }

  return {
    hasContent: tierMeta.hasContent,
    issues: tierIssues,
  };
}

/**
 * @param {import('../models/output-file.ts').TierData | import('../models/output-file.ts').LeagueTableEntry[]} tierValue
 * @param {string} seasonKey
 */
function extractTierMeta(tierValue, seasonKey) {
  const table = Array.isArray(tierValue)
    ? tierValue
    : Array.isArray(tierValue.table)
    ? tierValue.table
    : [];
  const promoted =
    !Array.isArray(tierValue) && Array.isArray(tierValue.promoted) ? tierValue.promoted : [];
  const relegated =
    !Array.isArray(tierValue) && Array.isArray(tierValue.relegated) ? tierValue.relegated : [];
  const hasExplicitPromotedList = !Array.isArray(tierValue) && Array.isArray(tierValue.promoted);
  const hasExplicitRelegatedList = !Array.isArray(tierValue) && Array.isArray(tierValue.relegated);

  const normSeason = parseSeasonNumber(seasonKey);
  const metadata =
    !Array.isArray(tierValue) && tierValue.metadata && typeof tierValue.metadata === 'object'
      ? tierValue.metadata
      : null;

  return {
    table,
    promoted,
    relegated,
    hasExplicitPromotedList,
    hasExplicitRelegatedList,
    hasContent: Boolean(table.length || promoted.length || relegated.length),
    seasonNumber:
      !Array.isArray(tierValue) && typeof tierValue.season === 'number' ? tierValue.season : null,
    normalisedSeasonKey: normSeason,
    metadata,
    rawValue: tierValue,
  };
}

function describeOrderMismatch(previousRow, currentRow) {
  return `${currentRow.team} (${currentRow.points} pts, pos ${currentRow.pos}) should not be below ${previousRow.team} (${previousRow.points} pts, pos ${previousRow.pos})`;
}

function findTableOrderMismatches(table) {
  const mismatches = [];
  for (let index = 1; index < table.length; index += 1) {
    const previousRow = table[index - 1];
    const currentRow = table[index];
    if (
      Number.isFinite(previousRow.points) &&
      Number.isFinite(currentRow.points) &&
      currentRow.points > previousRow.points
    ) {
      mismatches.push(describeOrderMismatch(previousRow, currentRow));
    }
  }
  return mismatches;
}

function isPointsOrderExempt(seasonKey, tierKey) {
  return POINTS_ORDER_EXEMPTIONS.has(`${seasonKey}:${tierKey}`);
}

/**
 * @param {string} seasonKey
 * @param {import('../models/output-file.ts').SeasonData} seasonValue
 * @returns {Issue[]}
 */
function analyzeSeasonContract(seasonKey, seasonValue) {
  /** @type {Issue[]} */
  const issues = [];
  const seasonInfo = seasonValue.seasonInfo;
  const isPlaceholderSeason = isHistoricalPlaceholderSeason(seasonValue, seasonKey);

  if (!seasonInfo || typeof seasonInfo !== 'object' || Array.isArray(seasonInfo)) {
    issues.push(
      createIssue({
        type: 'missing-season-info',
        season: seasonKey,
        message: 'Season record is missing the seasonInfo summary object',
      })
    );
  } else {
    if (!Array.isArray(seasonInfo.table) || seasonInfo.table.length !== 0) {
      issues.push(
        createIssue({
          type: 'unexpected-season-info-table',
          season: seasonKey,
          message: 'seasonInfo.table should be present and empty',
        })
      );
    }

    if (isPlaceholderSeason) {
      const missingPlaceholderFields = ['competitionStatus', 'officialLeagueTables'].filter(
        (field) => seasonInfo[field] == null
      );
      if (missingPlaceholderFields.length) {
        issues.push(
          createIssue({
            type: 'incomplete-placeholder-season-info',
            season: seasonKey,
            message: `Placeholder seasonInfo missing fields: ${missingPlaceholderFields.join(', ')}`,
          })
        );
      }
    }
  }

  if (isPlaceholderSeason) {
    const tierKeys = Object.keys(seasonValue).filter((key) => isTierKey(key));
    if (tierKeys.length) {
      issues.push(
        createIssue({
          type: 'unexpected-placeholder-tier-data',
          season: seasonKey,
          message: `Placeholder season should not contain tier data: ${tierKeys.join(', ')}`,
        })
      );
    }
    return issues;
  }

  for (const [tierKey, tierValue] of Object.entries(seasonValue)) {
    if (!isTierKey(tierKey)) continue;
    if (!tierValue || typeof tierValue !== 'object' || Array.isArray(tierValue)) {
      issues.push(
        createIssue({
          type: 'invalid-tier-shape',
          season: seasonKey,
          tier: tierKey,
          message: 'Tier entries must be object-shaped with table/promoted/relegated fields',
        })
      );
      continue;
    }

    const legacyFields = LEGACY_TIER_METADATA_FIELDS.filter((field) => field in tierValue);
    if (legacyFields.length) {
      issues.push(
        createIssue({
          type: 'legacy-tier-metadata-fields',
          season: seasonKey,
          tier: tierKey,
          message: `Tier still exposes legacy top-level metadata fields: ${legacyFields.join(
            ', '
          )}`,
        })
      );
    }

    const metadata = tierValue.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      issues.push(
        createIssue({
          type: 'missing-tier-metadata',
          season: seasonKey,
          tier: tierKey,
          message: 'Tier is missing the metadata object',
        })
      );
      continue;
    }

    const missingMetadata = REQUIRED_TIER_METADATA_FIELDS.filter(
      (field) => metadata[field] == null
    );
    if (missingMetadata.length) {
      issues.push(
        createIssue({
          type: 'incomplete-tier-metadata',
          season: seasonKey,
          tier: tierKey,
          message: `Tier metadata missing required fields: ${missingMetadata.join(', ')}`,
        })
      );
    }

    if (metadata.tierKey != null && metadata.tierKey !== tierKey) {
      issues.push(
        createIssue({
          type: 'tier-metadata-mismatch',
          season: seasonKey,
          tier: tierKey,
          message: `metadata.tierKey (${metadata.tierKey}) does not match ${tierKey}`,
        })
      );
    }

    if (metadata.source === WIKIPEDIA_DATA_SOURCES.overview.sourceId) {
      const missingOverviewFields = REQUIRED_OVERVIEW_METADATA_FIELDS.filter(
        (field) => metadata[field] == null
      );
      if (missingOverviewFields.length) {
        issues.push(
          createIssue({
            type: 'incomplete-overview-metadata',
            season: seasonKey,
            tier: tierKey,
            message: `Overview tier metadata missing fields: ${missingOverviewFields.join(', ')}`,
          })
        );
      }
    }
  }

  return issues;
}

/**
 * @param {string} seasonKey
 * @param {import('../models/output-file.ts').SeasonData} seasonValue
 * @param {DatasetProfile} profile
 * @returns {Issue[]}
 */
function analyzeSeasonTierCoverage(seasonKey, seasonValue, profile) {
  if (profile.kind === 'promotion-only') return [];
  if (isHistoricalPlaceholderSeason(seasonValue, seasonKey)) return [];

  const seasonNumber = parseSeasonNumber(seasonKey);
  if (seasonNumber == null) return [];

  const tierCount = Object.keys(seasonValue).filter((key) => isTierKey(key)).length;
  const expectedMinimum = getExpectedMinimumTierCount(seasonNumber);
  if (expectedMinimum == null || tierCount >= expectedMinimum) return [];

  return [
    createIssue({
      type: 'insufficient-tier-coverage',
      season: seasonKey,
      message: `Season has ${tierCount} tiers but expected at least ${expectedMinimum} for this era`,
    }),
  ];
}

/**
 * @param {string} seasonKey
 * @param {import('../models/output-file.ts').SeasonData} seasonValue
 * @returns {Issue[]}
 */
function analyzeSeasonLeagueOrdering(seasonKey, seasonValue) {
  if (isHistoricalPlaceholderSeason(seasonValue, seasonKey)) return [];
  const seasonNumber = parseSeasonNumber(seasonKey);
  if (seasonNumber == null) return [];

  /** @type {Issue[]} */
  const issues = [];
  for (const [tierKey, tierValue] of Object.entries(seasonValue)) {
    if (!isTierKey(tierKey)) continue;
    const tierNumberMatch = tierKey.match(/^tier(\d+)$/i);
    const tierNumber = tierNumberMatch ? Number.parseInt(tierNumberMatch[1], 10) : null;
    if (tierNumber == null) continue;

    const metadata =
      tierValue && typeof tierValue === 'object' && !Array.isArray(tierValue)
        ? tierValue.metadata
        : null;
    if (!metadata || metadata.source !== WIKIPEDIA_DATA_SOURCES.overview.sourceId) continue;

    const inferredTier = inferLeagueTierFromMetadata(metadata, seasonNumber);
    const metadataLeagueLevel = Number.parseInt(String(metadata.leagueLevel), 10);
    if (
      inferredTier != null &&
      Number.isFinite(metadataLeagueLevel) &&
      metadataLeagueLevel === inferredTier &&
      metadataLeagueLevel <= tierNumber
    ) {
      continue;
    }
    if (inferredTier == null || inferredTier === tierNumber) continue;

    issues.push(
      createIssue({
        type: 'league-order-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Overview tier title/id looks like level ${inferredTier}, not ${tierKey}`,
      })
    );
  }

  return issues;
}

/**
 * @param {import('../models/output-file.ts').FootballData} dataset
 * @param {DatasetProfile} profile
 * @returns {Issue[]}
 */
function analyzeSeasonContinuity(dataset, profile) {
  /** @type {Issue[]} */
  const issues = [];
  const seasons = Object.keys(dataset.seasons || {})
    .map((seasonKey) => parseSeasonNumber(seasonKey))
    .filter((seasonKey) => seasonKey != null)
    .sort((a, b) => a - b);

  for (const seasonNumber of seasons) {
    if (shouldSkipContinuityForSeason(profile, seasonNumber)) {
      continue;
    }

    const nextSeason = seasonNumber + 1;
    const currentRecord = dataset.seasons[String(seasonNumber)];
    const nextRecord = dataset.seasons[String(nextSeason)];
    if (!currentRecord || !nextRecord) continue;
    if (isHistoricalPlaceholderSeason(currentRecord, String(seasonNumber))) continue;
    if (isHistoricalPlaceholderSeason(nextRecord, String(nextSeason))) continue;

    const currentSeasonInfo = currentRecord.seasonInfo;
    const nextTopFlight = nextRecord[CONTINUITY_CONFIG.topFlightTierKey];
    const nextTopFlightTeams = new Set(
      Array.isArray(nextTopFlight?.table)
        ? nextTopFlight.table.map((row) => normalizeName(row.team))
        : []
    );
    if (!nextTopFlightTeams.size) continue;

    const promoted = Array.isArray(currentSeasonInfo?.[CONTINUITY_CONFIG.seasonPromotedPath])
      ? currentSeasonInfo[CONTINUITY_CONFIG.seasonPromotedPath]
      : [];
    const relegated = Array.isArray(currentSeasonInfo?.[CONTINUITY_CONFIG.seasonRelegatedPath])
      ? currentSeasonInfo[CONTINUITY_CONFIG.seasonRelegatedPath]
      : [];

    const missingPromoted = promoted.filter((team) => !nextTopFlightTeams.has(normalizeName(team)));
    if (missingPromoted.length) {
      issues.push(
        createIssue({
          type: 'promotion-continuity-mismatch',
          season: String(seasonNumber),
          message: `Promoted teams missing from next season top flight (${nextSeason}): ${missingPromoted.join(
            ', '
          )}`,
        })
      );
    }

    const lingeringRelegated = relegated.filter((team) =>
      nextTopFlightTeams.has(normalizeName(team))
    );
    if (lingeringRelegated.length) {
      issues.push(
        createIssue({
          type: 'relegation-continuity-mismatch',
          season: String(seasonNumber),
          message: `Relegated teams still present in next season top flight (${nextSeason}): ${lingeringRelegated.join(
            ', '
          )}`,
        })
      );
    }
  }

  return issues;
}

/**
 * @param {import('../models/output-file.ts').FootballData} dataset
 * @returns {DatasetProfile}
 */
function detectDatasetProfile(dataset) {
  const sources = new Set();

  for (const seasonRecord of Object.values(dataset.seasons || {})) {
    if (!seasonRecord || typeof seasonRecord !== 'object') continue;

    for (const [key, tierValue] of Object.entries(seasonRecord)) {
      if (!isTierKey(key)) continue;
      const source = tierValue?.metadata?.source;
      if (typeof source === 'string' && source.length) {
        sources.add(source);
      }
    }
  }

  if (sources.size === 1 && sources.has(WIKIPEDIA_DATA_SOURCES.promotion.sourceId)) {
    return { kind: 'promotion-only' };
  }
  if (sources.size === 1 && sources.has(WIKIPEDIA_DATA_SOURCES.overview.sourceId)) {
    return { kind: 'overview-only' };
  }
  return { kind: 'mixed' };
}

/**
 * @param {IssueInput} input
 * @returns {Issue}
 */
function createIssue(input) {
  return {
    season: input.season,
    tier: input.tier,
    type: input.type,
    message: input.message,
  };
}

/**
 * @param {number | string | null | undefined} value
 */
function normalizeName(value) {
  return typeof value === 'string' ? canonicalizeTeamName(value) : value;
}

/**
 * @template T
 * @param {T[]} values
 * @param {(value: T) => string | number | null | undefined} [normalizer]
 * @returns {Array<string | number>}
 */
function findDuplicates(values, normalizer) {
  const counts = new Map();
  const originals = new Map();

  for (const value of values) {
    const key = normalizer ? normalizer(value) : value;
    if (key == null && key !== 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!originals.has(key)) {
      originals.set(key, value);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => originals.get(key));
}

/**
 * @param {number[]} positions
 * @returns {number[]}
 */
function findMissingPositions(positions) {
  if (!positions.length) return [];
  const uniquePositions = Array.from(new Set(positions)).sort((a, b) => a - b);
  if (uniquePositions[0] !== 1) {
    return [1];
  }

  const missing = [];
  for (let index = 1; index < uniquePositions.length; index += 1) {
    const previous = uniquePositions[index - 1];
    const current = uniquePositions[index];
    for (let value = previous + 1; value < current; value += 1) {
      missing.push(value);
    }
  }
  return missing;
}

/**
 * @param {string} a
 * @param {string} b
 */
function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

/**
 * @param {FileReport} report
 */
export function printReport(report) {
  const relativePath = path.relative(process.cwd(), report.filePath);
  console.log(`\n${relativePath}`);
  console.log(`  Seasons scanned: ${report.seasonCount}`);

  if (!report.issues.length) {
    console.log('  No issues detected ✅');
    return;
  }

  console.log(`  Issues found: ${report.issues.length}`);
  for (const issue of report.issues) {
    const tierLabel = issue.tier ? ` ${issue.tier}` : '';
    console.log(`    [${issue.type}] ${issue.season}${tierLabel} – ${issue.message}`);
  }
}

/**
 * @typedef {Object} FileReport
 * @property {string} filePath
 * @property {number} seasonCount
 * @property {Issue[]} issues
 *
 * @typedef {Object} Issue
 * @property {string} season
 * @property {string} [tier]
 * @property {string} type
 * @property {string} message
 *
 * @typedef {Object} TierAnalysis
 * @property {boolean} hasContent
 * @property {Issue[]} issues
 *
 * @typedef {Object} IssueInput
 * @property {string} season
 * @property {string} [tier]
 * @property {string} type
 * @property {string} message
 *
 * @typedef {{ kind: 'promotion-only' | 'overview-only' | 'mixed' }} DatasetProfile
 */

export function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name('verify-football-data')
    .description('Scan FootballData JSON files for seasons and tiers that may need attention.')
    .argument(
      '[targets...]',
      'JSON files or directories containing FootballData exports (defaults to ./data-output)'
    )
    .option(
      '-d, --data-dir <dir>',
      'Directory to scan when no targets are supplied',
      './data-output'
    )
    .option('--fail-on-issues', 'Exit with code 1 if any issues are detected', false)
    .parse(argv);

  const options = program.opts();
  const suppliedTargets = program.args.length ? program.args : [options.dataDir];

  const filesToCheck = expandTargets(suppliedTargets);
  if (!filesToCheck.length) {
    program.error('No JSON files found to inspect.');
  }

  let totalIssues = 0;
  for (const filePath of filesToCheck) {
    const report = analyzeFile(filePath);
    totalIssues += report.issues.length;
    printReport(report);
  }

  if (options.failOnIssues && totalIssues > 0) {
    process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}
