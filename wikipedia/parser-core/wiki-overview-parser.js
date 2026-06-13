import { inferEnglishLeagueTier, WIKIPEDIA_OVERVIEW_CONFIG } from '../config.js';
import { extractLegendForTable, parseLeagueTableRows } from './league-table-parser.js';

export function shouldTreatAsTopFlight(title, context = {}) {
  const normalized = String(title || '').toLowerCase();
  if (WIKIPEDIA_OVERVIEW_CONFIG.topFlightKeywords.some((keyword) => normalized.includes(keyword))) {
    return true;
  }
  if (normalized.includes('first division')) {
    if (context.hasPremierLeagueHeading) return false;
    return true;
  }
  return false;
}

export function findLeagueSectionHeading($, options = {}) {
  const idCandidates = options.sectionHeadingIds || WIKIPEDIA_OVERVIEW_CONFIG.sectionHeadingIds;

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
    else if (/^(the )?football league$/.test(normalized)) score = 92;
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

export function headingHasLeagueKeyword(title) {
  const normalized = String(title || '').toLowerCase();
  return WIKIPEDIA_OVERVIEW_CONFIG.leagueKeywords.some((keyword) => normalized.includes(keyword));
}

export function isGenericLeagueHeading(title) {
  if (!title) return false;
  const normalized = String(title).trim().toLowerCase();
  return WIKIPEDIA_OVERVIEW_CONFIG.genericLeagueHeadings.includes(normalized);
}

export function isExcludedOverviewCompetitionLabel(...labels) {
  const combined = labels
    .map((label) =>
      String(label || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)
    .join(' ');

  if (!combined) return false;

  return WIKIPEDIA_OVERVIEW_CONFIG.excludedCompetitionKeywords.some((keyword) =>
    combined.includes(keyword)
  );
}

export function getHeadingLevel($el) {
  if (!$el || !$el.length) return null;
  const tagName = String($el.get(0)?.tagName || '').toLowerCase();
  const tagMatch = tagName.match(/^h([2-5])$/);
  if (tagMatch) {
    const level = Number.parseInt(tagMatch[1], 10);
    return Number.isFinite(level) ? level : null;
  }
  const classes = String($el.attr('class') || '');
  const match = classes.match(/mw-heading(\d)/);
  if (!match) return null;
  const level = Number.parseInt(match[1], 10);
  return Number.isFinite(level) ? level : null;
}

export function skipSection($, headingEl, level) {
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

export function parseOverviewTablesForHeading(
  $,
  headingWrapper,
  { leagueTitle, leagueId } = {},
  context = {}
) {
  const level = getHeadingLevel(headingWrapper);
  if (!level) return [];

  const headingTag = `h${level}`;
  const headingEl = headingWrapper.is(headingTag)
    ? headingWrapper
    : headingWrapper.find(headingTag).first();
  if (!headingEl.length) return [];

  const headingId = headingEl.attr('id') || leagueId || null;
  const headingTitle = headingEl.text().trim();
  let tableTitle = headingTitle || leagueTitle || headingId || 'Unknown league';
  if (leagueTitle && (isGenericLeagueHeading(headingTitle) || !headingTitle)) {
    tableTitle = leagueTitle;
  }

  if (
    isExcludedOverviewCompetitionLabel(headingTitle, tableTitle, leagueTitle, headingId, leagueId)
  ) {
    return [];
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
      tables.push({
        element: searchNode,
        legend: extractLegendForTable($, searchNode, {
          promoteKeywords: [/promot/, /play-?off/],
        }),
      });
    } else {
      searchNode.find('table.wikitable').each((_, tbl) => {
        const $tbl = $(tbl);
        tables.push({
          element: $tbl,
          legend: extractLegendForTable($, $tbl, {
            promoteKeywords: [/promot/, /play-?off/],
          }),
        });
      });
    }

    searchNode = searchNode.next();
  }

  const overviewEntries = [];
  tables.forEach((table, index) => {
    const rows = parseLeagueTableRows($, table.element, {
      suppressPromotionFlags,
      legendMap: table.legend,
    });
    if (!rows.length) return;
    overviewEntries.push({
      title: tableTitle,
      id: headingId,
      tableIndex: tables.length > 1 ? index : 0,
      isTopFlight: suppressPromotionFlags,
      rows,
    });
  });

  return overviewEntries;
}

export function inferOverviewTierNumber(table, seasonNumber) {
  return inferEnglishLeagueTier(`${table?.title || ''} ${table?.id || ''}`, seasonNumber);
}

export function deriveMajorTierIndexes(tables) {
  if (!Array.isArray(tables) || !tables.length) {
    return { topFlightIndex: null, secondTierIndex: null };
  }

  const seasonNumber = Number.parseInt(String(tables[0]?.season ?? ''), 10);
  const hasPremierLeagueHeading = tables.some((table) =>
    WIKIPEDIA_OVERVIEW_CONFIG.topFlightKeywords.some((keyword) =>
      String(table?.title || '')
        .toLowerCase()
        .includes(keyword)
    )
  );

  let topFlightIndex = tables.findIndex((table) => {
    if (!table) return false;
    const inferredTier =
      Number.isFinite(seasonNumber) && seasonNumber > 0
        ? inferOverviewTierNumber(table, seasonNumber)
        : null;
    if (inferredTier === 1) return true;
    if (typeof table.isTopFlight === 'boolean') return table.isTopFlight;
    return shouldTreatAsTopFlight(table.title, { hasPremierLeagueHeading });
  });

  if (topFlightIndex === -1) {
    topFlightIndex = tables.length ? 0 : -1;
  }

  const isSecondTierTitle = (table) => {
    const title = table?.title;
    const normalized = String(title || '').toLowerCase();
    if (!normalized) return false;
    if (isGenericLeagueHeading(title)) return true;

    const inferredTier =
      Number.isFinite(seasonNumber) && seasonNumber > 0
        ? inferOverviewTierNumber(table, seasonNumber)
        : null;
    if (inferredTier === 2) return true;

    if (hasPremierLeagueHeading) {
      return WIKIPEDIA_OVERVIEW_CONFIG.secondTierPostPremierKeywords.some((keyword) =>
        normalized.includes(keyword)
      );
    }

    return normalized.includes('second division');
  };

  let secondTierIndex = null;
  if (topFlightIndex !== -1) {
    for (let i = topFlightIndex + 1; i < tables.length; i++) {
      const candidate = tables[i];
      if (!candidate || !Array.isArray(candidate.rows) || !candidate.rows.length) continue;
      if (!isSecondTierTitle(candidate)) continue;
      secondTierIndex = i;
      break;
    }
  }

  return {
    topFlightIndex: topFlightIndex === -1 ? null : topFlightIndex,
    secondTierIndex,
  };
}

export function collectOutcomeTeams(tables, flag, options = {}) {
  const indexes = Array.isArray(options?.includeIndexes)
    ? options.includeIndexes.filter((index) => Number.isInteger(index) && index >= 0)
    : [];
  const allowedIndexes = indexes.length ? new Set(indexes) : null;
  const teams = new Set();

  tables.forEach((table, index) => {
    if (allowedIndexes && !allowedIndexes.has(index)) return;
    if (!table || !Array.isArray(table.rows)) return;
    table.rows.forEach((row) => {
      if (row && row[flag] && row.team) {
        teams.add(row.team);
      }
    });
  });

  return Array.from(teams);
}
