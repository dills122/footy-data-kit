#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWikipediaLeagueLevelRule,
  WIKIPEDIA_DATA_SOURCES,
  WIKIPEDIA_SEASON_RANGES,
} from '../config.js';
import { deriveOutcomeStatus, wasReprieved } from '../utils.js';
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
const REQUIRED_PARALLEL_PARENT_METADATA_FIELDS = [
  'leagueLevel',
  'parallelGroup',
  'divisionCount',
  'tableCount',
];
const REQUIRED_DATASET_METADATA_FIELDS = ['schemaVersion', 'generator', 'generatedAt'];
const POINTS_ORDER_EXEMPTIONS = new Set([
  // 2019-20 curtailed leagues were finalized by points per game.
  '2019:tier3',
  '2019:tier4',
  '2019:tier5',
  '2019:tier6',
  // 2025-26 League One currently has a source-order anomaly in the relegation rows.
  '2025:tier3',
]);
const CONTINUITY_CONFIG = {
  topFlightTierKey: 'tier1',
  seasonPromotedPath: 'promoted',
  seasonRelegatedPath: 'relegated',
};
const LOWER_TIER_CONTRACT_START_SEASON = 1979;
const LOWER_TIER_FULL_EXPORT_MIN_SEASONS = 100;
const LOWER_TIER_MIN_TABLE_ROWS = 18;
const LOWER_TIER_CONTRACTS = Object.freeze([
  Object.freeze({
    startSeason: 1979,
    endSeason: 1981,
    parallelGroup: 'pre-2004-conference-feeders',
    divisionKeys: Object.freeze([
      'northern-premier',
      'southern-midland',
      'southern-southern',
      'isthmian-premier',
    ]),
  }),
  Object.freeze({
    startSeason: 1982,
    endSeason: 2003,
    parallelGroup: 'pre-2004-conference-feeders',
    divisionKeys: Object.freeze(['northern-premier', 'southern-premier', 'isthmian-premier']),
  }),
  Object.freeze({
    startSeason: 2004,
    endSeason: 2014,
    parallelGroup: 'conference-north-south',
    divisionKeys: Object.freeze(['north', 'south']),
  }),
  Object.freeze({
    startSeason: 2015,
    parallelGroup: 'national-league-north-south',
    divisionKeys: Object.freeze(['north', 'south']),
  }),
]);

/**
 * @param {string[]} targets
 */
export function expandTargets(targets) {
  /** @type {string[]} */
  const files = [];
  const seen = new Set();

  const addFile = (resolved, forceInclude = false) => {
    if (!resolved.toLowerCase().endsWith('.json')) return;
    if (!forceInclude && !isFootballDataJsonFile(resolved)) return;
    if (!seen.has(resolved)) {
      files.push(resolved);
      seen.add(resolved);
    }
  };

  const visitDirectory = (resolved) => {
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(resolved)) {
        visitDirectory(path.join(resolved, entry));
      }
      return;
    }

    if (stats.isFile()) {
      addFile(resolved);
    }
  };

  for (const target of targets) {
    const resolved = path.resolve(process.cwd(), target);
    if (!fs.existsSync(resolved)) {
      console.warn(`Skipping missing path: ${target}`);
      continue;
    }

    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      visitDirectory(resolved);
    } else if (stats.isFile()) {
      addFile(resolved, true);
    }
  }

  return files.sort();
}

/**
 * @param {string} filePath
 */
export function analyzeFile(filePath) {
  const rawDataset = readJson(filePath);
  if (!isFootballDataExport(rawDataset)) {
    return {
      filePath,
      seasonCount: 0,
      issues: [
        createIssue({
          type: 'invalid-football-data-export',
          season: 'dataset',
          message: 'JSON file is missing a top-level seasons object',
        }),
      ],
    };
  }

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
 * @param {string} filePath
 * @returns {unknown}
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {unknown} value
 * @returns {value is import('../models/output-file.ts').FootballData}
 */
export function isFootballDataExport(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.hasOwn(value, 'seasons') &&
      value.seasons &&
      typeof value.seasons === 'object' &&
      !Array.isArray(value.seasons)
  );
}

