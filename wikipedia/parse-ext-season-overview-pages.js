import * as cheerio from 'cheerio';
import * as path from 'node:path';
import {
  buildTierData,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from './generate-output-files.js';
import {
  cellText,
  fetchHtmlForSlug,
  isExpansionTeam,
  normalizeHeader,
  wait,
  wasPromoted,
  wasRelegated,
} from './utils.js';
export { wait } from './utils.js';

const LEAGUE_KEYWORDS = [
  'league',
  'division',
  'championship',
  'premier',
  'conference',
  'alliance',
  'combination',
  'section',
  'group',
];

const GENERIC_LEAGUE_HEADINGS = [
  'league table',
  'league tables',
  'final table',
  'final tables',
  'table',
  'tables',
  'league standings',
  'standings',
];

function shouldTreatAsTopFlight(title, context = {}) {
  const normalized = String(title || '').toLowerCase();
  if (normalized.includes('premier league')) return true;
  if (normalized.includes('football league premier division')) return true;
  if (normalized.includes('first division')) {
    if (context.hasPremierLeagueHeading) return false;
    return true;
  }
  return false;
}

function findLeagueSectionHeading($) {
  const idCandidates = [
    'League_tables',
    'League_table',
    'League_season',
    "League_season_(Men's)",
    'League_competitions',
    "League_competitions_(Men's)",
    'League_Competitions',
    "League_Competitions_(Men's)",
    'Final_standings',
    'Final_Standings',
    "Men's_football",
    'Mens_football',
  ];

  for (const id of idCandidates) {
    const match = $('h2').filter((_, el) => $(el).attr('id') === id);
    if (match.length) return match.first();
  }

  let bestHeading = null;
  let bestScore = -Infinity;

  $('h2').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (!text) return;

    const normalized = text.toLowerCase();
    let score = 0;

    if (/^league tables?/.test(normalized)) score = 100;
    else if (/^league season/.test(normalized)) score = 90;
    else if (/^league competitions/.test(normalized)) score = 80;
    else if (/^men's football/.test(normalized)) score = 75;
    else if (/^final standings/.test(normalized)) score = 95;
    else if (normalized.includes('league') && normalized.includes('table')) score = 70;

    if (!score) return;

    if (normalized.includes('men')) score += 5;
    if (normalized.includes('women')) score -= 5;

    if (score > bestScore || (score === bestScore && !bestHeading)) {
      bestHeading = $el;
      bestScore = score;
    }
  });

  return bestHeading;
}

