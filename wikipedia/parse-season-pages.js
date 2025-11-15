import {
  buildTierData,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from './generate-output-files.js';
import parseDivisionTable from './parse-division-table.js';
import { fetchHtmlForSlug, wait } from './utils.js';
export { saveResults, wait } from './utils.js';

export async function fetchSeasonTeams(seasonSlug) {
  const pageUrl = `https://en.wikipedia.org/wiki/${seasonSlug}`;
  let html;

  try {
    html = await fetchHtmlForSlug(seasonSlug);
  } catch (err) {
    console.error(`❌ Failed to fetch page for ${seasonSlug} (${pageUrl}): ${err.message}`);
    return { first: [], second: [] };
  }

  await wait(1000);

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
  const pageUrl = `https://en.wikipedia.org/wiki/${slug}`;

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
    metadata: { seasonSlug: slug, sourceUrl: pageUrl, tier: 'tier1' },
  });

  const tier2 = buildTierData(year, tier2SeasonTable, {
    metadata: { seasonSlug: slug, sourceUrl: pageUrl, tier: 'tier2' },
  });

  return { tier1, tier2 };
}

const WWI_SUSPENSION_YEARS = new Set([1915, 1916, 1917, 1918, 1919]);
const WWII_SUSPENSION_YEARS = new Set([1940, 1941, 1942, 1943, 1944, 1945, 1946]);

function seasonHasTierData(record) {
  if (!record || typeof record !== 'object') return false;
  return ['tier1', 'tier2'].some((tierKey) => {
    const tier = record[tierKey];
    if (!tier || typeof tier !== 'object') return false;
    if (Array.isArray(tier)) return tier.length > 0;
    if (Array.isArray(tier.table)) return tier.table.length > 0;
    return false;
  });
}

function isWarSuspensionYear(year) {
  if (!Number.isFinite(year)) return false;
  return WWI_SUSPENSION_YEARS.has(year) || WWII_SUSPENSION_YEARS.has(year);
}

export async function buildPromotionRelegation(startYear, endYear, outputFile, options = {}) {
  const dataset = loadFootballData(outputFile);
  const updateOnly = Boolean(options.updateOnly);
  const forceUpdate = Boolean(options.forceUpdate);
  const ignoreWarYears = Boolean(options.ignoreWarYears);

  for (let year = startYear; year <= endYear; year++) {
    const existingRecord = dataset.seasons?.[String(year)];
    if (!forceUpdate && updateOnly && seasonHasTierData(existingRecord)) {
      console.log(`⏭️ Skipping ${year} (existing tier data)`);
      continue;
    }

    if (ignoreWarYears && isWarSuspensionYear(year)) {
      console.log(`⏭️ Skipping ${year} (WWI/WWII suspension)`);
      continue;
    }

    const endYearEndingDigits = String(year + 1).slice(-2);
    const slug = `${year}-${
      endYearEndingDigits === '00' ? String(year + 1) : endYearEndingDigits
    }_Football_League`;

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
      seasonInfo: buildTierData(year, [], {
        promoted: incomingPromoted,
        relegated: tier1Results.relegated,
        metadata: { seasonSlug: slug, sourceUrl: `https://en.wikipedia.org/wiki/${slug}` },
      }),
      tier1: tier1Results,
      tier2: tier2Results,
    };

    setSeasonRecord(dataset, year, seasonRecord);
    saveFootballData(outputFile, dataset);
  }

  console.log(`\n✅ Finished building data for ${Object.keys(dataset.seasons).length} seasons.`);
  return dataset;
}
