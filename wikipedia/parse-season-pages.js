import parseDivisionTable from './parse-division-table.js';
import { getWikipediaClient, wait } from './utils.js';
import {
  buildTierData,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from './generate-output-files.js';
export { saveResults, wait } from './utils.js';

export async function fetchSeasonTeams(seasonSlug) {
  const wikipedia = await getWikipediaClient();
  const pageUrl = `https://en.wikipedia.org/wiki/${seasonSlug}`;
  let html;

  try {
    const page = await wikipedia.page(seasonSlug);
    html = await page.html();
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

export async function buildPromotionRelegation(startYear, endYear, outputFile) {
  const dataset = loadFootballData(outputFile);

  for (let year = startYear; year <= endYear; year++) {
    const endYearEndingDigits = String(year + 1).slice(-2);
    const slug = `${year}-${
      endYearEndingDigits === '00' ? String(year + 1) : endYearEndingDigits
    }_Football_League`;

    console.log(`\n📖 Fetching ${slug}...`);
    const divisionResultTables = await fetchSeasonTeams(slug);

    const tier1 = divisionResultTables.first || [];
    const tier2 = divisionResultTables.second || [];

    const { tier1: tier1Results, tier2: tier2Results } = constructTier1SeasonResults(
      tier1,
      tier2,
      year,
      slug
    );

    const seasonRecord = {
      seasonInfo: buildTierData(year, [], {
        promoted: tier1Results.promoted,
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
