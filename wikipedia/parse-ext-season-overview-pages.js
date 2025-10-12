import * as cheerio from 'cheerio';
import * as path from 'node:path';
import {
  cellText,
  getWikipediaClient,
  isExpansionTeam,
  normalizeHeader,
  wait,
  wasPromoted,
  wasRelegated,
} from './utils.js';
import {
  buildTierData,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from './generate-output-files.js';
export { wait } from './utils.js';

function shouldTreatAsTopFlight(title) {
  const normalized = String(title || '').toLowerCase();
  return (
    normalized.includes('premier league') ||
    normalized.includes('first division') ||
    normalized.includes('football league premier division')
  );
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

function parseLeagueTable($, tableEl, { suppressPromotionFlags }) {
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

      const texts = [];
      dataCells.each((__, c) => {
        if ($(c).is('th[scope="row"]')) {
          const teamLinkText = $(c).find('a').first().text().trim();
          texts.push(teamLinkText || cellText($, c));
        } else {
          texts.push(cellText($, c));
        }
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

      if (row.team && row.pos != null) {
        results.push(row);
      }
    });

  return results;
}

export function parseOverviewLeagueTables(html) {
  const $ = cheerio.load(html);

  const leagueHeading = findLeagueSectionHeading($);
  if (!leagueHeading || !leagueHeading.length) {
    console.warn('⚠️ League tables section not found on this page');
    return [];
  }

  const overview = [];
  const headingWrapper = leagueHeading.closest('.mw-heading');
  let pointer = headingWrapper.length ? headingWrapper.next() : leagueHeading.next();

  while (pointer.length) {
    const level = getHeadingLevel(pointer);
    if (level === 2) break;

    if (level && level >= 3 && level <= 5) {
      const headingTag = `h${level}`;
      const headingEl = pointer.find(headingTag).first();
      if (!headingEl.length) {
        pointer = pointer.next();
        continue;
      }
      const leagueId =
        headingEl.attr('id') ||
        headingEl.find('[id]').first().attr('id') ||
        pointer.find('[id]').first().attr('id') ||
        null;
      const leagueTitle = headingEl.text().trim() || leagueId || 'Unknown league';
      const suppressPromotionFlags = shouldTreatAsTopFlight(leagueTitle);

      const tables = [];
      let searchNode = pointer.next();
      while (searchNode.length) {
        const searchLevel = getHeadingLevel(searchNode);
        if (searchLevel) {
          if (searchLevel <= level) break;
          searchNode = skipSection($, searchNode, searchLevel);
          continue;
        }

        if (searchNode.is('table') && searchNode.hasClass('wikitable')) {
          tables.push(searchNode);
        } else {
          searchNode.find('table.wikitable').each((_, tbl) => {
            tables.push($(tbl));
          });
        }

        searchNode = searchNode.next();
      }

      tables.forEach((table, index) => {
        const rows = parseLeagueTable($, table, { suppressPromotionFlags });
        if (!rows.length) return;

        overview.push({
          title: leagueTitle,
          id: leagueId,
          tableIndex: tables.length > 1 ? index : 0,
          rows,
        });
      });
    }

    pointer = pointer.next();
  }

  return overview;
}

export async function fetchSeasonOverviewTables(seasonSlug) {
  const wikipedia = await getWikipediaClient();
  const pageUrl = `https://en.wikipedia.org/wiki/${seasonSlug}`;
  let html;

  try {
    const page = await wikipedia.page(seasonSlug);
    html = await page.html();
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

function buildSeasonOverviewSeasonRecord({ seasonKey, seasonYear, seasonSlug, tables }) {
  const numericSeason = Number.isFinite(seasonYear)
    ? /** @type {number} */ (seasonYear)
    : Number.parseInt(seasonKey, 10);
  const safeSeason = Number.isFinite(numericSeason) ? numericSeason : 0;

  const seasonInfo = buildTierData(safeSeason, [], {
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

export async function buildSeasonOverview(startYear, endYear, outputFile) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  const dataset = loadFootballData(resolvedOutputFile);

  for (let year = startYear; year <= endYear; year++) {
    const slug = buildSeasonOverviewSlug(year);
    console.log(`\n📖 Fetching ${slug}...`);

    const tables = await fetchSeasonOverviewTables(slug);
    const seasonKey = String(year);
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
