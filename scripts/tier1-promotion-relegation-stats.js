import fs from 'node:fs';
import path from 'node:path';

const tier1Path = path.join(process.cwd(), 'data-output', 'tier1_league_tables.json');
const tier2Path = path.join(process.cwd(), 'data-output', 'tier2_league_tables.json');
const outputPath = path.join(process.cwd(), 'data-output', 'tier1_promotion_relegation_stats.json');

const tier1Data = JSON.parse(fs.readFileSync(tier1Path, 'utf-8'));
const tier2Data = JSON.parse(fs.readFileSync(tier2Path, 'utf-8'));

/**
 * Returns number of promoted/relegated teams for a given top-flight season
 */
function getPromotionRelegationCounts(seasonYear) {
  const year = parseInt(seasonYear.split('-')[0], 10);

  if (year <= 1891) return { relegated: 0, promoted: 0 }; // election era
  if (year <= 1897) return { relegated: 0, promoted: 0 }; // test matches
  if (year <= 1980) return { relegated: 2, promoted: 2 };
  if (year <= 1991) return { relegated: 3, promoted: 3 }; // includes playoffs
  if (year === 1995) return { relegated: 4, promoted: 2 }; // special reduction
  return { relegated: 3, promoted: 3 }; // modern Premier League
}

/**
 * Calculate promotion/relegation stats using league table positions from both tiers
 */
function calculatePromotionsRelegations(t1Data, t2Data) {
  const seasons = Object.keys(t1Data).sort(
    (a, b) => parseInt(a.split('-')[0]) - parseInt(b.split('-')[0])
  );
  const stats = {}; // { team: { promoted: x, relegated: y } }

  for (const season of seasons) {
    const t1Table = t1Data[season]?.leagueTable || [];
    const t2Table = t2Data[season]?.leagueTable || [];

    const { relegated, promoted } = getPromotionRelegationCounts(season);

    if (relegated > 0 && t1Table.length >= relegated) {
      // Relegated teams = bottom N in Tier 1
      const relegatedTeams = t1Table.slice(-relegated).map((t) => t.team);
      for (const team of relegatedTeams) {
        stats[team] = stats[team] || { promoted: 0, relegated: 0 };
        stats[team].relegated += 1;
      }
    }

    if (promoted > 0 && t2Table.length >= promoted) {
      // Promoted teams = top N in Tier 2
      const promotedTeams = t2Table.slice(0, promoted).map((t) => t.team);
      for (const team of promotedTeams) {
        stats[team] = stats[team] || { promoted: 0, relegated: 0 };
        stats[team].promoted += 1;
      }
    }
  }

  return stats;
}

// Run calculation
const result = calculatePromotionsRelegations(tier1Data, tier2Data);

// Write JSON output
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`Promotion/relegation stats written to ${outputPath}`);
