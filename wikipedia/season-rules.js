// @ts-check

import {
  inferEnglishLeagueTier,
  isWikipediaWarSuspensionYear,
  WIKIPEDIA_DATA_SOURCES,
  WIKIPEDIA_SEASON_RANGES,
} from './config.js';
import { canonicalizeTeamName } from './data-quality-config.js';

export const TIER_KEY_PATTERN = /^tier(\d+)$/i;

const CONTINUITY_CONFIG = {
  topFlightTierKey: 'tier1',
  seasonPromotedPath: 'promoted',
  seasonRelegatedPath: 'relegated',
};

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
  if (!tierValue || Array.isArray(tierValue) || typeof tierValue !== 'object') {
    return null;
  }
  return typeof tierValue.metadata?.source === 'string' ? tierValue.metadata.source : null;
}

export function getTierOutcomeCount(tierValue) {
  if (!tierValue || Array.isArray(tierValue) || typeof tierValue !== 'object') {
    return 0;
  }
  const promoted = Array.isArray(tierValue.promoted) ? tierValue.promoted.length : 0;
  const relegated = Array.isArray(tierValue.relegated) ? tierValue.relegated.length : 0;
  return promoted + relegated;
}

export function getTierMetadataCount(tierValue) {
  if (!tierValue || Array.isArray(tierValue) || typeof tierValue !== 'object') {
    return 0;
  }

  return Object.entries(tierValue).filter(([key, value]) => {
    if (key === 'season' || key === 'table' || key === 'promoted' || key === 'relegated') {
      return false;
    }
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
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
  if (Array.isArray(block)) {
    return block.length > 0;
  }

  if (typeof block !== 'object') {
    return false;
  }

  const table = Array.isArray(block.table) ? block.table : [];
  const promoted = Array.isArray(block.promoted) ? block.promoted : [];
  const relegated = Array.isArray(block.relegated) ? block.relegated : [];

  if (table.length || promoted.length || relegated.length) {
    return true;
  }

  const metadata = block.metadata;
  return Boolean(metadata && typeof metadata === 'object' && Object.keys(metadata).length);
}

export function seasonHasData(seasonRecord) {
  if (!seasonRecord || typeof seasonRecord !== 'object') return false;
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
  if (!currentRecord || typeof currentRecord !== 'object') {
    return incomingRecord;
  }
  if (!incomingRecord || typeof incomingRecord !== 'object') {
    return currentRecord;
  }

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

    const currentNames = new Set(currentTopFlight.map((row) => canonicalizeTeamName(row.team)));
    const nextNames = new Set(nextTopFlight.map((row) => canonicalizeTeamName(row.team)));

    currentRecord.seasonInfo[seasonPromotedPath] = nextTopFlight
      .filter((row) => !currentNames.has(canonicalizeTeamName(row.team)))
      .map((row) => row.team);
    currentRecord.seasonInfo[seasonRelegatedPath] = currentTopFlight
      .filter((row) => !nextNames.has(canonicalizeTeamName(row.team)))
      .map((row) => row.team);
  }
}

export function getExpectedMinimumTierCount(seasonNumber) {
  if (seasonNumber >= WIKIPEDIA_SEASON_RANGES.premierLeagueStartSeason - 1) return 4;
  if (seasonNumber >= 1888) return 2;
  return null;
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
  return profile.kind === 'promotion-only' && isWarSuspensionSeason(seasonKey);
}

export default {
  TIER_KEY_PATTERN,
  parseSeasonNumber,
  isWarSuspensionSeason,
  getTierTable,
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
  shouldSkipContinuityForSeason,
  shouldIgnoreMissingSeasonData,
  extractSeasonKeyFromSlug,
  extractSeasonYearFromSlug,
  seasonHasTierData,
};
