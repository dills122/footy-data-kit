import * as cheerio from 'cheerio';
import { toTitleCase } from '../utils.js';

const DEFAULT_ENCODING = 'windows-1252';
const STAT_COLUMN_TITLES = [
  'played',
  'homeWins',
  'homeDraws',
  'homeLosses',
  'homeGoalsFor',
  'homeGoalsAgainst',
  'awayWins',
  'awayDraws',
  'awayLosses',
  'awayGoalsFor',
  'awayGoalsAgainst',
  'goalDifference',
  'points',
];
const STAT_COLUMN_COUNT = STAT_COLUMN_TITLES.length;
const MIN_STAT_COLUMN_COUNT = STAT_COLUMN_COUNT - 1;
const NUMERIC_TOKEN = /^-?\d+$/;
const NOTE_RE_PROMOTED = /promot/i;
const NOTE_RE_RELEGATED = /relegat|demoted to the|dropped to the|relegated to the|sent down to/i;
const NOTE_RE_REELECTED = /re-?elected/;
const NOTE_RE_REPRIEVED = /reprie(?:v|e)d from re-?election/;
const NOTE_RE_EXPANSION = /expansion|new club|admitted|joined league|first time in the league/i;

function detectEncodingFromContentType(contentType = '') {
  const match = contentType.match(/charset=([^;]+)/i);
  if (!match) return null;
  return match[1].trim().toLowerCase();
}

export function decodeRsssfBuffer(buffer, encoding = DEFAULT_ENCODING) {
  const decoder = new TextDecoder(encoding);
  return decoder.decode(buffer);
}

export async function fetchRsssfPage(url, fetchImpl = globalThis.fetch) {
  if (!url) throw new Error('Missing RSSSF URL');

  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const encoding = detectEncodingFromContentType(contentType) || DEFAULT_ENCODING;
  const buffer = await response.arrayBuffer();

  try {
    return decodeRsssfBuffer(buffer, encoding);
  } catch (err) {
    if (encoding !== 'utf-8') {
      return decodeRsssfBuffer(buffer, 'utf-8');
    }
    throw err;
  }
}

function splitHeading(rawHeading) {
  if (!rawHeading) return { heading: null, league: null, season: null, seasonSlug: null };

  const trimmed = rawHeading.trim();
  const parts = trimmed.split(' - ');
  if (parts.length === 1) {
    return {
      heading: trimmed,
      league: trimmed,
      season: null,
      seasonSlug: null,
    };
  }

  const season = parts.pop().trim();
  const league = parts.join(' - ').trim();
  return {
    heading: trimmed,
    league,
    season,
    seasonSlug: season
      ? season.replace(/[^\d]+/g, '').slice(0, 8) || season.replace(/\s+/g, '-')
      : null,
  };
}

function sanitiseSeasonSlug(season) {
  if (!season) return null;

  const cleaned = season.replace(/[^\d/\\-]+/g, '').replace(/[/\\]/g, '-');
  if (!cleaned) return null;
  const condensed = cleaned.replace(/--+/g, '-').replace(/^-|-$/g, '');
  return condensed || null;
}

