import * as cheerio from 'cheerio';
import * as path from 'node:path';
import {
  buildOverviewSeasonSlug as buildOverviewSeasonSlugFromConfig,
  buildWikipediaArticleUrl,
  resolveWikipediaDatasetPath,
  WIKIPEDIA_DATA_SOURCES,
} from '../config.js';
import { buildSeasonInfo, buildTierData } from '../data/generate-output-files.js';
import { createDatasetStore } from '../data/dataset-store.js';
import { fetchWikipediaSeasonPage } from '../parser-core/page-fetcher.js';
import {
  deriveMajorTierIndexes,
  findLeagueSectionHeading,
  getHeadingLevel,
  headingHasLeagueKeyword,
  inferOverviewTierNumber,
  isGenericLeagueHeading,
  parseOverviewTablesForHeading,
} from '../parser-core/wiki-overview-parser.js';
import {
  buildHistoricalPlaceholderSeasonInfo,
  isWarSuspensionSeason,
  getHistoricalSeasonStatus,
  extractSeasonKeyFromSlug,
  extractSeasonYearFromSlug,
  seasonHasTierData,
} from '../data/season-rules.js';

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
  let pointer = headingWrapper.length ? headingWrapper.next() : leagueHeading.next();

  while (pointer.length) {
    const level = getHeadingLevel(pointer);
    if (level === 2) break;

    if (level && level >= 3 && level <= 5) {
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

export function buildSeasonOverviewSeasonRecord({ seasonKey, seasonYear, seasonSlug, tables }) {
  const numericSeason = Number.isFinite(seasonYear)
    ? /** @type {number} */ (seasonYear)
    : extractSeasonYearFromSlug(seasonKey);
  const safeSeason = Number.isFinite(numericSeason) ? numericSeason : 0;
  const normalizedTables = tables.map((table) => ({ ...table, season: safeSeason }));
  const { topFlightIndex, secondTierIndex } = deriveMajorTierIndexes(normalizedTables);
  const promotedTeams =
    secondTierIndex != null
      ? collectTopFlightPromotions(normalizedTables[secondTierIndex], safeSeason)
      : [];
  const relegatedTeams =
    topFlightIndex != null ? collectTopFlightRelegations(normalizedTables[topFlightIndex]) : [];

  const seasonInfo = buildSeasonInfo(safeSeason, {
    promoted: promotedTeams,
    relegated: relegatedTeams,
    metadata: {
      seasonSlug,
      tableCount: tables.length,
    },
  });

  const record = { seasonInfo };
  const usedTierNumbers = new Set();
  let nextSequentialTier = 1;

  normalizedTables.forEach((table, index) => {
    const inferredTierNumber = inferOverviewTierNumber(table, safeSeason);
    let tierNumber = inferredTierNumber;

    if (tierNumber == null || usedTierNumbers.has(tierNumber)) {
      while (usedTierNumbers.has(nextSequentialTier)) {
        nextSequentialTier += 1;
      }
      tierNumber = nextSequentialTier;
    }

    usedTierNumbers.add(tierNumber);
    while (usedTierNumbers.has(nextSequentialTier)) {
      nextSequentialTier += 1;
    }

    const tierKey = `tier${tierNumber}`;
    record[tierKey] = buildTierData(safeSeason, table.rows, {
      promoted: tierNumber === 2 ? collectTopFlightPromotions(table, safeSeason) : undefined,
      relegated: tierNumber === 1 ? collectTopFlightRelegations(table) : undefined,
      metadata: {
        source: WIKIPEDIA_DATA_SOURCES.overview.sourceId,
        sourceUrl: buildWikipediaArticleUrl(seasonSlug),
        seasonSlug,
        leagueId: table.id || null,
        title: table.title,
        leagueLevel: inferredTierNumber ?? tierNumber,
        tableIndex: table.tableIndex ?? index,
        tableCount: tables.length,
        tierKey,
      },
    });
  });

  return record;
}

export function buildHistoricalSeasonPlaceholderRecord(seasonKey, seasonSlug) {
  const placeholder = buildHistoricalPlaceholderSeasonInfo(seasonKey, {
    specialCompetitions:
      getHistoricalSeasonStatus(seasonKey) === 'regional-bridge-season'
        ? ['Football League North', 'Football League South']
        : [],
    notes:
      getHistoricalSeasonStatus(seasonKey) === 'abandoned-season'
        ? 'Official Football League season abandoned after the outbreak of war; wartime regional competitions followed.'
        : getHistoricalSeasonStatus(seasonKey) === 'regional-bridge-season'
        ? 'Regional Football League North and South competitions were played without normal promotion or relegation.'
        : 'Official Football League competition was suspended and replaced by wartime regional competitions.',
  });

  const { promoted, relegated, season, ...metadata } = placeholder;
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
  const seasonKey = extractSeasonKeyFromSlug(seasonSlug) || 'unknown-season';
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
  buildSeasonOverviewSlug,
  buildSeasonOverview,
  buildSeasonOverviewForSlug,
  buildSeasonOverviewSeasonRecord,
  parseOverviewLeagueTables,
};
