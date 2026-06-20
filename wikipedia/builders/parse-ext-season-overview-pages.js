import * as cheerio from 'cheerio';
import * as path from 'node:path';
import {
  buildOverviewSeasonSlug as buildOverviewSeasonSlugFromConfig,
  buildWikipediaArticleUrl,
  getWikipediaCanonicalLeagueLabel,
  getWikipediaLeagueLevelRule,
  getWikipediaLeagueStructureSpecialCases,
  getWikipediaLowerTierCompetitionSourceForSlug,
  getWikipediaLowerTierCompetitionSourceSlugs,
  resolveWikipediaDatasetPath,
  WIKIPEDIA_DATA_SOURCES,
} from '../config.js';
import { createDatasetStore } from '../data/dataset-store.js';
import { buildSeasonInfo, buildTierData } from '../data/generate-output-files.ts';
import {
  applyOverviewSeasonOutcomeOverrides,
  buildHistoricalPlaceholderSeasonInfo,
  extractSeasonKeyFromSlug,
  extractSeasonYearFromSlug,
  getHistoricalSeasonStatus,
  isWarSuspensionSeason,
  seasonHasTierData,
} from '../data/season-rules.js';
import { fetchWikipediaSeasonPage } from '../parser-core/page-fetcher.js';
import {
  deriveMajorTierIndexes,
  findLeagueSectionHeading,
  getHeadingLevel,
  headingHasLeagueKeyword,
  inferOverviewTierNumber,
  isExcludedOverviewCompetitionLabel,
  isGenericLeagueHeading,
  parseOverviewTablesForHeading,
  skipSection,
} from '../parser-core/wiki-overview-parser.js';

