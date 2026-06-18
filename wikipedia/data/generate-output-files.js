// @ts-check

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WIKIPEDIA_DATA_SOURCES } from '../config.js';
import { isExpansionTeam, wasPromoted, wasRelegated } from '../utils.js';

/** @typedef {import('./models/output-file').LeagueTableEntry} LeagueTableEntry */
/** @typedef {import('./models/output-file').TierData} TierData */
/** @typedef {import('./models/output-file').SeasonData} SeasonData */
/** @typedef {import('./models/output-file').SeasonsMap} SeasonsMap */
/** @typedef {import('./models/output-file').FootballData} FootballData */
/** @typedef {import('./models/output-file').SeasonInfo} SeasonInfo */
/** @typedef {import('./models/output-file').DatasetMetadata} DatasetMetadata */
/** @typedef {import('./models/output-file').ClubMetadata} ClubMetadata */
/** @typedef {import('./models/output-file').ClubsMap} ClubsMap */

const NUMBER_FIELDS = [
  'pos',
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'points',
];
const OPTIONAL_NUMBER_FIELDS = ['goalDifference', 'goalAverage'];
const BOOLEAN_FIELDS = [
  'wasRelegated',
  'wasPromoted',
  'isExpansionTeam',
  'wasReElected',
  'wasReprieved',
];
const DATASET_SCHEMA_VERSION = 1;
let cachedGitSha;

/**
 * @param {string | number | null | undefined} value
 * @param {boolean} allowNull
 */
function toNumber(value, allowNull) {
  if (value == null || value === '') {
    if (allowNull) return null;
    return 0;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;

  throw new TypeError(`Expected numeric value, received: ${value}`);
}

/**
 * @param {unknown} value
 */
function toStringValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => toStringValue(entry)).filter((entry) => entry != null))
  );
}

function normalizeSeasonNumberArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => toSeasonNumberOrNull(entry))
        .filter((entry) => Number.isInteger(entry))
    )
  ).sort((a, b) => a - b);
}

/**
 * @param {unknown} value
 */
function toSeasonNumberOrNull(value) {
  if (value == null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBuildOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .map(([key, entry]) => {
      if (entry == null) return [key, null];
      if (['string', 'number', 'boolean'].includes(typeof entry)) return [key, entry];
      return null;
    })
    .filter(Boolean);

  if (!entries.length) return undefined;
  return Object.fromEntries(entries);
}

function normaliseDatasetMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const schemaVersion = Number(value.schemaVersion);
  const metadata = {
    schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : DATASET_SCHEMA_VERSION,
    generator: toStringValue(value.generator),
    generatedAt: toStringValue(value.generatedAt),
    gitSha: toStringValue(value.gitSha),
    sourceFiles: normalizeStringArray(value.sourceFiles),
    buildOptions: normalizeBuildOptions(value.buildOptions),
  };

  return Object.fromEntries(
    Object.entries(metadata).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === 'object') return Object.keys(entry).length > 0;
      return true;
    })
  );
}

/**
 * @param {unknown} value
 */
