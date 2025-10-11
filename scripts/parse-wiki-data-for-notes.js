import fs from 'node:fs';
import * as path from 'node:path';

const inputFile = path.join(
  process.cwd(),
  'data-output',
  `tier2_wiki_promotion_relegations_by_season.json`
);

// Load and parse the JSON file
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

const notesList = [];

for (const season in data.seasons) {
  const tiers = data.seasons[season];
  for (const tier in tiers) {
    const teams = tiers[tier];
    if (Array.isArray(teams)) {
      teams.forEach((team) => {
        if (team.notes !== null && team.notes !== undefined && team.notes !== '') {
          notesList.push({
            season,
            tier,
            team: team.team,
            notes: team.notes,
          });
        }
      });
    }
  }
}

// Output all notes found
console.log('Notes found:');
notesList.forEach((noteObj) => {
  console.log(
    `Season: ${noteObj.season}, Tier: ${noteObj.tier}, Team: ${noteObj.team}, Notes: ${noteObj.notes}`
  );
});
