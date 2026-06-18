// @ts-check

import {
  getWikipediaWarSuspensionLabel,
  inferEnglishLeagueTier,
  isWikipediaWarSuspensionYear,
  WIKIPEDIA_DATA_SOURCES,
  WIKIPEDIA_HISTORICAL_PLACEHOLDER_SEASONS,
  WIKIPEDIA_MINIMUM_TIER_OVERRIDES,
  WIKIPEDIA_OVERVIEW_SEASON_OUTCOME_OVERRIDES,
  WIKIPEDIA_SEASON_RANGES,
} from '../config.js';
import { canonicalizeTeamName } from './data-quality-config.js';

export const TIER_KEY_PATTERN = /^tier(\d+)$/i;
export const HISTORICAL_PLACEHOLDER_STATUSES = Object.freeze([
  'wartime-special',
  'abandoned-season',
  'regional-bridge-season',
]);

const EMPTY_LIST = Object.freeze([]);
const TIER_RESERVED_KEYS = new Set(['season', 'table', 'promoted', 'relegated']);
const HISTORICAL_STATUS_DEFAULTS = Object.freeze({
  'wartime-special': Object.freeze({
    officialCompetitionsSuspended: true,
  }),
  'abandoned-season': Object.freeze({
    officialCompetitionsAbandoned: true,
  }),
  'regional-bridge-season': Object.freeze({
    regionalBridgeSeason: true,
    promotionRelegationApplies: false,
  }),
});

export function isTierKey(value) {
  return TIER_KEY_PATTERN.test(value);
}

export function getTierKeys(record) {
  if (!record || typeof record !== 'object') return [];
  return Object.keys(record).filter((key) => isTierKey(key));
}

export function compareSeasonKeys(seasonA, seasonB) {
  const numA = parseSeasonNumber(seasonA);
  const numB = parseSeasonNumber(seasonB);
  if (numA != null && numB != null) {
    return numA - numB;
  }
  return String(seasonA).localeCompare(String(seasonB));
}

export function sortSeasonKeys(values) {
  return [...values].sort((a, b) => compareSeasonKeys(a, b));
}

const CONTINUITY_CONFIG = {
  topFlightTierKey: 'tier1',
  seasonPromotedPath: 'promoted',
  seasonRelegatedPath: 'relegated',
};

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getConfiguredHistoricalSeason(seasonKey) {
  const seasonNumber = parseSeasonNumber(seasonKey);
  if (seasonNumber == null) return null;
  return WIKIPEDIA_HISTORICAL_PLACEHOLDER_SEASONS[seasonNumber] || null;
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => (value == null ? null : String(value).trim()))
        .filter(Boolean)
    )
  );
}

function resolveBooleanSetting(optionValue, configuredValue, fallbackValue = null) {
  if (typeof optionValue === 'boolean') return optionValue;
  if (typeof configuredValue === 'boolean') return configuredValue;
  return fallbackValue;
}

function resolveHistoricalStatusDefaults(status) {
  return HISTORICAL_STATUS_DEFAULTS[status] || null;
}

function hasMetadataEntries(value) {
  return isObjectRecord(value) && Object.keys(value).length > 0;
}

function getCanonicalTeamSet(table) {
  return new Set(table.map((row) => canonicalizeTeamName(row.team)));
}

export function parseSeasonNumber(value) {
  const numeric = Number.parseInt(String(value), 10);
  return Number.isFinite(numeric) ? numeric : null;
}

export function extractSeasonKeyFromSlug(slug) {
  if (!slug) return null;
  const match = String(slug).match(/\d{4}/);
  return match ? match[0] : String(slug);
}

export function extractSeasonYearFromSlug(slug) {
  const key = extractSeasonKeyFromSlug(slug);
  return parseSeasonNumber(key);
}

export function isWarSuspensionSeason(seasonKey) {
  const numeric = parseSeasonNumber(seasonKey);
  return numeric == null ? false : isWikipediaWarSuspensionYear(numeric);
}

export function getHistoricalSeasonStatus(seasonKey) {
  return getConfiguredHistoricalSeason(seasonKey)?.competitionStatus || null;
}

export function isHistoricalPlaceholderStatus(status) {
  return HISTORICAL_PLACEHOLDER_STATUSES.includes(String(status || ''));
}

export function getSeasonCompetitionStatus(seasonRecord, _seasonKey) {
  const explicitStatus = seasonRecord?.seasonInfo?.competitionStatus;
  if (isHistoricalPlaceholderStatus(explicitStatus)) {
    return explicitStatus;
  }
  return null;
}

export function isHistoricalPlaceholderSeason(seasonRecord, seasonKey) {
  return isHistoricalPlaceholderStatus(getSeasonCompetitionStatus(seasonRecord, seasonKey));
}

