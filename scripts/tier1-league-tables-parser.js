import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'fast-csv';

const TIER_KEY = 'tier2';

const tier1Dir = path.join(process.cwd(), 'data', 'season_groups');
const outputFile = path.join(process.cwd(), 'data-output', `${TIER_KEY}_league_tables.json`);

/**
 * Utility to get league rules for a given season
 */
function getLeagueRules(seasonYear) {
  const year = parseInt(seasonYear.split('-')[0], 10);
  const pointsWin = year <= 1980 ? 2 : 3;
  const tieBreaker = year <= 1975 ? 'goalAverage' : 'goalDifference';
  return { pointsWin, tieBreaker };
}

/**
 * Calculate goal average for historical seasons
 */
function calculateGoalAverage(goalsFor, goalsAgainst) {
  return goalsAgainst === 0 ? goalsFor : goalsFor / goalsAgainst;
}

/**
 * Calculate league table given match rows and season
 */
function calculateLeagueTable(rows, season) {
  const { pointsWin, tieBreaker } = getLeagueRules(season);
  const table = {};

  rows.forEach((row) => {
    const home = row.home;
    const visitor = row.visitor;
    const hgoal = parseInt(row.hgoal, 10);
    const vgoal = parseInt(row.vgoal, 10);
    const result = row.result;

    if (!table[home])
      table[home] = {
        team: home,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
    if (!table[visitor])
      table[visitor] = {
        team: visitor,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };

    table[home].played += 1;
    table[visitor].played += 1;

    table[home].goalsFor += hgoal;
    table[home].goalsAgainst += vgoal;
    table[visitor].goalsFor += vgoal;
    table[visitor].goalsAgainst += hgoal;

    if (result === 'H') {
      table[home].won += 1;
      table[home].points += pointsWin;
      table[visitor].lost += 1;
    } else if (result === 'A') {
      table[visitor].won += 1;
      table[visitor].points += pointsWin;
      table[home].lost += 1;
    } else if (result === 'D') {
      table[home].draw += 1;
      table[home].points += 1;
      table[visitor].draw += 1;
      table[visitor].points += 1;
    }
  });

  // Convert to array and compute derived stats
  const leagueArray = Object.values(table).map((team) => {
    const gd = team.goalsFor - team.goalsAgainst;
    const ga = calculateGoalAverage(team.goalsFor, team.goalsAgainst);
    return { ...team, goalDifference: gd, goalAverage: ga };
  });

  // Sort according to historical rules
  if (tieBreaker === 'goalAverage') {
    leagueArray.sort(
      (a, b) => b.points - a.points || b.goalAverage - a.goalAverage || b.goalsFor - a.goalsFor
    );
  } else {
    leagueArray.sort(
      (a, b) =>
        b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor
    );
  }

  return leagueArray;
}

// Read all tier1 grouped CSV files
const tier1Files = fs
  .readdirSync(tier1Dir)
  .filter((f) => f.startsWith(`england_${TIER_KEY}_`) && f.endsWith('.csv'));

(async () => {
  const allSeasonsTables = {};

  for (const file of tier1Files) {
    const rows = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(path.join(tier1Dir, file))
        .pipe(parse({ headers: true }))
        .on('error', (err) => reject(err))
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve());
    });

    // Group rows by season
    const seasons = {};
    rows.forEach((row) => {
      const season = row.Season;
      if (!seasons[season]) seasons[season] = [];
      seasons[season].push(row);
    });

    // Calculate league table for each season
    for (const [season, seasonRows] of Object.entries(seasons)) {
      const table = calculateLeagueTable(seasonRows, season);

      allSeasonsTables[season] = {
        season: season,
        leagueTable: table,
        metadata: {
          top4: table.slice(0, 4).map((t) => t.team),
          bottom4: table.slice(-4).map((t) => t.team),
        },
      };
    }
  }

  // Write JSON output
  fs.writeFileSync(outputFile, JSON.stringify(allSeasonsTables, null, 2));
  console.log(`League tables written to ${outputFile}`);
})();
