/* eslint-disable @typescript-eslint/no-explicit-any -- Club metadata normalization accepts legacy schema-loose JSON input. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ClubMetadata,
  ClubsMap,
  DatasetMetadata,
  FootballData,
  LeagueTableEntry,
  SeasonData,
  SeasonInfo,
  SeasonsMap,
  TierData,
} from '../models/output-file.ts';
import { buildDatasetMetadata, normaliseDatasetMetadata } from './output-dataset-metadata.ts';
import { normaliseLeagueTableEntry } from './output-entry-normalizer.ts';
import {
  normaliseOutcomeList,
  normaliseTierData,
  normaliseTierMetadata,
  sanitizeRows,
} from './output-tier-normalizer.ts';
import { normaliseSeasonInfo, normaliseSeasonRecord } from './output-season-normalizer.ts';
export { buildDatasetMetadata } from './output-dataset-metadata.ts';
export { normaliseLeagueTableEntry } from './output-entry-normalizer.ts';

type AnyRecord = Record<string, any>;
type SaveFootballDataOptions = {
  pretty?: boolean | number;
  metadata?: DatasetMetadata | Record<string, unknown>;
};
type BuildTierDataOptions = {
  promoted?: unknown;
  relegated?: unknown;
  metadata?: Record<string, unknown>;
};
type BuildSeasonInfoOptions = {
  promoted?: unknown;
  relegated?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * @param {unknown} value
 */
function toStringValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.map((entry) => toStringValue(entry)).filter((entry): entry is string => entry != null)
    )
  );
}

function normalizeSeasonNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => toSeasonNumberOrNull(entry))
        .filter((entry): entry is number => Number.isInteger(entry))
    )
  ).sort((a, b) => a - b);
}

/**
 * @param {unknown} value
 */
function toSeasonNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {unknown} value
 */
function normaliseClubNameHistory(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const history: AnyRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const name = toStringValue(item.name);
    if (!name) continue;

    const normalizedItem = {
      name,
      startSeason: toSeasonNumberOrNull(item.startSeason),
      endSeason: toSeasonNumberOrNull(item.endSeason),
      notes: toStringValue(item.notes),
    };
    const dedupeKey = JSON.stringify(normalizedItem);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    history.push(
      Object.fromEntries(Object.entries(normalizedItem).filter(([, entry]) => entry != null))
    );
  }

  return history;
}

/**
 * @param {unknown} value
 */
function normaliseClubFinancialEvents(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const events: AnyRecord[] = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = toStringValue(item.type);
    if (!type) continue;

    const seasonsMissed = Array.isArray(item.seasonsMissed)
      ? Array.from(
          new Set(
            (item.seasonsMissed as unknown[])
              .map((entry: unknown) => toSeasonNumberOrNull(entry))
              .filter((entry): entry is number => Number.isInteger(entry))
          )
        ).sort((a, b) => a - b)
      : [];
    const normalizedItem = {
      type,
      startSeason: toSeasonNumberOrNull(item.startSeason),
      endSeason: toSeasonNumberOrNull(item.endSeason),
      seasonsMissed,
      notes: toStringValue(item.notes),
    };
    const dedupeKey = JSON.stringify(normalizedItem);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    events.push(
      Object.fromEntries(
        Object.entries(normalizedItem).filter(([key, entry]) => {
          if (entry == null) return false;
          if (Array.isArray(entry)) return key === 'seasonsMissed' ? entry.length > 0 : true;
          return true;
        })
      )
    );
  }

  return events;
}

/**
 * @param {unknown} value
 */