export function buildHistoricalPlaceholderSeasonInfo(seasonKey, options = {}) {
  const seasonNumber = parseSeasonNumber(seasonKey);
  const configuredSeason = getConfiguredHistoricalSeason(seasonKey);
  const competitionStatus = options.competitionStatus || getHistoricalSeasonStatus(seasonKey);
  const statusDefaults = resolveHistoricalStatusDefaults(competitionStatus);
  const warSuspensionLabel =
    options.warSuspensionLabel ||
    configuredSeason?.warSuspensionLabel ||
    (seasonNumber != null ? getWikipediaWarSuspensionLabel(seasonNumber) : null);
  const specialCompetitions = Array.isArray(options.specialCompetitions)
    ? normalizeStringList(options.specialCompetitions)
    : normalizeStringList(configuredSeason?.specialCompetitions || EMPTY_LIST);

  return {
    season: seasonNumber ?? 0,
    promoted: [],
    relegated: [],
    competitionStatus: competitionStatus || null,
    warSuspensionLabel: warSuspensionLabel || null,
    officialLeagueTables: resolveBooleanSetting(
      options.officialLeagueTables,
      configuredSeason?.officialLeagueTables,
      false
    ),
    officialCompetitionsSuspended: resolveBooleanSetting(
      options.officialCompetitionsSuspended,
      configuredSeason?.officialCompetitionsSuspended,
      statusDefaults?.officialCompetitionsSuspended ?? null
    ),
    officialCompetitionsAbandoned: resolveBooleanSetting(
      options.officialCompetitionsAbandoned,
      configuredSeason?.officialCompetitionsAbandoned,
      statusDefaults?.officialCompetitionsAbandoned ?? null
    ),
    regionalBridgeSeason: resolveBooleanSetting(
      options.regionalBridgeSeason,
      configuredSeason?.regionalBridgeSeason,
      statusDefaults?.regionalBridgeSeason ?? null
    ),
    promotionRelegationApplies: resolveBooleanSetting(
      options.promotionRelegationApplies,
      configuredSeason?.promotionRelegationApplies,
      statusDefaults?.promotionRelegationApplies ?? null
    ),
    specialCompetitions,
    notes:
      options.notes != null
        ? String(options.notes)
        : configuredSeason?.notes != null
        ? String(configuredSeason.notes)
        : null,
  };
}

export function getTierTable(tierValue) {
  if (Array.isArray(tierValue)) {
    return tierValue;
  }
  if (tierValue && typeof tierValue === 'object' && Array.isArray(tierValue.table)) {
    return tierValue.table;
  }
  return [];
}

export function getTierSource(tierValue) {
  if (!isObjectRecord(tierValue)) {
    return null;
  }
  return typeof tierValue.metadata?.source === 'string' ? tierValue.metadata.source : null;
}

export function getTierOutcomeCount(tierValue) {
  if (!isObjectRecord(tierValue)) {
    return 0;
  }
  const promoted = Array.isArray(tierValue.promoted) ? tierValue.promoted.length : 0;
  const relegated = Array.isArray(tierValue.relegated) ? tierValue.relegated.length : 0;
  return promoted + relegated;
}

export function getTierMetadataCount(tierValue) {
  if (!isObjectRecord(tierValue)) {
    return 0;
  }

  return Object.entries(tierValue).filter(([key, value]) => {
    if (TIER_RESERVED_KEYS.has(key)) return false;
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return hasMetadataEntries(value);
    return true;
  }).length;
}

export function compareTierRichness(existingTier, incomingTier) {
  const existingTable = getTierTable(existingTier);
  const incomingTable = getTierTable(incomingTier);
  if (incomingTable.length !== existingTable.length) {
    return incomingTable.length - existingTable.length;
  }

  const existingOutcomes = getTierOutcomeCount(existingTier);
  const incomingOutcomes = getTierOutcomeCount(incomingTier);
  if (incomingOutcomes !== existingOutcomes) {
    return incomingOutcomes - existingOutcomes;
  }

  const existingMetadata = getTierMetadataCount(existingTier);
  const incomingMetadata = getTierMetadataCount(incomingTier);
  return incomingMetadata - existingMetadata;
}

export function tierHasData(tierValue) {
  return blockHasData(tierValue);
}

export function seasonHasTierData(record) {
  if (!record || typeof record !== 'object') return false;
  return Object.keys(record).some((key) => {
    if (!TIER_KEY_PATTERN.test(key)) return false;
    return tierHasData(record[key]);
  });
}