/**
 * @param {string} filePath
 */
export function isFootballDataJsonFile(filePath) {
  if (!filePath.toLowerCase().endsWith('.json')) return false;

  try {
    return isFootballDataExport(readJson(filePath));
  } catch {
    return false;
  }
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
    issues.push(...analyzeRestructurePlacementSemantics(seasonKey, seasonValue));
    issues.push(...analyzeAdministrativeOutcomeSemantics(seasonKey, seasonValue));
    for (const tierAnalysis of tierAnalyses) {
      issues.push(...tierAnalysis.issues);
    }
  }

  if (shouldAnalyzeLowerTierCoverageContract(seasonEntries, profile, options)) {
    issues.push(...analyzeLowerTierCoverageContract(dataset, seasonEntries));
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

  const duplicatePositions = tierMeta.tableSegments.flatMap((segment) =>
    findDuplicates(segment.rows.map((row) => row.pos).filter((pos) => Number.isFinite(pos))).map(
      (position) => formatSegmentValue(segment.label, position)
    )
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

  const missingPositions = tierMeta.tableSegments.flatMap((segment) =>
    findMissingPositions(
      segment.rows.map((row) => row.pos).filter((pos) => Number.isFinite(pos))
    ).map((position) => formatSegmentValue(segment.label, position))
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
    const tableOrderMismatches = tierMeta.tableSegments.flatMap((segment) =>
      findTableOrderMismatches(segment.rows).map((message) =>
        segment.label ? `${segment.label}: ${message}` : message
      )
    );
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

  const missingReprievedFlags = tierMeta.table
    .filter((row) => wasReprieved(row.notes) && row.wasReprieved !== true)
    .map((row) => row.team);

  if (missingReprievedFlags.length) {
    tierIssues.push(
      createIssue({
        type: 'reprieved-flag-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Rows with reprieve notes should set wasReprieved: ${missingReprievedFlags.join(
          ', '
        )}`,
      })
    );
  }

  const outcomeStatusMismatches = tierMeta.table
    .map((row) => ({
      team: row.team,
      expected: deriveOutcomeStatus(row.notes),
      actual: row.outcomeStatus ?? null,
    }))
    .filter((row) => row.expected != null && row.actual !== row.expected);

  if (outcomeStatusMismatches.length) {
    tierIssues.push(
      createIssue({
        type: 'outcome-status-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Rows with administrative notes should publish matching outcomeStatus: ${outcomeStatusMismatches
          .map((row) => `${row.team} expected ${row.expected}`)
          .join(', ')}`,
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
  const tableSegments = extractTierTableSegments(tierValue);
  const table = tableSegments.flatMap((segment) => segment.rows);
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
    tableSegments,
  };
}

function extractTierTableSegments(tierValue) {
  if (Array.isArray(tierValue)) {
    return [{ label: null, rows: tierValue }];
  }

  if (!tierValue || typeof tierValue !== 'object') {
    return [];
  }

  if (Array.isArray(tierValue.divisions) && tierValue.divisions.length) {
    return tierValue.divisions
      .map((division, index) => {
        const label =
          division?.metadata?.divisionKey ||
          division?.metadata?.title ||
          division?.metadata?.leagueId ||
          `division-${index + 1}`;
        return {
          label,
          rows: Array.isArray(division?.table) ? division.table : [],
        };
      })
      .filter((segment) => segment.rows.length);
  }

  return Array.isArray(tierValue.table) ? [{ label: null, rows: tierValue.table }] : [];
}

function formatSegmentValue(label, value) {
  return label ? `${label}:${value}` : value;
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

function hasLeagueStructureSpecialCase(seasonValue, type, tierKeys = []) {
  const specialCases = seasonValue?.seasonInfo?.leagueStructureSpecialCases;
  if (!Array.isArray(specialCases)) return false;

  return specialCases.some((specialCase) => {
    if (!specialCase || typeof specialCase !== 'object' || specialCase.type !== type) return false;
    if (!tierKeys.length) return true;
    return (
      Array.isArray(specialCase.tierKeys) &&
      tierKeys.every((tierKey) => specialCase.tierKeys.includes(tierKey))
    );
  });
}

function isFourthDivisionPlacementRow(row) {
  return row && typeof row === 'object' && /\bfourth division\b/i.test(String(row.notes || ''));
}

/**
 * @param {string} seasonKey
 * @param {import('../models/output-file.ts').SeasonData} seasonValue
 * @returns {Issue[]}
 */
function analyzeRestructurePlacementSemantics(seasonKey, seasonValue) {
  const seasonNumber = parseSeasonNumber(seasonKey);
  if (seasonNumber !== WIKIPEDIA_SEASON_RANGES.regionalThirdDivisionFinalSeason) return [];
  if (!hasLeagueStructureSpecialCase(seasonValue, 'restructure-placement', ['tier3', 'tier4'])) {
    return [];
  }

  /** @type {Issue[]} */
  const issues = [];
  const tier3 = seasonValue.tier3;
  if (!tier3 || typeof tier3 !== 'object' || Array.isArray(tier3)) return issues;

  const placementRows = extractTierTableSegments(tier3)
    .flatMap((segment) => segment.rows)
    .filter(isFourthDivisionPlacementRow);
  const flaggedPlacementRows = placementRows
    .filter((row) => row.wasRelegated === true)
    .map((row) => row.team)
    .filter(Boolean);

  if (flaggedPlacementRows.length) {
    issues.push(
      createIssue({
        type: 'restructure-placement-relegation-flag',
        season: seasonKey,
        tier: 'tier3',
        message: `Fourth Division restructure placement rows should not be flagged as ordinary relegation: ${flaggedPlacementRows.join(
          ', '
        )}`,
      })
    );
  }

  const listedRelegated = new Set([
    ...(Array.isArray(tier3.relegated) ? tier3.relegated : []),
    ...(Array.isArray(tier3.divisions)
      ? tier3.divisions.flatMap((division) =>
          Array.isArray(division?.relegated) ? division.relegated : []
        )
      : []),
  ]);
  const listedPlacementRows = placementRows
    .filter((row) => listedRelegated.has(row.team))
    .map((row) => row.team)
    .filter(Boolean);

  if (listedPlacementRows.length) {
    issues.push(
      createIssue({
        type: 'restructure-placement-relegated-list',
        season: seasonKey,
        tier: 'tier3',
        message: `Fourth Division restructure placement rows should not appear in ordinary relegated lists: ${listedPlacementRows.join(
          ', '
        )}`,
      })
    );
  }

  return issues;
}

function getTierRows(tierValue) {
  return extractTierTableSegments(tierValue).flatMap((segment) => segment.rows);
}

function findTierRowByTeam(tierValue, teamName) {
  return getTierRows(tierValue).find((row) => namesMatch(row.team, teamName)) || null;
}

function expectAdministrativeRow({
  issues,
  seasonKey,
  tierKey,
  tierValue,
  team,
  outcomeStatus,
  wasRelegated,
  listedInRelegated,
}) {
  if (!tierValue || typeof tierValue !== 'object' || Array.isArray(tierValue)) return;

  const row = findTierRowByTeam(tierValue, team);
  if (!row) return;

  const mismatches = [];
  if ((row.outcomeStatus ?? null) !== outcomeStatus) {
    mismatches.push(`outcomeStatus expected ${outcomeStatus}`);
  }
  if (row.wasRelegated !== wasRelegated) {
    mismatches.push(`wasRelegated expected ${wasRelegated}`);
  }

  const relegatedList = Array.isArray(tierValue.relegated) ? tierValue.relegated : [];
  const isListed = relegatedList.some((entry) => namesMatch(entry, team));
  if (isListed !== listedInRelegated) {
    mismatches.push(`relegated list membership expected ${listedInRelegated}`);
  }

  if (mismatches.length) {
    issues.push(
      createIssue({
        type: 'administrative-outcome-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `${team} administrative outcome mismatch: ${mismatches.join(', ')}`,
      })
    );
  }
}

/**
 * @param {string} seasonKey
 * @param {import('../models/output-file.ts').SeasonData} seasonValue
 * @returns {Issue[]}
 */
function analyzeAdministrativeOutcomeSemantics(seasonKey, seasonValue) {
  if (parseSeasonNumber(seasonKey) !== 2019) return [];
  if (!hasLeagueStructureSpecialCase(seasonValue, 'administrative-outcome', ['tier3', 'tier4'])) {
    return [];
  }

  /** @type {Issue[]} */
  const issues = [];
  expectAdministrativeRow({
    issues,
    seasonKey,
    tierKey: 'tier3',
    tierValue: seasonValue.tier3,
    team: 'Bury',
    outcomeStatus: 'expelled',
    wasRelegated: false,
    listedInRelegated: false,
  });
  expectAdministrativeRow({
    issues,
    seasonKey,
    tierKey: 'tier4',
    tierValue: seasonValue.tier4,
    team: 'Stevenage',
    outcomeStatus: 'reprieved',
    wasRelegated: false,
    listedInRelegated: false,
  });
  expectAdministrativeRow({
    issues,
    seasonKey,
    tierKey: 'tier4',
    tierValue: seasonValue.tier4,
    team: 'Macclesfield Town',
    outcomeStatus: 'relegated-after-points-deduction',
    wasRelegated: true,
    listedInRelegated: true,
  });

  return issues;
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

    issues.push(...analyzeTierMetadata(seasonKey, tierKey, metadata, tierKey));

    if (Array.isArray(tierValue.divisions)) {
      tierValue.divisions.forEach((division, index) => {
        const divisionMetadata =
          division && typeof division === 'object' && !Array.isArray(division)
            ? division.metadata
            : null;
        if (!divisionMetadata || typeof divisionMetadata !== 'object') {
          issues.push(
            createIssue({
              type: 'missing-tier-metadata',
              season: seasonKey,
              tier: `${tierKey}:division-${index + 1}`,
              message: 'Tier division is missing the metadata object',
            })
          );
          return;
        }

        const divisionLabel =
          divisionMetadata.divisionKey || divisionMetadata.title || `division-${index + 1}`;
        issues.push(
          ...analyzeTierMetadata(
            seasonKey,
            `${tierKey}:${divisionLabel}`,
            divisionMetadata,
            tierKey
          )
        );
      });
    }
  }

  return issues;
}

function analyzeTierMetadata(seasonKey, tierLabel, metadata, expectedTierKey) {
  const issues = [];
  const missingMetadata = REQUIRED_TIER_METADATA_FIELDS.filter((field) => metadata[field] == null);
  if (missingMetadata.length) {
    issues.push(
      createIssue({
        type: 'incomplete-tier-metadata',
        season: seasonKey,
        tier: tierLabel,
        message: `Tier metadata missing required fields: ${missingMetadata.join(', ')}`,
      })
    );
  }

  if (metadata.tierKey != null && metadata.tierKey !== expectedTierKey) {
    issues.push(
      createIssue({
        type: 'tier-metadata-mismatch',
        season: seasonKey,
        tier: tierLabel,
        message: `metadata.tierKey (${metadata.tierKey}) does not match ${expectedTierKey}`,
      })
    );
  }

  if (metadata.source === WIKIPEDIA_DATA_SOURCES.overview.sourceId) {
    const requiredFields =
      metadata.structure === 'parallel-leagues'
        ? REQUIRED_PARALLEL_PARENT_METADATA_FIELDS
        : REQUIRED_OVERVIEW_METADATA_FIELDS;
    const missingOverviewFields = requiredFields.filter((field) => metadata[field] == null);
    if (missingOverviewFields.length) {
      issues.push(
        createIssue({
          type: 'incomplete-overview-metadata',
          season: seasonKey,
          tier: tierLabel,
          message: `Overview tier metadata missing fields: ${missingOverviewFields.join(', ')}`,
        })
      );
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
    if (isKnownParallelLeagueSlot(metadata, seasonNumber, inferredTier, tierNumber)) continue;

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

function isKnownParallelLeagueSlot(metadata, seasonNumber, inferredTier, tierNumber) {
  if (inferredTier == null || inferredTier >= tierNumber) return false;

  const configuredRule = getWikipediaLeagueLevelRule(
    `${metadata?.title || ''} ${metadata?.leagueId || ''}`,
    seasonNumber
  );
  if (configuredRule?.parallelGroup) return true;

  const tableIndex = Number(metadata?.tableIndex);
  const leagueId = String(metadata?.leagueId || '');
  return seasonNumber >= 2021 && leagueId === 'National_League' && tableIndex > 0;
}

/**
 * @param {Array<[string, import('../models/output-file.ts').SeasonData]>} seasonEntries
 * @param {DatasetProfile} profile
 * @param {{ enforceLowerTierCoverage?: boolean }} options
 */
function shouldAnalyzeLowerTierCoverageContract(seasonEntries, profile, options) {
  if (profile.kind === 'promotion-only') return false;
  if (options.enforceLowerTierCoverage === true) return true;
  if (options.enforceLowerTierCoverage === false) return false;

  const seasonNumbers = seasonEntries
    .map(([seasonKey]) => parseSeasonNumber(seasonKey))
    .filter((seasonNumber) => seasonNumber != null);

  return (
    seasonEntries.length >= LOWER_TIER_FULL_EXPORT_MIN_SEASONS &&
    seasonNumbers.includes(LOWER_TIER_CONTRACT_START_SEASON)
  );
}

/**
 * @param {import('../models/output-file.ts').FootballData} dataset
 * @param {Array<[string, import('../models/output-file.ts').SeasonData]>} seasonEntries
 * @returns {Issue[]}
 */
function analyzeLowerTierCoverageContract(_dataset, seasonEntries) {
  /** @type {Issue[]} */
  const issues = [];

  for (const [seasonKey, seasonValue] of seasonEntries) {
    if (isHistoricalPlaceholderSeason(seasonValue, seasonKey)) continue;

    const seasonNumber = parseSeasonNumber(seasonKey);
    if (seasonNumber == null || seasonNumber < LOWER_TIER_CONTRACT_START_SEASON) continue;

    issues.push(...analyzeTierFiveContract(seasonKey, seasonValue.tier5));
    issues.push(...analyzeTierSixContract(seasonKey, seasonNumber, seasonValue.tier6));
  }

  return issues;
}

function analyzeTierFiveContract(seasonKey, tierValue) {
  /** @type {Issue[]} */
  const issues = [];
  if (!tierValue || typeof tierValue !== 'object' || Array.isArray(tierValue)) {
    return [
      createIssue({
        type: 'missing-lower-tier-coverage',
        season: seasonKey,
        tier: 'tier5',
        message: 'Expected tier5 National League System coverage for this season',
      }),
    ];
  }

  const rows = getTierRows(tierValue);
  if (rows.length < LOWER_TIER_MIN_TABLE_ROWS) {
    issues.push(
      createIssue({
        type: 'lower-tier-row-count-mismatch',
        season: seasonKey,
        tier: 'tier5',
        message: `Expected tier5 to contain a full league table, found ${rows.length} rows`,
      })
    );
  }

  issues.push(...analyzeLowerTierMetadataContract(seasonKey, 'tier5', tierValue.metadata, 5));
  return issues;
}

function analyzeTierSixContract(seasonKey, seasonNumber, tierValue) {
  /** @type {Issue[]} */
  const issues = [];
  const contract = getTierSixContract(seasonNumber);

  if (!tierValue || typeof tierValue !== 'object' || Array.isArray(tierValue)) {
    return [
      createIssue({
        type: 'missing-lower-tier-coverage',
        season: seasonKey,
        tier: 'tier6',
        message: 'Expected tier6 parallel lower-tier coverage for this season',
      }),
    ];
  }

  issues.push(...analyzeLowerTierMetadataContract(seasonKey, 'tier6', tierValue.metadata, 6));

  const metadata = tierValue.metadata || {};
  if (metadata.structure !== 'parallel-leagues') {
    issues.push(
      createIssue({
        type: 'lower-tier-structure-mismatch',
        season: seasonKey,
        tier: 'tier6',
        message: 'Expected tier6 to use metadata.structure "parallel-leagues"',
      })
    );
  }

  if (contract && metadata.parallelGroup !== contract.parallelGroup) {
    issues.push(
      createIssue({
        type: 'lower-tier-parallel-group-mismatch',
        season: seasonKey,
        tier: 'tier6',
        message: `Expected tier6 parallelGroup ${contract.parallelGroup}, found ${
          metadata.parallelGroup || 'missing'
        }`,
      })
    );
  }

  const divisions = Array.isArray(tierValue.divisions) ? tierValue.divisions : [];
  if (!divisions.length) {
    issues.push(
      createIssue({
        type: 'missing-lower-tier-divisions',
        season: seasonKey,
        tier: 'tier6',
        message: 'Expected tier6.divisions[] to contain parallel league tables',
      })
    );
    return issues;
  }

  if (metadata.divisionCount != null && Number(metadata.divisionCount) !== divisions.length) {
    issues.push(
      createIssue({
        type: 'lower-tier-division-count-mismatch',
        season: seasonKey,
        tier: 'tier6',
        message: `metadata.divisionCount (${metadata.divisionCount}) does not match divisions length (${divisions.length})`,
      })
    );
  }

  if (contract) {
    const actualDivisionKeys = divisions.map((division) => division?.metadata?.divisionKey);
    const missingDivisionKeys = contract.divisionKeys.filter(
      (divisionKey) => !actualDivisionKeys.includes(divisionKey)
    );
    const unexpectedDivisionKeys = actualDivisionKeys.filter(
      (divisionKey) => divisionKey && !contract.divisionKeys.includes(divisionKey)
    );

    if (missingDivisionKeys.length || unexpectedDivisionKeys.length) {
      issues.push(
        createIssue({
          type: 'lower-tier-division-key-mismatch',
          season: seasonKey,
          tier: 'tier6',
          message: `Expected tier6 divisions ${contract.divisionKeys.join(', ')}; missing ${
            missingDivisionKeys.join(', ') || 'none'
          }; unexpected ${unexpectedDivisionKeys.join(', ') || 'none'}`,
        })
      );
    }
  }

  divisions.forEach((division, index) => {
    const divisionKey = division?.metadata?.divisionKey || `division-${index + 1}`;
    const tierLabel = `tier6:${divisionKey}`;
    issues.push(...analyzeLowerTierMetadataContract(seasonKey, tierLabel, division?.metadata, 6));

    const rows = getTierRows(division);
    if (rows.length < LOWER_TIER_MIN_TABLE_ROWS) {
      issues.push(
        createIssue({
          type: 'lower-tier-row-count-mismatch',
          season: seasonKey,
          tier: tierLabel,
          message: `Expected ${tierLabel} to contain a full league table, found ${rows.length} rows`,
        })
      );
    }
  });

  return issues;
}

function getTierSixContract(seasonNumber) {
  return (
    LOWER_TIER_CONTRACTS.find((contract) => {
      if (seasonNumber < contract.startSeason) return false;
      return contract.endSeason == null || seasonNumber <= contract.endSeason;
    }) || null
  );
}

function analyzeLowerTierMetadataContract(seasonKey, tierLabel, metadata, expectedLeagueLevel) {
  /** @type {Issue[]} */
  const issues = [];

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [
      createIssue({
        type: 'missing-lower-tier-metadata',
        season: seasonKey,
        tier: tierLabel,
        message: 'Expected lower-tier metadata to describe source, tier key, and league level',
      }),
    ];
  }

  const expectedTierKey = tierLabel.startsWith('tier5') ? 'tier5' : 'tier6';
  if (metadata.tierKey !== expectedTierKey) {
    issues.push(
      createIssue({
        type: 'lower-tier-metadata-mismatch',
        season: seasonKey,
        tier: tierLabel,
        message: `Expected metadata.tierKey ${expectedTierKey}, found ${
          metadata.tierKey || 'missing'
        }`,
      })
    );
  }

  if (Number(metadata.leagueLevel) !== expectedLeagueLevel) {
    issues.push(
      createIssue({
        type: 'lower-tier-level-mismatch',
        season: seasonKey,
        tier: tierLabel,
        message: `Expected leagueLevel ${expectedLeagueLevel}, found ${
          metadata.leagueLevel || 'missing'
        }`,
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
