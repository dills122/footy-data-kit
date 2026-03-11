import { buildSeasonInfo, buildTierData } from './generate-output-files.js';
import {
  buildPromotionSeasonSlug,
  buildWikipediaArticleUrl,
  WIKIPEDIA_DATA_SOURCES,
  WIKIPEDIA_GENERATORS,
  WIKIPEDIA_SEASON_RANGES,
} from './config.js';
import parseDivisionTable from './parse-division-table.js';
import { createDatasetStore } from './dataset-store.js';
import { fetchWikipediaSeasonPage } from './parser-core/page-fetcher.js';
import {
  isWarSuspensionSeason,
  reconcileSeasonInfoContinuity,
  seasonHasTierData,
} from './season-rules.js';

export async function fetchSeasonTeams(seasonSlug) {
  const fetchedPage = await fetchWikipediaSeasonPage(seasonSlug);
  if (!fetchedPage) {
    return { first: [], second: [] };
  }

  const html = fetchedPage.html;
  const pageUrl = fetchedPage.pageUrl;
  const firstDivTable = parseDivisionTable(html, 'first');
  if (!firstDivTable.length) {
    console.warn(`⚠️  Missing First Division table data on ${seasonSlug} (${pageUrl})`);
  }

  const secondDivTable = parseDivisionTable(html, 'second');
  if (!secondDivTable.length) {
    console.warn(`⚠️  Missing Second Division table data on ${seasonSlug} (${pageUrl})`);
  }

  return { first: firstDivTable, second: secondDivTable };
}

export function constructTier1SeasonResults(tier1SeasonTable, tier2SeasonTable, year, slug) {
  const pageUrl = buildWikipediaArticleUrl(slug);
  const tier1RelegatedTeams = tier1SeasonTable
    .filter((team) => team.wasRelegated)
    .map((row) => row.team);
  const tier2PromotedTeams = tier2SeasonTable
    .filter((team) => team.wasPromoted)
    .map((row) => row.team);

  if (tier1RelegatedTeams.length || tier2PromotedTeams.length) {
    console.log(`   📊 ${year}-${String(year + 1).slice(-2)} (${pageUrl})`);
    if (tier1RelegatedTeams.length)
      console.log(`     ⬇️ Relegated: ${tier1RelegatedTeams.join(', ')}`);
    if (tier2PromotedTeams.length)
      console.log(`     ⬆️ Promoted: ${tier2PromotedTeams.join(', ')}`);
  } else {
    console.log(`   ℹ️  No promotions/relegations found for ${year} (${pageUrl})`);
  }

  const tier1 = buildTierData(year, tier1SeasonTable, {
    promoted: tier2PromotedTeams,
    metadata: {
      source: WIKIPEDIA_DATA_SOURCES.promotion.sourceId,
      sourceUrl: pageUrl,
      seasonSlug: slug,
      tierKey: 'tier1',
    },
  });

  const tier2 = buildTierData(year, tier2SeasonTable, {
    metadata: {
      source: WIKIPEDIA_DATA_SOURCES.promotion.sourceId,
      sourceUrl: pageUrl,
      seasonSlug: slug,
      tierKey: 'tier2',
    },
  });

  return { tier1, tier2 };
}

const RAW_PROMOTION_CONTINUITY_FINAL_SEASON = WIKIPEDIA_SEASON_RANGES.classicPromotionFinalSeason;

export function finalizePromotionDataset(dataset, options = {}) {
  if (!dataset?.seasons || typeof dataset.seasons !== 'object') return dataset;

  const ignoreWarYears = Boolean(options.ignoreWarYears);
  if (ignoreWarYears) {
    for (const seasonKey of Object.keys(dataset.seasons)) {
      const seasonNumber = Number.parseInt(seasonKey, 10);
      if (Number.isFinite(seasonNumber) && isWarSuspensionSeason(seasonNumber)) {
        delete dataset.seasons[seasonKey];
      }
    }
  }

  reconcileSeasonInfoContinuity(dataset, {
    maxContinuitySeason: RAW_PROMOTION_CONTINUITY_FINAL_SEASON,
  });

  return dataset;
}

export async function buildPromotionRelegation(startYear, endYear, outputFile, options = {}) {
  const updateOnly = Boolean(options.updateOnly);
  const forceUpdate = Boolean(options.forceUpdate);
  const ignoreWarYears = Boolean(options.ignoreWarYears);
  const store = createDatasetStore(outputFile, {
    generator: WIKIPEDIA_GENERATORS.promotion,
    buildOptions: {
      startYear,
      endYear,
      updateOnly,
      forceUpdate,
      ignoreWarYears,
    },
  });
  const dataset = store.dataset;

  for (let year = startYear; year <= endYear; year++) {
    const existingRecord = dataset.seasons?.[String(year)];
    if (!forceUpdate && updateOnly && seasonHasTierData(existingRecord)) {
      console.log(`⏭️ Skipping ${year} (existing tier data)`);
      continue;
    }

    if (ignoreWarYears && isWarSuspensionSeason(year)) {
      console.log(`⏭️ Skipping ${year} (WWI/WWII suspension)`);
      continue;
    }

    const slug = buildPromotionSeasonSlug(year);

    console.log(`\n📖 Fetching ${slug}...`);
    const divisionResultTables = await fetchSeasonTeams(slug);

    const tier1 = divisionResultTables.first || [];
    const tier2 = divisionResultTables.second || [];
    const hasNewTierData = tier1.length + tier2.length > 0;
    if (forceUpdate && existingRecord && !hasNewTierData) {
      console.log(`⏭️ Skipping overwrite for ${year} (no data returned)`);
      continue;
    }

    const { tier1: tier1Results, tier2: tier2Results } = constructTier1SeasonResults(
      tier1,
      tier2,
      year,
      slug
    );

    const incomingPromoted = Array.isArray(tier1Results.promoted) ? [...tier1Results.promoted] : [];
    tier1Results.promoted = [];
    const seasonRecord = {
      seasonInfo: buildSeasonInfo(year, {
        promoted: incomingPromoted,
        relegated: tier1Results.relegated,
        metadata: { seasonSlug: slug, sourceUrl: buildWikipediaArticleUrl(slug) },
      }),
      tier1: tier1Results,
    };

    if (Array.isArray(tier2) && tier2.length > 0) {
      seasonRecord.tier2 = tier2Results;
    }

    store.writeSeason(year, seasonRecord);
  }

  finalizePromotionDataset(dataset, { ignoreWarYears });
  store.save();

  console.log(`\n✅ Finished building data for ${Object.keys(dataset.seasons).length} seasons.`);
  return dataset;
}
