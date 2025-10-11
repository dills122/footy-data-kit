#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'node:path';
import { buildPromotionRelegation, saveResults } from './parse-season-pages.js';

const program = new Command();

program
  .name('wiki-league')
  .description('CLI tool to generate Football League promotion/relegation data from Wikipedia')
  .version('1.0.0');

program
  .command('build')
  .description('Build dataset between given start and end years')
  .option('-s, --start <year>', 'Start year', '1888')
  .option('-e, --end <year>', 'End year', '2000')
  .option('-o, --output <path>', 'Output directory', './data-output')
  .action(async (opts) => {
    const startYear = parseInt(opts.start, 10);
    const endYear = parseInt(opts.end, 10);
    const outputDir = path.resolve(opts.output);
    const outputFile = path.join(outputDir, 'wiki_promotion_relegations_by_season.json');

    console.log(`🏁 Generating data from ${startYear} to ${endYear}...`);

    process.on('SIGINT', () => {
      console.log('\n🛑 Interrupted, Last entry saved will be last one');
      process.exit(0);
    });

    const data = await buildPromotionRelegation(startYear, endYear, outputFile);
    saveResults(data, outputFile);
    console.log(`\n📂 Final output written to ${outputFile}`);
  });

program.parse(process.argv);
