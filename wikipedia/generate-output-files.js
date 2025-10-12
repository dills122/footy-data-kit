// @ts-check

import * as fs from 'node:fs';
import * as path from 'node:path';
import { isExpansionTeam, wasPromoted, wasRelegated } from './utils.js';

/** @typedef {import('./models/output-file').LeagueTableEntry} LeagueTableEntry */
/** @typedef {import('./models/output-file').TierData} TierData */
/** @typedef {import('./models/output-file').SeasonData} SeasonData */
/** @typedef {import('./models/output-file').SeasonsMap} SeasonsMap */
/** @typedef {import('./models/output-file').FootballData} FootballData */

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

  return /** @type {TierData} */ ({
    ...extra,
    season,
    table: normalisedTable,
    relegated: normaliseOutcomeList(tierValue.relegated, normalisedTable, 'wasRelegated'),
    promoted: normaliseOutcomeList(tierValue.promoted, normalisedTable, 'wasPromoted'),
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
    if (Array.isArray(tierValue)) {
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
  const seasonsSource =
    initial && typeof initial === 'object' && 'seasons' in initial
      ? /** @type {Record<string, unknown>} */ (initial?.seasons)
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

  return /** @type {FootballData} */ ({ seasons });
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
    Object.assign(
      tierData,
      Object.fromEntries(
        Object.entries(options.metadata).filter(([key]) => !['season', 'table'].includes(key))
      )
    );
  }

  return tierData;
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
 * @param {{ pretty?: boolean | number }} [options]
 */
export function saveFootballData(filePath, data, options) {
  const pretty = options?.pretty ?? true;
  const spacing = typeof pretty === 'number' ? pretty : pretty ? 2 : 0;
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
  createFootballData,
  normaliseLeagueTableEntry,
  buildTierData,
  upsertSeasonTier,
  setSeasonRecord,
  mergeFootballData,
  loadFootballData,
  saveFootballData,
  updateFootballDataFile,
};
