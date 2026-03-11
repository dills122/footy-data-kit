import * as cheerio from 'cheerio';
import { isFirstDivision } from '../../shared/utils.js';
import { findDivisionHeader } from '../parser-core/wiki-division-header-finder.js';
import { extractLegendForTable, parseLeagueTableRows } from '../parser-core/league-table-parser.js';

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