function headingHasLeagueKeyword(title) {
  const normalized = String(title || '').toLowerCase();
  return LEAGUE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isGenericLeagueHeading(title) {
  if (!title) return false;
  const normalized = String(title).trim().toLowerCase();
  return GENERIC_LEAGUE_HEADINGS.includes(normalized);
}

function getHeadingLevel($el) {
  if (!$el || !$el.length) return null;
  const classes = String($el.attr('class') || '');
  const match = classes.match(/mw-heading(\d)/);
  if (!match) return null;
  const level = parseInt(match[1], 10);
  return Number.isFinite(level) ? level : null;
}

function skipSection($, headingEl, level) {
  if (!headingEl || !headingEl.length) return headingEl;
  let cursor = headingEl.next();

  while (cursor.length) {
    const cursorLevel = getHeadingLevel(cursor);
    if (cursorLevel) {
      if (cursorLevel <= level) {
        return cursor;
      }
      cursor = skipSection($, cursor, cursorLevel);
      continue;
    }
    cursor = cursor.next();
  }

  return cursor;
}

function parseLegendText(rawText) {
  const text = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  /** @type {Record<string, { promoted: boolean; relegated: boolean }>} */
  const legend = {};
  const regex = /\(([A-Za-z0-9+]+)\)\s*([^();]+)/g;
  let match;
  while ((match = regex.exec(text))) {
    const code = match[1].trim().toUpperCase();
    const descriptor = match[2].trim().toLowerCase();
    if (!code) continue;
    if (!legend[code]) {
      legend[code] = { promoted: false, relegated: false };
    }
    if (/promot/.test(descriptor) || /play-?off/.test(descriptor)) {
      legend[code].promoted = true;
    }
    if (/relegat/.test(descriptor) || /demot/.test(descriptor)) {
      legend[code].relegated = true;
    }
  }

  return Object.keys(legend).length ? legend : null;
}

function extractLegendForTable($, tableEl) {
  let cursor = tableEl.next();
  const isLegendNode = (node) => {
    if (!node || !node.length) return false;
    const cls = String(node.attr('class') || '');
    return /sports-table-notes/.test(cls) || /legend/.test(cls);
  };

  while (cursor.length) {
    if (isLegendNode(cursor)) {
      const legendText = cursor
        .clone()
        .find('sup.reference, .reference, style, script')
        .remove()
        .end()
        .text();
      const parsed = parseLegendText(legendText);
      if (parsed) return parsed;
    }

    if (cursor.is('table')) break;
    if (getHeadingLevel(cursor)) break;
    cursor = cursor.next();
  }

  return null;
}

function extractLegendSymbols($, teamCell) {
  const symbols = new Set();
  if (!teamCell || !teamCell.length) return symbols;
  const capture = (text) => {
    if (!text) return;
    const regex = /\(([A-Za-z0-9+]+)\)/g;
    let match;
    while ((match = regex.exec(text))) {
      symbols.add(match[1].toUpperCase());
    }
  };

  capture(teamCell.text());
  teamCell.find('*').each((_, node) => {
    const nodeText = $(node).text();
    capture(nodeText);
    const stripped = nodeText.replace(/[()]/g, '').trim();
    if (/^[A-Za-z0-9+]{1,3}$/.test(stripped)) {
      symbols.add(stripped.toUpperCase());
    }
  });
  return symbols;
}

function applyLegendStatuses($, teamCell, row, legendMap) {
  if (!legendMap) return;
  const symbols = extractLegendSymbols($, teamCell);
  symbols.forEach((symbol) => {
    const entry = legendMap[symbol];
    if (!entry) return;
    if (entry.promoted) row.wasPromoted = true;
    if (entry.relegated) row.wasRelegated = true;
  });
}

function parseLeagueTable($, tableEl, { suppressPromotionFlags, legendMap }) {
  const headerRow = tableEl.find('tr').first();
  const headerCells = headerRow.find('th, td');
  const headerMap = [];
  headerCells.each((i, cell) => {
    headerMap[i] = normalizeHeader(cellText($, cell));
  });

  const idxOf = (field) => headerMap.findIndex((h) => h === field);
  const results = [];
  let notesCarry = { text: null, remaining: 0 };

  tableEl
    .find('tr')
    .slice(1)
    .each((_, tr) => {
      const $tr = $(tr);
      const dataCells = $tr.find('td, th[scope="row"]');
      if (!dataCells.length) return;

      const cellElements = dataCells.toArray();
      const texts = cellElements.map((cell) => {
        if ($(cell).is('th[scope="row"]')) {
          const teamLinkText = $(cell).find('a').first().text().trim();
          return teamLinkText || cellText($, cell);
        }
        return cellText($, cell);
      });

      const isProbablyHeader =
        texts.every((t) => Number.isNaN(parseInt(t, 10))) &&
        texts.some((t) => /team|club|pld|pts/i.test(t));
      if (isProbablyHeader) return;

      const get = (field) => {
        const idx = idxOf(field);
        if (idx === -1) return undefined;
        return texts[idx];
      };

      const num = (value) => {
        if (value == null) return null;
        const normalizedValue = String(value).replace(/[^\d.-]/g, '');
        if (normalizedValue === '') return null;
        const parsed = parseFloat(normalizedValue);
        return Number.isNaN(parsed) ? null : parsed;
      };

      const row = {
        pos: num(get('pos')),
        team: get('team') || null,
        played: num(get('played')),
        won: num(get('won')),
        drawn: num(get('drawn')),
        lost: num(get('lost')),
        goalsFor: num(get('goalsFor')),
        goalsAgainst: num(get('goalsAgainst')),
        goalDifference: num(get('goalDifference')),
        goalAverage: num(get('goalAverage')),
        points: num(get('points')),
        notes: null,
        wasRelegated: null,
        wasPromoted: null,
        isExpansionTeam: null,
        wasReElected: null,
        wasReprieved: null,
      };

      let notesIdx = idxOf('notes');
      if (notesIdx === -1 && headerMap.length > 0) {
        notesIdx = headerMap.length - 1;
      }

      if (notesIdx !== -1) {
        const rawNotesCell = $tr.find('td, th').get(notesIdx);
        if (rawNotesCell) {
          const text = cellText($, rawNotesCell) || null;
          row.notes = text?.length ? text : null;

          const rowspan = parseInt($(rawNotesCell).attr('rowspan') || '1', 10);
          if (!Number.isNaN(rowspan) && rowspan > 1) {
            notesCarry = { text: row.notes, remaining: rowspan - 1 };
          } else {
            notesCarry = { text: null, remaining: 0 };
          }
        } else if (notesCarry.remaining > 0) {
          row.notes = notesCarry.text;
          notesCarry.remaining -= 1;
        }
      }

      row.wasRelegated = wasRelegated(row.notes);
      row.wasPromoted = suppressPromotionFlags ? false : wasPromoted(row.notes);
      row.isExpansionTeam = isExpansionTeam(row.notes);
      row.wasReElected = String(row.notes || '')
        .toLowerCase()
        .includes('re-elected');
      row.wasReprieved = /repriv(?:ed|ed) from re-election/.test(
        String(row.notes || '').toLowerCase()
      );

      const teamIdx = idxOf('team');
      if (teamIdx !== -1 && cellElements[teamIdx]) {
        applyLegendStatuses($, $(cellElements[teamIdx]), row, legendMap);
      }

      if (row.team && row.pos != null) {
        results.push(row);
      }
    });

  return results;
}

function parseTablesForHeading($, headingWrapper, { leagueTitle, leagueId } = {}, context = {}) {
  const level = getHeadingLevel(headingWrapper);
  if (!level) return [];

  const headingTag = `h${level}`;
  const headingEl = headingWrapper.find(headingTag).first();
  if (!headingEl.length) return [];

  const headingId = headingEl.attr('id') || leagueId || null;
  const headingTitle = headingEl.text().trim();
  let tableTitle = headingTitle || leagueTitle || headingId || 'Unknown league';
  if (leagueTitle && (isGenericLeagueHeading(headingTitle) || !headingTitle)) {
    tableTitle = leagueTitle;
  }

  const suppressPromotionFlags = shouldTreatAsTopFlight(tableTitle, context);
  const tables = [];
  let searchNode = headingWrapper.next();

  while (searchNode.length) {
    const searchLevel = getHeadingLevel(searchNode);
    if (searchLevel) {
      if (searchLevel <= level) break;
      searchNode = skipSection($, searchNode, searchLevel);
      continue;
    }

    if (searchNode.is('table') && searchNode.hasClass('wikitable')) {
      tables.push({ element: searchNode, legend: extractLegendForTable($, searchNode) });
    } else {
      searchNode.find('table.wikitable').each((_, tbl) => {
        const $tbl = $(tbl);
        tables.push({ element: $tbl, legend: extractLegendForTable($, $tbl) });
      });
    }

    searchNode = searchNode.next();
  }

  const overviewEntries = [];
  tables.forEach((table, index) => {
    const rows = parseLeagueTable($, table.element, {
      suppressPromotionFlags,
      legendMap: table.legend,
    });
    if (!rows.length) return;
    overviewEntries.push({
      title: tableTitle,
      id: headingId,
      tableIndex: tables.length > 1 ? index : 0,
      rows,
    });
  });

  return overviewEntries;
}

export function parseOverviewLeagueTables(html) {
  const $ = cheerio.load(html);
  const hasPremierLeagueHeading = Boolean(
    $('h2, h3, h4, h5').filter((_, el) => $(el).text().toLowerCase().includes('premier league'))
      .length
  );
  const context = { hasPremierLeagueHeading };
  const leagueHeading = findLeagueSectionHeading($);
  if (!leagueHeading || !leagueHeading.length) {
    const overview = [];
    const headingStack = [];
    $('.mw-heading').each((_, el) => {
      const $headingWrapper = $(el);
      const level = getHeadingLevel($headingWrapper);
      if (!level || level < 2 || level > 5) return;

      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }

      const headingTag = `h${level}`;
      const $headingEl = $headingWrapper.find(headingTag).first();
      if (!$headingEl.length) {
        headingStack.push({ level, title: null, id: null, hasLeagueContext: false });
        return;
      }

      const rawTitle = $headingEl.text().trim();
      const headingId = $headingEl.attr('id') || null;
      const hasKeyword = headingHasLeagueKeyword(rawTitle);
      const inheritsContext = headingStack.some((parent) => parent.hasLeagueContext);
      const hasLeagueContext = hasKeyword || inheritsContext;

      const ancestorForFallback = [...headingStack]
        .slice()
        .reverse()
        .find((ancestor) => ancestor.hasLeagueContext && ancestor.title);

      headingStack.push({
        level,
        title: rawTitle,
        id: headingId,
        hasLeagueContext,
      });

      if (!hasLeagueContext) return;

      let fallbackTitle = null;
      let fallbackId = null;
      if (isGenericLeagueHeading(rawTitle) && ancestorForFallback) {
        fallbackTitle = ancestorForFallback.title;
        fallbackId = ancestorForFallback.id;
      }

      const entries = parseTablesForHeading(
        $,
        $headingWrapper,
        {
          leagueTitle: fallbackTitle || undefined,
          leagueId: fallbackId || undefined,
        },
        context
      );
      overview.push(...entries);
    });

    if (!overview.length) {
      console.warn('⚠️ League tables section not found on this page');
    }

    return overview;
  }

  const overview = [];
  const headingWrapper = leagueHeading.closest('.mw-heading');
  let pointer = headingWrapper.length ? headingWrapper.next() : leagueHeading.next();

  while (pointer.length) {
    const level = getHeadingLevel(pointer);
    if (level === 2) break;

    if (level && level >= 3 && level <= 5) {
      const entries = parseTablesForHeading($, pointer, undefined, context);
      overview.push(...entries);
    }

    pointer = pointer.next();
  }

  return overview;
}

