import * as cheerio from 'cheerio';
import { isFirstDivision } from '../../shared/utils.js';
import { findDivisionHeader } from '../parser-core/wiki-division-header-finder.js';
import { extractLegendForTable, parseLeagueTableRows } from '../parser-core/league-table-parser.js';
import { getHeadingLevel } from '../parser-core/wiki-overview-parser.js';

function findTableInSection($, header, section) {
  const heading = header.closest('h2, h3, h4, h5, .mw-heading');
  const level = getHeadingLevel(heading);

  for (let anchor = header; !anchor.is(section); anchor = anchor.parent()) {
    for (let sibling = anchor.next(); sibling.length; sibling = sibling.next()) {
      const siblingLevel = getHeadingLevel(sibling);
      if (siblingLevel && (level === null || siblingLevel <= level)) return $();

      if (sibling.is('.wikitable')) return sibling;
      const nestedTable = sibling.find('.wikitable').first();
      if (nestedTable.length) return nestedTable;
    }
  }

  return $();
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

  const section = header.closest('section');
  const table = section.length
    ? findTableInSection($, header, section)
    : header.closest('div').nextAll('.wikitable').first();
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