function normaliseClubLifecycleEvents(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const events: AnyRecord[] = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = toStringValue(item.type);
    if (!type) continue;

    const normalizedItem = {
      type,
      season: toSeasonNumberOrNull(item.season),
      date: toStringValue(item.date),
      fromSeason: toSeasonNumberOrNull(item.fromSeason),
      toSeason: toSeasonNumberOrNull(item.toSeason),
      fromName: toStringValue(item.fromName),
      toName: toStringValue(item.toName),
      label: toStringValue(item.label),
      description: toStringValue(item.description),
      notes: toStringValue(item.notes),
      sourceRefs: normaliseIdentitySources(item.sourceRefs),
    };
    const dedupeKey = JSON.stringify(normalizedItem);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    events.push(
      Object.fromEntries(
        Object.entries(normalizedItem).filter(([, entry]) => {
          if (entry == null) return false;
          if (Array.isArray(entry)) return entry.length > 0;
          return true;
        })
      )
    );
  }

  return events.sort((a, b) => {
    const leftSeason = a.season ?? a.fromSeason ?? 0;
    const rightSeason = b.season ?? b.fromSeason ?? 0;
    if (leftSeason !== rightSeason) return leftSeason - rightSeason;
    const leftDate = a.date || '';
    const rightDate = b.date || '';
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (leftDate !== rightDate) return leftDate ? -1 : 1;
    return a.type.localeCompare(b.type);
  });
}

/**
 * @param {unknown} value
 */
function normaliseClubTrackedMembership(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const memberships: AnyRecord[] = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const fromSeason = toSeasonNumberOrNull(item.fromSeason);
    if (fromSeason == null) continue;

    const normalizedItem = {
      fromSeason,
      toSeason: toSeasonNumberOrNull(item.toSeason),
      tiers: normalizeStringArray(item.tiers).sort(),
      basis: toStringValue(item.basis),
      notes: toStringValue(item.notes),
      sourceRefs: normaliseIdentitySources(item.sourceRefs),
    };
    const dedupeKey = JSON.stringify(normalizedItem);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    memberships.push(
      Object.fromEntries(
        Object.entries(normalizedItem).filter(([key, entry]) => {
          if (key === 'toSeason') return true;
          if (entry == null) return false;
          if (Array.isArray(entry)) return entry.length > 0;
          return true;
        })
      )
    );
  }

  return memberships.sort((a, b) => a.fromSeason - b.fromSeason);
}

/**
 * @param {unknown} value
 */
function normaliseClubAbsenceExplanations(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const explanations: AnyRecord[] = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const fromSeason = toSeasonNumberOrNull(item.fromSeason);
    const reason = toStringValue(item.reason);
    if (fromSeason == null || !reason) continue;

    const normalizedItem = {
      fromSeason,
      toSeason: toSeasonNumberOrNull(item.toSeason),
      reason,
      linkedEventType: toStringValue(item.linkedEventType),
      basis: toStringValue(item.basis),
      notes: toStringValue(item.notes),
      sourceRefs: normaliseIdentitySources(item.sourceRefs),
    };
    const dedupeKey = JSON.stringify(normalizedItem);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    explanations.push(
      Object.fromEntries(
        Object.entries(normalizedItem).filter(([, entry]) => {
          if (entry == null) return false;
          if (Array.isArray(entry)) return entry.length > 0;
          return true;
        })
      )
    );
  }

  return explanations.sort((a, b) => a.fromSeason - b.fromSeason);
}

/**
 * @param {unknown} value
 */
function normaliseClubHistory(value: any): AnyRecord {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    nameHistory: normaliseClubNameHistory(source.nameHistory),
    lifecycleEvents: normaliseClubLifecycleEvents(source.lifecycleEvents),
    trackedMembership: normaliseClubTrackedMembership(source.trackedMembership),
    absenceExplanations: normaliseClubAbsenceExplanations(source.absenceExplanations),
  };
}

/**
 * @param {unknown} value
 */
