import * as cheerio from 'cheerio';
import * as path from 'node:path';
import {
  cellText,
  getWikipediaClient,
  isExpansionTeam,
  normalizeHeader,
  saveResults,
  wait,
  wasPromoted,
  wasRelegated,
} from './utils.js';
export { saveResults, wait } from './utils.js';

function shouldTreatAsTopFlight(title) {
  const normalized = String(title || '').toLowerCase();
  return (
    normalized.includes('premier league') ||
    normalized.includes('first division') ||
    normalized.includes('football league premier division')
  );
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

  const leagueHeading = $('#League_tables');
  if (!leagueHeading.length) {
    console.warn('⚠️ League tables section not found on this page');
    return [];
  }

  const overview = [];
  let pointer = leagueHeading.parent().next();

  while (pointer.length) {
    if (pointer.hasClass('mw-heading2')) break;

    if (pointer.hasClass('mw-heading3')) {
      const h3 = pointer.find('h3').first();
      const leagueId = h3.attr('id') || null;
      const leagueTitle = h3.text().trim() || leagueId || 'Unknown league';
      const suppressPromotionFlags = shouldTreatAsTopFlight(leagueTitle);

      const tables = [];
      let searchNode = pointer.next();
      while (searchNode.length) {
        if (searchNode.hasClass('mw-heading2') || searchNode.hasClass('mw-heading3')) break;

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

export async function buildSeasonOverview(startYear, endYear, outputFile) {
  const results = { seasons: {} };
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);

  for (let year = startYear; year <= endYear; year++) {
    const slug = buildSeasonOverviewSlug(year);
    console.log(`\n📖 Fetching ${slug}...`);

    const tables = await fetchSeasonOverviewTables(slug);
    results.seasons[year] = { slug, tables };

    saveResults(results, resolvedOutputFile);
  }

  console.log(
    `\n✅ Finished building overview data for ${Object.keys(results.seasons).length} seasons.`
  );
  return results;
}

export async function buildSeasonOverviewForSlug(seasonSlug, outputFile) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  console.log(`\n📖 Fetching ${seasonSlug}...`);
  const tables = await fetchSeasonOverviewTables(seasonSlug);
  const result = { slug: seasonSlug, tables };
  saveResults(result, resolvedOutputFile);
  console.log(`\n📂 Overview tables written to ${resolvedOutputFile}`);
  return result;
}

export default {
  wait,
  saveResults,
  fetchSeasonOverviewTables,
  buildSeasonOverviewSlug,
  buildSeasonOverview,
  buildSeasonOverviewForSlug,
  parseOverviewLeagueTables,
};
