import type { LeagueTableEntry } from '../models/output-file.ts';
import { isExpansionTeam, wasPromoted, wasRelegated, wasReprieved } from '../utils.js';

type LeagueTableEntryInput = Partial<LeagueTableEntry> & Record<string, unknown>;
type NumberField =
  | 'pos'
  | 'played'
  | 'won'
  | 'drawn'
  | 'lost'
  | 'goalsFor'
  | 'goalsAgainst'
  | 'points';
type OptionalNumberField = 'goalDifference' | 'goalAverage';
type BooleanField =
  | 'wasRelegated'
  | 'wasPromoted'
  | 'isExpansionTeam'
  | 'wasReElected'
  | 'wasReprieved';

const NUMBER_FIELDS: readonly NumberField[] = [
  'pos',
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'points',
];
const OPTIONAL_NUMBER_FIELDS: readonly OptionalNumberField[] = ['goalDifference', 'goalAverage'];
const BOOLEAN_FIELDS: readonly BooleanField[] = [
  'wasRelegated',
  'wasPromoted',
  'isExpansionTeam',
  'wasReElected',
  'wasReprieved',
];

function toNumber(value: string | number | null | undefined, allowNull: true): number | null;
function toNumber(value: string | number | null | undefined, allowNull: false): number;
function toNumber(value: string | number | null | undefined, allowNull: boolean): number | null {
  if (value == null || value === '') {
    if (allowNull) return null;
    return 0;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;

  throw new TypeError(`Expected numeric value, received: ${value}`);
}

function toStringValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function toBoolean(value: unknown): boolean {
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Normalise a single league table entry.
 */
export function normaliseLeagueTableEntry(raw: LeagueTableEntryInput): LeagueTableEntry {
  if (!raw || typeof raw !== 'object') {
    throw new TypeError('Expected an object to normalise LeagueTableEntry');
  }

  const record: Record<string, unknown> = { ...raw };
  const notes = toStringValue(record.notes);

  for (const key of NUMBER_FIELDS) {
    record[key] = toNumber(record[key] as string | number | null | undefined, false);
  }
  for (const key of OPTIONAL_NUMBER_FIELDS) {
    record[key] = toNumber(record[key] as string | number | null | undefined, true);
  }

  const goalsForNumber = isFiniteNumber(record.goalsFor) ? record.goalsFor : null;
  const goalsAgainstNumber = isFiniteNumber(record.goalsAgainst) ? record.goalsAgainst : null;
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
  const derivedReprieved = wasReprieved(notes);

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

  return {
    pos: record.pos as number,
    team: record.team as string,
    played: record.played as number,
    won: record.won as number,
    drawn: record.drawn as number,
    lost: record.lost as number,
    goalsFor: record.goalsFor as number,
    goalsAgainst: record.goalsAgainst as number,
    goalDifference: record.goalDifference as number | null,
    goalAverage: record.goalAverage as number | null,
    points: record.points as number,
    notes: record.notes as string | null,
    wasRelegated: record.wasRelegated as boolean,
    wasPromoted: record.wasPromoted as boolean,
    isExpansionTeam: record.isExpansionTeam as boolean,
    wasReElected: record.wasReElected as boolean,
    wasReprieved: record.wasReprieved as boolean,
  };
}