function normaliseClubStatus(value: any): AnyRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const current = toStringValue(value.current);
  const status = {
    current,
    trackedFromSeason: toSeasonNumberOrNull(value.trackedFromSeason),
    trackedToSeason: toSeasonNumberOrNull(value.trackedToSeason),
    hasUnexplainedGaps:
      typeof value.hasUnexplainedGaps === 'boolean' ? value.hasUnexplainedGaps : null,
    reason: toStringValue(value.reason),
    reasonLabel: toStringValue(value.reasonLabel),
    sourceRefs: normaliseIdentitySources(value.sourceRefs),
  };

  const cleaned = Object.fromEntries(
    Object.entries(status).filter(([key, entry]) => {
      if (key === 'trackedToSeason') return true;
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  );

  return Object.keys(cleaned).length ? cleaned : undefined;
}

/**
 * @param {unknown} value
 */
function normaliseObservedNamePeriods(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const periods: AnyRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const name = toStringValue(item.name);
    const startSeason = toSeasonNumberOrNull(item.startSeason);
    const endSeason = toSeasonNumberOrNull(item.endSeason);
    if (!name || startSeason == null || endSeason == null) continue;
    periods.push({ name, startSeason, endSeason });
  }

  return periods.sort((a, b) => a.startSeason - b.startSeason || a.name.localeCompare(b.name));
}

/**
 * @param {unknown} value
 */
function normaliseObservedNames(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const names: AnyRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const rawName = toStringValue(item.rawName);
    const normalizedName = toStringValue(item.normalizedName);
    const seasonsSeen = normalizeSeasonNumberArray(item.seasonsSeen);
    if (!rawName || !normalizedName || !seasonsSeen.length) continue;

    names.push({
      rawName,
      normalizedName,
      firstSeenSeason: toSeasonNumberOrNull(item.firstSeenSeason) ?? seasonsSeen[0],
      lastSeenSeason:
        toSeasonNumberOrNull(item.lastSeenSeason) ?? seasonsSeen[seasonsSeen.length - 1],
      seasonsSeen,
      tiersSeen: normalizeStringArray(item.tiersSeen).sort(),
    });
  }

  return names.sort((a, b) => a.firstSeenSeason - b.firstSeenSeason || a.rawName.localeCompare(b.rawName));
}

/**
 * @param {unknown} value
 */
function normaliseIdentitySources(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const sources: AnyRecord[] = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = toStringValue(item.type);
    const sourceUrl = toStringValue(item.sourceUrl);
    if (!type || !sourceUrl) continue;

    const source = {
      type,
      sourceUrl,
      notes: toStringValue(item.notes),
    };
    const dedupeKey = `${source.type}:${source.sourceUrl}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    sources.push(Object.fromEntries(Object.entries(source).filter(([, entry]) => entry != null)));
  }

  return sources.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.sourceUrl.localeCompare(b.sourceUrl);
  });
}

/**
 * @param {unknown} value
 */
function normaliseClubRelationships(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const relationships: AnyRecord[] = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const clubKey = toStringValue(item.clubKey);
    const relationship = toStringValue(item.relationship);
    const direction = toStringValue(item.direction);
    if (!clubKey || !relationship || !direction) continue;

    const normalized = {
      clubKey,
      relationship,
      direction,
      season: toSeasonNumberOrNull(item.season),
      label: toStringValue(item.label),
      sourceRefs: normaliseIdentitySources(item.sourceRefs),
      notes: toStringValue(item.notes),
    };
    const dedupeKey = `${normalized.clubKey}:${normalized.relationship}:${normalized.direction}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    relationships.push(
      Object.fromEntries(
        Object.entries(normalized).filter(([, entry]) => {
          if (entry == null) return false;
          if (Array.isArray(entry)) return entry.length > 0;
          return true;
        })
      )
    );
  }

  return relationships.sort((a, b) => {
    if (a.clubKey !== b.clubKey) return a.clubKey.localeCompare(b.clubKey);
    if (a.relationship !== b.relationship) return a.relationship.localeCompare(b.relationship);
    return a.direction.localeCompare(b.direction);
  });
}

/**
 * @param {unknown} value
 */