function parseNoteLine(line) {
  const trimmed = line.trim();
  const symbolMatch = trimmed.match(/^([+*#@^]+)/);
  if (!symbolMatch) {
    return { symbol: '+', text: trimmed };
  }

  const symbol = symbolMatch[1];
  const text = trimmed.slice(symbol.length).trim();
  return { symbol, text };
}

function isTableDataLine(line) {
  return /^\s*\d+/.test(line);
}

function findStatsStart(tokens) {
  const candidateLengths = [STAT_COLUMN_COUNT, MIN_STAT_COLUMN_COUNT];
  for (let i = 0; i < tokens.length; i += 1) {
    for (const length of candidateLengths) {
      if (i > tokens.length - length) continue;
      const slice = tokens.slice(i, i + length);
      if (slice.every((token) => NUMERIC_TOKEN.test(token))) {
        return { index: i, length };
      }
    }
  }
  return null;
}

function parseStats(tokens) {
  const values = tokens.map((token) => Number.parseInt(token, 10));
  if (values.some((value) => Number.isNaN(value))) return null;

  let played;
  let homeWins;
  let homeDraws;
  let homeLosses;
  let homeGoalsFor;
  let homeGoalsAgainst;
  let awayWins;
  let awayDraws;
  let awayLosses;
  let awayGoalsFor;
  let awayGoalsAgainst;
  let goalDifference;
  let points;

  if (values.length === STAT_COLUMN_COUNT) {
    [
      played,
      homeWins,
      homeDraws,
      homeLosses,
      homeGoalsFor,
      homeGoalsAgainst,
      awayWins,
      awayDraws,
      awayLosses,
      awayGoalsFor,
      awayGoalsAgainst,
      goalDifference,
      points,
    ] = values;
  } else if (values.length === MIN_STAT_COLUMN_COUNT) {
    [
      played,
      homeWins,
      homeDraws,
      homeLosses,
      homeGoalsFor,
      homeGoalsAgainst,
      awayWins,
      awayDraws,
      awayLosses,
      awayGoalsFor,
      awayGoalsAgainst,
      points,
    ] = values;
    goalDifference = homeGoalsFor + awayGoalsFor - (homeGoalsAgainst + awayGoalsAgainst);
  } else {
    return null;
  }

  const home = {
    wins: homeWins,
    draws: homeDraws,
    losses: homeLosses,
    goalsFor: homeGoalsFor,
    goalsAgainst: homeGoalsAgainst,
  };

  const away = {
    wins: awayWins,
    draws: awayDraws,
    losses: awayLosses,
    goalsFor: awayGoalsFor,
    goalsAgainst: awayGoalsAgainst,
  };

  const overallWins = home.wins + away.wins;
  const overallDraws = home.draws + away.draws;
  const overallLosses = home.losses + away.losses;
  const overallGoalsFor = home.goalsFor + away.goalsFor;
  const overallGoalsAgainst = home.goalsAgainst + away.goalsAgainst;
  const overall = {
    played: overallWins + overallDraws + overallLosses,
    wins: overallWins,
    draws: overallDraws,
    losses: overallLosses,
    goalsFor: overallGoalsFor,
    goalsAgainst: overallGoalsAgainst,
    goalDifference: overallGoalsFor - overallGoalsAgainst,
  };

  return {
    played,
    points,
    goalDifference,
    goalAverage: null,
    home,
    away,
    wins: home.wins + away.wins,
    draws: home.draws + away.draws,
    losses: home.losses + away.losses,
    goalsFor: home.goalsFor + away.goalsFor,
    goalsAgainst: home.goalsAgainst + away.goalsAgainst,
    overall,
  };
}

function parseTableRow(line, estPositions, isFirstDivision) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < MIN_STAT_COLUMN_COUNT + 1) return null;

  const positionToken = tokens[0];
  const restTokens = tokens.slice(1);
  const statStart = findStatsStart(restTokens);

  if (!statStart) return null;

  const teamTokens = restTokens.slice(0, statStart.index);
  const statTokens = restTokens.slice(statStart.index, statStart.index + statStart.length);
  const trailingTokens = restTokens.slice(statStart.index + statStart.length);

  const team = teamTokens.join(' ').trim();
  if (!team) return null;

  const position = Number.parseInt(positionToken.replace(/[^\d]/g, ''), 10);
  if (Number.isNaN(position)) return null;

  const stats = parseStats(statTokens);
  if (!stats) return null;
  const markers = trailingTokens.filter(Boolean);
  const isHighlighted = team === team.toUpperCase() && team.length > 1;

  const isPromotionRelegationCanidate = team === `${team}`.toUpperCase();
  const isTopHalfLeague = (pos) => pos <= Math.floor(estPositions / 2);

  return {
    pos: position,
    team,
    played: stats.played,
    won: stats.overall.wins,
    drawn: stats.overall.draws,
    lost: stats.overall.losses,
    goalsFor: stats.overall.goalsFor,
    goalsAgainst: stats.overall.goalsAgainst,
    goalDifference: stats.goalDifference,
    goalAverage: stats.goalAverage,
    points: stats.points,
    notes: null,
    wasRelegated: isPromotionRelegationCanidate && !isTopHalfLeague(position),
    wasPromoted: !isFirstDivision && isPromotionRelegationCanidate && isTopHalfLeague(position),
    isExpansionTeam: false,
    wasReElected: false,
    wasReprieved: false,
    meta: {
      homeRecord: stats.home,
      awayRecord: stats.away,
      overallRecord: stats.overall,
      rawLine: line,
      markers,
      highlighted: isHighlighted,
    },
  };
}

export function parseCompetitionBlock(text, isFirstDivision) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim().length);
  if (firstContentIndex === -1) return null;

  const headingLine = lines[firstContentIndex].trim();
  const headerIndex = lines.findIndex(
    (line, idx) =>
      idx > firstContentIndex && /\bP\s+W\s+D\s+L\s+F\s+A\s+W\s+D\s+L\s+F\s+A\b/i.test(line)
  );

  if (headerIndex === -1) return null;

  const notes = [];
  const rows = [];
  for (let idx = headerIndex + 1; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^<hr>/i.test(trimmed)) break;

    if (/^[+*#@^]/.test(trimmed)) {
      notes.push(parseNoteLine(trimmed));
      continue;
    }

    if (!isTableDataLine(trimmed)) break;

    const row = parseTableRow(line, lines.length, isFirstDivision);
    if (row) {
      rows.push(row);
      continue;
    }
    break;
  }

  if (!rows.length) return null;

  const noteLookup = new Map();
  for (const note of notes) {
    const key = note.symbol;
    const existing = noteLookup.get(key) || [];
    existing.push(note.text);
    noteLookup.set(key, existing);
  }

  const processedRows = rows.map((row) => {
    const noteSymbols = row.meta?.markers || [];
    const attachedNotes = noteSymbols.flatMap((symbol) => noteLookup.get(symbol) || []);
    const noteText = attachedNotes.length ? attachedNotes.join(' ') : null;
    const loweredNotes = (noteText || '').toLowerCase();
    const wasPromoted = NOTE_RE_PROMOTED.test(loweredNotes);
    const wasRelegated = NOTE_RE_RELEGATED.test(loweredNotes);
    const wasReElected = NOTE_RE_REELECTED.test(loweredNotes);
    const wasReprieved = NOTE_RE_REPRIEVED.test(loweredNotes);
    const isExpansionTeam = NOTE_RE_EXPANSION.test(loweredNotes);

    row.notes = noteText;
    row.wasPromoted = row.wasPromoted ?? wasPromoted;
    row.wasRelegated = row.wasRelegated ?? wasRelegated;
    row.wasReElected = wasReElected;
    row.wasReprieved = wasReprieved;
    row.isExpansionTeam = isExpansionTeam;
    row.team = toTitleCase(row.team);

    return row;
  });

  const headingInfo = splitHeading(headingLine);
  return {
    heading: headingInfo.heading,
    league: headingInfo.league,
    season: headingInfo.season,
    seasonSlug: sanitiseSeasonSlug(headingInfo.season) || headingInfo.seasonSlug,
    notes,
    rows: processedRows,
  };
}

export function parseRsssfPage(html, options = {}) {
  const { source = null } = options;
  const $ = cheerio.load(html);
  const competitions = [];

  $('pre').each((_, el) => {
    const text = $(el).text();
    const competition = parseCompetitionBlock(text, competitions.length === 0);
    if (competition) {
      competitions.push(competition);
    }
  });

  const seasonLabels = Array.from(
    new Set(competitions.map((competition) => competition.season).filter(Boolean))
  );
  const season = seasonLabels.length === 1 ? seasonLabels[0] : seasonLabels;
  const seasonSlugCandidates = competitions
    .map((competition) => competition.seasonSlug)
    .filter(Boolean);
  const seasonSlug = seasonSlugCandidates.find(Boolean) || null;

  return {
    source,
    scrapedAt: new Date().toISOString(),
    season,
    seasonSlug,
    competitions,
  };
}