export async function fetchSeasonOverviewTables(seasonSlug) {
  const pageUrl = `https://en.wikipedia.org/wiki/${seasonSlug}`;
  let html;

  try {
    html = await fetchHtmlForSlug(seasonSlug);
  } catch (err) {
    console.error(`❌ Failed to fetch page for ${seasonSlug} (${pageUrl}): ${err.message}`);
    return [];
  }

  await wait(1000);

  const leagueTables = parseOverviewLeagueTables(html);
  if (!leagueTables.length) {
    console.warn(`⚠️ No league tables found on ${seasonSlug} (${pageUrl})`);
  } else {
    console.log(`   📊 Found ${leagueTables.length} league tables on ${seasonSlug}`);
  }

  return leagueTables;
}

export function buildSeasonOverviewSlug(year) {
  const nextYear = year + 1;
  const nextYearPart =
    nextYear % 100 === 0 ? String(nextYear) : String(nextYear).slice(-2).padStart(2, '0');
  return `${year}\u2013${nextYearPart}_in_English_football`;
}

function resolveOverviewOutputFile(outputFile) {
  if (outputFile) return path.resolve(outputFile);
  return path.resolve('./data-output/wiki_overview_tables_by_season.json');
}

function deriveSeasonKeyFromSlug(slug) {
  if (!slug) return 'unknown-season';
  const match = String(slug).match(/\d{4}/);
  return match ? match[0] : String(slug);
}