function normaliseTierSeasons(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const tiers: AnyRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const tierKey = toStringValue(item.tierKey);
    const seasons = normalizeSeasonNumberArray(item.seasons);
    if (!tierKey || !seasons.length) continue;
    tiers.push({ tierKey, seasons });
  }

  return tiers.sort((a, b) => a.tierKey.localeCompare(b.tierKey));
}

/**
 * @param {unknown} value
 */
function normaliseCoverageGaps(value: any): any[] {
  if (!Array.isArray(value)) return [];
  const gaps: AnyRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const startSeason = toSeasonNumberOrNull(item.startSeason);
    const endSeason = toSeasonNumberOrNull(item.endSeason);
    const length = toSeasonNumberOrNull(item.length);
    if (startSeason == null || endSeason == null || length == null) continue;
    gaps.push({ startSeason, endSeason, length });
  }

  return gaps.sort((a, b) => a.startSeason - b.startSeason);
}

/**
 * @param {unknown} value
 */
function normaliseClubDerivedMetadata(value: any): AnyRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const seasonsSeen = normalizeSeasonNumberArray(value.seasonsSeen);
  const totalSeasonsSeen = Number.isFinite(Number(value.totalSeasonsSeen))
    ? Number(value.totalSeasonsSeen)
    : seasonsSeen.length || null;
  const derived = {
    source: toStringValue(value.source),
    aliases: normalizeStringArray(value.aliases),
    identitySources: normaliseIdentitySources(value.identitySources),
    relationships: normaliseClubRelationships(value.relationships),
    observedNames: normaliseObservedNames(value.observedNames),
    observedNamePeriods: normaliseObservedNamePeriods(value.observedNamePeriods),
    firstSeenSeason: toSeasonNumberOrNull(value.firstSeenSeason),
    lastSeenSeason: toSeasonNumberOrNull(value.lastSeenSeason),
    seasonsSeen,
    totalSeasonsSeen,
    tiersSeen: normalizeStringArray(value.tiersSeen).sort(),
    tierSeasons: normaliseTierSeasons(value.tierSeasons),
    coverageGaps: normaliseCoverageGaps(value.coverageGaps),
  };

  const cleaned = Object.fromEntries(
    Object.entries(derived).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  );

  return Object.keys(cleaned).length ? cleaned : undefined;
}

/**
 * @param {unknown} value
 * @param {string} fallbackKey
 * @returns {ClubMetadata | null}
 */
function normaliseClubRecord(value: any, fallbackKey: string): ClubMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const canonicalName = toStringValue(value.canonicalName) || toStringValue(fallbackKey);
  if (!canonicalName) return null;

  const hasHistoryInput =
    (value.history && typeof value.history === 'object' && !Array.isArray(value.history)) ||
    value.lifecycleEvents ||
    value.trackedMembership ||
    value.absenceExplanations;
  const history = hasHistoryInput
    ? normaliseClubHistory({
        ...(value.history && typeof value.history === 'object' && !Array.isArray(value.history)
          ? value.history
          : {}),
        lifecycleEvents: value.history?.lifecycleEvents || value.lifecycleEvents,
        trackedMembership: value.history?.trackedMembership || value.trackedMembership,
        absenceExplanations: value.history?.absenceExplanations || value.absenceExplanations,
      })
    : undefined;

  const normalized = {
    clubId: toStringValue(value.clubId),
    canonicalName,
    status: normaliseClubStatus(value.status),
    history,
    derived: normaliseClubDerivedMetadata(value.derived),
    founded: toStringValue(value.founded),
    dissolved: toStringValue(value.dissolved),
    nameHistory: normaliseClubNameHistory(value.nameHistory),
    financialEvents: normaliseClubFinancialEvents(value.financialEvents),
    notes: toStringValue(value.notes),
    sourceUrl: toStringValue(value.sourceUrl),
  };

  const cleaned = Object.fromEntries(
    Object.entries(normalized).filter(([key, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) {
        if (key === 'nameHistory' || key === 'financialEvents') return entry.length > 0;
      }
      if (typeof entry === 'object') return Object.keys(entry).length > 0;
      return true;
    })
  );

  return cleaned as unknown as ClubMetadata;
}

