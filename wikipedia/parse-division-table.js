import * as cheerio from 'cheerio';
import { isFirstDivision } from '../shared/utils.js';
import { WIKIPEDIA_DIVISION_HEADER_SLUGS, WIKIPEDIA_GENERIC_TABLE_FALLBACKS } from './config.js';
import { extractLegendForTable, parseLeagueTableRows } from './parser-core/league-table-parser.js';

function findDivisionHeader($, division) {
  const candidateSlugs = WIKIPEDIA_DIVISION_HEADER_SLUGS[division] || [];
  for (const slug of candidateSlugs) {
    const header = $(slug);
    if (header.length) return header;
  }

  const normalizedDivisionText = division === 'second' ? 'second division' : 'first division';
  const headlineMatch = $('span.mw-headline')
    .filter((_, el) => $(el).text().trim().toLowerCase().includes(normalizedDivisionText))
    .first();
  if (headlineMatch.length) return headlineMatch;

  for (const slug of WIKIPEDIA_GENERIC_TABLE_FALLBACKS) {
    const header = $(slug);
    if (header.length) return header;
  }

  return null;
}

/**
 * Parse a league division table from a Football League Wikipedia page.
 */
export function parseDivisionTable(html, division) {
  const $ = cheerio.load(html);

  // Step 1: Find the header
  const header = findDivisionHeader($, division);
  if (!header) {
    console.warn(
      `⚠️ No known league table header found for ${division} division in this season; returning empty table`
    );
    return [];
  }

  // Step 2: From that header, traverse forward to the first .wikitable
  const table = header.closest('div').nextAll('.wikitable').first();
  if (!table.length) {
    console.warn('⚠️ No league table element found after division header');
    return [];
  }
  const legendMap = extractLegendForTable($, table, {
    breakAtNode: (cursor) => cursor.is('table'),
    isHeadingNode: (cursor) => /^H[1-6]$/.test(String(cursor.prop('tagName') || '')),
  });

  return parseLeagueTableRows($, table, {
    suppressPromotionFlags: isFirstDivision(division),
    legendMap,
    allowPromotionsFromLegend: true,
  });
}

export default parseDivisionTable;