function deriveSeasonYearFromSlug(slug) {
  const key = deriveSeasonKeyFromSlug(slug);
  const numeric = Number.parseInt(key, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

const WWI_SUSPENSION_YEARS = new Set([1915, 1916, 1917, 1918, 1919]);
const WWII_SUSPENSION_YEARS = new Set([1940, 1941, 1942, 1943, 1944, 1945, 1946]);

function seasonHasTierData(record) {
  if (!record || typeof record !== 'object') return false;
  const tierKeys = Object.keys(record).filter((key) => /^tier\d+/i.test(key));
  if (!tierKeys.length) return false;
  return tierKeys.some((key) => {
    const tier = record[key];
    if (!tier || typeof tier !== 'object') return false;
    if (Array.isArray(tier)) {
      return tier.length > 0;
    }
    if (Array.isArray(tier.table)) {
      return tier.table.length > 0;
    }
    return false;
  });
}

function isWarSuspensionYear(year) {
  if (!Number.isFinite(year)) return false;
  return WWI_SUSPENSION_YEARS.has(year) || WWII_SUSPENSION_YEARS.has(year);
}

function collectOutcomeTeams(tables, flag) {
  const teams = new Set();
  tables.forEach((table) => {
    table.rows.forEach((row) => {
      if (row && row[flag] && row.team) {
        teams.add(row.team);
      }
    });
  });
  return Array.from(teams);
}

function buildSeasonOverviewSeasonRecord({ seasonKey, seasonYear, seasonSlug, tables }) {
  const numericSeason = Number.isFinite(seasonYear)
    ? /** @type {number} */ (seasonYear)
    : Number.parseInt(seasonKey, 10);
  const safeSeason = Number.isFinite(numericSeason) ? numericSeason : 0;
  const promotedTeams = collectOutcomeTeams(tables, 'wasPromoted');
  const relegatedTeams = collectOutcomeTeams(tables, 'wasRelegated');

  const seasonInfo = buildTierData(safeSeason, [], {
    promoted: promotedTeams,
    relegated: relegatedTeams,
    metadata: {
      seasonSlug,
      tableCount: tables.length,
    },
  });

  const record = { seasonInfo };

  tables.forEach((table, index) => {
    const tierKey = `tier${index + 1}`;
    record[tierKey] = buildTierData(safeSeason, table.rows, {
      metadata: {
        title: table.title,
        seasonMetadata: {
          leagueId: table.id || null,
          tableIndex: table.tableIndex ?? index,
          tableCount: tables.length,
          seasonSlug,
        },
      },
    });
  });

  return record;
}

export async function buildSeasonOverview(startYear, endYear, outputFile, options = {}) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  const dataset = loadFootballData(resolvedOutputFile);
  const updateOnly = Boolean(options.updateOnly);
  const forceUpdate = Boolean(options.forceUpdate);
  const ignoreWarYears = Boolean(options.ignoreWarYears);
  const fetchTables =
    typeof options.fetchSeasonOverviewTables === 'function'
      ? options.fetchSeasonOverviewTables
      : fetchSeasonOverviewTables;

  for (let year = startYear; year <= endYear; year++) {
    const seasonKey = String(year);
    const existingRecord = dataset.seasons?.[seasonKey];
    if (!forceUpdate && updateOnly && seasonHasTierData(existingRecord)) {
      console.log(`⏭️ Skipping ${seasonKey} (existing tier data)`);
      continue;
    }

    if (ignoreWarYears && isWarSuspensionYear(year)) {
      console.log(`⏭️ Skipping ${seasonKey} (WWI/WWII suspension)`);
      continue;
    }

    const slug = buildSeasonOverviewSlug(year);
    console.log(`\n📖 Fetching ${slug}...`);

    const tables = await fetchTables(slug);
    const hasTableData = tables.some((table) => table.rows && table.rows.length);
    if (forceUpdate && existingRecord && !hasTableData) {
      console.log(`⏭️ Skipping overwrite for ${seasonKey} (no tables returned)`);
      continue;
    }
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey,
      seasonYear: year,
      seasonSlug: slug,
      tables,
    });

    setSeasonRecord(dataset, seasonKey, seasonRecord);
    saveFootballData(resolvedOutputFile, dataset);
  }

  console.log(
    `\n✅ Finished building overview data for ${Object.keys(dataset.seasons).length} seasons.`
  );
  return dataset;
}

export async function buildSeasonOverviewForSlug(seasonSlug, outputFile) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  console.log(`\n📖 Fetching ${seasonSlug}...`);
  const tables = await fetchSeasonOverviewTables(seasonSlug);
  const seasonKey = deriveSeasonKeyFromSlug(seasonSlug);
  const seasonYear = deriveSeasonYearFromSlug(seasonSlug);
  const dataset = loadFootballData(resolvedOutputFile);
  const seasonRecord = buildSeasonOverviewSeasonRecord({
    seasonKey,
    seasonYear,
    seasonSlug,
    tables,
  });

  setSeasonRecord(dataset, seasonKey, seasonRecord);
  saveFootballData(resolvedOutputFile, dataset);
  console.log(`\n📂 Overview tables written to ${resolvedOutputFile}`);
  return { seasonKey, record: dataset.seasons[seasonKey] };
}

export default {
  wait,
  fetchSeasonOverviewTables,
  buildSeasonOverviewSlug,
  buildSeasonOverview,
  buildSeasonOverviewForSlug,
  parseOverviewLeagueTables,
};
