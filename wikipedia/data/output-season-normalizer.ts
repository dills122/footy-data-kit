import type { LeagueTableEntry, SeasonData, SeasonInfo } from '../models/output-file.ts';
import { normaliseLeagueTableEntry } from './output-entry-normalizer.ts';
import {
  isTierData,
  normaliseOutcomeList,
  normaliseTierData,
  sanitizeRows,
} from './output-tier-normalizer.ts';

type SeasonRecordValue = SeasonInfo | ReturnType<typeof normaliseTierData> | LeagueTableEntry[];

function toStringValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeNumberList(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value) => value != null)
        .map((value) => Number(value))
        .filter((value): value is number => Number.isFinite(value))
    )
  );
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => toStringValue(value))
        .filter((value): value is string => value != null)
    )
  );
}

function normalizeLeagueStructureSpecialCases(values: unknown): SeasonInfo['leagueStructureSpecialCases'] {
  if (!Array.isArray(values)) return [];

  return values
    .filter((value): value is Record<string, unknown> => {
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    })
    .map((value) => ({
      type: toStringValue(value.type) || 'unknown',
      levels: normalizeNumberList(value.levels),
      tierKeys: normalizeStringList(value.tierKeys),
      notes: toStringValue(value.notes),
    }))
    .filter((value) => value.type !== 'unknown' || value.levels.length || value.tierKeys.length);
}

export function normaliseSeasonInfo(
  seasonInfoValue: Record<string, unknown>,
  seasonKey: string
): SeasonInfo {
  const parsedSeason = Number.parseInt(String(seasonInfoValue.season ?? seasonKey), 10);
  const fallbackSeason = Number.parseInt(seasonKey, 10);
  const season = Number.isFinite(parsedSeason)
    ? parsedSeason
    : Number.isFinite(fallbackSeason)
      ? fallbackSeason
      : 0;

  const specialCompetitions = Array.isArray(seasonInfoValue.specialCompetitions)
    ? normalizeStringList(seasonInfoValue.specialCompetitions)
    : [];

  return {
    season,
    table: [],
    relegated: normaliseOutcomeList(seasonInfoValue.relegated, [], 'wasRelegated'),
    promoted: normaliseOutcomeList(seasonInfoValue.promoted, [], 'wasPromoted'),
    seasonSlug: toStringValue(seasonInfoValue.seasonSlug),
    sourceUrl: toStringValue(seasonInfoValue.sourceUrl),
    tableCount: Number.isFinite(Number(seasonInfoValue.tableCount))
      ? Number(seasonInfoValue.tableCount)
      : null,
    competitionStatus: toStringValue(seasonInfoValue.competitionStatus),
    warSuspensionLabel: toStringValue(seasonInfoValue.warSuspensionLabel),
    officialLeagueTables:
      typeof seasonInfoValue.officialLeagueTables === 'boolean'
        ? seasonInfoValue.officialLeagueTables
        : null,
    officialCompetitionsSuspended:
      typeof seasonInfoValue.officialCompetitionsSuspended === 'boolean'
        ? seasonInfoValue.officialCompetitionsSuspended
        : null,
    officialCompetitionsAbandoned:
      typeof seasonInfoValue.officialCompetitionsAbandoned === 'boolean'
        ? seasonInfoValue.officialCompetitionsAbandoned
        : null,
    regionalBridgeSeason:
      typeof seasonInfoValue.regionalBridgeSeason === 'boolean'
        ? seasonInfoValue.regionalBridgeSeason
        : null,
    promotionRelegationApplies:
      typeof seasonInfoValue.promotionRelegationApplies === 'boolean'
        ? seasonInfoValue.promotionRelegationApplies
        : null,
    specialCompetitions,
    leagueStructureSpecialCases: normalizeLeagueStructureSpecialCases(
      seasonInfoValue.leagueStructureSpecialCases
    ),
    notes: toStringValue(seasonInfoValue.notes),
  };
}

/**
 * Normalise raw season data into a SeasonData map.
 */
export function normaliseSeasonRecord(
  seasonValue: Record<string, unknown>,
  seasonKey: string
): SeasonData {
  const result: Record<string, SeasonRecordValue | undefined> = {};
  const entries = seasonValue && typeof seasonValue === 'object' ? seasonValue : {};

  for (const [tierKey, tierValue] of Object.entries(entries)) {
    if (
      tierKey === 'seasonInfo' &&
      tierValue &&
      typeof tierValue === 'object' &&
      !Array.isArray(tierValue)
    ) {
      result[tierKey] = normaliseSeasonInfo(tierValue as Record<string, unknown>, seasonKey);
    } else if (Array.isArray(tierValue)) {
      const sanitized = sanitizeRows(tierValue);
      result[tierKey] = sanitized.map((row) => normaliseLeagueTableEntry(row));
    } else if (isTierData(tierValue)) {
      result[tierKey] = normaliseTierData(tierValue as unknown as Record<string, unknown>, seasonKey);
    } else if (tierValue && typeof tierValue === 'object') {
      result[tierKey] = normaliseTierData(tierValue as Record<string, unknown>, seasonKey);
    }
  }

  return result as unknown as SeasonData;
}
