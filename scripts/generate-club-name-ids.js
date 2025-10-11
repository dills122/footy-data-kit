import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'fast-csv';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, 'data', 'england.csv');
const outputFile = path.join(__dirname, 'club_names.json');

const clubSet = new Set();

fs.createReadStream(inputFile)
  .pipe(parse({ headers: true }))
  .on('error', (err) => console.error(err))
  .on('data', (row) => {
    if (row.home) clubSet.add(row.home.trim());
    if (row.visitor) clubSet.add(row.visitor.trim());
  })
  .on('end', () => {
    const clubs = Array.from(clubSet).sort();
    const clubMap = clubs.map((name, index) => ({
      id: `club_${index + 1}`,
      name,
    }));
    fs.writeFileSync(outputFile, JSON.stringify(clubMap, null, 2));
    console.log(`Extracted ${clubs.length} unique clubs to ${outputFile}`);
  });
