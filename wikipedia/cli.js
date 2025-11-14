#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'node:path';
import { loadFootballData } from './generate-output-files.js';
import {
  buildSeasonOverview,
  buildSeasonOverviewForSlug,
  buildSeasonOverviewSlug,
} from './parse-ext-season-overview-pages.js';
import { buildPromotionRelegation } from './parse-season-pages.js';

const program = new Command();

program
  .name('wiki-league')
  .description('CLI tool to generate Football League promotion/relegation data from Wikipedia')
  .version('1.0.0');

async function buildSeasonData(opts) {
  const startYear = parseInt(opts.start, 10);
  const endYear = parseInt(opts.end, 10);
  const outputDir = path.resolve(opts.output);
  const outputFile = path.join(outputDir, 'wiki_promotion_relegations_by_season.json');

  console.log(`🏁 Generating data from ${startYear} to ${endYear}...`);

  process.on('SIGINT', () => {
    console.log('\n🛑 Interrupted, Last entry saved will be last one');
    process.exit(0);
  });

  await buildPromotionRelegation(startYear, endYear, outputFile, {
    updateOnly: Boolean(opts.updateOnly),
    forceUpdate: Boolean(opts.forceUpdate),
    ignoreWarYears: Boolean(opts.ignoreWarYears),
  });
  console.log(`\n📂 Final output written to ${outputFile}`);
}

program
  .command('build')
  .description('Build dataset between given start and end years')
  .option('-s, --start <year>', 'Start year', '1888')
  .option('-e, --end <year>', 'End year', '2000')
  .option('-o, --output <path>', 'Output directory', './data-output')
  .option('-u, --update-only', 'Skip seasons that already contain tier data', false)
  .option('-f, --force-update', 'Rebuild seasons even if data exists', false)
  .option('--ignore-war-years', 'Skip WWI/WWII suspension seasons', false)
  .action(buildSeasonData);

program
  .command('overview')
  .description('Build season overview league tables between given start and end years')
  .option('-s, --start <year>', 'Start year', '2008')
  .option('-e, --end <year>', 'End year', '2008')
  .option('-o, --output <path>', 'Output directory', './data-output')
  .option('-u, --update-only', 'Skip seasons that already contain tier data', false)
  .option('-f, --force-update', 'Rebuild seasons even if data exists', false)
  .option('--ignore-war-years', 'Skip WWI/WWII suspension seasons', false)
  .action(async (opts) => {
    const startYear = parseInt(opts.start, 10);
    const endYear = parseInt(opts.end, 10);
    const outputDir = path.resolve(opts.output);
    const outputFile = path.join(outputDir, 'wiki_overview_tables_by_season.json');

    console.log(`🏁 Generating overview data from ${startYear} to ${endYear}...`);

    process.on('SIGINT', () => {
      console.log('\n🛑 Interrupted, Last entry saved will be last one');
      process.exit(0);
    });

    await buildSeasonOverview(startYear, endYear, outputFile, {
      updateOnly: Boolean(opts.updateOnly),
      forceUpdate: Boolean(opts.forceUpdate),
      ignoreWarYears: Boolean(opts.ignoreWarYears),
    });
    console.log(`\n📂 Final overview output written to ${outputFile}`);
  });

program
  .command('combined')
  .description(
    'Try to fetch structured data via promotion/relegation output, fallback to overview tables for missing seasons'
  )
  .option('-s, --start <year>', 'Start year', '1888')
  .option('-e, --end <year>', 'End year', '2000')
  .option('-o, --output <path>', 'Output directory', './data-output')
  .option('-u, --update-only', 'Skip seasons that already contain tier data', false)
  .option('-f, --force-update', 'Rebuild seasons even if data exists', false)
  .option('--ignore-war-years', 'Skip WWI/WWII suspension seasons', false)
  .action(async (opts) => {
    const startYear = parseInt(opts.start, 10);
    const endYear = parseInt(opts.end, 10);
    const outputDir = path.resolve(opts.output);
    const promoOutput = path.join(outputDir, 'wiki_promotion_relegations_by_season.json');
    const overviewOutput = path.join(outputDir, 'wiki_overview_tables_by_season.json');
    const updateOnly = Boolean(opts.updateOnly);
    const forceUpdate = Boolean(opts.forceUpdate);
    const ignoreWarYears = Boolean(opts.ignoreWarYears);

    console.log(`🏁 Combined fetch from ${startYear} to ${endYear}...`);

    process.on('SIGINT', () => {
      console.log('\n🛑 Interrupted, Last entry saved will be last one');
      process.exit(0);
    });

    await buildPromotionRelegation(startYear, endYear, promoOutput, {
      updateOnly,
      forceUpdate,
      ignoreWarYears,
    });

    if (forceUpdate) {
      await buildSeasonOverview(startYear, endYear, overviewOutput, {
        updateOnly: false,
        forceUpdate: true,
        ignoreWarYears,
      });
    } else {
      const promoData = loadFootballData(promoOutput);
      const isWarYear = (year) => (year >= 1915 && year <= 1919) || (year >= 1940 && year <= 1946);
      const missingSeasons = [];
      for (let year = startYear; year <= endYear; year++) {
        if (ignoreWarYears && isWarYear(year)) continue;
        const record = promoData.seasons?.[String(year)];
        const tier1Table = record?.tier1?.table;
        if (!Array.isArray(tier1Table) || tier1Table.length === 0) {
          missingSeasons.push(year);
        }
      }

      if (missingSeasons.length) {
        console.log(`\n🔄 Running overview fallback for seasons: ${missingSeasons.join(', ')}`);
        for (const year of missingSeasons) {
          const slug = buildSeasonOverviewSlug(year);
          await buildSeasonOverviewForSlug(slug, overviewOutput);
        }
      } else {
        console.log('\n✅ No overview fallback required; promotion data exists for all seasons.');
      }
    }

    console.log(`\n📂 Promotion/relegation data: ${promoOutput}`);
    console.log(`📂 Overview tables: ${overviewOutput}`);
  });

program.parse(process.argv);
