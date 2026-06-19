import {
  cellText,
  isExpansionTeam,
  normalizeHeader,
  wasPromoted,
  wasRelegated,
  wasReprieved,
} from '../utils.js';

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

export function parseLegendText(rawText, options = {}) {
  const text = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  const {
    promoteKeywords = [/promot/, /play-?off winners?/],
    relegateKeywords = [/relegat/, /demot/],
  } = options;

  /** @type {Record<string, { promoted: boolean; relegated: boolean }>} */
  const legend = {};
  const regex = /\(([^)]+)\)\s*([^();]+)/g;
  let match;
  while ((match = regex.exec(text))) {
    const codes = splitLegendCodes(match[1]);
    const descriptor = String(match[2] || '')
      .trim()
      .toLowerCase();
    if (!codes.length) continue;

    for (const code of codes) {
      if (!legend[code]) {
        legend[code] = { promoted: false, relegated: false };
      }
      if (promoteKeywords.some((pattern) => pattern.test(descriptor))) {
        legend[code].promoted = true;
      }
      if (relegateKeywords.some((pattern) => pattern.test(descriptor))) {
        legend[code].relegated = true;
      }
    }
  }

  return Object.keys(legend).length ? legend : null;
}

export function extractLegendSymbols($, teamCell) {
  const symbols = new Set();
  if (!teamCell || !teamCell.length) return symbols;

  const capture = (text) => {
    if (!text) return;
    const regex = /\(([^()]+)\)/g;
    let match;
    while ((match = regex.exec(text))) {
      splitLegendCodes(match[1]).forEach((token) => {
        if (token) symbols.add(token.toUpperCase());
      });
    }
  };

  capture(teamCell.text());
  teamCell.find('*').each((_, node) => {
    capture($(node).text());
  });

  return symbols;
}

export function extractLegendForTable($, tableEl, options = {}) {
  if (!tableEl || !tableEl.length) return null;
  let cursor = tableEl.next();
  const isLegendNode = (node) => {
    if (!node || !node.length) return false;
    const cls = String(node.attr('class') || '');
    return /sports-table-notes/i.test(cls) || /legend/i.test(cls);
  };
  const breakAtNode = options.breakAtNode || ((node) => node.is('table'));
  const isHeadingNode = options.isHeadingNode || (() => false);

  while (cursor.length) {
    if (isLegendNode(cursor)) {
      const legendText = cursor
        .clone()
        .find('sup.reference, .reference, style, script')
        .remove()
        .end()
        .text();
      const parsed = parseLegendText(legendText, options);
      if (parsed) return parsed;
    }

    if (breakAtNode(cursor) || isHeadingNode(cursor)) return null;
    cursor = cursor.next();
  }

  return null;
}

function normalizeNumericText(value) {
  if (value == null) return null;
  const normalized = String(value)
    .replace(/[−–—]/g, '-')
    .replace(/[^\d.-]/g, '');
  if (normalized === '') return null;
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseLeagueTableRows($, tableEl, options = {}) {
  const {
    suppressPromotionFlags = false,
    legendMap = null,
    allowPromotionsFromLegend = true,
    headerIndex = 0,
    parseNotes = true,
  } = options;

  const rows = tableEl.find('tr');
  if (!rows.length) return [];

  const headerCells = rows.eq(headerIndex).find('th, td');
  const headerMap = [];
  headerCells.each((i, cell) => {
    headerMap[i] = normalizeHeader(cellText($, cell));
  });

  const idxOf = (field) => headerMap.findIndex((value) => value === field);
  let notesCarry = { text: null, remaining: 0 };

  const parsedRows = [];
  rows.slice(1).each((_, tr) => {
    const $tr = $(tr);
    const dataCells = $tr.find('td, th[scope="row"]');
    if (dataCells.length === 0) return;

    const cellElements = dataCells.toArray();
    const texts = cellElements.map((cell) => {
      if ($(cell).is('th[scope="row"]')) {
        const teamLinkText = $(cell).find('a').first().text().trim();
        return teamLinkText || cellText($, cell);
      }
      return cellText($, cell);
    });

    const isProbablyHeader =
      texts.every((value) => Number.isNaN(parseInt(value, 10))) &&
      texts.some((t) => /team|club|pld|pts/i.test(t));
    if (isProbablyHeader) return;

    const get = (field) => {
      const index = idxOf(field);
      if (index === -1) return undefined;
      return texts[index];
    };

    const row = {
      pos: normalizeNumericText(get('pos')),
      team: get('team') || null,
      played: normalizeNumericText(get('played')),
      won: normalizeNumericText(get('won')),
      drawn: normalizeNumericText(get('drawn')),
      lost: normalizeNumericText(get('lost')),
      goalsFor: normalizeNumericText(get('goalsFor')),
      goalsAgainst: normalizeNumericText(get('goalsAgainst')),
      goalDifference: normalizeNumericText(get('goalDifference')),
      goalAverage: normalizeNumericText(get('goalAverage')),
      points: normalizeNumericText(get('points')),
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

    if (parseNotes && notesIdx !== -1) {
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
    row.wasReprieved = wasReprieved(row.notes);

    const teamIndex = idxOf('team');
    if (!suppressPromotionFlags && legendMap && teamIndex !== -1 && cellElements[teamIndex]) {
      const symbols = extractLegendSymbols($, $(cellElements[teamIndex]));
      symbols.forEach((symbol) => {
        const legendEntry = legendMap[symbol];
        if (!legendEntry) return;
        if (allowPromotionsFromLegend && legendEntry.promoted) row.wasPromoted = true;
        if (legendEntry.relegated) row.wasRelegated = true;
      });
    }

    if (row.team && row.pos != null) {
      parsedRows.push(row);
    }
  });

  return parsedRows;
}