/**
 * @param {unknown} value
 * @returns {ClubsMap | undefined}
 */
export function normaliseClubsMap(value: any): ClubsMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const clubs: ClubsMap = {};

  for (const [key, clubValue] of Object.entries(value)) {
    const normalized = normaliseClubRecord(clubValue, key);
    if (!normalized) continue;
    clubs[key] = normalized;
  }

  return Object.keys(clubs).length ? clubs : undefined;
}

/**
 * @param {ClubsMap | undefined} target
 * @param {ClubsMap | undefined} source
 * @returns {ClubsMap | undefined}
 */
export function mergeClubsMap(
  target: ClubsMap | undefined,
  source: ClubsMap | undefined
): ClubsMap | undefined {
  if (!source || !Object.keys(source).length) return target;
  if (!target || !Object.keys(target).length) return { ...source };

  const merged: ClubsMap = { ...target };
  const sourceEntries = Object.entries(source) as [string, ClubMetadata][];

  for (const [clubKey, incomingClub] of sourceEntries) {
    const existingClub = merged[clubKey];
    if (!existingClub) {
      merged[clubKey] = incomingClub;
      continue;
    }

    const existingNameHistory = Array.isArray(existingClub.nameHistory) ? existingClub.nameHistory : [];
    const incomingNameHistory = Array.isArray(incomingClub.nameHistory) ? incomingClub.nameHistory : [];
    const existingFinancialEvents = Array.isArray(existingClub.financialEvents)
      ? existingClub.financialEvents
      : [];
    const incomingFinancialEvents = Array.isArray(incomingClub.financialEvents)
      ? incomingClub.financialEvents
      : [];

    const nameHistory = normaliseClubNameHistory([...existingNameHistory, ...incomingNameHistory]);
    const financialEvents = normaliseClubFinancialEvents([
      ...existingFinancialEvents,
      ...incomingFinancialEvents,
    ]);

    merged[clubKey] = /** @type {ClubMetadata} */ ({
      canonicalName: incomingClub.canonicalName || existingClub.canonicalName || clubKey,
      derived: incomingClub.derived ?? existingClub.derived,
      founded: incomingClub.founded ?? existingClub.founded ?? null,
      dissolved: incomingClub.dissolved ?? existingClub.dissolved ?? null,
      notes: incomingClub.notes ?? existingClub.notes ?? null,
      sourceUrl: incomingClub.sourceUrl ?? existingClub.sourceUrl ?? null,
      ...(nameHistory.length ? { nameHistory } : {}),
      ...(financialEvents.length ? { financialEvents } : {}),
    });
  }

  return merged;
}

/**
 * Create a FootballData container from partial data.
 * @param {Partial<FootballData> | Record<string, unknown>} [initial]
 * @returns {FootballData}
 */
export function createFootballData(initial: Partial<FootballData> | Record<string, unknown> = {}): FootballData {
  const metadata =
    initial && typeof initial === 'object' && 'metadata' in initial
      ? normaliseDatasetMetadata(initial.metadata)
      : undefined;
  const clubs =
    initial && typeof initial === 'object' && 'clubs' in initial
      ? normaliseClubsMap(initial.clubs)
      : undefined;
  const seasonsSource: Record<string, unknown> =
    initial && typeof initial === 'object' && 'seasons' in initial
      ? ((initial as AnyRecord).seasons as Record<string, unknown>)
      : initial && typeof initial === 'object' && ('clubs' in initial || 'metadata' in initial)
        ? {}
        : (initial as Record<string, unknown>);

  const seasons: SeasonsMap = {};
  for (const [seasonKey, seasonValue] of Object.entries(seasonsSource)) {
    if (!seasonValue || typeof seasonValue !== 'object') continue;
    seasons[seasonKey] = normaliseSeasonRecord(
      seasonValue as Record<string, unknown>,
      seasonKey
    );
  }

  return /** @type {FootballData} */ ({
    ...(metadata ? { metadata } : {}),
    ...(clubs ? { clubs } : {}),
    seasons,
  });
}

