// install dependencies first: npm install wikipedia cheerio
import * as fs from 'node:fs';
import * as path from 'node:path';
import wikipedia from 'wikipedia';

import parseDivisionTable from './parse-division-table.js';

const outputFile = path.join(
  process.cwd(),
  'data-output',
  `wiki_promotion_relegations_by_season.json`
);

// Simple wait function
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Persistence helpers ---
function saveResults(results) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`💾 Progress saved to ${outputFile}`);
}

async function fetchSeasonTeams(seasonSlug) {
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

  return {
    first: firstDivTable,
    second: secondDivTable,
  };
}

async function buildPromotionRelegation(startYear, endYear) {
  const results = { seasons: {} };

  for (let year = startYear; year <= endYear; year++) {
    const endYearEndingDigits = String(year + 1).slice(-2);
    const slug = `${year}-${endYearEndingDigits === '00' ? String(year + 1) : endYearEndingDigits}_Football_League`;

    console.log(`\n📖 Fetching ${slug}...`);
    const divisionResultTables = await fetchSeasonTeams(slug);

    const tier1 = divisionResultTables.first || [];
    const tier2 = divisionResultTables.second || [];

    const tier1Results = constructTier1SeasonResults(tier1, tier2, year, slug);

    results.seasons[year] = { tier1: tier1Results, tier2 };

    // ✅ Save progress after every season
    saveResults(results);
  }

  console.log(`\n✅ Finished building data for ${Object.keys(results.seasons).length} seasons.`);
  return results;
}

function constructTier1SeasonResults(tier1SeasonTable, tier2SeasonTable, year, slug) {
  const pageUrl = `https://en.wikipedia.org/wiki/${slug}`;

  const tier1RelegatedTeams = tier1SeasonTable
    .filter((team) => team.wasRelegated)
    .map((row) => row.team);
  const tier2PromotedTeams = tier2SeasonTable
    .filter((team) => team.wasPromoted)
    .map((row) => row.team);

  if (tier1RelegatedTeams.length || tier2PromotedTeams.length) {
    console.log(`   📊 ${year}-${String(year + 1).slice(-2)} (${pageUrl})`);
    if (tier1RelegatedTeams.length) {
      console.log(`     ⬇️ Relegated: ${tier1RelegatedTeams.join(', ')}`);
    }
    if (tier2PromotedTeams.length) {
      console.log(`     ⬆️ Promoted: ${tier2PromotedTeams.join(', ')}`);
    }
  } else {
    console.log(`   ℹ️  No promotions/relegations found for ${year} (${pageUrl})`);
  }

  return {
    season: year,
    table: tier1SeasonTable,
    relegated: tier1RelegatedTeams,
    promoted: tier2PromotedTeams,
  };
}

(async () => {
  const results = { seasons: {} };

  // Save partial results if script is interrupted
  process.on('SIGINT', () => {
    console.log('\n🛑 Caught interrupt signal, saving progress...');
    saveResults(results);
    process.exit(0);
  });
  //TODO need to look into new ones starting in 2004-05_Football_League
  const data = await buildPromotionRelegation(1888, 2000);

  saveResults(data);
  console.log(`\n📂 Final league tables written to ${outputFile}`);
})();
