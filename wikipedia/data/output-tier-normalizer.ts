import { WIKIPEDIA_DATA_SOURCES } from '../config.js';
import type { LeagueTableEntry, TierData, TierDivisionData, TierMetadata } from '../models/output-file.ts';
import { normaliseLeagueTableEntry } from './output-entry-normalizer.ts';

type LeagueTableEntryInput = Partial<LeagueTableEntry> & Record<string, unknown>;
type TierOutcomeFlag = 'wasRelegated' | 'wasPromoted';

function toStringValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

/**
 * Ensure we have a string array with no duplicates.
 */
export function normaliseOutcomeList(
  value: unknown,
  fallbackRows: LeagueTableEntry[],
  flag: TierOutcomeFlag
): string[] {
  const results = new Set<string>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      const name = toStringValue(entry);
      if (name) results.add(name);
    }
  }

  if (!results.size && fallbackRows.length) {
    for (const row of fallbackRows) {
      if (row[flag] && toStringValue(row.team)) {
        results.add(row.team);
      }
    }
  }

  return Array.from(results);
}

/**
 * Remove malformed rows and ensure every row has a team name before normalisation.
 */
export function sanitizeRows(rows: unknown): LeagueTableEntryInput[] {
  const list = Array.isArray(rows) ? rows : [];
  const sanitized: LeagueTableEntryInput[] = [];

  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const teamName = toStringValue((row as Record<string, unknown>).team);
    if (!teamName) continue;
    sanitized.push({ ...(row as Record<string, unknown>), team: teamName });
  }

  return sanitized;
}

export function isTierData(tierValue: unknown): tierValue is TierData {
  return (
    tierValue != null &&
    typeof tierValue === 'object' &&
    'season' in tierValue &&
    'table' in tierValue
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normaliseTierMetadata(value: Record<string, unknown>): TierMetadata | undefined {
  const directMetadata =
    value.metadata && typeof value.metadata === 'object'
      ? { ...(value.metadata as Record<string, unknown>) }
      : {};
  const legacySeasonMetadata =
    value.seasonMetadata && typeof value.seasonMetadata === 'object'
      ? { ...(value.seasonMetadata as Record<string, unknown>) }
      : {};

  const metadata: Record<string, unknown> = {
    ...directMetadata,
  };

  if (value.sourceUrl != null && metadata.sourceUrl == null) {
    metadata.sourceUrl = value.sourceUrl;
  }
  if (value.seasonSlug != null && metadata.seasonSlug == null) {
    metadata.seasonSlug = value.seasonSlug;
  }
  if (value.tier != null && metadata.tierKey == null) {
    metadata.tierKey = value.tier;
  }
  if (value.title != null && metadata.title == null) {
    metadata.title = value.title;
  }
  if (legacySeasonMetadata.leagueId != null && metadata.leagueId == null) {
    metadata.leagueId = legacySeasonMetadata.leagueId;
  }
  if (legacySeasonMetadata.tableIndex != null && metadata.tableIndex == null) {
    metadata.tableIndex = legacySeasonMetadata.tableIndex;
  }
  if (legacySeasonMetadata.tableCount != null && metadata.tableCount == null) {
    metadata.tableCount = legacySeasonMetadata.tableCount;
  }
  if (legacySeasonMetadata.seasonSlug != null && metadata.seasonSlug == null) {
    metadata.seasonSlug = legacySeasonMetadata.seasonSlug;
  }

  if (metadata.source == null) {
    if (metadata.leagueId != null || metadata.title != null || value.seasonMetadata != null) {
      metadata.source = WIKIPEDIA_DATA_SOURCES.overview.sourceId;
    } else if (metadata.sourceUrl != null || metadata.tierKey != null) {
      metadata.source = WIKIPEDIA_DATA_SOURCES.promotion.sourceId;
    }
  }

  const cleaned = Object.fromEntries(Object.entries(metadata).filter(([, entry]) => entry != null));
  return Object.keys(cleaned).length ? (cleaned as TierMetadata) : undefined;
}

export function normaliseTierData(tierValue: Record<string, unknown>, seasonKey: string): TierData {
  const table = sanitizeRows(tierValue.table);
  const normalisedTable = table.map((row) => normaliseLeagueTableEntry(row));

  const parsedSeason = Number.parseInt(String(tierValue.season ?? seasonKey), 10);
  const fallbackSeason = Number.parseInt(seasonKey, 10);
  const season = Number.isFinite(parsedSeason)
    ? parsedSeason
    : Number.isFinite(fallbackSeason)
      ? fallbackSeason
      : 0;

  const extra = { ...tierValue };
  delete extra.table;
  delete extra.season;
  delete extra.relegated;
  delete extra.promoted;
  delete extra.metadata;
  delete extra.divisions;
  delete extra.sourceUrl;
  delete extra.seasonSlug;
  delete extra.tier;
  delete extra.title;
  delete extra.seasonMetadata;

  const metadata = normaliseTierMetadata(tierValue);
  const divisions = normaliseTierDivisions(tierValue.divisions, seasonKey);

  return {
    ...extra,
    season,
    table: normalisedTable,
    relegated: normaliseOutcomeList(tierValue.relegated, normalisedTable, 'wasRelegated'),
    promoted: normaliseOutcomeList(tierValue.promoted, normalisedTable, 'wasPromoted'),
    ...(metadata ? { metadata } : {}),
    ...(divisions.length ? { divisions } : {}),
  };
}

function normaliseTierDivisions(value: unknown, seasonKey: string): TierDivisionData[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((division) => normaliseTierData(division, seasonKey) as TierDivisionData)
    .filter((division) => division.table.length || division.promoted.length || division.relegated.length);
}
