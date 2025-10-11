import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, writeToPath } from 'fast-csv';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputDir = path.join(__dirname, 'data');
const outputDir = path.join(__dirname, 'data', 'season_groups');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get all tier files (e.g., england_tier1.csv)
const tierFiles = fs
  .readdirSync(inputDir)
  .filter((f) => f.startsWith('england_tier') && f.endsWith('.csv'));

function processTierFile(file) {
  return new Promise((resolve, reject) => {
    const rowsBySeason = {};

    fs.createReadStream(path.join(inputDir, file))
      .pipe(parse({ headers: true }))
      .on('error', (err) => reject(err))
      .on('data', (row) => {
        const season = row.Season;
        if (!rowsBySeason[season]) rowsBySeason[season] = [];
        rowsBySeason[season].push(row);
      })
      .on('end', async () => {
        const allSeasons = Object.keys(rowsBySeason)
          .map((s) => parseInt(s, 10))
          .sort((a, b) => a - b);

        for (let i = 0; i < allSeasons.length; i += 25) {
          const chunkSeasons = allSeasons.slice(i, i + 25);
          let chunkRows = [];
          chunkSeasons.forEach((season) => {
            chunkRows = chunkRows.concat(rowsBySeason[season]);
          });

          const tier = file.match(/tier(\d+)/)?.[1] ?? 'unknown';
          const startSeason = chunkSeasons[0];
          const endSeason = chunkSeasons[chunkSeasons.length - 1];
          const outputFile = path.join(
            outputDir,
            `england_tier${tier}_${startSeason}-${endSeason}.csv`
          );

          await new Promise((res, rej) => {
            writeToPath(outputFile, chunkRows, { headers: true })
              .on('finish', () => {
                console.log(`Wrote ${outputFile} with ${chunkRows.length} rows`);
                res();
              })
              .on('error', rej);
          });
        }
        resolve();
      });
  });
}

(async () => {
  for (const file of tierFiles) {
    await processTierFile(file);
  }
  console.log('All tier files processed.');
})();