/**
 * Build a TierData object from raw league table rows.
 * @param {string | number} season
 * @param {Array<Partial<LeagueTableEntry> & Record<string, unknown>>} tableRows
 * @param {{
 *   promoted?: unknown;
 *   relegated?: unknown;
 *   metadata?: Record<string, unknown>;
 * }} [options]
 * @returns {TierData}
 */
export function buildTierData(
  season: string | number,
  tableRows: Array<Partial<LeagueTableEntry> & Record<string, unknown>>,
  options: BuildTierDataOptions = {}
): TierData {
  const seasonNumber = Number.parseInt(String(season), 10);
  const safeSeason = Number.isFinite(seasonNumber) ? seasonNumber : 0;
  const sanitizedRows = sanitizeRows(tableRows);
  const normalizedTable = sanitizedRows.map((row) => normaliseLeagueTableEntry(row));

  const promoted = normaliseOutcomeList(options.promoted, normalizedTable, 'wasPromoted');
  const relegated = normaliseOutcomeList(options.relegated, normalizedTable, 'wasRelegated');

  const tierData: TierData = {
    season: safeSeason,
    table: normalizedTable,
    promoted,
    relegated,
  };

  if (options.metadata && typeof options.metadata === 'object') {
    const metadata = normaliseTierMetadata({ metadata: options.metadata });
    if (metadata) {
      tierData.metadata = metadata;
    }
  }

  return tierData;
}

/**
 * Build the season-level summary object stored as `seasonInfo`.
 * @param {string | number} season
 * @param {{
 *   promoted?: unknown;
 *   relegated?: unknown;
 *   metadata?: Record<string, unknown>;
 * }} [options]
 * @returns {SeasonInfo}
 */
export function buildSeasonInfo(
  season: string | number,
  options: BuildSeasonInfoOptions = {}
): SeasonInfo {
  const seasonNumber = Number.parseInt(String(season), 10);
  const safeSeason = Number.isFinite(seasonNumber) ? seasonNumber : 0;

  return normaliseSeasonInfo(
    {
      season: safeSeason,
      table: [],
      promoted: options.promoted,
      relegated: options.relegated,
      ...(options.metadata && typeof options.metadata === 'object' ? options.metadata : {}),
    },
    String(season)
  );
}

/**
 * Ensure season record exists.
 * @param {FootballData} data
 * @param {string} seasonKey
 */
function ensureSeason(data: FootballData, seasonKey: string): SeasonData {
  if (!data.seasons[seasonKey]) {
    data.seasons[seasonKey] = {} as SeasonData;
  }
  return data.seasons[seasonKey] as SeasonData;
}

/**
 * Upsert tier data for a season.
 * @param {FootballData} dataset
 * @param {string | number} seasonKey
 * @param {string} tierKey
 * @param {TierData | LeagueTableEntry[]} tierValue
 */
export function upsertSeasonTier(
  dataset: FootballData,
  seasonKey: string | number,
  tierKey: string,
  tierValue: TierData | LeagueTableEntry[]
): FootballData {
  if (!dataset || typeof dataset !== 'object' || !dataset.seasons) {
    throw new TypeError('Dataset must be a FootballData object');
  }

  const key = String(seasonKey);
  const seasonRecord = ensureSeason(dataset, key);

  if (Array.isArray(tierValue)) {
    (seasonRecord as AnyRecord)[tierKey] = tierValue.map((row) =>
      normaliseLeagueTableEntry(row as unknown as Partial<LeagueTableEntry> & Record<string, unknown>)
    );
  } else if (tierValue && typeof tierValue === 'object') {
    (seasonRecord as AnyRecord)[tierKey] = normaliseTierData(
      tierValue as unknown as Record<string, unknown>,
      key
    );
  } else {
    throw new TypeError('tierValue must be an array of LeagueTableEntry or TierData payload');
  }

  return dataset;
}