/**
 * @typedef {import('../models/wikipedia.ts').TierKey} TierKey
 * @typedef {import('../models/wikipedia.ts').WikipediaOverviewParsedTable} WikipediaOverviewParsedTable
 * @typedef {import('../models/wikipedia.ts').WikipediaOverviewTierProfile} WikipediaOverviewTierProfile
 */

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
    $('.mw-heading, h2, h3, h4, h5').each((_, el) => {
      const $headingWrapper = $(el);
      if ($headingWrapper.is('h2, h3, h4, h5') && $headingWrapper.closest('.mw-heading').length) {
        return;
      }
      const level = getHeadingLevel($headingWrapper);
      if (!level || level < 2 || level > 5) return;

      while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }

      const headingTag = `h${level}`;
      const $headingEl = $headingWrapper.is(headingTag)
        ? $headingWrapper
        : $headingWrapper.find(headingTag).first();
      if (!$headingEl.length) {
        headingStack.push({ level, title: null, id: null, hasLeagueContext: false });
        return;
      }

      const rawTitle = $headingEl.text().trim();
      const headingId = $headingEl.attr('id') || null;
      const hasKeyword = headingHasLeagueKeyword(rawTitle);
      const inheritsContext = headingStack.some((parent) => parent.hasLeagueContext);
      const hasLeagueContext = hasKeyword || inheritsContext;
      const inheritsExcludedCompetition = headingStack.some(
        (parent) => parent.isExcludedCompetition
      );
      const isExcludedCompetition =
        inheritsExcludedCompetition || isExcludedOverviewCompetitionLabel(rawTitle, headingId);

      const ancestorForFallback = [...headingStack]
        .slice()
        .reverse()
        .find((ancestor) => ancestor.hasLeagueContext && ancestor.title);

      headingStack.push({
        level,
        title: rawTitle,
        id: headingId,
        hasLeagueContext,
        isExcludedCompetition,
      });

      if (!hasLeagueContext || isExcludedCompetition) {
        return;
      }

      let fallbackTitle = null;
      let fallbackId = null;
      if (isGenericLeagueHeading(rawTitle) && ancestorForFallback) {
        fallbackTitle = ancestorForFallback.title;
        fallbackId = ancestorForFallback.id;
      }

      const entries = parseOverviewTablesForHeading(
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
  const rootLeagueTitle = leagueHeading.text().trim() || undefined;
  const rootLeagueId = leagueHeading.attr('id') || undefined;
  const rootEntries = parseOverviewTablesForHeading(
    $,
    headingWrapper.length ? headingWrapper : leagueHeading,
    {
      leagueTitle: rootLeagueTitle,
      leagueId: rootLeagueId,
    },
    context
  );
  overview.push(...rootEntries);
  let pointer = headingWrapper.length ? headingWrapper.next() : leagueHeading.next();

  while (pointer.length) {
    const level = getHeadingLevel(pointer);
    if (level === 2) break;

    if (level && level >= 3 && level <= 5) {
      const headingTag = `h${level}`;
      const $headingEl = pointer.is(headingTag) ? pointer : pointer.find(headingTag).first();
      const rawTitle = $headingEl.text().trim();
      const headingId = $headingEl.attr('id') || null;
      if (isExcludedOverviewCompetitionLabel(rawTitle, headingId)) {
        pointer = skipSection($, pointer, level);
        continue;
      }

      const entries = parseOverviewTablesForHeading(
        $,
        pointer,
        {
          leagueTitle: rootLeagueTitle,
          leagueId: rootLeagueId,
        },
        context
      );
      overview.push(...entries);
    }

    pointer = pointer.next();
  }

  return overview;
}

export async function fetchSeasonOverviewTables(seasonSlug) {
  const fetchedPage = await fetchWikipediaSeasonPage(seasonSlug);
  if (!fetchedPage) {
    return [];
  }

  const leagueTables = parseOverviewLeagueTables(fetchedPage.html);
  if (!leagueTables.length) {
    console.warn(`⚠️ No league tables found on ${seasonSlug} (${fetchedPage.pageUrl})`);
  } else {
    console.log(`   📊 Found ${leagueTables.length} league tables on ${seasonSlug}`);
  }

  return leagueTables;
}

export function buildSeasonOverviewSlug(year) {
  return buildOverviewSeasonSlugFromConfig(year);
}

function normalizeOutcomeNote(note) {
  return String(note || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function rowEarnedTopFlightPromotion(row, seasonNumber) {
  if (!row) return false;
  if (row.wasPromoted) return true;

  const note = normalizeOutcomeNote(row.notes);
  if (!note) return false;

  if (note.includes('elected to the football league first division')) return true;
  if (note.includes('elected to the first division')) return true;

  if (seasonNumber <= 1891 && note.includes('elected to the football league')) {
    return !note.includes('second division');
  }

  return false;
}

function rowDroppedFromTopFlight(row) {
  if (!row) return false;
  if (row.wasRelegated) return true;

  const note = normalizeOutcomeNote(row.notes);
  if (!note) return false;

  return note.includes('failed re-election') || note.includes('not re-elected');
}

function collectTopFlightPromotions(table, seasonNumber) {
  if (!table || !Array.isArray(table.rows)) return [];
  return table.rows
    .filter((row) => rowEarnedTopFlightPromotion(row, seasonNumber))
    .map((row) => row.team);
}

function collectTopFlightRelegations(table) {
  if (!table || !Array.isArray(table.rows)) return [];
  return table.rows.filter((row) => rowDroppedFromTopFlight(row)).map((row) => row.team);
}

function resolveOverviewOutputFile(outputFile) {
  return outputFile
    ? path.resolve(outputFile)
    : resolveWikipediaDatasetPath(WIKIPEDIA_DATA_SOURCES.overview.key);
}

/**
 * @param {WikipediaOverviewParsedTable} table
 * @param {number} seasonNumber
 */
function getOverviewTableRule(table, seasonNumber) {
  return getWikipediaLeagueLevelRule(`${table?.title || ''} ${table?.id || ''}`, seasonNumber);
}

/**
 * @param {WikipediaOverviewParsedTable} table
 * @param {number} seasonNumber
 * @returns {WikipediaOverviewTierProfile}
 */
function getOverviewLeagueProfile(table, seasonNumber) {
  const tableIndex = Number(table?.tableIndex);
  const leagueId = String(table?.id || '');
  if (seasonNumber >= 2021 && leagueId === 'National_League' && tableIndex > 0) {
    return {
      level: 6,
      parallelGroup: 'national-league-north-south',
    };
  }

  const rule = getOverviewTableRule(table, seasonNumber);
  return {
    level: inferOverviewTierNumber(table, seasonNumber),
    parallelGroup: rule?.parallelGroup || null,
  };
}

function resolveDivisionKey(table) {
  const text = `${table?.title || ''} ${table?.id || ''}`.toLowerCase();
  if (text.includes('north')) return 'north';
  if (text.includes('south')) return 'south';
  if (String(table?.id || '') === 'National_League') {
    const tableIndex = Number(table?.tableIndex);
    if (tableIndex === 1) return 'north';
    if (tableIndex === 2) return 'south';
  }
  if (text.includes('central')) return 'central';
  if (text.includes('isthmian')) return 'isthmian';
  if (text.includes('northern')) return 'northern';
  return null;
}

function resolveOverviewMetadataTitle(table, safeSeason, leagueLevel) {
  const title = table?.title || null;
  if (!isGenericLeagueHeading(title)) return title;

  return getWikipediaCanonicalLeagueLabel(safeSeason, leagueLevel) || title;
}

function buildOverviewTierMetadata({
  table,
  safeSeason,
  seasonSlug,
  tierKey,
  index,
  tableCount,
  leagueLevel,
}) {
  const profile = getOverviewLeagueProfile(table, safeSeason);
  const parallelGroup = profile.parallelGroup || null;

  return {
    source: WIKIPEDIA_DATA_SOURCES.overview.sourceId,
    sourceUrl: buildWikipediaArticleUrl(seasonSlug),
    seasonSlug,
    leagueId: table.id || null,
    title: resolveOverviewMetadataTitle(table, safeSeason, profile.level ?? leagueLevel),
    leagueLevel: profile.level ?? leagueLevel ?? null,
    tableIndex: table.tableIndex ?? index,
    tableCount,
    tierKey,
    ...(parallelGroup ? { parallelGroup } : {}),
  };
}

function buildOverviewTableTier({
  table,
  safeSeason,
  seasonSlug,
  tierKey,
  index,
  tableCount,
  leagueLevel,
}) {
  return buildTierData(safeSeason, table.rows, {
    promoted: tierKey === 'tier2' ? collectTopFlightPromotions(table, safeSeason) : undefined,
    relegated: tierKey === 'tier1' ? collectTopFlightRelegations(table) : undefined,
    metadata: {
      ...buildOverviewTierMetadata({
        table,
        safeSeason,
        seasonSlug,
        tierKey,
        index,
        tableCount,
        leagueLevel,
      }),
      structure: 'single-league',
    },
  });
}

function buildParallelOverviewTier({
  entries,
  safeSeason,
  seasonSlug,
  tierKey,
  leagueLevel,
  parallelGroup,
  tableCount,
}) {
  const divisions = entries.map(({ table, index }) => {
    const divisionKey = resolveDivisionKey(table);
    return buildTierData(safeSeason, table.rows, {
      metadata: {
        ...buildOverviewTierMetadata({
          table,
          safeSeason,
          seasonSlug,
          tierKey,
          index,
          tableCount,
          leagueLevel,
        }),
        structure: 'single-league',
        parallelGroup,
        ...(divisionKey ? { divisionKey } : {}),
      },
    });
  });
  const promoted = Array.from(new Set(divisions.flatMap((division) => division.promoted)));
  const relegated = Array.from(new Set(divisions.flatMap((division) => division.relegated)));

  return buildTierData(safeSeason, [], {
    promoted,
    relegated,
    metadata: {
      source: WIKIPEDIA_DATA_SOURCES.overview.sourceId,
      sourceUrl: buildWikipediaArticleUrl(seasonSlug),
      seasonSlug,
      leagueLevel,
      structure: 'parallel-leagues',
      parallelGroup,
      divisionCount: divisions.length,
      tableCount,
      tierKey,
    },
    divisions,
  });
}

function resolveSafeSeason(seasonKey, seasonYear) {
  const numericSeason = Number.isFinite(seasonYear)
    ? /** @type {number} */ (seasonYear)
    : extractSeasonYearFromSlug(seasonKey);
  return Number.isFinite(numericSeason) ? numericSeason : 0;
}

export function buildSeasonOverviewTierRecords({ seasonKey, seasonYear, seasonSlug, tables }) {
  const safeSeason = resolveSafeSeason(seasonKey, seasonYear);
  const normalizedTables = tables.map((table) => ({ ...table, season: safeSeason }));
  const tierRecords = {};
  const usedTierNumbers = new Set();
  let nextSequentialTier = 1;
  const groupedEntries = [];
  const parallelGroupKeys = new Map();

  normalizedTables.forEach((table, index) => {
    const profile = getOverviewLeagueProfile(table, safeSeason);
    const inferredTierNumber = profile.level;
    const parallelGroup = profile.parallelGroup || null;
    let tierNumber = inferredTierNumber;
    const parallelKey =
      inferredTierNumber != null && parallelGroup ? `${inferredTierNumber}:${parallelGroup}` : null;

    if (parallelKey && parallelGroupKeys.has(parallelKey)) {
      tierNumber = inferredTierNumber;
    } else if (tierNumber == null || usedTierNumbers.has(tierNumber)) {
      while (usedTierNumbers.has(nextSequentialTier)) {
        nextSequentialTier += 1;
      }
      tierNumber = nextSequentialTier;
    }

    usedTierNumbers.add(tierNumber);
    if (parallelKey) {
      parallelGroupKeys.set(parallelKey, tierNumber);
    }
    while (usedTierNumbers.has(nextSequentialTier)) {
      nextSequentialTier += 1;
    }

    const tierKey = `tier${tierNumber}`;
    groupedEntries.push({
      table,
      index,
      tierKey,
      tierNumber,
      leagueLevel: inferredTierNumber ?? tierNumber,
      parallelGroup,
    });
  });

  const entriesByTierKey = new Map();
  for (const entry of groupedEntries) {
    const existing = entriesByTierKey.get(entry.tierKey) || [];
    existing.push(entry);
    entriesByTierKey.set(entry.tierKey, existing);
  }

  for (const [tierKey, entries] of entriesByTierKey) {
    const parallelGroup = entries[0]?.parallelGroup || null;
    const leagueLevel = entries[0]?.leagueLevel;
    if (parallelGroup && entries.length > 1) {
      tierRecords[tierKey] = buildParallelOverviewTier({
        entries,
        safeSeason,
        seasonSlug,
        tierKey,
        leagueLevel,
        parallelGroup,
        tableCount: tables.length,
      });
      continue;
    }

    const entry = entries[0];
    tierRecords[tierKey] = buildOverviewTableTier({
      table: entry.table,
      safeSeason,
      seasonSlug,
      tierKey,
      index: entry.index,
      tableCount: tables.length,
      leagueLevel: entry.leagueLevel,
    });
  }

  return tierRecords;
}

export async function buildSeasonOverviewTierRecordsForSlug(seasonSlug, options = {}) {
  const fetchTables =
    typeof options.fetchSeasonOverviewTables === 'function'
      ? options.fetchSeasonOverviewTables
      : fetchSeasonOverviewTables;
  const tables = await fetchTables(seasonSlug);
  const seasonKey = extractSeasonKeyFromSlug(seasonSlug) || 'unknown-season';
  const hasTableData = tables.some((table) => table.rows && table.rows.length);
  if (!hasTableData) {
    return { seasonKey, tierRecords: null };
  }

  const lowerTierSource = getWikipediaLowerTierCompetitionSourceForSlug(seasonSlug);
  const sourceAwareTables = lowerTierSource
    ? tables.map((table) => ({
        ...table,
        title: isGenericLeagueHeading(table.title) ? lowerTierSource.title : table.title,
      }))
    : tables;
  const seasonYear = extractSeasonYearFromSlug(seasonKey);
  return {
    seasonKey,
    tierRecords: buildSeasonOverviewTierRecords({
      seasonKey,
      seasonYear,
      seasonSlug,
      tables: sourceAwareTables,
    }),
  };
}

export function buildSeasonOverviewSeasonRecord({ seasonKey, seasonYear, seasonSlug, tables }) {
  const safeSeason = resolveSafeSeason(seasonKey, seasonYear);
  const normalizedTables = tables.map((table) => ({ ...table, season: safeSeason }));
  const { topFlightIndex, secondTierIndex } = deriveMajorTierIndexes(normalizedTables);
  const promotedTeams =
    secondTierIndex != null
      ? collectTopFlightPromotions(normalizedTables[secondTierIndex], safeSeason)
      : [];
  const relegatedTeams =
    topFlightIndex != null ? collectTopFlightRelegations(normalizedTables[topFlightIndex]) : [];
  const leagueStructureSpecialCases = getWikipediaLeagueStructureSpecialCases(safeSeason);

  const seasonInfo = buildSeasonInfo(safeSeason, {
    promoted: promotedTeams,
    relegated: relegatedTeams,
    metadata: {
      seasonSlug,
      tableCount: tables.length,
      ...(leagueStructureSpecialCases.length ? { leagueStructureSpecialCases } : {}),
    },
  });

  const record = {
    seasonInfo,
    ...buildSeasonOverviewTierRecords({ seasonKey, seasonYear, seasonSlug, tables }),
  };

  return applyOverviewSeasonOutcomeOverrides(record, seasonKey);
}

export function buildHistoricalSeasonPlaceholderRecord(seasonKey, seasonSlug) {
  const placeholder = buildHistoricalPlaceholderSeasonInfo(seasonKey);

  const { promoted, relegated, ...metadata } = placeholder;
  delete metadata.season;
  const seasonInfo = buildSeasonInfo(seasonKey, {
    promoted,
    relegated,
    metadata: {
      ...metadata,
      seasonSlug,
      sourceUrl: buildWikipediaArticleUrl(seasonSlug),
      tableCount: 0,
    },
  });

  return { seasonInfo };
}

export async function buildSeasonOverview(startYear, endYear, outputFile, options = {}) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  const updateOnly = Boolean(options.updateOnly);
  const forceUpdate = Boolean(options.forceUpdate);
  const ignoreWarYears = Boolean(options.ignoreWarYears);
  const includeWarPlaceholders = Boolean(options.includeWarPlaceholders);
  const fetchTables =
    typeof options.fetchSeasonOverviewTables === 'function'
      ? options.fetchSeasonOverviewTables
      : fetchSeasonOverviewTables;
  const store = createDatasetStore(resolvedOutputFile, {
    generator: WIKIPEDIA_DATA_SOURCES.overview.generator,
    buildOptions: {
      startYear,
      endYear,
      updateOnly,
      forceUpdate,
      ignoreWarYears,
      includeWarPlaceholders,
    },
  });
  const dataset = store.dataset;

  for (let year = startYear; year <= endYear; year++) {
    const seasonKey = String(year);
    const existingRecord = dataset.seasons?.[seasonKey];
    if (!forceUpdate && updateOnly && seasonHasTierData(existingRecord)) {
      console.log(`⏭️ Skipping ${seasonKey} (existing tier data)`);
      continue;
    }

    if (ignoreWarYears && isWarSuspensionSeason(year)) {
      console.log(`⏭️ Skipping ${seasonKey} (WWI/WWII suspension)`);
      continue;
    }

    const historicalStatus = getHistoricalSeasonStatus(year);
    if (includeWarPlaceholders && historicalStatus) {
      console.log(`\n📝 Recording ${seasonKey} as ${historicalStatus} placeholder...`);
      store.writeSeason(
        seasonKey,
        buildHistoricalSeasonPlaceholderRecord(seasonKey, buildSeasonOverviewSlug(year))
      );
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
    if (!hasTableData) {
      console.log(`⏭️ Skipping ${seasonKey} (no overview tables returned)`);
      continue;
    }
    const seasonRecord = buildSeasonOverviewSeasonRecord({
      seasonKey,
      seasonYear: year,
      seasonSlug: slug,
      tables,
    });

    store.writeSeason(seasonKey, seasonRecord);
  }

  console.log(
    `\n✅ Finished building overview data for ${Object.keys(dataset.seasons).length} seasons.`
  );
  return dataset;
}

function tierHasContent(tierValue) {
  if (!tierValue || typeof tierValue !== 'object') return false;
  return Boolean(
    (Array.isArray(tierValue.table) && tierValue.table.length) ||
      (Array.isArray(tierValue.divisions) && tierValue.divisions.length) ||
      (Array.isArray(tierValue.promoted) && tierValue.promoted.length) ||
      (Array.isArray(tierValue.relegated) && tierValue.relegated.length)
  );
}

export async function buildLowerTierSupplement(startYear, endYear, outputFile, options = {}) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  const updateOnly = Boolean(options.updateOnly);
  const forceUpdate = Boolean(options.forceUpdate);
  const fetchTables =
    typeof options.fetchSeasonOverviewTables === 'function'
      ? options.fetchSeasonOverviewTables
      : fetchSeasonOverviewTables;
  const getSourceSlugs =
    typeof options.getLowerTierSourceSlugs === 'function'
      ? options.getLowerTierSourceSlugs
      : getWikipediaLowerTierCompetitionSourceSlugs;
  const store = createDatasetStore(resolvedOutputFile, {
    generator: WIKIPEDIA_DATA_SOURCES.overview.generator,
    buildOptions: {
      startYear,
      endYear,
      mode: 'lower-tier-supplement',
      updateOnly,
      forceUpdate,
    },
  });

  for (let year = startYear; year <= endYear; year++) {
    const sourceSlugs = getSourceSlugs(year);
    if (!sourceSlugs.length) {
      console.log(`⏭️ Skipping ${year} (no lower-tier source configured)`);
      continue;
    }

    for (const sourceSlug of sourceSlugs) {
      console.log(`\n📖 Fetching lower-tier source ${sourceSlug}...`);
      const { seasonKey, tierRecords } = await buildSeasonOverviewTierRecordsForSlug(sourceSlug, {
        fetchSeasonOverviewTables: fetchTables,
      });
      if (!tierRecords) {
        console.log(`⏭️ Skipping ${sourceSlug} (no lower-tier tables returned)`);
        continue;
      }

      const recordsToWrite = {};
      const existingSeason = store.dataset.seasons?.[seasonKey] || {};
      for (const [tierKey, tierValue] of Object.entries(tierRecords)) {
        if (!/^tier\d+$/.test(tierKey)) continue;
        if (updateOnly && !forceUpdate && tierHasContent(existingSeason[tierKey])) {
          console.log(`⏭️ Skipping ${seasonKey}.${tierKey} (existing tier data)`);
          continue;
        }
        recordsToWrite[tierKey] = tierValue;
      }

      if (Object.keys(recordsToWrite).length) {
        store.writeTiers(seasonKey, recordsToWrite);
      }
    }
  }

  console.log(
    `\n✅ Finished building lower-tier supplements for ${
      Object.keys(store.dataset.seasons).length
    } seasons.`
  );
  return store.dataset;
}

export async function buildSeasonOverviewForSlug(seasonSlug, outputFile) {
  const resolvedOutputFile = resolveOverviewOutputFile(outputFile);
  const store = createDatasetStore(resolvedOutputFile, {
    generator: WIKIPEDIA_DATA_SOURCES.overview.generator,
    buildOptions: {
      seasonSlug,
      mode: 'single-season',
    },
  });
  const dataset = store.dataset;
  console.log(`\n📖 Fetching ${seasonSlug}...`);
  const tables = await fetchSeasonOverviewTables(seasonSlug);
  const hasTableData = tables.some((table) => table.rows && table.rows.length);
  const seasonKey = extractSeasonKeyFromSlug(seasonSlug) || 'unknown-season';
  if (!hasTableData) {
    console.log(`⏭️ Skipping ${seasonKey} (no overview tables returned)`);
    return { seasonKey, record: dataset.seasons[seasonKey] || null };
  }
  const seasonYear = extractSeasonYearFromSlug(seasonKey);
  const seasonRecord = buildSeasonOverviewSeasonRecord({
    seasonKey,
    seasonYear,
    seasonSlug,
    tables,
  });

  store.writeSeason(seasonKey, seasonRecord);
  console.log(`\n📂 Overview tables written to ${resolvedOutputFile}`);
  return { seasonKey, record: dataset.seasons[seasonKey] };
}

export default {
  fetchSeasonOverviewTables,
  buildLowerTierSupplement,
  buildSeasonOverviewSlug,
  buildSeasonOverview,
  buildSeasonOverviewForSlug,
  buildSeasonOverviewSeasonRecord,
  buildSeasonOverviewTierRecords,
  buildSeasonOverviewTierRecordsForSlug,
  parseOverviewLeagueTables,
};
