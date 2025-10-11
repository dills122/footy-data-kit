import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, writeToPath } from 'fast-csv';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, 'data', 'england.csv');
const outputDir = path.join(__dirname, 'data');

const rowsByTier = {};

fs.createReadStream(inputFile)
  .pipe(parse({ headers: true }))
  .on('error', (error) => console.error(error))
  .on('data', (row) => {
    const tier = row.tier;
    if (!rowsByTier[tier]) {
      rowsByTier[tier] = [];
    }
    rowsByTier[tier].push(row);
  })
  .on('end', () => {
    Object.entries(rowsByTier).forEach(([tier, rows]) => {
      if (rows.length > 0) {
        const outputPath = path.join(outputDir, `england_tier${tier}.csv`);
        writeToPath(outputPath, rows, { headers: true })
          .on('finish', () => {
            console.log(`Wrote ${outputPath} with ${rows.length} rows`);
          })
          .on('error', (err) => console.error(err));
      }
    });
  });