export function blockHasData(block) {
  if (!block) return false;
  if (Array.isArray(block)) return block.length > 0;
  if (!isObjectRecord(block)) return false;

  const table = Array.isArray(block.table) ? block.table : [];
  const promoted = Array.isArray(block.promoted) ? block.promoted : [];
  const relegated = Array.isArray(block.relegated) ? block.relegated : [];

  if (table.length || promoted.length || relegated.length) {
    return true;
  }

  const metadata = block.metadata;
  return hasMetadataEntries(metadata);
}

export function seasonHasData(seasonRecord) {
  if (!seasonRecord || typeof seasonRecord !== 'object') return false;
  if (isHistoricalPlaceholderSeason(seasonRecord)) return true;
  return Object.values(seasonRecord).some((value) => blockHasData(value));
}

export function shouldPreferOverviewTier(existingTier, incomingTier, seasonKey) {
  const seasonNumber = parseSeasonNumber(seasonKey);
  if (seasonNumber == null || seasonNumber < WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason) {
    return false;
  }

  const existingSource = getTierSource(existingTier);
  const incomingSource = getTierSource(incomingTier);

  return (
    (existingSource === WIKIPEDIA_DATA_SOURCES.overview.sourceId &&
      incomingSource === WIKIPEDIA_DATA_SOURCES.promotion.sourceId) ||
    (existingSource === WIKIPEDIA_DATA_SOURCES.promotion.sourceId &&
      incomingSource === WIKIPEDIA_DATA_SOURCES.overview.sourceId)
  );
}

export function mergeTierValues(existingTier, incomingTier, includeEmpty, seasonKey) {
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

  if (shouldPreferOverviewTier(existingTier, incomingTier, seasonKey)) {
    return getTierSource(existingTier) === WIKIPEDIA_DATA_SOURCES.overview.sourceId
      ? existingTier
      : incomingTier;
  }

  return compareTierRichness(existingTier, incomingTier) > 0 ? incomingTier : existingTier;
}

export function mergeSeasonRecords(currentRecord, incomingRecord, includeEmpty = false, seasonKey) {
  if (!isObjectRecord(currentRecord)) return incomingRecord;
  if (!isObjectRecord(incomingRecord)) return currentRecord;

  const merged = { ...currentRecord };
  const tierPattern = TIER_KEY_PATTERN;

  for (const [key, incomingValue] of Object.entries(incomingRecord)) {
    if (tierPattern.test(key)) {
      merged[key] = mergeTierValues(merged[key], incomingValue, includeEmpty, seasonKey);
      continue;
    }

    if (!(key in merged) || merged[key] == null) {
      merged[key] = incomingValue;
    }
  }

  return merged;
}

