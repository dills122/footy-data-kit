import * as cheerio from 'cheerio';
import { isFirstDivision } from '../utils.js';
import { cellText, isExpansionTeam, normalizeHeader, wasPromoted, wasRelegated } from './utils.js';

const DIVISION_HEADER_SLUGS = {
  first: ['#First_Division', '#Football_League_First_Division', '#First_Division_table'],
  second: ['#Second_Division', '#Football_League_Second_Division', '#Second_Division_table'],
};

const GENERIC_TABLE_FALLBACKS = ['#Final_league_table', '#League_table'];

function splitLegendCodes(raw) {
  return String(raw || '')
    .split(/[,/]|(?:\band\b)|(?:\bor\b)/gi)
    .map((code) =>
      code
        .replace(/[^A-Za-z0-9+]/g, '')
        .trim()
        .toUpperCase()
    )
    .filter(Boolean);
}

function parseLegendText(rawText) {
  const text = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  /** @type {Record<string, { promoted: boolean; relegated: boolean }>} */
  const legend = {};
  const regex = /\(([^)]+)\)\s*([^();]+)/g;
  let match;
  while ((match = regex.exec(text))) {
    const codes = splitLegendCodes(match[1]);
    const descriptor = match[2].trim().toLowerCase();
    if (!codes.length) continue;
    for (const code of codes) {
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
  }

  return Object.keys(legend).length ? legend : null;
}

function extractLegendSymbols($, teamCell) {
  const symbols = new Set();
  if (!teamCell || !teamCell.length) return symbols;

  const capture = (text) => {
    if (!text) return;
    const regex = /\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(text))) {
      splitLegendCodes(match[1]).forEach((code) => symbols.add(code));
    }
  };

  capture(teamCell.text());
  teamCell.find('*').each((_, node) => {
    const nodeText = $(node).text();
    capture(nodeText);
    splitLegendCodes(nodeText).forEach((code) => symbols.add(code));
  });

  return symbols;
}

function applyLegendStatuses($, teamCell, row, legendMap, division) {
  if (!legendMap) return;
  const suppressPromotion = isFirstDivision(division);
  const symbols = extractLegendSymbols($, teamCell);
  symbols.forEach((symbol) => {
    const entry = legendMap[symbol];
    if (!entry) return;
    if (entry.promoted && !suppressPromotion) row.wasPromoted = true;
    if (entry.relegated) row.wasRelegated = true;
  });
}

function extractLegendForTable($, tableEl) {
  if (!tableEl || !tableEl.length) return null;
  let cursor = tableEl.next();

  const isLegendNode = (node) => {
    if (!node || !node.length) return false;
    const cls = String(node.attr('class') || '');
    return /sports-table-notes/i.test(cls) || /legend/i.test(cls);
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
    const tag = String(cursor.prop('tagName') || '');
    if (/^H[1-6]$/.test(tag)) break;
    cursor = cursor.next();
  }

  return null;
}

function findDivisionHeader($, division) {
  const candidateSlugs = DIVISION_HEADER_SLUGS[division] || [];
  for (const slug of candidateSlugs) {
    const header = $(slug);
    if (header.length) return header;
  }

  const normalizedDivisionText = division === 'second' ? 'second division' : 'first division';
  const headlineMatch = $('span.mw-headline')
    .filter((_, el) => $(el).text().trim().toLowerCase().includes(normalizedDivisionText))
    .first();
  if (headlineMatch.length) return headlineMatch;

  for (const slug of GENERIC_TABLE_FALLBACKS) {
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
  const legendMap = extractLegendForTable($, table);

  // Build header map (index -> field)
  const headerRow = table.find('tr').first();
  const headerCells = headerRow.find('th');
  const headerMap = [];
  headerCells.each((i, th) => {
    const label = cellText($, th);
    headerMap[i] = normalizeHeader(label);
  });

  // Helper to find index by field name
  const idxOf = (field) => headerMap.findIndex((h) => h === field);

  // Track rowspan carryover for 'notes' column
  let notesCarry = { text: null, remaining: 0 };
  const results = [];

  // Iterate data rows (skip the header row)
  table
    .find('tr')
    .slice(1)
    .each((_, tr) => {
      const $tr = $(tr);

      // Skip sub-headers or separators
      const dataCells = $tr.find('td, th[scope="row"]');
      if (dataCells.length === 0) return;
      const cellElements = dataCells.toArray();

      // Collect texts
      const texts = cellElements.map((c) => {
        if ($(c).is('th[scope="row"]')) {
          const teamLink = $(c).find('a').first().text().trim();
          return teamLink || cellText($, c);
        }
        return cellText($, c);
      });

      const isProbablyHeader =
        texts.every((t) => Number.isNaN(parseInt(t, 10))) &&
        texts.some((t) => /team|club|pld|pts/i.test(t));
      if (isProbablyHeader) return;

      const get = (field) => {
        const i = idxOf(field);
        if (i === -1) return undefined;
        return texts[i];
      };

      const num = (v) => {
        if (v == null) return null;
        const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
        return Number.isNaN(n) ? null : n;
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

      // Handle notes
      let notesIdx = idxOf('notes');
      if (notesIdx === -1 && headerMap.length > 0) {
        // fallback: assume last column
        notesIdx = headerMap.length - 1;
      }

      if (notesIdx !== -1) {
        const rawNotesCell = $tr.find('td, th').get(notesIdx);
        if (rawNotesCell) {
          const text = cellText($, rawNotesCell) || null;
          row.notes = text?.length ? text : null;

          const rs = parseInt($(rawNotesCell).attr('rowspan') || '1', 10);
          if (!Number.isNaN(rs) && rs > 1) {
            notesCarry = { text: row.notes, remaining: rs - 1 };
          } else {
            notesCarry = { text: null, remaining: 0 };
          }
        } else if (notesCarry.remaining > 0) {
          row.notes = notesCarry.text;
          notesCarry.remaining -= 1;
        }
      }

      // Derive booleans from notes
      row.wasPromoted = isFirstDivision(division) ? false : wasPromoted(row.notes);
      row.wasRelegated = wasRelegated(row.notes);
      row.isExpansionTeam = isExpansionTeam(row.notes);

      // Extra explicit flags for clarity
      row.wasReElected = String(row.notes || '')
        .toLowerCase()
        .includes('re-elected');
      row.wasReprieved = /repriv(?:ed|ed) from re-election/.test(
        String(row.notes || '').toLowerCase()
      );

      const teamIdx = idxOf('team');
      if (teamIdx !== -1 && cellElements[teamIdx]) {
        applyLegendStatuses($, $(cellElements[teamIdx]), row, legendMap, division);
      }

      if (row.team && row.pos != null) {
        results.push(row);
      }
    });

  return results;
}

export default parseDivisionTable;