/**
 * Replace or set the full season record.
 * @param {FootballData} dataset
 * @param {string | number} seasonKey
 * @param {SeasonData} seasonValue
 */
export function setSeasonRecord(
  dataset: FootballData,
  seasonKey: string | number,
  seasonValue: SeasonData
): FootballData {
  if (!dataset || typeof dataset !== 'object') {
    throw new TypeError('Dataset must be a FootballData object');
  }

  const key = String(seasonKey);
  dataset.seasons[key] = normaliseSeasonRecord(
    /** @type {Record<string, unknown>} */ (seasonValue),
    key
  );
  return dataset;
}

/**
 * Merge data from source into target (mutates target).
 * @param {FootballData} target
 * @param {FootballData} source
 */
export function mergeFootballData(target: FootballData, source: FootballData): FootballData {
  if (!target || !target.seasons) {
    throw new TypeError('Target must include a seasons map');
  }
  if (!source || !source.seasons) return target;

  if (source.metadata) {
    target.metadata = source.metadata;
  }
  if (source.clubs) {
    target.clubs = mergeClubsMap(target.clubs, source.clubs);
  }

  for (const [seasonKey, seasonValue] of Object.entries(source.seasons)) {
    setSeasonRecord(target, seasonKey, seasonValue);
  }

  return target;
}

/**
 * Attempt to read an existing FootballData JSON file.
 * @param {string} filePath
 * @returns {FootballData}
 */
export function loadFootballData(filePath: string): FootballData {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return createFootballData(parsed);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      return createFootballData();
    }
    throw err;
  }
}

/**
 * Persist FootballData to disk.
 * @param {string} filePath
 * @param {FootballData} data
 * @param {{ pretty?: boolean | number, metadata?: DatasetMetadata | Record<string, unknown> }} [options]
 */
export function saveFootballData(
  filePath: string,
  data: FootballData,
  options?: SaveFootballDataOptions
): void {
  const pretty = options?.pretty ?? true;
  const spacing = typeof pretty === 'number' ? pretty : pretty ? 2 : 0;
  const metadata = options?.metadata
    ? buildDatasetMetadata({
        .../** @type {Record<string, unknown>} */ (data.metadata || {}),
        .../** @type {Record<string, unknown>} */ (options.metadata),
      })
    : normaliseDatasetMetadata(data.metadata);

  if (metadata) {
    data.metadata = metadata;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, spacing));
}

/**
 * Convenience helper to upsert and persist a tier in one step.
 * @param {string} filePath
 * @param {string | number} seasonKey
 * @param {string} tierKey
 * @param {TierData | LeagueTableEntry[]} tierValue
 * @param {{ pretty?: boolean | number }} [options]
 * @returns {FootballData}
 */
export function updateFootballDataFile(
  filePath: string,
  seasonKey: string | number,
  tierKey: string,
  tierValue: TierData | LeagueTableEntry[],
  options?: SaveFootballDataOptions
): FootballData {
  const footballData = loadFootballData(filePath);
  upsertSeasonTier(footballData, seasonKey, tierKey, tierValue);
  saveFootballData(filePath, footballData, options);
  return footballData;
}

export default {
  buildDatasetMetadata,
  createFootballData,
  normaliseClubsMap,
  mergeClubsMap,
  normaliseLeagueTableEntry,
  buildTierData,
  upsertSeasonTier,
  setSeasonRecord,
  mergeFootballData,
  loadFootballData,
  saveFootballData,
  updateFootballDataFile,
};