function normaliseClubNameHistory(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const history = [];

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
function normaliseClubFinancialEvents(value) {
  if (!Array.isArray(value)) return [];
  const events = [];
  const seen = new Set();

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const type = toStringValue(item.type);
    if (!type) continue;

    const seasonsMissed = Array.isArray(item.seasonsMissed)
      ? Array.from(
          new Set(
            item.seasonsMissed
              .map((entry) => toSeasonNumberOrNull(entry))
              .filter((entry) => Number.isInteger(entry))
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
function normaliseClubLifecycleEvents(value) {
  if (!Array.isArray(value)) return [];
  const events = [];
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
function normaliseClubTrackedMembership(value) {
  if (!Array.isArray(value)) return [];
  const memberships = [];
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
function normaliseClubAbsenceExplanations(value) {
  if (!Array.isArray(value)) return [];
  const explanations = [];
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
function normaliseClubHistory(value) {
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
function normaliseClubStatus(value) {
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
function normaliseObservedNamePeriods(value) {
  if (!Array.isArray(value)) return [];
  const periods = [];

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
function normaliseObservedNames(value) {
  if (!Array.isArray(value)) return [];
  const names = [];

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
function normaliseIdentitySources(value) {
  if (!Array.isArray(value)) return [];
  const sources = [];
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
function normaliseClubRelationships(value) {
  if (!Array.isArray(value)) return [];
  const relationships = [];
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
function normaliseTierSeasons(value) {
  if (!Array.isArray(value)) return [];
  const tiers = [];

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
function normaliseCoverageGaps(value) {
  if (!Array.isArray(value)) return [];
  const gaps = [];

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
function normaliseClubDerivedMetadata(value) {
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
function normaliseClubRecord(value, fallbackKey) {
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

  return /** @type {ClubMetadata} */ (cleaned);
}

/**
 * @param {unknown} value
 * @returns {ClubsMap | undefined}
 */
export function normaliseClubsMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  /** @type {ClubsMap} */
  const clubs = {};

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
export function mergeClubsMap(target, source) {
  if (!source || !Object.keys(source).length) return target;
  if (!target || !Object.keys(target).length) return { ...source };

  /** @type {ClubsMap} */
  const merged = { ...target };
  const sourceEntries = Object.entries(source);

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

function getCurrentGitSha(cwd = process.cwd()) {
  if (cachedGitSha !== undefined) return cachedGitSha;

  try {
    cachedGitSha = execSync('git rev-parse --short HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    cachedGitSha = null;
  }

  return cachedGitSha;
}

export function buildDatasetMetadata({
  generator,
  sourceFiles,
  buildOptions,
  generatedAt = new Date().toISOString(),
  gitSha = getCurrentGitSha(),
} = {}) {
  return normaliseDatasetMetadata({
    schemaVersion: DATASET_SCHEMA_VERSION,
    generator,
    generatedAt,
    gitSha,
    sourceFiles,
    buildOptions,
  });
}

/**
 * @param {unknown} value
 */
function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value == null) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) return false;
    if (['true', 'yes', 'y', 'promoted', 'relegated'].includes(normalized)) return true;
    if (['false', 'no', 'n'].includes(normalized)) return false;
  }
  return Boolean(value);
}

/**
 * Ensure we have a string array with no duplicates.
 * @param {unknown} value
 * @param {LeagueTableEntry[]} fallbackRows
 * @param {'wasRelegated' | 'wasPromoted'} flag
 */
function normaliseOutcomeList(value, fallbackRows, flag) {
  /** @type {Set<string>} */
  const results = new Set();

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
 * @param {Array<Partial<LeagueTableEntry> & Record<string, unknown>>} rows
 */
function sanitizeRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  /** @type {Array<Partial<LeagueTableEntry> & Record<string, unknown>>} */
  const sanitized = [];

  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const teamName = toStringValue(row.team);
    if (!teamName) continue;
    sanitized.push({ ...row, team: teamName });
  }

  return sanitized;
}

/**
 * Normalise a single league table entry.
 * @param {Partial<LeagueTableEntry> & Record<string, unknown>} raw
 * @returns {LeagueTableEntry}
 */
export function normaliseLeagueTableEntry(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('Expected an object to normalise LeagueTableEntry');
  }

  /** @type {Record<string, unknown>} */
  const record = { ...raw };
  const notes = toStringValue(record.notes);

  for (const key of NUMBER_FIELDS) {
    record[key] = toNumber(record[key], false);
  }
  for (const key of OPTIONAL_NUMBER_FIELDS) {
    record[key] = toNumber(record[key], true);
  }

  const goalsForNumber = Number.isFinite(record.goalsFor) ? record.goalsFor : null;
  const goalsAgainstNumber = Number.isFinite(record.goalsAgainst) ? record.goalsAgainst : null;
  if (goalsForNumber != null && goalsAgainstNumber != null) {
    record.goalDifference = goalsForNumber - goalsAgainstNumber;
  }

  const teamName = toStringValue(record.team);
  if (!teamName) {
    throw new TypeError('League table entry is missing a team name');
  }

  record.team = teamName;
  record.notes = notes;

  const derivedRelegated = wasRelegated(notes);
  const derivedPromoted = wasPromoted(notes);
  const derivedExpansion = isExpansionTeam(notes);
  const derivedReElected = notes ? notes.toLowerCase().includes('re-elected') : false;
  const derivedReprieved = notes
    ? /repriv(?:ed|e)d from re-election/i.test(notes.toLowerCase())
    : false;

  for (const key of BOOLEAN_FIELDS) {
    const value = record[key];
    if (typeof value === 'boolean') continue;

    switch (key) {
      case 'wasRelegated':
        record[key] = derivedRelegated;
        break;
      case 'wasPromoted':
        record[key] = derivedPromoted;
        break;
      case 'isExpansionTeam':
        record[key] = derivedExpansion;
        break;
      case 'wasReElected':
        record[key] = derivedReElected;
        break;
      case 'wasReprieved':
        record[key] = derivedReprieved;
        break;
      default:
        record[key] = false;
    }
  }

  for (const key of BOOLEAN_FIELDS) {
    record[key] = toBoolean(record[key]);
  }

  return /** @type {LeagueTableEntry} */ ({
    pos: record.pos,
    team: record.team,
    played: record.played,
    won: record.won,
    drawn: record.drawn,
    lost: record.lost,
    goalsFor: record.goalsFor,
    goalsAgainst: record.goalsAgainst,
    goalDifference: record.goalDifference,
    goalAverage: record.goalAverage,
    points: record.points,
    notes: record.notes,
    wasRelegated: record.wasRelegated,
    wasPromoted: record.wasPromoted,
    isExpansionTeam: record.isExpansionTeam,
    wasReElected: record.wasReElected,
    wasReprieved: record.wasReprieved,
  });
}

/**
 * @param {unknown} tierValue
 * @returns {tierValue is TierData}
 */
function isTierData(tierValue) {
  return (
    tierValue != null &&
    typeof tierValue === 'object' &&
    'season' in tierValue &&
    'table' in tierValue
  );
}

/**
 * @param {Record<string, unknown>} value
 */
function normaliseTierMetadata(value) {
  const directMetadata =
    value.metadata && typeof value.metadata === 'object'
      ? { .../** @type {Record<string, unknown>} */ (value.metadata) }
      : {};
  const legacySeasonMetadata =
    value.seasonMetadata && typeof value.seasonMetadata === 'object'
      ? { .../** @type {Record<string, unknown>} */ (value.seasonMetadata) }
      : {};

  const metadata = {
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
  return Object.keys(cleaned).length ? cleaned : undefined;
}

/**
 * @param {Record<string, unknown>} seasonInfoValue
 * @param {string} seasonKey
 * @returns {SeasonInfo}
 */
function normaliseSeasonInfo(seasonInfoValue, seasonKey) {
  const parsedSeason = Number.parseInt(String(seasonInfoValue.season ?? seasonKey), 10);
  const fallbackSeason = Number.parseInt(seasonKey, 10);
  const season = Number.isFinite(parsedSeason)
    ? parsedSeason
    : Number.isFinite(fallbackSeason)
    ? fallbackSeason
    : 0;

  const specialCompetitions = Array.isArray(seasonInfoValue.specialCompetitions)
    ? Array.from(
        new Set(
          seasonInfoValue.specialCompetitions
            .map((value) => toStringValue(value))
            .filter((value) => value != null)
        )
      )
    : [];

  return /** @type {SeasonInfo} */ ({
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
    notes: toStringValue(seasonInfoValue.notes),
  });
}

/**
 * @param {Record<string, unknown>} tierValue
 * @param {string} seasonKey
 */
function normaliseTierData(tierValue, seasonKey) {
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
  delete extra.sourceUrl;
  delete extra.seasonSlug;
  delete extra.tier;
  delete extra.title;
  delete extra.seasonMetadata;

  const metadata = normaliseTierMetadata(tierValue);

  return /** @type {TierData} */ ({
    ...extra,
    season,
    table: normalisedTable,
    relegated: normaliseOutcomeList(tierValue.relegated, normalisedTable, 'wasRelegated'),
    promoted: normaliseOutcomeList(tierValue.promoted, normalisedTable, 'wasPromoted'),
    ...(metadata ? { metadata } : {}),
  });
}

/**
 * Normalise raw season data into a SeasonData map.
 * @param {Record<string, unknown>} seasonValue
 * @param {string} seasonKey
 * @returns {SeasonData}
 */
function normaliseSeasonRecord(seasonValue, seasonKey) {
  /** @type {SeasonData} */
  const result = {};
  const entries = seasonValue && typeof seasonValue === 'object' ? seasonValue : {};

  for (const [tierKey, tierValue] of Object.entries(entries)) {
    if (
      tierKey === 'seasonInfo' &&
      tierValue &&
      typeof tierValue === 'object' &&
      !Array.isArray(tierValue)
    ) {
      result[tierKey] = normaliseSeasonInfo(
        /** @type {Record<string, unknown>} */ (tierValue),
        seasonKey
      );
    } else if (Array.isArray(tierValue)) {
      const sanitized = sanitizeRows(tierValue);
      result[tierKey] = sanitized.map((row) => normaliseLeagueTableEntry(row));
    } else if (isTierData(tierValue)) {
      result[tierKey] = normaliseTierData(tierValue, seasonKey);
    } else if (tierValue && typeof tierValue === 'object') {
      result[tierKey] = normaliseTierData(
        /** @type {Record<string, unknown>} */ (tierValue),
        seasonKey
      );
    }
  }

  return result;
}

/**
 * Create a FootballData container from partial data.
 * @param {Partial<FootballData> | Record<string, unknown>} [initial]
 * @returns {FootballData}
 */
export function createFootballData(initial) {
  const metadata =
    initial && typeof initial === 'object' && 'metadata' in initial
      ? normaliseDatasetMetadata(initial.metadata)
      : undefined;
  const clubs =
    initial && typeof initial === 'object' && 'clubs' in initial
      ? normaliseClubsMap(initial.clubs)
      : undefined;
  const seasonsSource =
    initial && typeof initial === 'object' && 'seasons' in initial
      ? /** @type {Record<string, unknown>} */ (initial?.seasons)
      : initial && typeof initial === 'object' && ('clubs' in initial || 'metadata' in initial)
      ? {}
      : /** @type {Record<string, unknown>} */ (initial || {});

  /** @type {SeasonsMap} */
  const seasons = {};
  for (const [seasonKey, seasonValue] of Object.entries(seasonsSource)) {
    if (!seasonValue || typeof seasonValue !== 'object') continue;
    seasons[seasonKey] = normaliseSeasonRecord(
      /** @type {Record<string, unknown>} */ (seasonValue),
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
export function buildTierData(season, tableRows, options = {}) {
  const seasonNumber = Number.parseInt(String(season), 10);
  const safeSeason = Number.isFinite(seasonNumber) ? seasonNumber : 0;
  const sanitizedRows = sanitizeRows(tableRows);
  const normalizedTable = sanitizedRows.map((row) => normaliseLeagueTableEntry(row));

  const promoted = normaliseOutcomeList(options.promoted, normalizedTable, 'wasPromoted');
  const relegated = normaliseOutcomeList(options.relegated, normalizedTable, 'wasRelegated');

  const tierData = /** @type {TierData} */ ({
    season: safeSeason,
    table: normalizedTable,
    promoted,
    relegated,
  });

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
export function buildSeasonInfo(season, options = {}) {
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
function ensureSeason(data, seasonKey) {
  if (!data.seasons[seasonKey]) {
    data.seasons[seasonKey] = /** @type {SeasonData} */ ({});
  }
  return /** @type {SeasonData} */ (data.seasons[seasonKey]);
}

/**
 * Upsert tier data for a season.
 * @param {FootballData} dataset
 * @param {string | number} seasonKey
 * @param {string} tierKey
 * @param {TierData | LeagueTableEntry[]} tierValue
 */
export function upsertSeasonTier(dataset, seasonKey, tierKey, tierValue) {
  if (!dataset || typeof dataset !== 'object' || !dataset.seasons) {
    throw new TypeError('Dataset must be a FootballData object');
  }

  const key = String(seasonKey);
  const seasonRecord = ensureSeason(dataset, key);

  if (Array.isArray(tierValue)) {
    seasonRecord[tierKey] = tierValue.map((row) => normaliseLeagueTableEntry(row));
  } else if (tierValue && typeof tierValue === 'object') {
    seasonRecord[tierKey] = normaliseTierData(
      /** @type {Record<string, unknown>} */ (tierValue),
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
export function setSeasonRecord(dataset, seasonKey, seasonValue) {
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
export function mergeFootballData(target, source) {
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
export function loadFootballData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return createFootballData(parsed);
  } catch (err) {
    if (err && /** @type {{ code?: string }} */ (err).code === 'ENOENT') {
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
export function saveFootballData(filePath, data, options) {
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
export function updateFootballDataFile(filePath, seasonKey, tierKey, tierValue, options) {
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