export function normaliseGoalDifference(dataset) {
  if (!dataset || !dataset.seasons) return;
  for (const seasonRecord of Object.values(dataset.seasons)) {
    if (!seasonRecord || typeof seasonRecord !== 'object') continue;

    for (const tierValue of Object.values(seasonRecord)) {
      const table = getTierTable(tierValue);
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

export function reconcileSeasonInfoContinuity(dataset, options = {}) {
  if (!dataset?.seasons) return;

  const topFlightTierKey = options.topFlightTierKey || CONTINUITY_CONFIG.topFlightTierKey;
  const seasonPromotedPath = options.seasonPromotedPath || CONTINUITY_CONFIG.seasonPromotedPath;
  const seasonRelegatedPath = options.seasonRelegatedPath || CONTINUITY_CONFIG.seasonRelegatedPath;
  const maxContinuitySeason = Number.parseInt(String(options.maxContinuitySeason), 10);
  const shouldSkipSeason = options.shouldSkipSeason || (() => false);

  const seasonNumbers = Object.keys(dataset.seasons)
    .map((seasonKey) => parseSeasonNumber(seasonKey))
    .filter((seasonNumber) => seasonNumber != null)
    .sort((a, b) => a - b);

  for (const seasonNumber of seasonNumbers) {
    if (Number.isFinite(maxContinuitySeason) && seasonNumber > maxContinuitySeason) continue;
    if (shouldSkipSeason(seasonNumber)) continue;

    const currentRecord = dataset.seasons[String(seasonNumber)];
    const nextRecord = dataset.seasons[String(seasonNumber + 1)];
    if (!currentRecord?.seasonInfo || !nextRecord) continue;

    const currentTopFlight = getTierTable(currentRecord?.[topFlightTierKey]);
    const nextTopFlight = getTierTable(nextRecord?.[topFlightTierKey]);
    if (!currentTopFlight.length || !nextTopFlight.length) continue;

    const currentNames = getCanonicalTeamSet(currentTopFlight);
    const nextNames = getCanonicalTeamSet(nextTopFlight);

    currentRecord.seasonInfo[seasonPromotedPath] = nextTopFlight
      .filter((row) => !currentNames.has(canonicalizeTeamName(row.team)))
      .map((row) => row.team);
    currentRecord.seasonInfo[seasonRelegatedPath] = currentTopFlight
      .filter((row) => !nextNames.has(canonicalizeTeamName(row.team)))
      .map((row) => row.team);
  }
}

export function getExpectedMinimumTierCount(seasonNumber) {
  if (WIKIPEDIA_MINIMUM_TIER_OVERRIDES[seasonNumber] != null) {
    return WIKIPEDIA_MINIMUM_TIER_OVERRIDES[seasonNumber];
  }
  if (seasonNumber >= 2021) return 7;
  if (seasonNumber >= 2012) return 5;
  if (seasonNumber >= WIKIPEDIA_SEASON_RANGES.fourthDivisionStartSeason) return 4;
  if (seasonNumber >= WIKIPEDIA_SEASON_RANGES.regionalThirdDivisionStartSeason) return 4;
  if (seasonNumber >= WIKIPEDIA_SEASON_RANGES.thirdDivisionStartSeason) return 3;
  if (seasonNumber >= 1890) return 2;
  if (seasonNumber >= 1888) return 1;
  return null;
}

export function applyOverviewSeasonOutcomeOverrides(seasonRecord, seasonKey) {
  const seasonNumber = parseSeasonNumber(seasonKey);
  if (seasonNumber == null || !isObjectRecord(seasonRecord)) return seasonRecord;

  const override = WIKIPEDIA_OVERVIEW_SEASON_OUTCOME_OVERRIDES[seasonNumber];
  if (!override) return seasonRecord;

  if (seasonRecord.seasonInfo && override.seasonInfo) {
    if (Array.isArray(override.seasonInfo.promoted)) {
      seasonRecord.seasonInfo.promoted = [...override.seasonInfo.promoted];
    }
    if (Array.isArray(override.seasonInfo.relegated)) {
      seasonRecord.seasonInfo.relegated = [...override.seasonInfo.relegated];
    }
  }

  if (override.tiers && typeof override.tiers === 'object') {
    for (const [tierKey, tierOverride] of Object.entries(override.tiers)) {
      const tierRecord = seasonRecord[tierKey];
      if (!tierRecord || typeof tierRecord !== 'object') continue;

      if (Array.isArray(tierOverride.promoted)) {
        tierRecord.promoted = [...tierOverride.promoted];
      }
      if (Array.isArray(tierOverride.relegated)) {
        tierRecord.relegated = [...tierOverride.relegated];
      }

      if (isObjectRecord(tierOverride.rowFlagOverrides)) {
        const rowOverrides = tierOverride.rowFlagOverrides;
        const table = getTierTable(tierRecord);
        table.forEach((row) => {
          if (!isObjectRecord(row) || !row.team) return;
          const rowOverride = rowOverrides[row.team];
          if (!isObjectRecord(rowOverride)) return;
          Object.assign(row, rowOverride);
        });
      }
    }
  }

  return seasonRecord;
}

export function inferLeagueTierFromMetadata(metadata, seasonNumber) {
  return inferEnglishLeagueTier(
    `${metadata?.title || ''} ${metadata?.leagueId || ''}`,
    seasonNumber
  );
}

export function shouldSkipContinuityForSeason(profile, seasonNumber) {
  return (
    profile.kind === 'promotion-only' &&
    seasonNumber >= WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason - 1
  );
}

export function shouldIgnoreMissingSeasonData(profile, seasonKey) {
  if (profile.kind === 'promotion-only' && isWarSuspensionSeason(seasonKey)) return true;
  return false;
}

export default {
  TIER_KEY_PATTERN,
  parseSeasonNumber,
  isWarSuspensionSeason,
  getHistoricalSeasonStatus,
  isHistoricalPlaceholderStatus,
  getSeasonCompetitionStatus,
  isHistoricalPlaceholderSeason,
  buildHistoricalPlaceholderSeasonInfo,
  getTierTable,
  isTierKey,
  getTierKeys,
  compareSeasonKeys,
  sortSeasonKeys,
  getTierSource,
  getTierOutcomeCount,
  getTierMetadataCount,
  compareTierRichness,
  blockHasData,
  seasonHasData,
  tierHasData,
  shouldPreferOverviewTier,
  mergeTierValues,
  mergeSeasonRecords,
  normaliseGoalDifference,
  reconcileSeasonInfoContinuity,
  getExpectedMinimumTierCount,
  inferLeagueTierFromMetadata,
  applyOverviewSeasonOutcomeOverrides,
  shouldSkipContinuityForSeason,
  shouldIgnoreMissingSeasonData,
  extractSeasonKeyFromSlug,
  extractSeasonYearFromSlug,
  seasonHasTierData,
};
